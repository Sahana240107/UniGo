# apps/api/app/routers/rides.py
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import Optional
from math import radians, sin, cos, sqrt, atan2
import httpx
import os

from app.core.deps import get_current_user
from app.db.supabase import get_supabase

router = APIRouter(prefix="/rides", tags=["rides"])


# ─── Schemas ────────────────────────────────────────────────────────────────

class CreateRideRequest(BaseModel):
    community_id: str
    pickup_lat: float
    pickup_lng: float
    pickup_address: str
    dropoff_lat: float
    dropoff_lng: float
    dropoff_address: str
    departure_time: str          # ISO8601
    seats_total: int = 4
    women_only: bool = False


class MatchRequest(BaseModel):
    pickup_lat: float
    pickup_lng: float
    drop_lat: float
    drop_lng: float
    women_only: bool = False
    community_id: str


class JoinRideRequest(BaseModel):
    pickup_lat: float
    pickup_lng: float
    pickup_address: str


class UpdateRequestStatus(BaseModel):
    status: str   # "accepted" | "rejected"

class ClaimRideRequest(BaseModel):
    pass  # driver just claims by hitting the endpoint

class StartRideRequest(BaseModel):
    pass
# ─── Helpers ────────────────────────────────────────────────────────────────

def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle distance in km between two lat/lng points."""
    R = 6371.0
    phi1, phi2 = radians(lat1), radians(lat2)
    dphi = radians(lat2 - lat1)
    dlambda = radians(lng2 - lng1)
    a = sin(dphi / 2) ** 2 + cos(phi1) * cos(phi2) * sin(dlambda / 2) ** 2
    return R * 2 * atan2(sqrt(a), sqrt(1 - a))


def tiered_fare(km: float) -> float:
    """
    Tiered per-km pricing:
      0–25 km  → ₹4 / km
      >25 km   → ₹4 for first 25 km + ₹6 / km for the remainder
    """
    if km <= 25:
        return round(km * 4, 2)
    return round(25 * 4 + (km - 25) * 6, 2)


def compute_match_percent(
    user_pickup_lat: float, user_pickup_lng: float,
    user_drop_lat: float, user_drop_lng: float,
    ride_pickup_lat: float, ride_pickup_lng: float,
    ride_drop_lat: float, ride_drop_lng: float,
) -> int:
    """
    Rough route-overlap score (0–100).
    Uses cosine-similarity of direction vectors as a simple proxy.
    """
    user_vec = (user_drop_lat - user_pickup_lat, user_drop_lng - user_pickup_lng)
    ride_vec = (ride_drop_lat - ride_pickup_lat, ride_drop_lng - ride_pickup_lng)

    dot = user_vec[0] * ride_vec[0] + user_vec[1] * ride_vec[1]
    mag_u = sqrt(user_vec[0] ** 2 + user_vec[1] ** 2) or 1e-9
    mag_r = sqrt(ride_vec[0] ** 2 + ride_vec[1] ** 2) or 1e-9
    cosine = dot / (mag_u * mag_r)
    return max(0, int((cosine + 1) / 2 * 100))


async def _send_fcm(token: str, title: str, body: str, data: dict = None):
    """Fire-and-forget FCM push via Firebase HTTP v1 API."""
    server_key = os.getenv("FCM_SERVER_KEY")
    if not server_key or not token:
        return
    payload = {
        "to": token,
        "notification": {"title": title, "body": body},
        "data": data or {},
    }
    async with httpx.AsyncClient() as client:
        await client.post(
            "https://fcm.googleapis.com/fcm/send",
            json=payload,
            headers={"Authorization": f"key={server_key}"},
            timeout=5,
        )


# ─── Routes ────────────────────────────────────────────────────────────────

@router.get("/open")
async def get_open_rides(
    community_id: str,
    current_user: dict = Depends(get_current_user),
    supabase=Depends(get_supabase),
):
    """Driver browses open ride groups waiting for a driver."""
    res = supabase.table("rides").select(
        "*, ride_requests(id, rider_id, pickup_address, status, users!ride_requests_rider_id_fkey(name))"
    ).eq("community_id", community_id) \
     .eq("status", "open") \
     .is_("driver_id", "null") \
     .execute()

    rides = []
    for ride in (res.data or []):
        accepted_requests = [r for r in (ride.get("ride_requests") or []) if r["status"] == "accepted"]
        driver_km = haversine_km(
            ride["pickup_lat"], ride["pickup_lng"],
            ride["dropoff_lat"], ride["dropoff_lng"],
        )
        rides.append({
            "id": ride["id"],
            "pickup_address": ride["pickup_address"],
            "dropoff_address": ride["dropoff_address"],
            "departure_time": ride["departure_time"],
            "seats_total": ride["seats_total"],
            "seats_available": ride["seats_available"],
            "women_only": ride["women_only"],
            "rider_count": len(accepted_requests),
            "riders": [
                {"name": r["users"]["name"], "pickup_address": r["pickup_address"]}
                for r in accepted_requests if r.get("users")
            ],
            "total_fare": round(tiered_fare(driver_km), 0),
            "distance_km": round(driver_km, 1),
        })

    return {"rides": rides}

@router.post("/create", status_code=status.HTTP_201_CREATED)
async def create_ride(
    body: CreateRideRequest,
    current_user: dict = Depends(get_current_user),
    supabase=Depends(get_supabase),
):
    """Rider creates an open ride group. No driver profile needed."""
    rider_id = current_user["id"]

    ride = supabase.table("rides").insert({
        "created_by_rider": rider_id,
        "driver_id": None,           # no driver yet
        "community_id": body.community_id,
        "pickup_lat": body.pickup_lat,
        "pickup_lng": body.pickup_lng,
        "pickup_address": body.pickup_address,
        "dropoff_lat": body.dropoff_lat,
        "dropoff_lng": body.dropoff_lng,
        "dropoff_address": body.dropoff_address,
        "departure_time": body.departure_time,
        "seats_total": body.seats_total,
        "seats_available": body.seats_total,
        "women_only": body.women_only,
        "status": "open",
    }).execute()

    ride_id = ride.data[0]["id"]

    # Auto-add the creating rider as first accepted request
    supabase.table("ride_requests").insert({
        "ride_id": ride_id,
        "rider_id": rider_id,
        "pickup_lat": body.pickup_lat,
        "pickup_lng": body.pickup_lng,
        "pickup_address": body.pickup_address,
        "status": "accepted",
    }).execute()

    # Decrement one seat for the organizing rider
    supabase.table("rides").update({
        "seats_available": body.seats_total - 1
    }).eq("id", ride_id).execute()

    return {"ride": ride.data[0]}

@router.post("/matches")
async def find_matches(
    body: MatchRequest,
    current_user: dict = Depends(get_current_user),
    supabase=Depends(get_supabase),
):
    """
    RouteMorph engine: find scheduled rides in the same community
    whose pickup is within 50 km of the user's pickup, sorted by match %.
    """
    result = supabase.table("rides").select(
        "*, users!rides_driver_id_fkey(name, reliability_score, gender)"
    ).eq("community_id", body.community_id) \
     .eq("status", "open") \
     .gt("seats_available", 0) \
     .execute()

    rides = result.data or []

    if body.women_only:
        rides = [r for r in rides if r.get("women_only") is True]

    matches = []
    for ride in rides:
        dist = haversine_km(
            body.pickup_lat, body.pickup_lng,
            ride["pickup_lat"], ride["pickup_lng"],
        )
        if dist > 50.0:
            continue

        match_pct = compute_match_percent(
            body.pickup_lat, body.pickup_lng,
            body.drop_lat, body.drop_lng,
            ride["pickup_lat"], ride["pickup_lng"],
            ride["dropoff_lat"], ride["dropoff_lng"],
        )

        # ── SmartSplit fare ──────────────────────────────────────────────
        # The driver's full route cost is split among all riders
        # proportionally by each rider's distance to the dropoff.
        #
        # Why this works:
        #   • Solo rider  → pays 100% of driver_cost              (expensive)
        #   • 3 riders    → each pays their km-weighted share      (cheaper)
        #   • Longer ride → pays proportionally more               (fair)
        #
        # total_fare stays fixed = driver's route cost (tiered).
        # fare_share drops as more riders join.

        driver_km = haversine_km(
            ride["pickup_lat"], ride["pickup_lng"],
            ride["dropoff_lat"], ride["dropoff_lng"],
        )
        driver_cost = tiered_fare(driver_km)   # fixed pool total

        # Fetch accepted riders' pickup coords
        accepted_res = supabase.table("ride_requests").select(
            "pickup_lat, pickup_lng"
        ).eq("ride_id", ride["id"]).eq("status", "accepted").execute()

        accepted_riders = accepted_res.data or []

        # Collect kms for all riders including this requesting user
        all_rider_kms: list[float] = []
        for r in accepted_riders:
            r_km = haversine_km(
                r["pickup_lat"], r["pickup_lng"],
                ride["dropoff_lat"], ride["dropoff_lng"],
            )
            all_rider_kms.append(r_km)

        this_rider_km = haversine_km(
            body.pickup_lat, body.pickup_lng,
            ride["dropoff_lat"], ride["dropoff_lng"],
        )
        all_rider_kms.append(this_rider_km)   # include current requesting user

        total_rider_km = sum(all_rider_kms) or 1e-9

        # This user's proportional share of the driver's cost
        fare_share = round(driver_cost * (this_rider_km / total_rider_km), 0)
        total_fare = round(driver_cost, 0)
        # ────────────────────────────────────────────────────────────────

        driver = ride.get("users") or {}
        matches.append({
            "id": ride["id"],
            "driver_name": driver.get("name", "Driver"),
            "driver_reliability": driver.get("reliability_score", 100),
            "pickup_address": ride["pickup_address"],
            "dropoff_address": ride["dropoff_address"],
            "departure_time": ride["departure_time"],
            "seats_available": ride["seats_available"],
            "women_only": ride["women_only"],
            "match_percent": match_pct,
            "fare_share": fare_share,           # ← what THIS rider pays
            "total_fare": total_fare,           # ← full driver route cost
            "pickup_distance_km": round(dist, 2),
        })

    matches.sort(key=lambda x: x["match_percent"], reverse=True)
    return {"matches": matches}


@router.post("/{ride_id}/join", status_code=status.HTTP_201_CREATED)
async def join_ride(
    ride_id: str,
    body: JoinRideRequest,
    current_user: dict = Depends(get_current_user),
    supabase=Depends(get_supabase),
):
    """Rider requests to join a ride."""
    rider_id = current_user["id"]

    ride_res = supabase.table("rides").select(
        "*, users!rides_driver_id_fkey(name, fcm_token, gender)"
    ).eq("id", ride_id).single().execute()

    ride = ride_res.data
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")
    if ride["status"] not in ("open", "scheduled"):
        raise HTTPException(status_code=400, detail="Ride is no longer accepting requests")
    if ride["seats_available"] < 1:
        raise HTTPException(status_code=400, detail="No seats available")

    if ride["women_only"]:
        rider_res = supabase.table("users").select("gender").eq("id", rider_id).single().execute()
        if not rider_res.data or rider_res.data["gender"] != "female":
            raise HTTPException(status_code=403, detail="This ride is women-only")

    existing = supabase.table("ride_requests") \
        .select("id") \
        .eq("ride_id", ride_id) \
        .eq("rider_id", rider_id) \
        .not_.in_("status", ["rejected", "cancelled"]) \
        .execute()
    if existing.data:
        raise HTTPException(status_code=400, detail="Already requested this ride")

    req_res = supabase.table("ride_requests").insert({
        "ride_id": ride_id,
        "rider_id": rider_id,
        "pickup_lat": body.pickup_lat,
        "pickup_lng": body.pickup_lng,
        "pickup_address": body.pickup_address,
        "status": "pending",
    }).execute()

    driver = ride.get("users") or {}
    driver_fcm = driver.get("fcm_token")
    rider_name = current_user.get("name", "A rider")
    await _send_fcm(
        driver_fcm,
        title="New ride request",
        body=f"{rider_name} wants to join your ride",
        data={"ride_id": ride_id, "type": "ride_request"},
    )

    return {"request": req_res.data[0]}

@router.patch("/{ride_id}/request/{req_id}")
async def update_request_status(
    ride_id: str,
    req_id: str,
    body: UpdateRequestStatus,
    current_user: dict = Depends(get_current_user),
    supabase=Depends(get_supabase),
):
    if body.status not in ("accepted", "rejected"):
        raise HTTPException(status_code=400, detail="status must be 'accepted' or 'rejected'")

    ride_res = supabase.table("rides").select("driver_id, seats_available").eq("id", ride_id).single().execute()
    ride = ride_res.data
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")

    # DEV MODE: skip driver ownership check — re-enable when auth is wired
    # if ride["driver_id"] != current_user["id"]:
    #     raise HTTPException(status_code=403, detail="Not the driver of this ride")

    req_res = supabase.table("ride_requests").select(
        "*, users!ride_requests_rider_id_fkey(name, fcm_token)"
    ).eq("id", req_id).single().execute()
    req = req_res.data
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")

    supabase.table("ride_requests").update({"status": body.status}).eq("id", req_id).execute()

    if body.status == "accepted":
        new_seats = max(0, ride["seats_available"] - 1)
        supabase.table("rides").update({"seats_available": new_seats}).eq("id", ride_id).execute()

    return {"status": body.status, "ride_id": ride_id, "request_id": req_id}

@router.patch("/{ride_id}/cancel")
async def cancel_ride(
    ride_id: str,
    current_user: dict = Depends(get_current_user),
    supabase=Depends(get_supabase),
):
    """Driver cancels a ride; notifies all accepted riders."""
    ride_res = supabase.table("rides").select("driver_id").eq("id", ride_id).single().execute()
    ride = ride_res.data
    if not ride or ride["driver_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not the driver of this ride")

    from datetime import datetime, timezone
    supabase.table("rides").update({
        "status": "cancelled",
        "cancelled_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", ride_id).execute()

    riders_res = supabase.table("ride_requests").select(
        "users!ride_requests_rider_id_fkey(fcm_token)"
    ).eq("ride_id", ride_id).eq("status", "accepted").execute()

    for row in (riders_res.data or []):
        fcm = (row.get("users") or {}).get("fcm_token")
        await _send_fcm(
            fcm,
            title="Ride cancelled",
            body="Your driver cancelled today's ride. We're finding a backup.",
            data={"ride_id": ride_id, "type": "ride_cancelled"},
        )

    return {"message": "Ride cancelled"}


@router.get("/upcoming/{user_id}")
async def get_upcoming_ride(
    user_id: str,
    current_user: dict = Depends(get_current_user),
    supabase=Depends(get_supabase),
):
    """Returns the next accepted ride for a rider."""
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc).isoformat()

    res = supabase.table("ride_requests").select(
        "*, rides(*, users!rides_driver_id_fkey(name, reliability_score, vehicle_make, vehicle_model, vehicle_number, vehicle_color))"
    ).eq("rider_id", user_id) \
     .eq("status", "accepted") \
     .gte("rides.departure_time", now) \
     .order("rides.departure_time") \
     .limit(1) \
     .execute()

    if not res.data:
        return {"ride": None}

    return {"ride": res.data[0]}



@router.get("/impact")
async def get_my_impact(
    current_user: dict = Depends(get_current_user),
    supabase=Depends(get_supabase),
):
    """Returns the current user's impact summary (rides shared, money saved, trust score)."""
    user_id = current_user["id"]

    # Primary: impact_summary table (maintained by DB trigger on ride completion)
    impact_res = supabase.table("impact_summary").select(
        "total_rides, total_saved, total_co2_saved"
    ).eq("user_id", user_id).maybe_single().execute()

    impact = impact_res.data or {}
    total_rides = impact.get("total_rides") or 0
    total_saved = float(impact.get("total_saved") or 0)

    # Fallback: compute from completed ride_requests if impact_summary is empty
    if total_rides == 0:
        req_res = supabase.table("ride_requests").select(
            "fare_share"
        ).eq("rider_id", user_id).eq("status", "completed").execute()

        rows = req_res.data or []
        total_rides = len(rows)
        total_saved = sum(float(r.get("fare_share") or 0) for r in rows)

    return {
        "total_rides": total_rides,
        "total_saved": round(total_saved, 2),
        "reliability_score": current_user.get("reliability_score", 100),
    }

@router.get("/{ride_id}")
async def get_ride(
    ride_id: str,
    current_user: dict = Depends(get_current_user),
    supabase=Depends(get_supabase),
):
    """Get a single ride by ID with driver details and per-rider fare breakdown."""
    res = supabase.table("rides").select(
        "*, users!rides_driver_id_fkey(name, reliability_score, gender)"
    ).eq("id", ride_id).single().execute()

    if not res.data:
        raise HTTPException(status_code=404, detail="Ride not found")

    ride = res.data
    driver = ride.get("users") or {}

    # ── SmartSplit fare ──────────────────────────────────────────────────────
    # total_fare = driver's full tiered route cost (constant regardless of riders)
    # rider_fares = per-rider proportional share based on their distance
    # → solo rider pays everything; each new rider reduces everyone's share
    driver_km = haversine_km(
        ride["pickup_lat"], ride["pickup_lng"],
        ride["dropoff_lat"], ride["dropoff_lng"],
    )
    driver_cost = tiered_fare(driver_km)
    total_fare = round(driver_cost, 0)

    accepted_res = supabase.table("ride_requests").select(
        "rider_id, pickup_lat, pickup_lng"
    ).eq("ride_id", ride_id).eq("status", "accepted").execute()

    accepted_riders = accepted_res.data or []

    rider_km_map: dict = {}
    for r in accepted_riders:
        r_km = haversine_km(
            r["pickup_lat"], r["pickup_lng"],
            ride["dropoff_lat"], ride["dropoff_lng"],
        )
        rider_km_map[r["rider_id"]] = r_km

    total_rider_km = sum(rider_km_map.values()) or 1e-9

    rider_fares: dict = {
        rid: round(driver_cost * (km / total_rider_km), 0)
        for rid, km in rider_km_map.items()
    }
    # ────────────────────────────────────────────────────────────────────────

    return {
        "id": ride["id"],
        "driver_name": driver.get("name", "Driver"),
        "driver_reliability": driver.get("reliability_score", 100),
        "pickup_address": ride["pickup_address"],
        "dropoff_address": ride["dropoff_address"],
        "departure_time": ride["departure_time"],
        "seats_available": ride["seats_available"],
        "seats_total": ride["seats_total"],
        "women_only": ride["women_only"],
        "total_fare": total_fare,       # driver's full route cost
        "rider_fares": rider_fares,     # { rider_id: their_share }
        "pickup_lat": ride["pickup_lat"],
        "pickup_lng": ride["pickup_lng"],
        "dropoff_lat": ride["dropoff_lat"],
        "dropoff_lng": ride["dropoff_lng"],
        "status": ride["status"],
    }

@router.get("/{ride_id}/requests")
async def get_ride_requests(
    ride_id: str,
    current_user: dict = Depends(get_current_user),
    supabase=Depends(get_supabase),
):
    """Driver fetches all requests for their ride."""
    res = supabase.table("ride_requests").select(
        "*, users!ride_requests_rider_id_fkey(name)"
    ).eq("ride_id", ride_id).execute()

    requests = []
    for req in (res.data or []):
        rider = req.get("users") or {}
        # Recalculate fare based on current accepted count
        ride_res = supabase.table("rides").select(
            "pickup_lat,pickup_lng,dropoff_lat,dropoff_lng,seats_total,seats_available"
        ).eq("id", ride_id).single().execute()
        ride = ride_res.data or {}
        route_km = haversine_km(
            ride.get("pickup_lat", 0), ride.get("pickup_lng", 0),
            ride.get("dropoff_lat", 0), ride.get("dropoff_lng", 0),
        )
        occupied = ride.get("seats_total", 4) - ride.get("seats_available", 4) + 1
        fare_share = round(route_km * 3.5 / max(occupied, 1), 0)

        requests.append({
            "id": req["id"],
            "rider_name": rider.get("name", "Rider"),
            "pickup_address": req.get("pickup_address", ""),
            "status": req.get("status", "pending"),
            "fare_share": fare_share,
        })

    return {"requests": requests}



@router.post("/{ride_id}/claim", status_code=status.HTTP_200_OK)
async def claim_ride(
    ride_id: str,
    current_user: dict = Depends(get_current_user),
    supabase=Depends(get_supabase),
):
    """Driver claims an open ride. Sets driver_id and status → scheduled."""
    driver_id = current_user["id"]

    # DEV: skip driver_profile check — re-enable later
    # dp = supabase.table("driver_profiles").select("submission_state").eq("user_id", driver_id).single().execute()
    # if not dp.data or dp.data["submission_state"] != "active":
    #     raise HTTPException(status_code=403, detail="Driver profile not active")

    # Atomic claim — only succeeds if driver_id is still null
    res = supabase.table("rides").update({
        "driver_id": driver_id,
        "status": "scheduled",
    }).eq("id", ride_id).is_("driver_id", "null").execute()

    if not res.data:
        raise HTTPException(status_code=409, detail="Ride already claimed by another driver")

    return {"ride": res.data[0]}


@router.patch("/{ride_id}/start")
async def start_ride(
    ride_id: str,
    current_user: dict = Depends(get_current_user),
    supabase=Depends(get_supabase),
):
    """Driver starts the ride. Status → active."""
    driver_id = current_user["id"]

    ride_res = supabase.table("rides").select("driver_id, status").eq("id", ride_id).single().execute()
    ride = ride_res.data
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")
    # DEV: skip ownership check
    # if ride["driver_id"] != driver_id:
    #     raise HTTPException(status_code=403, detail="Not your ride")
    if ride["status"] != "scheduled":
        raise HTTPException(status_code=400, detail=f"Ride is {ride['status']}, not scheduled")

    supabase.table("rides").update({"status": "active"}).eq("id", ride_id).execute()

    # Notify riders via FCM (fire and forget)
    riders_res = supabase.table("ride_requests").select(
        "users!ride_requests_rider_id_fkey(fcm_token, name)"
    ).eq("ride_id", ride_id).eq("status", "accepted").execute()

    for row in (riders_res.data or []):
        fcm = (row.get("users") or {}).get("fcm_token")
        await _send_fcm(fcm, "Your ride has started!", "Driver is on the way.", {"ride_id": ride_id, "type": "ride_started"})

    return {"status": "active", "ride_id": ride_id}