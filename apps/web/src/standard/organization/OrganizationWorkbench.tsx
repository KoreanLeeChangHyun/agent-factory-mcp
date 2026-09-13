import type { OrganizationSummary } from "./organization-types.js";
import {
  organizationClient,
  type OrganizationMemberRecord,
  type OrganizationTeamRecord,
  type OrganizationWorkspaceOptionRecord,
  type OrganizationOverview,
} from "./organization-client.js";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Button,
  DataTable,
  Dialog,
  Field,
  Select,
  StateView,
  TextInput,
  WorkbenchPanel,
  WorkbenchSidebar,
  type DataTableColumn,
} from "@agent-factory/design-system";

type View = "overview" | "workspaces" | "members" | "teams" | "settings" | "roles" | "audit";
type OrganizationDialog = "invite" | "team" | "role" | "edit" | "transfer" | "delete";
type OrganizationTableRow = { id: string; title: string; status: string; source: Record<string, unknown> };
type OrganizationWorkspaceOption = OrganizationWorkspaceOptionRecord & Record<string, unknown>;

function isOrganizationWorkspaceOption(record: Record<string, unknown>): record is OrganizationWorkspaceOption {
  return (
    typeof record.id === "string" &&
    typeof record.name === "string" &&
    (record.permissions === undefined ||
      (Array.isArray(record.permissions) && record.permissions.every((permission) => typeof permission === "string")))
  );
}

const views: { id: View; label: string }[] = [
  { id: "overview", label: "개요" },
  { id: "workspaces", label: "작업공간" },
  { id: "members", label: "구성원" },
  { id: "teams", label: "팀" },
  { id: "settings", label: "설정" },
  { id: "roles", label: "설정 · 역할 및 권한" },
  { id: "audit", label: "설정 · 감사 로그" },
];
export function OrganizationWorkbench({
  organizations,
  selectedId,
  onSelect,
  onCreated,
}: {
  organizations: OrganizationSummary[];
  selectedId: string | null;
  onSelect(id: string | null): void;
  onCreated(): void;
}) {
  const [view, setView] = useState<View>("overview");
  const [overview, setOverview] = useState<OrganizationOverview | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [createOpen, setCreateOpen] = useState(false);
  const [draft, setDraft] = useState({ name: "", slug: "" });
  const [message, setMessage] = useState("");
  const generation = useRef(0);
  const requestController = useRef<AbortController | null>(null);
  const refreshOverview = useCallback(
    async (showLoading = false) => {
      requestController.current?.abort();
      if (!selectedId) {
        setOverview(null);
        setState("ready");
        return;
      }
      const current = ++generation.current;
      const controller = new AbortController();
      requestController.current = controller;
      if (showLoading) setState("loading");
      try {
        const value = await organizationClient.organization(selectedId, controller.signal);
        if (current === generation.current) {
          setOverview(value);
          setState("ready");
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setMessage(error instanceof Error ? error.message : "조직을 불러오지 못했습니다.");
          if (showLoading) setState("error");
        }
      } finally {
        if (requestController.current === controller) requestController.current = null;
      }
    },
    [selectedId],
  );
  useEffect(() => {
    void refreshOverview(true);
    return () => {
      requestController.current?.abort();
      requestController.current = null;
      generation.current += 1;
    };
  }, [refreshOverview]);
  return (
    <>
      <WorkbenchSidebar>
        <header className="af-native-header">
          <b>조직</b>
          <Button onClick={() => setCreateOpen(true)}>새 조직</Button>
        </header>
        <div className="af-native-scroll">
          <label className="af-native-select-label">
            조직 선택
            <Select value={selectedId ?? ""} onChange={(event) => onSelect(event.target.value || null)}>
              <option value="">선택 안 함</option>
              {organizations.map((organization) => (
                <option key={organization.id} value={organization.id}>
                  {organization.is_personal ? "개인" : organization.name} · @{organization.slug}
                </option>
              ))}
            </Select>
          </label>
          <nav className="af-native-subnav" aria-label="조직 관리">
            {views.map((item) => (
              <button
                key={item.id}
                aria-current={view === item.id ? "page" : undefined}
                onClick={() => setView(item.id)}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>
      </WorkbenchSidebar>
      <WorkbenchPanel>
        <header className="af-native-panel-header">
          <h1>{overview?.name ?? "조직 관리"}</h1>
          {overview && <span>@{overview.slug}</span>}
        </header>
        <div className="af-native-panel-body">
          {state !== "ready" ? (
            <StateView state={state} />
          ) : !selectedId || !overview ? (
            <StateView state="empty" />
          ) : (
            <OrganizationView organization={overview} view={view} onRefresh={() => refreshOverview()} />
          )}
        </div>
      </WorkbenchPanel>
      <Dialog open={createOpen} title="조직 만들기" onClose={() => setCreateOpen(false)}>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void organizationClient
              .createOrganization(draft)
              .then((created) => {
                setCreateOpen(false);
                onCreated();
                onSelect(created.id);
              })
              .catch((error: Error) => setMessage(error.message));
          }}
        >
          <Field label="이름">
            <TextInput
              autoFocus
              required
              value={draft.name}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            />
          </Field>
          <Field label="@슬러그">
            <TextInput
              required
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              value={draft.slug}
              onChange={(event) => setDraft({ ...draft, slug: event.target.value })}
            />
          </Field>
          <Button variant="primary" type="submit">
            만들기
          </Button>
          <p role="status">{message}</p>
        </form>
      </Dialog>
    </>
  );
}

function OrganizationView({
  organization,
  view,
  onRefresh,
}: {
  organization: OrganizationOverview;
  view: View;
  onRefresh(): Promise<void>;
}) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [related, setRelated] = useState<Record<string, unknown>[]>([]);
  const [options, setOptions] = useState<OrganizationWorkspaceOption[]>([]);
  const [roles, setRoles] = useState<Record<string, unknown>[]>([]);
  const [message, setMessage] = useState("");
  const [dialog, setDialog] = useState<OrganizationDialog | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({
    name: organization.name,
    slug: organization.slug,
    email: "",
    description: "",
    confirmation: "",
  });
  const [query, setQuery] = useState("");
  const [memberDetail, setMemberDetail] = useState<Record<string, unknown> | null>(null);
  const [memberWorkspaceId, setMemberWorkspaceId] = useState("");
  const [permissionKeys, setPermissionKeys] = useState<string[]>([]);
  const [activeTeam, setActiveTeam] = useState<OrganizationTeamRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);
  const mutationGeneration = useRef(0);
  const mutationController = useRef<AbortController | null>(null);
  const busyRef = useRef(false);
  const organizationRef = useRef(organization.id);
  const dialogRef = useRef<OrganizationDialog | null>(dialog);
  organizationRef.current = organization.id;
  dialogRef.current = dialog;
  const can = (permission: string) => organization.permissions.includes(permission);
  const load = () => {
    const current = ++generation.current;
    const controller = new AbortController();
    setRows([]);
    setRelated([]);
    setRoles([]);
    setMessage("불러오는 중입니다.");
    const requests: Promise<Record<string, unknown>[]>[] = [];
    if (view === "workspaces")
      requests.push(organizationClient.organizationResource(organization.id, "workspace-options", controller.signal));
    if (view === "members" && can("member.read"))
      requests.push(
        organizationClient.organizationResource(organization.id, "members", controller.signal),
        can("role.read")
          ? organizationClient.organizationResource(organization.id, "roles", controller.signal)
          : Promise.resolve([]),
        organizationClient.organizationResource(organization.id, "workspace-options", controller.signal),
      );
    if (view === "teams" && can("team.read"))
      requests.push(
        organizationClient.organizationResource(organization.id, "teams", controller.signal),
        can("member.read")
          ? organizationClient.organizationResource(organization.id, "members", controller.signal)
          : Promise.resolve([]),
        can("member.read")
          ? organizationClient.organizationResource(organization.id, "workspace-options", controller.signal)
          : Promise.resolve([]),
        can("role.read")
          ? organizationClient.organizationResource(organization.id, "roles", controller.signal)
          : Promise.resolve([]),
      );
    if (view === "settings")
      requests.push(
        can("role.read")
          ? organizationClient.organizationResource(organization.id, "roles", controller.signal)
          : Promise.resolve([]),
        !organization.is_personal && can("member.invite")
          ? organizationClient.organizationResource(organization.id, "invitations", controller.signal)
          : Promise.resolve([]),
        organizationClient.organizationResource(organization.id, "workspace-options", controller.signal),
      );
    if (view === "roles" && can("role.read"))
      requests.push(
        organizationClient.organizationResource(organization.id, "roles", controller.signal),
        organizationClient.organizationResource(organization.id, "permission-catalog", controller.signal),
      );
    if (view === "audit" && can("member.update_role"))
      requests.push(organizationClient.organizationResource(organization.id, "events", controller.signal));
    void Promise.all(requests)
      .then((values) => {
        if (current !== generation.current) return;
        const workspaceOptions = (values[2] ?? []).filter(isOrganizationWorkspaceOption);
        if (view === "settings") {
          setRows([]);
          setRoles(values[0] ?? []);
          setRelated(values[1] ?? []);
          setOptions(workspaceOptions);
        } else if (view === "members") {
          setRows(values[0] ?? []);
          setRelated([]);
          setRoles(values[1] ?? []);
          setOptions(workspaceOptions);
          setMemberWorkspaceId((selectedId) =>
            workspaceOptions.some((option) => option.id === selectedId) ? selectedId : (workspaceOptions[0]?.id ?? ""),
          );
        } else {
          setRows(values[0] ?? []);
          setRelated(values[1] ?? []);
          setOptions(workspaceOptions);
          setRoles(values[3] ?? []);
        }
        setMessage("");
      })
      .catch((error: Error) => {
        if (!controller.signal.aborted) setMessage(error.message);
      });
    return () => controller.abort();
  };
  useEffect(load, [organization.id, view]);
  useEffect(() => {
    busyRef.current = false;
    setBusy(false);
    return () => {
      mutationGeneration.current += 1;
      mutationController.current?.abort();
      mutationController.current = null;
      busyRef.current = false;
    };
  }, [organization.id]);
  const closeDialog = () => {
    mutationGeneration.current += 1;
    mutationController.current?.abort();
    mutationController.current = null;
    busyRef.current = false;
    setBusy(false);
    dialogRef.current = null;
    setDialog(null);
    setActiveTeam(null);
  };
  const mutate = async (suffix: string, method: string, body?: unknown) => {
    if (busyRef.current) return;
    const organizationId = organization.id;
    const submittedDialog = dialogRef.current;
    const current = ++mutationGeneration.current;
    const controller = new AbortController();
    mutationController.current?.abort();
    mutationController.current = controller;
    busyRef.current = true;
    setBusy(true);
    try {
      await organizationClient.mutateOrganization(organizationId, suffix, method, body, controller.signal);
      if (
        controller.signal.aborted ||
        current !== mutationGeneration.current ||
        organizationRef.current !== organizationId ||
        (submittedDialog !== null && dialogRef.current !== submittedDialog)
      )
        return;
      if (submittedDialog !== null) {
        dialogRef.current = null;
        setDialog(null);
        setActiveTeam(null);
      }
      load();
      if (organizationRef.current === organizationId) await onRefresh();
    } catch (error) {
      if (
        !controller.signal.aborted &&
        current === mutationGeneration.current &&
        organizationRef.current === organizationId &&
        (submittedDialog === null || dialogRef.current === submittedDialog)
      )
        setMessage(error instanceof Error ? error.message : "요청을 완료하지 못했습니다.");
    } finally {
      if (current === mutationGeneration.current) {
        mutationController.current = null;
        busyRef.current = false;
        setBusy(false);
      }
    }
  };
  if (view === "overview")
    return (
      <>
        <dl className="af-native-summary">
          <div>
            <dt>이름</dt>
            <dd>{organization.name}</dd>
          </div>
          <div>
            <dt>슬러그</dt>
            <dd>@{organization.slug}</dd>
          </div>
          <div>
            <dt>유형</dt>
            <dd>{organization.is_personal ? "개인 조직" : "조직"}</dd>
          </div>
        </dl>
        <p>조직의 작업공간, 구성원, 팀과 권한을 왼쪽 사이드바에서 관리하세요.</p>
      </>
    );
  const tableRows: OrganizationTableRow[] = rows
    .filter((row) =>
      `${row.name ?? row.display_name ?? ""} ${row.email ?? ""}`
        .toLocaleLowerCase()
        .includes(query.toLocaleLowerCase()),
    )
    .map((row) => ({
      id: String(row.id),
      title: String(row.name ?? row.display_name ?? row.email ?? row.slug ?? row.action ?? row.id),
      status: String(row.status ?? row.scope ?? row.role_name ?? row.outcome ?? "—"),
      source: row,
    }));
  const selectedMemberWorkspace = options.find((option) => String(option.id) === memberWorkspaceId);
  const canAssignWorkspaceMember =
    organization.is_owner === true ||
    (can("role.assign") &&
      Array.isArray(selectedMemberWorkspace?.permissions) &&
      selectedMemberWorkspace.permissions.includes("workspace.manage_members"));
  const columns: DataTableColumn<OrganizationTableRow>[] = [
    { id: "title", label: "이름" },
    { id: "status", label: "상태/범위" },
    {
      id: "source",
      label: "작업",
      render: (_value, item) => {
        const row = item.source;
        if (view === "members")
          return (
            <>
              <Button
                disabled={!can("member.read")}
                onClick={() => {
                  setMemberDetail(null);
                  void organizationClient
                    .organizationResource<Record<string, unknown>>(organization.id, `members/${row.user_id ?? row.id}`)
                    .then(setMemberDetail);
                }}
              >
                상세
              </Button>
              <Button
                disabled={busy || !can("member.suspend")}
                onClick={() =>
                  void mutate(`members/${row.user_id ?? row.id}`, "PATCH", {
                    status: row.status === "suspended" ? "active" : "suspended",
                  })
                }
              >
                {row.status === "suspended" ? "복원" : "정지"}
              </Button>
              <Button
                disabled={busy || !can("member.remove")}
                onClick={() => void mutate(`members/${row.user_id ?? row.id}`, "PATCH", { status: "removed" })}
              >
                제거
              </Button>
            </>
          );
        if (view === "teams")
          return (
            <>
              <Button
                disabled={!can("team.update")}
                onClick={() => {
                  setDraft({
                    ...draft,
                    teamId: String(row.id),
                    name: String(row.name),
                    description: String(row.description ?? ""),
                  });
                  setActiveTeam(row as unknown as OrganizationTeamRecord);
                  setDialog("team");
                }}
              >
                편집
              </Button>
              <Button disabled={busy || !can("team.delete")} onClick={() => void mutate(`teams/${row.id}`, "DELETE")}>
                삭제
              </Button>
            </>
          );
        if (view === "roles" && !row.is_system)
          return (
            <>
              <Button
                disabled={!can("role.update")}
                onClick={() => {
                  setDraft({ ...draft, roleId: String(row.id), name: String(row.name), scope: String(row.scope) });
                  setPermissionKeys(Array.isArray(row.permissions) ? row.permissions.map(String) : []);
                  setDialog("role");
                }}
              >
                편집
              </Button>
              <Button disabled={busy || !can("role.delete")} onClick={() => void mutate(`roles/${row.id}`, "DELETE")}>
                삭제
              </Button>
            </>
          );
        return "—";
      },
    },
  ];
  return (
    <>
      <section className="af-native-section">
        <header>
          <h2>{views.find((item) => item.id === view)?.label}</h2>
          <div>
            {view === "members" && (
              <Button disabled={organization.is_personal || !can("member.invite")} onClick={() => setDialog("invite")}>
                초대
              </Button>
            )}
            {view === "teams" && (
              <Button
                disabled={!can("team.create")}
                onClick={() => {
                  setActiveTeam(null);
                  setDialog("team");
                }}
              >
                팀 만들기
              </Button>
            )}
            {view === "roles" && (
              <Button disabled={!can("role.create")} onClick={() => setDialog("role")}>
                역할 만들기
              </Button>
            )}
            {view === "settings" && (
              <Button disabled={!can("organization.update")} onClick={() => setDialog("edit")}>
                조직 수정
              </Button>
            )}
          </div>
        </header>
        {view === "members" && (
          <Field label="이름 또는 이메일 검색">
            <TextInput value={query} onChange={(event) => setQuery(event.target.value)} />
          </Field>
        )}
        {message && <p role={message === "불러오는 중입니다." ? "status" : "alert"}>{message}</p>}
        {rows.length ? (
          <DataTable rows={tableRows} columns={columns} caption={views.find((item) => item.id === view)?.label} />
        ) : (
          message === "" && <StateView state="empty" />
        )}
        {view === "members" && memberDetail && (
          <section className="af-native-detail">
            <h2>{String(memberDetail.name ?? memberDetail.display_name)}</h2>
            <p>{String(memberDetail.email)}</p>
            <h3>적용 권한과 부여 경로</h3>
            <pre>
              {JSON.stringify(
                {
                  organization_sources: memberDetail.organization_sources,
                  teams: memberDetail.teams,
                  workspaces: memberDetail.workspaces,
                },
                null,
                2,
              )}
            </pre>
            <form
              className="af-native-inline-form"
              onSubmit={(event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                void mutate(`members/${memberDetail.user_id}`, "PATCH", { role_id: data.get("role") });
              }}
            >
              <Field label="조직 역할">
                <Select name="role" defaultValue={String(memberDetail.role_id ?? "")}>
                  {roles
                    .filter((role) => role.scope === "organization")
                    .map((role) => (
                      <option key={String(role.id)} value={String(role.id)}>
                        {String(role.name)}
                      </option>
                    ))}
                </Select>
              </Field>
              <Button type="submit" disabled={busy || !can("member.update_role") || !can("role.assign")}>
                역할 저장
              </Button>
            </form>
            <form
              className="af-native-inline-form"
              onSubmit={(event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                void mutate(`assignments/${data.get("workspace")}/members/${memberDetail.user_id}`, "PUT", {
                  role_id: data.get("role"),
                });
              }}
            >
              <Field label="작업공간">
                <Select
                  name="workspace"
                  value={memberWorkspaceId}
                  onChange={(event) => setMemberWorkspaceId(event.target.value)}
                >
                  {options.map((row) => (
                    <option key={String(row.id)} value={String(row.id)}>
                      {String(row.name)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="작업공간 역할">
                <Select name="role">
                  {roles
                    .filter((role) => role.scope === "workspace")
                    .map((role) => (
                      <option key={String(role.id)} value={String(role.id)}>
                        {String(role.name)}
                      </option>
                    ))}
                </Select>
              </Field>
              <Button type="submit" disabled={busy || !memberWorkspaceId || !canAssignWorkspaceMember}>
                직접 배정
              </Button>
            </form>
          </section>
        )}
        {view === "settings" && (
          <>
            <h2>초대</h2>
            {related.map((row) => (
              <article className="af-native-row" key={String(row.id)}>
                <span>
                  {String(row.email)} · {String(row.status)}
                </span>
                <Button
                  disabled={busy || !can("member.invite")}
                  onClick={() => void mutate(`invitations/${row.id}/resend`, "POST")}
                >
                  다시 보내기
                </Button>
                <Button
                  disabled={busy || !can("member.cancel_invite")}
                  onClick={() => void mutate(`invitations/${row.id}`, "DELETE")}
                >
                  취소
                </Button>
              </article>
            ))}
            <h2>소유권과 위험 영역</h2>
            <Button
              disabled={organization.is_personal || !can("organization.transfer")}
              onClick={() => setDialog("transfer")}
            >
              소유권 이전
            </Button>
            <Button
              disabled={organization.is_personal || !can("organization.delete")}
              onClick={() => setDialog("delete")}
            >
              조직 삭제
            </Button>
            <p>기술 UUID: {organization.id}</p>
          </>
        )}
      </section>
      <Dialog
        open={dialog !== null}
        title={
          dialog === "invite"
            ? "구성원 초대"
            : dialog === "team"
              ? "팀 편집"
              : dialog === "role"
                ? "역할 편집"
                : dialog === "edit"
                  ? "조직 수정"
                  : dialog === "transfer"
                    ? "소유권 이전"
                    : "조직 삭제"
        }
        onClose={closeDialog}
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (dialog === "invite")
              void mutate("invitations", "POST", {
                email: draft.email,
                role_id: draft.roleId,
                workspace_grants:
                  draft.workspaceId && draft.workspaceRoleId
                    ? [{ workspace_id: draft.workspaceId, role_id: draft.workspaceRoleId }]
                    : [],
              });
            else if (dialog === "team")
              void mutate(draft.teamId ? `teams/${draft.teamId}` : "teams", draft.teamId ? "PUT" : "POST", {
                name: draft.name,
                description: draft.description,
              });
            else if (dialog === "role")
              void mutate(draft.roleId ? `roles/${draft.roleId}` : "roles", draft.roleId ? "PUT" : "POST", {
                name: draft.name,
                scope: draft.scope || "organization",
                permissions: permissionKeys,
              });
            else if (dialog === "edit")
              void mutate("", "PATCH", { name: draft.name, slug: draft.slug, revision: organization.revision });
            else if (dialog === "transfer") void mutate("transfer", "POST", { user_id: draft.userId });
            else if (dialog === "delete" && draft.confirmation === organization.name) void mutate("", "DELETE");
          }}
        >
          {dialog === "invite" && (
            <>
              <Field label="이메일">
                <TextInput
                  type="email"
                  required
                  value={draft.email}
                  onChange={(event) => setDraft({ ...draft, email: event.target.value })}
                />
              </Field>
              <Field label="조직 역할">
                <Select
                  required
                  value={draft.roleId ?? ""}
                  onChange={(event) => setDraft({ ...draft, roleId: event.target.value })}
                >
                  <option value="">선택</option>
                  {roles
                    .filter((role) => role.scope === "organization")
                    .map((role) => (
                      <option key={String(role.id)} value={String(role.id)}>
                        {String(role.name)}
                      </option>
                    ))}
                </Select>
              </Field>
              <Field label="참여 작업공간">
                <Select
                  value={draft.workspaceId ?? ""}
                  onChange={(event) => setDraft({ ...draft, workspaceId: event.target.value })}
                >
                  <option value="">나중에 배정</option>
                  {options.map((row) => (
                    <option key={String(row.id)} value={String(row.id)}>
                      {String(row.name)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="작업공간 역할">
                <Select
                  value={draft.workspaceRoleId ?? ""}
                  onChange={(event) => setDraft({ ...draft, workspaceRoleId: event.target.value })}
                >
                  <option value="">선택</option>
                  {roles
                    .filter((role) => role.scope === "workspace")
                    .map((role) => (
                      <option key={String(role.id)} value={String(role.id)}>
                        {String(role.name)}
                      </option>
                    ))}
                </Select>
              </Field>
            </>
          )}
          {["team", "role", "edit"].includes(dialog ?? "") && (
            <Field label="이름">
              <TextInput
                required
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              />
            </Field>
          )}
          {dialog === "edit" && (
            <Field label="슬러그">
              <TextInput
                required
                value={draft.slug}
                onChange={(event) => setDraft({ ...draft, slug: event.target.value })}
              />
            </Field>
          )}
          {dialog === "team" && (
            <>
              <Field label="설명">
                <TextInput
                  value={draft.description}
                  onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                />
              </Field>
              {draft.teamId && (
                <>
                  <Field label="추가할 구성원">
                    <Select
                      value={draft.userId ?? ""}
                      onChange={(event) => setDraft({ ...draft, userId: event.target.value })}
                    >
                      <option value="">선택</option>
                      {(related as unknown as OrganizationMemberRecord[]).map((member) => (
                        <option key={member.user_id} value={member.user_id}>
                          {member.name || member.email}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Button
                    type="button"
                    disabled={busy || !can("team.manage_members") || !draft.userId}
                    onClick={() => void mutate(`teams/${draft.teamId}/members/${draft.userId}`, "PUT")}
                  >
                    팀원 추가
                  </Button>
                  {(activeTeam?.members ?? []).map((userId) => (
                    <article className="af-native-row" key={String(userId)}>
                      <span>
                        {String(
                          (related as unknown as OrganizationMemberRecord[]).find(
                            (member) => member.user_id === String(userId),
                          )?.name ?? userId,
                        )}
                      </span>
                      <Button
                        type="button"
                        disabled={busy || !can("team.manage_members")}
                        onClick={() => void mutate(`teams/${draft.teamId}/members/${String(userId)}`, "DELETE")}
                      >
                        팀원 제거
                      </Button>
                    </article>
                  ))}
                  <Field label="부여할 작업공간">
                    <Select
                      value={draft.workspaceId ?? ""}
                      onChange={(event) => setDraft({ ...draft, workspaceId: event.target.value })}
                    >
                      <option value="">선택</option>
                      {options.map((workspace) => (
                        <option key={String(workspace.id)} value={String(workspace.id)}>
                          {String(workspace.name)}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="작업공간 역할">
                    <Select
                      value={draft.workspaceRoleId ?? ""}
                      onChange={(event) => setDraft({ ...draft, workspaceRoleId: event.target.value })}
                    >
                      <option value="">선택</option>
                      {roles
                        .filter((role) => role.scope === "workspace")
                        .map((role) => (
                          <option key={String(role.id)} value={String(role.id)}>
                            {String(role.name)}
                          </option>
                        ))}
                    </Select>
                  </Field>
                  <Button
                    type="button"
                    disabled={busy || !can("team.manage_members") || !draft.workspaceId || !draft.workspaceRoleId}
                    onClick={() =>
                      void mutate(`teams/${draft.teamId}/workspaces/${draft.workspaceId}`, "PUT", {
                        role_id: draft.workspaceRoleId,
                      })
                    }
                  >
                    작업공간 부여
                  </Button>
                  {(activeTeam?.workspaces ?? []).map((grant) => {
                    return (
                      <article className="af-native-row" key={grant.workspace_id}>
                        <span>
                          {String(
                            options.find((workspace) => workspace.id === grant.workspace_id)?.name ??
                              grant.workspace_id,
                          )}
                        </span>
                        <Button
                          type="button"
                          disabled={busy || !can("team.manage_members")}
                          onClick={() =>
                            void mutate(`teams/${draft.teamId}/workspaces/${grant.workspace_id}`, "DELETE")
                          }
                        >
                          작업공간 부여 해제
                        </Button>
                      </article>
                    );
                  })}
                </>
              )}
            </>
          )}
          {dialog === "role" && (
            <>
              <Field label="역할 범위">
                <Select
                  required
                  value={draft.scope || "organization"}
                  onChange={(event) => setDraft({ ...draft, scope: event.target.value })}
                >
                  <option value="organization">조직</option>
                  <option value="workspace">작업공간</option>
                </Select>
              </Field>
              <fieldset>
                <legend>권한</legend>
                {related.map((permission) => (
                  <label key={String(permission.key)}>
                    <input
                      type="checkbox"
                      disabled={permission.available === false}
                      checked={permissionKeys.includes(String(permission.key))}
                      onChange={(event) =>
                        setPermissionKeys(
                          event.target.checked
                            ? [...permissionKeys, String(permission.key)]
                            : permissionKeys.filter((key) => key !== String(permission.key)),
                        )
                      }
                    />
                    {String(permission.label ?? permission.key)}
                    {permission.available === false ? " (준비 중)" : ""}
                  </label>
                ))}
              </fieldset>
            </>
          )}
          {dialog === "transfer" && (
            <Field label="새 소유자 사용자 UUID">
              <TextInput
                required
                value={draft.userId ?? ""}
                onChange={(event) => setDraft({ ...draft, userId: event.target.value })}
              />
            </Field>
          )}
          {dialog === "delete" && (
            <Field label={`확인을 위해 ${organization.name} 입력`}>
              <TextInput
                value={draft.confirmation}
                onChange={(event) => setDraft({ ...draft, confirmation: event.target.value })}
              />
            </Field>
          )}
          <Button type="submit" variant="primary" busy={busy} disabled={busy}>
            확인
          </Button>
          <p role="status">{message}</p>
        </form>
      </Dialog>
    </>
  );
}
