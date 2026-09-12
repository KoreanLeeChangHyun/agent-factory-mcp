"""Detect structural breaking changes in the bounded Workbench JSON Schema vocabulary."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any


def breaking_changes(
    previous: dict[str, Any], current: dict[str, Any], path: str = "$"
) -> list[str]:
    findings: list[str] = []
    if "const" in current and previous.get("const", object()) != current["const"]:
        findings.append(f"{path}: introduced or changed const")
    if "pattern" in current and previous.get("pattern") != current["pattern"]:
        findings.append(f"{path}: introduced or changed pattern")
    if "format" in current and previous.get("format") != current["format"]:
        findings.append(f"{path}: introduced or changed format")
    if (
        current.get("additionalProperties") is False
        and previous.get("additionalProperties") is not False
    ):
        findings.append(f"{path}: closed an object that previously allowed extra properties")
    current_additional = current.get("additionalProperties")
    previous_additional = previous.get("additionalProperties")
    if isinstance(current_additional, dict):
        if previous_additional is None or previous_additional is True:
            findings.append(f"{path}: constrained additional properties")
        elif isinstance(previous_additional, dict):
            findings.extend(
                breaking_changes(
                    previous_additional,
                    current_additional,
                    f"{path}.additionalProperties",
                )
            )
    if current.get("uniqueItems") is True and previous.get("uniqueItems") is not True:
        findings.append(f"{path}: introduced uniqueItems")
    old_required = set(previous.get("required", []))
    new_required = set(current.get("required", []))
    for name in sorted(new_required - old_required):
        findings.append(f"{path}: newly required property {name!r}")
    old_properties = previous.get("properties", {})
    new_properties = current.get("properties", {})
    if previous.get("additionalProperties") is False:
        for name in sorted(set(old_properties) - set(new_properties)):
            findings.append(f"{path}: removed property {name!r}")
    for name in sorted(set(old_properties) & set(new_properties)):
        findings.extend(
            breaking_changes(old_properties[name], new_properties[name], f"{path}.{name}")
        )
    if "enum" in current:
        removed = (
            set(previous["enum"]) - set(current["enum"])
            if "enum" in previous
            else set(current["enum"])
        )
        if removed:
            detail = "introduced enum" if "enum" not in previous else "removed enum values"
            findings.append(f"{path}: {detail} {sorted(removed)!r}")
    old_types = (
        set(previous.get("type", []))
        if isinstance(previous.get("type"), list)
        else {previous.get("type")}
    )
    new_types = (
        set(current.get("type", []))
        if isinstance(current.get("type"), list)
        else {current.get("type")}
    )
    old_types.discard(None)
    new_types.discard(None)
    if not old_types and new_types:
        findings.append(f"{path}: introduced type restriction {sorted(new_types)!r}")
    elif old_types and new_types and not old_types <= new_types:
        findings.append(
            f"{path}: narrowed types from {sorted(old_types)!r} to {sorted(new_types)!r}"
        )
    for keyword in ("maxLength", "maxItems", "maxProperties", "maximum"):
        if keyword in current and (keyword not in previous or current[keyword] < previous[keyword]):
            findings.append(f"{path}: narrowed {keyword}")
    for keyword in ("minLength", "minItems", "minProperties", "minimum"):
        if keyword in current and (keyword not in previous or current[keyword] > previous[keyword]):
            findings.append(f"{path}: narrowed {keyword}")
    for keyword in ("$ref", "propertyNames", "oneOf", "anyOf", "allOf", "not"):
        if keyword in current and previous.get(keyword) != current[keyword]:
            findings.append(f"{path}: introduced or changed {keyword}")
    for keyword in ("items", "contains"):
        if keyword in current:
            if keyword not in previous:
                findings.append(f"{path}: introduced {keyword}")
            elif isinstance(previous[keyword], dict) and isinstance(current[keyword], dict):
                findings.extend(
                    breaking_changes(previous[keyword], current[keyword], f"{path}.{keyword}")
                )
    old_patterns = previous.get("patternProperties", {})
    new_patterns = current.get("patternProperties", {})
    for pattern in sorted(set(old_patterns) - set(new_patterns)):
        findings.append(f"{path}: removed pattern property {pattern!r}")
    if previous.get("additionalProperties") is not False:
        for pattern in sorted(set(new_patterns) - set(old_patterns)):
            findings.append(f"{path}: introduced restricting pattern property {pattern!r}")
    for pattern in sorted(set(old_patterns) & set(new_patterns)):
        findings.extend(
            breaking_changes(
                old_patterns[pattern],
                new_patterns[pattern],
                f"{path}.patternProperties[{pattern!r}]",
            )
        )
    return findings


def load(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text())


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("previous", nargs="?", type=Path)
    parser.add_argument("current", nargs="?", type=Path)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    if args.previous and args.current:
        findings = breaking_changes(load(args.previous), load(args.current))
        if findings:
            raise SystemExit("\n".join(findings))
        return 0
    compatible = root / "contracts/compatibility/compatible"
    breaking = root / "contracts/compatibility/breaking"
    if breaking_changes(
        load(compatible / "base.schema.json"), load(compatible / "candidate.schema.json")
    ):
        raise SystemExit("compatible fixture was incorrectly classified as breaking")
    findings = breaking_changes(
        load(breaking / "base.schema.json"), load(breaking / "candidate.schema.json")
    )
    if not findings:
        raise SystemExit("breaking fixture was not detected")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
