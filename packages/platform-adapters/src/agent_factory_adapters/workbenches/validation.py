from __future__ import annotations

import hashlib
import json
from collections.abc import Mapping
from pathlib import Path

from agent_factory_contracts import ContractValidationError, validate
from agent_factory_contracts.generated.schema_bundle import SCHEMAS
from agent_factory_core.workbenches import ValidatedWorkbench, WorkbenchValidationError

CATALOG = {
    item["id"]: item
    for item in json.loads(Path(__file__).with_name("catalog.json").read_text(encoding="utf-8"))
}
OPERATIONS = {
    "documents-list@1": frozenset({"workspaceId"}),
    "document-read@1": frozenset({"documentId"}),
}


def _schema_digest() -> str:
    relevant = {
        key: value for key, value in SCHEMAS.items() if key.startswith("schemas/workbench/v1/")
    }
    encoded = json.dumps(
        relevant, ensure_ascii=False, sort_keys=True, separators=(",", ":")
    ).encode()
    return f"sha256:{hashlib.sha256(encoded).hexdigest()}"


class ContractWorkbenchValidator:
    """Apply the generated v1 contract before data crosses the persistence boundary."""

    def validate(self, definition: Mapping[str, object]) -> ValidatedWorkbench:
        candidate = json.loads(json.dumps(dict(definition), ensure_ascii=False))
        try:
            validate(candidate)
        except ContractValidationError as error:
            raise WorkbenchValidationError((str(error),)) from error
        diagnostics = _diagnose(candidate)
        if diagnostics:
            raise WorkbenchValidationError(tuple(diagnostics))
        encoded = json.dumps(
            candidate, ensure_ascii=False, sort_keys=True, separators=(",", ":")
        ).encode()
        return ValidatedWorkbench(
            definition=candidate,
            schema_version="1.0",
            schema_digest=_schema_digest(),
            asset_version="1",
            definition_digest=f"sha256:{hashlib.sha256(encoded).hexdigest()}",
        )


def _diagnose(definition: Mapping[str, object]) -> list[str]:
    diagnostics: list[str] = []
    descriptor = definition["descriptor"]
    sidebar = definition["sidebar"]
    panel = definition["panel"]
    bindings = definition["bindings"]
    actions = definition["actions"]
    assert (
        isinstance(descriptor, Mapping)
        and isinstance(sidebar, Mapping)
        and isinstance(panel, Mapping)
    )
    assert isinstance(bindings, list) and isinstance(actions, list)
    action_map: dict[str, Mapping[str, object]] = {}
    binding_ids: set[str] = set()
    for index, raw in enumerate(bindings):
        assert isinstance(raw, Mapping)
        binding_id = str(raw["id"])
        if binding_id in binding_ids:
            diagnostics.append(f"$.bindings[{index}].id: duplicate binding ID")
        binding_ids.add(binding_id)
        operation = OPERATIONS.get(str(raw["source"]))
        if operation is None:
            diagnostics.append(f"$.bindings[{index}].source: unknown operation {raw['source']}")
        else:
            mappings = raw["inputMappings"]
            assert isinstance(mappings, list)
            mapped = [str(mapping["input"]) for mapping in mappings if isinstance(mapping, Mapping)]
            if len(mapped) != len(set(mapped)) or frozenset(mapped) != operation:
                diagnostics.append(
                    f"$.bindings[{index}].inputMappings: inputs must exactly match the operation"
                )
    for index, raw in enumerate(actions):
        assert isinstance(raw, Mapping)
        action_id = str(raw["id"])
        if action_id in action_map:
            diagnostics.append(f"$.actions[{index}].id: duplicate action ID")
        action_map[action_id] = raw
        if raw["kind"] == "navigate-internal" and not raw.get("target"):
            diagnostics.append(f"$.actions[{index}].target: internal navigation requires a target")
        if raw["kind"] == "refresh" and raw.get("target") not in binding_ids:
            diagnostics.append(f"$.actions[{index}].target: refresh requires a declared binding")
        if (
            raw["kind"] == "submit"
            and raw.get("payloadBinding")
            and raw["payloadBinding"] not in binding_ids
        ):
            diagnostics.append(f"$.actions[{index}].payloadBinding: unknown binding")
    roots = (
        (descriptor["icon"], "$.descriptor.icon", "task-list"),
        (sidebar["asset"], "$.sidebar.asset", "sidebar"),
        (panel["asset"], "$.panel.asset", "panel"),
    )
    for asset_id, path, region in roots:
        asset = CATALOG.get(str(asset_id))
        if asset is None:
            diagnostics.append(f"{path}: unknown asset {asset_id}")
        elif region not in asset["allowedRegions"]:
            diagnostics.append(f"{path}: asset is not allowed in {region}")
    for region, layout in (("sidebar", sidebar), ("panel", panel)):
        layout_asset = CATALOG.get(str(layout["asset"]))
        _actions(
            diagnostics, f"$.{region}.actions", layout.get("actions", []), action_map, layout_asset
        )
        components = layout["components"]
        assert isinstance(components, list)
        by_id = {
            str(component["id"]): component
            for component in components
            if isinstance(component, Mapping)
        }
        if len(by_id) != len(components):
            diagnostics.append(f"$.{region}.components: duplicate component ID")
        for index, raw in enumerate(components):
            assert isinstance(raw, Mapping)
            path = f"$.{region}.components[{index}]"
            asset = CATALOG.get(str(raw["asset"]))
            if asset is None:
                diagnostics.append(f"{path}.asset: unknown asset {raw['asset']}")
                continue
            if region not in asset["allowedRegions"] or asset["kind"] in {
                "icon",
                "sidebar",
                "panel",
            }:
                diagnostics.append(f"{path}.asset: asset cannot be inserted in {region}")
            if raw.get("state") and raw["state"] not in asset["states"]:
                diagnostics.append(f"{path}.state: unsupported asset state")
            properties = raw.get("props", {})
            assert isinstance(properties, Mapping)
            parameters = {parameter["name"]: parameter for parameter in asset["properties"]}
            for name in properties:
                if name not in parameters:
                    diagnostics.append(
                        f"{path}.props.{name}: property is not declared by the asset"
                    )
            for name, parameter in parameters.items():
                if parameter["required"] and name not in properties:
                    diagnostics.append(f"{path}.props.{name}: required asset property is missing")
                elif name in properties:
                    _parameter(diagnostics, f"{path}.props.{name}", properties[name], parameter)
            if raw.get("binding") and raw["binding"] not in binding_ids:
                diagnostics.append(f"{path}.binding: unknown binding")
            _actions(diagnostics, f"{path}.actions", raw.get("actions", []), action_map, asset)
            parent_id = raw.get("parentId")
            parent = by_id.get(str(parent_id)) if parent_id else None
            if parent_id and parent is None:
                diagnostics.append(f"{path}.parentId: unknown parent")
                continue
            owner = CATALOG.get(str(parent["asset"])) if parent else layout_asset
            slots = owner["slots"] if owner else []
            assert isinstance(slots, list)
            if raw["slot"] not in slots:
                diagnostics.append(f"{path}.slot: slot is not declared by its parent")
            seen = {str(raw["id"])}
            depth = 0
            while parent is not None:
                parent_key = str(parent["id"])
                if parent_key in seen:
                    diagnostics.append(f"{path}.parentId: component cycle")
                    break
                seen.add(parent_key)
                depth += 1
                if depth > 6:
                    diagnostics.append(f"{path}.parentId: component tree exceeds depth 6")
                    break
                next_id = parent.get("parentId")
                parent = by_id.get(str(next_id)) if next_id else None
    return diagnostics


def _actions(
    diagnostics: list[str],
    path: str,
    identifiers: object,
    actions: Mapping[str, Mapping[str, object]],
    asset: Mapping[str, object] | None,
) -> None:
    assert isinstance(identifiers, list)
    supported = asset["actions"] if asset else []
    assert isinstance(supported, list)
    for identifier in identifiers:
        action = actions.get(str(identifier))
        if action is None:
            diagnostics.append(f"{path}: unknown action {identifier}")
        elif action["kind"] not in supported:
            diagnostics.append(f"{path}: {action['kind']} is not supported by this asset")


def _parameter(
    diagnostics: list[str], path: str, value: object, parameter: Mapping[str, object]
) -> None:
    kind = parameter["type"]
    valid = {
        "string": isinstance(value, str),
        "number": isinstance(value, int | float) and not isinstance(value, bool),
        "integer": isinstance(value, int) and not isinstance(value, bool),
        "boolean": isinstance(value, bool),
        "string-list": isinstance(value, list) and all(isinstance(item, str) for item in value),
        "record-list": isinstance(value, list) and all(isinstance(item, Mapping) for item in value),
    }.get(str(kind), False)
    if not valid:
        diagnostics.append(f"{path}: expected {kind}")
        return
    if isinstance(value, str):
        if parameter.get("maxLength") and len(value) > int(str(parameter["maxLength"])):
            diagnostics.append(f"{path}: string exceeds the asset maximum")
        enum = parameter.get("enum")
        if isinstance(enum, list) and enum and value not in enum:
            diagnostics.append(f"{path}: value is not declared by the asset")
    if (
        isinstance(value, list)
        and parameter.get("maxItems")
        and len(value) > int(str(parameter["maxItems"]))
    ):
        diagnostics.append(f"{path}: list exceeds the asset maximum")
    item_contract = parameter.get("items")
    if (
        kind != "record-list"
        or not isinstance(value, list)
        or not isinstance(item_contract, Mapping)
    ):
        return
    fields = item_contract["properties"]
    required = item_contract["required"]
    assert isinstance(fields, Mapping) and isinstance(required, list)
    for index, item in enumerate(value):
        assert isinstance(item, Mapping)
        for name in item:
            if name not in fields:
                diagnostics.append(f"{path}[{index}].{name}: field is not declared")
        for name in required:
            if name not in item:
                diagnostics.append(f"{path}[{index}].{name}: required field is missing")
        for name, field in fields.items():
            if name in item and isinstance(field, Mapping):
                _parameter(diagnostics, f"{path}[{index}].{name}", item[name], field)
    unique_by = parameter.get("uniqueBy")
    if unique_by and len({item.get(unique_by) for item in value}) != len(value):
        diagnostics.append(f"{path}: {unique_by} values must be unique")
