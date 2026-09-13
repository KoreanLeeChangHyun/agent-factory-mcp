"""Generate deterministic Python and TypeScript Workbench contract artifacts."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCHEMAS = ROOT / "contracts" / "schemas"
PY_OUT = ROOT / "packages" / "contracts-py" / "src" / "agent_factory_contracts" / "generated"
TS_OUT = ROOT / "packages" / "contracts-ts" / "src" / "generated"


def canonical(value: object) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def assert_fields(schema: dict[str, object], fields: set[str], name: str) -> None:
    actual = set(schema.get("properties", {}))
    if actual != fields:
        raise ValueError(f"{name} generator field coverage differs: schema={sorted(actual)!r}")


def schema_bundle() -> dict[str, object]:
    schemas = {
        path.relative_to(ROOT / "contracts").as_posix(): json.loads(path.read_text())
        for path in sorted(SCHEMAS.rglob("*.schema.json"))
    }
    for schema_path, schema in schemas.items():
        stack = [schema]
        while stack:
            value = stack.pop()
            if isinstance(value, dict):
                reference = value.get("$ref")
                if reference and not (
                    reference.startswith("#/")
                    or (
                        "/" not in reference
                        and "\\" not in reference
                        and reference.endswith(".schema.json")
                    )
                ):
                    raise ValueError(f"{schema_path}: unbounded $ref {reference!r}")
                stack.extend(value.values())
            elif isinstance(value, list):
                stack.extend(value)
    return schemas


def outputs() -> dict[Path, str]:
    schemas = schema_bundle()
    bundle = canonical(schemas)
    documents = canonical(
        json.loads((ROOT / "contracts/examples/workbenches/documents.json").read_text())
    )
    limits = canonical(json.loads((ROOT / "contracts/limits.v1.json").read_text()))
    definition = schemas["schemas/workbench/v1/definition.schema.json"]
    workbench = "schemas/workbench/v1/"
    catalog = schemas["schemas/catalog/v1/asset-descriptor.schema.json"]
    theme = schemas["schemas/appearance/v1/theme-profile.schema.json"]
    component = schemas[f"{workbench}component.schema.json"]
    action_kinds = schemas[f"{workbench}action.schema.json"]["properties"]["kind"]["enum"]
    component_states = component["properties"]["state"]["enum"]
    component_props = component["properties"]["props"]["propertyNames"]["enum"]
    sidebar_assets = schemas[f"{workbench}sidebar.schema.json"]["properties"]["asset"]["enum"]
    panel_assets = schemas[f"{workbench}panel.schema.json"]["properties"]["asset"]["enum"]
    asset_kinds = catalog["properties"]["kind"]["enum"]
    asset_states = catalog["properties"]["states"]["items"]["enum"]
    parameter_types = catalog["$defs"]["parameters"]["items"]["properties"]["type"]["enum"]
    accessibility_roles = catalog["properties"]["accessibility"]["properties"]["role"]["enum"]
    live_modes = catalog["properties"]["accessibility"]["properties"]["live"]["enum"]
    themes = theme["properties"]["base"]["enum"]
    densities = theme["properties"]["density"]["enum"]
    theme_overrides = list(theme["properties"]["overrides"]["properties"])
    regions = schemas["schemas/workbench/v1/descriptor.schema.json"]["properties"]["regions"][
        "items"
    ]["enum"]
    field_contracts = {
        "action": (
            schemas[f"{workbench}action.schema.json"],
            {"id", "kind", "target", "payloadBinding"},
        ),
        "binding": (
            schemas[f"{workbench}binding.schema.json"],
            {"id", "source", "inputMappings", "cacheSeconds"},
        ),
        "component": (
            component,
            {"id", "asset", "slot", "parentId", "props", "binding", "actions", "state"},
        ),
        "descriptor": (
            schemas[f"{workbench}descriptor.schema.json"],
            {"id", "version", "title", "description", "icon", "regions"},
        ),
        "sidebar": (
            schemas[f"{workbench}sidebar.schema.json"],
            {"asset", "label", "actions", "components"},
        ),
        "panel": (
            schemas[f"{workbench}panel.schema.json"],
            {"asset", "label", "actions", "components"},
        ),
        "definition": (
            definition,
            {"schemaVersion", "descriptor", "sidebar", "panel", "bindings", "actions"},
        ),
        "release": (
            schemas[f"{workbench}release.schema.json"],
            {"releaseId", "definitionId", "revision", "schemaDigest", "definition"},
        ),
        "view-state": (
            schemas[f"{workbench}view-state.schema.json"],
            {
                "version",
                "selectedWorkbench",
                "sidebarOpen",
                "sidebarWidth",
                "selection",
                "expanded",
            },
        ),
        "theme-profile": (
            theme,
            {
                "schemaVersion",
                "userId",
                "revision",
                "base",
                "density",
                "overrides",
                "reducedMotion",
            },
        ),
        "asset-descriptor": (
            catalog,
            {
                "id",
                "kind",
                "allowedRegions",
                "properties",
                "inputs",
                "outputs",
                "slots",
                "states",
                "actions",
                "accessibility",
                "provenance",
                "example",
            },
        ),
    }
    for name, (schema, fields) in field_contracts.items():
        assert_fields(schema, fields, name)
    parameter_schema = catalog["$defs"]["parameters"]["items"]
    assert_fields(
        parameter_schema,
        {"name", "type", "required", "maxLength", "maxItems", "items", "uniqueBy", "enum"},
        "asset-parameter",
    )
    assert_fields(
        catalog["properties"]["accessibility"], {"role", "keyboard", "live"}, "accessibility"
    )
    assert_fields(catalog["properties"]["provenance"], {"source", "license"}, "provenance")
    if definition["properties"]["schemaVersion"]["const"] != "1.0":
        raise ValueError("definition schemaVersion generator requires const '1.0'")

    py_models = f"""# Generated by scripts/generate_workbench_contracts.py; do not edit.
from __future__ import annotations

from typing import Literal, NotRequired, TypedDict

ActionKind = Literal[{", ".join(repr(v) for v in action_kinds)}]
ThemeBase = Literal[{", ".join(repr(v) for v in themes)}]
Density = Literal[{", ".join(repr(v) for v in densities)}]
Region = Literal[{", ".join(repr(v) for v in regions)}]
ComponentState = Literal[{", ".join(repr(v) for v in component_states)}]
SidebarAsset = Literal[{", ".join(repr(v) for v in sidebar_assets)}]
PanelAsset = Literal[{", ".join(repr(v) for v in panel_assets)}]
AssetKind = Literal[{", ".join(repr(v) for v in asset_kinds)}]
AssetState = Literal[{", ".join(repr(v) for v in asset_states)}]
AssetParameterType = Literal[{", ".join(repr(v) for v in parameter_types)}]
AccessibilityRole = Literal[{", ".join(repr(v) for v in accessibility_roles)}]
LiveMode = Literal[{", ".join(repr(v) for v in live_modes)}]
Scalar = str | int | float | bool | None
PropertyValue = Scalar | list[str] | list[dict[str, Scalar]]


class ComponentProps(TypedDict):
{chr(10).join(f"    {name}: NotRequired[PropertyValue]" for name in component_props)}


class Component(TypedDict):
    id: str
    asset: str
    slot: str
    parentId: NotRequired[str]
    props: NotRequired[ComponentProps]
    binding: NotRequired[str]
    actions: NotRequired[list[str]]
    state: NotRequired[ComponentState]


class BindingInputMapping(TypedDict):
    input: str
    statePath: str


class Binding(TypedDict):
    id: str
    source: str
    inputMappings: list[BindingInputMapping]
    cacheSeconds: NotRequired[int]


class Action(TypedDict):
    id: str
    kind: ActionKind
    target: NotRequired[str]
    payloadBinding: NotRequired[str]


class WorkbenchDescriptor(TypedDict):
    id: str
    version: Literal[1]
    title: str
    description: NotRequired[str]
    icon: str
    regions: list[Region]


class Sidebar(TypedDict):
    asset: SidebarAsset
    label: NotRequired[str]
    actions: NotRequired[list[str]]
    components: list[Component]


class Panel(TypedDict):
    asset: PanelAsset
    label: NotRequired[str]
    actions: NotRequired[list[str]]
    components: list[Component]


class WorkbenchDefinition(TypedDict):
    schemaVersion: Literal["1.0"]
    descriptor: WorkbenchDescriptor
    sidebar: Sidebar
    panel: Panel
    bindings: list[Binding]
    actions: list[Action]


class ThemeOverrides(TypedDict):
{chr(10).join(f"    {name}: NotRequired[str]" for name in theme_overrides)}


class ThemeProfile(TypedDict):
    schemaVersion: Literal["1.0"]
    userId: str
    revision: int
    base: ThemeBase
    density: Density
    overrides: ThemeOverrides
    reducedMotion: bool


class WorkbenchRelease(TypedDict):
    releaseId: str
    definitionId: str
    revision: int
    schemaDigest: str
    definition: WorkbenchDefinition


class ViewState(TypedDict):
    version: Literal[1]
    selectedWorkbench: str
    sidebarOpen: bool
    sidebarWidth: int
    selection: str | None
    expanded: list[str]


class RecordField(TypedDict):
    type: Literal["string", "number", "integer", "boolean"]
    minLength: NotRequired[int]
    maxLength: NotRequired[int]
    enum: NotRequired[list[str]]


class RecordItem(TypedDict):
    type: Literal["object"]
    additionalProperties: Literal[False]
    required: list[str]
    properties: dict[str, RecordField]


class AssetParameter(TypedDict):
    name: str
    type: AssetParameterType
    required: bool
    maxLength: NotRequired[int]
    maxItems: NotRequired[int]
    enum: NotRequired[list[str]]
    items: NotRequired[RecordItem]
    uniqueBy: NotRequired[str]


class Accessibility(TypedDict):
    role: AccessibilityRole
    keyboard: str
    live: NotRequired[LiveMode]


class Provenance(TypedDict):
    source: str
    license: str


class AssetDescriptor(TypedDict):
    id: str
    kind: AssetKind
    allowedRegions: list[Region]
    properties: list[AssetParameter]
    inputs: list[AssetParameter]
    outputs: list[AssetParameter]
    slots: list[str]
    states: list[AssetState]
    actions: list[ActionKind]
    accessibility: Accessibility
    provenance: Provenance
    example: dict[str, Scalar]
"""
    py_bundle = f"""# Generated by scripts/generate_workbench_contracts.py; do not edit.
import json

SCHEMAS = json.loads({bundle!r})
DOCUMENTS_FIXTURE = json.loads({documents!r})
LIMITS = json.loads({limits!r})
"""
    py_init = """# Generated by scripts/generate_workbench_contracts.py; do not edit.
from .models import (
    Accessibility,
    Action,
    AssetDescriptor,
    AssetParameter,
    Binding,
    Component,
    Panel,
    RecordField,
    RecordItem,
    Sidebar,
    ThemeProfile,
    ViewState,
    WorkbenchDefinition,
    WorkbenchDescriptor,
    WorkbenchRelease,
)

__all__ = [
    "Accessibility",
    "Action",
    "AssetDescriptor",
    "AssetParameter",
    "Binding",
    "Component",
    "Panel",
    "RecordField",
    "RecordItem",
    "Sidebar",
    "ThemeProfile",
    "ViewState",
    "WorkbenchDefinition",
    "WorkbenchDescriptor",
    "WorkbenchRelease",
]
"""
    ts_types = f"""// Generated by scripts/generate_workbench_contracts.py; do not edit.
export type ActionKind = {" | ".join(json.dumps(v) for v in action_kinds)};
export type ThemeBase = {" | ".join(json.dumps(v) for v in themes)};
export type Density = {" | ".join(json.dumps(v) for v in densities)};
export type Region = {" | ".join(json.dumps(v) for v in regions)};
export type ComponentState = {" | ".join(json.dumps(v) for v in component_states)};
export type SidebarAsset = {" | ".join(json.dumps(v) for v in sidebar_assets)};
export type PanelAsset = {" | ".join(json.dumps(v) for v in panel_assets)};
export type AssetKind = {" | ".join(json.dumps(v) for v in asset_kinds)};
export type AssetState = {" | ".join(json.dumps(v) for v in asset_states)};
export type AssetParameterType = {" | ".join(json.dumps(v) for v in parameter_types)};
export type AccessibilityRole = {" | ".join(json.dumps(v) for v in accessibility_roles)};
export type LiveMode = {" | ".join(json.dumps(v) for v in live_modes)};
export type Scalar = string | number | boolean | null;
export type PropertyValue = Scalar | string[] | Record<string, Scalar>[];

export interface ComponentProps {{ {" ".join(f"{name}?: PropertyValue;" for name in component_props)} }}
export interface Component {{ id: string; asset: string; slot: "content" | "header" | "actions" | "list" | "detail" | "primary" | "secondary" | "sidebar" | "control"; parentId?: string; props?: ComponentProps; binding?: string; actions?: string[]; state?: ComponentState }}
export interface BindingInputMapping {{ input: string; statePath: string }}
export interface Binding {{ id: string; source: string; inputMappings: BindingInputMapping[]; cacheSeconds?: number }}
export interface Action {{ id: string; kind: ActionKind; target?: string; payloadBinding?: string }}
export interface WorkbenchDescriptor {{ id: string; version: 1; title: string; description?: string; icon: string; regions: Region[] }}
export interface Sidebar {{ asset: SidebarAsset; label?: string; actions?: string[]; components: Component[] }}
export interface Panel {{ asset: PanelAsset; label?: string; actions?: string[]; components: Component[] }}
export interface WorkbenchDefinition {{ schemaVersion: "1.0"; descriptor: WorkbenchDescriptor; sidebar: Sidebar; panel: Panel; bindings: Binding[]; actions: Action[] }}
export interface ThemeOverrides {{ {" ".join(f"{name}?: string;" for name in theme_overrides)} }}
export interface ThemeProfile {{ schemaVersion: "1.0"; userId: string; revision: number; base: ThemeBase; density: Density; overrides: ThemeOverrides; reducedMotion: boolean }}
export interface WorkbenchRelease {{ releaseId: string; definitionId: string; revision: number; schemaDigest: string; definition: WorkbenchDefinition }}
export interface ViewState {{ version: 1; selectedWorkbench: string; sidebarOpen: boolean; sidebarWidth: number; selection: string | null; expanded: string[] }}
export interface RecordField {{ type: "string" | "number" | "integer" | "boolean"; minLength?: number; maxLength?: number; enum?: string[] }}
export interface RecordItem {{ type: "object"; additionalProperties: false; required: string[]; properties: Record<string, RecordField> }}
export interface AssetParameter {{ name: string; type: AssetParameterType; required: boolean; maxLength?: number; maxItems?: number; items?: RecordItem; uniqueBy?: string; enum?: string[] }}
export interface Accessibility {{ role: AccessibilityRole; keyboard: string; live?: LiveMode }}
export interface Provenance {{ source: string; license: string }}
export interface AssetDescriptor {{ id: string; kind: AssetKind; allowedRegions: Region[]; properties: AssetParameter[]; inputs: AssetParameter[]; outputs: AssetParameter[]; slots: ("content" | "header" | "actions" | "list" | "detail" | "primary" | "secondary" | "sidebar" | "control")[]; states: AssetState[]; actions: ActionKind[]; accessibility: Accessibility; provenance: Provenance; example: Record<string, Scalar> }}
"""
    ts_bundle = f"""// Generated by scripts/generate_workbench_contracts.py; do not edit.
export const schemas: Record<string, object> = JSON.parse({json.dumps(bundle)});
export const documentsFixture = JSON.parse({json.dumps(documents)});
export const contractLimits = JSON.parse({json.dumps(limits)});
"""
    return {
        PY_OUT / "__init__.py": py_init,
        PY_OUT / "models.py": py_models,
        PY_OUT / "schema_bundle.py": py_bundle,
        TS_OUT / "types.ts": ts_types,
        TS_OUT / "schema-bundle.ts": ts_bundle,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    stale: list[str] = []
    for path, content in outputs().items():
        if args.check:
            if not path.exists() or path.read_text() != content:
                stale.append(path.relative_to(ROOT).as_posix())
            continue
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content)
    if stale:
        raise SystemExit("generated contract artifacts differ: " + ", ".join(stale))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
