import { useEffect, useRef, useState } from "react";
import { Button, WorkbenchPanel, WorkbenchSidebar, type NavItem } from "@agent-factory/design-system";
import { ApiError } from "../../api-client.js";
import { apiPath } from "../../api-path.js";
import { DocumentEditor } from "./DocumentEditor.js";
import { DocumentExplorer } from "./DocumentExplorer.js";
import {
  documentClient,
  type DocumentProvenance,
  type DocumentRecord,
  type DocumentRevision,
  type DocumentSearchHit,
  type DocumentType,
  type SearchProfile,
} from "./document-client.js";
import "./documents.css";

type LoadState = "loading" | "ready" | "empty" | "permission" | "error";
interface NavigationState {
  selectedId: string | null;
  expanded: string[];
}
const typeLabel: Record<DocumentType, string> = { original: "원본", processed: "가공", specification: "명세" };

function documentItems(documents: DocumentRecord[]): NavItem[] {
  const roots: NavItem[] = [];
  const folders = new Map<string, NavItem>();
  for (const document of documents) {
    const rawPath =
      typeof document.document_metadata.path === "string" ? document.document_metadata.path : document.title;
    const parts = rawPath.split("/").filter(Boolean);
    let children = roots;
    let prefix = "";
    for (const folder of parts.slice(0, -1)) {
      prefix = prefix ? `${prefix}/${folder}` : folder;
      let item = folders.get(prefix);
      if (!item) {
        item = { id: `folder:${prefix}`, label: folder, children: [] };
        folders.set(prefix, item);
        children.push(item);
      }
      children = item.children!;
    }
    children.push({ id: document.id, label: parts.at(-1) || document.title, meta: typeLabel[document.document_type] });
  }
  return roots;
}

function folderIds(items: NavItem[]): Set<string> {
  const ids = new Set<string>();
  const visit = (rows: NavItem[]) => {
    for (const row of rows) {
      if (!row.children) continue;
      ids.add(row.id);
      visit(row.children);
    }
  };
  visit(items);
  return ids;
}

function Preview({ blob, mediaType, previewUrl }: { blob: Blob | null; mediaType: string; previewUrl: string | null }) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [text, setText] = useState("");
  useEffect(() => {
    let active = true;
    setObjectUrl(null);
    setText("");
    if (!blob) return;
    if (mediaType.startsWith("text/") || mediaType === "application/json") {
      void blob.text().then((value) => {
        if (mediaType === "application/json") {
          try {
            if (active) setText(JSON.stringify(JSON.parse(value), null, 2));
          } catch {
            if (active) setText(value);
          }
        } else if (active) setText(value);
      });
      return () => {
        active = false;
      };
    }
    const next = URL.createObjectURL(blob);
    setObjectUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [blob, mediaType]);
  if (previewUrl)
    return (
      <iframe
        className="af-document-package-preview"
        title="격리된 문서 패키지 미리보기"
        sandbox="allow-scripts"
        src={apiPath(previewUrl)}
      />
    );
  if (!blob) return <p className="af-document-muted">표시할 revision 내용이 없습니다.</p>;
  if (mediaType.startsWith("text/") || mediaType === "application/json")
    return <pre className="af-document-text">{text}</pre>;
  if (mediaType.startsWith("image/") && objectUrl)
    return <img className="af-document-image" src={objectUrl} alt="선택한 문서 미리보기" />;
  return objectUrl ? (
    <a href={objectUrl} download>
      이 형식은 안전한 다운로드로 엽니다.
    </a>
  ) : (
    <p>미리보기를 준비하는 중입니다.</p>
  );
}

export function DocumentsWorkbench({
  userId,
  organizationId,
  workspaceId,
  workbenchId = "documents",
  releaseId = "standard:documents@1",
  permissions,
}: {
  userId: string;
  organizationId: string;
  workspaceId: string;
  workbenchId?: string;
  releaseId?: string;
  permissions: string[];
}) {
  const [phase, setPhase] = useState<LoadState>("loading");
  const [loadedNavigationKey, setLoadedNavigationKey] = useState<string | null>(null);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<DocumentRecord | null>(null);
  const [revisions, setRevisions] = useState<DocumentRevision[]>([]);
  const [selectedRevision, setSelectedRevision] = useState<number | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [mediaType, setMediaType] = useState("");
  const [expanded, setExpanded] = useState<string[]>([]);
  const [titleDraft, setTitleDraft] = useState("");
  const [contentDraft, setContentDraft] = useState("");
  const [message, setMessage] = useState("");
  const [provenance, setProvenance] = useState<DocumentProvenance[]>([]);
  const [profiles, setProfiles] = useState<SearchProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchHits, setSearchHits] = useState<DocumentSearchHit[]>([]);
  const [busy, setBusy] = useState(false);
  const [editorOpen, setEditorOpen] = useState<{
    id: string;
    preview: boolean;
    edge?: "right" | "bottom";
    serial: number;
  } | null>(null);
  const [editorReveal, setEditorReveal] = useState<{ id: string; serial: number } | null>(null);
  const generation = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const canCreate = permissions.includes("document.create");
  const canUpdate = permissions.includes("document.update");
  const canExport = permissions.includes("document.export");
  const navigationKey = `agent-factory:documents:v3:${userId}:${organizationId}:${workspaceId}:${workbenchId}:${releaseId}`;
  const readNavigation = (): NavigationState => {
    try {
      const value = JSON.parse(localStorage.getItem(navigationKey) ?? "null") as Partial<NavigationState> | null;
      return {
        selectedId: typeof value?.selectedId === "string" ? value.selectedId : null,
        expanded: Array.isArray(value?.expanded)
          ? value.expanded.filter((id): id is string => typeof id === "string" && id.startsWith("folder:"))
          : [],
      };
    } catch {
      return { selectedId: null, expanded: [] };
    }
  };

  const loadList = async (preferred?: string) => {
    const current = ++generation.current;
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    setLoadedNavigationKey(null);
    setPhase("loading");
    try {
      const rows = await documentClient.list(organizationId, workspaceId, request.signal);
      if (current !== generation.current) return;
      setLoadedNavigationKey(navigationKey);
      setDocuments(rows);
      setPhase(rows.length ? "ready" : "empty");
      const restored = readNavigation();
      const currentFolderIds = folderIds(documentItems(rows));
      const requested = new URLSearchParams(window.location.search).get("document");
      setExpanded(restored.expanded.filter((id) => currentFolderIds.has(id)));
      setSelectedId(
        preferred ??
          (rows.some((row) => row.id === requested)
            ? requested
            : rows.some((row) => row.id === restored.selectedId)
              ? restored.selectedId
              : (rows[0]?.id ?? null)),
      );
    } catch (error) {
      if (request.signal.aborted || current !== generation.current) return;
      setPhase(error instanceof ApiError && error.status === 403 ? "permission" : "error");
      setMessage(error instanceof Error ? error.message : "문서 목록을 불러오지 못했습니다.");
    }
  };
  useEffect(() => {
    setLoadedNavigationKey(null);
    setEditorOpen(null);
    setEditorReveal(null);
    void loadList();
    return () => {
      generation.current += 1;
      controller.current?.abort();
    };
  }, [navigationKey, organizationId, userId, workspaceId]);
  useEffect(() => {
    const request = new AbortController();
    void documentClient
      .searchProfiles(organizationId, workspaceId, request.signal)
      .then(setProfiles)
      .catch(() => setProfiles([]));
    return () => request.abort();
  }, [organizationId, workspaceId]);
  useEffect(() => {
    setSelected(null);
    setRevisions([]);
    setProvenance([]);
    setBlob(null);
    if (!selectedId || selectedId.startsWith("folder:")) return;
    try {
      localStorage.setItem(navigationKey, JSON.stringify({ selectedId, expanded }));
      const url = new URL(window.location.href);
      url.searchParams.set("document", selectedId);
      history.replaceState(history.state, "", url);
    } catch {
      /* Navigation restoration is best effort and contains no document content. */
    }
    const current = ++generation.current;
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    void Promise.all([
      documentClient.get(organizationId, workspaceId, selectedId, request.signal),
      documentClient.revisions(organizationId, workspaceId, selectedId, request.signal),
      documentClient.provenance(organizationId, workspaceId, selectedId, request.signal),
    ])
      .then(([record, history, lineage]) => {
        if (current !== generation.current) return;
        setSelected(record);
        setTitleDraft(record.title);
        setRevisions(history);
        setProvenance(lineage);
        setSelectedRevision(record.current_revision_number || history[0]?.revision_number || null);
      })
      .catch((error: unknown) => {
        if (!request.signal.aborted && current === generation.current)
          setMessage(error instanceof Error ? error.message : "문서를 열지 못했습니다.");
      });
  }, [navigationKey, organizationId, selectedId, workspaceId]);
  useEffect(() => {
    if (!selectedId) return;
    try {
      localStorage.setItem(navigationKey, JSON.stringify({ selectedId, expanded }));
    } catch {
      /* Navigation restoration is best effort. */
    }
  }, [expanded, navigationKey, selectedId]);
  useEffect(() => {
    setBlob(null);
    if (!selected || selected.document_type !== "original" || !selectedRevision || !canExport) return;
    const current = generation.current;
    const request = new AbortController();
    void documentClient
      .content(organizationId, workspaceId, selected.id, selectedRevision, request.signal)
      .then((result) => {
        if (current === generation.current) {
          setBlob(result.blob);
          setMediaType(result.mediaType);
        }
      })
      .catch((error: unknown) => {
        if (!request.signal.aborted) setMessage(error instanceof Error ? error.message : "revision을 읽지 못했습니다.");
      });
    return () => request.abort();
  }, [canExport, organizationId, selected, selectedRevision, workspaceId]);

  const createDocument = async () => {
    if (busy) return;
    setBusy(true);
    const request = new AbortController();
    controller.current?.abort();
    controller.current = request;
    const suffix = crypto.randomUUID().slice(0, 8);
    try {
      const created = await documentClient.create(
        organizationId,
        workspaceId,
        {
          title: "새 원본 문서",
          slug: `document-${suffix}`,
          document_type: "original",
          metadata: { path: `새 문서-${suffix}.md` },
        },
        request.signal,
      );
      if (request.signal.aborted) return;
      setBusy(false);
      await loadList(created.id);
      setMessage("원본 문서를 만들었습니다.");
    } catch (error) {
      if (!request.signal.aborted) setMessage(error instanceof Error ? error.message : "문서를 만들지 못했습니다.");
    } finally {
      if (!request.signal.aborted) setBusy(false);
    }
  };
  const saveTitle = async () => {
    if (busy || !selected || titleDraft.trim() === selected.title) return;
    setBusy(true);
    const request = new AbortController();
    controller.current?.abort();
    controller.current = request;
    try {
      const updated = await documentClient.update(
        organizationId,
        workspaceId,
        selected,
        titleDraft.trim(),
        request.signal,
      );
      if (request.signal.aborted) return;
      setSelected(updated);
      setDocuments((rows) => rows.map((row) => (row.id === updated.id ? updated : row)));
      setMessage("문서 정보를 저장했습니다.");
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        const current = await documentClient.get(organizationId, workspaceId, selected.id, request.signal);
        if (request.signal.aborted) return;
        setSelected(current);
        setDocuments((rows) => rows.map((row) => (row.id === current.id ? current : row)));
        setMessage("다른 변경과 충돌했습니다. 서버 revision을 다시 불러왔으며 입력한 제목은 유지했습니다.");
      } else if (!request.signal.aborted) setMessage(error instanceof Error ? error.message : "저장하지 못했습니다.");
    } finally {
      if (!request.signal.aborted) setBusy(false);
    }
  };
  const addRevision = async () => {
    if (busy || !selected || selected.document_type !== "original" || !contentDraft) return;
    setBusy(true);
    const request = new AbortController();
    controller.current?.abort();
    controller.current = request;
    try {
      const revision = await documentClient.addTextRevision(
        organizationId,
        workspaceId,
        selected.id,
        `${selected.slug}.md`,
        "text/markdown",
        contentDraft,
        request.signal,
      );
      const current = await documentClient.get(organizationId, workspaceId, selected.id, request.signal);
      if (request.signal.aborted) return;
      setSelected(current);
      setRevisions((rows) => [revision, ...rows]);
      setSelectedRevision(revision.revision_number);
      setContentDraft("");
      setMessage(`revision ${revision.revision_number}을 저장했습니다.`);
    } catch (error) {
      if (!request.signal.aborted)
        setMessage(error instanceof Error ? error.message : "revision을 저장하지 못했습니다. 편집 내용은 유지됩니다.");
    } finally {
      if (!request.signal.aborted) setBusy(false);
    }
  };
  const searchDocuments = async () => {
    if (!searchQuery.trim() || !profiles[0] || busy) return;
    setBusy(true);
    const request = new AbortController();
    controller.current?.abort();
    controller.current = request;
    try {
      setSearchHits(
        await documentClient.search(organizationId, workspaceId, profiles[0].id, searchQuery.trim(), request.signal),
      );
    } catch (error) {
      if (!request.signal.aborted) setMessage(error instanceof Error ? error.message : "문서를 검색하지 못했습니다.");
    } finally {
      if (!request.signal.aborted) setBusy(false);
    }
  };
  const previewUrl =
    selected?.document_type === "specification" && mediaType === "application/zip" && selectedRevision
      ? documentClient.packagePreview(organizationId, workspaceId, selected.id, selectedRevision)
      : null;
  return (
    <>
      <WorkbenchSidebar>
        {phase === "ready" || phase === "empty" ? (
          <>
            <DocumentExplorer
              documents={documents}
              storageKey={`${navigationKey}:explorer`}
              revealRequest={editorReveal}
              onOpen={(id, preview, edge) => {
                setSelectedId(id);
                setEditorOpen((current) => ({ id, preview, edge, serial: (current?.serial ?? 0) + 1 }));
              }}
            />
            {canCreate && !busy && <Button onClick={() => void createDocument()}>새 원본 문서</Button>}
          </>
        ) : (
          <div className="af-sidebar-host">
            <header className="af-sidebar-header">
              <strong>문서</strong>
            </header>
            <div className="af-sidebar-body">
              {phase === "loading" && <p role="status">문서를 불러오는 중입니다.</p>}
              {phase === "permission" && <p role="alert">문서 읽기 권한이 없습니다.</p>}
              {phase === "error" && <p role="alert">{message}</p>}
            </div>
          </div>
        )}
      </WorkbenchSidebar>
      <WorkbenchPanel>
        <div
          className={`af-document-panel${
            canExport && selected && selected.document_type !== "original" ? " has-editor" : ""
          }`}
        >
          {!selected ? (
            <p className="af-document-empty">문서를 선택해 주세요.</p>
          ) : (
            <>
              <header className="af-document-header">
                <div>
                  <span>{typeLabel[selected.document_type]}</span>
                  <h1>{selected.title}</h1>
                </div>
                <label>
                  revision
                  <select
                    value={selectedRevision ?? ""}
                    onChange={(event) => setSelectedRevision(Number(event.target.value))}
                  >
                    {revisions.map((revision) => (
                      <option key={revision.id} value={revision.revision_number}>
                        {revision.revision_number} · {revision.filename}
                      </option>
                    ))}
                  </select>
                </label>
              </header>
              <div className="af-document-body">
                {message && <p role="status">{message}</p>}
                <section className="af-document-edit" aria-labelledby="document-search-title">
                  <label id="document-search-title">
                    문서 검색
                    <input
                      type="search"
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") void searchDocuments();
                      }}
                      disabled={!profiles.length || busy}
                    />
                  </label>
                  <Button
                    busy={busy}
                    onClick={() => void searchDocuments()}
                    disabled={!profiles.length || !searchQuery.trim()}
                  >
                    검색
                  </Button>
                  {!profiles.length && <p className="af-document-muted">사용 가능한 임베딩 프로필이 없습니다.</p>}
                  {!!searchHits.length && (
                    <ol aria-label="문서 검색 결과">
                      {searchHits.map((hit) => (
                        <li key={hit.chunk_id}>
                          <button type="button" onClick={() => setSelectedId(hit.document_id)}>
                            {hit.content.slice(0, 180)}
                          </button>
                        </li>
                      ))}
                    </ol>
                  )}
                </section>
                {canUpdate && (
                  <section className="af-document-edit">
                    <label>
                      제목
                      <input value={titleDraft} onChange={(event) => setTitleDraft(event.target.value)} />
                    </label>
                    <Button busy={busy} onClick={() => void saveTitle()} disabled={!titleDraft.trim()}>
                      정보 저장
                    </Button>
                  </section>
                )}
                {!canExport && <p role="alert">revision 내보내기 권한이 없습니다.</p>}
                {canExport && selected.document_type === "original" && (
                  <Preview blob={blob} mediaType={mediaType} previewUrl={previewUrl} />
                )}
                {canUpdate && selected.document_type === "original" && (
                  <section className="af-document-edit">
                    <label>
                      새 Markdown revision
                      <textarea value={contentDraft} onChange={(event) => setContentDraft(event.target.value)} />
                    </label>
                    <Button busy={busy} onClick={() => void addRevision()} disabled={!contentDraft}>
                      revision 저장
                    </Button>
                  </section>
                )}
                <section aria-labelledby="document-provenance-title">
                  <h2 id="document-provenance-title">출처 관계</h2>
                  {provenance.length ? (
                    <ul>
                      {provenance.map((edge) => (
                        <li key={edge.id}>
                          {edge.source_document_id} → {edge.relation} → {edge.target_document_id}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="af-document-muted">기록된 출처 관계가 없습니다.</p>
                  )}
                </section>
              </div>
            </>
          )}
          {canExport && (
            <div hidden={!selected || selected.document_type === "original"} className="af-document-editor-host">
              <DocumentEditor
                key={`${organizationId}:${workspaceId}`}
                documents={
                  loadedNavigationKey === navigationKey
                    ? documents.filter((item) => item.document_type !== "original")
                    : []
                }
                openRequest={loadedNavigationKey === navigationKey ? editorOpen : null}
                organizationId={organizationId}
                workspaceId={workspaceId}
                onReveal={(id) => {
                  setEditorReveal((current) => ({ id, serial: (current?.serial ?? 0) + 1 }));
                }}
              />
            </div>
          )}
        </div>
      </WorkbenchPanel>
    </>
  );
}
