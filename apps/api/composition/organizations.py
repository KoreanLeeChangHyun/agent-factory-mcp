"""Organization composition root for target HTTP and MCP adapters."""

from agent_factory_adapters.identity import SystemClock
from agent_factory_adapters.organizations import (
    PostgresOrganizationRepository,
    SystemInvitationTokens,
)
from agent_factory_core.organizations.ports import InvitationEmail
from agent_factory_core.organizations.use_cases import OrganizationUseCases
from sqlalchemy.ext.asyncio import AsyncSession


def organization_use_cases(
    session: AsyncSession,
    *,
    token_secret: str,
    email: InvitationEmail,
) -> OrganizationUseCases:
    return OrganizationUseCases(
        PostgresOrganizationRepository(session),
        SystemClock(),
        SystemInvitationTokens(token_secret),
        email,
    )
