# app/routers/emergency.py
#
# SOS trigger, live location update (HTTP poll + WebSocket push), and deactivation.
#
# Tables used:
#   emergency_logs  (id, user_id, ride_id, lat, lng, triggered_at,
#                    off_code, is_active, deactivated_at)
#   users           (id, name, emergency_contact_name,
#                    emergency_contact_phone, emergency_contact_fcm_token)
#
# Migration (run once):
#   ALTER TABLE emergency_logs
#     ADD COLUMN IF NOT EXISTS off_code       text,
#     ADD COLUMN IF NOT EXISTS is_active      boolean DEFAULT true,
#     ADD COLUMN IF NOT EXISTS deactivated_at timestamptz;
#
# WebSocket endpoint:
#   ws://<host>/emergency/ws/<log_id>
#   Emergency contacts open this socket to receive real-time location pushes
#   instead of polling.  The mobile SOS page can also connect to get its own
#   confirmation echo.

import random
import string
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel

from app.db.supabase_client import supabase
from app.services.notifications import send_push   # keep FCM for native-app contacts

logger = logging.getLogger(__name__)
router = APIRouter(tags=["emergency"])


# ─── WebSocket connection manager ────────────────────────────────────────────

class _ConnectionManager:
    """Keeps open WebSocket connections keyed by SOS log_id."""

    def __init__(self) -> None:
        # log_id → list of active WebSocket connections
        self._rooms: dict[str, list[WebSocket]] = {}

    async def connect(self, log_id: str, ws: WebSocket) -> None:
        await ws.accept()
        self._rooms.setdefault(log_id, []).append(ws)
        logger.info("WS connected: log=%s total=%d", log_id, len(self._rooms[log_id]))

    def disconnect(self, log_id: str, ws: WebSocket) -> None:
        room = self._rooms.get(log_id, [])
        if ws in room:
            room.remove(ws)
        if not room:
            self._rooms.pop(log_id, None)

    async def broadcast(self, log_id: str, payload: dict) -> None:
        """Send JSON payload to all listeners on this SOS log."""
        room = list(self._rooms.get(log_id, []))
        dead: list[WebSocket] = []
        for ws in room:
            try:
                await ws.send_json(payload)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(log_id, ws)


manager = _ConnectionManager()


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _generate_off_code(length: int = 6) -> str:
    return "".join(random.choices(string.digits, k=length))


def _maps_link(lat: float, lng: float) -> str:
    return f"https://maps.google.com/?q={lat},{lng}"


def _decode_contact_name(raw: str) -> str:
    sep = "||"
    return raw[: raw.index(sep)] if sep in raw else raw


# ─── Pydantic schemas ─────────────────────────────────────────────────────────

class SOSTriggerRequest(BaseModel):
    user_id: str
    ride_id: Optional[str] = None
    lat: float
    lng: float


class SOSTriggerResponse(BaseModel):
    log_id: str
    off_code: str
    message: str


class SOSLocationUpdate(BaseModel):
    log_id: str
    user_id: str
    lat: float
    lng: float


class SOSDeactivate(BaseModel):
    log_id: str
    user_id: str
    off_code: str


# ─── HTTP endpoints ───────────────────────────────────────────────────────────

@router.post("/trigger", response_model=SOSTriggerResponse)
async def trigger_sos(body: SOSTriggerRequest):
    """
    Trigger an SOS alert.
    1. Fetch user + emergency contact.
    2. Insert emergency_log row with generated off_code.
    3. Push FCM notification to contact's device (if token exists).
    4. Broadcast initial location over WebSocket to any open listeners.
    5. Return log_id + off_code to the web client.
    """
    # 1. Fetch user
    user_resp = (
        supabase.table("users")
        .select("id, name, emergency_contact_name, emergency_contact_phone, emergency_contact_fcm_token")
        .eq("id", body.user_id)
        .maybe_single()
        .execute()
    )
    if not user_resp.data:
        raise HTTPException(status_code=404, detail="User not found")

    user = user_resp.data
    contact_phone = user.get("emergency_contact_phone") or ""
    contact_fcm   = user.get("emergency_contact_fcm_token") or ""
    sender_name   = user.get("name", "Someone")
    contact_raw   = user.get("emergency_contact_name") or ""
    contact_name  = _decode_contact_name(contact_raw) if contact_raw else "Emergency Contact"

    if not contact_phone:
        raise HTTPException(
            status_code=400,
            detail="No emergency contact saved. Please add one in your profile.",
        )

    # 2. Insert log
    off_code  = _generate_off_code()
    maps_url  = _maps_link(body.lat, body.lng)

    log_insert = (
        supabase.table("emergency_logs")
        .insert({
            "user_id":      body.user_id,
            "ride_id":      body.ride_id,
            "lat":          body.lat,
            "lng":          body.lng,
            "off_code":     off_code,
            "is_active":    True,
            "triggered_at": datetime.now(timezone.utc).isoformat(),
        })
        .execute()
    )
    if not log_insert.data:
        raise HTTPException(status_code=500, detail="Failed to create emergency log")

    log_id = log_insert.data[0]["id"]

    # 3. FCM push (for contacts using the native app)
    if contact_fcm:
        send_push(
            fcm_token=contact_fcm,
            title=f"🚨 SOS from {sender_name}",
            body=f"{sender_name} triggered an SOS! Location: {maps_url}",
            data={
                "type": "sos_triggered",
                "sender_name": sender_name,
                "lat": str(body.lat),
                "lng": str(body.lng),
                "maps_url": maps_url,
                "log_id": log_id,
            },
        )
    else:
        logger.info(
            "Emergency contact %s (%s) has no FCM token — consider SMS via Twilio/MSG91.",
            contact_name, contact_phone,
        )

    # 4. WebSocket broadcast (for web-based contacts listening on this log)
    await manager.broadcast(log_id, {
        "event": "sos_triggered",
        "log_id": log_id,
        "sender_name": sender_name,
        "lat": body.lat,
        "lng": body.lng,
        "maps_url": maps_url,
    })

    logger.warning(
        "SOS triggered: user=%s log=%s lat=%.5f lng=%.5f contact=%s",
        body.user_id, log_id, body.lat, body.lng, contact_phone,
    )

    return SOSTriggerResponse(
        log_id=log_id,
        off_code=off_code,
        message=(
            f"SOS activated. Your emergency contact ({contact_name}) "
            "has been notified. To stop tracking, enter your code."
        ),
    )


@router.post("/location-update")
async def update_sos_location(body: SOSLocationUpdate):
    """
    Called every ~30 s by the web client while SOS is active.
    Updates lat/lng in DB, re-pushes FCM, and broadcasts over WebSocket.
    """
    log_resp = (
        supabase.table("emergency_logs")
        .select("id, user_id, is_active")
        .eq("id", body.log_id)
        .eq("user_id", body.user_id)
        .maybe_single()
        .execute()
    )
    if not log_resp.data:
        raise HTTPException(status_code=404, detail="SOS log not found")
    if not log_resp.data.get("is_active"):
        raise HTTPException(status_code=400, detail="SOS is no longer active")

    maps_url = _maps_link(body.lat, body.lng)

    # Update DB
    supabase.table("emergency_logs").update(
        {"lat": body.lat, "lng": body.lng}
    ).eq("id", body.log_id).execute()

    # FCM re-push
    user_resp = (
        supabase.table("users")
        .select("name, emergency_contact_fcm_token")
        .eq("id", body.user_id)
        .maybe_single()
        .execute()
    )
    if user_resp.data:
        contact_fcm = user_resp.data.get("emergency_contact_fcm_token") or ""
        sender_name = user_resp.data.get("name", "Someone")
        if contact_fcm:
            send_push(
                fcm_token=contact_fcm,
                title=f"📍 Live location — {sender_name}",
                body=f"Updated location: {maps_url}",
                data={
                    "type": "sos_location_update",
                    "lat": str(body.lat),
                    "lng": str(body.lng),
                    "maps_url": maps_url,
                    "log_id": body.log_id,
                },
            )

    # WebSocket broadcast
    await manager.broadcast(body.log_id, {
        "event": "location_update",
        "log_id": body.log_id,
        "lat": body.lat,
        "lng": body.lng,
        "maps_url": maps_url,
    })

    return {"success": True, "maps_url": maps_url}


@router.post("/deactivate")
async def deactivate_sos(body: SOSDeactivate):
    """
    Validate off_code and mark SOS inactive.
    Notifies the emergency contact (FCM + WebSocket).
    """
    log_resp = (
        supabase.table("emergency_logs")
        .select("id, user_id, is_active, off_code")
        .eq("id", body.log_id)
        .eq("user_id", body.user_id)
        .maybe_single()
        .execute()
    )
    if not log_resp.data:
        raise HTTPException(status_code=404, detail="SOS log not found")

    log = log_resp.data
    if not log.get("is_active"):
        return {"success": True, "message": "SOS was already deactivated"}

    if log.get("off_code") != body.off_code:
        raise HTTPException(status_code=400, detail="Incorrect deactivation code")

    supabase.table("emergency_logs").update({
        "is_active":      False,
        "deactivated_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", body.log_id).execute()

    # FCM + WebSocket notify contact
    user_resp = (
        supabase.table("users")
        .select("name, emergency_contact_fcm_token")
        .eq("id", body.user_id)
        .maybe_single()
        .execute()
    )
    if user_resp.data:
        contact_fcm = user_resp.data.get("emergency_contact_fcm_token") or ""
        sender_name = user_resp.data.get("name", "Someone")
        if contact_fcm:
            send_push(
                fcm_token=contact_fcm,
                title=f"✅ SOS cancelled — {sender_name} is safe",
                body=f"{sender_name} has deactivated the SOS alert.",
                data={"type": "sos_deactivated", "log_id": body.log_id},
            )

    await manager.broadcast(body.log_id, {
        "event": "sos_deactivated",
        "log_id": body.log_id,
    })

    logger.info("SOS deactivated: log=%s user=%s", body.log_id, body.user_id)
    return {"success": True, "message": "SOS deactivated. Stay safe!"}


@router.get("/active/{user_id}")
async def get_active_sos(user_id: str):
    """Return the active SOS log for a user (used on page reload to restore state)."""
    resp = (
        supabase.table("emergency_logs")
        .select("id, lat, lng, triggered_at, off_code")
        .eq("user_id", user_id)
        .eq("is_active", True)
        .order("triggered_at", desc=True)
        .limit(1)
        .execute()
    )
    if resp.data:
        return {"active": True, "log": resp.data[0]}
    return {"active": False, "log": None}


# ─── WebSocket endpoint ───────────────────────────────────────────────────────

@router.websocket("/ws/{log_id}")
async def sos_websocket(ws: WebSocket, log_id: str):
    """
    WebSocket endpoint for real-time SOS location updates.

    Connect:  ws://<host>/emergency/ws/<log_id>

    Use-cases:
      • Emergency contact opens this URL to receive live lat/lng pushes
        without polling the REST API.
      • The SOS page itself may connect to get an echo confirmation.

    Message format received by the client:
      { "event": "location_update" | "sos_triggered" | "sos_deactivated",
        "log_id": "...",
        "lat": 1.23,       # only for location events
        "lng": 4.56,
        "maps_url": "..." }
    """
    await manager.connect(log_id, ws)
    try:
        # Keep the connection alive; the server pushes — client doesn't need to send
        while True:
            await ws.receive_text()   # absorbs any ping/keepalive frames
    except WebSocketDisconnect:
        manager.disconnect(log_id, ws)
        logger.info("WS disconnected: log=%s", log_id)