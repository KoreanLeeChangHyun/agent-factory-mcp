import { useEffect, useRef, useState } from "react";
import { Button, Dialog, Field, StateView, TextInput } from "@agent-factory/design-system";
import { apiPath } from "../../api-path.js";
import { mcpConnectionClient, type ConnectionRecord } from "./mcp-connection-client.js";

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

export function WorkspaceConnections({
  userId,
  organizationId,
  workspace,
}: {
  userId: string;
  organizationId: string;
  workspace: { id: string; name: string };
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
    void mcpConnectionClient
      .connections(organizationId, workspace.id)
      .then((value) => {
        if (current !== generation.current) return;
        const rows = value.connections;
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
        const value = await mcpConnectionClient.connections(organizationId, workspace.id);
        if (current !== generation.current) return;
        const rows = value.connections;
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
      await mcpConnectionClient.revokeConnection(organizationId, workspace.id, connection.id, purge);
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
      const secret = await mcpConnectionClient.revealConnection(organizationId, workspace.id, selected.id);
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
            void mcpConnectionClient
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
