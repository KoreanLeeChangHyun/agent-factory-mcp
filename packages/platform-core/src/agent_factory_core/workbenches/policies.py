from collections.abc import Mapping

from .errors import WorkbenchValidationError

# Native standards and customer releases share one registry. Historical releases with
# these descriptors remain immutable but are omitted from authorized projections.
RESERVED_STANDARD_WORKBENCH_IDS = frozenset(
    {"organization", "workspaces", "documents", "account", "administration"}
)


def require_customer_workbench_id(key: str, definition: Mapping[str, object]) -> None:
    """Keep code-owned standard Workbench identifiers outside customer authority."""
    descriptor = definition.get("descriptor")
    descriptor_id = descriptor.get("id") if isinstance(descriptor, Mapping) else None
    if key in RESERVED_STANDARD_WORKBENCH_IDS or descriptor_id in RESERVED_STANDARD_WORKBENCH_IDS:
        raise WorkbenchValidationError(
            ("Workbench identifier is reserved for a standard Workbench",)
        )
