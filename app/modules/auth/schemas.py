"""Authentication API schemas."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=1024)


class UserResponse(BaseModel):
    id: UUID
    email: EmailStr
    display_name: str
    is_platform_admin: bool


class SessionResponse(BaseModel):
    user: UserResponse


class EmailRequest(BaseModel):
    email: EmailStr


class TokenRequest(BaseModel):
    token: str = Field(min_length=20, max_length=1024)


class PasswordResetConfirmRequest(TokenRequest):
    password: str = Field(min_length=12, max_length=1024)


class AuthSessionResponse(BaseModel):
    id: UUID
    created_at: datetime
    expires_at: datetime
    revoked_at: datetime | None
    user_agent: str | None


class ApiTokenCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    scopes: list[str] = Field(min_length=1, max_length=20)
    expires_in_days: int | None = Field(default=90, ge=1, le=365)


class ApiTokenCreatedResponse(BaseModel):
    id: UUID
    name: str
    token: str
    scopes: list[str]
    expires_at: datetime | None


class ApiTokenResponse(BaseModel):
    id: UUID
    name: str
    scopes: list[str]
    created_at: datetime
    expires_at: datetime | None
    last_used_at: datetime | None
    revoked_at: datetime | None
