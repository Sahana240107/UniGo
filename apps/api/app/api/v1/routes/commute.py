from fastapi import APIRouter

router = APIRouter()


@router.get("/status/{user_id}")
def get_commute_status(user_id: str):
    return {
        "user_id": user_id,
        "in_daily_commute_group": False,
        "prompt": "Are you coming today?",
    }

