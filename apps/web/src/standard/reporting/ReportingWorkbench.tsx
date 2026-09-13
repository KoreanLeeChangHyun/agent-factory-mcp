import { useEffect, useMemo, useState } from "react";
import { StateView, WorkbenchPanel, WorkbenchSidebar } from "@agent-factory/design-system";
import { reportingClient, type ReportingDetail, type ReportingSnapshot } from "./reporting-client.js";

const GROUPS = [
  ["대기", ["pending"]],
  ["진행 중 · 입력 필요", ["in_progress", "input_required"]],
  ["최근 종료", ["completed", "failed", "cancelled"]],
] as const;

export function ReportingWorkbench({ organizationId, workspaceId }: { organizationId: string; workspaceId: string }) {
  const [snapshot, setSnapshot] = useState<ReportingSnapshot | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ReportingDetail | null>(null);
  const [snapshotError, setSnapshotError] = useState("");
  const [detailError, setDetailError] = useState("");
  const [detailLoading, setDetailLoading] = useState(false);
  useEffect(() => {
    let active = true;
    const request = new AbortController();
    const refresh = () =>
      reportingClient
        .snapshot(organizationId, workspaceId, request.signal)
        .then((value) => {
          if (!active) return;
          setSnapshot(value);
          setSnapshotError("");
          setSelectedId((id) => (value.tasks.some((row) => row.id === id) ? id : (value.tasks[0]?.id ?? null)));
        })
        .catch((value: Error) => {
          if (active && value.name !== "AbortError") setSnapshotError(value.message);
        });
    void refresh();
    const timer = window.setInterval(refresh, 15_000);
    return () => {
      active = false;
      request.abort();
      window.clearInterval(timer);
    };
  }, [organizationId, workspaceId]);
  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    const request = new AbortController();
    setDetailLoading(true);
    setDetailError("");
    reportingClient
      .detail(organizationId, workspaceId, selectedId, request.signal)
      .then(setDetail)
      .catch((value: Error) => {
        if (value.name !== "AbortError") setDetailError(value.message);
      })
      .finally(() => setDetailLoading(false));
    return () => request.abort();
  }, [organizationId, workspaceId, selectedId]);
  const selected = useMemo(() => snapshot?.tasks.find((row) => row.id === selectedId) ?? null, [snapshot, selectedId]);
  const selectedAgent = useMemo(
    () => snapshot?.agents.find((row) => row.id === (selectedAgentId ?? selected?.agent_id)) ?? null,
    [snapshot, selectedAgentId, selected],
  );
  const agentDepth = (id: string) => {
    let depth = 0;
    let current = snapshot?.agents.find((row) => row.id === id);
    const seen = new Set<string>();
    while (current?.parent_id && !seen.has(current.parent_id) && depth < 64) {
      seen.add(current.parent_id);
      depth += 1;
      current = snapshot?.agents.find((row) => row.id === current?.parent_id);
    }
    return depth;
  };
  const stale =
    selected?.last_report_at && snapshot
      ? Date.parse(snapshot.server_time) - Date.parse(selected.last_report_at) > snapshot.stale_after_seconds * 1000
      : false;
  const loadOlder = async () => {
    if (!selectedId || detail?.next_before_revision === null || detail?.next_before_revision === undefined) return;
    setDetailLoading(true);
    try {
      const older = await reportingClient.detail(
        organizationId,
        workspaceId,
        selectedId,
        undefined,
        detail.next_before_revision,
      );
      setDetail({
        ...older,
        reports: [...detail.reports, ...older.reports],
        results: [...detail.results, ...older.results],
      });
    } catch (value) {
      setDetailError(value instanceof Error ? value.message : "이전 보고를 불러오지 못했습니다.");
    } finally {
      setDetailLoading(false);
    }
  };
  return (
    <div className="af-standard-split">
      <WorkbenchSidebar>
        <h2>에이전트 Activity</h2>
        <strong>에이전트 계층</strong>
        {snapshot?.agents.map((agent) => (
          <button
            key={agent.id}
            type="button"
            className="af-native-link"
            aria-current={agent.id === selectedAgent?.id}
            style={{ paddingInlineStart: `${agentDepth(agent.id) + 1}rem` }}
            onClick={() => setSelectedAgentId(agent.id)}
          >
            {agent.name}
            <small>{agent.role}</small>
          </button>
        ))}
        {GROUPS.map(([label, statuses]) => (
          <section key={label} aria-label={label}>
            <strong>{label}</strong>
            {snapshot?.tasks
              .filter((task) => (statuses as readonly string[]).includes(task.status))
              .map((task) => (
                <button
                  className="af-native-link"
                  type="button"
                  key={task.id}
                  aria-current={task.id === selectedId}
                  onClick={() => {
                    setSelectedId(task.id);
                    setSelectedAgentId(task.agent_id);
                  }}
                >
                  {task.name}
                  <small>
                    {task.status}
                    {task.progress === null ? "" : ` · ${task.progress}%`}
                  </small>
                </button>
              ))}
          </section>
        ))}
      </WorkbenchSidebar>
      <WorkbenchPanel>
        <h2>{selected?.name ?? selectedAgent?.name ?? "에이전트 Activity"}</h2>
        {snapshotError && !snapshot ? (
          <>
            <StateView state="error" />
            <p role="alert">{snapshotError}</p>
          </>
        ) : !snapshot ? (
          <StateView state="loading" />
        ) : !snapshot.agents.length && !snapshot.tasks.length ? (
          <StateView state="empty" />
        ) : (
          <>
            {snapshotError && (
              <p role="status">새로고침에 실패했습니다. 마지막 수신 자료를 표시합니다: {snapshotError}</p>
            )}
            {selectedAgent && (
              <section aria-label="에이전트 구성">
                <h3>{selectedAgent.name}</h3>
                <dl className="af-metadata-grid">
                  <div>
                    <dt>역할</dt>
                    <dd>{selectedAgent.role}</dd>
                  </div>
                  <div>
                    <dt>책임</dt>
                    <dd>{selectedAgent.responsibilities || "보고되지 않음"}</dd>
                  </div>
                  <div>
                    <dt>범위</dt>
                    <dd>현재 작업공간</dd>
                  </div>
                  <div>
                    <dt>보고 소유자</dt>
                    <dd>
                      <code>{selectedAgent.owner_user_id}</code>
                    </dd>
                  </div>
                  <div>
                    <dt>최근 보고</dt>
                    <dd>{selectedAgent.last_report_at ?? "보고 없음"}</dd>
                  </div>
                </dl>
              </section>
            )}
            {!selected ? (
              <p>에이전트의 작업을 선택하면 보고 이력과 증거를 확인할 수 있습니다.</p>
            ) : detailLoading ? (
              <StateView state="loading" />
            ) : detailError ? (
              <>
                <StateView state="error" />
                <p role="alert">{detailError}</p>
              </>
            ) : detail ? (
              <section aria-label="작업 상세">
                <dl className="af-metadata-grid">
                  <div>
                    <dt>보고 상태</dt>
                    <dd>
                      {detail.task.status}
                      {stale ? " · 보고 오래됨" : ""}
                    </dd>
                  </div>
                  <div>
                    <dt>진행률</dt>
                    <dd>{detail.task.progress === null ? "보고되지 않음" : `${detail.task.progress}%`}</dd>
                  </div>
                  <div>
                    <dt>시작</dt>
                    <dd>{detail.task.started_at ?? "보고되지 않음"}</dd>
                  </div>
                  <div>
                    <dt>종료</dt>
                    <dd>{detail.task.finished_at ?? "보고되지 않음"}</dd>
                  </div>
                  <div>
                    <dt>런타임 관측</dt>
                    <dd>
                      {detail.task.runtime_observation
                        ? `${detail.task.runtime_observation.fact} · ${detail.task.runtime_observation.observed_at}`
                        : "관측 없음"}
                    </dd>
                  </div>
                </dl>
                <h3>보고 이력</h3>
                {detail.reports.length ? (
                  <ol>
                    {detail.reports.map((report) => (
                      <li key={report.id}>
                        <time>{report.received_at}</time> · {report.status}
                        {report.progress === null ? "" : ` · ${report.progress}%`}
                        <p>{report.message}</p>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p>보고 이력이 없습니다.</p>
                )}
                <h3>결과와 증거</h3>
                {detail.results.length ? (
                  <ul>
                    {detail.results.map((result) => (
                      <li key={result.id}>
                        {result.document_id ? (
                          <a href={`/documents/${result.document_id}`}>{result.label}</a>
                        ) : result.url ? (
                          <a href={result.url} rel="noreferrer" target="_blank">
                            {result.label}
                          </a>
                        ) : (
                          result.label
                        )}
                        <p>{result.summary}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>보고된 결과가 없습니다.</p>
                )}
                {detail.next_before_revision !== null && (
                  <button type="button" onClick={() => void loadOlder()}>
                    이전 보고 50개 불러오기
                  </button>
                )}
              </section>
            ) : null}
            {snapshot.truncated && <p role="status">구성 또는 최근 작업이 1,000개를 넘어 일부만 표시합니다.</p>}
          </>
        )}
      </WorkbenchPanel>
    </div>
  );
}
