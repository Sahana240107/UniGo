"""
app/core/deps.py — FastAPI dependency for authenticated routes.

get_current_user:
  • Reads the Bearer token from the Authorization header
  • Verifies it via Firebase (real ID token or server-minted custom token)
  • Looks up the user row in Supabase and returns it
  • Raises 401 if the token is missing/invalid, 404 if the user row is absent
"""

from fastapi import Header, HTTPException
from app.core.firebase import verify_id_token
from app.db.supabase_client import supabase


async def get_current_user(authorization: str = Header(...)) -> dict:
    """
    FastAPI dependency — resolves the logged-in user from the Bearer token.
    Matches the pattern used by community.py's _get_user() helper.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or malformed Authorization header")

    id_token = authorization.replace("Bearer ", "").strip()

    try:
        decoded = verify_id_token(id_token)
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")

    result = (
        supabase.table("users")
        .select("*")
        .eq("firebase_uid", decoded["uid"])
        .limit(1)
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=404, detail="User not found")

    return result.data[0]