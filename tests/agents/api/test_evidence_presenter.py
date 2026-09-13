from datetime import UTC, datetime
from uuid import uuid4

from api.http.routes.agents.router import present
from agent_factory_core.executions.agents.domain import (
    AgentRun,
    RunArtifact,
    RunDocumentLink,
    RunEvent,
    RunEvidence,
    RunToolCall,
)


def test_evidence_presenter_projects_structured_nested_records() -> None:
    workspace_id, run_id = uuid4(), uuid4()
    run = AgentRun(run_id, workspace_id, uuid4(), uuid4(), uuid4(), "key", {})
    evidence = RunEvidence(
        run,
        (RunEvent(uuid4(), workspace_id, run_id, 1, "run.queued", {}, datetime.now(UTC)),),
        (RunToolCall(uuid4(), workspace_id, run_id, "document.read", "succeeded", {}, {}, None),),
        (RunArtifact(uuid4(), workspace_id, run_id, "result", None, {"sha256": "abc"}),),
        (RunDocumentLink(uuid4(), workspace_id, run_id, uuid4(), "output", "Result"),),
    )

    payload = present(evidence)

    assert payload["run"]["id"] == str(run_id)
    assert payload["events"][0]["event_type"] == "run.queued"
    assert payload["tool_calls"][0]["tool_name"] == "document.read"
    assert payload["documents"][0]["document_title"] == "Result"
