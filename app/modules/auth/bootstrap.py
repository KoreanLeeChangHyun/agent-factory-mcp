"""Create the first platform administrator and personal Workspace."""

import argparse
import re
from datetime import UTC, datetime
from getpass import getpass

from sqlalchemy import func, select, text

from app.db.session import get_session_factory
from app.modules.auth.crypto import hash_password
from app.modules.auth.models import UserCredential
from app.modules.identity.models import User
from app.modules.organization.models import Organization, OrganizationMembership
from app.modules.organization.system_roles import (
    ORGANIZATION_OWNER_ROLE_ID,
    WORKSPACE_OWNER_ROLE_ID,
)
from app.modules.workspace.models import Workspace, WorkspaceMembership


def _slug(value: str) -> str:
    normalized = re.sub(r"[^a-z0-9]+", "-", value.casefold()).strip("-")
    return normalized or "personal"


async def bootstrap_admin(email: str, display_name: str, password: str) -> None:
    """Provision the initial administrator exactly once."""

    normalized_email = email.strip().casefold()
    async with get_session_factory()() as session, session.begin():
        await session.execute(text("SELECT set_config('app.is_platform_admin', 'true', true)"))
        existing = await session.scalar(
            select(User.id).where(func.lower(User.email) == normalized_email)
        )
        if existing is not None:
            raise RuntimeError("A user with that email already exists")

        user = User(
            email=normalized_email,
            display_name=display_name.strip(),
            email_verified_at=datetime.now(UTC),
            is_platform_admin=True,
        )
        organization = Organization(
            name=f"{display_name.strip()} Personal",
            slug=f"{_slug(display_name)}-personal",
            is_personal=True,
        )
        workspace = Workspace(
            organization_id=organization.id,
            name="Personal Workspace",
            slug="personal",
        )
        session.add_all([user, organization])
        await session.flush()
        workspace.organization_id = organization.id
        session.add(workspace)
        await session.flush()
        session.add_all(
            [
                UserCredential(
                    user_id=user.id,
                    password_hash=hash_password(password),
                    password_changed_at=datetime.now(UTC),
                ),
                OrganizationMembership(
                    organization_id=organization.id,
                    user_id=user.id,
                    role_id=ORGANIZATION_OWNER_ROLE_ID,
                ),
                WorkspaceMembership(
                    workspace_id=workspace.id,
                    user_id=user.id,
                    role_id=WORKSPACE_OWNER_ROLE_ID,
                ),
            ]
        )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--email", required=True)
    parser.add_argument("--display-name", required=True)
    args = parser.parse_args()
    password = getpass("Initial administrator password: ")
    if len(password) < 12:
        raise SystemExit("Password must contain at least 12 characters")

    from asyncio import run

    run(bootstrap_admin(args.email, args.display_name, password))


if __name__ == "__main__":
    main()
