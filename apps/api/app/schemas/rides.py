from pydantic import BaseModel


class Coordinates(BaseModel):
    lat: float
    lng: float


class RideSearchRequest(BaseModel):
    pickup: Coordinates
    drop: Coordinates
    women_only: bool = False

