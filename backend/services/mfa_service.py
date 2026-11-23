"""RFC 6238 TOTP Multi-Factor Authentication helpers and encrypted secret storage."""

import base64
import hashlib
import hmac
import secrets
import struct
import time
import urllib.parse
from typing import Optional

from cryptography.fernet import Fernet, InvalidToken

from config import settings
from services.security_service import get_fernet_key


def _get_cipher() -> Fernet:
    """Derives the active Fernet cipher from current settings.secret_key."""
    secret = settings.secret_key or ""
    if not secret:
        raise RuntimeError("SECRET_KEY must be configured for MFA secret encryption")
    return Fernet(get_fernet_key(secret))


def generate_totp_secret() -> str:
    """Generates a 160-bit Base32 TOTP shared secret (RFC 4226 / RFC 6238)."""
    return base64.b32encode(secrets.token_bytes(20)).decode("ascii").rstrip("=")


def encrypt_mfa_secret(secret: str) -> str:
    """Encrypts a plaintext Base32 TOTP secret using Fernet symmetric encryption."""
    return _get_cipher().encrypt(secret.encode("utf-8")).decode("utf-8")


def decrypt_mfa_secret(encrypted_secret: Optional[str]) -> Optional[str]:
    """Decrypts an encrypted TOTP secret, failing closed on invalid or missing ciphertexts."""
    if not encrypted_secret:
        return None
    try:
        return _get_cipher().decrypt(encrypted_secret.encode("utf-8")).decode("utf-8")
    except (InvalidToken, ValueError, RuntimeError):
        return None


def build_otpauth_uri(email: str, secret: str, issuer: str = "DVT Talent AI") -> str:
    """Builds a standard otpauth:// URI compatible with Google Authenticator / 1Password."""
    label = urllib.parse.quote(f"{issuer}:{email.strip().lower()}", safe=":")
    query = urllib.parse.urlencode(
        {
            "secret": secret,
            "issuer": issuer,
            "algorithm": "SHA1",
            "digits": "6",
            "period": "30",
        }
    )
    return f"otpauth://totp/{label}?{query}"


def _decode_base32_secret(secret: str) -> bytes:
    cleaned = "".join(secret.strip().upper().split())
    padding = "=" * ((8 - len(cleaned) % 8) % 8)
    return base64.b32decode(cleaned + padding, casefold=True)


def compute_totp_for_step(secret: str, counter: int, digits: int = 6) -> str:
    """Computes an RFC 6238 HMAC-SHA1 TOTP code for a given 30-second counter step."""
    key = _decode_base32_secret(secret)
    msg = struct.pack(">Q", counter)
    digest = hmac.new(key, msg, hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    binary = struct.unpack(">I", digest[offset : offset + 4])[0] & 0x7FFFFFFF
    return str(binary % (10**digits)).zfill(digits)


def verify_totp_code(
    secret: str,
    code: str,
    window: int = 1,
    for_time: Optional[float] = None,
    step_seconds: int = 30,
) -> Optional[int]:
    """Verifies a 6-digit TOTP code across [-window, +window] steps using constant-time comparison.

    Returns the matched integer time-step counter on success, or None on failure.
    """
    clean_code = "".join(ch for ch in (code or "").strip() if ch.isdigit())
    if len(clean_code) != 6:
        return None

    try:
        _decode_base32_secret(secret)
    except Exception:
        return None

    now = time.time() if for_time is None else for_time
    current_step = int(now // step_seconds)
    for offset in range(-window, window + 1):
        candidate_step = current_step + offset
        expected = compute_totp_for_step(secret, candidate_step)
        if hmac.compare_digest(expected, clean_code):
            return candidate_step
    return None
