from __future__ import annotations

import re
from collections.abc import Mapping
from uuid import UUID

from agent_factory_core.identity import Principal
from agent_factory_core.shared.errors import ApplicationError, PermissionDeniedError

from .domain import Dashboard, FeatureFlag, RuntimeInfo
from .ports import PlatformAdministrationRepository, RuntimeInformation

_FLAG_KEY = re.compile(r"^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$")
_MAX_FLAGS = 200
_MAX_RULE_WORKSPACES = 500


class PlatformAdministration:
    def __init__(
        self, repository: PlatformAdministrationRepository, runtime: RuntimeInformation
    ) -> None:
        self._repository = repository
        self._runtime = runtime
        self._principal: Principal | None = None

    async def establish(self, principal: Principal) -> None:
        if not principal.is_platform_admin or not await self._repository.authorize_and_establish(
            principal
        ):
            await self._repository.rollback()
            raise PermissionDeniedError("platform_admin_required")
        self._principal = principal

    def require_established(self) -> Principal:
        if self._principal is None:
            raise PermissionDeniedError("platform_admin_context_required")
        return self._principal

    async def dashboard(self) -> Dashboard:
        self.require_established()
        return await self._repository.dashboard()

    async def flags(self) -> list[FeatureFlag]:
        self.require_established()
        return await self._repository.list_flags(limit=_MAX_FLAGS)

    async def set_flag(
        self, key: str, enabled: bool, description: str, rules: Mapping[str, object]
    ) -> FeatureFlag:
        self.require_established()
        normalized_rules = self._validate_flag(key, description, rules)
        try:
            flag = await self._repository.set_flag(
                key=key, enabled=enabled, description=description, rules=normalized_rules
            )
            await self._repository.commit()
            return flag
        except Exception:
            await self._repository.rollback()
            raise

    async def runtime_info(self) -> RuntimeInfo:
        self.require_established()
        return RuntimeInfo(
            application_version=self._runtime.application_version,
            migration_version=await self._repository.migration_version(),
            environment=self._runtime.environment,
            debug=self._runtime.debug,
            embedding_provider=self._runtime.embedding_provider,
        )

    @staticmethod
    def _validate_flag(
        key: str, description: str, rules: Mapping[str, object]
    ) -> dict[str, object]:
        if len(key) > 120 or _FLAG_KEY.fullmatch(key) is None:
            raise ApplicationError("invalid_feature_flag_key", "Invalid feature flag key")
        if len(description) > 500:
            raise ApplicationError("invalid_feature_flag_description", "Description is too long")
        if set(rules) - {"workspaceIds", "organizationIds"}:
            raise ApplicationError("invalid_feature_flag_rules", "Unknown feature flag rule")
        normalized: dict[str, object] = {}
        for rule_key in ("workspaceIds", "organizationIds"):
            identifiers = rules.get(rule_key)
            if identifiers is None:
                continue
            if not isinstance(identifiers, list) or len(identifiers) > _MAX_RULE_WORKSPACES:
                raise ApplicationError("invalid_feature_flag_rules", "Invalid rollout identifiers")
            values: list[str] = []
            for value in identifiers:
                if not isinstance(value, str) or len(value) > 36:
                    raise ApplicationError(
                        "invalid_feature_flag_rules", "Invalid rollout identifiers"
                    )
                try:
                    UUID(value)
                except ValueError as exc:
                    raise ApplicationError(
                        "invalid_feature_flag_rules", "Invalid rollout identifiers"
                    ) from exc
                values.append(value)
            normalized[rule_key] = values
        return normalized


def react_workbench_enabled(
    *,
    is_enabled: bool,
    rules: Mapping[str, object],
    organization_id: UUID,
    workspace_id: UUID,
) -> bool:
    """Fail closed unless the global flag and explicit Workspace rollout both match."""
    if not is_enabled:
        return False
    workspace_ids = rules.get("workspaceIds")
    if not isinstance(workspace_ids, list) or any(
        not isinstance(item, str) for item in workspace_ids
    ):
        return False
    if str(workspace_id) not in workspace_ids and workspace_id.hex not in workspace_ids:
        return False
    organization_ids = rules.get("organizationIds")
    if organization_ids is None:
        return True
    return (
        isinstance(organization_ids, list)
        and all(isinstance(item, str) for item in organization_ids)
        and (str(organization_id) in organization_ids or organization_id.hex in organization_ids)
    )
