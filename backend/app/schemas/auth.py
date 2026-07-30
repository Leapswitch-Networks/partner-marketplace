from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, model_validator

AdminRole = Literal["admin", "super_admin"]


class RegisterRequest(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    confirm_password: str

    @model_validator(mode="after")
    def passwords_match(self) -> "RegisterRequest":
        if self.password != self.confirm_password:
            raise ValueError("Passwords do not match")
        return self


class AdminRegisterRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(
        min_length=8,
        max_length=128,
        description="Must contain an uppercase letter and a digit",
    )
    confirm_password: str
    role: AdminRole = "admin"

    @model_validator(mode="after")
    def validate_password(self) -> "AdminRegisterRequest":
        if self.password != self.confirm_password:
            raise ValueError("Passwords do not match")
        if not any(c.isupper() for c in self.password):
            raise ValueError("Password must contain at least one uppercase letter")
        if not any(c.isdigit() for c in self.password):
            raise ValueError("Password must contain at least one number")
        return self


class UpdateAdminUserRequest(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=100)
    email: EmailStr | None = None
    is_active: bool | None = None
    role: AdminRole | None = None


class AdminUserResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: str
    full_name: str
    email: str
    is_active: bool
    role: str
    is_super_admin: bool
    created_at: datetime


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: str
    name: str
    email: str
    role: str
    created_at: datetime


class TokenResponse(BaseModel):
    message: str
    user: UserResponse


class AdminTokenResponse(BaseModel):
    message: str
    user: AdminUserResponse


class UpdateProfileRequest(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    email: EmailStr


class UpdateAdminProfileRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=100)
    email: EmailStr


class WhoAmIResponse(BaseModel):
    user_type: Literal["admin", "user"]
    user: AdminUserResponse | UserResponse


class MessageResponse(BaseModel):
    message: str
