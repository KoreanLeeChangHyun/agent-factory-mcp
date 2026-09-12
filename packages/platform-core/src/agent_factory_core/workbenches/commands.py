from __future__ import annotations

import hashlib
import json
import re
from collections.abc import Mapping
from uuid import UUID

from .domain import (
    WorkbenchActor,
    WorkbenchDefinitionAggregate,
    WorkbenchDefinitionState,
    WorkbenchRelease,
)
from .errors import WorkbenchArchivedError, WorkbenchNotFoundError, WorkbenchValidationError
from .ports import WorkbenchRepository, WorkbenchValidator
from .queries import require

KEY = re.compile(r"^[a-z][a-z0-9-]{0,63}$")


def _bounded(value: str, label: str, maximum: int) -> str:
    candidate = value.strip()
    if not candidate or len(candidate) > maximum:
        raise WorkbenchValidationError((f"{label} must contain 1-{maximum} characters",))
    return candidate


def _command_digest(definition_id: UUID, revision: int, request_key: str) -> str:
    value = {
        "definitionId": definition_id.hex,
        "expectedRevision": revision,
        "requestKey": request_key,
    }
    encoded = json.dumps(value, sort_keys=True, separators=(",", ":")).encode()
    return hashlib.sha256(encoded).hexdigest()


class CreateWorkbenchDefinition:
    def __init__(self, repository: WorkbenchRepository, validator: WorkbenchValidator) -> None:
        self.repository, self.validator = repository, validator

    async def execute(
        self, actor: WorkbenchActor, *, key: str, title: str, definition: Mapping[str, object]
    ) -> WorkbenchDefinitionAggregate:
        require(actor, "workbench.create")
        if not KEY.fullmatch(key):
            raise WorkbenchValidationError(("key must be a lower-case Workbench identifier",))
        validated = self.validator.validate(definition)
        descriptor = validated.definition.get("descriptor")
        if not isinstance(descriptor, Mapping) or descriptor.get("id") != key:
            raise WorkbenchValidationError(("descriptor.id must equal the definition key",))
        return await self.repository.create_definition(
            actor, key=key, title=_bounded(title, "title", 200), validated=validated
        )


class UpdateWorkbenchDefinition:
    def __init__(self, repository: WorkbenchRepository, validator: WorkbenchValidator) -> None:
        self.repository, self.validator = repository, validator

    async def execute(
        self,
        actor: WorkbenchActor,
        definition_id: UUID,
        *,
        title: str,
        definition: Mapping[str, object],
        expected_revision: int,
    ) -> WorkbenchDefinitionAggregate:
        require(actor, "workbench.update")
        current = await self.repository.get_definition(actor, definition_id, include_archived=True)
        if current is None:
            raise WorkbenchNotFoundError(str(definition_id))
        if current.state is WorkbenchDefinitionState.ARCHIVED:
            raise WorkbenchArchivedError(str(definition_id))
        validated = self.validator.validate(definition)
        descriptor = validated.definition.get("descriptor")
        if not isinstance(descriptor, Mapping) or descriptor.get("id") != current.key:
            raise WorkbenchValidationError(("descriptor.id must equal the stable definition key",))
        return await self.repository.update_definition(
            actor,
            definition_id,
            title=_bounded(title, "title", 200),
            validated=validated,
            expected_revision=expected_revision,
        )


class SetWorkbenchArchived:
    def __init__(self, repository: WorkbenchRepository) -> None:
        self.repository = repository

    async def execute(
        self, actor: WorkbenchActor, definition_id: UUID, *, archived: bool, expected_revision: int
    ) -> WorkbenchDefinitionAggregate:
        require(actor, "workbench.archive" if archived else "workbench.restore")
        return await self.repository.set_archived(
            actor, definition_id, archived=archived, expected_revision=expected_revision
        )


class PublishWorkbenchDefinition:
    def __init__(self, repository: WorkbenchRepository, validator: WorkbenchValidator) -> None:
        self.repository, self.validator = repository, validator

    async def execute(
        self,
        actor: WorkbenchActor,
        definition_id: UUID,
        *,
        expected_revision: int,
        request_key: str,
    ) -> WorkbenchRelease:
        require(actor, "workbench.publish")
        key = _bounded(request_key, "requestKey", 160)
        current = await self.repository.get_definition(actor, definition_id, include_archived=True)
        if current is None:
            raise WorkbenchNotFoundError(str(definition_id))
        if current.state is WorkbenchDefinitionState.ARCHIVED:
            raise WorkbenchArchivedError(str(definition_id))
        return await self.repository.publish(
            actor,
            definition_id,
            validated=self.validator.validate(current.draft),
            expected_revision=expected_revision,
            request_key=key,
            command_digest=_command_digest(definition_id, expected_revision, key),
        )
