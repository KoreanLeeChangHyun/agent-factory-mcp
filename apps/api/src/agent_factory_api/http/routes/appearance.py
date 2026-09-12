from collections.abc import Callable
from dataclasses import dataclass
from typing import Annotated, Any, Protocol

from agent_factory_core import (
    GetThemeProfile,
    SaveThemeProfile,
    ThemeBase,
    ThemeConflictError,
    ThemeDensity,
    ThemeProfile,
    ThemeUpdate,
    ThemeValidationError,
)
from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, ConfigDict, Field


class Principal(Protocol):
    user_id: Any


@dataclass(frozen=True, slots=True)
class ThemeService:
    get: GetThemeProfile
    save: SaveThemeProfile


class ThemeUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    base: ThemeBase
    density: ThemeDensity
    overrides: dict[Annotated[str, Field(max_length=16)], Annotated[str, Field(max_length=7)]] = (
        Field(default_factory=dict, max_length=4)
    )
    reducedMotion: bool
    expectedRevision: int = Field(ge=0, le=2_147_483_646)


def present(profile: ThemeProfile) -> dict[str, object]:
    return {
        "schemaVersion": "1.0",
        "userId": profile.user_id.hex,
        "revision": profile.revision,
        "base": profile.base.value,
        "density": profile.density.value,
        "overrides": dict(profile.overrides),
        "reducedMotion": profile.reduced_motion,
    }


def create_appearance_router(
    service_dependency: Callable[..., ThemeService],
    principal_dependency: Callable[..., Principal],
    csrf_dependency: Callable[..., None],
) -> APIRouter:
    router = APIRouter(prefix="/api/appearance", tags=["appearance"])

    @router.get("/theme-profile")
    async def get_theme_profile(
        response: Response,
        principal: Annotated[Principal, Depends(principal_dependency)],
        service: Annotated[ThemeService, Depends(service_dependency)],
    ) -> dict[str, object]:
        response.headers["Cache-Control"] = "no-store"
        return present(await service.get.execute(principal.user_id))

    @router.put("/theme-profile", dependencies=[Depends(csrf_dependency)])
    async def put_theme_profile(
        payload: ThemeUpdateRequest,
        response: Response,
        principal: Annotated[Principal, Depends(principal_dependency)],
        service: Annotated[ThemeService, Depends(service_dependency)],
    ) -> dict[str, object]:
        try:
            saved = await service.save.execute(
                principal.user_id,
                ThemeUpdate(
                    base=payload.base,
                    density=payload.density,
                    overrides=payload.overrides,
                    reduced_motion=payload.reducedMotion,
                    expected_revision=payload.expectedRevision,
                ),
            )
        except ThemeValidationError as error:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={"code": "invalid_theme", "messages": list(error.messages)},
            ) from error
        except ThemeConflictError as error:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={"code": "revision_conflict", "current": present(error.current)},
            ) from error
        response.headers["Cache-Control"] = "no-store"
        return present(saved)

    return router
