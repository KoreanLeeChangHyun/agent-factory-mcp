"""Process health route."""

from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/health")
async def health() -> dict[str, str]:
    """Report process liveness without asserting domain readiness."""

    return {"status": "ok"}


@router.get("/live")
async def liveness() -> dict[str, str]:
    """Stable orchestration probe alias with no downstream dependencies."""

    return {"status": "alive"}
