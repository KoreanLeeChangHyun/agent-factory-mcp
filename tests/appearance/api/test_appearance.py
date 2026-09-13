from typing import Annotated
from uuid import UUID

from agent_factory_adapters import SemanticThemeValidator
from api.http.routes.appearance import ThemeService, create_appearance_router
from agent_factory_core import (
    GetThemeProfile,
    SaveThemeProfile,
    ThemeConflictError,
    ThemeProfile,
)
from fastapi import Cookie, FastAPI, Header, HTTPException
from fastapi.testclient import TestClient

USER = UUID("00000000-0000-4000-8000-000000000001")


class Principal:
    user_id = USER


class Repository:
    profile: ThemeProfile | None = None

    async def get(self, user_id: UUID) -> ThemeProfile | None:
        assert user_id == USER
        return self.profile

    async def save(self, user_id, update):
        current = self.profile or ThemeProfile.default(user_id)
        if update.expected_revision != current.revision:
            raise ThemeConflictError(current)
        self.profile = ThemeProfile(
            user_id,
            current.revision + 1,
            update.base,
            update.density,
            update.overrides,
            update.reduced_motion,
        )
        return self.profile


def test_authenticated_owner_default_save_and_conflict() -> None:
    repository = Repository()
    service = ThemeService(
        get=GetThemeProfile(repository), save=SaveThemeProfile(repository, SemanticThemeValidator())
    )

    def principal(
        user: Annotated[str | None, Header(alias="X-Test-User")] = None,
    ) -> Principal:
        if user != str(USER):
            raise HTTPException(status_code=401)
        return Principal()

    def csrf(
        header: Annotated[str | None, Header(alias="X-CSRF-Token")] = None,
        cookie: Annotated[str | None, Cookie(alias="agent_factory_csrf")] = None,
    ) -> None:
        if not header or header != cookie:
            raise HTTPException(status_code=403)

    app = FastAPI()
    app.include_router(create_appearance_router(lambda: service, principal, csrf))
    client = TestClient(app)
    assert client.get("/api/appearance/theme-profile").status_code == 401
    headers = {"X-Test-User": str(USER)}
    initial = client.get("/api/appearance/theme-profile", headers=headers)
    assert initial.status_code == 200
    assert initial.json()["revision"] == 0
    assert initial.headers["cache-control"] == "no-store"
    rejected = client.put(
        "/api/appearance/theme-profile",
        headers=headers,
        json={
            "base": "dark",
            "density": "compact",
            "overrides": {},
            "reducedMotion": True,
            "expectedRevision": 0,
        },
    )
    assert rejected.status_code == 403
    client.cookies.set("agent_factory_csrf", "csrf")
    headers["X-CSRF-Token"] = "csrf"
    invalid = client.put(
        "/api/appearance/theme-profile",
        headers=headers,
        json={
            "base": "dark",
            "density": "compact",
            "overrides": {"text": "#181D25"},
            "reducedMotion": True,
            "expectedRevision": 0,
        },
    )
    assert invalid.status_code == 422
    assert invalid.json()["detail"]["code"] == "invalid_theme"
    saved = client.put(
        "/api/appearance/theme-profile",
        headers=headers,
        json={
            "base": "dark",
            "density": "compact",
            "overrides": {},
            "reducedMotion": True,
            "expectedRevision": 0,
        },
    )
    assert saved.status_code == 200
    assert saved.json()["userId"] == USER.hex
    conflict = client.put(
        "/api/appearance/theme-profile",
        headers=headers,
        json={
            "base": "light",
            "density": "compact",
            "overrides": {},
            "reducedMotion": False,
            "expectedRevision": 0,
        },
    )
    assert conflict.status_code == 409
    assert conflict.json()["detail"]["current"]["revision"] == 1
