"""Fail-closed selection of the React Workbench for an authorized Workspace."""

from collections.abc import Mapping
from uuid import UUID

WORKBENCH_FEATURE_KEY = "react-workbench"


def react_workbench_enabled(
    *,
    is_enabled: bool,
    rules: Mapping[str, object],
    organization_id: UUID,
    workspace_id: UUID,
) -> bool:
    """Require both the global switch and an explicit Workspace allowlist entry."""
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
