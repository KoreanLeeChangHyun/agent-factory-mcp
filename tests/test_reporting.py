"""Pure reporting contract tests, independent of legacy execution."""

from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.common.errors import ConflictError
from app.modules.reporting.schemas import Command, ResultWrite, TaskUpdate
from app.modules.reporting.service import TRANSITIONS, transition


@pytest.mark.parametrize("old", list(TRANSITIONS))
@pytest.mark.parametrize("new", list(TRANSITIONS))
def test_every_transition(old, new):
    if new in TRANSITIONS[old]:
        transition(old, new)
    else:
        with pytest.raises(ConflictError):
            transition(old, new)


@pytest.mark.parametrize(
    "url",
    [
        "javascript:alert(1)",
        "//example.com",
        "https://user:password@example.com",
        "file:///etc/passwd",
        "https://example.com/\nfoo",
        "https://",
    ],
)
def test_unsafe_results(url):
    with pytest.raises(ValidationError):
        ResultWrite(label="result", url=url)


def test_closed_bounded_payloads():
    with pytest.raises(ValidationError):
        Command(
            key="x",
            operation="task",
            task={
                "id": str(uuid4()),
                "agent_id": str(uuid4()),
                "name": "a",
                "owner_user_id": str(uuid4()),
            },
        )
    with pytest.raises(ValidationError):
        Command(key="x", operation="agent")
    with pytest.raises(ValidationError):
        ResultWrite(label="a", document_id=uuid4(), url="https://example.com")
    for progress in (-1, 101, True, 12.5):
        with pytest.raises(ValidationError):
            TaskUpdate(
                id=uuid4(), revision=1, status="in_progress", message="working", progress=progress
            )
    with pytest.raises(ValidationError):
        Command(
            key="large",
            operation="report",
            report={
                "id": str(uuid4()),
                "revision": 1,
                "status": "in_progress",
                "message": "x",
                "results": [{"label": "a", "summary": "x" * 10000}] * 7,
            },
        )
    with pytest.raises(ValidationError):
        TaskUpdate(
            id=uuid4(), revision=1, status="in_progress", message="x", results=[{"label": "a"}] * 21
        )


def test_unknown_progress_stays_unknown_in_contract():
    report = TaskUpdate(id=uuid4(), revision=1, status="completed", message="finished")
    assert report.progress is None


def test_discoverable_guide_examples_match_command_schema():
    import json
    import re
    from pathlib import Path

    guide = Path(".codex/skills/spec-platform/references/external-agent-reporting.md").read_text()
    examples = re.findall(r"```json\n(.*?)\n```", guide, re.DOTALL)
    assert len(examples) >= 7
    for example in examples:
        value = json.loads(example)
        if "command" in value:
            Command.model_validate(value["command"])
        else:
            ResultWrite.model_validate(value)
