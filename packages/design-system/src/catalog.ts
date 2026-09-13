import { createElement, type ComponentType, type ReactNode } from "react";
import type { ActionKind, AssetDescriptor, AssetKind, AssetParameter } from "@agent-factory/contracts";
import {
  Button,
  ChartFrame,
  Checkbox,
  CodeBlock,
  DataTable,
  DateInput,
  Dialog,
  Field,
  IconButton,
  JsonView,
  Markdown,
  Menu,
  Metric,
  MultiSelect,
  NumberInput,
  PanelLayout,
  Popover,
  ResourceHeader,
  Select,
  SidebarPattern,
  StateView,
  Tabs,
  TaskIcon,
  TextInput,
  Toast,
  Toggle,
  type CommonState,
  type PanelSlot,
  type NavItem,
  type PanelVariant,
  type SidebarVariant,
  type TaskIconName,
} from "./components.js";

const projectOwned = { source: "Agent Factory design-system React source", license: "Project-owned" };
const reviewedIcons = {
  source: "Agent Factory inline inventory; geometry redrawn as reusable React SVG",
  license: "Project-owned",
};
const parameter = (
  name: string,
  type: "string" | "number" | "integer" | "boolean" | "string-list" | "record-list",
  required = false,
  extra: {
    maxLength?: number;
    maxItems?: number;
    items?: AssetParameter["items"];
    uniqueBy?: string;
    enum?: string[];
  } = {},
) => ({ name, type, required, ...extra });

const panelSlotItems: NonNullable<AssetParameter["items"]> = {
  type: "object",
  additionalProperties: false,
  required: ["id", "title"],
  properties: {
    id: { type: "string", minLength: 1, maxLength: 64 },
    title: { type: "string", minLength: 1, maxLength: 80 },
    content: { type: "string", maxLength: 4096 },
    meta: { type: "string", maxLength: 240 },
  },
};
const navigationItems: NonNullable<AssetParameter["items"]> = {
  type: "object",
  additionalProperties: false,
  required: ["id", "label"],
  properties: {
    id: { type: "string", minLength: 1, maxLength: 64 },
    label: { type: "string", minLength: 1, maxLength: 80 },
    meta: { type: "string", maxLength: 240 },
    group: { type: "string", maxLength: 80 },
    favorite: { type: "boolean" },
    recent: { type: "boolean" },
    parentId: { type: "string", maxLength: 64 },
  },
};
const tableItems: NonNullable<AssetParameter["items"]> = {
  type: "object",
  additionalProperties: false,
  required: ["id", "title"],
  properties: {
    id: { type: "string", minLength: 1, maxLength: 64 },
    title: { type: "string", minLength: 1, maxLength: 120 },
    status: { type: "string", maxLength: 80 },
    meta: { type: "string", maxLength: 240 },
  },
};
const tableColumnItems: NonNullable<AssetParameter["items"]> = {
  type: "object",
  additionalProperties: false,
  required: ["id", "label"],
  properties: {
    id: { type: "string", enum: ["title", "status", "meta"] },
    label: { type: "string", minLength: 1, maxLength: 80 },
  },
};
const tabItems: NonNullable<AssetParameter["items"]> = {
  type: "object",
  additionalProperties: false,
  required: ["id", "label"],
  properties: {
    id: { type: "string", minLength: 1, maxLength: 64 },
    label: { type: "string", minLength: 1, maxLength: 80 },
  },
};

function descriptor(
  id: string,
  kind: AssetKind,
  region: AssetDescriptor["allowedRegions"][number],
  role: AssetDescriptor["accessibility"]["role"],
  properties: AssetDescriptor["properties"] = [],
  actions: AssetDescriptor["actions"] = [],
  example: AssetDescriptor["example"] = {},
  inputs: AssetDescriptor["inputs"] = [],
  outputs: AssetDescriptor["outputs"] = [],
): AssetDescriptor {
  const supportsDisabled = properties.some((property) => property.name === "disabled");
  const feedbackState = id.endsWith("-state") ? id.slice(0, -6) : undefined;
  const states: AssetDescriptor["states"] =
    feedbackState &&
    ["loading", "empty", "error", "permission-denied", "busy", "stale", "success", "progress"].includes(feedbackState)
      ? [feedbackState as AssetDescriptor["states"][number]]
      : kind === "sidebar"
        ? ["ready", "empty"]
        : kind === "display"
          ? ["loading", "empty", "ready", "stale", "error", "permission-denied"]
          : supportsDisabled
            ? ["ready", "disabled"]
            : ["ready"];
  const layoutSlots: Record<string, AssetDescriptor["slots"]> = {
    "flat-list": ["content"],
    "group-list": ["content"],
    tree: ["content"],
    "search-list": ["content"],
    "filter-list": ["content"],
    "detail-list": ["content"],
    "favorites-recent": ["content"],
    detail: ["header", "content", "actions"],
    "list-detail": ["list", "detail"],
    collection: ["content"],
    settings: ["content", "actions"],
    dashboard: ["content"],
    document: ["header", "content"],
    split: ["primary", "secondary"],
    timeline: ["sidebar", "content"],
    kanban: ["content"],
    field: ["control"],
    tabs: ["content"],
  };
  return {
    id: `${id}@1`,
    kind,
    allowedRegions: [region],
    properties,
    inputs,
    outputs,
    slots: layoutSlots[id] ?? [],
    states,
    actions,
    accessibility: {
      role,
      keyboard: "Native controls provide keyboard operation, visible focus, names, and disabled or busy semantics.",
    },
    provenance: kind === "icon" ? reviewedIcons : projectOwned,
    example,
  };
}

const taskIcons: { id: string; icon: TaskIconName; label: string }[] = [
  { id: "documents", icon: "documents", label: "문서" },
  { id: "workspace", icon: "workspace", label: "작업공간" },
  { id: "knowledge", icon: "knowledge", label: "지식" },
  { id: "connections", icon: "connections", label: "연동" },
  { id: "jobs", icon: "jobs", label: "작업" },
  { id: "audit", icon: "audit", label: "감사" },
  { id: "calendar", icon: "calendar", label: "일정" },
  { id: "agents", icon: "agents", label: "에이전트" },
  { id: "logs", icon: "logs", label: "로그" },
  { id: "tests", icon: "tests", label: "테스트" },
  { id: "database", icon: "database", label: "데이터베이스" },
  { id: "account", icon: "account", label: "계정" },
  { id: "admin", icon: "admin", label: "관리자" },
  { id: "search", icon: "search", label: "검색" },
  { id: "preferences", icon: "settings", label: "설정" },
  { id: "favorites", icon: "favorites", label: "즐겨찾기" },
];
const sidebars: SidebarVariant[] = [
  "flat-list",
  "group-list",
  "tree",
  "search-list",
  "filter-list",
  "detail-list",
  "favorites-recent",
];
const panels: PanelVariant[] = [
  "detail",
  "list-detail",
  "collection",
  "settings",
  "dashboard",
  "document",
  "split",
  "timeline",
  "kanban",
];
const controls = [
  "button",
  "icon-button",
  "field",
  "text-input",
  "number-input",
  "date-input",
  "select",
  "multiselect",
  "checkbox",
  "toggle",
] as const;
const displays = [
  "tabs",
  "resource-tree",
  "resource-table",
  "resource-header",
  "metric",
  "chart-frame",
  "code",
  "markdown",
  "json",
] as const;
const overlays = ["dialog", "menu", "popover", "toast"] as const;
const feedback: CommonState[] = [
  "loading",
  "empty",
  "error",
  "permission-denied",
  "busy",
  "stale",
  "success",
  "progress",
];

export const assetCatalog: readonly AssetDescriptor[] = [
  ...taskIcons.map(({ id, label }) =>
    descriptor(
      id,
      "icon",
      "task-list",
      "img",
      [
        parameter("label", "string", true, { maxLength: 80 }),
        parameter("selected", "boolean"),
        parameter("disabled", "boolean"),
        parameter("notification", "boolean"),
      ],
      [],
      { label },
    ),
  ),
  ...sidebars.map((id) =>
    descriptor(
      id,
      "sidebar",
      "sidebar",
      id === "tree" ? "tree" : "navigation",
      [
        parameter("title", "string", false, { maxLength: 80 }),
        parameter("items", "record-list", false, { maxItems: 100, items: navigationItems, uniqueBy: "id" }),
      ],
      ["select"],
      { title: `${id} 예제` },
      [parameter("records", "record-list", false, { maxItems: 100, items: navigationItems, uniqueBy: "id" })],
      [parameter("selectedId", "string", false, { maxLength: 64 })],
    ),
  ),
  ...panels.map((id) =>
    descriptor(
      id,
      "panel",
      "panel",
      id === "settings" ? "form" : "region",
      [],
      id === "detail" || id === "settings" ? ["submit"] : id === "split" ? ["toggle"] : [],
      {},
      [parameter("slots", "record-list", false, { maxItems: 12, items: panelSlotItems, uniqueBy: "id" })],
      id === "split" ? [parameter("value", "number", false)] : [],
    ),
  ),
  ...controls.map((id) =>
    descriptor(
      id,
      "control",
      "panel",
      id === "field" ? "form" : "region",
      [parameter("label", "string", false, { maxLength: 80 }), parameter("disabled", "boolean")],
      id === "button" || id === "icon-button"
        ? ["submit"]
        : id === "checkbox" || id === "toggle"
          ? ["toggle"]
          : ["select"],
      { label: `${id} 예제` },
      id === "button" || id === "icon-button"
        ? []
        : [
            parameter(
              "value",
              id === "number-input"
                ? "number"
                : id === "checkbox" || id === "toggle"
                  ? "boolean"
                  : id === "multiselect"
                    ? "string-list"
                    : "string",
              false,
              id === "number-input" || id === "checkbox" || id === "toggle"
                ? {}
                : id === "multiselect"
                  ? { maxItems: 32 }
                  : { maxLength: 2048 },
            ),
            ...(["select", "multiselect"].includes(id)
              ? [parameter("options", "string-list", false, { maxItems: 32 })]
              : []),
          ],
      id === "button" || id === "icon-button"
        ? []
        : [
            parameter(
              "value",
              id === "number-input"
                ? "number"
                : id === "checkbox" || id === "toggle"
                  ? "boolean"
                  : id === "multiselect"
                    ? "string-list"
                    : "string",
              false,
              id === "number-input" || id === "checkbox" || id === "toggle"
                ? {}
                : id === "multiselect"
                  ? { maxItems: 32 }
                  : { maxLength: 2048 },
            ),
          ],
    ),
  ),
  ...displays.map((id) =>
    descriptor(
      id,
      "display",
      id === "resource-tree" ? "sidebar" : "panel",
      id === "resource-table" ? "table" : id === "resource-tree" ? "tree" : "region",
      id === "resource-header"
        ? [
            parameter("title", "string", false, { maxLength: 80 }),
            parameter("status", "string", false, { maxLength: 80 }),
          ]
        : [],
      id === "tabs" || id === "resource-tree" ? ["select"] : id === "resource-header" ? ["refresh"] : [],
      id === "resource-header" ? { title: "선택한 문서", status: "준비됨" } : {},
      id === "tabs"
        ? [parameter("items", "record-list", false, { maxItems: 12, items: tabItems, uniqueBy: "id" })]
        : id === "resource-tree"
          ? [parameter("records", "record-list", false, { maxItems: 100, items: navigationItems, uniqueBy: "id" })]
          : id === "resource-table"
            ? [
                parameter("records", "record-list", false, { maxItems: 100, items: tableItems, uniqueBy: "id" }),
                parameter("columns", "record-list", false, {
                  maxItems: 3,
                  items: tableColumnItems,
                  uniqueBy: "id",
                }),
              ]
            : id === "resource-header"
              ? [
                  parameter("title", "string", false, { maxLength: 80 }),
                  parameter("status", "string", false, { maxLength: 80 }),
                ]
              : ["metric", "code", "markdown", "json"].includes(id)
                ? [parameter("value", "string", false, { maxLength: 2048 })]
                : [],
      id === "tabs" || id === "resource-tree" ? [parameter("selectedId", "string", false, { maxLength: 64 })] : [],
    ),
  ),
  ...overlays.map((id) =>
    descriptor(
      id,
      id === "toast" ? "feedback" : "control",
      "panel",
      id === "dialog" ? "dialog" : id === "toast" ? "status" : "region",
      [parameter("open", "boolean")],
      id === "dialog" || id === "toast" ? ["dismiss"] : id === "menu" ? ["select"] : [],
      { open: true },
      [],
      id === "menu" ? [parameter("selectedId", "string", false, { maxLength: 64 })] : [],
    ),
  ),
  ...feedback.map((id) => descriptor(`${id}-state`, "feedback", "panel", id === "error" ? "alert" : "status", [], [])),
];

type Implementation = { component: ComponentType<Record<string, unknown>>; allowedProps: ReadonlySet<string> };
export type AssetActionEvent = { assetId: string; action: ActionKind; output: Record<string, unknown> };
export type AssetRuntime = {
  inputs?: Record<string, unknown>;
  onAction?: (event: AssetActionEvent) => void;
  slots?: { id: string; content: ReactNode }[];
  viewState?: { selection: string | null; expanded: string[]; onExpandedChange?: (ids: string[]) => void };
};
const implementations = new Map<string, Implementation>();
const register = (id: string, component: ComponentType<Record<string, unknown>>, allowedProps: string[] = []) =>
  implementations.set(`${id}@1`, { component, allowedProps: new Set(allowedProps) });
const runtimeOf = (props: Record<string, unknown>) => (props.$runtime ?? {}) as AssetRuntime;
const navigationTree = (value: unknown): NavItem[] => {
  if (!Array.isArray(value)) return [];
  const records = value as (NavItem & { parentId?: string })[];
  const nodes = new Map(records.map((record) => [record.id, { ...record, children: [] as NavItem[] }]));
  const roots: NavItem[] = [];
  for (const record of records) {
    const node = nodes.get(record.id)!;
    const parent = record.parentId ? nodes.get(record.parentId) : undefined;
    if (parent) parent.children!.push(node);
    else roots.push(node);
  }
  return roots;
};
const validateValues = (id: string, values: Record<string, unknown>, parameters: AssetParameter[], subject: string) => {
  const allowed = new Set(parameters.map((parameter) => parameter.name));
  const unknown = Object.keys(values).filter((name) => !allowed.has(name));
  if (unknown.length) throw new Error(`Unsupported ${subject} for ${id}: ${unknown.join(", ")}`);
  for (const parameter of parameters) {
    const value = values[parameter.name];
    if (parameter.required && value === undefined)
      throw new Error(`Missing required ${subject} for ${id}: ${parameter.name}`);
    if (value === undefined) continue;
    const valid =
      (parameter.type === "string" && typeof value === "string") ||
      (parameter.type === "number" && typeof value === "number" && Number.isFinite(value)) ||
      (parameter.type === "integer" && Number.isInteger(value)) ||
      (parameter.type === "boolean" && typeof value === "boolean") ||
      (parameter.type === "string-list" && Array.isArray(value) && value.every((item) => typeof item === "string")) ||
      (parameter.type === "record-list" &&
        Array.isArray(value) &&
        value.every((item) => typeof item === "object" && item !== null && !Array.isArray(item)));
    if (!valid) throw new Error(`Invalid ${parameter.type} ${subject} for ${id}: ${parameter.name}`);
    if (typeof value === "string" && parameter.maxLength !== undefined && value.length > parameter.maxLength)
      throw new Error(`${subject} exceeds maxLength for ${id}: ${parameter.name}`);
    if (Array.isArray(value) && parameter.maxItems !== undefined && value.length > parameter.maxItems)
      throw new Error(`${subject} exceeds maxItems for ${id}: ${parameter.name}`);
    if (parameter.type === "record-list" && Array.isArray(value) && parameter.items) {
      const itemContract = parameter.items;
      for (const [index, entry] of value.entries()) {
        const record = entry as Record<string, unknown>;
        const unknownFields = Object.keys(record).filter((name) => !(name in itemContract.properties));
        if (!itemContract.additionalProperties && unknownFields.length)
          throw new Error(`Unsupported ${subject} item field for ${id}: ${unknownFields.join(", ")}`);
        for (const name of itemContract.required) {
          if (record[name] === undefined) throw new Error(`Missing required ${subject} item for ${id}: ${name}`);
        }
        for (const [name, field] of Object.entries(itemContract.properties)) {
          const fieldValue = record[name];
          if (fieldValue === undefined) continue;
          const fieldValid =
            (field.type === "string" && typeof fieldValue === "string") ||
            (field.type === "number" && typeof fieldValue === "number" && Number.isFinite(fieldValue)) ||
            (field.type === "integer" && Number.isInteger(fieldValue)) ||
            (field.type === "boolean" && typeof fieldValue === "boolean");
          if (!fieldValid) throw new Error(`Invalid ${subject} item field for ${id}: ${name} at ${index}`);
          if (typeof fieldValue === "string" && field.minLength !== undefined && fieldValue.length < field.minLength)
            throw new Error(`${subject} item is shorter than minLength for ${id}: ${name}`);
          if (typeof fieldValue === "string" && field.maxLength !== undefined && fieldValue.length > field.maxLength)
            throw new Error(`${subject} item exceeds maxLength for ${id}: ${name}`);
          if (typeof fieldValue === "string" && field.enum !== undefined && !field.enum.includes(fieldValue))
            throw new Error(`Invalid ${subject} item field for ${id}: ${name} at ${index}`);
        }
      }
      if (parameter.uniqueBy) {
        const uniqueBy = parameter.uniqueBy;
        const unique = new Set(value.map((entry) => (entry as Record<string, unknown>)[uniqueBy]));
        if (unique.size !== value.length) throw new Error(`Duplicate ${subject} item for ${id}: ${uniqueBy}`);
      }
    }
  }
};
const emit = (id: string, runtime: AssetRuntime, action: ActionKind, output: Record<string, unknown> = {}) => {
  const assetId = `${id}@1`;
  const descriptor = assetCatalog.find((asset) => asset.id === assetId);
  if (!descriptor?.actions.includes(action)) throw new Error(`Unsupported action for ${assetId}: ${action}`);
  validateValues(assetId, output, descriptor.outputs, "output");
  runtime.onAction?.({ assetId, action, output });
};

export function invokeAssetAction(
  id: string,
  action: ActionKind,
  output: Record<string, unknown>,
  runtime: AssetRuntime = {},
) {
  emit(id.replace(/@1$/, ""), runtime, action, output);
}

for (const { id, icon, label } of taskIcons)
  register(
    id,
    (props) =>
      createElement(TaskIcon, {
        name: icon,
        label: String(props.label ?? label),
        selected: Boolean(props.selected),
        disabled: Boolean(props.disabled),
        notification: Boolean(props.notification),
      }),
    ["label", "selected", "disabled", "notification"],
  );
for (const variant of sidebars)
  register(
    variant,
    (props) => {
      const runtime = runtimeOf(props);
      return createElement(SidebarPattern, {
        variant,
        title: typeof props.title === "string" ? props.title : undefined,
        items: Array.isArray(runtime.inputs?.records)
          ? (runtime.inputs.records as never)
          : Array.isArray(props.items)
            ? (props.items as never)
            : undefined,
        onSelect: (selectedId) => emit(variant, runtime, "select", { selectedId }),
        selectedId: runtime.viewState?.selection,
        expanded: runtime.viewState?.expanded,
        onExpandedChange: runtime.viewState?.onExpandedChange,
        children: runtime.slots?.find((slot) => slot.id === "content")?.content,
      });
    },
    ["title", "items"],
  );
for (const variant of panels)
  register(variant, (props) => {
    const runtime = runtimeOf(props);
    return createElement(PanelLayout, {
      variant,
      slots: runtime.inputs?.slots as PanelSlot[] | undefined,
      composedSlots: runtime.slots,
      onAction: (action, value) => emit(variant, runtime, action, value === undefined ? {} : { value }),
    });
  });
register(
  "button",
  (props) => {
    const runtime = runtimeOf(props);
    return createElement(
      Button,
      { disabled: Boolean(props.disabled), onClick: () => emit("button", runtime, "submit") },
      String(props.label ?? "동작"),
    );
  },
  ["label", "disabled"],
);
register(
  "icon-button",
  (props) => {
    const runtime = runtimeOf(props);
    return createElement(IconButton, {
      icon: "settings",
      label: String(props.label ?? "설정"),
      disabled: Boolean(props.disabled),
      onClick: () => emit("icon-button", runtime, "submit"),
    });
  },
  ["label", "disabled"],
);
register(
  "field",
  (props) => {
    const runtime = runtimeOf(props);
    return createElement(
      Field,
      { label: String(props.label ?? "필드") },
      runtime.slots?.find((slot) => slot.id === "control")?.content ??
        createElement(TextInput, {
          disabled: Boolean(props.disabled),
          defaultValue: typeof runtime.inputs?.value === "string" ? runtime.inputs.value : undefined,
          onChange: (event) => emit("field", runtime, "select", { value: event.currentTarget.value }),
        }),
    );
  },
  ["label", "disabled"],
);
register(
  "text-input",
  (props) => {
    const runtime = runtimeOf(props);
    return createElement(TextInput, {
      "aria-label": String(props.label ?? "텍스트"),
      disabled: Boolean(props.disabled),
      defaultValue: typeof runtime.inputs?.value === "string" ? runtime.inputs.value : undefined,
      onChange: (event) => emit("text-input", runtime, "select", { value: event.currentTarget.value }),
    });
  },
  ["label", "disabled"],
);
register(
  "number-input",
  (props) => {
    const runtime = runtimeOf(props);
    return createElement(NumberInput, {
      "aria-label": String(props.label ?? "숫자"),
      disabled: Boolean(props.disabled),
      defaultValue: typeof runtime.inputs?.value === "number" ? runtime.inputs.value : undefined,
      onChange: (event) =>
        emit(
          "number-input",
          runtime,
          "select",
          event.currentTarget.value === "" ? {} : { value: event.currentTarget.valueAsNumber },
        ),
    });
  },
  ["label", "disabled"],
);
register(
  "date-input",
  (props) => {
    const runtime = runtimeOf(props);
    return createElement(DateInput, {
      "aria-label": String(props.label ?? "날짜"),
      disabled: Boolean(props.disabled),
      defaultValue: typeof runtime.inputs?.value === "string" ? runtime.inputs.value : undefined,
      onChange: (event) => emit("date-input", runtime, "select", { value: event.currentTarget.value }),
    });
  },
  ["label", "disabled"],
);
register(
  "select",
  (props) => {
    const runtime = runtimeOf(props);
    return createElement(
      Select,
      {
        "aria-label": String(props.label ?? "선택"),
        disabled: Boolean(props.disabled),
        defaultValue: typeof runtime.inputs?.value === "string" ? runtime.inputs.value : undefined,
        onChange: (event) => emit("select", runtime, "select", { value: event.currentTarget.value }),
      },
      ...(Array.isArray(runtime.inputs?.options) ? runtime.inputs.options : []).map((option) =>
        createElement("option", { value: String(option), key: String(option) }, String(option)),
      ),
    );
  },
  ["label", "disabled"],
);
register(
  "multiselect",
  (props) => {
    const runtime = runtimeOf(props);
    return createElement(MultiSelect, {
      label: String(props.label ?? "여러 항목 선택"),
      options: Array.isArray(runtime.inputs?.options) ? (runtime.inputs.options as string[]) : [],
      value: Array.isArray(runtime.inputs?.value) ? (runtime.inputs.value as string[]) : [],
      onChange: (value) => emit("multiselect", runtime, "select", { value }),
      disabled: Boolean(props.disabled),
    });
  },
  ["label", "disabled"],
);
register(
  "checkbox",
  (props) => {
    const runtime = runtimeOf(props);
    return createElement(Checkbox, {
      label: String(props.label ?? "확인"),
      disabled: Boolean(props.disabled),
      defaultChecked: typeof runtime.inputs?.value === "boolean" ? runtime.inputs.value : undefined,
      onChange: (event) => emit("checkbox", runtime, "toggle", { value: event.currentTarget.checked }),
    });
  },
  ["label", "disabled"],
);
register(
  "toggle",
  (props) => {
    const runtime = runtimeOf(props);
    return createElement(Toggle, {
      label: String(props.label ?? "사용"),
      disabled: Boolean(props.disabled),
      defaultChecked: typeof runtime.inputs?.value === "boolean" ? runtime.inputs.value : undefined,
      onChange: (event) => emit("toggle", runtime, "toggle", { value: event.currentTarget.checked }),
    });
  },
  ["label", "disabled"],
);
register("tabs", (props) => {
  const runtime = runtimeOf(props);
  return createElement(
    "div",
    { className: "af-tabs-composition" },
    createElement(Tabs, {
      labels: [],
      items: Array.isArray(runtime.inputs?.items) ? (runtime.inputs.items as never) : [],
      onSelect: (selectedId) => emit("tabs", runtime, "select", { selectedId }),
    }),
    runtime.slots?.find((slot) => slot.id === "content")?.content,
  );
});
register("resource-tree", (props) => {
  const runtime = runtimeOf(props);
  return createElement(SidebarPattern, {
    variant: "tree",
    title: "리소스 트리",
    items: navigationTree(runtime.inputs?.records),
    onSelect: (selectedId) => emit("resource-tree", runtime, "select", { selectedId }),
    selectedId: runtime.viewState?.selection,
    expanded: runtime.viewState?.expanded,
    onExpandedChange: runtime.viewState?.onExpandedChange,
  });
});
register("resource-table", (props) => {
  const runtime = runtimeOf(props);
  const columns = Array.isArray(runtime.inputs?.columns)
    ? runtime.inputs.columns.map((column) => ({
        id: String((column as Record<string, unknown>).id) as "title" | "status" | "meta",
        label: String((column as Record<string, unknown>).label),
      }))
    : undefined;
  return createElement(DataTable, {
    rows: Array.isArray(runtime.inputs?.records) ? (runtime.inputs.records as never) : [],
    columns: columns as never,
  });
});
register(
  "resource-header",
  (props) => {
    const runtime = runtimeOf(props);
    return createElement(ResourceHeader, {
      title:
        typeof runtime.inputs?.title === "string"
          ? runtime.inputs.title
          : typeof props.title === "string"
            ? props.title
            : undefined,
      status:
        typeof runtime.inputs?.status === "string"
          ? runtime.inputs.status
          : typeof props.status === "string"
            ? props.status
            : undefined,
      onRefresh: () => emit("resource-header", runtime, "refresh"),
    });
  },
  ["title", "status"],
);
register("metric", (props) =>
  createElement(Metric, {
    value: typeof runtimeOf(props).inputs?.value === "string" ? (runtimeOf(props).inputs?.value as string) : undefined,
  }),
);
register("chart-frame", () => createElement(ChartFrame));
register("code", (props) =>
  createElement(CodeBlock, {
    value: typeof runtimeOf(props).inputs?.value === "string" ? (runtimeOf(props).inputs?.value as string) : undefined,
  }),
);
register("markdown", (props) =>
  createElement(Markdown, {
    value: typeof runtimeOf(props).inputs?.value === "string" ? (runtimeOf(props).inputs?.value as string) : undefined,
  }),
);
register("json", (props) => createElement(JsonView, { value: runtimeOf(props).inputs?.value }));
register(
  "dialog",
  (props) => {
    const runtime = runtimeOf(props);
    return createElement(
      Dialog,
      { open: Boolean(props.open), title: "예제 대화상자", onClose: () => emit("dialog", runtime, "dismiss") },
      "실제 포커스 및 닫기 동작을 제공합니다.",
    );
  },
  ["open"],
);
register(
  "menu",
  (props) => {
    const runtime = runtimeOf(props);
    return createElement(Menu, {
      open: Boolean(props.open),
      onSelect: (selectedId) => emit("menu", runtime, "select", { selectedId }),
    });
  },
  ["open"],
);
register("popover", (props) => createElement(Popover, { open: Boolean(props.open) }), ["open"]);
register(
  "toast",
  (props) => {
    const runtime = runtimeOf(props);
    return createElement(Toast, { open: Boolean(props.open), onClose: () => emit("toast", runtime, "dismiss") });
  },
  ["open"],
);
for (const state of feedback) register(`${state}-state`, () => createElement(StateView, { state }));

export function catalogHas(id: string): boolean {
  return assetCatalog.some((asset) => asset.id === id);
}
export function implementationIds(): string[] {
  return [...implementations.keys()];
}
export function implementationPropertyNames(id: string): string[] {
  const implementation = implementations.get(id);
  if (!implementation) throw new Error(`No implementation registered for ${id}`);
  return [...implementation.allowedProps].sort();
}
export function instantiateAsset(id: string, props: Record<string, unknown> = {}, runtime: AssetRuntime = {}) {
  const implementation = implementations.get(id);
  if (!implementation) throw new Error(`No implementation registered for ${id}`);
  const descriptor = assetCatalog.find((asset) => asset.id === id);
  if (!descriptor) throw new Error(`No descriptor declared for ${id}`);
  const unsupported = Object.keys(props).filter((name) => !implementation.allowedProps.has(name));
  if (unsupported.length) throw new Error(`Unsupported properties for ${id}: ${unsupported.join(", ")}`);
  validateValues(id, props, descriptor.properties, "property");
  validateValues(id, runtime.inputs ?? {}, descriptor.inputs, "input");
  const declaredSlots = new Set<string>(descriptor.slots);
  const unsupportedSlots = (runtime.slots ?? []).filter((slot) => !declaredSlots.has(slot.id));
  if (unsupportedSlots.length)
    throw new Error(`Unsupported slots for ${id}: ${unsupportedSlots.map((slot) => slot.id).join(", ")}`);
  return createElement(implementation.component, { ...props, $runtime: runtime });
}

export const catalogCompatibility = {
  policy: "Stable IDs are immutable within a major version. Replacement uses a new @major ID; aliases are prohibited.",
  deprecation:
    "Deprecated assets remain implemented for one release window and name their replacement before removal in the next major version.",
} as const;
