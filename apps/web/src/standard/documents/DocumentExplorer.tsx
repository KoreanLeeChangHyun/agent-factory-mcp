import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { DocumentRecord } from "./document-client.js";
import { selectKeys } from "./document-editor-selection.js";

interface ExplorerNode {
  id: string;
  label: string;
  documentId?: string;
  children: ExplorerNode[];
}

type ExplorerKind = "processed" | "specification";
type ExplorerSurface = "explorer" | "original-table" | `overview:${DocumentRecord["document_type"]}`;

function safeParts(document: DocumentRecord): string[] {
  const value = typeof document.document_metadata.path === "string" ? document.document_metadata.path : document.title;
  const parts = value.split("/");
  return parts.length <= 32 &&
    parts.every(
      (part) =>
        part &&
        part !== "." &&
        part !== ".." &&
        !part.includes("\\") &&
        !Array.from(part).some((character) => character.charCodeAt(0) < 32),
    )
    ? parts
    : [document.title];
}

function tree(documents: DocumentRecord[], query: string, kind: ExplorerKind): ExplorerNode[] {
  const root: ExplorerNode = { id: "root", label: "root", children: [] };
  for (const document of documents) {
    const parts = safeParts(document);
    if (query && !parts.join("/").toLocaleLowerCase().includes(query.toLocaleLowerCase())) continue;
    let parent = root;
    parts.slice(0, -1).forEach((label, index) => {
      const id = `folder:${kind}:${parts.slice(0, index + 1).join("/")}`;
      let folder = parent.children.find((item) => item.id === id);
      if (!folder) {
        folder = { id, label, children: [] };
        parent.children.push(folder);
      }
      parent = folder;
    });
    parent.children.push({
      id: document.id,
      documentId: document.id,
      label: parts.at(-1) ?? document.title,
      children: [],
    });
  }
  const sort = (nodes: ExplorerNode[]) => {
    nodes.sort(
      (left, right) =>
        Number(Boolean(left.documentId)) - Number(Boolean(right.documentId)) || left.label.localeCompare(right.label),
    );
    nodes.forEach((node) => sort(node.children));
  };
  sort(root.children);
  return root.children;
}

export function DocumentExplorer({
  documents,
  onOpen,
  storageKey,
  revealRequest,
}: {
  documents: DocumentRecord[];
  onOpen(id: string, preview: boolean, edge?: "right" | "bottom"): void;
  storageKey: string;
  revealRequest?: { id: string; serial: number } | null;
}) {
  const saved = useMemo<{
    query?: string;
    queries?: Partial<Record<ExplorerKind, string>>;
    collapsed?: string[];
    selected?: string[];
    anchor?: string;
  }>(() => {
    try {
      if (typeof localStorage === "undefined") return {};
      return JSON.parse(localStorage.getItem(storageKey) ?? "{}") as {
        query?: string;
        queries?: Partial<Record<ExplorerKind, string>>;
        collapsed?: string[];
        selected?: string[];
        anchor?: string;
      };
    } catch {
      return {};
    }
  }, [storageKey]);
  const [queries, setQueries] = useState<Record<ExplorerKind, string>>({
    processed: saved.queries?.processed?.slice(0, 200) ?? saved.query?.slice(0, 200) ?? "",
    specification: saved.queries?.specification?.slice(0, 200) ?? "",
  });
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set(saved.collapsed ?? []));
  const [selected, setSelected] = useState<Set<string>>(new Set(saved.selected ?? []));
  const [anchor, setAnchor] = useState<string | null>(saved.anchor ?? null);
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [surface, setSurface] = useState<ExplorerSurface>("explorer");
  const [originalQuery, setOriginalQuery] = useState("");
  const [originalStatus, setOriginalStatus] = useState("all");
  const rootRef = useRef<HTMLDivElement>(null);
  const originalDocuments = documents.filter((item) => item.document_type === "original");
  const processedNodes = useMemo(
    () =>
      tree(
        documents.filter((item) => item.document_type === "processed"),
        queries.processed,
        "processed",
      ),
    [documents, queries.processed],
  );
  const specificationNodes = useMemo(
    () =>
      tree(
        documents.filter((item) => item.document_type === "specification"),
        queries.specification,
        "specification",
      ),
    [documents, queries.specification],
  );
  const filteredOriginals = originalDocuments.filter((item) => {
    const matchesQuery = [item.title, safeParts(item).join("/"), item.slug].some((value) =>
      value.toLocaleLowerCase().includes(originalQuery.toLocaleLowerCase()),
    );
    return matchesQuery && (originalStatus === "all" || item.status === originalStatus);
  });

  useEffect(() => {
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({ queries, collapsed: [...collapsed], selected: [...selected], anchor }),
      );
    } catch {
      /* Explorer restoration is best effort and stores no document content. */
    }
  }, [anchor, collapsed, queries, selected, storageKey]);

  useEffect(() => {
    if (!revealRequest) return;
    const record = documents.find((item) => item.id === revealRequest.id);
    if (!record || record.document_type === "original") return;
    const kind = record.document_type;
    const parts = safeParts(record);
    setQueries((current) => ({ ...current, [kind]: "" }));
    setSurface("explorer");
    setSelected(new Set([record.id]));
    setAnchor(record.id);
    setCollapsed((current) => {
      const next = new Set(current);
      parts.slice(0, -1).forEach((_, index) => {
        next.delete(`folder:${kind}:${parts.slice(0, index + 1).join("/")}`);
      });
      return next;
    });
    window.requestAnimationFrame(() => {
      rootRef.current?.querySelector<HTMLElement>(`[data-document-id="${revealRequest.id}"]`)?.focus();
    });
  }, [documents, revealRequest]);

  const render = (items: ExplorerNode[], level: number, visibleIds: string[], query: string): ReactNode =>
    items.map((item) => {
      const folder = !item.documentId;
      const expanded = query.length > 0 || !collapsed.has(item.id);
      if (!folder) visibleIds.push(item.id);
      return (
        <li key={item.id} role="none">
          <div
            role="treeitem"
            data-document-id={item.documentId}
            aria-level={level}
            aria-expanded={folder ? expanded : undefined}
            aria-selected={!folder ? selected.has(item.id) : undefined}
            tabIndex={0}
            draggable={!folder}
            style={{ paddingInlineStart: `${(level - 1) * 12}px` }}
            onClick={(event) => {
              if (folder) {
                setCollapsed((current) => {
                  const next = new Set(current);
                  if (next.has(item.id)) next.delete(item.id);
                  else next.add(item.id);
                  return next;
                });
                return;
              }
              const next = selectKeys({
                keys: visibleIds,
                selected,
                anchor,
                key: item.id,
                range: event.shiftKey,
                toggle: event.ctrlKey || event.metaKey,
              });
              setSelected(next.selected);
              setAnchor(next.anchor);
              onOpen(item.id, event.detail < 2);
            }}
            onDoubleClick={() => item.documentId && onOpen(item.documentId, false)}
            onKeyDown={(event) => {
              const rows = Array.from(
                event.currentTarget.closest('[role="tree"]')?.querySelectorAll<HTMLElement>('[role="treeitem"]') ?? [],
              );
              const index = rows.indexOf(event.currentTarget);
              const target =
                event.key === "Home"
                  ? rows[0]
                  : event.key === "End"
                    ? rows.at(-1)
                    : event.key === "ArrowDown"
                      ? rows[index + 1]
                      : event.key === "ArrowUp"
                        ? rows[index - 1]
                        : null;
              if (target) {
                event.preventDefault();
                target.focus();
                return;
              }
              if (folder && ["Enter", "ArrowLeft", "ArrowRight"].includes(event.key)) {
                event.preventDefault();
                setCollapsed((current) => {
                  const next = new Set(current);
                  if (event.key === "ArrowRight") next.delete(item.id);
                  else if (event.key === "ArrowLeft") next.add(item.id);
                  else if (next.has(item.id)) next.delete(item.id);
                  else next.add(item.id);
                  return next;
                });
              } else if (item.documentId && event.key === "Enter") {
                event.preventDefault();
                onOpen(item.documentId, false, event.ctrlKey || event.metaKey ? "right" : undefined);
              } else if (item.documentId && event.key === " ") {
                event.preventDefault();
                const next = selectKeys({ keys: visibleIds, selected, anchor, key: item.id, toggle: true });
                setSelected(next.selected);
                setAnchor(next.anchor);
              } else if (item.documentId && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "a") {
                event.preventDefault();
                setSelected(new Set(visibleIds));
              } else if (item.documentId && event.key === "F10" && event.shiftKey) {
                event.preventDefault();
                setMenu({ id: item.documentId, x: 0, y: 0 });
              }
            }}
            onContextMenu={(event) => {
              event.preventDefault();
              if (item.documentId) setMenu({ id: item.documentId, x: event.clientX, y: event.clientY });
            }}
            onDragStart={(event) => {
              if (!item.documentId) return;
              event.dataTransfer.setData("application/x-agent-factory-document", item.documentId);
              event.dataTransfer.effectAllowed = "copy";
            }}
          >
            {folder ? (expanded ? "▾" : "▸") : "·"} {item.label}
          </div>
          {folder && expanded && item.children.length > 0 && (
            <ul role="group">{render(item.children, level + 1, visibleIds, query)}</ul>
          )}
        </li>
      );
    });

  const collapseAll = (kind: ExplorerKind) => {
    const folders = new Set(collapsed);
    const nodes = tree(
      documents.filter((item) => item.document_type === kind),
      "",
      kind,
    );
    const collect = (items: ExplorerNode[]) =>
      items.forEach((item) => {
        if (!item.documentId) folders.add(item.id);
        collect(item.children);
      });
    collect(nodes);
    setQueries((current) => ({ ...current, [kind]: "" }));
    setCollapsed(folders);
  };

  const sectionHeader = (kind: ExplorerKind, label: string) => {
    const expanded = !collapsed.has(`section:${kind}`) || Boolean(queries[kind]);
    return (
      <header className="af-document-explorer__header">
        <button
          type="button"
          className="af-document-explorer__title"
          aria-expanded={expanded}
          onClick={() =>
            setCollapsed((current) => {
              const next = new Set(current);
              if (next.has(`section:${kind}`)) next.delete(`section:${kind}`);
              else next.add(`section:${kind}`);
              return next;
            })
          }
        >
          <span aria-hidden="true">{expanded ? "▾" : "▸"}</span> {label}
        </button>
        <input
          type="search"
          aria-label={`${label} 검색`}
          placeholder="검색"
          value={queries[kind]}
          onChange={(event) => setQueries((current) => ({ ...current, [kind]: event.target.value }))}
        />
        <button type="button" onClick={() => collapseAll(kind)}>
          모두 접기
        </button>
        <button
          type="button"
          aria-label={`${label} 개요`}
          title={`${label} 개요`}
          onClick={() => setSurface(`overview:${kind}`)}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M2 13V8h3v5H2Zm4.5 0V3h3v10h-3Zm4.5 0V6h3v7h-3Z" />
          </svg>
        </button>
      </header>
    );
  };

  const overviewKind = surface.startsWith("overview:") ? (surface.slice(9) as DocumentRecord["document_type"]) : null;
  const overviewDocuments = overviewKind ? documents.filter((item) => item.document_type === overviewKind) : [];

  return (
    <div className="af-document-explorer" ref={rootRef}>
      {surface === "explorer" ? (
        <>
          <header className="af-document-explorer__header">
            <strong className="af-document-explorer__title">원본 문서</strong>
            <span />
            <button
              type="button"
              aria-label="원본 문서 메타데이터 표"
              title="원본 문서 메타데이터 표"
              onClick={() => setSurface("original-table")}
            >
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="M2 2h12v12H2V2Zm1.5 3h9V3.5h-9V5Zm0 3.5h2V6.5h-2v2Zm3.5 0h5.5V6.5H7v2ZM3.5 12.5h2V10h-2v2.5Zm3.5 0h5.5V10H7v2.5Z" />
              </svg>
            </button>
            <button
              type="button"
              aria-label="원본 문서 개요"
              title="원본 문서 개요"
              onClick={() => setSurface("overview:original")}
            >
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="M2 13V8h3v5H2Zm4.5 0V3h3v10h-3Zm4.5 0V6h3v7h-3Z" />
              </svg>
            </button>
          </header>
          {sectionHeader("processed", "가공 문서")}
          {(!collapsed.has("section:processed") || queries.processed) && (
            <>
              <ul role="tree" aria-label="가공 문서 탐색기" aria-multiselectable="true">
                {render(processedNodes, 1, [], queries.processed)}
              </ul>
              {!processedNodes.length && <p role="status">일치하는 가공 문서가 없습니다.</p>}
            </>
          )}
          {sectionHeader("specification", "명세 문서")}
          {(!collapsed.has("section:specification") || queries.specification) && (
            <>
              <ul role="tree" aria-label="명세 문서 탐색기" aria-multiselectable="true">
                {render(specificationNodes, 1, [], queries.specification)}
              </ul>
              {!specificationNodes.length && <p role="status">일치하는 명세 문서가 없습니다.</p>}
            </>
          )}
        </>
      ) : (
        <section className="af-document-explorer__surface" aria-live="polite">
          <header>
            <button type="button" onClick={() => setSurface("explorer")}>
              탐색기로 돌아가기
            </button>
            <h2>{surface === "original-table" ? "원본 문서 메타데이터" : "문서 개요"}</h2>
          </header>
          {surface === "original-table" ? (
            <>
              <div className="af-document-explorer__filters">
                <label>
                  표 검색
                  <input
                    type="search"
                    value={originalQuery}
                    onChange={(event) => setOriginalQuery(event.target.value)}
                  />
                </label>
                <label>
                  상태 필터
                  <select value={originalStatus} onChange={(event) => setOriginalStatus(event.target.value)}>
                    <option value="all">모든 상태</option>
                    {[...new Set(originalDocuments.map((item) => item.status))].map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <table>
                <thead>
                  <tr>
                    <th scope="col">제목</th>
                    <th scope="col">경로</th>
                    <th scope="col">상태</th>
                    <th scope="col">Revision</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOriginals.map((document) => (
                    <tr key={document.id}>
                      <th scope="row">
                        <button
                          type="button"
                          disabled={!document.current_revision_number}
                          onClick={() => onOpen(document.id, true)}
                        >
                          {document.title}
                        </button>
                      </th>
                      <td>{safeParts(document).join("/")}</td>
                      <td>{document.status}</td>
                      <td>{document.current_revision_number ?? "내용 없음"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!filteredOriginals.length && <p role="status">조건에 맞는 원본 문서가 없습니다.</p>}
            </>
          ) : (
            <div
              role="region"
              aria-label={`${overviewKind === "original" ? "원본" : overviewKind === "processed" ? "가공" : "명세"} 문서 개요`}
            >
              <p>
                전체 문서 <strong>{overviewDocuments.length}</strong>
              </p>
              <p>
                내용 있음 <strong>{overviewDocuments.filter((item) => item.current_revision_number).length}</strong>
              </p>
              <p>
                내용 없음 <strong>{overviewDocuments.filter((item) => !item.current_revision_number).length}</strong>
              </p>
            </div>
          )}
        </section>
      )}
      {menu && (
        <div
          role="menu"
          className="af-document-explorer__menu"
          style={{ left: menu.x, top: menu.y }}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setMenu(null);
          }}
        >
          <button
            type="button"
            role="menuitem"
            autoFocus
            onClick={() => {
              onOpen(menu.id, false);
              setMenu(null);
            }}
          >
            열기
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onOpen(menu.id, false, "right");
              setMenu(null);
            }}
          >
            오른쪽에 열기
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onOpen(menu.id, false, "bottom");
              setMenu(null);
            }}
          >
            아래에 열기
          </button>
        </div>
      )}
    </div>
  );
}
