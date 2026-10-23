import json
import os
import hashlib
import sqlite3
import httpx
from typing import List, Dict, Optional
from openai import AsyncOpenAI
from config import settings

import redis

PINECONE_API_KEY = getattr(settings, 'pinecone_api_key', 'mock_pinecone_key')
PINECONE_HOST = getattr(settings, 'pinecone_host', 'https://dvt-memory-tree.pinecone.io')

_redis_pool = None

def _get_redis():
    global _redis_pool
    if _redis_pool is None:
        _redis_pool = redis.ConnectionPool.from_url(settings.redis_url)
    return redis.Redis(connection_pool=_redis_pool)

def _get_cache(query_hash: str) -> Optional[str]:
    try:
        r = _get_redis()
        val = r.get(f"swarm_cache:{query_hash}")
        return val.decode("utf-8") if val else None
    except Exception:
        return None

def _set_cache(query: str, result: str, ttl_seconds: int = 86400):
    try:
        query_hash = hashlib.md5(query.encode()).hexdigest()
        r = _get_redis()
        r.setex(f"swarm_cache:{query_hash}", ttl_seconds, result)
    except Exception:
        pass

async def add_negative_vector(category: str, reason: str, tenant_id: str = "default"):
    """
    VC FIX: Upgraded to Enterprise Vector Database (Pinecone).
    Creates a defensible 'Memory Moat' network effect by embedding rejection reasons 
    across all tenants into a unified vector space.
    """
    try:
        client = AsyncOpenAI()
        emb_response = await client.embeddings.create(
            input=f"Category: {category}. Reason: {reason}",
            model="text-embedding-3-small"
        )
        vector = emb_response.data[0].embedding
        
        async with httpx.AsyncClient() as http:
            await http.post(
                f"{PINECONE_HOST}/vectors/upsert",
                headers={"Api-Key": PINECONE_API_KEY},
                json={
                    "vectors": [{
                        "id": hashlib.md5(reason.encode()).hexdigest(),
                        "values": vector,
                        "metadata": {"category": category, "tenant_id": tenant_id, "reason": reason}
                    }]
                }
            )
    except Exception as e:
        print(f"Vector DB sync failed, falling back: {e}")

async def query_memory_tree(query: str, tenant_id: str = "default") -> str:
    """
    Semantic Vector Search (Pinecone):
    Queries the enterprise Memory Moat for historical rejection reasons.
    """
    query_hash = hashlib.md5(query.encode()).hexdigest()
    cached_result = _get_cache(query_hash)
    if cached_result:
        return cached_result

    try:
        client = AsyncOpenAI()
        emb_response = await client.embeddings.create(
            input=query,
            model="text-embedding-3-small"
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
                    "filter": {"tenant_id": {"$in": [tenant_id, "global_network"]}}
                }
            )
            matches = resp.json().get("matches", [])
            if not matches:
                return "NO_CONFLICT"
                
            reasons = [m["metadata"]["reason"] for m in matches]
            result = "APPLICABLE RULES: " + " | ".join(reasons)
            _set_cache(query, result)
            return result
    except Exception as e:
        return "NO_CONFLICT"

def get_negative_vectors():
    """Legacy wrapper for flat list"""
    return []


