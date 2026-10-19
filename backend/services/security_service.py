"""
DVT Talent AI — Security & Compliance Utilities
Handles PII encryption and structured audit logging.
"""
import base64
import hashlib
from cryptography.fernet import Fernet
try:
    from config import settings
    from db.models import AuditLog, AsyncSessionLocal
except ImportError:
    from config import settings
    from db.models import AuditLog, AsyncSessionLocal
import uuid
import structlog

log = structlog.get_logger()

# Derive a valid 32-byte Fernet key from the secret_key
def get_fernet_key(secret: str) -> bytes:
    key = hashlib.sha256(secret.encode()).digest()
    return base64.urlsafe_b64encode(key)

CIPHER = Fernet(get_fernet_key(settings.secret_key)) if settings.secret_key else None

def encrypt_pii(text: str) -> str:
    """Encrypt sensitive data like emails and phone numbers"""
    if not text or not CIPHER: return text
    return CIPHER.encrypt(text.encode()).decode()

def decrypt_pii(token: str) -> str:
    """Decrypt sensitive data for authorized users"""
    if not token or not CIPHER: return token
    try:
        return CIPHER.decrypt(token.encode()).decode()
    except Exception:
        return token

async def log_audit_event(
    tenant_id: uuid.UUID,
    user_id: uuid.UUID,
    action: str,
    entity_type: str,
    entity_id: uuid.UUID,
    metadata: dict = None
):
    """Log a security event for compliance (SOC2/GDPR)"""
    async with AsyncSessionLocal() as session:
        event = AuditLog(
            tenant_id=tenant_id,
            user_id=user_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            meta_data=metadata or {}
        )
        session.add(event)
        await session.commit()
    log.info("audit_event_logged", action=action, user_id=str(user_id))
