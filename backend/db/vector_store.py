"""
DVT Talent AI — Vector Store (ChromaDB Integration)
Handles embeddings and semantic similarity matching for resumes and jobs.
"""
import uuid
import json
from typing import Dict, List, Any, Optional
import structlog

log = structlog.get_logger(__name__)
try:
    import chromadb
    from chromadb.config import Settings as ChromaSettings
    CHROMA_AVAILABLE = True
except ImportError:
    CHROMA_AVAILABLE = False
    ChromaSettings = object # Mock for type hints

try:
    from fastembed import TextEmbedding
    FASTEMBED_AVAILABLE = True
except ImportError:
    FASTEMBED_AVAILABLE = False

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
        """Lazy load the embedding model with FastEmbed (ONNX) priority over SentenceTransformers"""
        if self._model is not None:
            return self._model
        if FASTEMBED_AVAILABLE:
            try:
                self._model = TextEmbedding(model_name="BAAI/bge-small-en-v1.5")
                self._is_fastembed = True
                return self._model
            except Exception as e:
                print(f"[VectorStore] FastEmbed init fallback: {e}")
        if SENTENCE_TRANSFORMERS_AVAILABLE:
            self._model = SentenceTransformer("all-MiniLM-L6-v2")
            self._is_fastembed = False
            return self._model
        return None

    def embed_text(self, text: str) -> List[float]:
        """Convert text string into a vector embedding (384 dimensions)"""
        model = self._get_model()
        if not model:
            # Return a dummy vector if model unavailable
            return [0.0] * 384
        if getattr(self, "_is_fastembed", False):
            try:
                embeddings = list(model.embed([text[:2000]]))
                return embeddings[0].tolist()
            except Exception:
                return [0.0] * 384
        # Chroma expects a list of floats
        return model.encode(text[:2000]).tolist()

    @staticmethod
    def cosine_similarity(v1: List[float], v2: List[float]) -> float:
        """Calculate cosine similarity between two vector embeddings (useful for pgvector)"""
        dot = sum(a * b for a, b in zip(v1, v2))
        norm1 = sum(a * a for a in v1) ** 0.5
        norm2 = sum(b * b for b in v2) ** 0.5
        if not norm1 or not norm2:
            return 0.0
        return dot / (norm1 * norm2)

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
        if not CHROMA_AVAILABLE or not self.client or not getattr(self, "resumes", None):
            return []
            
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

    def delete_resumes(
        self,
        tenant_id: str,
        resume_ids: Optional[List[str]] = None,
        candidate_id: Optional[str] = None
    ) -> bool:
        """
        Delete resume vector embeddings from ChromaDB.
        Strictly scoped to tenant_id and candidate_id / resume_ids.
        Raises an exception if the vector store is offline/unavailable.
        """
        if not CHROMA_AVAILABLE:
            return True

        if not self.client:
            raise RuntimeError("ChromaDB vector store is offline or uninitialized")

        ids_to_delete = [str(i) for i in (resume_ids or []) if i]
        
        # 1. Delete by IDs if provided (strictly scoped by tenant_id metadata)
        if ids_to_delete:
            try:
                self.resumes.delete(ids=ids_to_delete, where={"tenant_id": str(tenant_id)})
            except Exception as e:
                log.warning("chroma_delete_by_ids_failed", error=str(e), ids=ids_to_delete)
                raise e

        # 2. Delete by candidate and tenant metadata
        if candidate_id:
            try:
                where_filter = {
                    "$and": [
                        {"tenant_id": str(tenant_id)},
                        {"candidate_id": str(candidate_id)}
                    ]
                }
                self.resumes.delete(where=where_filter)
            except Exception as e:
                log.warning("chroma_delete_by_filter_failed", error=str(e), candidate_id=candidate_id)
                raise e

        return True

    # ── Jobs ────────────────────────────────────────────────────────────────
    def upsert_job(self, job_id: str, text: str, metadata: dict, tenant_id: Optional[str] = None):
        """Add or update a job post in the vector store with tenant isolation metadata"""
        if not CHROMA_AVAILABLE or not self.client or not getattr(self, "jobs", None):
            return
        extended_metadata = {k: str(v) for k, v in (metadata or {}).items()}
        if tenant_id:
            extended_metadata["tenant_id"] = str(tenant_id)
        embedding = self.embed_text(text)
        self.jobs.upsert(
            ids=[job_id],
            embeddings=[embedding],
            documents=[text[:2000]],
            metadatas=[extended_metadata]
        )

    def search_jobs(self, query_text: str, limit: int = 10, tenant_id: Optional[str] = None) -> List[dict]:
        """Find most similar jobs to a candidate profile / text, optionally scoped to tenant_id"""
        if not CHROMA_AVAILABLE or not self.client or not getattr(self, "jobs", None):
            return []
        query_embedding = self.embed_text(query_text)
        query_kwargs: Dict[str, Any] = {
            "query_embeddings": [query_embedding],
            "n_results": limit,
        }
        if tenant_id:
            query_kwargs["where"] = {"tenant_id": str(tenant_id)}
        results = self.jobs.query(**query_kwargs)
        
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
