"""
DVT Talent AI — Sourcing Agent (Pydantic AI Version)
Implements high-fidelity candidate discovery and integrity verification.
Optimized with Freehire-inspired deterministic facet extraction, fingerprint deduplication,
evidence-gated scoring, internal hybrid vector search, GitHub API, StackOverflow Tag API, and Serper Web signals.
"""
import sys

if __name__.startswith("backend.agents."):
    sys.modules[__name__.replace("backend.agents.", "agents.")] = sys.modules[__name__]
elif __name__.startswith("agents."):
    sys.modules["backend." + __name__] = sys.modules[__name__]

import asyncio
import hashlib
import json
import re
from typing import Any, Dict, List, Optional

import structlog
from pydantic import BaseModel, ConfigDict, Field
from pydantic_ai import Agent, RunContext

log = structlog.get_logger(__name__)
try:
    from backend.agents.pydantic_config import AgentDeps, get_pydantic_model
except ImportError:
    from agents.pydantic_config import AgentDeps, get_pydantic_model  # pyrefly: ignore[missing-import]  # type: ignore
try:
    from backend.agents.swarm_memory import _get_cache, _set_cache
except ImportError:
    from agents.swarm_memory import _get_cache, _set_cache  # pyrefly: ignore[missing-import]  # type: ignore
try:
    from backend.services.resume_parser import ResumeParserService
except ImportError:
    from services.resume_parser import ResumeParserService  # pyrefly: ignore[missing-import]  # type: ignore

_LOCAL_SOURCING_CACHE: Dict[str, str] = {}


def _get_sourcing_cache(raw_key: str, tenant_id: str) -> Optional[str]:
    safe_tenant = str(tenant_id or "").strip()
    if not safe_tenant or safe_tenant.lower() == "default":
        return None
    q_hash = hashlib.md5(raw_key.encode(), usedforsecurity=False).hexdigest()
    local_k = f"{safe_tenant}:{q_hash}"
    if local_k in _LOCAL_SOURCING_CACHE:
        return _LOCAL_SOURCING_CACHE[local_k]
    cached = _get_cache(q_hash, tenant_id=safe_tenant)
    if cached:
        if len(_LOCAL_SOURCING_CACHE) >= 256:
            _LOCAL_SOURCING_CACHE.pop(next(iter(_LOCAL_SOURCING_CACHE)), None)
        _LOCAL_SOURCING_CACHE[local_k] = cached
    return cached


def _set_sourcing_cache(raw_key: str, value: str, tenant_id: str, ttl_seconds: int = 3600) -> None:
    safe_tenant = str(tenant_id or "").strip()
    if not safe_tenant or safe_tenant.lower() == "default":
        return
    q_hash = hashlib.md5(raw_key.encode(), usedforsecurity=False).hexdigest()
    local_k = f"{safe_tenant}:{q_hash}"
    if len(_LOCAL_SOURCING_CACHE) >= 256:
        _LOCAL_SOURCING_CACHE.pop(next(iter(_LOCAL_SOURCING_CACHE)), None)
    _LOCAL_SOURCING_CACHE[local_k] = value
    _set_cache(raw_key, value, tenant_id=safe_tenant, ttl_seconds=ttl_seconds)


# ── Models ──────────────────────────────────────────────────────────────────

class Reasoning(BaseModel):
    model_config = ConfigDict(extra="allow")
    strengths: List[str] = Field(default_factory=list, description="Top 3 technical or cultural strengths")
    weaknesses: List[str] = Field(default_factory=list, description="Potential areas for growth or red flags")
    alignment: str = Field(default="Strong fit for technical stack and experience level", description="One-sentence executive summary of JD match")

class IntegrityScore(BaseModel):
    model_config = ConfigDict(extra="allow")
    score: int = Field(default=95, ge=0, le=100, description="Probability that the profile is genuine (100 = high trust)")
    risk_factors: List[str] = Field(default_factory=list, description="Signals of AI generation, bot-activity, or data mismatch")
    verdict: str = Field(default="Trust", description="Clear 'Trust' or 'Verify' recommendation")

class CandidateNode(BaseModel):
    model_config = ConfigDict(extra="allow")
    full_name: str = Field(default="Sourced Candidate")
    email: str = Field(default="candidate@example.com")
    title: str = Field(default="Senior Software Engineer")
    location: str = Field(default="Remote")
    current_company: Optional[str] = None
    match_score: int = Field(default=90, ge=0, le=100)
    skills: List[str] = Field(default_factory=list)
    experience_years: int = Field(default=5)
    linkedin_url: Optional[str] = None
    github_url: Optional[str] = None
    ai_reasoning: Reasoning = Field(default_factory=Reasoning)
    integrity_score: IntegrityScore = Field(default_factory=IntegrityScore)
    source_platform: str = Field(default="GitHub")

class SourcingSynthesis(BaseModel):
    model_config = ConfigDict(extra="allow")
    candidates: List[CandidateNode] = Field(default_factory=list)
    market_context: str = Field(default="High-demand market for senior software engineering talent", description="AI's assessment of the current talent market for this role")

# ── Agent Definition ──────────────────────────────────────────────────────

sourcing_agent = Agent(
    get_pydantic_model(),
    retries=3,
    deps_type=AgentDeps,
    output_type=SourcingSynthesis,
    system_prompt=(
        "You are an Elite Sourcing & Integrity Agent for DVT Talent AI. "
        "Your mission is to synthesize the best talent nodes for a specific job description. "
        "1. PROPRIETARY FIRST: Search the internal candidate database for qualified profiles and silver medalists. "
        "2. DISCOVER: Use tools to find candidates on GitHub, StackOverflow, and Web signals (via Serper) unless pre-fetched signals are already provided in the prompt. "
        "3. ANALYZE: Evaluate technical depth, relevant stack, and JD alignment. "
        "4. AUDIT: Perform integrity scoring to detect fraudulent or low-quality profiles. "
        "5. Do NOT attempt to call unprovided tools. "
        "6. Do NOT output preamble, internal thoughts, or chain of reasoning text."
    ),
)

# ── Freehire-Style Fingerprint Deduplication & Evidence Scorer ────────────

def _canonical_candidate_fingerprint(cand: Dict[str, Any]) -> str:
    """Compute a deterministic identity key across email, GitHub handle, LinkedIn slug, or normalized name."""
    email = str(cand.get("email") or "").strip().lower()
    if email and "@" in email and email not in {"candidate@example.com", "verified@talent-vault.io"}:
        return f"email:{email}"

    gh_url = str(cand.get("github_url") or "").strip().lower().rstrip("/")
    if "github.com/" in gh_url:
        handle = gh_url.split("github.com/")[-1].split("/")[0].strip()
        if handle:
            return f"gh:{handle}"

    li_url = str(cand.get("linkedin_url") or "").strip().lower().rstrip("/")
    if "linkedin.com/in/" in li_url:
        slug = li_url.split("linkedin.com/in/")[-1].split("/")[0].strip()
        if slug:
            return f"li:{slug}"

    raw_name = str(cand.get("name") or cand.get("full_name") or f"{cand.get('first_name', '')} {cand.get('last_name', '')}").strip().lower()
    norm_name = re.sub(r"[^a-z0-9]", "", raw_name)
    return f"name:{norm_name or 'unknown'}"


def deduplicate_and_score_candidates(
    candidates: List[Dict[str, Any]],
    query_facets: Optional[Dict[str, Any]] = None,
) -> List[Dict[str, Any]]:
    """
    Freehire-inspired deterministic entity resolution & evidence-gated scoring:
    1. Collapses duplicate candidate records across sources using canonical fingerprints.
    2. Normalizes and merges skills via ResumeParserService._SKILL_SYNONYMS.
    3. Computes an evidence-backed match score (45% Base/Vector + 40% Skill Overlap + 15% Seniority Fit).
    """
    if not candidates:
        return []

    facets = query_facets or {}
    target_skills = set(facets.get("skills") or [])
    min_years = int(facets.get("min_years") or 3)
    synonyms = ResumeParserService._SKILL_SYNONYMS

    merged_map: Dict[str, Dict[str, Any]] = {}
    name_to_fp: Dict[str, str] = {}

    for raw_c in candidates:
        c = dict(raw_c)
        raw_name = str(c.get("name") or c.get("full_name") or f"{c.get('first_name', '')} {c.get('last_name', '')}").strip()
        norm_name = re.sub(r"[^a-z0-9]", "", raw_name.lower())
        fp = _canonical_candidate_fingerprint(c)
        if norm_name and norm_name in name_to_fp:
            fp = name_to_fp[norm_name]

        # Normalize candidate skills
        raw_skills = c.get("skills") or []
        if isinstance(raw_skills, str):
            raw_skills = [s.strip() for s in raw_skills.split(",") if s.strip()]
        norm_skills = set()
        for s in raw_skills:
            s_clean = str(s).strip()
            if s_clean:
                norm_skills.add(synonyms.get(s_clean.lower(), s_clean))

        if fp not in merged_map:
            c["skills"] = sorted(list(norm_skills))
            merged_map[fp] = c
            if norm_name:
                name_to_fp[norm_name] = fp
        else:
            existing = merged_map[fp]
            existing_skills = set(existing.get("skills") or [])
            existing["skills"] = sorted(list(existing_skills | norm_skills))

            # Merge source provenance
            src_a = str(existing.get("source") or "Internal Pool")
            src_b = str(c.get("source") or "")
            if src_b and src_b not in src_a:
                existing["source"] = f"{src_a} + {src_b}"

            # Enrich missing contact/profile links
            for field in ("email", "phone", "github_url", "linkedin_url", "company", "title"):
                val_existing = existing.get(field)
                val_new = c.get(field)
                if (not val_existing or val_existing in {"candidate@example.com", "verified@talent-vault.io"}) and val_new:
                    existing[field] = val_new

            existing["experience_years"] = max(
                int(existing.get("experience_years") or 0),
                int(c.get("experience_years") or 0),
            )
            existing["score"] = max(float(existing.get("score") or 0), float(c.get("score") or 0))
            if norm_name:
                name_to_fp[norm_name] = fp

    scored_list: List[Dict[str, Any]] = []
    for item in merged_map.values():
        base_score = float(item.get("score") or 85.0)
        if base_score <= 1.0:
            base_score *= 100.0

        cand_skills = {s.lower() for s in (item.get("skills") or [])}
        if target_skills:
            matched_skills = sum(1 for ts in target_skills if ts.lower() in cand_skills)
            skill_ratio = matched_skills / len(target_skills)
            exp_years = int(item.get("experience_years") or 5)
            seniority_ratio = 1.0 if exp_years >= min_years else max(0.5, exp_years / max(1, min_years))
            evidence_score = (0.45 * base_score) + (0.40 * (skill_ratio * 100.0)) + (0.15 * (seniority_ratio * 100.0))
            # Multi-source verification bonus (+3 pts when verified across >1 channel)
            if "+" in str(item.get("source") or ""):
                evidence_score += 3.0
            item["score"] = round(min(99.0, max(base_score * 0.85, evidence_score)), 1)
        else:
            item["score"] = round(min(99.0, base_score), 1)

        scored_list.append(item)

    scored_list.sort(key=lambda x: float(x.get("score") or 0), reverse=True)
    return scored_list


# ── Tools & Concurrent Sourcing Helpers ───────────────────────────────────

async def fast_hybrid_candidate_search(tenant_id: str, keywords: str, limit: int = 5) -> List[Dict[str, Any]]:
    """
    Fast deterministic-facet + hybrid vector search across internal candidates and indexed resumes.
    Strictly scoped to tenant_id.
    """
    try:
        from backend.db.models import AsyncSessionLocal, Candidate, Tenant
        from backend.db.vector_store import vector_store
    except ImportError:
        from db.models import AsyncSessionLocal, Candidate, Tenant  # pyrefly: ignore[missing-import]  # type: ignore
        from db.vector_store import vector_store  # pyrefly: ignore[missing-import]  # type: ignore
    import uuid

    from sqlalchemy import or_, select

    tenant_uuid = None
    if tenant_id and str(tenant_id) != "default":
        try:
            tenant_uuid = uuid.UUID(str(tenant_id))
        except (ValueError, TypeError):
            pass

    if not tenant_uuid:
        return []

    facets = ResumeParserService.extract_deterministic_facets(keywords or "")
    raw_candidates: List[Dict[str, Any]] = []

    # 1. Fast hybrid vector + BM25 search on VectorStore (filtered after DB privacy/hide_from_companies check)
    hybrid_hits: List[Dict[str, Any]] = []
    try:
        hybrid_hits = vector_store.hybrid_search_resumes(
            tenant_id=str(tenant_uuid),
            query_text=keywords or "Software Engineer",
            limit=limit,
        )
    except Exception as exc:
        log.warning("fast_hybrid_vector_search_failed", error=str(exc), tenant_id=str(tenant_id))

    # 2. Multi-keyword + canonical skill SQL search scoped to tenant
    try:
        async with AsyncSessionLocal() as session:
            tenant_obj = await session.get(Tenant, tenant_uuid)
            blocked_identifiers = set()
            if tenant_obj:
                if tenant_obj.domain:
                    blocked_identifiers.add(tenant_obj.domain.strip().lower())
                if tenant_obj.name:
                    blocked_identifiers.add(tenant_obj.name.strip().lower())

            if hybrid_hits:
                hit_uuids = []
                for h in hybrid_hits:
                    raw_id = h.get("candidate_id") or h.get("id")
                    try:
                        if raw_id:
                            hit_uuids.append(uuid.UUID(str(raw_id)))
                    except (ValueError, TypeError):
                        pass
                hidden_or_erased_ids = set()
                if hit_uuids:
                    hit_rows = (
                        await session.execute(
                            select(Candidate).where(
                                Candidate.tenant_id == tenant_uuid,
                                Candidate.id.in_(hit_uuids),
                            )
                        )
                    ).scalars().all()
                    for hc in hit_rows:
                        hc_hidden = [str(x).strip().lower() for x in (hc.hide_from_companies or []) if x]
                        if (
                            hc.pii_erased
                            or hc.is_searchable is False
                            or (blocked_identifiers and any(b in hc_hidden for b in blocked_identifiers))
                        ):
                            hidden_or_erased_ids.add(str(hc.id))
                for hit in hybrid_hits:
                    cid_str = str(hit.get("candidate_id") or hit.get("id") or "")
                    if cid_str in hidden_or_erased_ids:
                        continue
                    meta = hit.get("metadata") or {}
                    name = meta.get("name") or meta.get("full_name") or f"Candidate {str(hit.get('id', ''))[:6]}"
                    raw_score = float(hit.get("score", 0.88))
                    pct_score = round(raw_score * 100, 1) if raw_score <= 1.0 else round(raw_score, 1)
                    raw_candidates.append({
                        "id": cid_str,
                        "name": name,
                        "first_name": name.split(" ")[0] if " " in name else name,
                        "last_name": " ".join(name.split(" ")[1:]) if " " in name else "Candidate",
                        "email": meta.get("email") or "verified@talent-vault.io",
                        "phone": meta.get("phone") or "",
                        "title": meta.get("role") or meta.get("title") or "Software Engineer",
                        "company": meta.get("company") or "Talent Vault",
                        "skills": [s.strip() for s in str(meta.get("skills", "")).split(",") if s.strip()] if isinstance(meta.get("skills"), str) else (meta.get("skills") or []),
                        "experience_years": int(meta.get("experience_years", 5)) if str(meta.get("experience_years", "")).isdigit() else 5,
                        "location": meta.get("location") or "Remote",
                        "score": max(75.0, pct_score),
                        "status": "SOURCED",
                        "source": "Vector Hybrid Match",
                    })

            base_filters = [
                Candidate.is_searchable.isnot(False),
                Candidate.pii_erased.isnot(True),
                Candidate.tenant_id == tenant_uuid,
            ]

            stmt = select(Candidate).where(*base_filters)

            # Combine deterministic canonical skills with raw tokens
            raw_tokens = [
                t.strip() for t in re.split(r"[,;\s]+", (keywords or "").strip())
                if len(t.strip()) > 2 and t.lower() not in {"and", "the", "for", "with", "role", "senior", "lead"}
            ][:4]
            search_terms = list(dict.fromkeys(facets.get("skills", [])[:4] + raw_tokens))[:6]

            if search_terms:
                kw_clauses = []
                for kw in search_terms:
                    kw_clauses.append(Candidate.title.ilike(f"%{kw}%"))
                    kw_clauses.append(Candidate.ai_summary.ilike(f"%{kw}%"))
                stmt = stmt.where(or_(*kw_clauses))

            stmt = stmt.order_by(Candidate.score.desc()).limit(limit)
            candidates = (await session.execute(stmt)).scalars().all()

            if not candidates:
                fallback_stmt = select(Candidate).where(*base_filters).order_by(Candidate.score.desc()).limit(limit)
                candidates = (await session.execute(fallback_stmt)).scalars().all()

            for c in candidates:
                hidden = [str(x).strip().lower() for x in (c.hide_from_companies or []) if x]
                if blocked_identifiers and any(b in hidden for b in blocked_identifiers):
                    continue
                full_name = f"{c.first_name} {c.last_name}".strip()
                raw_candidates.append({
                    "id": str(c.id),
                    "name": full_name,
                    "first_name": c.first_name,
                    "last_name": c.last_name,
                    "email": c.email,
                    "phone": c.phone or "",
                    "title": c.title or "Software Engineer",
                    "company": c.current_company or "Verified Talent Pool",
                    "skills": c.skills or [],
                    "experience_years": c.experience_years or 5,
                    "location": c.location or "Remote",
                    "linkedin_url": c.linkedin_url or "",
                    "github_url": c.github_url or "",
                    "score": float(c.score or 88.0),
                    "status": getattr(c.status, "value", str(c.status)),
                    "source": c.source or "Internal Talent Pool",
                })
    except Exception as exc:
        log.warning("fast_hybrid_sql_search_failed", error=str(exc), tenant_id=str(tenant_id))

    deduped = deduplicate_and_score_candidates(raw_candidates, query_facets=facets)
    return deduped[:limit]


async def _query_github_talent(deps: AgentDeps, keywords: str) -> str:
    if not deps.github_token:
        return "ERROR: GitHub token missing. Skip GitHub search."

    facets = ResumeParserService.extract_deterministic_facets(keywords)
    primary_lang = facets.get("primary_language")
    skill_terms = " ".join(facets.get("skills", [])[:2]) or keywords.strip()[:60]
    qualified_q = f"{skill_terms} language:{primary_lang} type:user" if primary_lang else f"{keywords.strip()[:80]} type:user"

    cache_key = f"github:{qualified_q.lower()}"
    cached = _get_sourcing_cache(cache_key, tenant_id=deps.tenant_id)
    if cached:
        return cached

    url = "https://api.github.com/search/users"
    headers = {"Authorization": f"token {deps.github_token}"}
    params = {"q": qualified_q, "per_page": 5}

    try:
        resp = await deps.http_client.get(url, headers=headers, params=params, timeout=3.5)
        if resp.status_code == 200:
            payload = json.dumps(resp.json().get("items", []))
            _set_sourcing_cache(cache_key, payload, tenant_id=deps.tenant_id, ttl_seconds=3600)
            return payload
        return f"GitHub API Error: {resp.status_code}"
    except Exception as e:
        return f"Search Failed: {str(e)}"


async def _query_stackoverflow_experts(deps: AgentDeps, query: str) -> str:
    """
    Freehire-inspired direct public API ingestion:
    Queries StackExchange's zero-auth public REST API for top-reputation tag answerers.
    """
    facets = ResumeParserService.extract_deterministic_facets(query)
    tags = facets.get("stackoverflow_tags") or []
    tag = tags[0] if tags else "python"

    cache_key = f"stackoverflow:{tag.lower()}"
    cached = _get_sourcing_cache(cache_key, tenant_id=deps.tenant_id)
    if cached:
        return cached

    url = f"https://api.stackexchange.com/2.3/tags/{tag}/top-answerers/all_time"
    params = {"site": "stackoverflow", "pagesize": 5}

    try:
        resp = await deps.http_client.get(url, params=params, timeout=2.5)
        if resp.status_code == 200:
            data = resp.json() if hasattr(resp, "json") else {}
            items = data.get("items", []) if isinstance(data, dict) else []
            simplified = [
                {
                    "display_name": item.get("user", {}).get("display_name"),
                    "reputation": item.get("user", {}).get("reputation"),
                    "link": item.get("user", {}).get("link"),
                    "post_count": item.get("post_count"),
                    "score": item.get("score"),
                    "tag": tag,
                }
                for item in items[:5]
                if isinstance(item, dict)
            ]
            payload = json.dumps(simplified)
            _set_sourcing_cache(cache_key, payload, tenant_id=deps.tenant_id, ttl_seconds=3600)
            return payload
        return "[]"
    except Exception:
        return "[]"


async def _query_web_signals(deps: AgentDeps, query: str) -> str:
    if not deps.serper_key:
        return "ERROR: Serper API key missing. Skip web search."

    cache_key = f"serper:{query.strip().lower()}"
    cached = _get_sourcing_cache(cache_key, tenant_id=deps.tenant_id)
    if cached:
        return cached

    url = "https://google.serper.dev/search"
    headers = {"X-API-KEY": deps.serper_key, "Content-Type": "application/json"}
    data = {"q": f"{query} site:linkedin.com/in", "num": 5}

    try:
        resp = await deps.http_client.post(url, headers=headers, json=data, timeout=3.5)
        if resp.status_code == 200:
            _set_sourcing_cache(cache_key, resp.text, tenant_id=deps.tenant_id, ttl_seconds=3600)
        return resp.text
    except Exception as e:
        return f"Web Search Failed: {str(e)}"


async def prefetch_all_sourcing_signals(deps: AgentDeps, query: str) -> str:
    """
    Concurrently executes deterministic facet extraction, internal hybrid search,
    GitHub qualified search, StackOverflow tag experts, and Serper web search
    in parallel using asyncio.gather so the Sourcing Agent can synthesize in 1 LLM turn.
    """
    facets = ResumeParserService.extract_deterministic_facets(query)
    internal_task = fast_hybrid_candidate_search(deps.tenant_id, query, limit=5)
    github_task = _query_github_talent(deps, query[:120])
    so_task = _query_stackoverflow_experts(deps, query[:120])
    web_task = _query_web_signals(deps, query[:120])

    internal_res, github_res, so_res, web_res = await asyncio.gather(
        internal_task, github_task, so_task, web_task, return_exceptions=True
    )

    internal_str = json.dumps(internal_res) if isinstance(internal_res, list) else str(internal_res)
    github_str = str(github_res)[:1500]
    so_str = str(so_res)[:1000]
    web_str = str(web_res)[:1500]

    return (
        f"[DETERMINISTIC_FACETS]: {json.dumps(facets)}\n"
        f"[PREFETCHED_INTERNAL_POOL]: {internal_str}\n"
        f"[PREFETCHED_GITHUB_SIGNALS]: {github_str}\n"
        f"[PREFETCHED_STACKOVERFLOW_EXPERTS]: {so_str}\n"
        f"[PREFETCHED_WEB_SIGNALS]: {web_str}"
    )


@sourcing_agent.tool
async def search_internal_talent_pool(ctx: RunContext[AgentDeps], keywords: str) -> str:
    """
    Searches the internal database of existing candidates and previous applicants
    matching technical keywords and role requirements.
    """
    try:
        found = await fast_hybrid_candidate_search(ctx.deps.tenant_id, keywords, limit=5)
        if not found:
            return "No internal candidates found matching criteria in this workspace."
        return json.dumps(found)
    except Exception as e:
        return f"Internal candidate search completed with fallback: {str(e)}"


@sourcing_agent.tool
async def search_github_talent(ctx: RunContext[AgentDeps], keywords: str) -> str:
    """Finds top engineering talent on GitHub using deterministic language and skill qualifiers."""
    return await _query_github_talent(ctx.deps, keywords)


@sourcing_agent.tool
async def search_stackoverflow_experts(ctx: RunContext[AgentDeps], query: str) -> str:
    """Finds top-reputation domain engineers on StackOverflow by canonical technical tag."""
    return await _query_stackoverflow_experts(ctx.deps, query)


@sourcing_agent.tool
async def search_web_signals(ctx: RunContext[AgentDeps], query: str) -> str:
    """Scans LinkedIn and public developer profiles for active talent signals via Serper API."""
    return await _query_web_signals(ctx.deps, query)


# ── Execution Helper ──────────────────────────────────────────────────────

async def synthesize_talent(jd: str, tenant_id: str) -> SourcingSynthesis:
    """Entry point for the Sourcing Synthesis pipeline."""
    import httpx
    async with httpx.AsyncClient() as client:
        deps = AgentDeps(http_client=client, tenant_id=tenant_id)
        prefetched = await prefetch_all_sourcing_signals(deps, jd)
        result = await sourcing_agent.run(
            f"Source and synthesize top talent for this role: {jd}\n\nPre-fetched multi-source candidate signals (use directly without redundant tool calls):\n{prefetched}",
            deps=deps
        )
        return result.output
