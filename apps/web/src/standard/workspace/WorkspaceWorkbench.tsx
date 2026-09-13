import { workspaceClient, type WorkspaceRecord, type WorkspaceGroup } from "./workspace-client.js";
import { organizationClient } from "../organization/index.js";
import { WorkspaceConnections } from "../connections/index.js";
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
      workspaceClient.workspaces(organizationId, controller.signal),
      workspaceClient.groups(organizationId, controller.signal),
      workspaceClient.recent(organizationId, controller.signal),
      organizationClient.organization(organizationId, controller.signal),
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
        const created = await workspaceClient.createWorkspace(
          organizationId,
          { name: draft.name.trim(), slug: draft.slug },
          personal,
        );
        onSelect(created);
      } else if (dialog === "group") await workspaceClient.createGroup(organizationId, draft.name.trim());
      else if (dialog === "rename" && selected)
        await workspaceClient.updateWorkspace(organizationId, selected.id, {
          name: draft.name.trim(),
          revision: selected.revision,
        });
      else if (dialog === "rename-group" && selectedGroup)
        await workspaceClient.updateGroup(organizationId, selectedGroup, { name: draft.name.trim() });
      else if (dialog === "deactivate" && selected)
        await workspaceClient.deactivateWorkspace(organizationId, selected.id);
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
                          void workspaceClient
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
                            void workspaceClient.visit(organizationId, workspace.id);
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
                        void workspaceClient
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
      workspaceClient.workspaceResource<{ members: number; repositories: number }>(
        organizationId,
        workspaceId,
        "usage",
        controller.signal,
      ),
      can("repository.read")
        ? workspaceClient.workspaceResource<Record<string, unknown>[]>(
            organizationId,
            workspaceId,
            "repositories",
            controller.signal,
          )
        : Promise.resolve([]),
      can("workspace.manage_members")
        ? workspaceClient.workspaceResource<Record<string, unknown>[]>(
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
            void workspaceClient
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
                void workspaceClient
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
            void workspaceClient
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
                void workspaceClient
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
