"""
DVT Talent AI — Enterprise ATS Sync Service (Merge.dev / Finch integration)
Pulls historical candidates from an agency's Greenhouse/Lever instances,
converts their resumes to vector embeddings, and stores them in Pinecone
to build a proprietary Data Lake.
"""
import httpx
import hashlib
from typing import List, Dict, Any
from openai import AsyncOpenAI
import structlog

from backend.config import settings

log = structlog.get_logger(__name__)

PINECONE_API_KEY = getattr(settings, 'pinecone_api_key', 'mock_pinecone_key')
PINECONE_HOST = getattr(settings, 'pinecone_host', 'https://dvt-memory-tree.pinecone.io')

async def fetch_candidates_from_merge_dev(tenant_id: str, ats_provider: str) -> List[Dict[str, Any]]:
    """
    Mock integration to Merge.dev to pull candidates from Greenhouse/Lever.
    Returns normalized candidate data.
    """
    log.info(f"Connecting to Merge.dev for tenant {tenant_id} (Provider: {ats_provider})")
    
    # Mocking the response that would come from Merge.dev Unified ATS API
    return [
        {
            "id": "cnd_12345",
            "first_name": "Alice",
            "last_name": "Engineer",
            "email": "alice@example.com",
            "current_title": "Senior Staff Software Engineer",
            "status": "REJECTED_FINAL_ROUND", # A Silver Medalist!
            "resume_text": "10 years experience in Python, React, and AWS. Previously at Google and Stripe. Led a team of 15 engineers to build a distributed payment system.",
            "source_ats": ats_provider
        },
        {
            "id": "cnd_67890",
            "first_name": "Bob",
            "last_name": "Developer",
            "email": "bob@example.com",
            "current_title": "Frontend Architect",
            "status": "OFFER_DECLINED", # A Silver Medalist!
            "resume_text": "Expert in Next.js, TypeScript, and TailwindCSS. Built the core frontend architecture for a Series C startup.",
            "source_ats": ats_provider
        }
    ]

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
                json={"vectors": vectors}
            )
            response.raise_for_status()
            log.info(f"Successfully synced {len(vectors)} ATS candidates to Pinecone Data Lake.")
    except Exception as e:
        log.error(f"Failed to upsert to Pinecone: {e}")
