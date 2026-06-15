from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.routes import commute, health, rides
from app.core.config import settings

app = FastAPI(title="UniGo API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api/v1", tags=["health"])
app.include_router(commute.router, prefix="/api/v1/commute", tags=["commute"])
app.include_router(rides.router, prefix="/api/v1/rides", tags=["rides"])

