"""Compatibility import for the core-owned permission catalog."""

from agent_factory_core.organizations.permissions import (
    ACTION_LABELS,
    CATALOG,
    DEFAULT_ORGANIZATION_MEMBER,
    DEFAULT_WORKSPACE_MEMBER,
    DEFAULT_WORKSPACE_VIEWER,
    LEGACY_EXPANSIONS,
    ORGANIZATION_PERMISSIONS,
    PERMISSION_NOTES,
    RESOURCE_ACTIONS,
    TOKEN_ALIASES,
    WORKSPACE_PERMISSIONS,
    PermissionDefinition,
    token_permissions,
    validate_permissions,
)

__all__ = [
    "ACTION_LABELS",
    "CATALOG",
    "DEFAULT_ORGANIZATION_MEMBER",
    "DEFAULT_WORKSPACE_MEMBER",
    "DEFAULT_WORKSPACE_VIEWER",
    "LEGACY_EXPANSIONS",
    "ORGANIZATION_PERMISSIONS",
    "PERMISSION_NOTES",
    "RESOURCE_ACTIONS",
    "TOKEN_ALIASES",
    "WORKSPACE_PERMISSIONS",
    "PermissionDefinition",
    "token_permissions",
    "validate_permissions",
]
