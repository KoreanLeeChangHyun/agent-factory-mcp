import { validate, type AssetParameter, type Region, type WorkbenchDefinition } from "@agent-factory/contracts";
import { assetCatalog } from "@agent-factory/design-system";
import type { RuntimeDiagnostic, RuntimeRecord, RuntimeValue } from "./contracts.js";

const descriptors = new Map(assetCatalog.map((descriptor) => [descriptor.id, descriptor]));
const issue = (path: string, code: string, message: string): RuntimeDiagnostic => ({ path, code, message });
const unsafeNativeString =
  /(?:[A-Za-z][A-Za-z0-9+.-]*:(?:\/{0,2})?\S|\/\/|www\.|\$\{|<|[{}]|bearer |basic |api[_-]?key|access[_-]?token|password)/i;
export const layoutSlotContracts: Readonly<Record<string, readonly string[]>> = {
  "flat-list@1": ["content"],
  "group-list@1": ["content"],
  "favorites-recent@1": ["content"],
  "search-list@1": ["content"],
  "filter-list@1": ["content"],
  "detail-list@1": ["content"],
  "tree@1": ["content"],
  "detail@1": ["header", "content", "actions"],
  "list-detail@1": ["list", "detail"],
  "collection@1": ["content"],
  "settings@1": ["content", "actions"],
  "dashboard@1": ["content"],
  "document@1": ["header", "content"],
  "split@1": ["primary", "secondary"],
  "timeline@1": ["sidebar", "content"],
  "kanban@1": ["content"],
};

export function validateParameterValues(
  value: RuntimeRecord,
  parameters: readonly AssetParameter[],
  path = "$",
): RuntimeDiagnostic[] {
  const issues: RuntimeDiagnostic[] = [];
  const declared = new Map(parameters.map((parameter) => [parameter.name, parameter]));
  for (const name of Object.keys(value))
    if (!declared.has(name)) issues.push(issue(`${path}.${name}`, "unknown-field", "선언되지 않은 필드입니다."));
  for (const parameter of parameters) {
    const candidate = value[parameter.name];
    if (candidate === undefined) {
      if (parameter.required) issues.push(issue(`${path}.${parameter.name}`, "required", "필수 값이 없습니다."));
      continue;
    }
    const valid =
      (parameter.type === "string" && typeof candidate === "string") ||
      (parameter.type === "number" && typeof candidate === "number" && Number.isFinite(candidate)) ||
      (parameter.type === "integer" && typeof candidate === "number" && Number.isInteger(candidate)) ||
      (parameter.type === "boolean" && typeof candidate === "boolean") ||
      (parameter.type === "string-list" &&
        Array.isArray(candidate) &&
        candidate.every((item) => typeof item === "string")) ||
      (parameter.type === "record-list" && Array.isArray(candidate) && candidate.every(isRecord));
    if (!valid) {
      issues.push(issue(`${path}.${parameter.name}`, "wrong-type", `${parameter.type} 형식이어야 합니다.`));
      continue;
    }
    if (typeof candidate === "string" && parameter.maxLength !== undefined && candidate.length > parameter.maxLength)
      issues.push(
        issue(`${path}.${parameter.name}`, "too-long", `최대 ${parameter.maxLength}자까지 입력할 수 있습니다.`),
      );
    if (typeof candidate === "string" && unsafeNativeString.test(candidate))
      issues.push(issue(`${path}.${parameter.name}`, "unsafe-string", "허용되지 않은 네이티브 정의 문자열입니다."));
    if (parameter.type === "string-list" && Array.isArray(candidate))
      for (const [index, item] of candidate.entries())
        if (typeof item === "string" && unsafeNativeString.test(item))
          issues.push(
            issue(`${path}.${parameter.name}[${index}]`, "unsafe-string", "허용되지 않은 네이티브 정의 문자열입니다."),
          );
    if (Array.isArray(candidate) && parameter.maxItems !== undefined && candidate.length > parameter.maxItems)
      issues.push(issue(`${path}.${parameter.name}`, "too-many-items", `최대 ${parameter.maxItems}개까지 허용됩니다.`));
    if (parameter.enum && typeof candidate === "string" && !parameter.enum.includes(candidate))
      issues.push(issue(`${path}.${parameter.name}`, "unknown-value", "허용된 값이 아닙니다."));
    if (parameter.type === "record-list" && Array.isArray(candidate) && parameter.items) {
      for (const [index, entry] of candidate.entries()) {
        if (!isRecord(entry)) continue;
        const itemPath = `${path}.${parameter.name}[${index}]`;
        const fields = parameter.items.properties;
        for (const name of Object.keys(entry))
          if (!Object.hasOwn(fields, name))
            issues.push(issue(`${itemPath}.${name}`, "unknown-field", "선언되지 않은 필드입니다."));
        for (const name of parameter.items.required)
          if (entry[name] === undefined) issues.push(issue(`${itemPath}.${name}`, "required", "필수 값이 없습니다."));
        for (const [name, field] of Object.entries(fields)) {
          const fieldValue = entry[name];
          if (fieldValue === undefined) continue;
          const fieldValid =
            (field.type === "string" && typeof fieldValue === "string") ||
            (field.type === "number" && typeof fieldValue === "number" && Number.isFinite(fieldValue)) ||
            (field.type === "integer" && typeof fieldValue === "number" && Number.isInteger(fieldValue)) ||
            (field.type === "boolean" && typeof fieldValue === "boolean");
          if (!fieldValid) issues.push(issue(`${itemPath}.${name}`, "wrong-type", `${field.type} 형식이어야 합니다.`));
          if (typeof fieldValue === "string" && field.minLength !== undefined && fieldValue.length < field.minLength)
            issues.push(issue(`${itemPath}.${name}`, "too-short", `최소 ${field.minLength}자여야 합니다.`));
          if (typeof fieldValue === "string" && field.maxLength !== undefined && fieldValue.length > field.maxLength)
            issues.push(issue(`${itemPath}.${name}`, "too-long", `최대 ${field.maxLength}자까지 입력할 수 있습니다.`));
          if (typeof fieldValue === "string" && unsafeNativeString.test(fieldValue))
            issues.push(issue(`${itemPath}.${name}`, "unsafe-string", "허용되지 않은 네이티브 정의 문자열입니다."));
        }
      }
      if (parameter.uniqueBy) {
        const values = candidate.filter(isRecord).map((entry) => entry[parameter.uniqueBy!]);
        if (new Set(values).size !== values.length)
          issues.push(
            issue(`${path}.${parameter.name}`, "duplicate-item", `${parameter.uniqueBy} 값은 고유해야 합니다.`),
          );
      }
    }
  }
  return issues;
}

export function isRecord(value: RuntimeValue | unknown): value is RuntimeRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function readStatePath(state: RuntimeRecord, path: string): RuntimeValue | undefined {
  let current: RuntimeValue | undefined = state;
  for (const segment of path.split(".")) {
    if (!isRecord(current)) return undefined;
    current = current[segment];
  }
  return current;
}

export function diagnoseWorkbench(value: unknown): RuntimeDiagnostic[] {
  try {
    validate(value);
  } catch (error) {
    return [issue("$", "schema", error instanceof Error ? error.message : "Workbench 정의가 유효하지 않습니다.")];
  }
  const definition = value as WorkbenchDefinition;
  const issues: RuntimeDiagnostic[] = [];
  const components = [
    ...definition.sidebar.components.map((component, index) => ({
      component,
      path: `$.sidebar.components[${index}]`,
      region: "sidebar" as Region,
    })),
    ...definition.panel.components.map((component, index) => ({
      component,
      path: `$.panel.components[${index}]`,
      region: "panel" as Region,
    })),
  ];
  const ids = new Set<string>();
  const bindings = new Set<string>();
  for (const [index, binding] of definition.bindings.entries()) {
    if (bindings.has(binding.id))
      issues.push(issue(`$.bindings[${index}].id`, "duplicate-id", `중복된 binding ID ${binding.id}입니다.`));
    bindings.add(binding.id);
  }
  const actions = new Map<string, WorkbenchDefinition["actions"][number]>();
  for (const [index, action] of definition.actions.entries()) {
    if (actions.has(action.id))
      issues.push(issue(`$.actions[${index}].id`, "duplicate-id", `중복된 action ID ${action.id}입니다.`));
    actions.set(action.id, action);
  }
  const rootAssets: [string, string, Region][] = [
    [definition.descriptor.icon, "$.descriptor.icon", "task-list"],
    [definition.sidebar.asset, "$.sidebar.asset", "sidebar"],
    [definition.panel.asset, "$.panel.asset", "panel"],
  ];
  for (const [assetId, path, region] of rootAssets) {
    const descriptor = descriptors.get(assetId);
    if (!descriptor) issues.push(issue(path, "unknown-asset", `등록되지 않은 에셋 ${assetId}입니다.`));
    else if (!descriptor.allowedRegions.includes(region))
      issues.push(issue(path, "invalid-region", `${region} 영역에서 사용할 수 없습니다.`));
  }
  for (const region of ["sidebar", "panel"] as const) {
    const layout = definition[region];
    const descriptor = descriptors.get(layout.asset);
    for (const actionId of layout.actions ?? []) {
      const action = actions.get(actionId);
      if (!action) issues.push(issue(`$.${region}.actions`, "unknown-action", `action ${actionId}이 없습니다.`));
      else if (!descriptor?.actions.includes(action.kind))
        issues.push(
          issue(
            `$.${region}.actions`,
            "unsupported-action",
            `${layout.asset}은 ${action.kind} 동작을 지원하지 않습니다.`,
          ),
        );
    }
  }
  for (const { component, path, region } of components) {
    if (ids.has(component.id))
      issues.push(issue(`${path}.id`, "duplicate-id", `중복된 컴포넌트 ID ${component.id}입니다.`));
    ids.add(component.id);
    const descriptor = descriptors.get(component.asset);
    if (!descriptor) {
      issues.push(issue(`${path}.asset`, "unknown-asset", `등록되지 않은 에셋 ${component.asset}입니다.`));
      continue;
    }
    if (!descriptor.allowedRegions.includes(region))
      issues.push(issue(`${path}.asset`, "invalid-region", `${region} 영역에서 사용할 수 없습니다.`));
    if (descriptor.kind === "sidebar" || descriptor.kind === "panel" || descriptor.kind === "icon")
      issues.push(issue(`${path}.asset`, "structural-asset", "구조 에셋은 컴포넌트로 삽입할 수 없습니다."));
    if (component.state && !descriptor.states.includes(component.state))
      issues.push(
        issue(
          `${path}.state`,
          "unsupported-state",
          `${component.asset}은 ${component.state} 상태를 지원하지 않습니다.`,
        ),
      );
    issues.push(
      ...validateParameterValues((component.props ?? {}) as RuntimeRecord, descriptor.properties, `${path}.props`),
    );
    if (component.binding && !bindings.has(component.binding))
      issues.push(issue(`${path}.binding`, "unknown-binding", `binding ${component.binding}이 없습니다.`));
    for (const actionId of component.actions ?? []) {
      const action = actions.get(actionId);
      if (!action) issues.push(issue(`${path}.actions`, "unknown-action", `action ${actionId}이 없습니다.`));
      else if (!descriptor.actions.includes(action.kind))
        issues.push(
          issue(
            `${path}.actions`,
            "unsupported-action",
            `${component.asset}은 ${action.kind} 동작을 지원하지 않습니다.`,
          ),
        );
    }
  }
  for (const region of ["sidebar", "panel"] as const) {
    const layout = definition[region];
    const regionComponents = layout.components;
    const byId = new Map(regionComponents.map((component) => [component.id, component]));
    for (const [index, component] of regionComponents.entries()) {
      const path = `$.${region}.components[${index}]`;
      const allowed = component.parentId
        ? descriptors.get(byId.get(component.parentId)?.asset ?? "")?.slots
        : descriptors.get(layout.asset)?.slots;
      if (component.parentId && !byId.has(component.parentId))
        issues.push(issue(`${path}.parentId`, "unknown-parent", `parent ${component.parentId}가 없습니다.`));
      else if (!allowed?.includes(component.slot))
        issues.push(issue(`${path}.slot`, "invalid-slot", `${component.slot} slot에는 배치할 수 없습니다.`));
      const seen = new Set([component.id]);
      let parent = component.parentId ? byId.get(component.parentId) : undefined;
      let depth = 0;
      while (parent) {
        depth += 1;
        if (seen.has(parent.id)) {
          issues.push(issue(`${path}.parentId`, "component-cycle", "컴포넌트 트리에 순환이 있습니다."));
          break;
        }
        if (depth > 6) {
          issues.push(issue(`${path}.parentId`, "tree-too-deep", "컴포넌트 트리 깊이는 6 이하여야 합니다."));
          break;
        }
        seen.add(parent.id);
        parent = parent.parentId ? byId.get(parent.parentId) : undefined;
      }
    }
  }
  for (const [index, action] of definition.actions.entries()) {
    if (action.kind === "navigate-internal" && !action.target)
      issues.push(issue(`$.actions[${index}].target`, "required-target", "내부 이동에는 대상 ID가 필요합니다."));
    if (action.kind === "refresh" && action.target && !bindings.has(action.target))
      issues.push(
        issue(`$.actions[${index}].target`, "unknown-binding", `refresh 대상 binding ${action.target}이 없습니다.`),
      );
    if (action.kind === "dismiss" && !action.target)
      issues.push(issue(`$.actions[${index}].target`, "required-target", "dismiss에는 닫을 대상 ID가 필요합니다."));
    if (action.kind === "submit" && action.payloadBinding && !bindings.has(action.payloadBinding))
      issues.push(
        issue(
          `$.actions[${index}].payloadBinding`,
          "unknown-binding",
          `submit payload binding ${action.payloadBinding}이 없습니다.`,
        ),
      );
  }
  return issues;
}

export function interpretWorkbench(value: unknown): WorkbenchDefinition {
  const issues = diagnoseWorkbench(value);
  if (issues.length) throw new Error(issues.map((entry) => `${entry.path}: ${entry.message}`).join("\n"));
  return value as WorkbenchDefinition;
}
