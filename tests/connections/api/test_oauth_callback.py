from uuid import uuid4

import pytest
from api.http.routes.connections.router import (
    create_provider_oauth_callback_router,
)
from agent_factory_core.identity.domain import Principal
from fastapi import FastAPI
from fastapi.testclient import TestClient


class Callback:
    def __init__(self) -> None:
        self.calls = []

    async def handle(self, principal, provider, *, state, code, denied):
        self.calls.append((principal.user_id, provider, state, code, denied))
        return uuid4()


@pytest.mark.parametrize(
    ("query", "denied"),
    [("state=opaque&code=authorization-code", False), ("state=opaque&error=denied", True)],
)
def test_provider_callback_is_clean_protected_get_redirect(query: str, denied: bool) -> None:
    callback = Callback()
    principal = Principal(uuid4(), "owner@example.test", "Owner", False)
    app = FastAPI()
    app.include_router(
        create_provider_oauth_callback_router(
            lambda: callback,
            lambda: principal,
            "/workspace/",
        )
    )

    response = TestClient(app).get(
        f"/api/integrations/oauth/onedrive/callback?{query}",
        follow_redirects=False,
    )

    assert response.status_code == 303
    assert response.headers["location"] == "/workspace/"
    assert response.headers["cache-control"] == "no-store"
    assert response.headers["referrer-policy"] == "no-referrer"
    assert callback.calls == [
        (
            principal.user_id,
            "onedrive",
            "opaque",
            "" if denied else "authorization-code",
            denied,
        )
    ]
