"""
DVT Talent AI — Vector Store (ChromaDB Integration)
Handles embeddings and semantic similarity matching for resumes and jobs.
"""
import uuid
import json
from typing import Dict, List, Any, Optional
try:
    import chromadb
    from chromadb.config import Settings as ChromaSettings
    CHROMA_AVAILABLE = True
except ImportError:
    CHROMA_AVAILABLE = False
    ChromaSettings = object # Mock for type hints

try:
    from sentence_transformers import SentenceTransformer
    SENTENCE_TRANSFORMERS_AVAILABLE = True
except ImportError:
    SENTENCE_TRANSFORMERS_AVAILABLE = False

from config import settings

class VectorStore:
    """
    Centralized store for vector embeddings using ChromaDB.
    Supports resumes, jobs, and company profiles.
    """
    _instance = None
    _model = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(VectorStore, cls).__new__(cls)
            cls._instance._init_chroma()
        return cls._instance

    def _init_chroma(self):
        """Initialize ChromaDB HttpClient"""
        if not CHROMA_AVAILABLE:
            print("[WARNING] ChromaDB not installed. Vector Store running in MOCK mode.")
            self.client = None
            return

        try:
            self.client = chromadb.HttpClient(
                host=settings.chroma_host,
                port=settings.chroma_port,
                settings=ChromaSettings(allow_reset=True)
            )
            self._ensure_collections()
        except Exception as e:
            print(f"Error connecting to ChromaDB: {e}")
            # Fallback to ephemeral if server is down (only for dev)
            if not settings.is_production:
                try:
                    self.client = chromadb.PersistentClient(path="./chroma_db")
                    self._ensure_collections()
                except Exception:
                    print("[WARNING] Failed to initialize Persistent ChromaDB. Vector Store is disabled.")
                    self.client = None
            else:
                raise e

    def _ensure_collections(self):
        """Create standard collections if they don't exist"""
        if not self.client:
            return
        self.resumes = self.client.get_or_create_collection(
            name=settings.chroma_collection_resumes,
            metadata={"hnsw:space": "cosine"}
        )
        self.jobs = self.client.get_or_create_collection(
            name=settings.chroma_collection_jobs,
            metadata={"hnsw:space": "cosine"}
        )

    def _get_model(self):
        """Lazy load the embedding model"""
        if not SENTENCE_TRANSFORMERS_AVAILABLE:
            return None
        if self._model is None:
            # Use a lightweight but powerful local model
            self._model = SentenceTransformer("all-MiniLM-L6-v2")
        return self._model

    def embed_text(self, text: str) -> List[float]:
        """Convert text string into a vector embedding"""
        model = self._get_model()
        if not model:
            # Return a dummy vector if model unavailable
            return [0.0] * 384
        # Chroma expects a list of floats
        return model.encode(text[:2000]).tolist()

    # ── Resumes ─────────────────────────────────────────────────────────────
    def upsert_resume(self, tenant_id: str, resume_id: str, text: str, metadata: dict):
        """Add or update a resume with forced tenant metadata isolation"""
        if not CHROMA_AVAILABLE or not self.client:
            return
        
        # [NEW] Gap 3: Enforce tenant_id in metadata
        extended_metadata = {k: str(v) for k, v in metadata.items()}
        extended_metadata["tenant_id"] = str(tenant_id)
        
        embedding = self.embed_text(text)
        self.resumes.upsert(
            ids=[resume_id],
            embeddings=[embedding],
            documents=[text[:2000]],
            metadatas=[extended_metadata]
        )

    def search_resumes(self, tenant_id: str, query_text: str, limit: int = 10, filters: dict = None) -> List[dict]:
        """Find most similar resumes ONLY within the specified tenant space"""
        query_embedding = self.embed_text(query_text)
        
        # [NEW] Gap 3: Build mandatory tenant 'where' filter
        where_clause = {"tenant_id": str(tenant_id)}
        if filters:
            # Merge tenant filter with user filters
            user_filters = {k: str(v) for k, v in filters.items()}
            where_clause = {"$and": [where_clause, user_filters]}

        results = self.resumes.query(
            query_embeddings=[query_embedding],
            n_results=limit,
            where=where_clause
        )

        formatted = []
        if results["ids"]:
            for i in range(len(results["ids"][0])):
                formatted.append({
                    "id": results["ids"][0][i],
                    "document": results["documents"][0][i],
                    "metadata": results["metadatas"][0][i],
                    "score": 1 - results["distances"][0][i]  # Convert distance to similarity
                })
        return formatted

    # ── Jobs ────────────────────────────────────────────────────────────────
    def upsert_job(self, job_id: str, text: str, metadata: dict):
        """Add or update a job post in the vector store"""
        embedding = self.embed_text(text)
        self.jobs.upsert(
            ids=[job_id],
            embeddings=[embedding],
            documents=[text[:2000]],
            metadatas=[{k: str(v) for k, v in metadata.items()}]
        )

    def search_jobs(self, query_text: str, limit: int = 10) -> List[dict]:
        """Find most similar jobs to a candidate profile / text"""
        query_embedding = self.embed_text(query_text)
        results = self.jobs.query(
            query_embeddings=[query_embedding],
            n_results=limit
        )
        
        formatted = []
        if results["ids"]:
            for i in range(len(results["ids"][0])):
                formatted.append({
                    "id": results["ids"][0][i],
                    "document": results["documents"][0][i],
                    "metadata": results["metadatas"][0][i],
                    "score": 1 - results["distances"][0][i]
                })
        return formatted

# Singleton instance
vector_store = VectorStore()
