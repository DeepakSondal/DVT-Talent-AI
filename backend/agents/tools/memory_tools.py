import structlog
from typing import List, Dict, Any, Optional
import os

try:
    from mem0 import Memory
except ImportError:
    Memory = None

log = structlog.get_logger(__name__)

# Initialize a global or tenant-scoped Memory instance if available
def get_mem0_client(tenant_id: str) -> Optional[Any]:
    if not Memory:
        return None
    # For Mem0 we can configure it to use Postgres or Pinecone.
    # For this implementation we use the default local/in-memory or basic vector config 
    # to avoid breaking if API keys aren't immediately present.
    try:
        # In a real environment, you'd pass DB credentials here
        return Memory()
    except Exception as e:
        log.error("mem0_init_failed", error=str(e))
        return None

def fetch_recruiter_preferences(tenant_id: str, recruiter_id: str, query: str = "What are the recruiter's candidate preferences and red flags?") -> str:
    """
    Fetches long-term memory preferences for a specific recruiter using Mem0.
    This allows agents to adjust their sourcing criteria based on past feedback.
    """
    m = get_mem0_client(tenant_id)
    if not m:
        log.warning("mem0_not_installed_or_configured_using_mock")
        return "Prefers strong engineering backgrounds. Dislikes candidates with frequent job hopping (less than 1 year per role)."
        
    try:
        results = m.search(query, user_id=f"{tenant_id}_{recruiter_id}")
        
        if not results:
            return "No specific preferences recorded yet."
        
        # mem0 search returns a list of dictionaries with a 'memory' or 'text' key depending on version
        prefs = [res.get('memory', res.get('text', str(res))) for res in results]
        return " | ".join(prefs)
    except Exception as e:
        log.error("mem0_fetch_error", error=str(e))
        return "Error fetching preferences."

def add_recruiter_preference(tenant_id: str, recruiter_id: str, preference_text: str) -> bool:
    """
    Adds a new preference to the recruiter's long-term memory.
    """
    m = get_mem0_client(tenant_id)
    if not m:
        return False
        
    try:
        m.add(preference_text, user_id=f"{tenant_id}_{recruiter_id}")
        return True
    except Exception as e:
        log.error("mem0_add_error", error=str(e))
        return False
