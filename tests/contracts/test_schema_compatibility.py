from tests.tools.check_workbench_schema_compatibility import breaking_changes


def test_detects_real_breaking_changes() -> None:
    previous = {"type": "object", "required": [], "properties": {"mode": {"enum": ["a", "b"]}}}
    current = {"type": "object", "required": ["mode"], "properties": {"mode": {"enum": ["a"]}}}
    findings = breaking_changes(previous, current)
    assert any("newly required" in finding for finding in findings)
    assert any("removed enum" in finding for finding in findings)


def test_allows_additive_optional_property() -> None:
    previous = {"type": "object", "required": [], "properties": {}}
    current = {"type": "object", "required": [], "properties": {"label": {"type": "string"}}}
    assert breaking_changes(previous, current) == []


def test_detects_const_pattern_and_object_closure() -> None:
    previous = {
        "type": "object",
        "additionalProperties": True,
        "properties": {
            "schemaVersion": {"const": "1.0"},
            "label": {"type": "string"},
        },
    }
    current = {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "schemaVersion": {"const": "2.0"},
            "label": {"type": "string", "pattern": "^a$"},
        },
    }
    findings = breaking_changes(previous, current)
    assert any("changed const" in finding for finding in findings)
    assert any("changed pattern" in finding for finding in findings)
    assert any("closed an object" in finding for finding in findings)


def test_allows_removed_pattern_and_opening_object() -> None:
    previous = {
        "type": "object",
        "additionalProperties": False,
        "properties": {"label": {"type": "string", "pattern": "^a$"}},
    }
    current = {
        "type": "object",
        "additionalProperties": True,
        "properties": {"label": {"type": "string"}},
    }
    assert breaking_changes(previous, current) == []
