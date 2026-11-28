"""Unit tests for Cloudflare R2 S3-compatible resume storage and GDPR deletion."""
from unittest.mock import MagicMock, patch

from config import settings
from services.r2_storage import (
    delete_r2_object,
    get_r2_object,
    is_r2_configured,
    parse_r2_uri,
    put_r2_object,
)
from services.resume_parser import ResumeParserService


def test_parse_r2_uri_validates_and_rejects_traversal():
    assert parse_r2_uri("r2://dvt-talent-resumes/resumes/abc_123.pdf") == (
        "dvt-talent-resumes",
        "resumes/abc_123.pdf",
    )
    assert parse_r2_uri("r2://bucket/../etc/passwd") is None
    assert parse_r2_uri("/local/path/resume.pdf") is None
    assert parse_r2_uri("") is None


def test_r2_put_get_delete_with_sigv4_headers():
    with (
        patch.object(settings, "r2_bucket_name", "dvt-talent-resumes"),
        patch.object(settings, "r2_endpoint_url", "https://acct123.r2.cloudflarestorage.com"),
        patch.object(settings, "r2_access_key_id", "test-access-key"),
        patch.object(settings, "r2_secret_access_key", "test-secret-key"),
    ):
        assert is_r2_configured() is True

        mock_client = MagicMock()
        mock_client.__enter__.return_value = mock_client
        mock_client.__exit__.return_value = False
        mock_client.put.return_value = MagicMock(status_code=200)
        mock_client.get.return_value = MagicMock(status_code=200, content=b"%PDF-1.4 sample")
        mock_client.delete.return_value = MagicMock(status_code=204)

        with patch("services.r2_storage.httpx.Client", return_value=mock_client):
            uri = put_r2_object("resumes/c1_r1_cv.pdf", b"%PDF-1.4 sample", "application/pdf")
            assert uri == "r2://dvt-talent-resumes/resumes/c1_r1_cv.pdf"
            put_headers = mock_client.put.call_args.kwargs["headers"]
            assert put_headers["Authorization"].startswith("AWS4-HMAC-SHA256 Credential=test-access-key/")
            assert "x-amz-date" in put_headers

            data = get_r2_object(uri)
            assert data == b"%PDF-1.4 sample"

            assert delete_r2_object(uri) is True


def test_resume_parser_uses_r2_when_configured_and_deletes_cleanly():
    with (
        patch("services.r2_storage.is_r2_configured", return_value=True),
        patch("services.r2_storage.put_r2_object", return_value="r2://dvt-talent-resumes/resumes/c1_r1_cv.pdf") as mock_put,
        patch("services.r2_storage.get_r2_object", return_value=b"resume-bytes"),
        patch("services.r2_storage.delete_r2_object", return_value=True) as mock_del,
    ):
        stored = ResumeParserService.save_resume_file("c1", "r1", "../../evil/cv.pdf", b"resume-bytes")
        assert stored == "r2://dvt-talent-resumes/resumes/c1_r1_cv.pdf"
        assert mock_put.called
        assert ResumeParserService.read_resume_bytes(stored) == b"resume-bytes"
        assert ResumeParserService.delete_resume_file(stored) is True
        mock_del.assert_called_once_with(stored)
