"""
DVT Talent AI — Pluggable Storage Service
Abstracts storage backend between Local Filesystem (development/testing)
and S3-compatible Object Storage (AWS S3, MinIO, Cloudflare R2 in production).
"""
import os
import re
from pathlib import Path
from typing import Optional
from abc import ABC, abstractmethod
import structlog

from config import settings

logger = structlog.get_logger(__name__)


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
        # Sanitize key to prevent path traversal
        clean_key = re.sub(r"[\\/]+", "/", key).strip("/")
        parts = [p for p in clean_key.split("/") if p]
        if ".." in parts:
            raise ValueError(f"Path traversal detected: {key}")
        target = (self.upload_dir / Path(*parts)).resolve()
        if not target.is_relative_to(self.upload_dir.resolve()):
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
        clean_key = re.sub(r"[\\/]+", "/", key).strip("/")
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
            import boto3
            self._s3_client = boto3.client(
                "s3",
                endpoint_url=self.endpoint_url,
                region_name=self.region_name,
                aws_access_key_id=self.access_key_id,
                aws_secret_access_key=self.secret_access_key,
            )
        return self._s3_client

    def save_file(self, key: str, data: bytes, content_type: Optional[str] = None) -> str:
        client = self._get_client()
        extra_args = {}
        if content_type:
            extra_args["ContentType"] = content_type
        clean_key = key.lstrip("/")
        client.put_object(Bucket=self.bucket_name, Key=clean_key, Body=data, **extra_args)
        logger.info("s3_file_saved", bucket=self.bucket_name, key=clean_key, size=len(data))
        return f"s3://{self.bucket_name}/{clean_key}"

    def read_file(self, key: str) -> Optional[bytes]:
        client = self._get_client()
        clean_key = key.replace(f"s3://{self.bucket_name}/", "").lstrip("/")
        try:
            resp = client.get_object(Bucket=self.bucket_name, Key=clean_key)
            return resp["Body"].read()
        except Exception as e:
            logger.warning("s3_read_failed", key=clean_key, error=str(e))
            return None

    def delete_file(self, key: str) -> bool:
        client = self._get_client()
        clean_key = key.replace(f"s3://{self.bucket_name}/", "").lstrip("/")
        try:
            client.delete_object(Bucket=self.bucket_name, Key=clean_key)
            return True
        except Exception as e:
            logger.warning("s3_delete_failed", key=clean_key, error=str(e))
            return False

    def get_download_url(self, key: str, expires_in: int = 3600) -> str:
        client = self._get_client()
        clean_key = key.replace(f"s3://{self.bucket_name}/", "").lstrip("/")
        try:
            return client.generate_presigned_url(
                "get_object",
                Params={"Bucket": self.bucket_name, "Key": clean_key},
                ExpiresIn=expires_in,
            )
        except Exception:
            return f"s3://{self.bucket_name}/{clean_key}"


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
