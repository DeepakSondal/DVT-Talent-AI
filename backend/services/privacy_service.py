"""
DVT Talent AI — Candidate Privacy & Employer Blacklist Service
Enforces strict candidate privacy shields across all search, sourcing, and job-matching paths.
"""
import os
import re
import json
import uuid
try:
    from filelock import FileLock
except ImportError:
    import contextlib
    @contextlib.contextmanager
    def FileLock(path, timeout=10):
        try:
            import fcntl
            f = open(path, "a+")
            try:
                fcntl.flock(f, fcntl.LOCK_EX)
                yield
            finally:
                fcntl.flock(f, fcntl.LOCK_UN)
                f.close()
        except Exception:
            yield
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import List, Optional, Any, Dict
import structlog
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, update, or_, and_

from config import settings
from db.models import (
    Candidate, Resume, JobCandidate, CandidateStatus,
    AgentTask, AgentTaskStatus, User, UserRole
)
from services.resume_parser import ResumeParserService

log = structlog.get_logger(__name__)


def normalize_domain(raw: Optional[str]) -> str:
    """
    Normalizes a domain or URL to a clean, lowercase FQDN.
    Handles protocols (http/https), www prefix, trailing paths, query strings, and whitespace.
    """
    if not raw or not isinstance(raw, str):
        return ""
    
    cleaned = raw.strip().lower()
    # Strip protocol
    cleaned = re.sub(r"^https?://", "", cleaned)
    # Strip www prefix
    cleaned = re.sub(r"^www\.", "", cleaned)
    # Strip path, ports, query params, fragments
    cleaned = cleaned.split("/")[0].split("?")[0].split("#")[0].split(":")[0].strip()
    return cleaned


def is_domain_or_company_blocked(
    hide_from_companies: List[str],
    employer_domain: Optional[str] = None,
    employer_name: Optional[str] = None,
    employer_email: Optional[str] = None,
) -> bool:
    """
    Evaluates whether an employer/recruiter matches any item in the candidate's blacklist.
    Checks:
    1. Exact domain match (e.g. google.com == google.com)
    2. Subdomain match (e.g. recruiter at aws.amazon.com matches blacklisted amazon.com)
    3. Recruiter email domain match (e.g. recruiter@uber.com matches uber.com)
    4. Exact or clean company name match (e.g. "Acme Corp" matches "Acme")
    """
    if not hide_from_companies:
        return False

    clean_emp_domain = normalize_domain(employer_domain)
    
    # Extract domain from email if available
    email_domain = ""
    if employer_email and "@" in employer_email:
        email_domain = normalize_domain(employer_email.split("@")[-1])

    clean_emp_name = (employer_name or "").strip().lower()

    for item in hide_from_companies:
        if not item or not isinstance(item, str) or not item.strip():
            continue
        
        clean_item = normalize_domain(item)
        raw_item_lower = item.strip().lower()

        # Check domain matches
        if clean_item:
            # 1. Exact match with employer domain
            if clean_emp_domain and clean_item == clean_emp_domain:
                return True
            
            # 2. Subdomain match: employer is a subdomain of blacklisted item (e.g. aws.amazon.com matches amazon.com)
            if clean_emp_domain and clean_emp_domain.endswith("." + clean_item):
                return True

            # 3. Match against recruiter's corporate email domain
            if email_domain and clean_item == email_domain:
                return True
            if email_domain and email_domain.endswith("." + clean_item):
                return True

        # 4. Company name text matching (case-insensitive substring/equality)
        if clean_emp_name:
            if raw_item_lower == clean_emp_name:
                return True
            # Match word boundary if item is a recognized company token (e.g. "google" in "Google Inc")
            if len(raw_item_lower) >= 3 and raw_item_lower in clean_emp_name:
                return True
            if len(clean_emp_name) >= 3 and clean_emp_name in raw_item_lower:
                return True

    return False


def is_candidate_visible_to_recruiter(
    candidate: Any,
    recruiter_tenant_domain: Optional[str] = None,
    recruiter_tenant_name: Optional[str] = None,
    recruiter_email: Optional[str] = None,
) -> bool:
    """
    Unified gatekeeper for candidate profile visibility.
    Returns False if:
    1. Candidate has set is_searchable = False (Stealth Mode)
    2. Recruiter or their organization matches candidate's hide_from_companies blacklist.
    """
    # 1. Check stealth / consent flag
    is_searchable = getattr(candidate, "is_searchable", True)
    if is_searchable is False:
        return False

    # 2. Check blacklist
    hide_list = getattr(candidate, "hide_from_companies", []) or []
    if isinstance(hide_list, list) and hide_list:
        if is_domain_or_company_blocked(
            hide_from_companies=hide_list,
            employer_domain=recruiter_tenant_domain,
            employer_name=recruiter_tenant_name,
            employer_email=recruiter_email,
        ):
            return False

    return True


def verify_candidate_erasure_authorization(candidate: Candidate, requesting_user: User) -> None:
    """
    Validates that the requesting caller has legitimate authority to erase
    the target candidate's personal data.
    - An authorized candidate may erase their own profile.
      Requires stable user_id match or verified email match.
    - Tenant Admin or Manager may erase candidates within their tenant.
    - Cross-tenant requests are rejected with 404.
    - Recruiters are prohibited from initiating data erasure.
    """
    role = requesting_user.role
    role_str = role.value.lower() if hasattr(role, "value") else str(role).lower()

    # Candidate self-service erasure
    if role_str == "candidate":
        # 1. Primary stable identity: immutable user_id FK
        if candidate.user_id:
            if str(candidate.user_id) == str(requesting_user.id):
                return
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Unauthorized: candidates can only request erasure of their own personal data."
            )

        # 2. Fallback: candidate record unlinked to any user_id
        # Email matching requires a verified caller account to prevent takeover of unlinked records
        is_email_match = bool(
            candidate.email and candidate.email.strip().lower() == requesting_user.email.strip().lower()
        )
        if is_email_match:
            if not getattr(requesting_user, "is_verified", False):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Unauthorized: email verification is required before requesting personal data erasure."
                )
            # Atomically bind user_id to establish stable ownership
            candidate.user_id = requesting_user.id
            return

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Unauthorized: candidates can only request erasure of their own personal data."
        )

    # Recruiter attempting erasure -> forbidden
    if role_str == "recruiter":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Unauthorized: recruiters are not permitted to trigger candidate data erasure."
        )

    # Admin or Manager -> Must match tenant
    if role_str in ("admin", "manager"):
        if not candidate.tenant_id or str(candidate.tenant_id) != str(requesting_user.tenant_id):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Candidate not found"
            )
        return

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Unauthorized: insufficient permissions for candidate data erasure."
    )


# Worker lease timeout for GDPR cleanup retry tasks (5 minutes / 300 seconds)
GDPR_CLEANUP_LEASE_TIMEOUT_SECONDS = 300


async def delete_candidate_from_pinecone(
    tenant_id: str,
    candidate_id: str,
    extra_embedding_ids: Optional[List[str]] = None,
) -> bool:
    """
    Deletes candidate vector embeddings from Pinecone Data Lake if configured.
    Guarantees that deletion is scoped strictly to candidate-specific vector IDs:
    - Default namespace: deletes only candidate IDs and resume embedding IDs using 'ids' filter.
    - Tenant namespace: deletes only candidate IDs and resume embedding IDs within that namespace.
    Wildcard / deleteAll is NEVER executed, preventing accidental deletion of other candidates.

    Pinecone Consistency Verification:
    Pinecone is an eventually consistent vector database. A successful HTTP POST /vectors/delete
    request indicates acceptance, but vectors may remain queryable across replicas during internal
    propagation. This function independently verifies deletion by issuing a fetch request for target_ids.
    Returns True only when zero target vectors are returned. Returns False if vectors remain pending propagation.
    """
    pinecone_key = getattr(settings, "pinecone_api_key", None)
    pinecone_host = getattr(settings, "pinecone_host", None)
    if not pinecone_key or pinecone_key == "mock_pinecone_key" or not pinecone_host:
        return True

    import httpx
    target_ids = [
        f"ats_{tenant_id}_{candidate_id}",
        str(candidate_id),
        f"cand_{candidate_id}",
    ]
    if extra_embedding_ids:
        for eid in extra_embedding_ids:
            if eid and isinstance(eid, str) and eid.strip():
                target_ids.append(eid.strip())

    # De-duplicate while preserving order
    target_ids = list(dict.fromkeys(target_ids))

    try:
        async with httpx.AsyncClient(timeout=10.0) as http:
            # 1. Default namespace (scoped strictly to target_ids)
            res = await http.post(
                f"{pinecone_host}/vectors/delete",
                headers={"Api-Key": pinecone_key},
                json={"ids": target_ids}
            )
            res.raise_for_status()

            # Verify deletion in default namespace (accounting for eventual consistency)
            fetch_res = await http.get(
                f"{pinecone_host}/vectors/fetch",
                headers={"Api-Key": pinecone_key},
                params=[("ids", tid) for tid in target_ids],
            )
            if fetch_res.status_code == 200:
                found_vectors = fetch_res.json().get("vectors", {})
                if found_vectors:
                    log.info(
                        "pinecone_eventual_consistency_pending",
                        candidate_id=candidate_id,
                        remaining_vectors=list(found_vectors.keys()),
                    )
                    return False

            # 2. Tenant namespace if used (scoped strictly to target_ids)
            if tenant_id and tenant_id != "default":
                res_tenant = await http.post(
                    f"{pinecone_host}/vectors/delete",
                    headers={"Api-Key": pinecone_key},
                    json={"ids": target_ids, "namespace": str(tenant_id)}
                )
                res_tenant.raise_for_status()

                fetch_tenant_res = await http.get(
                    f"{pinecone_host}/vectors/fetch",
                    headers={"Api-Key": pinecone_key},
                    params=[("ids", tid) for tid in target_ids] + [("namespace", str(tenant_id))],
                )
                if fetch_tenant_res.status_code == 200:
                    found_tenant_vectors = fetch_tenant_res.json().get("vectors", {})
                    if found_tenant_vectors:
                        log.info(
                            "pinecone_tenant_eventual_consistency_pending",
                            candidate_id=candidate_id,
                            tenant_id=tenant_id,
                            remaining_vectors=list(found_tenant_vectors.keys()),
                        )
                        return False

            return True
    except Exception as e:
        log.warning("pinecone_vector_delete_failed", error=str(e), candidate_id=candidate_id)
        raise e


async def erase_candidate_personal_data(
    candidate_id: uuid.UUID,
    db: AsyncSession,
    requesting_user: User,
) -> Dict[str, Any]:
    """
    Executes a GDPR Article 17 Right-to-Erasure workflow for a candidate:
    1. Authenticates & authorizes the caller with verified identity checks.
    2. Atomically nullifies candidate PII and creates in-transaction crash-recovery cleanup task.
    3. Safely deletes physical resume files within UPLOAD_DIR using path validation.
    4. Deletes candidate embeddings from vector stores (ChromaDB / Pinecone).
    5. Invalidates Redis caches for candidate identity.
    6. Cancels pending background tasks targeting this candidate.
    7. If external deletion fails or store is unavailable, cleanup task remains PENDING
       and is automatically dispatched to background workers for retry.
    8. Idempotent: repeating an erasure request safely retries pending cleanup or confirms completion.
    """
    # 1. Fetch candidate
    result = await db.execute(select(Candidate).where(Candidate.id == candidate_id))
    candidate = result.scalar_one_or_none()
    if not candidate:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidate not found")

    # 2. Authorization check
    verify_candidate_erasure_authorization(candidate, requesting_user)

    # 3. Check for existing pending cleanup task for retry
    cleanup_task_stmt = select(AgentTask).where(
        AgentTask.task_type == "gdpr_cleanup_retry",
        AgentTask.status == AgentTaskStatus.PENDING,
    )
    all_pending_cleanups = (await db.execute(cleanup_task_stmt)).scalars().all()
    target_cleanup_task = None
    for task in all_pending_cleanups:
        inp = task.input_data or {}
        if str(inp.get("candidate_id")) == str(candidate.id):
            target_cleanup_task = task
            break

    # 4. Check if already erased with no outstanding cleanup
    if candidate.pii_erased and not target_cleanup_task:
        return {
            "status": "already_erased",
            "id": str(candidate.id),
            "database_erased": True,
            "files_deleted": True,
            "vector_store_erased": True,
            "pending_cleanup": False,
            "erased_at": candidate.pii_erased_at.isoformat() if candidate.pii_erased_at else None,
            "message": "Candidate personal data was already permanently erased.",
        }

    # 5. Collect resume file paths and embedding IDs before DB removal
    resumes_stmt = select(Resume).where(Resume.candidate_id == candidate.id)
    resumes = (await db.execute(resumes_stmt)).scalars().all()
    file_urls_to_delete = [r.file_url for r in resumes if r.file_url]
    embedding_ids_to_delete = [r.embedding_id for r in resumes if r.embedding_id]
    if candidate.embedding_id:
        embedding_ids_to_delete.append(candidate.embedding_id)

    # If retrying from an existing cleanup task, augment targets
    if target_cleanup_task:
        inp = target_cleanup_task.input_data or {}
        extra_urls = inp.get("file_urls") or []
        for u in extra_urls:
            if u not in file_urls_to_delete:
                file_urls_to_delete.append(u)
        extra_embeds = inp.get("embedding_ids") or []
        for e in extra_embeds:
            if e not in embedding_ids_to_delete:
                embedding_ids_to_delete.append(e)

    # 6. Database Transaction (Atomic Nullification)
    now = datetime.now(timezone.utc)
    candidate.first_name = "Erased"
    candidate.last_name = "Candidate"
    candidate.email = f"erased_{candidate.id}@erased.local"
    candidate.phone = None
    candidate.title = None
    candidate.location = None
    candidate.linkedin_url = None
    candidate.github_url = None
    candidate.portfolio_url = None
    candidate.skills = []
    candidate.experience_years = 0
    candidate.current_company = None
    candidate.current_salary = None
    candidate.expected_salary = None
    candidate.availability = None
    candidate.source = None
    candidate.score = 0.0
    candidate.embedding_id = None
    candidate.ai_summary = "[Personal data permanently erased per GDPR Article 17 request]"
    candidate.do_not_contact = True
    candidate.is_searchable = False
    candidate.hide_from_companies = []
    candidate.scoring_reasoning = {}
    candidate.integrity_reasoning = {}
    candidate.meta_data = {}
    candidate.pii_erased = True
    candidate.pii_erased_at = candidate.pii_erased_at or now

    # Remove resume records
    for r in resumes:
        await db.delete(r)

    # Sanitize job application records
    apps_stmt = select(JobCandidate).where(JobCandidate.candidate_id == candidate.id)
    applications = (await db.execute(apps_stmt)).scalars().all()
    for app in applications:
        app.notes = None
        app.ai_reasoning = None
        app.career_ops_scoring = {}
        app.match_score = 0.0
        app.status = CandidateStatus.REJECTED

    # Cancel pending background tasks
    if candidate.tenant_id:
        task_stmt = select(AgentTask).where(
            AgentTask.tenant_id == candidate.tenant_id,
            AgentTask.status.in_([AgentTaskStatus.PENDING, AgentTaskStatus.RUNNING]),
        )
        running_tasks = (await db.execute(task_stmt)).scalars().all()
        for t in running_tasks:
            inp = t.input_data or {}
            if str(inp.get("candidate_id")) == str(candidate.id) or str(inp.get("cid")) == str(candidate.id):
                t.status = AgentTaskStatus.FAILED
                t.error_message = "Cancelled: candidate personal data erased per GDPR request."

    # In-transaction crash recovery: persist cleanup task before commit!
    if not target_cleanup_task:
        target_cleanup_task = AgentTask(
            id=uuid.uuid4(),
            tenant_id=candidate.tenant_id,
            agent_name="privacy_compliance",
            task_type="gdpr_cleanup_retry",
            status=AgentTaskStatus.PENDING,
            input_data={
                "candidate_id": str(candidate.id),
                "tenant_id": str(candidate.tenant_id),
                "embedding_ids": embedding_ids_to_delete,
                "file_urls": file_urls_to_delete,
                "retry_vector": True,
                "retry_files": True,
                "retry_tombstone": True,
            },
            error_message="Erasure in progress; awaiting external cleanup completion",
            user_id=requesting_user.id,
        )
        db.add(target_cleanup_task)

    await db.commit()
    await db.refresh(candidate)

    # Immediately record persistent external tombstone so that even if subsequent external
    # cleanups fail/crash, the candidate's erasure is already tracked for post-restore protection.
    tombstone_ok = record_erasure_tombstone(
        str(candidate.id),
        str(candidate.tenant_id) if candidate.tenant_id else None,
        candidate.pii_erased_at.isoformat() if candidate.pii_erased_at else None,
    )
    if target_cleanup_task:
        cur_input = dict(target_cleanup_task.input_data or {})
        cur_input["retry_tombstone"] = not tombstone_ok
        target_cleanup_task.input_data = cur_input
        await db.commit()

    # 7. File System Deletion
    deleted_files_count = 0
    file_errors = []
    for raw_url in file_urls_to_delete:
        try:
            safe_path = ResumeParserService.get_resume_file_path(raw_url)
            if safe_path and safe_path.exists() and safe_path.is_file():
                safe_path.unlink(missing_ok=True)
                # Verify physical deletion from disk
                if safe_path.exists():
                    file_errors.append(f"unlink_unverified: {safe_path.name}")
                else:
                    deleted_files_count += 1
        except Exception as fe:
            file_errors.append(f"unlink_failure: {type(fe).__name__}")

    try:
        upload_dir = ResumeParserService.ensure_upload_dir()
        prefix = f"{candidate.id}_"
        for match in upload_dir.glob(f"{prefix}*"):
            if match.is_file():
                try:
                    match.unlink(missing_ok=True)
                    if match.exists():
                        file_errors.append(f"unlink_unverified: {match.name}")
                    else:
                        deleted_files_count += 1
                except Exception as fe:
                    file_errors.append(f"unlink_failure: {type(fe).__name__}")
    except Exception as fe:
        file_errors.append(f"directory_scan_failure: {type(fe).__name__}")

    # 8. Vector Store Erasure
    vector_erased = True
    vector_error = None
    tenant_str = str(candidate.tenant_id) if candidate.tenant_id else "default"

    try:
        from db.vector_store import vector_store
        vector_store.delete_resumes(
            tenant_id=tenant_str,
            resume_ids=embedding_ids_to_delete,
            candidate_id=str(candidate.id),
        )
    except Exception as ve:
        vector_erased = False
        vector_error = f"chroma: {type(ve).__name__}"
        log.warning("vector_store_deletion_failed", error_type=type(ve).__name__, candidate_id=str(candidate.id))

    try:
        pinecone_ok = await delete_candidate_from_pinecone(
            tenant_str,
            str(candidate.id),
            extra_embedding_ids=embedding_ids_to_delete,
        )
        if not pinecone_ok:
            vector_erased = False
            vector_error = f"{vector_error or ''}; pinecone: eventual_consistency_pending"
            log.info("pinecone_deletion_pending_eventual_consistency", candidate_id=str(candidate.id))
    except Exception as pe:
        vector_erased = False
        vector_error = f"{vector_error or ''}; pinecone: {type(pe).__name__}"
        log.warning("pinecone_deletion_failed", error_type=type(pe).__name__, candidate_id=str(candidate.id))

    # 8.1 Invalidate Redis Caches
    try:
        import redis
        r = redis.from_url(settings.redis_url)
        cache_keys = [
            f"candidate:{candidate.id}",
            f"candidate_profile:{candidate.id}",
            f"tenant:{candidate.tenant_id}:candidate:{candidate.id}",
        ]
        r.delete(*cache_keys)
    except Exception as re:
        log.warning("redis_cache_invalidation_failed", error_type=type(re).__name__, candidate_id=str(candidate.id))

    # 9. Handle Incomplete / Retryable Cleanup
    if not vector_erased or file_errors or not tombstone_ok:
        target_cleanup_task.retries = (target_cleanup_task.retries or 0) + 1
        target_cleanup_task.error_message = (
            f"Retry required: vector_err={vector_error}; file_errs={len(file_errors)}; tombstone_ok={tombstone_ok}"
        )
        target_cleanup_task.input_data = {
            "candidate_id": str(candidate.id),
            "tenant_id": str(candidate.tenant_id),
            "embedding_ids": embedding_ids_to_delete,
            "file_urls": file_urls_to_delete,
            "retry_vector": not vector_erased,
            "retry_files": bool(file_errors),
            "retry_tombstone": not tombstone_ok,
        }
        await db.commit()

        # Dispatch background retry worker automatically
        try:
            from workers.tasks import safe_dispatch_task, process_pending_gdpr_cleanups_task
            safe_dispatch_task(process_pending_gdpr_cleanups_task)
        except Exception as de:
            log.warning("celery_dispatch_failed", error_type=type(de).__name__, task_id=str(target_cleanup_task.id))

        log.warning(
            "gdpr_erasure_partial_retry_scheduled",
            candidate_id=str(candidate.id),
            cleanup_task_id=str(target_cleanup_task.id),
        )
        return {
            "status": "pending_cleanup",
            "id": str(candidate.id),
            "database_erased": True,
            "files_deleted": len(file_errors) == 0,
            "vector_store_erased": vector_erased,
            "tombstone_recorded": tombstone_ok,
            "cleanup_task_id": str(target_cleanup_task.id),
            "pending_cleanup": True,
            "erased_at": candidate.pii_erased_at.isoformat(),
            "message": "Candidate personal data sanitized in primary database. External storage cleanup or durable tombstone persistence is actively pending in the background. Erasure is not yet complete.",
        }

    # 10. Success: Finalize cleanup task
    target_cleanup_task.status = AgentTaskStatus.COMPLETED
    target_cleanup_task.completed_at = now
    await db.commit()

    log.info(
        "gdpr_erasure_completed",
        candidate_id=str(candidate.id),
        erased_by=str(requesting_user.id),
        files_removed=deleted_files_count,
    )

    # Record persistent external tombstone to protect against future backup-restore data resurrection
    record_erasure_tombstone(
        str(candidate.id),
        str(candidate.tenant_id) if candidate.tenant_id else None,
        candidate.pii_erased_at.isoformat() if candidate.pii_erased_at else None,
    )

    return {
        "status": "erased",
        "id": str(candidate.id),
        "database_erased": True,
        "files_deleted": True,
        "vector_store_erased": True,
        "pending_cleanup": False,
        "erased_at": candidate.pii_erased_at.isoformat(),
        "message": "Candidate personal data has been permanently removed from primary database, file storage, Redis cache, and vector search indexes. Residual audit logs are retained under statutory compliance obligations, and backup snapshots will age out according to the retention schedule.",
    }


ERASURE_TOMBSTONE_LEDGER_PATH = Path(getattr(settings, "storage_dir", "./storage")) / "erasure_tombstones.jsonl"
ERASURE_TOMBSTONE_LOCK_PATH = Path(str(ERASURE_TOMBSTONE_LEDGER_PATH) + ".lock")


def record_erasure_tombstone(candidate_id: str, tenant_id: Optional[str] = None, erased_at: Optional[str] = None) -> bool:
    """
    Appends an immutable record of candidate erasure to an external tombstone ledger
    using kernel-level advisory file locking and os.fsync for cross-process crash durability.
    Guarantees that database restores from snapshots prior to this erasure cannot
    reintroduce or resurrect the candidate's personal data.
    """
    try:
        ERASURE_TOMBSTONE_LEDGER_PATH.parent.mkdir(parents=True, exist_ok=True)
        entry = {
            "candidate_id": str(candidate_id),
            "tenant_id": str(tenant_id) if tenant_id else None,
            "erased_at": erased_at or datetime.now(timezone.utc).isoformat(),
        }
        lock = FileLock(str(ERASURE_TOMBSTONE_LOCK_PATH), timeout=10)
        with lock:
            with open(ERASURE_TOMBSTONE_LEDGER_PATH, "a", encoding="utf-8") as f:
                f.write(json.dumps(entry) + "\n")
                f.flush()
                os.fsync(f.fileno())
        return True
    except Exception as e:
        log.error("failed_to_write_erasure_tombstone", error=str(e), candidate_id=candidate_id)
        return False


async def reconcile_post_restore_erasures(db: AsyncSession) -> Dict[str, Any]:
    """
    Scans the external immutable erasure tombstone ledger and enforces that any candidate
    restored from an older database backup is immediately re-sanitized across all systems
    (PostgreSQL database, filesystem resumes, Redis cache keys, and vector store embeddings).
    Concurrency-safe and idempotent.
    """
    if not ERASURE_TOMBSTONE_LEDGER_PATH.exists():
        return {"reconciled": 0, "resurrected_found": 0, "files_deleted": 0, "caches_purged": 0}

    lock = FileLock(str(ERASURE_TOMBSTONE_LOCK_PATH), timeout=10)
    erased_ids = set()
    with lock:
        with open(ERASURE_TOMBSTONE_LEDGER_PATH, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    data = json.loads(line)
                    cid = data.get("candidate_id")
                    if cid:
                        erased_ids.add(cid)
                except Exception:
                    continue

    if not erased_ids:
        return {"reconciled": 0, "resurrected_found": 0, "files_deleted": 0, "caches_purged": 0}

    resurrected_count = 0
    files_deleted = 0
    caches_purged = 0
    now = datetime.now(timezone.utc)
    for raw_id in erased_ids:
        try:
            cand_uuid = uuid.UUID(raw_id)
        except ValueError:
            continue

        result = await db.execute(select(Candidate).where(Candidate.id == cand_uuid))
        candidate = result.scalar_one_or_none()
        if candidate and not candidate.pii_erased:
            resurrected_count += 1
            log.warning("resurrected_candidate_detected_from_backup_restore", candidate_id=str(candidate.id))
            candidate.first_name = "Erased"
            candidate.last_name = "Candidate"
            candidate.email = f"erased_{candidate.id}@erased.local"
            candidate.phone = None
            candidate.title = None
            candidate.location = None
            candidate.linkedin_url = None
            candidate.github_url = None
            candidate.portfolio_url = None
            candidate.skills = []
            candidate.experience_years = 0
            candidate.current_company = None
            candidate.current_salary = None
            candidate.expected_salary = None
            candidate.availability = None
            candidate.source = None
            candidate.score = 0.0
            candidate.embedding_id = None
            candidate.ai_summary = "[Personal data permanently erased per GDPR Article 17 request]"
            candidate.do_not_contact = True
            candidate.is_searchable = False
            candidate.hide_from_companies = []
            candidate.scoring_reasoning = {}
            candidate.integrity_reasoning = {}
            candidate.meta_data = {}
            candidate.pii_erased = True
            candidate.pii_erased_at = candidate.pii_erased_at or now

            # Delete any restored resumes
            resumes_stmt = select(Resume).where(Resume.candidate_id == candidate.id)
            resumes = (await db.execute(resumes_stmt)).scalars().all()
            for r in resumes:
                await db.delete(r)

            # Delete vectors
            try:
                from db.vector_store import vector_store
                tenant_str = str(candidate.tenant_id) if candidate.tenant_id else "default"
                vector_store.delete_resumes(
                    tenant_id=tenant_str,
                    resume_ids=[],
                    candidate_id=str(candidate.id),
                )
            except Exception as ve:
                log.warning("restore_reconcile_vector_delete_failed", error=str(ve), candidate_id=str(candidate.id))

        # Check and purge any lingering/restored resume files on disk for any tombstoned candidate
        try:
            upload_dir = ResumeParserService.ensure_upload_dir()
            prefix = f"{cand_uuid}_"
            for match in upload_dir.glob(f"{prefix}*"):
                if match.is_file():
                    match.unlink(missing_ok=True)
                    files_deleted += 1
        except Exception as fe:
            log.warning("restore_reconcile_file_delete_failed", error=str(fe), candidate_id=str(cand_uuid))

        # Invalidate Redis caches for tombstoned candidate
        try:
            import redis
            r = redis.from_url(settings.redis_url)
            cache_keys = [
                f"candidate:{cand_uuid}",
                f"candidate_profile:{cand_uuid}",
            ]
            if candidate and candidate.tenant_id:
                cache_keys.append(f"tenant:{candidate.tenant_id}:candidate:{cand_uuid}")
            r.delete(*cache_keys)
            caches_purged += len(cache_keys)
        except Exception as re:
            log.warning("restore_reconcile_redis_cache_failed", error=str(re), candidate_id=str(cand_uuid))

    await db.commit()
    return {
        "reconciled": len(erased_ids),
        "resurrected_found": resurrected_count,
        "files_deleted": files_deleted,
        "caches_purged": caches_purged,
    }


async def sweep_and_process_gdpr_cleanups(db: AsyncSession) -> Dict[str, Any]:
    """
    Automated background worker function that sweeps all outstanding GDPR cleanup tasks
    and retries external deletions (files, vector stores) until completion.
    Concurrency-safe:
    - Atomically claims each task into RUNNING status before external operations.
    - Prevents dual execution if multiple workers sweep concurrently.
    - Reclaims stale RUNNING tasks whose lease has expired (>GDPR_CLEANUP_LEASE_TIMEOUT_SECONDS = 300s).
    - Completion strictly requires both vector stores and all file deletions to succeed.
    """
    now = datetime.now(timezone.utc)
    stale_cutoff = now - timedelta(seconds=GDPR_CLEANUP_LEASE_TIMEOUT_SECONDS)
    stmt = select(AgentTask).where(
        AgentTask.task_type == "gdpr_cleanup_retry",
        or_(
            AgentTask.status == AgentTaskStatus.PENDING,
            and_(
                AgentTask.status == AgentTaskStatus.RUNNING,
                or_(
                    AgentTask.started_at.is_(None),
                    AgentTask.started_at < stale_cutoff,
                ),
            ),
        ),
    )
    candidate_tasks = (await db.execute(stmt)).scalars().all()
    if not candidate_tasks:
        return {"processed": 0, "succeeded": 0, "failed": 0}

    succeeded = 0
    failed = 0

    for task in candidate_tasks:
        task_now = datetime.now(timezone.utc)
        lease_token = f"claim_{uuid.uuid4().hex}"

        # Atomic claim: Only transition if status is PENDING or stale RUNNING (>15 min)
        # Sets a unique lease token in celery_task_id and monotonically increments retries
        claim_stmt = (
            update(AgentTask)
            .where(
                AgentTask.id == task.id,
                or_(
                    AgentTask.status == AgentTaskStatus.PENDING,
                    and_(
                        AgentTask.status == AgentTaskStatus.RUNNING,
                        or_(
                            AgentTask.started_at.is_(None),
                            AgentTask.started_at < stale_cutoff,
                        ),
                    ),
                ),
            )
            .values(
                status=AgentTaskStatus.RUNNING,
                started_at=task_now,
                celery_task_id=lease_token,
                retries=AgentTask.retries + 1,
            )
            .execution_options(synchronize_session=False)
        )
        claim_res = await db.execute(claim_stmt)
        await db.commit()

        # If another worker concurrently claimed this task, skip it safely
        if claim_res.rowcount == 0:
            continue

        inp = task.input_data or {}
        candidate_id = inp.get("candidate_id")
        tenant_id = inp.get("tenant_id") or "default"
        file_urls = inp.get("file_urls") or []
        embedding_ids = inp.get("embedding_ids") or []

        try:
            file_errors = []
            for raw_url in file_urls:
                try:
                    safe_path = ResumeParserService.get_resume_file_path(raw_url)
                    if safe_path and safe_path.exists() and safe_path.is_file():
                        safe_path.unlink(missing_ok=True)
                        if safe_path.exists():
                            file_errors.append(f"unlink_unverified: {safe_path.name}")
                except Exception as fe:
                    file_errors.append(f"unlink_failure: {type(fe).__name__}")

            vector_erased = True
            vector_error = None
            try:
                from db.vector_store import vector_store
                vector_store.delete_resumes(
                    tenant_id=str(tenant_id),
                    resume_ids=embedding_ids,
                    candidate_id=str(candidate_id),
                )
            except Exception as ve:
                vector_erased = False
                vector_error = f"chroma: {type(ve).__name__}"

            try:
                pinecone_ok = await delete_candidate_from_pinecone(
                    str(tenant_id),
                    str(candidate_id),
                    extra_embedding_ids=embedding_ids,
                )
                if not pinecone_ok:
                    vector_erased = False
                    vector_error = f"{vector_error or ''}; pinecone: eventual_consistency_pending"
                    log.info("sweep_pinecone_eventual_consistency_pending", candidate_id=str(candidate_id))
            except Exception as pe:
                vector_erased = False
                vector_error = f"{vector_error or ''}; pinecone: {type(pe).__name__}"

            tombstone_err = False
            if inp.get("retry_tombstone") is not False:
                tb_ok = record_erasure_tombstone(str(candidate_id), str(tenant_id))
                if tb_ok:
                    inp["retry_tombstone"] = False
                else:
                    tombstone_err = True

            # Strict validation: completion REQUIRES that vector store, all files, and tombstone succeeded
            finish_now = datetime.now(timezone.utc)
            if vector_erased and not file_errors and not tombstone_err:
                # Ownership check: verify this worker's unique lease token is still active
                complete_stmt = (
                    update(AgentTask)
                    .where(
                        AgentTask.id == task.id,
                        AgentTask.status == AgentTaskStatus.RUNNING,
                        AgentTask.celery_task_id == lease_token,
                    )
                    .values(
                        status=AgentTaskStatus.COMPLETED,
                        completed_at=finish_now,
                        error_message=None,
                        input_data=inp,
                    )
                    .execution_options(synchronize_session=False)
                )
                complete_res = await db.execute(complete_stmt)
                await db.commit()
                if complete_res.rowcount > 0:
                    succeeded += 1
                else:
                    log.warning("gdpr_cleanup_expired_worker_suppressed", task_id=str(task.id), lease=lease_token)
            else:
                # Revert back to PENDING so next sweep or retry can process it, under strict lease ownership
                fail_stmt = (
                    update(AgentTask)
                    .where(
                        AgentTask.id == task.id,
                        AgentTask.status == AgentTaskStatus.RUNNING,
                        AgentTask.celery_task_id == lease_token,
                    )
                    .values(
                        status=AgentTaskStatus.PENDING,
                        error_message=f"Sweep retry failed: vector={vector_error}; files={len(file_errors)}; tombstone_err={tombstone_err}",
                        input_data=inp,
                    )
                    .execution_options(synchronize_session=False)
                )
                fail_res = await db.execute(fail_stmt)
                await db.commit()
                if fail_res.rowcount > 0:
                    failed += 1
        except Exception as task_exc:
            log.error("gdpr_cleanup_task_unhandled_failure", task_id=str(task.id), error=str(task_exc))
            try:
                await db.rollback()
                # Revert to PENDING so task is not stranded in RUNNING
                revert_stmt = (
                    update(AgentTask)
                    .where(
                        AgentTask.id == task.id,
                        AgentTask.status == AgentTaskStatus.RUNNING,
                        AgentTask.celery_task_id == lease_token,
                    )
                    .values(
                        status=AgentTaskStatus.PENDING,
                        error_message=f"Unhandled worker error: {str(task_exc)[:500]}",
                    )
                    .execution_options(synchronize_session=False)
                )
                await db.execute(revert_stmt)
                await db.commit()
            except Exception:
                pass
            failed += 1

    return {"processed": len(candidate_tasks), "succeeded": succeeded, "failed": failed}


if __name__ == "__main__":
    import sys
    from scripts.reconcile_post_restore import main_cli
    sys.exit(main_cli())
