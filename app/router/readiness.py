"""Dependency readiness route."""

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session

router = APIRouter(tags=["health"])


@router.get("/ready")
async def readiness(session: Annotated[AsyncSession, Depends(get_session)]) -> dict[str, str]:
    """Confirm the authoritative database can answer a query."""

    await session.execute(text("SELECT 1"))
    return {"status": "ready"}
