from datetime import UTC, datetime
from uuid import uuid4

import pytest
from api.http.routes.connections.router import create_connections_router
from agent_factory_core.connections.mcp.domain import MCPConnection, MCPConnectionState
from fastapi import FastAPI
from fastapi.testclient import TestClient


class MCPStatus:
    def __init__(self, rows: list[MCPConnection]) -> None:
        self.rows = rows

    async def status(self, _context: object) -> list[MCPConnection]:
        return self.rows


def connection(state: MCPConnectionState) -> MCPConnection:
    return MCPConnection(
        id=uuid4(),
        user_id=uuid4(),
        organization_id=uuid4(),
        workspace_id=uuid4(),
        token_id=uuid4(),
        name=state.value,
        state=state,
        retrievable=state is not MCPConnectionState.REAUTH_REQUIRED,
        expires_at=datetime(2026, 12, 1, tzinfo=UTC),
        reason="expired" if state is MCPConnectionState.REAUTH_REQUIRED else None,
    )


@pytest.mark.parametrize(
    ("states", "aggregate"),
    [
        ([], "pending"),
        ([MCPConnectionState.PENDING], "pending"),
        ([MCPConnectionState.REAUTH_REQUIRED], "reauth_required"),
        (
            [MCPConnectionState.REAUTH_REQUIRED, MCPConnectionState.VERIFIED],
            "verified",
        ),
    ],
)
def test_mcp_status_preserves_aggregate_legacy_presentation(
    states: list[MCPConnectionState], aggregate: str
) -> None:
    status = MCPStatus([connection(state) for state in states])
    app = FastAPI()
    app.include_router(
        create_connections_router(
            lambda: object(),
            lambda: object(),
            lambda: status,
            lambda: object(),
            lambda: None,
        )
    )

    response = TestClient(app).get(
        f"/api/organizations/{uuid4()}/workspaces/{uuid4()}/mcp-connections"
    )

    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    assert response.json()["state"] == aggregate
    assert [row["state"] for row in response.json()["connections"]] == [
        state.value for state in states
    ]
