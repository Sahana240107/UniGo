# Pydantic: CommunityCreate, CommunityJoin, CommunityOut
from typing import Optional
from pydantic import BaseModel


class CommunityCreate(BaseModel):
    name: str
    type: str  # "organisation" | "neighborhood" | "apartment" | "other"
    description: Optional[str] = None
    city: Optional[str] = None
    verification_domain: Optional[str] = None
    trust_layer: Optional[str] = None


class CommunityJoinOrCreate(BaseModel):
    name: str
    type: str
    description: Optional[str] = None
    city: Optional[str] = None
    verification_domain: Optional[str] = None
    trust_layer: Optional[str] = None


class CommunityJoin(BaseModel):
    invite_code: str


class CommunityOut(BaseModel):
    id: str
    name: str
    type: str
    description: Optional[str] = None
    city: Optional[str] = None
    invite_code: str