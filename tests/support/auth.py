"""Authentication test doubles shared by HTTP and UI contract tests."""

from uuid import UUID

from app.common.errors import AuthenticationError
from app.modules.auth.service import Principal


class PageAuthService:
    """Return a stable page principal or emulate a missing session."""

    def __init__(self, authenticated: bool) -> None:
        self.authenticated = authenticated

    async def authenticate_session(self, token: str | None) -> Principal:
        del token
        if not self.authenticated:
            raise AuthenticationError("authentication_required")
        return Principal(
            user_id=UUID("11111111-1111-4111-8111-111111111111"),
            email="owner@example.com",
            display_name="Owner",
            is_platform_admin=True,
        )
