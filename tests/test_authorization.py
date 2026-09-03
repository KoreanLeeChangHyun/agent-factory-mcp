"""RBAC authorization behavior."""

from uuid import UUID

import pytest

from app.common.errors import PermissionDeniedError
from app.modules.auth.authorization import (
    AuthorizationScope,
    AuthorizationService,
)
from app.modules.auth.service import Principal

USER_ID = UUID("11111111-1111-4111-8111-111111111111")
ORGANIZATION_ID = UUID("22222222-2222-4222-8222-222222222222")
WORKSPACE_ID = UUID("33333333-3333-4333-8333-333333333333")


class FakeAuthorizationRepository:
    def __init__(self, permissions: set[str]) -> None:
        self.permissions = permissions
        self.established: tuple[Principal, AuthorizationScope] | None = None

    async def establish_scope(self, principal: Principal, scope: AuthorizationScope) -> None:
        self.established = (principal, scope)

    async def permission_keys(
        self, principal: Principal, scope: AuthorizationScope
    ) -> frozenset[str]:
        del principal, scope
        return frozenset(self.permissions)


def principal(*, platform_admin: bool = False) -> Principal:
    return Principal(USER_ID, "member@example.com", "Member", platform_admin)


@pytest.mark.asyncio
async def test_permission_is_resolved_after_scope_is_established() -> None:
    repository = FakeAuthorizationRepository({"workspace.read"})
    service = AuthorizationService(repository)  # type: ignore[arg-type]
    scope = AuthorizationScope(ORGANIZATION_ID, WORKSPACE_ID)

    context = await service.authorize(principal(), scope, "workspace.read")

    assert context.scope == scope
    assert repository.established == (context.principal, scope)


@pytest.mark.asyncio
async def test_missing_permission_fails_closed() -> None:
    repository = FakeAuthorizationRepository({"workspace.read"})
    service = AuthorizationService(repository)  # type: ignore[arg-type]

    with pytest.raises(PermissionDeniedError, match="document.manage"):
        await service.authorize(
            principal(),
            AuthorizationScope(ORGANIZATION_ID, WORKSPACE_ID),
            "document.manage",
        )
