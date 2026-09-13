"""Run only against an explicitly supplied disposable, migrated PostgreSQL database."""

import asyncio
import os
from uuid import uuid4

import pytest
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.modules.auth.repository import AuthRepository
from app.modules.auth.service import Principal
from app.modules.identity.models import User
from app.modules.organization.models import Organization, OrganizationMembership
from app.modules.workspace.models import Workspace, WorkspaceMembership
from app.modules.workspace.schemas import WorkspaceCreate
from app.router.account import create_personal_workspace


@pytest.mark.integration
@pytest.mark.asyncio
async def test_concurrent_first_personal_creation_with_real_rls():
    url = os.environ.get("WORKSPACE_TEST_DATABASE_URL")
    if not url:
        pytest.skip("requires a disposable migrated WORKSPACE_TEST_DATABASE_URL")
    engine = create_async_engine(url)
    sessions = async_sessionmaker(engine, expire_on_commit=False)
    principal = Principal(uuid4(), f"{uuid4().hex}@example.test", "Workspace Test", False)
    try:
        async with sessions() as session:
            assert not await session.scalar(
                text("SELECT rolsuper FROM pg_roles WHERE rolname = current_user")
            )
            await AuthRepository(session)._enable_identity_lookup()
            session.add(
                User(
                    id=principal.user_id, email=principal.email, display_name=principal.display_name
                )
            )
            await session.commit()

        async def create(slug):
            async with sessions() as session:
                return await create_personal_workspace(
                    WorkspaceCreate(name=slug, slug=slug), principal, session
                )

        first, second = await asyncio.gather(create("first"), create("second"))
        assert first.id != second.id
        assert first.organization_id == second.organization_id
        async with sessions() as session:
            await AuthRepository(session)._enable_identity_lookup()
            assert (
                await session.scalar(
                    select(func.count())
                    .select_from(OrganizationMembership)
                    .where(OrganizationMembership.user_id == principal.user_id)
                )
                == 1
            )
            assert (
                await session.scalar(
                    select(Organization.is_personal).where(Organization.id == first.organization_id)
                )
                is True
            )
            assert (
                await session.scalar(
                    select(func.count())
                    .select_from(WorkspaceMembership)
                    .where(WorkspaceMembership.user_id == principal.user_id)
                )
                == 2
            )
            assert (
                await session.scalar(
                    select(func.count())
                    .select_from(Workspace)
                    .where(Workspace.organization_id == first.organization_id)
                )
                == 2
            )
    finally:
        await engine.dispose()
