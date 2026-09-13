import { useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  Dialog,
  Field,
  StateView,
  TextInput,
  WorkbenchPanel,
  WorkbenchSidebar,
} from "@agent-factory/design-system";
import { apiPath } from "../../api-path.js";
import {
  managementClient,
  type ConnectionRecord,
  type WorkspaceGroup,
  type WorkspaceRecord,
} from "../management/management-client.js";

declare global {
  interface Window {
    agentFactoryMCPClients?: { clients: { id: string; label: string }[] };
    agentFactoryMCPHandoff?: {
      build(input: Record<string, unknown>): { filename: string; instruction: string; blob: Blob };
    };
  }
}
const loadScript = (source: string) =>
  new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[data-native-mcp="${source}"]`);
    if (existing?.dataset.loaded === "true") return resolve();
    const script = existing ?? document.createElement("script");
    script.dataset.nativeMcp = source;
    script.src = apiPath(source);
    script.onload = () => {
      script.dataset.loaded = "true";
      resolve();
    };
    script.onerror = () => reject(new Error("MCP 설정 어댑터를 불러오지 못했습니다."));
    if (!existing) document.head.append(script);
  });

function WorkspaceConnections({
  userId,
  organizationId,
  workspace,
}: {
  userId: string;
  organizationId: string;
  workspace: WorkspaceRecord;
}) {
  const preferenceKey = `agent-factory:mcp-token:v1:${userId}:${organizationId}:${workspace.id}`;
  const [connections, setConnections] = useState<ConnectionRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(() => localStorage.getItem(preferenceKey));
  const [message, setMessage] = useState("연결 토큰을 불러오는 중입니다.");
  const [busy, setBusy] = useState(false);
  const [issueOpen, setIssueOpen] = useState(false);
  const [name, setName] = useState("");
  const [instructions, setInstructions] = useState("");
  const [toast, setToast] = useState("");
  const generation = useRef(0);
  const refresh = () => {
    const current = ++generation.current;
    void managementClient
      .connections(organizationId, workspace.id)
      .then((value) => {
        if (current !== generation.current) return;
        const rows = Array.isArray(value) ? value : (value.connections ?? []);
        setConnections(rows);
        setSelectedId((id) => (rows.some((row) => row.id === id) ? id : null));
        setMessage(rows.length ? "현재 선택 토큰의 마지막 요청 증거를 표시합니다." : "발급된 연결 토큰이 없습니다.");
      })
      .catch((error: Error) => setMessage(error.message));
  };
  useEffect(() => {
    setSelectedId(localStorage.getItem(preferenceKey));
    setToast("");
    refresh();
    return () => {
      generation.current += 1;
    };
  }, [preferenceKey]);
  const selected = connections.find((item) => item.id === selectedId);
  const select = (id: string) => {
    generation.current += 1;
    setBusy(false);
    setSelectedId(id);
    localStorage.setItem(preferenceKey, id);
  };
  const checkConnection = async () => {
    if (!selected) return;
    const current = ++generation.current;
    setBusy(true);
    setMessage("확인 중…");
    try {
      const delays = [0, 100, 200, 400, 800, 1_200, 1_600, 2_000];
      for (const delay of delays) {
        if (delay) await new Promise((resolve) => window.setTimeout(resolve, delay));
        if (current !== generation.current) return;
        const value = await managementClient.connections(organizationId, workspace.id);
        if (current !== generation.current) return;
        const rows = Array.isArray(value) ? value : (value.connections ?? []);
        setConnections(rows);
        const checked = rows.find((row) => row.id === selected.id);
        const checkedAt = checked?.last_seen_at ?? null;
        if (!checkedAt) continue;
        setMessage(`마지막 요청: ${checkedAt}`);
        const toastKey = `agent-factory:mcp-connected:v1:${preferenceKey}:${selected.id}`;
        if (sessionStorage.getItem(toastKey) !== "shown") {
          sessionStorage.setItem(toastKey, "shown");
          setToast("MCP 연결됨");
        }
        return;
      }
      setMessage("선택 토큰의 요청 기록이 아직 없습니다. 다시 확인해 주세요.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "연결 증거를 확인하지 못했습니다.");
    } finally {
      if (current === generation.current) setBusy(false);
    }
  };
  const removeConnection = async (connection: ConnectionRecord) => {
    const purge = connection.reason === "revoked";
    const current = ++generation.current;
    setBusy(true);
    try {
      await managementClient.revokeConnection(organizationId, workspace.id, connection.id, purge);
      if (current !== generation.current) return;
      setConnections((rows) =>
        purge
          ? rows.filter((row) => row.id !== connection.id)
          : rows.map((row) =>
              row.id === connection.id
                ? { ...row, state: "reauth_required", reason: "revoked", retrievable: false }
                : row,
            ),
      );
      setMessage(purge ? "폐기된 연결을 영구 삭제했습니다." : "연결 토큰을 폐기했습니다.");
      setBusy(false);
      refresh();
    } catch (error) {
      if (current === generation.current)
        setMessage(error instanceof Error ? error.message : "연결 토큰 작업을 완료하지 못했습니다.");
    } finally {
      if (current === generation.current) setBusy(false);
    }
  };
  const describe = async (download: boolean) => {
    if (!selected) return setMessage("먼저 유효한 토큰을 선택해 주세요.");
    setBusy(true);
    try {
      await loadScript("/static/js/mcp-clients.js");
      await loadScript("/static/js/mcp-handoff.js");
      const adapters = window.agentFactoryMCPClients;
      const handoff = window.agentFactoryMCPHandoff;
      if (!adapters || !handoff) throw new Error("MCP 설정 어댑터가 준비되지 않았습니다.");
      if (!download) {
        const result = handoff.build({
          adapters,
          context: {
            workspaceId: workspace.id,
            name: workspace.name,
            url: `${window.location.origin}${apiPath(`/mcp/workspaces/${workspace.id}/`)}`,
          },
          token: "PASTE_TOKEN_HERE",
          tokenId: selected.id,
        });
        setInstructions(result.instruction);
        await navigator.clipboard.writeText(result.instruction);
        setMessage("토큰이 포함되지 않은 AI 지침을 복사했습니다.");
        return;
      }
      const secret = await managementClient.revealConnection(organizationId, workspace.id, selected.id);
      const result = handoff.build({
        adapters,
        context: {
          workspaceId: workspace.id,
          name: workspace.name,
          url: `${window.location.origin}${apiPath(`/mcp/workspaces/${workspace.id}/`)}`,
        },
        token: secret.token,
        tokenId: selected.id,
      });
      const anchor = document.createElement("a");
      const url = URL.createObjectURL(result.blob);
      anchor.href = url;
      anchor.download = result.filename;
      anchor.click();
      URL.revokeObjectURL(url);
      setMessage("13개 클라이언트와 18개 환경 설정 ZIP 다운로드를 시작했습니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "요청을 완료하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="af-native-mcp">
      <div className="af-native-mcp-steps">
        <section>
          <b>1. 인증 토큰 발급</b>
          <p>이름을 지정해 본인용 토큰을 발급하거나 선택하세요.</p>
          <Button onClick={() => setIssueOpen(true)}>토큰 발급</Button>
        </section>
        <section>
          <b>2. MCP 클라이언트 설정 다운로드</b>
          <p>지원하는 13개 클라이언트와 18개 환경 설정을 한 ZIP으로 받습니다.</p>
          <Button busy={busy} disabled={!selected} onClick={() => void describe(true)}>
            전체 설정 ZIP 다운로드
          </Button>
        </section>
        <section>
          <b>3. AI 지침 복사</b>
          <p>토큰을 포함하지 않은 적용 지침을 AI에게 전달하세요.</p>
          <Button busy={busy} disabled={!selected} onClick={() => void describe(false)}>
            AI 지침 복사
          </Button>
          {instructions && <textarea readOnly value={instructions} aria-label="직접 복사할 AI 지침" />}
        </section>
        <section>
          <b>4. MCP 연결 확인</b>
          <p>선택 토큰의 실제 요청 증거를 다시 조회합니다.</p>
          <Button busy={busy} disabled={!selected} onClick={() => void checkConnection()}>
            {busy ? "확인 중…" : "연결 확인"}
          </Button>
          <p role="status">{message}</p>
          {toast && (
            <div className="af-native-toast" role="status">
              {toast}
            </div>
          )}
        </section>
      </div>
      <aside className="af-native-token-list" aria-label="연결 토큰 관리">
        <header>
          <b>연결 토큰</b>
          <Button onClick={refresh}>새로고침</Button>
        </header>
        {connections.length === 0 ? (
          <StateView state="empty" />
        ) : (
          connections.map((connection) => (
            <article key={connection.id}>
              <button
                className="af-native-link"
                onClick={() => select(connection.id)}
                aria-pressed={selectedId === connection.id}
              >
                {connection.name} {selectedId === connection.id && <small>선택됨</small>}
              </button>
              <p>
                {connection.state} · {connection.last_seen_at ?? "요청 기록 없음"} ·{" "}
                {connection.client_name ?? "클라이언트 미확인"}
              </p>
              <Button busy={busy} disabled={busy} onClick={() => void removeConnection(connection)}>
                {connection.reason === "revoked" ? "영구 삭제" : "폐기"}
              </Button>
            </article>
          ))
        )}
      </aside>
      <Dialog
        open={issueOpen}
        title="연결 토큰 발급"
        onClose={() => {
          setIssueOpen(false);
          setName("");
        }}
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!name.trim()) return;
            setBusy(true);
            void managementClient
              .createConnection(organizationId, workspace.id, name.trim())
              .then((created) => {
                setIssueOpen(false);
                setName("");
                setSelectedId(created.id);
                localStorage.setItem(preferenceKey, created.id);
                refresh();
              })
              .catch((error: Error) => setMessage(error.message))
              .finally(() => setBusy(false));
          }}
        >
          <Field label="토큰 이름">
            <TextInput autoFocus value={name} onChange={(event) => setName(event.target.value)} />
          </Field>
          <Button type="submit" variant="primary" busy={busy} disabled={!name.trim()}>
            발급
          </Button>
        </form>
      </Dialog>
    </div>
  );
}

export function WorkspaceWorkbench({
  userId,
  organizationId,
  personal,
  selectedId,
  permissions,
  onSelect,
}: {
  userId: string;
  organizationId: string;
  personal: boolean;
  selectedId: string | null;
  permissions: string[];
  onSelect(workspace: WorkspaceRecord): void;
}) {
  const [workspaces, setWorkspaces] = useState<WorkspaceRecord[]>([]);
  const [groups, setGroups] = useState<WorkspaceGroup[]>([]);
  const [recent, setRecent] = useState<WorkspaceRecord[]>([]);
  const [organizationPermissions, setOrganizationPermissions] = useState<string[]>(permissions);
  const [query, setQuery] = useState("");
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("");
  const [dialog, setDialog] = useState<"workspace" | "group" | "rename" | "rename-group" | "deactivate" | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<WorkspaceGroup | null>(null);
  const [draft, setDraft] = useState({ name: "", slug: "" });
  const [tab, setTab] = useState<"info" | "mcp">("info");
  const generation = useRef(0);
  const load = () => {
    const current = ++generation.current;
    const controller = new AbortController();
    setState("loading");
    void Promise.all([
      managementClient.workspaces(organizationId, controller.signal),
      managementClient.groups(organizationId, controller.signal),
      managementClient.recent(organizationId, controller.signal),
      managementClient.organization(organizationId, controller.signal),
    ])
      .then(([workspaceRows, groupRows, recentRows, organization]) => {
        if (current !== generation.current) return;
        setWorkspaces(workspaceRows);
        setGroups(groupRows);
        setRecent(recentRows);
        setOrganizationPermissions(organization.permissions ?? permissions);
        setState("ready");
      })
      .catch((error: Error) => {
        if (!controller.signal.aborted) {
          setState("error");
          setMessage(error.message);
        }
      });
    return () => controller.abort();
  };
  useEffect(load, [organizationId]);
  const selected = workspaces.find((item) => item.id === selectedId) ?? null;
  const visible = useMemo(
    () => workspaces.filter((item) => item.name.toLocaleLowerCase("ko").includes(query.toLocaleLowerCase("ko"))),
    [query, workspaces],
  );
  const groupRows = [{ id: "default", name: "기본 그룹", collapsed: false, revision: 1, workspace_ids: [] }, ...groups];
  const saveDialog = async () => {
    if (dialog !== "deactivate" && !draft.name.trim()) return;
    try {
      if (dialog === "workspace") {
        const created = await managementClient.createWorkspace(
          organizationId,
          { name: draft.name.trim(), slug: draft.slug },
          personal,
        );
        onSelect(created);
      } else if (dialog === "group") await managementClient.createGroup(organizationId, draft.name.trim());
      else if (dialog === "rename" && selected)
        await managementClient.updateWorkspace(organizationId, selected.id, {
          name: draft.name.trim(),
          revision: selected.revision,
        });
      else if (dialog === "rename-group" && selectedGroup)
        await managementClient.updateGroup(organizationId, selectedGroup, { name: draft.name.trim() });
      else if (dialog === "deactivate" && selected)
        await managementClient.deactivateWorkspace(organizationId, selected.id);
      setDialog(null);
      setDraft({ name: "", slug: "" });
      load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "저장하지 못했습니다. 입력은 유지됩니다.");
    }
  };
  const can = (permission: string) => organizationPermissions.includes(permission) || permissions.includes(permission);
  return (
    <>
      <WorkbenchSidebar>
        <header className="af-native-header">
          <b>작업공간</b>
          <Button disabled={!can("workspace.create")} onClick={() => setDialog("workspace")}>
            새 작업공간
          </Button>
        </header>
        <div className="af-native-filter">
          <TextInput
            aria-label="작업공간 이름 검색"
            placeholder="이름 검색"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <Button onClick={() => setDialog("group")}>새 그룹</Button>
        </div>
        <div className="af-native-scroll">
          {state === "error" && <Button onClick={load}>다시 시도</Button>}
          {state !== "ready" ? (
            <StateView state={state} />
          ) : (
            <>
              <section className="af-native-recent">
                <h2>최근 방문</h2>
                {recent.map((workspace) => (
                  <button key={workspace.id} className="af-native-workspace-row" onClick={() => onSelect(workspace)}>
                    {workspace.name}
                  </button>
                ))}
              </section>
              {groupRows.map((group) => {
                const assigned =
                  group.id === "default"
                    ? visible.filter((item) => !groups.some((row) => row.workspace_ids.includes(item.id)))
                    : visible.filter((item) => group.workspace_ids.includes(item.id));
                return (
                  <section key={group.id} className="af-native-group">
                    <header>
                      <button
                        title={group.name}
                        aria-expanded={!group.collapsed}
                        onClick={() =>
                          group.id !== "default" &&
                          void managementClient
                            .updateGroup(organizationId, group, { collapsed: !group.collapsed })
                            .then(load)
                        }
                      >
                        ▾ {group.name}
                      </button>
                      {group.id !== "default" && (
                        <Button
                          onClick={() => {
                            setSelectedGroup(group as WorkspaceGroup);
                            setDraft({ name: group.name, slug: "" });
                            setDialog("rename-group");
                          }}
                        >
                          이름 변경
                        </Button>
                      )}
                    </header>
                    {!group.collapsed &&
                      assigned.map((workspace) => (
                        <button
                          key={workspace.id}
                          className="af-native-workspace-row"
                          aria-current={selectedId === workspace.id ? "page" : undefined}
                          onClick={() => {
                            onSelect(workspace);
                            void managementClient.visit(organizationId, workspace.id);
                          }}
                          onContextMenu={(event) => {
                            event.preventDefault();
                            onSelect(workspace);
                            setDraft({ name: workspace.name, slug: workspace.slug });
                            setDialog("rename");
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "F2") {
                              setDraft({ name: workspace.name, slug: workspace.slug });
                              setDialog("rename");
                              onSelect(workspace);
                            }
                          }}
                        >
                          {workspace.name}
                        </button>
                      ))}
                  </section>
                );
              })}
            </>
          )}
        </div>
        <p role="status">{message}</p>
      </WorkbenchSidebar>
      <WorkbenchPanel>
        {!selected ? (
          <div className="af-native-empty">
            <h1>작업공간을 선택하세요</h1>
            <p>목록을 유지한 채 관리 작업을 시작할 수 있습니다.</p>
          </div>
        ) : (
          <>
            <header className="af-native-panel-header">
              <h1 title={selected.name}>{selected.name}</h1>
              <div role="tablist">
                <button role="tab" aria-selected={tab === "info"} onClick={() => setTab("info")}>
                  작업공간 정보
                </button>
                <button role="tab" aria-selected={tab === "mcp"} onClick={() => setTab("mcp")}>
                  MCP 연결
                </button>
              </div>
            </header>
            <div className="af-native-panel-body">
              {tab === "mcp" ? (
                <WorkspaceConnections userId={userId} organizationId={organizationId} workspace={selected} />
              ) : (
                <>
                  <dl className="af-native-summary">
                    <div>
                      <dt>이름</dt>
                      <dd>{selected.name}</dd>
                    </div>
                    <div>
                      <dt>상태</dt>
                      <dd>{selected.status}</dd>
                    </div>
                    <div>
                      <dt>생성일</dt>
                      <dd>{selected.created_at || "—"}</dd>
                    </div>
                    <div>
                      <dt>식별자</dt>
                      <dd>{selected.id}</dd>
                    </div>
                  </dl>
                  <div className="af-native-actions">
                    <Button
                      disabled={!can("workspace.update")}
                      onClick={() => {
                        setDraft({ name: selected.name, slug: selected.slug });
                        setDialog("rename");
                      }}
                    >
                      이름 변경
                    </Button>
                    <Button disabled={!can("workspace.delete")} onClick={() => setDialog("deactivate")}>
                      비활성화
                    </Button>
                  </div>
                  <Field label="그룹 이동 (키보드 선택 가능)">
                    <select
                      className="af-select"
                      value={groups.find((group) => group.workspace_ids.includes(selected.id))?.id ?? ""}
                      onChange={(event) =>
                        void managementClient
                          .assignGroup(organizationId, selected.id, event.target.value || null)
                          .then(load)
                      }
                    >
                      <option value="">기본 그룹</option>
                      {groups.map((group) => (
                        <option key={group.id} value={group.id}>
                          {group.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <WorkspaceResources
                    organizationId={organizationId}
                    workspaceId={selected.id}
                    permissions={[...new Set([...permissions, ...organizationPermissions])]}
                  />
                </>
              )}
            </div>
          </>
        )}
      </WorkbenchPanel>
      <Dialog
        open={dialog !== null}
        title={
          dialog === "workspace"
            ? "작업공간 만들기"
            : dialog === "group"
              ? "그룹 만들기"
              : dialog === "deactivate"
                ? "작업공간 비활성화"
                : "이름 변경"
        }
        onClose={() => setDialog(null)}
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void saveDialog();
          }}
        >
          {dialog === "deactivate" && <p>{selected?.name} 작업공간을 비활성화하시겠습니까?</p>}
          {dialog !== "deactivate" && (
            <Field label="이름">
              <TextInput
                autoFocus
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              />
            </Field>
          )}
          {dialog === "workspace" && (
            <Field label="슬러그">
              <TextInput
                required
                pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                value={draft.slug}
                onChange={(event) => setDraft({ ...draft, slug: event.target.value })}
              />
            </Field>
          )}
          <Button
            type="submit"
            variant="primary"
            disabled={dialog !== "deactivate" && (!draft.name.trim() || (dialog === "workspace" && !draft.slug))}
          >
            {dialog === "deactivate" ? "비활성화" : "저장"}
          </Button>
          <p role="status">{message}</p>
        </form>
      </Dialog>
    </>
  );
}

function WorkspaceResources({
  organizationId,
  workspaceId,
  permissions,
}: {
  organizationId: string;
  workspaceId: string;
  permissions: string[];
}) {
  const [usage, setUsage] = useState<{ members: number; repositories: number } | null>(null);
  const [repositories, setRepositories] = useState<Record<string, unknown>[]>([]);
  const [members, setMembers] = useState<Record<string, unknown>[]>([]);
  const [error, setError] = useState("");
  const [repository, setRepository] = useState({ location: "", remote_url: "" });
  const [member, setMember] = useState({ email: "", role: "member" });
  const can = (permission: string) => permissions.includes(permission);
  const refresh = () => {
    const controller = new AbortController();
    void Promise.all([
      managementClient.workspaceResource<{ members: number; repositories: number }>(
        organizationId,
        workspaceId,
        "usage",
        controller.signal,
      ),
      can("repository.read")
        ? managementClient.workspaceResource<Record<string, unknown>[]>(
            organizationId,
            workspaceId,
            "repositories",
            controller.signal,
          )
        : Promise.resolve([]),
      can("workspace.manage_members")
        ? managementClient.workspaceResource<Record<string, unknown>[]>(
            organizationId,
            workspaceId,
            "members",
            controller.signal,
          )
        : Promise.resolve([]),
    ])
      .then(([u, r, m]) => {
        setUsage(u);
        setRepositories(r);
        setMembers(m);
      })
      .catch((reason: Error) => setError(reason.message));
    return () => controller.abort();
  };
  useEffect(refresh, [organizationId, workspaceId]);
  return (
    <section className="af-native-resources">
      <h2>사용량 및 관리</h2>
      {error && <p role="alert">{error}</p>}
      <p>
        구성원 {usage?.members ?? "—"}명 · 저장소 {usage?.repositories ?? "—"}개
      </p>
      <h3>저장소</h3>
      {can("repository.create") && (
        <form
          className="af-native-inline-form"
          onSubmit={(event) => {
            event.preventDefault();
            void managementClient
              .mutateWorkspaceResource(organizationId, workspaceId, "repositories", "POST", {
                location: repository.location,
                remote_url: repository.remote_url || null,
                metadata: {},
              })
              .then(() => {
                setRepository({ location: "", remote_url: "" });
                refresh();
              })
              .catch((reason: Error) => setError(reason.message));
          }}
        >
          <Field label="로컬 위치">
            <TextInput
              required
              value={repository.location}
              onChange={(event) => setRepository({ ...repository, location: event.target.value })}
            />
          </Field>
          <Field label="원격 URL">
            <TextInput
              type="url"
              value={repository.remote_url}
              onChange={(event) => setRepository({ ...repository, remote_url: event.target.value })}
            />
          </Field>
          <Button type="submit">추가</Button>
        </form>
      )}
      {repositories.length ? (
        repositories.map((row) => (
          <article className="af-native-row" key={String(row.id)}>
            <span>{String(row.canonical_location)}</span>
            <Button
              onClick={() =>
                void managementClient
                  .mutateWorkspaceResource(organizationId, workspaceId, `repositories/${row.id}`, "DELETE")
                  .then(refresh)
              }
            >
              제거
            </Button>
          </article>
        ))
      ) : (
        <p>등록된 저장소가 없습니다.</p>
      )}
      <h3>구성원</h3>
      {can("workspace.manage_members") && (
        <form
          className="af-native-inline-form"
          onSubmit={(event) => {
            event.preventDefault();
            void managementClient
              .mutateWorkspaceResource(organizationId, workspaceId, "members", "POST", member)
              .then(() => {
                setMember({ email: "", role: "member" });
                refresh();
              })
              .catch((reason: Error) => setError(reason.message));
          }}
        >
          <Field label="이메일">
            <TextInput
              type="email"
              required
              value={member.email}
              onChange={(event) => setMember({ ...member, email: event.target.value })}
            />
          </Field>
          <Field label="역할">
            <TextInput
              required
              value={member.role}
              onChange={(event) => setMember({ ...member, role: event.target.value })}
            />
          </Field>
          <Button type="submit">추가</Button>
        </form>
      )}
      {members.length ? (
        members.map((row) => (
          <article className="af-native-row" key={String(row.user_id)}>
            <span>
              {String(row.display_name)} · {String(row.role)}
            </span>
            <Button
              onClick={() =>
                void managementClient
                  .mutateWorkspaceResource(organizationId, workspaceId, `members/${row.user_id}`, "DELETE")
                  .then(refresh)
              }
            >
              제거
            </Button>
          </article>
        ))
      ) : (
        <p>표시할 구성원이 없습니다.</p>
      )}
    </section>
  );
}
