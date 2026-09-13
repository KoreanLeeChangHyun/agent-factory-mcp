"""Import contract examples and deterministic hierarchy rejection."""

from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.modules.planning.import_schemas import ImportProposal
from app.modules.planning.import_service import build_preview


def proposal(provider="excel", **changes):
    payload = {
        "request_key": str(uuid4()),
        "source": {
            "provider": provider,
            "external_id": "stable-document-id",
            "label": "원본 일정",
            "read_scope": "개발 작업 전체",
            "complete": True,
        },
        "items": [
            {
                "source_id": "api",
                "parent_source_id": "login",
                "kind": "issue",
                "name": "API",
                "target_date": "2026-09-10",
            },
            {"source_id": "auth", "kind": "domain", "name": "인증"},
            {
                "source_id": "login",
                "parent_source_id": "auth",
                "kind": "feature",
                "name": "로그인",
                "start_date": "2026-09-07",
                "target_date": "2026-09-11",
                "status": "active",
                "original_values": {"상태": "Doing"},
                "corrections": [
                    {"field": "status", "original": "Doing", "reason": "진행 중에 대응"}
                ],
            },
        ],
    }
    payload.update(changes)
    return ImportProposal.model_validate(payload)


@pytest.mark.parametrize("provider", ["excel", "google_sheets", "notion", "jira"])
def test_four_source_examples_preserve_provenance_and_resolve_unordered_parents(provider):
    result = build_preview(proposal(provider), [], [])
    assert result["can_apply"]
    ops = {o["source_id"]: o for o in result["operations"]}
    assert ops["api"]["parent_id"] == ops["login"]["id"]
    assert ops["login"]["parent_id"] == ops["auth"]["id"]
    assert ops["login"]["original_values"] == {"상태": "Doing"}
    assert len(result["warnings"]) == 1


@pytest.mark.parametrize(
    "mutation",
    ["duplicate", "cycle", "missing", "incomplete", "question", "domain_status", "issue_start"],
)
def test_invalid_proposals_cannot_apply(mutation):
    p = proposal()
    if mutation == "duplicate":
        p.items.append(p.items[0])
    if mutation == "cycle":
        p.items[1].parent_source_id = "login"
    if mutation == "missing":
        p.items[0].parent_source_id = "absent"
    if mutation == "incomplete":
        p.source.complete = False
    if mutation == "question":
        p.items[0].questions = ["6/3의 연도?"]
    if mutation == "domain_status":
        p.items[1].status = "done"
    if mutation == "issue_start":
        p.items[0].start_date = p.items[2].start_date
    assert not build_preview(p, [], [])["can_apply"]


def test_invalid_dates_and_empty_names_fail_contract():
    p = proposal().model_dump(mode="json")
    p["items"][0]["name"] = " "
    with pytest.raises(ValidationError):
        ImportProposal.model_validate(p)
    p["items"][0]["name"] = "API"
    p["items"][2]["target_date"] = "2026-01-01"
    with pytest.raises(ValidationError):
        ImportProposal.model_validate(p)


def test_import_domain_dates_preserved_and_child_bounds_warn():
    p = proposal()
    p.items[1].start_date = p.items[0].target_date
    result = build_preview(p, [], [])
    assert result["can_apply"]
    assert any("상위 작업 기간 밖" in w for w in result["warnings"])
    assert (
        next(o for o in result["operations"] if o["kind"] == "domain")["after"]["start_date"]
        == "2026-09-10"
    )
