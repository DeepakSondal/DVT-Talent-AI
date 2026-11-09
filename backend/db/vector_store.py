"""
DVT Talent AI — Vector Store & Semantic Search Service
Provides FastEmbed ONNX vector embeddings, batch processing, BM25 hybrid search,
and native PostgreSQL pgvector storage with zero ChromaDB hard dependency.
"""
import sys

if __name__.startswith("backend.db."):
    sys.modules[__name__.replace("backend.db.", "db.")] = sys.modules[__name__]
elif __name__.startswith("db."):
    sys.modules["backend." + __name__] = sys.modules[__name__]

import importlib.util
import json
import os
import re
import uuid
from collections import Counter
from typing import Any, Dict, List, Optional

import structlog

log = structlog.get_logger(__name__)

# Optional ChromaDB integration (Legacy — decommissioned as primary)
try:
    import chromadb  # pyrefly: ignore[missing-import]  # type: ignore
    from chromadb.config import Settings as ChromaSettings  # pyrefly: ignore[missing-import]  # type: ignore
    CHROMA_AVAILABLE = True
except ImportError:
    CHROMA_AVAILABLE = False
    ChromaSettings = object

# Modern Embedding Engine: FastEmbed (ONNX, CPU-optimized) — probe without eager heavy import
FASTEMBED_AVAILABLE = importlib.util.find_spec("fastembed") is not None

# Fallback Embedding Engine
SENTENCE_TRANSFORMERS_AVAILABLE = importlib.util.find_spec("sentence_transformers") is not None

try:
    from backend.config import settings
except ImportError:
    from config import settings  # pyrefly: ignore[missing-import]  # type: ignore


class VectorStore:
    """
    Centralized store for vector embeddings and hybrid search.
    Supports FastEmbed batching, BM25 lexical ranking, and PostgreSQL pgvector.
    """
    _instance = None
    _model = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(VectorStore, cls).__new__(cls)
            cls._instance._init_store()
        return cls._instance

    def _init_store(self):
        """Initialize persistent local fallback index and optional Chroma connection"""
        self._local_index = {
            "resumes": {},
            "jobs": {}
        }
        self._query_cache: Dict[str, List[float]] = {}
        self.client = None
        self.resumes = None
        self.jobs = None
        self._index_file = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "chroma_db", "vector_index.json")
        self._load_local_index()

        if not CHROMA_AVAILABLE:
            log.info("vector_store_mode", backend="native_fastembed_pgvector", chroma="decommissioned")
            return

        try:
            self.client = chromadb.HttpClient(
                host=getattr(settings, "chroma_host", "localhost"),
                port=getattr(settings, "chroma_port", 8000),
                # pyrefly: ignore[unexpected-keyword]
                settings=ChromaSettings(allow_reset=True)
            )
            self._ensure_collections()
        except Exception:
            # Fallback to local persistent if in development
            if not getattr(settings, "is_production", False):
                try:
                    self.client = chromadb.PersistentClient(path="./chroma_db")
                    self._ensure_collections()
                except Exception:
                    self.client = None
            else:
                self.client = None

    def _load_local_index(self):
        """Load persisted vector index from disk when not running isolated unit tests."""
        if "pytest" in sys.modules or os.environ.get("TESTING") == "true":
            return
        try:
            if os.path.exists(self._index_file):
                with open(self._index_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    if isinstance(data, dict):
                        self._local_index["resumes"] = data.get("resumes", {})
                        self._local_index["jobs"] = data.get("jobs", {})
        except Exception as e:
            log.warning("local_vector_index_load_failed", error=str(e))

    def _persist_local_index(self):
        """Persist local vector index to disk so embeddings survive server restarts on SQLite."""
        if "pytest" in sys.modules or os.environ.get("TESTING") == "true":
            return
        try:
            os.makedirs(os.path.dirname(self._index_file), exist_ok=True)
            with open(self._index_file, "w", encoding="utf-8") as f:
                json.dump(self._local_index, f)
        except Exception as e:
            log.warning("local_vector_index_persist_failed", error=str(e))

    def _ensure_collections(self):
        """Create collections if Chroma client is online"""
        if not self.client:
            return
        try:
            self.resumes = self.client.get_or_create_collection(
                name=getattr(settings, "chroma_collection_resumes", "resumes"),
                metadata={"hnsw:space": "cosine"}
            )
            self.jobs = self.client.get_or_create_collection(
                name=getattr(settings, "chroma_collection_jobs", "jobs"),
                metadata={"hnsw:space": "cosine"}
            )
        except Exception as e:
            log.warning("chroma_collection_init_failed", error=str(e))
            self.client = None

    def _get_model(self):
        """Lazy load the embedding model with FastEmbed (ONNX) priority"""
        if self._model is not None:
            return self._model
        if FASTEMBED_AVAILABLE:
            try:
                from fastembed import TextEmbedding  # noqa: PLC0415

                self._model = TextEmbedding(model_name="BAAI/bge-small-en-v1.5")
                self._is_fastembed = True
                return self._model
            except Exception as e:
                log.warning("fastembed_init_fallback", error=str(e))
        if SENTENCE_TRANSFORMERS_AVAILABLE:
            try:
                from sentence_transformers import SentenceTransformer  # pyrefly: ignore[missing-import]  # type: ignore  # noqa: PLC0415

                self._model = SentenceTransformer("all-MiniLM-L6-v2")
                self._is_fastembed = False
                return self._model
            except Exception as e:
                log.warning("sentence_transformers_init_failed", error=str(e))
        return None

    # ── 1. Batch & Single Embedding (Option 3) ──────────────────────────────
    def embed_text(self, text: str) -> List[float]:
        """Convert a single text string into a 384-dimensional dense vector with bounded caching"""
        cache_key = (text or "")[:2000]
        cache = getattr(self, "_query_cache", None)
        if cache is not None and cache_key in cache:
            return cache[cache_key]
        results = self.embed_batch([text])
        vec = results[0] if results else [0.0] * 384
        if cache is not None:
            if len(cache) >= 512:
                # Evict oldest inserted key
                cache.pop(next(iter(cache)), None)
            cache[cache_key] = vec
        return vec

    def embed_batch(self, texts: List[str]) -> List[List[float]]:
        """
        Batch convert a list of strings into 384-dimensional dense vectors.
        Processes in parallel ONNX execution blocks for 5x–10x throughput.
        """
        if not texts:
            return []
        model = self._get_model()
        if not model:
            return [[0.0] * 384 for _ in texts]

        truncated = [t[:2000] if t else "" for t in texts]

        if getattr(self, "_is_fastembed", False):
            try:
                embeddings = list(model.embed(truncated))
                return [e.tolist() for e in embeddings]
            except Exception as exc:
                log.warning("fastembed_batch_failed", error=str(exc))
                return [[0.0] * 384 for _ in texts]

        try:
            return model.encode(truncated).tolist()
        except Exception:
            return [[0.0] * 384 for _ in texts]

    @staticmethod
    def cosine_similarity(v1: List[float], v2: List[float]) -> float:
        """Calculate cosine similarity between two vector embeddings"""
        if not v1 or not v2 or len(v1) != len(v2):
            return 0.0
        dot = sum(a * b for a, b in zip(v1, v2, strict=True))
        norm1 = sum(a * a for a in v1) ** 0.5
        norm2 = sum(b * b for b in v2) ** 0.5
        if not norm1 or not norm2:
            return 0.0
        return dot / (norm1 * norm2)

    # ── 2. Hybrid Search (Option 2: BM25 + Semantic) ─────────────────────────
    @staticmethod
    def bm25_similarity(query: str, document: str) -> float:
        """
        Lightweight lexical term-frequency match score (BM25 heuristic)
        between a search query and candidate document text.
        """
        if not query or not document:
            return 0.0
        q_tokens = [t.lower() for t in re.findall(r"\w+", query) if len(t) > 2]
        if not q_tokens:
            return 0.0
        doc_tokens = [t.lower() for t in re.findall(r"\w+", document)]
        if not doc_tokens:
            return 0.0

        doc_len = len(doc_tokens)
        doc_counts = Counter(doc_tokens)

        # Standard BM25 parameters
        k1 = 1.5
        b = 0.75
        avgdl = 100.0
        score = 0.0

        for q in set(q_tokens):
            tf = doc_counts.get(q, 0)
            if tf > 0:
                numerator = tf * (k1 + 1)
                denominator = tf + k1 * (1 - b + b * (doc_len / avgdl))
                score += numerator / denominator

        max_possible = len(set(q_tokens)) * (k1 + 1)
        return min(1.0, score / max_possible if max_possible else 0.0)

    def hybrid_search_resumes(
        self,
        tenant_id: str,
        query_text: str,
        candidates_pool: Optional[List[Dict[str, Any]]] = None,
        limit: int = 10,
        alpha: float = 0.65,
    ) -> List[Dict[str, Any]]:
        """
        Hybrid search combining semantic vector cosine similarity (alpha)
        with BM25 keyword matching (1 - alpha).
        """
        pool = candidates_pool
        if pool is None:
            pool = self.search_resumes(tenant_id, query_text, limit=max(limit * 3, 20))
            if not pool and self._local_index["resumes"]:
                pool = [
                    v for v in self._local_index["resumes"].values()
                    if v.get("tenant_id") == str(tenant_id)
                ]

        if not pool:
            return []

        query_vec = self.embed_text(query_text)
        scored_candidates = []

        # Batch-embed any candidates missing precomputed embeddings in a single ONNX pass
        pool_items = [dict(c) for c in pool]
        missing_indices = [
            idx for idx, cand in enumerate(pool_items)
            if not cand.get("embedding") and not isinstance(cand.get("score"), (int, float))
        ]
        if missing_indices:
            missing_texts = [
                pool_items[idx].get("document") or pool_items[idx].get("text") or ""
                for idx in missing_indices
            ]
            batch_vecs = self.embed_batch(missing_texts)
            for idx, vec in zip(missing_indices, batch_vecs, strict=True):
                pool_items[idx]["embedding"] = vec

        for cand in pool_items:
            doc_text = cand.get("document") or cand.get("text") or ""

            # Semantic cosine score
            if "embedding" in cand and cand["embedding"]:
                semantic_score = self.cosine_similarity(query_vec, cand["embedding"])
            elif "score" in cand and isinstance(cand["score"], (int, float)):
                semantic_score = float(cand["score"])
            else:
                cand_vec = self.embed_text(doc_text)
                semantic_score = self.cosine_similarity(query_vec, cand_vec)

            # BM25 keyword score
            lexical_score = self.bm25_similarity(query_text, doc_text)

            # Weighted fusion
            blended_score = round(alpha * max(0.0, semantic_score) + (1.0 - alpha) * lexical_score, 4)

            cand_result = dict(cand)
            cand_result["score"] = blended_score
            cand_result["semantic_score"] = round(semantic_score, 4)
            cand_result["lexical_score"] = round(lexical_score, 4)
            scored_candidates.append(cand_result)

        scored_candidates.sort(key=lambda x: x["score"], reverse=True)
        return scored_candidates[:limit]

    # ── 3. Upsert & Search Resumes (Option 1 & 3) ────────────────────────────
    def upsert_resume(self, tenant_id: str, resume_id: str, text: str, metadata: Optional[Dict[str, Any]] = None):
        """Add or update a resume with forced tenant metadata isolation"""
        extended_metadata = {k: str(v) for k, v in (metadata or {}).items()}
        extended_metadata["tenant_id"] = str(tenant_id)
        embedding = self.embed_text(text)

        # 1. Update Chroma if client is active
        if CHROMA_AVAILABLE and self.client and getattr(self, "resumes", None):
            try:
                self.resumes.upsert(
                    ids=[str(resume_id)],
                    embeddings=[embedding],
                    documents=[text[:2000]],
                    metadatas=[extended_metadata]
                )
            except Exception as exc:
                log.warning("chroma_upsert_failed", error=str(exc))

        # 2. Update local index for in-memory and test consistency
        self._local_index["resumes"][str(resume_id)] = {
            "id": str(resume_id),
            "tenant_id": str(tenant_id),
            "candidate_id": str(extended_metadata.get("candidate_id", "")),
            "document": text[:2000],
            "metadata": extended_metadata,
            "embedding": embedding
        }
        self._persist_local_index()

    def upsert_resumes_batch(self, tenant_id: str, items: List[Dict[str, Any]]) -> int:
        """
        Batch upsert resumes with tenant metadata isolation using embed_batch().
        items: list of dicts with keys: id, text, metadata (optional)
        """
        if not items:
            return 0

        texts = [item.get("text", "") for item in items]
        embeddings = self.embed_batch(texts)

        # 1. Chroma batch upsert if available
        if CHROMA_AVAILABLE and self.client and getattr(self, "resumes", None):
            ids = [str(item["id"]) for item in items]
            documents = [t[:2000] for t in texts]
            metadatas = []
            for item in items:
                m = {k: str(v) for k, v in item.get("metadata", {}).items()}
                m["tenant_id"] = str(tenant_id)
                metadatas.append(m)
            try:
                self.resumes.upsert(
                    ids=ids,
                    embeddings=embeddings,
                    documents=documents,
                    metadatas=metadatas
                )
            except Exception as e:
                log.warning("chroma_batch_upsert_failed", error=str(e))

        # 2. Sync to local index
        for item, emb in zip(items, embeddings, strict=True):
            rid = str(item["id"])
            m = {k: str(v) for k, v in item.get("metadata", {}).items()}
            m["tenant_id"] = str(tenant_id)
            self._local_index["resumes"][rid] = {
                "id": rid,
                "tenant_id": str(tenant_id),
                "candidate_id": str(m.get("candidate_id", "")),
                "document": item.get("text", "")[:2000],
                "metadata": m,
                "embedding": emb
            }
        self._persist_local_index()

        return len(items)

    def search_resumes(self, tenant_id: str, query_text: str, limit: int = 10, filters: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """Find most similar resumes ONLY within the specified tenant space"""
        query_embedding = self.embed_text(query_text)

        # 1. Query Chroma if online
        if CHROMA_AVAILABLE and self.client and getattr(self, "resumes", None):
            where_clause = {"tenant_id": str(tenant_id)}
            if filters:
                user_filters = {k: str(v) for k, v in filters.items()}
                where_clause = {"$and": [where_clause, user_filters]}

            try:
                results = self.resumes.query(
                    query_embeddings=[query_embedding],
                    n_results=limit,
                    where=where_clause
                )
                formatted = []
                if results.get("ids") and results["ids"][0]:
                    for i in range(len(results["ids"][0])):
                        dist = results["distances"][0][i] if "distances" in results else 0.0
                        formatted.append({
                            "id": results["ids"][0][i],
                            "document": results["documents"][0][i],
                            "metadata": results["metadatas"][0][i],
                            "score": 1.0 - dist
                        })
                    return formatted
            except Exception as e:
                log.warning("chroma_query_failed_using_local_fallback", error=str(e))

        # 2. Local in-memory search fallback (guarantees tests pass with Chroma decommissioned)
        matching = []
        for r in self._local_index["resumes"].values():
            if r.get("tenant_id") == str(tenant_id):
                score = self.cosine_similarity(query_embedding, r["embedding"])
                matching.append({
                    "id": r["id"],
                    "document": r["document"],
                    "metadata": r["metadata"],
                    "score": round(score, 4)
                })

        matching.sort(key=lambda x: x["score"], reverse=True)
        return matching[:limit]

    # ── 4. PostgreSQL pgvector Native Async Search (Option 1) ─────────────────
    async def search_resumes_pgvector(
        self,
        session: Any,
        tenant_id: str,
        query_text: str,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """
        Direct PostgreSQL pgvector async search with zero ChromaDB dependency.
        Executes native cosine distance query on the Resume model.
        """
        from sqlalchemy import select
        try:
            from backend.db.models import Resume
        except ImportError:
            from db.models import Resume  # pyrefly: ignore[missing-import]  # type: ignore

        query_vector = self.embed_text(query_text)
        try:
            t_uuid = uuid.UUID(str(tenant_id))
        except (ValueError, AttributeError):
            t_uuid = tenant_id

        # Check if connected to real PostgreSQL
        dialect = getattr(getattr(session, "bind", None), "dialect", None)
        is_pg = getattr(dialect, "name", "") == "postgresql"

        if is_pg and hasattr(Resume.embedding, "cosine_distance"):
            stmt = (
                select(Resume)
                .where(Resume.tenant_id == t_uuid, Resume.embedding.isnot(None))
                .order_by(Resume.embedding.cosine_distance(query_vector))
                .limit(limit)
            )
            result = await session.execute(stmt)
            resumes = result.scalars().all()
            return [
                {
                    "id": str(r.id),
                    "candidate_id": str(r.candidate_id),
                    "document": r.raw_text[:2000] if r.raw_text else "",
                    "score": round(self.cosine_similarity(query_vector, r.embedding), 4) if r.embedding else 0.0,
                    "metadata": r.parsed_data or {}
                }
                for r in resumes
            ]

        # Python cosine fallback for SQLite / test environments
        stmt = select(Resume).where(Resume.tenant_id == t_uuid)
        result = await session.execute(stmt)
        resumes = list(result.scalars().all())
        missing_res_indices = [
            idx for idx, r in enumerate(resumes)
            if not r.embedding and r.raw_text
        ]
        batch_embs: Dict[int, List[float]] = {}
        if missing_res_indices:
            texts_to_embed = [resumes[idx].raw_text for idx in missing_res_indices]
            computed_vecs = self.embed_batch(texts_to_embed)
            for idx, vec in zip(missing_res_indices, computed_vecs, strict=True):
                batch_embs[idx] = vec
                resumes[idx].embedding = vec

        ranked = []
        for idx, r in enumerate(resumes):
            emb = r.embedding or batch_embs.get(idx)
            sim = self.cosine_similarity(query_vector, emb) if emb else 0.0
            ranked.append({
                "id": str(r.id),
                "candidate_id": str(r.candidate_id),
                "document": r.raw_text[:2000] if r.raw_text else "",
                "score": round(sim, 4),
                "metadata": r.parsed_data or {}
            })
        ranked.sort(key=lambda x: x["score"], reverse=True)
        return ranked[:limit]

    # ── 5. GDPR Deletion Protocol ────────────────────────────────────────────
    def delete_resumes(
        self,
        tenant_id: str,
        resume_ids: Optional[List[str]] = None,
        candidate_id: Optional[str] = None
    ) -> bool:
        """
        Delete resume vector embeddings from ChromaDB and local stores.
        Strictly scoped to tenant_id and candidate_id / resume_ids.
        """
        # Purge from local store
        if resume_ids:
            for rid in resume_ids:
                if str(rid) in self._local_index["resumes"]:
                    if self._local_index["resumes"][str(rid)].get("tenant_id") == str(tenant_id):
                        del self._local_index["resumes"][str(rid)]

        if candidate_id:
            to_del = [
                k for k, v in self._local_index["resumes"].items()
                if v.get("candidate_id") == str(candidate_id) and v.get("tenant_id") == str(tenant_id)
            ]
            for k in to_del:
                del self._local_index["resumes"][k]

        # Purge from Chroma if connected
        if CHROMA_AVAILABLE and self.client and getattr(self, "resumes", None):
            ids_to_delete = [str(i) for i in (resume_ids or []) if i]
            if ids_to_delete:
                try:
                    self.resumes.delete(ids=ids_to_delete, where={"tenant_id": str(tenant_id)})
                except Exception as e:
                    log.warning("chroma_delete_by_ids_failed", error=str(e), ids=ids_to_delete)
                    raise

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
                    raise

        self._persist_local_index()
        return True

    # ── 6. Jobs Upsert & Search ──────────────────────────────────────────────
    def upsert_job(self, job_id: str, text: str, metadata: Optional[Dict[str, Any]] = None, tenant_id: Optional[str] = None):
        """Add or update a job post in the vector store with tenant isolation metadata"""
        extended_metadata = {k: str(v) for k, v in (metadata or {}).items()}
        if tenant_id:
            extended_metadata["tenant_id"] = str(tenant_id)
        embedding = self.embed_text(text)

        if CHROMA_AVAILABLE and self.client and getattr(self, "jobs", None):
            try:
                self.jobs.upsert(
                    ids=[str(job_id)],
                    embeddings=[embedding],
                    documents=[text[:2000]],
                    metadatas=[extended_metadata]
                )
            except Exception as e:
                log.warning("chroma_job_upsert_failed", error=str(e))

        self._local_index["jobs"][str(job_id)] = {
            "id": str(job_id),
            "tenant_id": str(tenant_id) if tenant_id else None,
            "document": text[:2000],
            "metadata": extended_metadata,
            "embedding": embedding
        }
        self._persist_local_index()

    def search_jobs(self, query_text: str, limit: int = 10, tenant_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """Find most similar jobs to a candidate profile / text, optionally scoped to tenant_id"""
        query_embedding = self.embed_text(query_text)

        if CHROMA_AVAILABLE and self.client and getattr(self, "jobs", None):
            query_kwargs: Dict[str, Any] = {
                "query_embeddings": [query_embedding],
                "n_results": limit,
            }
            if tenant_id:
                query_kwargs["where"] = {"tenant_id": str(tenant_id)}
            try:
                results = self.jobs.query(**query_kwargs)
                formatted = []
                if results.get("ids") and results["ids"][0]:
                    for i in range(len(results["ids"][0])):
                        dist = results["distances"][0][i] if "distances" in results else 0.0
                        formatted.append({
                            "id": results["ids"][0][i],
                            "document": results["documents"][0][i],
                            "metadata": results["metadatas"][0][i],
                            "score": 1.0 - dist
                        })
                    return formatted
            except Exception as e:
                log.warning("chroma_job_query_failed", error=str(e))

        matching = []
        for j in self._local_index["jobs"].values():
            if not tenant_id or j.get("tenant_id") == str(tenant_id):
                score = self.cosine_similarity(query_embedding, j["embedding"])
                matching.append({
                    "id": j["id"],
                    "document": j["document"],
                    "metadata": j["metadata"],
                    "score": round(score, 4)
                })

        matching.sort(key=lambda x: x["score"], reverse=True)
        return matching[:limit]


# Singleton instance
vector_store = VectorStore()
