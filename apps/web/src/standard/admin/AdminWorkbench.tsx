import { adminClient } from "./admin-client.js";
import { useEffect, useRef, useState } from "react";
import {
  Button,
  DataTable,
  Dialog,
  Field,
  StateView,
  TextInput,
  WorkbenchPanel,
  WorkbenchSidebar,
  type DataTableColumn,
} from "@agent-factory/design-system";
import { apiPath } from "../../api-path.js";

type View = "dashboard" | "users" | "resources" | "jobs" | "integrations" | "audit" | "flags" | "runtime" | "assets";
type AdminTableRow = { id: string; title: string; status: string; source: Record<string, unknown> };
type AdminMutationStatus = {
  id: number;
  view: View;
  state: "pending" | "error";
  message: string;
};
const navigation: { id: View; label: string }[] = [
  { id: "dashboard", label: "대시보드" },
  { id: "users", label: "사용자" },
  { id: "resources", label: "조직 및 작업공간" },
  { id: "jobs", label: "Jobs" },
  { id: "integrations", label: "연동 상태" },
  { id: "audit", label: "감사" },
  { id: "flags", label: "기능 플래그" },
  { id: "runtime", label: "런타임" },
  { id: "assets", label: "공통 에셋" },
];
const endpoint: Record<Exclude<View, "resources" | "assets">, string> = {
  dashboard: "dashboard",
  users: "users",
  jobs: "jobs",
  integrations: "integrations",
  audit: "audit",
  flags: "feature-flags",
  runtime: "runtime",
};
export function AdminWorkbench() {
  const [view, setView] = useState<View>("dashboard");
  return (
    <>
      <WorkbenchSidebar>
        <header className="af-native-header">
          <b>플랫폼 관리</b>
        </header>
        <nav className="af-native-subnav" aria-label="플랫폼 관리">
          {navigation.map((item) => (
            <button key={item.id} aria-current={view === item.id ? "page" : undefined} onClick={() => setView(item.id)}>
              {item.label}
            </button>
          ))}
        </nav>
      </WorkbenchSidebar>
      <WorkbenchPanel>
        <header className="af-native-panel-header">
          <h1>{navigation.find((item) => item.id === view)?.label}</h1>
        </header>
        <div className="af-native-panel-body">
          <AdminView view={view} />
        </div>
      </WorkbenchPanel>
    </>
  );
}

function AdminView({ view }: { view: View }) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [secondary, setSecondary] = useState<Record<string, unknown>[]>([]);
  const [single, setSingle] = useState<Record<string, unknown> | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error" | "permission-denied">("loading");
  const [message, setMessage] = useState("");
  const [ownerOpen, setOwnerOpen] = useState(false);
  const [owner, setOwner] = useState({ scope: "organization", resource_id: "", user_id: "" });
  const [flag, setFlag] = useState<Record<string, unknown> | null>(null);
  const [flagDraft, setFlagDraft] = useState({ description: "", rules: "{}", is_enabled: false });
  const [confirmation, setConfirmation] = useState<{ title: string; action: () => void } | null>(null);
  const [mutationStatus, setMutationStatus] = useState<AdminMutationStatus | null>(null);
  const generation = useRef(0);
  const mutationSequence = useRef(0);
  const viewRef = useRef(view);
  viewRef.current = view;
  const load = () => {
    if (view === "assets") {
      setState("ready");
      return;
    }
    const current = ++generation.current;
    const controller = new AbortController();
    setState("loading");
    setRows([]);
    setSingle(null);
    const request =
      view === "resources"
        ? Promise.all([
            adminClient.admin<Record<string, unknown>[]>("organizations", controller.signal),
            adminClient.admin<Record<string, unknown>[]>("workspaces", controller.signal),
          ])
        : adminClient.admin<Record<string, unknown>[] | Record<string, unknown>>(
            endpoint[view as Exclude<View, "resources" | "assets">],
            controller.signal,
          );
    void request
      .then((value) => {
        if (current !== generation.current) return;
        if (Array.isArray(value)) {
          if (view === "resources" && Array.isArray(value[0])) {
            setRows(value[0]);
            setSecondary(value[1] as Record<string, unknown>[]);
          } else setRows(value as Record<string, unknown>[]);
        } else setSingle(value as Record<string, unknown>);
        setState("ready");
      })
      .catch((error: { status?: number; message?: string }) => {
        if (!controller.signal.aborted) {
          setMessage(error.message ?? "관리 데이터를 불러오지 못했습니다.");
          setState(error.status === 403 ? "permission-denied" : "error");
        }
      });
    return () => controller.abort();
  };
  useEffect(load, [view]);
  const mutate = async (suffix: string, method: string, body?: unknown) => {
    const mutationView = view;
    const mutationGeneration = generation.current;
    const mutationId = ++mutationSequence.current;
    setMutationStatus({
      id: mutationId,
      view: mutationView,
      state: "pending",
      message: "관리 작업을 처리하는 중입니다.",
    });
    try {
      await adminClient.mutateAdmin(suffix, method, body);
      setMutationStatus((current) => (current?.id === mutationId ? null : current));
      if (viewRef.current === mutationView && generation.current === mutationGeneration) load();
    } catch (error) {
      if (viewRef.current === mutationView && generation.current === mutationGeneration) {
        const errorMessage = error instanceof Error ? error.message : "관리 작업을 완료하지 못했습니다.";
        setMutationStatus((current) =>
          current?.id === mutationId
            ? { id: mutationId, view: mutationView, state: "error", message: errorMessage }
            : current,
        );
      } else setMutationStatus((current) => (current?.id === mutationId ? null : current));
    }
  };
  const tableRows: AdminTableRow[] = rows.map((row) => ({
    id: String(row.id ?? row.key),
    title: String(row.display_name ?? row.name ?? row.key ?? row.action ?? row.task_type ?? row.id),
    status: String(row.status ?? row.outcome ?? row.is_enabled ?? "—"),
    source: row,
  }));
  const columns: DataTableColumn<AdminTableRow>[] = [
    { id: "title", label: "이름" },
    { id: "status", label: "상태" },
    {
      id: "source",
      label: "작업",
      render: (_value, item) => {
        const row = item.source;
        if (view === "users")
          return (
            <>
              <Button
                disabled={Boolean(row.is_platform_admin)}
                onClick={() =>
                  row.status === "suspended"
                    ? void mutate(`users/${row.id}/status`, "PUT", { status: "active" })
                    : setConfirmation({
                        title: "사용자를 정지하시겠습니까?",
                        action: () => void mutate(`users/${row.id}/status`, "PUT", { status: "suspended" }),
                      })
                }
              >
                {row.status === "suspended" ? "복원" : "정지"}
              </Button>
              <Button
                onClick={() =>
                  setConfirmation({
                    title: "사용자의 모든 세션을 해제하시겠습니까?",
                    action: () => void mutate(`users/${row.id}/revoke-sessions`, "POST"),
                  })
                }
              >
                세션 해제
              </Button>
            </>
          );
        if (view === "jobs")
          return (
            <>
              <Button
                disabled={["succeeded", "failed", "cancelled"].includes(String(row.status))}
                onClick={() =>
                  setConfirmation({
                    title: "Job 실행을 취소하시겠습니까?",
                    action: () => void mutate(`jobs/${row.id}/cancel`, "POST"),
                  })
                }
              >
                취소
              </Button>
              <Button disabled={row.status !== "failed"} onClick={() => void mutate(`jobs/${row.id}/retry`, "POST")}>
                재시도
              </Button>
            </>
          );
        if (view === "integrations")
          return (
            <Button
              onClick={() => {
                setConfirmation({
                  title: "이 연동을 해제하시겠습니까?",
                  action: () => void mutate(`integrations/${row.id}`, "DELETE"),
                });
              }}
            >
              연동 해제
            </Button>
          );
        if (view === "flags")
          return (
            <Button
              onClick={() => {
                setFlag(row);
                setFlagDraft({
                  description: String(row.description ?? ""),
                  rules: JSON.stringify(row.rules ?? {}, null, 2),
                  is_enabled: Boolean(row.is_enabled),
                });
                setMessage("");
              }}
            >
              편집
            </Button>
          );
        return "—";
      },
    },
  ];
  if (state !== "ready")
    return (
      <>
        <StateView state={state} />
        {message && <p role="alert">{message}</p>}
      </>
    );
  if (view === "assets")
    return <iframe className="af-native-assets" title="공통 에셋 카탈로그" src={apiPath("/admin/assets/")} />;
  if (single)
    return (
      <dl className="af-native-summary">
        {Object.entries(single).map(([key, value]) => (
          <div key={key}>
            <dt>{key}</dt>
            <dd>{String(value ?? "—")}</dd>
          </div>
        ))}
      </dl>
    );
  return (
    <>
      <section className="af-native-section">
        {mutationStatus?.view === view && (
          <p role={mutationStatus.state === "pending" ? "status" : "alert"}>{mutationStatus.message}</p>
        )}
        {view === "resources" && <Button onClick={() => setOwnerOpen(true)}>소유자 추가</Button>}
        <DataTable rows={tableRows} columns={columns} caption={navigation.find((item) => item.id === view)?.label} />
        {view === "resources" && (
          <>
            <h2>작업공간</h2>
            <DataTable
              rows={secondary.map((row) => ({
                id: String(row.id),
                title: String(row.name),
                status: String(row.status),
              }))}
              caption="작업공간"
            />
          </>
        )}
      </section>
      <Dialog open={ownerOpen} title="소유자 추가" onClose={() => setOwnerOpen(false)}>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void mutate("ownership", "POST", owner).then(() => setOwnerOpen(false));
          }}
        >
          <Field label="범위">
            <select
              className="af-select"
              value={owner.scope}
              onChange={(event) => setOwner({ ...owner, scope: event.target.value })}
            >
              <option value="organization">조직</option>
              <option value="workspace">작업공간</option>
            </select>
          </Field>
          <Field label="리소스 UUID">
            <TextInput
              required
              value={owner.resource_id}
              onChange={(event) => setOwner({ ...owner, resource_id: event.target.value })}
            />
          </Field>
          <Field label="사용자 UUID">
            <TextInput
              required
              value={owner.user_id}
              onChange={(event) => setOwner({ ...owner, user_id: event.target.value })}
            />
          </Field>
          <Button type="submit" variant="primary">
            추가
          </Button>
        </form>
      </Dialog>
      <Dialog open={flag !== null} title="기능 플래그 편집" onClose={() => setFlag(null)}>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            try {
              const rules = JSON.parse(flagDraft.rules) as unknown;
              if (!rules || Array.isArray(rules) || typeof rules !== "object") {
                throw new Error("롤아웃 규칙은 JSON 객체여야 합니다.");
              }
              void mutate(`feature-flags/${String(flag?.key)}`, "PUT", {
                description: flagDraft.description.trim(),
                rules,
                is_enabled: flagDraft.is_enabled,
              }).then(() => setFlag(null));
            } catch (error) {
              setMessage(error instanceof Error ? error.message : "롤아웃 규칙을 확인해 주세요.");
            }
          }}
        >
          <Field label="설명">
            <TextInput
              required
              value={flagDraft.description}
              onChange={(event) => setFlagDraft({ ...flagDraft, description: event.target.value })}
            />
          </Field>
          <Field label="롤아웃 규칙 (JSON 객체)">
            <textarea
              required
              value={flagDraft.rules}
              onChange={(event) => setFlagDraft({ ...flagDraft, rules: event.target.value })}
            />
          </Field>
          <label>
            <input
              type="checkbox"
              checked={flagDraft.is_enabled}
              onChange={(event) => setFlagDraft({ ...flagDraft, is_enabled: event.target.checked })}
            />
            활성화
          </label>
          <Button type="submit" variant="primary" disabled={!flagDraft.description.trim()}>
            저장
          </Button>
          {message && <p role="alert">{message}</p>}
        </form>
      </Dialog>
      <Dialog open={confirmation !== null} title="관리 작업 확인" onClose={() => setConfirmation(null)}>
        <p>{confirmation?.title}</p>
        <Button onClick={() => setConfirmation(null)}>취소</Button>
        <Button
          variant="primary"
          onClick={() => {
            const action = confirmation?.action;
            setConfirmation(null);
            action?.();
          }}
        >
          확인
        </Button>
      </Dialog>
    </>
  );
}
