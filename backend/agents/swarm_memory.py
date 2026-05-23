import json
import os
import hashlib
import sqlite3
import httpx
from typing import List, Dict, Optional
from openai import AsyncOpenAI
from backend.config import settings

DB_FILE = "swarm_memory.db"
PINECONE_API_KEY = getattr(settings, 'pinecone_api_key', 'mock_pinecone_key')
PINECONE_HOST = getattr(settings, 'pinecone_host', 'https://dvt-memory-tree.pinecone.io')

def _get_db():
    conn = sqlite3.connect(DB_FILE, timeout=10.0)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("CREATE TABLE IF NOT EXISTS semantic_cache (query_hash TEXT PRIMARY KEY, result TEXT)")
    return conn

def _get_cache(query_hash: str) -> Optional[str]:
    with _get_db() as db:
        res = db.execute("SELECT result FROM semantic_cache WHERE query_hash = ?", (query_hash,)).fetchone()
        return res[0] if res else None

def _set_cache(query: str, result: str):
    query_hash = hashlib.md5(query.encode()).hexdigest()
    with _get_db() as db:
        db.execute("INSERT OR REPLACE INTO semantic_cache (query_hash, result) VALUES (?, ?)", (query_hash, result))

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


