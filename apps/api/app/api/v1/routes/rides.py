from fastapi import APIRouter

router = APIRouter()


@router.get("/matches")
def list_ride_matches(women_only: bool = False):
    return {"women_only": women_only, "matches": []}

