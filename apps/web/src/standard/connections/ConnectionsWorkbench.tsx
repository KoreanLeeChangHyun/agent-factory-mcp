import { useEffect, useState } from "react";
import { StateView, WorkbenchPanel, WorkbenchSidebar } from "@agent-factory/design-system";
import {
  providerClient,
  type MCPConnection,
  type MCPInstructions,
  type DriveSource,
  type ProviderInspection,
  type Provider,
  type ProviderConnection,
} from "./provider-client.js";

export function ConnectionsWorkbench({ organizationId, workspaceId }: { organizationId: string; workspaceId: string }) {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [connections, setConnections] = useState<ProviderConnection[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [token, setToken] = useState("");
  const [saving, setSaving] = useState(false);
  const preferenceKey = `agent-factory:mcp-connection:v1:${organizationId}:${workspaceId}`;
  const [mcpConnections, setMcpConnections] = useState<MCPConnection[]>([]);
  const [selectedMcp, setSelectedMcp] = useState<string | null>(() => localStorage.getItem(preferenceKey));
  const [mcpName, setMcpName] = useState("");
  const [instructions, setInstructions] = useState<MCPInstructions | null>(null);
  const [inspection, setInspection] = useState<ProviderInspection | null>(null);
  const [driveFolder, setDriveFolder] = useState("root");
  const [driveSources, setDriveSources] = useState<DriveSource[]>([]);
  const [collectionName, setCollectionName] = useState("");
  useEffect(() => {
    const request = new AbortController();
    Promise.all([
      providerClient.catalog(organizationId, workspaceId, request.signal),
      providerClient.connections(organizationId, workspaceId, request.signal),
      providerClient.mcpConnections(organizationId, workspaceId, request.signal),
    ])
      .then(([catalog, rows, mcpStatus]) => {
        const mcpRows = mcpStatus.connections;
        setProviders(catalog);
        setConnections(rows);
        setSelected(rows[0]?.id ?? null);
        setMcpConnections(mcpRows);
        setSelectedMcp((current) => (mcpRows.some((row) => row.id === current && row.retrievable) ? current : null));
      })
      .catch((value: Error) => {
        if (value.name !== "AbortError") setError(value.message);
      });
    return () => request.abort();
  }, [organizationId, workspaceId]);
  const record = connections.find((row) => row.id === selected);
  const provider = providers.find((row) => row.id === record?.provider_id);
  const mcpRecord = mcpConnections.find((row) => row.id === selectedMcp) ?? null;
  useEffect(() => {
    if (selectedMcp) localStorage.setItem(preferenceKey, selectedMcp);
    else localStorage.removeItem(preferenceKey);
    setInstructions(null);
  }, [preferenceKey, selectedMcp]);
  const saveToken = async () => {
    if (!record || !token) return;
    setSaving(true);
    setError("");
    try {
      await providerClient.setToken(organizationId, workspaceId, record.id, token);
      setToken("");
      setConnections((rows) =>
        rows.map((row) => (row.id === record.id ? { ...row, status: "active", credentials_present: true } : row)),
      );
    } catch (value) {
      setError(value instanceof Error ? value.message : "인증 정보를 저장할 수 없습니다.");
    } finally {
      setSaving(false);
    }
  };
  const beginOAuth = async () => {
    if (!record || !provider) return;
    setSaving(true);
    setError("");
    try {
      const result = await providerClient.beginOAuth(
        organizationId,
        workspaceId,
        record.id,
        provider.key === "onedrive"
          ? ["Files.Read", "offline_access"]
          : provider.key === "google-drive"
            ? ["https://www.googleapis.com/auth/drive.readonly"]
            : provider.key === "gmail"
              ? ["https://www.googleapis.com/auth/gmail.readonly"]
              : [],
      );
      window.location.assign(result.authorization_url);
    } catch (value) {
      setError(value instanceof Error ? value.message : "OAuth 연결을 시작할 수 없습니다.");
      setSaving(false);
    }
  };
  const issueMcp = async () => {
    if (!mcpName.trim()) return;
    setSaving(true);
    setError("");
    try {
      const result = await providerClient.issueMcp(organizationId, workspaceId, mcpName);
      setMcpConnections((rows) => [result.connection, ...rows]);
      setSelectedMcp(result.connection.id);
      setMcpName("");
    } catch (value) {
      setError(value instanceof Error ? value.message : "MCP 연결을 발급할 수 없습니다.");
    } finally {
      setSaving(false);
    }
  };
  const inspectProvider = async () => {
    if (!record) return;
    try {
      setInspection(await providerClient.inspect(organizationId, workspaceId, record.id, true));
    } catch (value) {
      setError(value instanceof Error ? value.message : "연결을 점검할 수 없습니다.");
    }
  };
  const browseDrive = async () => {
    if (!record || !driveFolder.trim()) return;
    try {
      setDriveSources((await providerClient.driveSources(organizationId, workspaceId, record.id, driveFolder)).items);
    } catch (value) {
      setError(value instanceof Error ? value.message : "Drive 항목을 불러올 수 없습니다.");
    }
  };
  const createReference = async () => {
    if (!record || !collectionName.trim() || !driveFolder.trim()) return;
    try {
      await providerClient.createReferenceCollection(
        organizationId,
        workspaceId,
        record.id,
        collectionName,
        driveFolder,
      );
      setMessage("Google Drive 참조 컬렉션을 만들었습니다.");
      setCollectionName("");
    } catch (value) {
      setError(value instanceof Error ? value.message : "컬렉션을 만들 수 없습니다.");
    }
  };
  const loadInstructions = async () => {
    if (!mcpRecord) return;
    try {
      setInstructions(await providerClient.mcpInstructions(organizationId, workspaceId, mcpRecord.id));
    } catch (value) {
      setError(value instanceof Error ? value.message : "지침을 만들 수 없습니다.");
    }
  };
  const copyInstructions = async () => {
    if (!instructions) await loadInstructions();
    const current =
      instructions ??
      (mcpRecord ? await providerClient.mcpInstructions(organizationId, workspaceId, mcpRecord.id) : null);
    if (!current) return;
    try {
      await navigator.clipboard.writeText(current.instructions);
      setMessage("AI 지침을 복사했습니다.");
    } catch {
      setInstructions(current);
      setMessage("자동 복사에 실패했습니다. 아래 지침을 직접 복사하세요.");
    }
  };
  const downloadConfiguration = async () => {
    if (!mcpRecord) return;
    setSaving(true);
    try {
      const description =
        instructions ?? (await providerClient.mcpInstructions(organizationId, workspaceId, mcpRecord.id));
      setInstructions(description);
      const blob = await providerClient.mcpConfiguration(organizationId, workspaceId, mcpRecord.id);
      const href = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = href;
      link.download = description.filename;
      link.click();
      URL.revokeObjectURL(href);
      setMessage("설정 ZIP 다운로드를 시작했습니다.");
    } catch (value) {
      setError(value instanceof Error ? value.message : "설정 ZIP을 만들 수 없습니다.");
    } finally {
      setSaving(false);
    }
  };
  const removeMcp = async (purge: boolean) => {
    if (!mcpRecord) return;
    try {
      await providerClient[purge ? "purgeMcp" : "revokeMcp"](organizationId, workspaceId, mcpRecord.id);
      setMcpConnections((rows) =>
        purge
          ? rows.filter((row) => row.id !== mcpRecord.id)
          : rows.map((row) =>
              row.id === mcpRecord.id
                ? { ...row, retrievable: false, reason: "revoked", state: "reauth_required" }
                : row,
            ),
      );
      setSelectedMcp(null);
    } catch (value) {
      setError(value instanceof Error ? value.message : "MCP 연결을 변경할 수 없습니다.");
    }
  };
  return (
    <div className="af-standard-split">
      <WorkbenchSidebar>
        <h2>연동</h2>
        <strong>공급자 연결</strong>
        {connections.map((row) => (
          <button
            key={row.id}
            className="af-native-link"
            aria-current={row.id === selected}
            onClick={() => setSelected(row.id)}
          >
            {row.name}
            <small>{row.status}</small>
          </button>
        ))}
        <strong>MCP 연결 토큰</strong>
        {mcpConnections.map((row) => (
          <button
            key={row.id}
            type="button"
            className="af-native-link"
            aria-current={row.id === selectedMcp}
            onClick={() => row.retrievable && setSelectedMcp(row.id)}
            disabled={!row.retrievable}
          >
            {row.name}
            <small>
              {row.state}
              {row.reason ? ` · ${row.reason}` : ""}
            </small>
          </button>
        ))}
      </WorkbenchSidebar>
      <WorkbenchPanel>
        <h2>{record?.name ?? "연동"}</h2>
        {error ? (
          <>
            <StateView state="error" />
            <p role="alert">{error}</p>
          </>
        ) : (
          <>
            {record ? (
              <>
                <dl className="af-metadata-grid">
                  <div>
                    <dt>공급자</dt>
                    <dd>{provider?.display_name ?? "—"}</dd>
                  </div>
                  <div>
                    <dt>상태</dt>
                    <dd>{record.status}</dd>
                  </div>
                  <div>
                    <dt>인증 정보</dt>
                    <dd>{record.credentials_present ? "서버에 암호화됨" : "설정 필요"}</dd>
                  </div>
                  <div>
                    <dt>최근 오류</dt>
                    <dd>{record.last_error_code ?? "없음"}</dd>
                  </div>
                </dl>
                {provider?.auth_type === "api_key" ? (
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      void saveToken();
                    }}
                  >
                    <label htmlFor="provider-token">API 토큰</label>
                    <input
                      id="provider-token"
                      type="password"
                      autoComplete="off"
                      value={token}
                      onChange={(event) => setToken(event.target.value)}
                    />
                    <button type="submit" disabled={!token || saving}>
                      안전하게 저장
                    </button>
                  </form>
                ) : provider?.auth_type === "oauth2" ? (
                  <button type="button" disabled={saving} onClick={() => void beginOAuth()}>
                    OAuth로 연결
                  </button>
                ) : null}
                <section aria-label="공급자 점검">
                  <h3>연결 점검</h3>
                  <button type="button" onClick={() => void inspectProvider()}>
                    실시간 점검
                  </button>
                  {inspection && (
                    <dl className="af-metadata-grid">
                      <div>
                        <dt>상태</dt>
                        <dd>
                          {inspection.health}
                          {inspection.stale ? " · 오래됨" : ""}
                        </dd>
                      </div>
                      <div>
                        <dt>계정</dt>
                        <dd>{inspection.account_id ?? "확인되지 않음"}</dd>
                      </div>
                      <div>
                        <dt>요청 범위</dt>
                        <dd>{inspection.requested_scopes.join(", ") || "없음"}</dd>
                      </div>
                      <div>
                        <dt>관측 범위</dt>
                        <dd>{inspection.granted_scopes?.join(", ") ?? "확인 불가"}</dd>
                      </div>
                    </dl>
                  )}
                </section>
                {provider?.key === "google-drive" && (
                  <section aria-label="Google Drive 참조 컬렉션">
                    <h3>Drive 참조 컬렉션</h3>
                    <label htmlFor="drive-folder">폴더 ID</label>
                    <input
                      id="drive-folder"
                      value={driveFolder}
                      onChange={(event) => setDriveFolder(event.target.value)}
                    />
                    <button type="button" onClick={() => void browseDrive()}>
                      폴더 둘러보기
                    </button>
                    {driveSources.length ? (
                      <ul>
                        {driveSources.map((source) => (
                          <li key={source.source_id}>
                            <button type="button" onClick={() => setDriveFolder(source.source_id)}>
                              {source.name}
                            </button>
                            <small>{source.mime_type}</small>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p>표시할 Drive 항목이 없습니다.</p>
                    )}
                    <label htmlFor="collection-name">컬렉션 이름</label>
                    <input
                      id="collection-name"
                      value={collectionName}
                      onChange={(event) => setCollectionName(event.target.value)}
                    />
                    <button type="button" disabled={!collectionName.trim()} onClick={() => void createReference()}>
                      현재 폴더로 참조 컬렉션 만들기
                    </button>
                  </section>
                )}
              </>
            ) : (
              <p>공급자 연결이 없습니다.</p>
            )}
            <hr />
            <section aria-label="MCP 연결 설정">
              <h3>MCP 연결 설정</h3>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void issueMcp();
                }}
              >
                <label htmlFor="mcp-name">새 토큰 이름</label>
                <input
                  id="mcp-name"
                  value={mcpName}
                  maxLength={120}
                  onChange={(event) => setMcpName(event.target.value)}
                />
                <button type="submit" disabled={!mcpName.trim() || saving}>
                  새 토큰 발급
                </button>
              </form>
              {!mcpConnections.length ? (
                <p>발급한 MCP 연결 토큰이 없습니다.</p>
              ) : !mcpRecord ? (
                <p>
                  다운로드할 유효한 토큰을 명시적으로 선택하세요. 만료·폐기·기존 해시 전용 토큰은 사용할 수 없습니다.
                </p>
              ) : (
                <>
                  <dl className="af-metadata-grid">
                    <div>
                      <dt>선택 토큰</dt>
                      <dd>{mcpRecord.name}</dd>
                    </div>
                    <div>
                      <dt>상태</dt>
                      <dd>{mcpRecord.state}</dd>
                    </div>
                    <div>
                      <dt>만료</dt>
                      <dd>{mcpRecord.expires_at ?? "없음"}</dd>
                    </div>
                    <div>
                      <dt>관측 클라이언트</dt>
                      <dd>{mcpRecord.client_name ?? "아직 확인되지 않음"}</dd>
                    </div>
                  </dl>
                  <button type="button" disabled={saving} onClick={() => void downloadConfiguration()}>
                    13개 클라이언트 설정 ZIP 다운로드
                  </button>
                  <button type="button" onClick={() => void copyInstructions()}>
                    AI 지침 복사
                  </button>
                  <button type="button" onClick={() => void removeMcp(false)}>
                    토큰 폐기
                  </button>
                </>
              )}
              {mcpConnections
                .filter((row) => row.reason === "revoked")
                .map((row) => (
                  <button
                    key={`purge-${row.id}`}
                    type="button"
                    onClick={() => {
                      setSelectedMcp(row.id);
                      void providerClient
                        .purgeMcp(organizationId, workspaceId, row.id)
                        .then(() => setMcpConnections((items) => items.filter((item) => item.id !== row.id)));
                    }}
                  >
                    폐기 기록 영구 삭제: {row.name}
                  </button>
                ))}
              {instructions && <pre>{instructions.instructions}</pre>}
            </section>
            <p role="status">{message}</p>
          </>
        )}
      </WorkbenchPanel>
    </div>
  );
}
