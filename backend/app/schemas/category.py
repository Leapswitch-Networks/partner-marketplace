from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class CategoryCreate(BaseModel):
    id: str = Field(min_length=1, max_length=100, pattern=r"^[a-zA-Z0-9_-]+$")
    name: str = Field(min_length=2, max_length=255)
    description: str = Field(min_length=10)
    status: Literal["active", "inactive"] = "active"


class CategoryUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=255)
    description: str | None = Field(default=None, min_length=10)
    status: Literal["active", "inactive"] | None = None


class CategoryResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: str
    name: str
    description: str
    status: str
    created_at: datetime
    updated_at: datetime
