# app/main.py
#
# Unchanged from your original except:
#   • imports emergency router
#   • mounts it at /emergency

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.routes import commute, health
from app.core.config import settings
from app.routers import auth, community, emergency, rides

app = FastAPI(title="UniGo API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router,     prefix="/api/v1",          tags=["health"])
app.include_router(commute.router,    prefix="/api/v1/commute",   tags=["commute"])
app.include_router(auth.router,       prefix="/auth",             tags=["auth"])
app.include_router(community.router,  prefix="/community",        tags=["community"])
app.include_router(emergency.router,  prefix="/emergency",        tags=["emergency"])
# routers/rides.py already sets prefix="/rides" on the router itself — include with no prefix
app.include_router(rides.router,      tags=["rides"])
@app.get("/health")
def health():
    return {"status": "ok"}