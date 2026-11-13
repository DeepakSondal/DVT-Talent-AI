import asyncio
import json
import time
from typing import Dict, List, Set

import redis.asyncio as redis
import structlog
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status
from jose import JWTError, jwt

from config import settings
from services.redis_service import is_token_revoked

log = structlog.get_logger(__name__)
router = APIRouter()

MAX_WS_CONNECTIONS_PER_USER = 5
MAX_WS_MESSAGES_PER_10S = 20


class ConnectionManager:
    def __init__(self, max_connections_per_user: int = MAX_WS_CONNECTIONS_PER_USER):
        self.active_connections: Dict[str, Set[WebSocket]] = {}   # user_id → Set[WebSocket]
        self.user_tenants: Dict[str, str] = {}                     # user_id → tenant_id
        self.max_connections_per_user = max_connections_per_user
        self.redis_client = redis.from_url(settings.redis_url)
        self.pubsub_task = None

    async def connect(self, websocket: WebSocket, user_id: str, tenant_id: str) -> bool:
        existing = self.active_connections.get(user_id, set())
        if len(existing) >= self.max_connections_per_user:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Maximum concurrent WebSocket connections exceeded")
            return False

        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = set()
        self.active_connections[user_id].add(websocket)
        self.user_tenants[user_id] = tenant_id

        # Start resilient Redis listener if not running
        if self.pubsub_task is None or self.pubsub_task.done():
            self.pubsub_task = asyncio.create_task(self._redis_listener())
        return True

    def disconnect(self, websocket: WebSocket, user_id: str):
        if user_id in self.active_connections:
            self.active_connections[user_id].discard(websocket)
            if not self.active_connections[user_id]:
                self.active_connections.pop(user_id, None)
                self.user_tenants.pop(user_id, None)

    async def _redis_listener(self):
        """Resilient background listener for Redis tenant signals with auto-reconnect."""
        backoff = 1
        while True:
            try:
                pubsub = self.redis_client.pubsub()
                await pubsub.psubscribe("dvt_signals:*")
                backoff = 1  # Reset on successful subscription
                async for message in pubsub.listen():
                    if message["type"] == "pmessage":
                        try:
                            channel: str = message["channel"].decode() if isinstance(message["channel"], bytes) else message["channel"]
                            tenant_id = channel.split(":", 1)[1] if ":" in channel else None
                            data = json.loads(message["data"])
                            await self.broadcast_to_tenant(data, tenant_id)
                        except Exception as exc:
                            log.debug("websocket_pubsub_message_ignored", error=str(exc))
            except asyncio.CancelledError:
                break
            except Exception:
                await asyncio.sleep(min(backoff, 30))
                backoff *= 2

    async def send_to_user(self, user_id: str, message: dict):
        sockets = list(self.active_connections.get(user_id, set()))
        payload = json.dumps(message)
        for ws in sockets:
            try:
                await ws.send_text(payload)
            except Exception:
                self.disconnect(ws, user_id)

    async def broadcast_to_tenant(self, message: dict, tenant_id: str | None):
        """Send to all WebSocket connections belonging to a specific tenant."""
        if not tenant_id or tenant_id == "default":
            return
        payload = json.dumps(message)
        for uid, sockets in list(self.active_connections.items()):
            if self.user_tenants.get(uid) != tenant_id:
                continue
            for ws in list(sockets):
                try:
                    await ws.send_text(payload)
                except Exception:
                    self.disconnect(ws, uid)


manager = ConnectionManager()


def _extract_ws_token(websocket: WebSocket) -> str | None:
    """Extract JWT from httpOnly cookie or Authorization header; never from URL query params."""
    cookie_token = websocket.cookies.get("dvt_token")
    if cookie_token:
        return cookie_token
    auth_header = websocket.headers.get("authorization", "")
    if auth_header.lower().startswith("bearer "):
        return auth_header[7:].strip() or None
    return None


def _is_allowed_ws_origin(websocket: WebSocket) -> bool:
    """Validate WebSocket Origin header against configured CORS origins to prevent CSWSH."""
    origin = (websocket.headers.get("origin") or "").strip().rstrip("/")
    if not origin:
        # Browsers always send Origin on WebSocket upgrades; reject missing Origin for cookie auth in prod.
        return not (settings.is_production and websocket.cookies.get("dvt_token"))
    allowed = {o.strip().rstrip("/") for o in settings.cors_origins if o.strip()}
    if not settings.is_production and "*" in allowed:
        return True
    return origin in allowed


async def _verify_ws_token(token: str | None) -> tuple[str, str] | tuple[None, None]:
    """Validate JWT and return (user_id, tenant_id), or (None, None) if invalid or revoked."""
    if not token:
        return None, None
    if await is_token_revoked(token):
        return None, None
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        user_id: str | None = payload.get("sub")
        tenant_id: str = payload.get("tenant_id", "")
        if not user_id or payload.get("type") != "access":
            return None, None
        if not tenant_id or tenant_id == "default":
            return None, None
        return user_id, tenant_id
    except JWTError:
        return None, None


@router.websocket("/pipeline-events")
async def pipeline_events_endpoint(websocket: WebSocket):
    """
    Dedicated endpoint for real-time AI pipeline activity notifications.
    Authenticates via httpOnly dvt_token cookie or Authorization header (no query-string tokens).
    """
    if "token" in websocket.query_params:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Query token authentication is disabled")
        return

    if not _is_allowed_ws_origin(websocket):
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Origin not allowed")
        return

    token = _extract_ws_token(websocket)
    user_id, tenant_id = await _verify_ws_token(token)
    if not user_id or not tenant_id:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    connected = await manager.connect(websocket, user_id, tenant_id)
    if not connected:
        return

    frame_timestamps: List[float] = []
    try:
        while True:
            # Keep connection alive, listen for client pings with frame rate limiting
            data = await websocket.receive_text()
            now = time.monotonic()
            frame_timestamps = [ts for ts in frame_timestamps if (now - ts) < 10.0]
            frame_timestamps.append(now)
            if len(frame_timestamps) > MAX_WS_MESSAGES_PER_10S:
                await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Message rate limit exceeded")
                manager.disconnect(websocket, user_id)
                return

            if data == "ping":
                await websocket.send_text('{"type":"pong"}')
    except WebSocketDisconnect:
        manager.disconnect(websocket, user_id)
