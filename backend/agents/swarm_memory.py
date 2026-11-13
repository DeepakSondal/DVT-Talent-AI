import sys

if __name__.startswith("backend.agents."):
    sys.modules[__name__.replace("backend.agents.", "agents.")] = sys.modules[__name__]
elif __name__.startswith("agents."):
    sys.modules["backend." + __name__] = sys.modules[__name__]

import hashlib
import os
from typing import Dict, List, Optional

import httpx
import redis
import structlog
from openai import AsyncOpenAI
from sqlalchemy import desc, select

log = structlog.get_logger(__name__)

try:
    from backend.config import settings
except ImportError:
    from config import settings  # pyrefly: ignore[missing-import]  # type: ignore

PINECONE_API_KEY = getattr(settings, "pinecone_api_key", "mock_pinecone_key")
PINECONE_HOST = getattr(settings, "pinecone_host", "https://dvt-memory-tree.pinecone.io")

_redis_pool = None
_local_memory_store: Dict[str, List[Dict[str, str]]] = {}


def _get_redis():
    global _redis_pool
    if _redis_pool is None:
        _redis_pool = redis.ConnectionPool.from_url(
            settings.redis_url,
            socket_connect_timeout=0.2,
            socket_timeout=0.2,
        )
    return redis.Redis(connection_pool=_redis_pool)


def _require_tenant_id(tenant_id: Optional[str]) -> str:
    safe_tenant = str(tenant_id or "").strip()
    if not safe_tenant or safe_tenant.lower() == "default":
        raise ValueError("A non-empty, non-default tenant_id is required for swarm_memory operations")
    return safe_tenant


def _get_cache(query_hash: str, tenant_id: str) -> Optional[str]:
    safe_tenant = _require_tenant_id(tenant_id)
    try:
        r = _get_redis()
        val = r.get(f"swarm_cache:{safe_tenant}:{query_hash}")
        return val.decode("utf-8") if val else None
    except Exception:
        return None


def _set_cache(query: str, result: str, tenant_id: str, ttl_seconds: int = 86400):
    safe_tenant = _require_tenant_id(tenant_id)
    try:
        query_hash = hashlib.md5(query.encode(), usedforsecurity=False).hexdigest()
        r = _get_redis()
        r.setex(f"swarm_cache:{safe_tenant}:{query_hash}", ttl_seconds, result)
    except Exception as exc:
        log.debug("swarm_cache_set_skipped", error=str(exc), tenant_id=safe_tenant)


def _has_external_pinecone() -> bool:
    return bool(
        PINECONE_API_KEY
        and PINECONE_API_KEY != "mock_pinecone_key"
        and os.getenv("OPENAI_API_KEY")
    )


async def add_negative_vector(category: str, reason: str, tenant_id: str):
    """
    Records a recruiter rejection calibration rule scoped strictly to tenant_id.
    Always persists locally in memory + Redis, and syncs to Pinecone if configured.
    """
    safe_tenant = _require_tenant_id(tenant_id)
    clean_reason = (reason or "").strip()
    if not clean_reason:
        return

    rules = _local_memory_store.setdefault(safe_tenant, [])
    if not any(r["reason"] == clean_reason for r in rules):
        rules.append({"category": category, "reason": clean_reason, "tenant_id": safe_tenant})

    try:
        r = _get_redis()
        r.sadd(f"swarm_rules:{safe_tenant}", f"[{category}] {clean_reason}")
    except Exception as exc:
        log.debug("swarm_rules_redis_add_skipped", error=str(exc), tenant_id=safe_tenant)

    if not _has_external_pinecone():
        return

    try:
        client = AsyncOpenAI()
        emb_response = await client.embeddings.create(
            input=f"Category: {category}. Reason: {clean_reason}",
            model="text-embedding-3-small",
        )
        vector = emb_response.data[0].embedding
        vec_id = hashlib.md5(f"{safe_tenant}:{clean_reason}".encode(), usedforsecurity=False).hexdigest()

        async with httpx.AsyncClient() as http:
            await http.post(
                f"{PINECONE_HOST}/vectors/upsert",
                headers={"Api-Key": PINECONE_API_KEY},
                json={
                    "vectors": [
                        {
                            "id": vec_id,
                            "values": vector,
                            "metadata": {
                                "category": category,
                                "tenant_id": safe_tenant,
                                "reason": clean_reason,
                            },
                        }
                    ]
                },
            )
    except Exception as e:
        print(f"Vector DB sync failed, falling back to local calibration store: {e}")


async def _get_local_calibration_reasons(tenant_id: str) -> List[str]:
    reasons: List[str] = [
        r["reason"] for r in _local_memory_store.get(tenant_id, []) if r.get("reason")
    ]
    try:
        r = _get_redis()
        members = r.smembers(f"swarm_rules:{tenant_id}")
        for m in members or []:
            decoded = m.decode("utf-8") if isinstance(m, bytes) else str(m)
            if decoded and decoded not in reasons:
                reasons.append(decoded)
    except Exception as exc:
        log.debug("swarm_rules_redis_read_skipped", error=str(exc), tenant_id=tenant_id)

    try:
        import uuid as _uuid

        from db.models import AIDecisionLedger, AsyncSessionLocal

        t_uuid = _uuid.UUID(str(tenant_id))
        async with AsyncSessionLocal() as session:
            stmt = (
                select(AIDecisionLedger.override_reason)
                .where(
                    AIDecisionLedger.tenant_id == t_uuid,
                    AIDecisionLedger.human_action == "REJECTED",
                    AIDecisionLedger.override_reason.isnot(None),
                )
                .order_by(desc(AIDecisionLedger.created_at))
                .limit(10)
            )
            rows = (await session.execute(stmt)).scalars().all()
            for r_text in rows:
                if r_text and r_text not in reasons:
                    reasons.append(r_text)
    except Exception as exc:
        log.debug("swarm_rules_db_read_skipped", error=str(exc), tenant_id=tenant_id)

    return reasons[:5]


async def query_memory_tree(query: str, tenant_id: str) -> str:
    """
    Queries historical rejection calibration rules scoped strictly to tenant_id.
    Uses Redis cache -> local PostgreSQL AIDecisionLedger / Redis store -> Pinecone fallback.
    """
    safe_tenant = _require_tenant_id(tenant_id)
    query_hash = hashlib.md5(query.encode(), usedforsecurity=False).hexdigest()
    cached_result = _get_cache(query_hash, tenant_id=safe_tenant)
    if cached_result:
        return cached_result

    local_reasons = await _get_local_calibration_reasons(safe_tenant)
    if local_reasons:
        result = "APPLICABLE RULES: " + " | ".join(local_reasons)
        _set_cache(query, result, tenant_id=safe_tenant)
        return result

    if not _has_external_pinecone():
        return "NO_CONFLICT"

    try:
        client = AsyncOpenAI()
        emb_response = await client.embeddings.create(
            input=query, model="text-embedding-3-small"
        )
        query_vector = emb_response.data[0].embedding

        async with httpx.AsyncClient() as http:
            resp = await http.post(
                f"{PINECONE_HOST}/query",
                headers={"Api-Key": PINECONE_API_KEY},
                json={
                    "vector": query_vector,
                    "topK": 5,
                    "includeMetadata": True,
                    "filter": {"tenant_id": safe_tenant},
                },
            )
            matches = resp.json().get("matches", [])
            if not matches:
                return "NO_CONFLICT"

            reasons = [
                m["metadata"]["reason"]
                for m in matches
                if m.get("metadata", {}).get("tenant_id") == safe_tenant
            ]
            if not reasons:
                return "NO_CONFLICT"
            result = "APPLICABLE RULES: " + " | ".join(reasons)
            _set_cache(query, result, tenant_id=safe_tenant)
            return result
    except Exception:
        return "NO_CONFLICT"


def get_negative_vectors(tenant_id: str):
    """Return local calibration vectors for tenant"""
    return list(_local_memory_store.get(_require_tenant_id(tenant_id), []))
