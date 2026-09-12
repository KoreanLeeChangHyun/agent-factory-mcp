from dataclasses import dataclass


class WorkbenchError(Exception):
    code = "workbench_error"


class WorkbenchNotFoundError(WorkbenchError):
    code = "workbench_not_found"


class WorkbenchPermissionError(WorkbenchError):
    code = "workbench_permission_required"


class WorkbenchArchivedError(WorkbenchError):
    code = "workbench_archived"


@dataclass(slots=True)
class WorkbenchConflictError(WorkbenchError):
    current_revision: int
    code = "workbench_revision_conflict"


@dataclass(slots=True)
class WorkbenchIdempotencyError(WorkbenchError):
    request_key: str
    code = "workbench_idempotency_conflict"


@dataclass(slots=True)
class WorkbenchValidationError(WorkbenchError):
    diagnostics: tuple[str, ...]
    code = "invalid_workbench_definition"
