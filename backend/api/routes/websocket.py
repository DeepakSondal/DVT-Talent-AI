import json
import asyncio
import redis.asyncio as redis
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, status
from typing import List, Dict, Set
from jose import JWTError, jwt
from config import settings

router = APIRouter()


class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, Set[WebSocket]] = {}   # user_id → Set[WebSocket]
        self.user_tenants: Dict[str, str] = {}                     # user_id → tenant_id
        self.redis_client = redis.from_url(settings.redis_url)
        self.pubsub_task = None

    async def connect(self, websocket: WebSocket, user_id: str, tenant_id: str):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = set()
        self.active_connections[user_id].add(websocket)
        self.user_tenants[user_id] = tenant_id

        # Start resilient Redis listener if not running
        if self.pubsub_task is None or self.pubsub_task.done():
            self.pubsub_task = asyncio.create_task(self._redis_listener())

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
                        except Exception:
                            pass
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
        payload = json.dumps(message)
        for uid, sockets in list(self.active_connections.items()):
            if tenant_id and self.user_tenants.get(uid) != tenant_id:
                continue
            for ws in list(sockets):
                try:
                    await ws.send_text(payload)
                except Exception:
                    self.disconnect(ws, uid)

    async def broadcast(self, message: dict):
        """Broadcast to ALL connected users across all tabs."""
        payload = json.dumps(message)
        for uid, sockets in list(self.active_connections.items()):
            for ws in list(sockets):
                try:
                    await ws.send_text(payload)
                except Exception:
                    self.disconnect(ws, uid)


manager = ConnectionManager()


def _verify_ws_token(token: str) -> tuple[str, str] | tuple[None, None]:
    """Validate JWT and return (user_id, tenant_id), or (None, None) if invalid."""
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        user_id: str = payload.get("sub")
        tenant_id: str = payload.get("tenant_id", "")
        if not user_id or payload.get("type") != "access":
            return None, None
        return user_id, tenant_id
    except JWTError:
        return None, None


@router.websocket("/pipeline-events")
async def pipeline_events_endpoint(
    websocket: WebSocket,
    token: str = Query(..., description="JWT access token"),
):
    """
    Dedicated endpoint for real-time AI pipeline activity notifications.
    Used by the dashboard 'Live Feed' component. Supports multi-tab concurrency.
    """
    user_id, tenant_id = _verify_ws_token(token)
    if not user_id:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await manager.connect(websocket, user_id, tenant_id or "")
    try:
        while True:
            # Keep connection alive, listen for client pings
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text('{"type":"pong"}')
    except WebSocketDisconnect:
        manager.disconnect(websocket, user_id)
