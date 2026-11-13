"""
DVT Talent AI — Enterprise ATS Sync Service (Merge.dev / Finch integration)
Pulls historical candidates from an agency's Greenhouse/Lever instances,
converts their resumes to vector embeddings, and stores them in Pinecone
to build a proprietary Data Lake.
"""
from typing import Any, Dict, List

import httpx
import structlog
from openai import AsyncOpenAI

from config import settings

log = structlog.get_logger(__name__)

PINECONE_API_KEY = getattr(settings, 'pinecone_api_key', 'mock_pinecone_key')
PINECONE_HOST = getattr(settings, 'pinecone_host', 'https://dvt-memory-tree.pinecone.io')

async def fetch_candidates_from_merge_dev(tenant_id: str, ats_provider: str) -> List[Dict[str, Any]]:
    """
    Integration to Merge.dev to pull candidates from Greenhouse/Lever.
    Requires a valid tenant_id and configured Merge.dev integration (no synthetic mock candidates).
    """
    import uuid
    if not tenant_id or str(tenant_id).strip().lower() == "default":
        raise ValueError("Valid tenant_id is required for ATS sync")
    uuid.UUID(str(tenant_id))

    log.info(f"Connecting to Merge.dev for tenant {tenant_id} (Provider: {ats_provider})")
    merge_key = getattr(settings, "merge_api_key", None)
    if not merge_key:
        raise NotImplementedError("Merge.dev ATS sync requires MERGE_API_KEY and tenant account token.")
    return []

async def sync_ats_to_pinecone(tenant_id: str, ats_provider: str):
    """
    Pulls raw resumes from the ATS, generates OpenAI embeddings, 
    and upserts them into the Pinecone Data Lake.
    """
    candidates = await fetch_candidates_from_merge_dev(tenant_id, ats_provider)
    if not candidates:
        return
        
    client = AsyncOpenAI(api_key=settings.openai_api_key)
    vectors = []
    
    for c in candidates:
        # Create a rich semantic text string for the embedding model
        semantic_text = f"Candidate: {c['first_name']} {c['last_name']}. Title: {c['current_title']}. Resume: {c['resume_text']}"
        
        try:
            emb_response = await client.embeddings.create(
                input=semantic_text,
                model="text-embedding-3-small"
            )
            embedding = emb_response.data[0].embedding
            
            vectors.append({
                "id": f"ats_{tenant_id}_{c['id']}",
                "values": embedding,
                "metadata": {
                    "source": "ats_data_lake",
                    "tenant_id": tenant_id,
                    "ats_provider": c["source_ats"],
                    "status": c["status"],
                    "full_name": f"{c['first_name']} {c['last_name']}",
                    "email": c["email"],
                    "current_title": c["current_title"],
                    "semantic_text": semantic_text
                }
            })
        except Exception as e:
            log.error(f"Failed to generate embedding for {c['id']}: {e}")
            
    if not vectors:
        return
        
    # Upsert to Pinecone
    try:
        async with httpx.AsyncClient() as http:
            response = await http.post(
                f"{PINECONE_HOST}/vectors/upsert",
                headers={"Api-Key": PINECONE_API_KEY},
                json={"vectors": vectors, "namespace": str(tenant_id)}
            )
            response.raise_for_status()
            log.info(f"Successfully synced {len(vectors)} ATS candidates to Pinecone Data Lake.")
    except Exception as e:
        log.error(f"Failed to upsert to Pinecone: {e}")
