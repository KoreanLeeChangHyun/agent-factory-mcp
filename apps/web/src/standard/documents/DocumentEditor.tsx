import { useEffect, useReducer, useRef, type Dispatch, type ReactNode } from "react";
import type { DocumentRecord } from "./document-client.js";
import { DocumentViewer } from "./DocumentViewer.js";
import {
  editorReducer,
  initialEditorState,
  type EditorDocument,
  type EditorGroup,
  type EditorLayout,
  type SplitEdge,
} from "./document-editor-state.js";

function descriptor(document: DocumentRecord): EditorDocument | null {
  if (document.document_type === "original" || !document.current_revision_number) return null;
  const path = typeof document.document_metadata.path === "string" ? document.document_metadata.path : document.title;
  return {
    id: document.id,
    title: document.title,
    path,
    mediaType: "",
    revision: document.current_revision_number,
    kind: document.document_type,
  };
}

function focusTab(editor: Element | null, tabId: string): void {
  window.requestAnimationFrame(() => {
    editor?.querySelector<HTMLElement>(`[data-tab-id="${tabId}"] [role="tab"]`)?.focus();
  });
}

function Group({
  group,
  documents,
  organizationId,
  workspaceId,
  dispatch,
  onDragStart,
  onDrop,
  onReveal,
  maximized,
}: {
  group: EditorGroup;
  documents: DocumentRecord[];
  organizationId: string;
  workspaceId: string;
  dispatch: Dispatch<Parameters<typeof editorReducer>[1]>;
  onDragStart(groupId: string, tabId: string): void;
  onDrop(groupId: string, edge: SplitEdge | undefined, documentId: string | null, copy: boolean, index?: number): void;
  onReveal(documentId: string): void;
  maximized: boolean;
}) {
  const active = group.tabs.find((tab) => tab.id === group.activeId) ?? null;
  const record = active ? documents.find((item) => item.id === active.document.id) : null;
  return (
    <section
      className="af-document-editor__group"
      data-group-id={group.id}
      aria-label="문서 편집기 그룹"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        onDrop(
          group.id,
          undefined,
          event.dataTransfer.getData("application/x-agent-factory-document") || null,
          event.ctrlKey || event.altKey,
        );
      }}
    >
      <header className="af-document-editor__group-header">
        <div role="tablist" aria-label="열린 문서" className="af-document-editor__tabs">
          {group.tabs.map((tab, index) => (
            <div
              className={`af-document-editor__tab${tab.pinned ? " is-pinned" : ""}${tab.preview ? " is-preview" : ""}`}
              key={tab.id}
              data-tab-id={tab.id}
              draggable
              onDragStart={() => onDragStart(group.id, tab.id)}
              onDragOver={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
              onDrop={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onDrop(
                  group.id,
                  undefined,
                  event.dataTransfer.getData("application/x-agent-factory-document") || null,
                  event.ctrlKey || event.altKey,
                  index,
                );
              }}
            >
              <button
                type="button"
                role="tab"
                aria-selected={tab.id === group.activeId}
                tabIndex={tab.id === group.activeId ? 0 : -1}
                title={tab.document.path}
                onClick={() => dispatch({ type: "activate", groupId: group.id, tabId: tab.id })}
                onDoubleClick={() => dispatch({ type: "pin", groupId: group.id, tabId: tab.id })}
                onKeyDown={(event) => {
                  const index = group.tabs.indexOf(tab);
                  const next =
                    event.key === "Home"
                      ? 0
                      : event.key === "End"
                        ? group.tabs.length - 1
                        : event.key === "ArrowLeft"
                          ? (index + group.tabs.length - 1) % group.tabs.length
                          : event.key === "ArrowRight"
                            ? (index + 1) % group.tabs.length
                            : -1;
                  if (next >= 0) {
                    event.preventDefault();
                    const tabId = group.tabs[next].id;
                    dispatch({ type: "activate", groupId: group.id, tabId });
                    focusTab(event.currentTarget.closest(".af-document-editor"), tabId);
                  }
                }}
              >
                {tab.document.title}
              </button>
              <button
                type="button"
                aria-label={tab.pinned ? `${tab.document.title} 고정 해제` : `${tab.document.title} 닫기`}
                onClick={() =>
                  dispatch(
                    tab.pinned
                      ? { type: "pin", groupId: group.id, tabId: tab.id }
                      : { type: "close", groupId: group.id, tabIds: [tab.id] },
                  )
                }
              >
                {tab.pinned ? "고정" : "×"}
              </button>
              <details className="af-document-editor__tab-menu">
                <summary aria-label={`${tab.document.title} 탭 메뉴`}>⋯</summary>
                <button type="button" onClick={() => dispatch({ type: "pin", groupId: group.id, tabId: tab.id })}>
                  {tab.pinned ? "고정 해제" : "탭 고정"}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    dispatch({
                      type: "close",
                      groupId: group.id,
                      tabIds: [tab.id],
                      includePinned: true,
                    })
                  }
                >
                  탭 닫기
                </button>
                <button
                  type="button"
                  onClick={() =>
                    dispatch({
                      type: "close",
                      groupId: group.id,
                      tabIds: group.tabs.filter((item) => item !== tab).map((item) => item.id),
                    })
                  }
                >
                  다른 탭 닫기
                </button>
                <button
                  type="button"
                  onClick={() =>
                    dispatch({
                      type: "close",
                      groupId: group.id,
                      tabIds: group.tabs.slice(group.tabs.indexOf(tab) + 1).map((item) => item.id),
                    })
                  }
                >
                  오른쪽 탭 닫기
                </button>
                <button
                  type="button"
                  onClick={() =>
                    dispatch({
                      type: "close",
                      groupId: group.id,
                      tabIds: group.tabs.map((item) => item.id),
                    })
                  }
                >
                  모든 탭 닫기
                </button>
                {(["left", "right", "top", "bottom"] as const).map((edge) => (
                  <button
                    type="button"
                    key={edge}
                    onClick={() => dispatch({ type: "split", groupId: group.id, tabId: tab.id, edge })}
                  >
                    {{ left: "왼쪽", right: "오른쪽", top: "위", bottom: "아래" }[edge]}로 분할
                  </button>
                ))}
                <button type="button" onClick={() => onReveal(tab.document.id)}>
                  탐색기에 표시
                </button>
              </details>
            </div>
          ))}
        </div>
        <details className="af-document-editor__group-menu">
          <summary aria-label="그룹 메뉴">그룹</summary>
          <button
            type="button"
            disabled={!group.activeId}
            onClick={() =>
              group.activeId && dispatch({ type: "split", groupId: group.id, tabId: group.activeId, edge: "bottom" })
            }
          >
            아래로 분할
          </button>
          <button
            type="button"
            onClick={() =>
              dispatch({
                type: "maximize",
                groupId: maximized ? null : group.id,
              })
            }
          >
            {maximized ? "그룹 복원" : "그룹 확대"}
          </button>
          <button type="button" onClick={() => dispatch({ type: "closeGroup", groupId: group.id })}>
            그룹 닫기
          </button>
          <button type="button" onClick={() => dispatch({ type: "closeEditor" })}>
            전체 에디터 닫기
          </button>
        </details>
      </header>
      <div className="af-document-editor__drop-edges" aria-hidden="true">
        {(["left", "right", "top", "bottom"] as const).map((edge) => (
          <span
            key={edge}
            data-edge={edge}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onDrop(
                group.id,
                edge,
                event.dataTransfer.getData("application/x-agent-factory-document") || null,
                event.ctrlKey || event.altKey,
              );
            }}
          />
        ))}
      </div>
      <div className="af-document-editor__body">
        {record && active ? (
          <DocumentViewer
            document={record}
            organizationId={organizationId}
            workspaceId={workspaceId}
            revision={active.document.revision}
          />
        ) : (
          <p>탐색기에서 문서를 열거나 여기에 끌어 놓으세요.</p>
        )}
      </div>
    </section>
  );
}

export function DocumentEditor({
  documents,
  openRequest,
  organizationId,
  workspaceId,
  onReveal = () => undefined,
}: {
  documents: DocumentRecord[];
  openRequest: { id: string; preview: boolean; edge?: SplitEdge; serial: number } | null;
  organizationId: string;
  workspaceId: string;
  onReveal?(documentId: string): void;
}) {
  const [state, dispatch] = useReducer(editorReducer, undefined, initialEditorState);
  const drag = useRef<{ groupId: string; tabId: string } | null>(null);
  const resizeDrag = useRef<{ pointerId: number; path: string } | null>(null);
  const scope = `${organizationId}:${workspaceId}`;
  const previousScope = useRef(scope);

  useEffect(() => {
    if (previousScope.current === scope) return;
    previousScope.current = scope;
    drag.current = null;
    resizeDrag.current = null;
    dispatch({ type: "reset" });
  }, [scope]);

  useEffect(() => {
    const document = documents.find((item) => item.id === openRequest?.id);
    const value = document ? descriptor(document) : null;
    if (value)
      dispatch({
        type: "open",
        document: value,
        preview: openRequest?.preview ?? true,
        edge: openRequest?.edge,
      });
  }, [documents, openRequest, organizationId, workspaceId]);

  const renderLayout = (layout: EditorLayout, path = ""): ReactNode => {
    if ("groupId" in layout) {
      const group = state.groups[layout.groupId];
      if (state.maximizedGroupId && state.maximizedGroupId !== group.id) return null;
      return (
        <Group
          key={group.id}
          group={group}
          documents={documents}
          organizationId={organizationId}
          workspaceId={workspaceId}
          dispatch={dispatch}
          onDragStart={(groupId, tabId) => {
            drag.current = { groupId, tabId };
          }}
          onDrop={(groupId, edge, documentId, copy, index) => {
            if (drag.current) {
              dispatch({
                type: "move",
                sourceGroupId: drag.current.groupId,
                tabId: drag.current.tabId,
                targetGroupId: groupId,
                index: index ?? state.groups[groupId].tabs.length,
                copy,
                edge,
              });
            } else if (documentId) {
              const record = documents.find((item) => item.id === documentId);
              const value = record ? descriptor(record) : null;
              if (value) dispatch({ type: "open", document: value, groupId, preview: false, edge });
            }
            drag.current = null;
          }}
          onReveal={onReveal}
          maximized={state.maximizedGroupId === group.id}
        />
      );
    }
    return (
      <div className={`af-document-editor__split is-${layout.axis}`} key={path}>
        <div style={{ flexBasis: `${layout.ratio * 100}%` }}>{renderLayout(layout.first, `${path}0`)}</div>
        <div
          role="separator"
          tabIndex={0}
          aria-label="문서 분할 크기 조절"
          aria-valuemin={10}
          aria-valuemax={90}
          aria-valuenow={Math.round(layout.ratio * 100)}
          onPointerDown={(event) => {
            resizeDrag.current = { pointerId: event.pointerId, path };
            event.currentTarget.setPointerCapture?.(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (resizeDrag.current?.pointerId !== event.pointerId || resizeDrag.current.path !== path) return;
            const bounds = event.currentTarget.parentElement?.getBoundingClientRect();
            if (!bounds) return;
            const ratio =
              layout.axis === "horizontal"
                ? (event.clientX - bounds.left) / bounds.width
                : (event.clientY - bounds.top) / bounds.height;
            dispatch({ type: "resize", path, ratio });
          }}
          onPointerUp={(event) => {
            resizeDrag.current = null;
            event.currentTarget.releasePointerCapture?.(event.pointerId);
          }}
          onPointerCancel={() => {
            resizeDrag.current = null;
          }}
          onDoubleClick={() => dispatch({ type: "resize", path, ratio: 0.5 })}
          onKeyDown={(event) => {
            if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
            event.preventDefault();
            const decrease = event.key === "ArrowLeft" || event.key === "ArrowUp";
            dispatch({ type: "resize", path, ratio: layout.ratio + (decrease ? -0.05 : 0.05) });
          }}
        />
        <div style={{ flexBasis: `${(1 - layout.ratio) * 100}%` }}>{renderLayout(layout.second, `${path}1`)}</div>
      </div>
    );
  };

  return (
    <div
      className="af-document-editor"
      onKeyDown={(event) => {
        const group = state.groups[state.activeGroupId];
        if (event.key === "F6") {
          event.preventDefault();
          const ids = Object.keys(state.groups);
          const offset = event.shiftKey ? ids.length - 1 : 1;
          const next = ids[(ids.indexOf(group.id) + offset) % ids.length];
          const tabId = state.groups[next].activeId;
          if (tabId) {
            dispatch({ type: "activate", groupId: next, tabId });
            focusTab(event.currentTarget, tabId);
          }
        }
        if (!(event.ctrlKey || event.metaKey)) return;
        if (event.key === "\\" && group.activeId) {
          event.preventDefault();
          dispatch({
            type: "split",
            groupId: group.id,
            tabId: group.activeId,
            edge: event.shiftKey ? "bottom" : "right",
          });
        } else if (event.key.toLowerCase() === "w") {
          event.preventDefault();
          dispatch({
            type: "close",
            groupId: group.id,
            tabIds: event.shiftKey
              ? group.tabs.filter((tab) => !tab.pinned).map((tab) => tab.id)
              : group.activeId
                ? [group.activeId]
                : [],
          });
        } else if (event.key === "Tab" && group.tabs.length) {
          event.preventDefault();
          const index = group.tabs.findIndex((tab) => tab.id === group.activeId);
          const offset = event.shiftKey ? group.tabs.length - 1 : 1;
          dispatch({
            type: "activate",
            groupId: group.id,
            tabId: group.tabs[(index + offset) % group.tabs.length].id,
          });
          focusTab(event.currentTarget, group.tabs[(index + offset) % group.tabs.length].id);
        }
      }}
    >
      {state.maximizedGroupId && (
        <button type="button" onClick={() => dispatch({ type: "maximize", groupId: null })}>
          그룹 복원
        </button>
      )}
      {renderLayout(state.layout)}
    </div>
  );
}
