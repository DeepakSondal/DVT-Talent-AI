import time
import json
import uuid
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from db.models import AsyncSessionLocal, AuditLog
import structlog

log = structlog.get_logger(__name__)

# List of sensitive root paths to log specifically (read or write)
SENSITIVE_PATHS = ["/candidates", "/users", "/auth/login", "/auth/sso", "/candidate-portal", "/compliance", "/billing"]

class AuditLogMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # 1. Capture Request Metadata
        start_time = time.time()
        
        # We need to process the request first to see if it succeeded and to get user info
        # User info is often added to request.state by AuthMiddleware
        response: Response = await call_next(request)
        
        # 2. Determine Action
        path = request.url.path
        method = request.method
        
        # Strip API version prefix for clean pattern matching and entity categorization
        normalized_path = path[7:] if path.startswith("/api/v1") else path
        
        # Only log mutations or sensitive views
        is_sensitive = any(normalized_path.startswith(p) for p in SENSITIVE_PATHS)
        is_mutation = method in ["POST", "PUT", "PATCH", "DELETE"]
        
        if is_sensitive or is_mutation:
            try:
                # 3. Extract User & Tenant (Assumes AuthMiddleware has run)
                user = getattr(request.state, "user", None)
                user_id = user.id if user else None
                tenant_id = getattr(user, "tenant_id", None) if user else None
                
                # 4. Determine Severity & Status
                status = "SUCCESS" if response.status_code < 400 else "FAILURE"
                severity = "INFO"
                
                if response.status_code >= 500:
                    severity = "CRITICAL"
                elif response.status_code in [401, 403]:
                    severity = "WARNING"
                elif is_mutation and status == "FAILURE":
                    severity = "WARNING"

                # 5. Save Audit Log
                async with AsyncSessionLocal() as session:
                    audit_entry = AuditLog(
                        tenant_id=tenant_id,
                        user_id=user_id,
                        action=f"{method} {path}",
                        entity_type=normalized_path.strip("/").split("/")[0] if normalized_path.strip("/") else "root",
                        severity=severity,
                        status=status,
                        ip_address=request.client.host if request.client else "unknown",
                        user_agent=request.headers.get("user-agent", "unknown"),
                        meta_data={
                            "status_code": response.status_code,
                            "query_params": dict(request.query_params),
                            "duration_ms": int((time.time() - start_time) * 1000)
                        }
                    )
                    session.add(audit_entry)
                    await session.commit()
            except Exception as e:
                # Never block the actual request due to audit logging failure
                log.error("audit_log_failed", error=str(e))
        
        return response
