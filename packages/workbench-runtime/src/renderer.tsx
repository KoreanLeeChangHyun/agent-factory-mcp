import { Component as ReactComponent, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import type { Component as DefinitionComponent, WorkbenchDefinition } from "@agent-factory/contracts";
import { instantiateAsset, ShellResizeHandle, type AssetActionEvent } from "@agent-factory/design-system";
import type { BindingClient, BindingOperation, RuntimeRecord, RuntimeScope } from "./contracts.js";
import { BindingRuntime, type BindingSnapshot } from "./bindings.js";
import { diagnoseWorkbench, layoutSlotContracts } from "./validation.js";
import { ActionRegistry, type ActionEnvironment } from "./actions.js";

export type RendererActionEnvironment = Omit<ActionEnvironment, "refresh"> &
  Partial<Pick<ActionEnvironment, "refresh">>;

function Diagnostic({ children, path }: { children: ReactNode; path: string }) {
  return (
    <section className="af-runtime-diagnostic" role="alert" data-path={path}>
      <strong>구성을 표시할 수 없습니다.</strong>
      <span>{children}</span>
    </section>
  );
}
class RenderBoundary extends ReactComponent<{ children: ReactNode; path: string }, { error: string | null }> {
  state: { error: string | null } = { error: null };
  static getDerivedStateFromError(error: unknown) {
    return { error: error instanceof Error ? error.message : "렌더링 오류" };
  }
  render() {
    return this.state.error ? <Diagnostic path={this.props.path}>{this.state.error}</Diagnostic> : this.props.children;
  }
}
function SafeAsset({ id, path, props = {} }: { id: string; path: string; props?: Record<string, unknown> }) {
  try {
    return (
      <RenderBoundary key={`${id}:${JSON.stringify(props)}`} path={path}>
        {instantiateAsset(id, props)}
      </RenderBoundary>
    );
  } catch (error) {
    return <Diagnostic path={path}>{error instanceof Error ? error.message : "에셋 오류"}</Diagnostic>;
  }
}
function ComponentNode({
  component,
  definition,
  runtime,
  scope,
  state,
  onAction,
  slots,
  selection,
  expanded,
  onExpandedChange,
  refreshSnapshot,
}: {
  component: DefinitionComponent;
  definition: WorkbenchDefinition;
  runtime: BindingRuntime;
  scope: RuntimeScope;
  state: RuntimeRecord;
  onAction?: (component: DefinitionComponent, event: AssetActionEvent) => void;
  slots?: { id: string; content: ReactNode }[];
  selection: string | null;
  expanded: string[];
  onExpandedChange?: (ids: string[]) => void;
  refreshSnapshot?: BindingSnapshot;
}) {
  const binding = definition.bindings.find((entry) => entry.id === component.binding);
  const forcedState = component.state && component.state !== "ready" ? component.state : null;
  const [snapshot, setSnapshot] = useState<BindingSnapshot>({ status: binding ? "loading" : "ready", diagnostics: [] });
  useEffect(() => {
    let active = true;
    if (forcedState && forcedState !== "stale" && forcedState !== "disabled") return;
    if (!binding) return;
    setSnapshot({ status: "loading", diagnostics: [] });
    void runtime
      .load(binding, state, scope, false, component.id)
      .then((result) => {
        if (active) setSnapshot(result);
      })
      .catch((error: unknown) => {
        if (active && !(error instanceof DOMException && error.name === "AbortError"))
          setSnapshot({
            status: "error",
            diagnostics: [],
            error: error instanceof Error ? error.message : "binding 오류",
          });
      });
    return () => {
      active = false;
      runtime.cancelBinding(component.id);
    };
  }, [binding, component.id, forcedState, runtime, scope, state]);
  useEffect(() => {
    if (refreshSnapshot) setSnapshot(refreshSnapshot);
  }, [refreshSnapshot]);
  if (forcedState && ["loading", "empty", "error", "permission-denied"].includes(forcedState))
    return instantiateAsset(`${forcedState}-state@1`);
  if (snapshot.status === "loading") return instantiateAsset("loading-state@1");
  if (snapshot.status === "error")
    return (
      <Diagnostic path={`component.${component.id}.binding`}>
        {snapshot.error ?? snapshot.diagnostics[0]?.message}
      </Diagnostic>
    );
  if (snapshot.status === "empty") return instantiateAsset("empty-state@1");
  try {
    const rendered = instantiateAsset(
      component.asset,
      { ...(component.props ?? {}), ...(forcedState === "disabled" ? { disabled: true } : {}) } as Record<
        string,
        unknown
      >,
      {
        inputs: snapshot.data,
        onAction: (event) => onAction?.(component, event),
        slots,
        viewState: { selection, expanded, onExpandedChange },
      },
    );
    const protectedRender = (
      <RenderBoundary
        key={`${component.asset}:${snapshot.status}:${Object.keys(snapshot.data ?? {}).join(",")}`}
        path={`component.${component.id}`}
      >
        {rendered}
      </RenderBoundary>
    );
    return snapshot.status === "stale" || forcedState === "stale" ? (
      <>
        {instantiateAsset("stale-state@1")}
        {protectedRender}
      </>
    ) : (
      protectedRender
    );
  } catch (error) {
    return (
      <Diagnostic path={`component.${component.id}`}>
        {error instanceof Error ? error.message : "컴포넌트 오류"}
      </Diagnostic>
    );
  }
}
export function WorkbenchRenderer({
  definition,
  client,
  operations,
  scope,
  state,
  onAction,
  sidebarWidth = 268,
  onSidebarWidthChange,
  sidebarOpen = true,
  onSidebarOpenChange,
  selection = null,
  expanded = [],
  onExpandedChange,
  actionEnvironment,
  embedded = false,
}: {
  definition: unknown;
  client: BindingClient;
  operations: readonly BindingOperation[];
  scope: RuntimeScope;
  state: RuntimeRecord;
  onAction?: (component: DefinitionComponent, event: AssetActionEvent) => void;
  sidebarWidth?: number;
  onSidebarWidthChange?: (width: number) => void;
  sidebarOpen?: boolean;
  onSidebarOpenChange?: (open: boolean) => void;
  selection?: string | null;
  expanded?: string[];
  onExpandedChange?: (ids: string[]) => void;
  actionEnvironment?: RendererActionEnvironment;
  embedded?: boolean;
}) {
  const diagnostics = diagnoseWorkbench(definition);
  const valid = definition as WorkbenchDefinition;
  const runtime = useMemo(() => new BindingRuntime(client, operations), [client, operations]);
  const actions = useMemo(() => (diagnostics.length ? null : new ActionRegistry(valid)), [diagnostics.length, valid]);
  const [actionError, setActionError] = useState("");
  const [refreshSnapshots, setRefreshSnapshots] = useState<Record<string, BindingSnapshot>>({});
  useEffect(() => () => runtime.cancel(), [runtime]);
  if (diagnostics.length)
    return (
      <Diagnostic path={diagnostics[0].path}>
        {diagnostics.map((entry) => `${entry.path}: ${entry.message}`).join(" ")}
      </Diagnostic>
    );
  const dispatch = (actionIds: readonly string[], event: AssetActionEvent) => {
    const actionId = actionIds.find((id) => valid.actions.find((action) => action.id === id)?.kind === event.action);
    if (!actionId) {
      setActionError("선언된 action이 없습니다.");
      return;
    }
    if (!actionEnvironment) return;
    setActionError("");
    const environment: ActionEnvironment = {
      ...actionEnvironment,
      refresh: async (bindingId) => {
        const binding = valid.bindings.find((entry) => entry.id === bindingId);
        if (!binding) throw new Error(`binding ${bindingId}이 없습니다.`);
        const snapshot = await runtime.load(binding, state, scope, true, `action:${bindingId}`);
        if (snapshot.status === "error") throw new Error(snapshot.error ?? "새로고침을 완료하지 못했습니다.");
        setRefreshSnapshots((current) => ({ ...current, [bindingId]: snapshot }));
      },
    };
    void actions!
      .dispatch(actionId, event.output as RuntimeRecord, environment)
      .catch((error: unknown) =>
        setActionError(error instanceof Error ? error.message : "동작을 완료하지 못했습니다."),
      );
  };
  const dispatchComponent = (component: DefinitionComponent, event: AssetActionEvent) => {
    onAction?.(component, event);
    dispatch(component.actions ?? [], event);
  };
  const renderRegion = (region: "sidebar" | "panel") => {
    const layout = valid[region];
    const byParent = new Map<string, DefinitionComponent[]>();
    for (const component of layout.components) {
      const key = component.parentId ?? "$root";
      byParent.set(key, [...(byParent.get(key) ?? []), component]);
    }
    const renderNode = (component: DefinitionComponent): ReactNode => {
      const children = byParent.get(component.id) ?? [];
      const slots = [...new Set(children.map((child) => child.slot))].map((id) => ({
        id,
        content: children.filter((child) => child.slot === id).map(renderNode),
      }));
      return (
        <div key={component.id} data-component-id={component.id} data-component-slot={component.slot}>
          <ComponentNode
            component={component}
            definition={valid}
            runtime={runtime}
            scope={scope}
            state={state}
            onAction={dispatchComponent}
            selection={selection}
            expanded={expanded}
            onExpandedChange={onExpandedChange}
            slots={slots.length ? slots : undefined}
            refreshSnapshot={component.binding ? refreshSnapshots[component.binding] : undefined}
          />
        </div>
      );
    };
    const rootComponents = byParent.get("$root") ?? [];
    const slots = (layoutSlotContracts[layout.asset] ?? [])
      .filter((id) => rootComponents.some((component) => component.slot === id))
      .map((id) => ({
        id,
        content: rootComponents.filter((component) => component.slot === id).map(renderNode),
      }));
    return (
      <section
        className={`af-runtime-${region}`}
        aria-label={layout.label ?? (region === "sidebar" ? "사이드바" : "패널")}
      >
        <div className="af-runtime-layout" data-layout-id={layout.asset}>
          <RenderBoundary path={`$.${region}.asset`}>
            {instantiateAsset(layout.asset, region === "sidebar" && layout.label ? { title: layout.label } : {}, {
              slots,
              viewState: { selection, expanded, onExpandedChange },
              onAction: (event) => dispatch(layout.actions ?? [], event),
            })}
          </RenderBoundary>
        </div>
      </section>
    );
  };
  const regions = (
    <>
      {sidebarOpen && renderRegion("sidebar")}
      {sidebarOpen && onSidebarWidthChange && (
        <ShellResizeHandle width={sidebarWidth} onChange={onSidebarWidthChange} />
      )}
      {renderRegion("panel")}
      {actionError && <Diagnostic path="$.actions">{actionError}</Diagnostic>}
    </>
  );
  if (embedded) return regions;
  return (
    <main
      className={`af-workbench-runtime${sidebarOpen ? "" : " af-sidebar-closed"}`}
      style={{ "--af-runtime-sidebar-width": `${sidebarWidth}px` } as CSSProperties}
    >
      <nav className="af-runtime-task-list" aria-label="작업 목록">
        <SafeAsset
          id={valid.descriptor.icon}
          path="$.descriptor.icon"
          props={{ label: valid.descriptor.title, selected: true }}
        />
        <button
          type="button"
          className="af-runtime-sidebar-toggle"
          aria-expanded={sidebarOpen}
          onClick={() => onSidebarOpenChange?.(!sidebarOpen)}
        >
          사이드바
        </button>
      </nav>
      {regions}
    </main>
  );
}
