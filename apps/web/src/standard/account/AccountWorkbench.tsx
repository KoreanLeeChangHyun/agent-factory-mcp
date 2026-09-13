import type { SessionUser } from "./account-types.js";
import type { OrganizationSummary } from "../organization/index.js";
import { workspaceClient } from "../workspace/index.js";
import { accountClient } from "./account-client.js";
import { useEffect, useState } from "react";
import { Button, StateView, WorkbenchPanel, WorkbenchSidebar } from "@agent-factory/design-system";
import { ThemeSettingsPanel } from "../../ThemeBootstrap.js";
import { legacyWorkspacePath } from "../../api-path.js";

type View = "profile" | "security" | "appearance";
export function AccountWorkbench({
  user,
  organization,
  workspaceId,
}: {
  user: SessionUser;
  organization: OrganizationSummary | null;
  workspaceId: string | null;
}) {
  const [view, setView] = useState<View>("profile");
  const [workspaceName, setWorkspaceName] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    setWorkspaceName(null);
    if (organization && workspaceId) {
      void workspaceClient.workspaces(organization.id, controller.signal).then((rows) => {
        if (!controller.signal.aborted) setWorkspaceName(rows.find((row) => row.id === workspaceId)?.name ?? null);
      });
    }
    return () => controller.abort();
  }, [organization, workspaceId]);
  return (
    <>
      <WorkbenchSidebar>
        <header className="af-native-header">
          <b>계정</b>
        </header>
        <nav className="af-native-subnav" aria-label="계정 설정">
          <button aria-current={view === "profile" ? "page" : undefined} onClick={() => setView("profile")}>
            프로필
          </button>
          <button aria-current={view === "security" ? "page" : undefined} onClick={() => setView("security")}>
            보안
          </button>
          <button aria-current={view === "appearance" ? "page" : undefined} onClick={() => setView("appearance")}>
            테마
          </button>
        </nav>
      </WorkbenchSidebar>
      <WorkbenchPanel>
        <header className="af-native-panel-header">
          <h1>계정 설정</h1>
        </header>
        <div className="af-native-panel-body">
          {view === "profile" && (
            <>
              <dl className="af-native-summary">
                <div>
                  <dt>이름</dt>
                  <dd>{user.display_name}</dd>
                </div>
                <div>
                  <dt>이메일</dt>
                  <dd>{user.email}</dd>
                </div>
                <div>
                  <dt>플랫폼 관리자</dt>
                  <dd>{user.is_platform_admin ? "예" : "아니요"}</dd>
                </div>
                <div>
                  <dt>현재 조직</dt>
                  <dd>{organization?.name ?? "선택 안 함"}</dd>
                </div>
                <div>
                  <dt>현재 작업공간</dt>
                  <dd>{workspaceName ?? "선택 안 함"}</dd>
                </div>
              </dl>
              <Button
                variant="primary"
                onClick={() => void accountClient.logout().then(() => window.location.assign(legacyWorkspacePath()))}
              >
                로그아웃
              </Button>
            </>
          )}
          {view === "security" && <Security />}
          {view === "appearance" && <ThemeSettingsPanel />}
        </div>
      </WorkbenchPanel>
    </>
  );
}

function Security() {
  const [sessions, setSessions] = useState<Record<string, unknown>[]>([]);
  const [tokens, setTokens] = useState<Record<string, unknown>[]>([]);
  const [error, setError] = useState("");
  const refresh = () => {
    const controller = new AbortController();
    void Promise.all([accountClient.sessions(controller.signal), accountClient.tokens(controller.signal)])
      .then(([nextSessions, nextTokens]) => {
        setSessions(nextSessions.filter((session) => session.revoked_at == null));
        setTokens(nextTokens.filter((token) => token.revoked_at == null));
        setError("");
      })
      .catch((reason: Error) => setError(reason.message));
    return () => controller.abort();
  };
  useEffect(refresh, []);
  return (
    <section className="af-native-section">
      <h2>로그인 세션</h2>
      {error && <p role="alert">{error}</p>}
      {sessions.length ? (
        sessions.map((session) => (
          <article className="af-native-row" key={String(session.id)}>
            <span>
              {String(session.user_agent ?? "알 수 없는 클라이언트")} · {String(session.expires_at)}
            </span>
            <Button onClick={() => void accountClient.revokeSession(String(session.id)).then(refresh)}>
              세션 해제
            </Button>
          </article>
        ))
      ) : (
        <StateView state="empty" />
      )}
      <h2>내 API 토큰</h2>
      {tokens.length ? (
        tokens.map((token) => (
          <article className="af-native-row" key={String(token.id)}>
            <span>
              {String(token.name)} · {String(token.expires_at ?? "만료 없음")}
            </span>
            <Button onClick={() => void accountClient.revokeToken(String(token.id)).then(refresh)}>폐기</Button>
          </article>
        ))
      ) : (
        <StateView state="empty" />
      )}
    </section>
  );
}
