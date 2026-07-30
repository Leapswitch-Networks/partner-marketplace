from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class CandidateCreate(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    email: EmailStr
    phone: str | None = Field(default=None, max_length=50)
    position: str | None = Field(default=None, max_length=255)
    notes: str | None = None


class CandidateUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=255)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=50)
    position: str | None = Field(default=None, max_length=255)
    notes: str | None = None


class CandidateResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: str
    name: str
    email: str
    phone: str | None
    position: str | None
    notes: str | None
    created_at: datetime
    updated_at: datetime
