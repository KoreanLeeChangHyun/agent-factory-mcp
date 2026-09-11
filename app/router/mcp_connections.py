"""Authenticated browser enrollment and server-owned connection status."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
from app.modules.auth.authorization import AuthorizedContext
from app.modules.auth.authorization_dependencies import require_permission
from app.modules.auth.dependencies import require_csrf
from app.modules.mcp_connection.service import ConnectionService

router = APIRouter(
    prefix="/api/organizations/{organization_id}/workspaces/{workspace_id}/mcp-connections",
    tags=["mcp-connections"],
)
Context = Annotated[AuthorizedContext, Depends(require_permission("workspace.read"))]
Session = Annotated[AsyncSession, Depends(get_session)]


class ConnectionCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)

    @field_validator("name", mode="before")
    @classmethod
    def trim_name(cls, value):
        return value.strip() if isinstance(value, str) else value


@router.get("")
async def status(context: Context, session: Session, response: Response):
    response.headers["Cache-Control"] = "no-store"
    return await ConnectionService(session).status(context)


@router.post("", status_code=201, dependencies=[Depends(require_csrf)])
async def create(payload: ConnectionCreate, context: Context, session: Session, response: Response):
    connection, token, plaintext = await ConnectionService(session).create(context, payload.name)
    response.headers["Cache-Control"] = "no-store"
    return {
        "id": connection.id,
        "name": connection.name,
        "token": plaintext,
        "expires_at": token.expires_at,
        "state": "pending",
    }


@router.delete("/{connection_id}", status_code=204, dependencies=[Depends(require_csrf)])
async def revoke(connection_id: UUID, context: Context, session: Session):
    await ConnectionService(session).revoke(context, connection_id)


@router.post("/{connection_id}/secret", dependencies=[Depends(require_csrf)])
async def reveal(connection_id: UUID, context: Context, session: Session, response: Response):
    response.headers["Cache-Control"] = "no-store"
    response.headers["Pragma"] = "no-cache"
    return await ConnectionService(session).reveal(context, connection_id)


@router.delete("/{connection_id}/purge", status_code=204, dependencies=[Depends(require_csrf)])
async def purge(connection_id: UUID, context: Context, session: Session):
    await ConnectionService(session).purge(context, connection_id)
