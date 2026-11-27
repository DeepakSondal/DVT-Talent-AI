"""
DVT Talent AI — Lightweight Cloudflare R2 (S3-compatible) Object Storage Driver
Uses AWS Signature Version 4 over HTTPS via httpx (zero boto3 dependency).
Falls back transparently to local disk when R2 environment variables are unset.
"""
import hashlib
import hmac
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import quote, urlparse

import httpx
import structlog

from config import settings

log = structlog.get_logger(__name__)

R2_URI_PREFIX = "r2://"


def is_r2_configured() -> bool:
    return bool(
        settings.r2_bucket_name
        and settings.r2_endpoint_url
        and settings.r2_access_key_id
        and settings.r2_secret_access_key
    )


def _sign(key: bytes, msg: str) -> bytes:
    return hmac.new(key, msg.encode("utf-8"), hashlib.sha256).digest()


def _sigv4_headers(
    method: str,
    endpoint_url: str,
    bucket: str,
    object_key: str,
    payload: bytes,
    access_key: str,
    secret_key: str,
    content_type: Optional[str] = None,
) -> tuple[str, dict[str, str]]:
    parsed = urlparse(endpoint_url.rstrip("/"))
    host = parsed.netloc
    encoded_key = "/".join(quote(part, safe="-_.~") for part in object_key.lstrip("/").split("/"))
    canonical_uri = f"/{quote(bucket, safe='-_.~')}/{encoded_key}"
    full_url = f"{parsed.scheme}://{host}{canonical_uri}"

    now = datetime.now(timezone.utc)
    amz_date = now.strftime("%Y%m%dT%H%M%SZ")
    date_stamp = now.strftime("%Y%m%d")
    region = "auto"
    service = "s3"

    payload_hash = hashlib.sha256(payload).hexdigest()
    headers_map: dict[str, str] = {
        "host": host,
        "x-amz-content-sha256": payload_hash,
        "x-amz-date": amz_date,
    }
    if content_type:
        headers_map["content-type"] = content_type

    sorted_keys = sorted(headers_map.keys())
    canonical_headers = "".join(f"{k}:{headers_map[k]}\n" for k in sorted_keys)
    signed_headers = ";".join(sorted_keys)

    canonical_request = "\n".join(
        [method.upper(), canonical_uri, "", canonical_headers, signed_headers, payload_hash]
    )
    credential_scope = f"{date_stamp}/{region}/{service}/aws4_request"
    string_to_sign = "\n".join(
        [
            "AWS4-HMAC-SHA256",
            amz_date,
            credential_scope,
            hashlib.sha256(canonical_request.encode("utf-8")).hexdigest(),
        ]
    )

    k_date = _sign(("AWS4" + secret_key).encode("utf-8"), date_stamp)
    k_region = _sign(k_date, region)
    k_service = _sign(k_region, service)
    k_signing = _sign(k_service, "aws4_request")
    signature = hmac.new(k_signing, string_to_sign.encode("utf-8"), hashlib.sha256).hexdigest()

    auth_header = (
        f"AWS4-HMAC-SHA256 Credential={access_key}/{credential_scope}, "
        f"SignedHeaders={signed_headers}, Signature={signature}"
    )

    req_headers = {
        "x-amz-content-sha256": payload_hash,
        "x-amz-date": amz_date,
        "Authorization": auth_header,
    }
    if content_type:
        req_headers["Content-Type"] = content_type
    return full_url, req_headers


def put_r2_object(object_key: str, content: bytes, content_type: str = "application/octet-stream") -> str:
    """Upload bytes to Cloudflare R2 and return canonical `r2://<bucket>/<key>` URI."""
    url, headers = _sigv4_headers(
        method="PUT",
        endpoint_url=settings.r2_endpoint_url,
        bucket=settings.r2_bucket_name,
        object_key=object_key,
        payload=content,
        access_key=settings.r2_access_key_id,
        secret_key=settings.r2_secret_access_key,
        content_type=content_type,
    )
    with httpx.Client(timeout=20.0) as client:
        resp = client.put(url, content=content, headers=headers)
        if resp.status_code not in (200, 201):
            raise RuntimeError(f"R2 upload failed with HTTP {resp.status_code}")
    return f"{R2_URI_PREFIX}{settings.r2_bucket_name}/{object_key.lstrip('/')}"


def parse_r2_uri(uri: str) -> Optional[tuple[str, str]]:
    if not uri or not uri.startswith(R2_URI_PREFIX):
        return None
    rest = uri[len(R2_URI_PREFIX):].strip("/")
    if "/" not in rest:
        return None
    bucket, key = rest.split("/", 1)
    if not bucket or not key or ".." in key or "\x00" in key:
        return None
    return bucket, key


def get_r2_object(uri: str) -> Optional[bytes]:
    """Download bytes from an `r2://<bucket>/<key>` URI."""
    parsed = parse_r2_uri(uri)
    if not parsed or not is_r2_configured():
        return None
    bucket, key = parsed
    url, headers = _sigv4_headers(
        method="GET",
        endpoint_url=settings.r2_endpoint_url,
        bucket=bucket,
        object_key=key,
        payload=b"",
        access_key=settings.r2_access_key_id,
        secret_key=settings.r2_secret_access_key,
    )
    with httpx.Client(timeout=20.0) as client:
        resp = client.get(url, headers=headers)
        if resp.status_code == 200:
            return resp.content
    return None


def delete_r2_object(uri: str) -> bool:
    """Delete an object from Cloudflare R2 (idempotent — 204/404 treated as deleted)."""
    parsed = parse_r2_uri(uri)
    if not parsed or not is_r2_configured():
        return False
    bucket, key = parsed
    url, headers = _sigv4_headers(
        method="DELETE",
        endpoint_url=settings.r2_endpoint_url,
        bucket=bucket,
        object_key=key,
        payload=b"",
        access_key=settings.r2_access_key_id,
        secret_key=settings.r2_secret_access_key,
    )
    with httpx.Client(timeout=15.0) as client:
        resp = client.delete(url, headers=headers)
        return resp.status_code in (200, 204, 404)
