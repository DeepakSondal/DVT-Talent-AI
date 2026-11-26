"""
DVT Talent AI — Pluggable Storage Service
Abstracts storage backend between Local Filesystem (development/testing)
and S3-compatible Object Storage (AWS S3, MinIO, Cloudflare R2 in production).
"""
import os
import re
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Optional

import structlog

logger = structlog.get_logger(__name__)


def _normalize_and_validate_key(key: str, bucket_name: Optional[str] = None) -> str:
    """Validate storage key against empty, traversal, and null-byte inputs."""
    if not isinstance(key, str) or "\x00" in key:
        raise ValueError(f"Invalid storage key: {key!r}")

    raw = key
    if bucket_name:
        s3_prefix = f"s3://{bucket_name}/"
        if raw.startswith(s3_prefix):
            raw = raw[len(s3_prefix):]

    clean_key = re.sub(r"[\\/]+", "/", raw).strip("/")
    if not clean_key or not clean_key.strip():
        raise ValueError(f"Empty storage key is not permitted: {key!r}")

    parts = [p for p in clean_key.split("/") if p]
    if not parts or any(p in (".", "..") or not p.strip() for p in parts):
        raise ValueError(f"Path traversal detected: {key!r}")

    return "/".join(parts)


class BaseStorageDriver(ABC):
    @abstractmethod
    def save_file(self, key: str, data: bytes, content_type: Optional[str] = None) -> str:
        """Persist file and return its resource path or URL."""
        pass

    @abstractmethod
    def read_file(self, key: str) -> Optional[bytes]:
        """Read file bytes by key/path."""
        pass

    @abstractmethod
    def delete_file(self, key: str) -> bool:
        """Delete file by key/path."""
        pass

    @abstractmethod
    def get_download_url(self, key: str, expires_in: int = 3600) -> str:
        """Generate download URL (presigned URL for S3 or API route for local)."""
        pass


class LocalStorageDriver(BaseStorageDriver):
    def __init__(self, base_dir: Optional[Path] = None):
        if base_dir:
            self.upload_dir = base_dir
        else:
            root_dir = Path(__file__).resolve().parent.parent
            self.upload_dir = root_dir / "uploads"
        self.upload_dir.mkdir(parents=True, exist_ok=True)

    def _resolve_safe_path(self, key: str) -> Path:
        clean_key = _normalize_and_validate_key(key)
        parts = clean_key.split("/")
        root_resolved = self.upload_dir.resolve()
        target = (root_resolved / Path(*parts)).resolve()
        if target == root_resolved or not target.is_relative_to(root_resolved):
            raise ValueError(f"Path traversal detected: {key}")
        return target

    def save_file(self, key: str, data: bytes, content_type: Optional[str] = None) -> str:
        target = self._resolve_safe_path(key)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
        logger.info("local_storage_file_saved", path=str(target), size=len(data))
        return str(target)

    def read_file(self, key: str) -> Optional[bytes]:
        target = self._resolve_safe_path(key)
        if target.is_file():
            return target.read_bytes()
        return None

    def delete_file(self, key: str) -> bool:
        try:
            target = self._resolve_safe_path(key)
            if target.is_file():
                target.unlink()
                return True
        except Exception as e:
            logger.warning("local_storage_delete_failed", key=key, error=str(e))
        return False

    def get_download_url(self, key: str, expires_in: int = 3600) -> str:
        # In local development, routes through local download endpoint
        clean_key = _normalize_and_validate_key(key)
        return f"/api/v1/storage/{clean_key}"


class S3StorageDriver(BaseStorageDriver):
    def __init__(
        self,
        bucket_name: str,
        endpoint_url: Optional[str] = None,
        region_name: str = "us-east-1",
        access_key_id: Optional[str] = None,
        secret_access_key: Optional[str] = None,
    ):
        self.bucket_name = bucket_name
        self.endpoint_url = endpoint_url
        self.region_name = region_name
        self.access_key_id = access_key_id
        self.secret_access_key = secret_access_key
        self._s3_client = None

    def _get_client(self):
        if self._s3_client is None:
            import boto3  # pyrefly: ignore[missing-import]
            self._s3_client = boto3.client(
                "s3",
                endpoint_url=self.endpoint_url,
                region_name=self.region_name,
                aws_access_key_id=self.access_key_id,
                aws_secret_access_key=self.secret_access_key,
            )
        return self._s3_client

    def _sanitize_s3_key(self, key: str) -> str:
        return _normalize_and_validate_key(key, bucket_name=self.bucket_name)

    def save_file(self, key: str, data: bytes, content_type: Optional[str] = None) -> str:
        clean_key = self._sanitize_s3_key(key)
        client = self._get_client()
        extra_args = {"ServerSideEncryption": "aws:kms"}
        if content_type:
            extra_args["ContentType"] = content_type
        client.put_object(Bucket=self.bucket_name, Key=clean_key, Body=data, **extra_args)
        logger.info("s3_file_saved", bucket=self.bucket_name, key=clean_key, size=len(data))
        return f"s3://{self.bucket_name}/{clean_key}"

    def read_file(self, key: str) -> Optional[bytes]:
        clean_key = self._sanitize_s3_key(key)
        client = self._get_client()
        try:
            resp = client.get_object(Bucket=self.bucket_name, Key=clean_key)
            return resp["Body"].read()
        except Exception as e:
            logger.warning("s3_read_failed", key=clean_key, error=str(e))
            return None

    def delete_file(self, key: str) -> bool:
        clean_key = self._sanitize_s3_key(key)
        client = self._get_client()
        try:
            client.delete_object(Bucket=self.bucket_name, Key=clean_key)
            return True
        except Exception as e:
            logger.warning("s3_delete_failed", key=clean_key, error=str(e))
            return False

    def get_download_url(self, key: str, expires_in: int = 3600) -> str:
        clean_key = self._sanitize_s3_key(key)
        client = self._get_client()
        try:
            url = client.generate_presigned_url(
                "get_object",
                Params={"Bucket": self.bucket_name, "Key": clean_key},
                ExpiresIn=expires_in,
            )
            if not url:
                raise RuntimeError("Empty presigned URL returned by S3 client")
            return url
        except Exception as exc:
            logger.error("s3_presign_failed", bucket=self.bucket_name, key=clean_key, error=str(exc))
            raise RuntimeError(f"Failed to generate presigned download URL for '{clean_key}'") from exc


_storage_driver: Optional[BaseStorageDriver] = None


def get_storage_driver() -> BaseStorageDriver:
    """Factory returning active storage driver based on environment configuration."""
    global _storage_driver
    if _storage_driver is None:
        bucket = os.getenv("S3_BUCKET_NAME")
        if bucket:
            _storage_driver = S3StorageDriver(
                bucket_name=bucket,
                endpoint_url=os.getenv("S3_ENDPOINT_URL"),
                region_name=os.getenv("S3_REGION", "us-east-1"),
                access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
                secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
            )
        else:
            _storage_driver = LocalStorageDriver()
    return _storage_driver
