import { useMemo, useState } from "react";
import {
  limits,
  type AssetParameter,
  type ComponentProps,
  type Component,
  type PanelAsset,
  type Region,
  type Scalar,
  type SidebarAsset,
  type WorkbenchDefinition,
} from "@agent-factory/contracts";
import { assetCatalog, Button } from "@agent-factory/design-system";
import {
  cloneDefinition,
  diagnoseWorkbench,
  WorkbenchRenderer,
  type BindingClient,
  type BindingOperation,
  type RuntimeRecord,
  type RuntimeScope,
} from "@agent-factory/workbench-runtime";

type EditableRegion = "sidebar" | "panel";
interface History {
  past: WorkbenchDefinition[];
  present: WorkbenchDefinition;
  future: WorkbenchDefinition[];
}

const uniqueId = (definition: WorkbenchDefinition, base: string) => {
  const taken = new Set(
    [...definition.sidebar.components, ...definition.panel.components].map((component) => component.id),
  );
  const stem = base.replace(/@\d+$/, "").replace(/[^a-z0-9-]/g, "-");
  let candidate = stem;
  let suffix = 2;
  while (taken.has(candidate)) candidate = `${stem}-${suffix++}`;
  return candidate;
};
const descriptorsFor = (region: Region) => assetCatalog.filter((asset) => asset.allowedRegions.includes(region));
const defaultSlots: Record<EditableRegion, Record<string, Component["slot"]>> = {
  sidebar: { default: "content" },
  panel: {
    "detail@1": "content",
    "list-detail@1": "detail",
    "collection@1": "content",
    "settings@1": "content",
    "dashboard@1": "content",
    "document@1": "content",
    "split@1": "primary",
    "timeline@1": "content",
    "kanban@1": "content",
  },
};
export const isInsertableAsset = (kind: string) => kind === "control" || kind === "display" || kind === "feedback";
export const propertyControlKind = (property: AssetParameter) =>
  property.enum
    ? "enum"
    : property.type === "boolean"
      ? "boolean"
      : property.type === "string-list" || property.type === "record-list"
        ? "list"
        : property.type === "number" || property.type === "integer"
          ? "number"
          : "string";

export function WorkbenchEditor({
  initialDefinition,
  client,
  operations,
  scope,
  state = {},
  onDraftChange,
}: {
  initialDefinition: WorkbenchDefinition;
  client: BindingClient;
  operations: readonly BindingOperation[];
  scope: RuntimeScope;
  state?: RuntimeRecord;
  onDraftChange?: (definition: WorkbenchDefinition) => void;
}) {
  const [history, setHistory] = useState<History>({
    past: [],
    present: cloneDefinition(initialDefinition),
    future: [],
  });
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<{ region: EditableRegion; id: string } | null>(null);
  const [importText, setImportText] = useState(() => JSON.stringify(initialDefinition, null, 2));
  const [importError, setImportError] = useState("");
  const draft = history.present;
  const diagnostics = diagnoseWorkbench(draft);
  const palette = useMemo(
    () =>
      assetCatalog.filter((asset) => isInsertableAsset(asset.kind) && asset.id.includes(query.trim().toLowerCase())),
    [query],
  );
  const commit = (next: WorkbenchDefinition) => {
    setHistory((current) => ({ past: [...current.past.slice(-49), current.present], present: next, future: [] }));
    setImportText(JSON.stringify(next, null, 2));
    onDraftChange?.(next);
  };
  const mutate = (operation: (definition: WorkbenchDefinition) => void) => {
    const next = cloneDefinition(draft);
    operation(next);
    commit(next);
  };
  const insert = (region: EditableRegion, asset: string) =>
    mutate((next) => {
      const descriptor = assetCatalog.find((entry) => entry.id === asset);
      if (!descriptor || !isInsertableAsset(descriptor.kind) || !descriptor.allowedRegions.includes(region)) return;
      const slot = defaultSlots[region][next[region].asset] ?? defaultSlots[region].default!;
      next[region].components.push({ id: uniqueId(next, asset), asset, slot, state: "ready" });
    });
  const move = (region: EditableRegion, index: number, by: number) =>
    mutate((next) => {
      const target = index + by;
      if (target < 0 || target >= next[region].components.length) return;
      const [item] = next[region].components.splice(index, 1);
      next[region].components.splice(target, 0, item!);
    });
  const remove = (region: EditableRegion, index: number) =>
    mutate((next) => {
      next[region].components.splice(index, 1);
    });
  const selectedComponent = selected
    ? draft[selected.region].components.find((component) => component.id === selected.id)
    : undefined;
  const selectedDescriptor = selectedComponent
    ? assetCatalog.find((asset) => asset.id === selectedComponent.asset)
    : undefined;
  const undo = () => {
    const next = history.past.at(-1);
    if (!next) return;
    setHistory({ past: history.past.slice(0, -1), present: next, future: [history.present, ...history.future] });
    setImportText(JSON.stringify(next, null, 2));
    onDraftChange?.(next);
  };
  const redo = () => {
    const next = history.future[0];
    if (!next) return;
    setHistory({ past: [...history.past, history.present], present: next, future: history.future.slice(1) });
    setImportText(JSON.stringify(next, null, 2));
    onDraftChange?.(next);
  };
  const importDefinition = () => {
    try {
      if (new TextEncoder().encode(importText).byteLength > limits.maxBytes)
        throw new Error("정의가 최대 크기를 초과했습니다.");
      const candidate = JSON.parse(importText) as unknown;
      const issues = diagnoseWorkbench(candidate);
      if (issues.length) throw new Error(issues.map((entry) => `${entry.path}: ${entry.message}`).join("\n"));
      commit(candidate as WorkbenchDefinition);
      setImportError("");
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "정의를 읽을 수 없습니다.");
    }
  };
  return (
    <main className="af-authoring" aria-label="Workbench 작성기">
      <header className="af-authoring-toolbar">
        <div>
          <h1>Workbench 구성</h1>
          <p>검증된 공통 에셋으로 초안을 구성하고 미리 봅니다.</p>
        </div>
        <Button disabled={!history.past.length} onClick={undo}>
          실행 취소
        </Button>
        <Button disabled={!history.future.length} onClick={redo}>
          다시 실행
        </Button>
      </header>
      <div className="af-authoring-grid">
        <aside className="af-authoring-palette" aria-label="에셋 팔레트">
          <label>
            에셋 검색
            <input value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
          <h2>컴포넌트</h2>
          {palette.map((asset) => (
            <div className="af-authoring-palette-row" key={asset.id}>
              <span>{asset.id}</span>
              {(["sidebar", "panel"] as const)
                .filter((region) => asset.allowedRegions.includes(region))
                .map((region) => (
                  <button
                    key={region}
                    type="button"
                    aria-label={`${asset.id} ${region === "sidebar" ? "사이드바에 추가" : "패널에 추가"}`}
                    onClick={() => insert(region, asset.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        insert(region, asset.id);
                      }
                    }}
                  >
                    {" "}
                    {region === "sidebar" ? "사이드바에 추가" : "패널에 추가"}
                  </button>
                ))}
            </div>
          ))}
          <h2>레이아웃</h2>
          <label>
            작업 아이콘
            <select
              value={draft.descriptor.icon}
              onChange={(event) =>
                mutate((next) => {
                  next.descriptor.icon = event.target.value;
                })
              }
            >
              {assetCatalog
                .filter((asset) => asset.kind === "icon")
                .map((asset) => (
                  <option key={asset.id}>{asset.id}</option>
                ))}
            </select>
          </label>
          {(["sidebar", "panel"] as const).map((region) => (
            <label key={region}>
              {region === "sidebar" ? "사이드바" : "패널"}
              <select
                value={draft[region].asset}
                onChange={(event) =>
                  mutate((next) => {
                    if (region === "sidebar") next.sidebar.asset = event.target.value as SidebarAsset;
                    else next.panel.asset = event.target.value as PanelAsset;
                  })
                }
              >
                {descriptorsFor(region)
                  .filter((asset) => asset.kind === region)
                  .map((asset) => (
                    <option key={asset.id}>{asset.id}</option>
                  ))}
              </select>
            </label>
          ))}
        </aside>
        <section className="af-authoring-composition" aria-label="구성 트리">
          {(["sidebar", "panel"] as const).map((region) => (
            <section key={region}>
              <h2>{region === "sidebar" ? "사이드바" : "패널"}</h2>
              <ol>
                {draft[region].components.map((component, index) => (
                  <li key={component.id}>
                    <button
                      type="button"
                      aria-pressed={selected?.id === component.id}
                      onClick={() => setSelected({ region, id: component.id })}
                      onKeyDown={(event) => {
                        if (event.altKey && event.key === "ArrowUp") {
                          event.preventDefault();
                          move(region, index, -1);
                        } else if (event.altKey && event.key === "ArrowDown") {
                          event.preventDefault();
                          move(region, index, 1);
                        } else if (event.key === "Delete") {
                          event.preventDefault();
                          remove(region, index);
                        }
                      }}
                    >
                      {component.id}
                      <small>{component.asset}</small>
                    </button>
                    <button
                      type="button"
                      aria-label={`${component.id} 위로 이동`}
                      disabled={index === 0}
                      onClick={() => move(region, index, -1)}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      aria-label={`${component.id} 아래로 이동`}
                      disabled={index === draft[region].components.length - 1}
                      onClick={() => move(region, index, 1)}
                    >
                      ↓
                    </button>
                    <button type="button" aria-label={`${component.id} 제거`} onClick={() => remove(region, index)}>
                      ×
                    </button>
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </section>
        <aside className="af-authoring-properties" aria-label="속성 및 binding 편집">
          <h2>속성</h2>
          {selectedComponent && selectedDescriptor ? (
            <>
              {selectedDescriptor.properties.map((property) => (
                <label key={property.name}>
                  {property.name}
                  {property.required ? " *" : ""}
                  {propertyControlKind(property) === "enum" ? (
                    <select
                      required={property.required}
                      value={String(selectedComponent.props?.[property.name as keyof ComponentProps] ?? "")}
                      onChange={(event) =>
                        mutate((next) => {
                          const component = next[selected!.region].components.find(
                            (entry) => entry.id === selected!.id,
                          )!;
                          const props = { ...(component.props ?? {}) } as Record<string, Scalar>;
                          props[property.name] = event.target.value;
                          component.props = props as ComponentProps;
                        })
                      }
                    >
                      <option value="">선택</option>
                      {property.enum?.map((value) => (
                        <option key={value}>{value}</option>
                      ))}
                    </select>
                  ) : propertyControlKind(property) === "boolean" ? (
                    <input
                      type="checkbox"
                      checked={Boolean(selectedComponent.props?.[property.name as keyof ComponentProps])}
                      onChange={(event) =>
                        mutate((next) => {
                          const component = next[selected!.region].components.find(
                            (entry) => entry.id === selected!.id,
                          )!;
                          component.props = {
                            ...(component.props ?? {}),
                            [property.name]: event.target.checked,
                          } as ComponentProps;
                        })
                      }
                    />
                  ) : propertyControlKind(property) === "list" ? (
                    <textarea
                      aria-label={`${property.name} JSON`}
                      data-max-items={property.maxItems}
                      required={property.required}
                      value={JSON.stringify(
                        (selectedComponent.props as Record<string, unknown> | undefined)?.[property.name] ?? [],
                        null,
                        2,
                      )}
                      onChange={(event) => {
                        try {
                          const parsed = JSON.parse(event.target.value) as unknown;
                          mutate((next) => {
                            const component = next[selected!.region].components.find(
                              (entry) => entry.id === selected!.id,
                            )!;
                            component.props = { ...(component.props ?? {}), [property.name]: parsed } as ComponentProps;
                          });
                        } catch {
                          /* Preserve the last valid draft while JSON is incomplete. */
                        }
                      }}
                    />
                  ) : (
                    <input
                      required={property.required}
                      type={property.type === "number" || property.type === "integer" ? "number" : "text"}
                      step={property.type === "integer" ? 1 : undefined}
                      value={String(selectedComponent.props?.[property.name as keyof ComponentProps] ?? "")}
                      maxLength={property.maxLength}
                      onChange={(event) =>
                        mutate((next) => {
                          const component = next[selected!.region].components.find(
                            (entry) => entry.id === selected!.id,
                          )!;
                          const value =
                            property.type === "number" || property.type === "integer"
                              ? Number(event.target.value)
                              : event.target.value;
                          component.props = { ...(component.props ?? {}), [property.name]: value } as ComponentProps;
                        })
                      }
                    />
                  )}
                </label>
              ))}
              <fieldset>
                <legend>동작</legend>
                {selectedDescriptor.actions.map((kind) => {
                  const action = draft.actions.find((entry) => entry.kind === kind);
                  const checked = Boolean(action && selectedComponent.actions?.includes(action.id));
                  return (
                    <label key={kind}>
                      <input
                        type="checkbox"
                        disabled={!action}
                        checked={checked}
                        onChange={(event) =>
                          mutate((next) => {
                            const component = next[selected!.region].components.find(
                              (entry) => entry.id === selected!.id,
                            )!;
                            const ids = new Set(component.actions ?? []);
                            if (action && event.target.checked) ids.add(action.id);
                            else if (action) ids.delete(action.id);
                            component.actions = [...ids];
                          })
                        }
                      />
                      {kind}
                    </label>
                  );
                })}
              </fieldset>
              <label>
                Binding
                <select
                  value={selectedComponent.binding ?? ""}
                  onChange={(event) =>
                    mutate((next) => {
                      const component = next[selected!.region].components.find((entry) => entry.id === selected!.id)!;
                      component.binding = event.target.value || undefined;
                    })
                  }
                >
                  <option value="">없음</option>
                  {draft.bindings.map((binding) => (
                    <option key={binding.id}>{binding.id}</option>
                  ))}
                </select>
              </label>
              <label>
                미리보기 상태
                <select
                  value={selectedComponent.state ?? "ready"}
                  onChange={(event) =>
                    mutate((next) => {
                      const component = next[selected!.region].components.find((entry) => entry.id === selected!.id)!;
                      component.state = event.target.value as typeof component.state;
                    })
                  }
                >
                  {selectedDescriptor.states
                    .filter((state) =>
                      ["loading", "empty", "ready", "stale", "error", "permission-denied", "disabled"].includes(state),
                    )
                    .map((state) => (
                      <option key={state}>{state}</option>
                    ))}
                </select>
              </label>
            </>
          ) : (
            <p>구성 요소를 선택해 주세요.</p>
          )}
          <h2>Binding 정의</h2>
          {draft.bindings.map((binding, bindingIndex) => (
            <fieldset key={binding.id}>
              <legend>{binding.id}</legend>
              <label>
                Operation
                <select
                  value={binding.source}
                  onChange={(event) =>
                    mutate((next) => {
                      const current = next.bindings[bindingIndex]!;
                      const operation = operations.find((entry) => entry.id === event.target.value);
                      current.source = event.target.value;
                      current.inputMappings = (operation?.inputs ?? []).map((input) => ({
                        input: input.name,
                        statePath:
                          current.inputMappings.find((mapping) => mapping.input === input.name)?.statePath ??
                          "state.value",
                      }));
                    })
                  }
                >
                  {!operations.some((operation) => operation.id === binding.source) && (
                    <option value={binding.source}>{binding.source} · 사용할 수 없음</option>
                  )}
                  {operations.map((operation) => (
                    <option key={operation.id}>{operation.id}</option>
                  ))}
                </select>
              </label>
              {binding.inputMappings.map((mapping, mappingIndex) => (
                <label key={mapping.input}>
                  {mapping.input} 상태 경로
                  <input
                    value={mapping.statePath}
                    onChange={(event) =>
                      mutate((next) => {
                        next.bindings[bindingIndex]!.inputMappings[mappingIndex]!.statePath = event.target.value;
                      })
                    }
                  />
                </label>
              ))}
              <label>
                캐시(초)
                <input
                  type="number"
                  min={0}
                  max={300}
                  value={binding.cacheSeconds ?? 0}
                  onChange={(event) =>
                    mutate((next) => {
                      next.bindings[bindingIndex]!.cacheSeconds = Math.max(
                        0,
                        Math.min(300, event.target.valueAsNumber),
                      );
                    })
                  }
                />
              </label>
            </fieldset>
          ))}
          <h2>검증</h2>
          <div role="status">{diagnostics.length ? `${diagnostics.length}개 문제` : "정의가 유효합니다."}</div>
          {diagnostics.map((entry) => (
            <p className="af-authoring-error" key={`${entry.path}-${entry.code}`}>
              <code>{entry.path}</code> {entry.message}
            </p>
          ))}
        </aside>
        <section className="af-authoring-preview" aria-label="초안 미리보기">
          <h2>초안 미리보기</h2>
          <WorkbenchRenderer definition={draft} client={client} operations={operations} scope={scope} state={state} />
        </section>
        <section className="af-authoring-import" aria-label="직렬화 및 가져오기">
          <h2>정의 JSON</h2>
          <textarea
            aria-label="Workbench 정의 JSON"
            maxLength={limits.maxBytes}
            value={importText}
            onChange={(event) => setImportText(event.target.value)}
          />
          <Button onClick={importDefinition}>가져오기 및 검증</Button>
          {importError && <pre role="alert">{importError}</pre>}
          <p>게시 기능은 서버의 불변 release 흐름이 연결된 뒤 제공됩니다.</p>
        </section>
      </div>
    </main>
  );
}
