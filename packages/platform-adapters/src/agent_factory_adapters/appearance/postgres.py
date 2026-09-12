from __future__ import annotations

import json
import logging
from collections.abc import Mapping
from uuid import UUID

from agent_factory_core import (
    ThemeBase,
    ThemeConflictError,
    ThemeDensity,
    ThemeProfile,
    ThemeUpdate,
)
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

LOGGER = logging.getLogger(__name__)


class PostgresThemeProfileRepository:
    def __init__(self, session: AsyncSession, *, request_id: str | None = None) -> None:
        self.session = session
        self.request_id = request_id

    async def _apply_user_context(self, user_id: UUID) -> None:
        await self.session.execute(
            text("SELECT set_config('app.current_user_id', :user_id, true)"),
            {"user_id": str(user_id)},
        )
        await self.session.execute(
            text("SELECT set_config('app.is_platform_admin', 'false', true)")
        )

    @staticmethod
    def _profile(row: Mapping[str, object]) -> ThemeProfile:
        raw_overrides = row["overrides"]
        if not isinstance(raw_overrides, Mapping) or not all(
            isinstance(key, str) and isinstance(value, str) for key, value in raw_overrides.items()
        ):
            raise ValueError("stored theme overrides must be a string mapping")
        return ThemeProfile(
            user_id=UUID(str(row["user_id"])),
            revision=int(str(row["revision"])),
            base=ThemeBase(str(row["base"])),
            density=ThemeDensity(str(row["density"])),
            overrides=dict(raw_overrides),
            reduced_motion=bool(row["reduced_motion"]),
        )

    async def get(self, user_id: UUID) -> ThemeProfile | None:
        await self._apply_user_context(user_id)
        result = await self.session.execute(
            text(
                "SELECT user_id, revision, base, density, overrides, reduced_motion "
                "FROM user_theme_profiles WHERE user_id = :user_id"
            ),
            {"user_id": user_id},
        )
        row = result.mappings().one_or_none()
        return self._profile(row) if row else None

    async def save(self, user_id: UUID, update: ThemeUpdate) -> ThemeProfile:
        await self._apply_user_context(user_id)
        values = {
            "user_id": user_id,
            "base": update.base.value,
            "density": update.density.value,
            "overrides": json.dumps(dict(update.overrides), separators=(",", ":")),
            "reduced_motion": update.reduced_motion,
            "expected_revision": update.expected_revision,
        }
        if update.expected_revision == 0:
            statement = text(
                "INSERT INTO user_theme_profiles "
                "(user_id, revision, base, density, overrides, reduced_motion) "
                "VALUES (:user_id, 1, :base, :density, CAST(:overrides AS jsonb), :reduced_motion) "
                "ON CONFLICT (user_id) DO NOTHING "
                "RETURNING user_id, revision, base, density, overrides, reduced_motion"
            )
        else:
            statement = text(
                "UPDATE user_theme_profiles SET revision = revision + 1, base = :base, "
                "density = :density, overrides = CAST(:overrides AS jsonb), reduced_motion = :reduced_motion, "
                "updated_at = now() WHERE user_id = :user_id AND revision = :expected_revision "
                "RETURNING user_id, revision, base, density, overrides, reduced_motion"
            )
        result = await self.session.execute(statement, values)
        row = result.mappings().one_or_none()
        if row is None:
            await self.session.rollback()
            current = await self.get(user_id)
            raise ThemeConflictError(current or ThemeProfile.default(user_id))
        profile = self._profile(row)
        await self.session.commit()
        await self._audit(profile)
        return profile

    async def _audit(self, profile: ThemeProfile) -> None:
        try:
            await self._append_audit(profile)
            await self.session.commit()
        except Exception:
            await self.session.rollback()
            LOGGER.exception("theme profile audit append failed")

    async def _append_audit(self, profile: ThemeProfile) -> None:
        await self.session.execute(text("SELECT set_config('app.is_platform_admin', 'true', true)"))
        await self.session.execute(
            text(
                "INSERT INTO audit_events "
                "(id, occurred_at, actor_user_id, action, target_type, target_id, outcome, "
                "request_id, source, event_metadata) VALUES "
                "(gen_random_uuid(), now(), :user_id, 'appearance.theme.update', "
                "'theme_profile', :user_id_text, 'success', :request_id, 'http', "
                "CAST(:metadata AS jsonb))"
            ),
            {
                "user_id": profile.user_id,
                "user_id_text": str(profile.user_id),
                "request_id": self.request_id,
                "metadata": f'{{"revision":{profile.revision}}}',
            },
        )
