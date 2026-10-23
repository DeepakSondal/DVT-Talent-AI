"""
DVT Talent AI — Vector Store Mock Tests
Tests the VectorStore logic by mocking the ChromaDB PersistentClient.
"""
import pytest
from db.vector_store import CHROMA_AVAILABLE
from unittest.mock import MagicMock, patch

from db.vector_store import VectorStore

class MockCollection:
    def upsert(self, **kwargs):
        pass
    def query(self, **kwargs):
        return {
            "ids": [["id_123"]], 
            "distances": [[0.12]], 
            "metadatas": [[{"name": "John"}]],
            "documents": [["Mock Document"]]
        }

class MockClient:
    def get_or_create_collection(self, **kwargs):
        return MockCollection()

import sys

# Ensure chromadb can be patched even if package is not installed on host
if "chromadb" not in sys.modules:
    mock_chroma_mod = MagicMock()
    mock_chroma_mod.config = MagicMock()
    sys.modules["chromadb"] = mock_chroma_mod
    sys.modules["chromadb.config"] = mock_chroma_mod.config

def test_singleton_pattern():
    """Verify VectorStore behaves as a singleton."""
    vs1 = VectorStore()
    vs2 = VectorStore()
    assert vs1 is vs2

@patch('chromadb.PersistentClient', return_value=MockClient())
@patch('chromadb.HttpClient', side_effect=ConnectionError("Mocked Connection Error"))
def test_vector_store_upsert_mock(mock_http, mock_persist):
    """Verify upsert logic with a mocked ChromaDB client."""
    vs = VectorStore()
    vs.client = MockClient()
    vs.resumes = MockCollection()
    
    # Temporarily ensure CHROMA_AVAILABLE flag is true for this test
    with patch('db.vector_store.CHROMA_AVAILABLE', True):
        # Should not raise any errors
        vs.upsert_resume("tenant_test_123", "id_123", "Resume text content", {"job_id": "job_1"})
    
    assert vs.resumes is not None

@patch('chromadb.PersistentClient', return_value=MockClient())
@patch('chromadb.HttpClient', side_effect=ConnectionError("Mocked Connection Error"))
def test_vector_store_query_mock(mock_http, mock_persist):
    """Verify similarity search logic with mocked results."""
    vs = VectorStore()
    vs.client = MockClient()
    vs.resumes = MockCollection()
    
    with patch('db.vector_store.CHROMA_AVAILABLE', True):
        results = vs.search_resumes("tenant_test_123", "Looking for Python Expert", limit=1)
    
    assert len(results) == 1
    assert results[0]["id"] == "id_123"
    assert results[0]["metadata"]["name"] == "John"
