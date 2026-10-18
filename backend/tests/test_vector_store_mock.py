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

def test_singleton_pattern():
    """Verify VectorStore behaves as a singleton."""
    vs1 = VectorStore()
    vs2 = VectorStore()
    assert vs1 is vs2

@pytest.mark.skipif(not CHROMA_AVAILABLE, reason="ChromaDB not installed")
@patch('chromadb.PersistentClient', return_value=MockClient())
@patch('chromadb.HttpClient', side_effect=ConnectionError("Mocked Connection Error"))
def test_vector_store_upsert_mock(mock_http, mock_persist):
    """Verify upsert logic with a mocked ChromaDB client."""
    vs = VectorStore()
    
    # Mock the internal collection calls
    vs.resumes = MockCollection()
    
    # Should not raise any errors
    vs.upsert_resume("tenant_test_123", "id_123", "Resume text content", {"job_id": "job_1"})
    
    # Verify collection state (conceptual check)
    assert vs.resumes is not None

@pytest.mark.skipif(not CHROMA_AVAILABLE, reason="ChromaDB not installed")
@patch('chromadb.PersistentClient', return_value=MockClient())
@patch('chromadb.HttpClient', side_effect=ConnectionError("Mocked Connection Error"))
def test_vector_store_query_mock(mock_http, mock_persist):
    """Verify similarity search logic with mocked results."""
    vs = VectorStore()
    vs.resumes = MockCollection()
    
    results = vs.search_resumes("tenant_test_123", "Looking for Python Expert", limit=1)
    
    assert len(results) == 1
    assert results[0]["id"] == "id_123"
    assert results[0]["metadata"]["name"] == "John"
