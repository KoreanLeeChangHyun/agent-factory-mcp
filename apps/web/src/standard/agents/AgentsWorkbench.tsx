import { useEffect, useMemo, useState } from "react";
import { Button, StateView, WorkbenchPanel, WorkbenchSidebar } from "@agent-factory/design-system";
import { agentClient, type AgentDefinition, type AgentRun, type AgentRunEvidence } from "./agent-client.js";

export function AgentsWorkbench({
  organizationId,
  workspaceId,
  permissions,
}: {
  organizationId: string;
  workspaceId: string;
  permissions: string[];
}) {
  const [agents, setAgents] = useState<AgentDefinition[]>([]);
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [phase, setPhase] = useState<"loading" | "ready" | "empty" | "error">("loading");
  const [message, setMessage] = useState("");
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [evidence, setEvidence] = useState<AgentRunEvidence | null>(null);
  const [evidencePhase, setEvidencePhase] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const selected = useMemo(() => agents.find((row) => row.id === selectedId) ?? null, [agents, selectedId]);
  const load = (signal?: AbortSignal) =>
    Promise.all([
      agentClient.definitions(organizationId, workspaceId, signal),
      agentClient.runs(organizationId, workspaceId, signal),
    ])
      .then(([nextAgents, nextRuns]) => {
        setAgents(nextAgents);
        setRuns(nextRuns);
        setSelectedId((current) =>
          nextAgents.some((row) => row.id === current) ? current : (nextAgents[0]?.id ?? null),
        );
        setPhase(nextAgents.length ? "ready" : "empty");
      })
      .catch((error: Error) => {
        if (error.name !== "AbortError") {
          setMessage(error.message);
          setPhase("error");
        }
      });
  useEffect(() => {
    const request = new AbortController();
    void load(request.signal);
    return () => request.abort();
  }, [organizationId, workspaceId]);
  useEffect(() => {
    if (!selectedRunId) {
      setEvidence(null);
      setEvidencePhase("idle");
      return;
    }
    const request = new AbortController();
    setEvidencePhase("loading");
    agentClient
      .evidence(organizationId, workspaceId, selectedRunId, request.signal)
      .then((value) => {
        setEvidence(value);
        setEvidencePhase("ready");
      })
      .catch((error: Error) => {
        if (error.name !== "AbortError") {
          setMessage(error.message);
          setEvidencePhase("error");
        }
      });
    return () => request.abort();
  }, [organizationId, workspaceId, selectedRunId]);
  const act = async (run: AgentRun, action: "cancel" | "retry") => {
    try {
      const updated = await agentClient[action](organizationId, workspaceId, run.id);
      setRuns((rows) => [updated, ...rows.filter((row) => row.id !== updated.id)]);
      setMessage(action === "cancel" ? "중지 요청을 반영했습니다." : "재시도 실행을 등록했습니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "요청을 완료하지 못했습니다.");
    }
  };
  return (
    <div className="af-standard-split">
      <WorkbenchSidebar>
        <h2>에이전트</h2>
        {agents.map((agent) => (
          <button
            key={agent.id}
            className="af-native-link"
            aria-current={agent.id === selectedId}
            onClick={() => setSelectedId(agent.id)}
          >
            {agent.name}
          </button>
        ))}
      </WorkbenchSidebar>
      <WorkbenchPanel>
        <h2>{selected?.name ?? "에이전트"}</h2>
        {phase !== "ready" ? (
          <>
            <StateView state={phase} />
            <p role="status">{message}</p>
          </>
        ) : (
          <>
            <dl className="af-metadata-grid">
              <div>
                <dt>상태</dt>
                <dd>{selected?.status}</dd>
              </div>
              <div>
                <dt>식별자</dt>
                <dd>{selected?.slug}</dd>
              </div>
              <div>
                <dt>설명</dt>
                <dd>{selected?.description || "—"}</dd>
              </div>
            </dl>
            <section>
              <h3>실행 이력</h3>
              {runs
                .filter((run) => run.definition_id === selectedId)
                .map((run) => (
                  <article key={run.id}>
                    <b>{run.status}</b>
                    <button type="button" className="af-native-link" onClick={() => setSelectedRunId(run.id)}>
                      <code>{run.id}</code>
                    </button>
                    {permissions.includes("agent.stop") && ["queued", "running"].includes(run.status) && (
                      <Button onClick={() => void act(run, "cancel")}>중지</Button>
                    )}
                    {permissions.includes("agent.execute") && ["failed", "cancelled"].includes(run.status) && (
                      <Button onClick={() => void act(run, "retry")}>재시도</Button>
                    )}
                  </article>
                ))}
            </section>
            {selectedRunId && (
              <section aria-label="실행 증거">
                <h3>실행 증거</h3>
                {evidencePhase === "loading" ? (
                  <StateView state="loading" />
                ) : evidencePhase === "error" ? (
                  <>
                    <StateView state="error" />
                    <p role="alert">{message}</p>
                  </>
                ) : evidence ? (
                  <>
                    <dl className="af-metadata-grid">
                      <div>
                        <dt>토큰 사용량</dt>
                        <dd>
                          {evidence.run.input_tokens} 입력 · {evidence.run.output_tokens} 출력
                        </dd>
                      </div>
                      <div>
                        <dt>예상 비용</dt>
                        <dd>USD {Number(evidence.run.estimated_cost_usd).toFixed(6)}</dd>
                      </div>
                    </dl>
                    <h4>이벤트</h4>
                    {evidence.events.length ? (
                      <ol>
                        {evidence.events.map((event) => (
                          <li key={event.id}>
                            {event.sequence}. {event.event_type}
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <p>기록된 이벤트가 없습니다.</p>
                    )}
                    <h4>도구 호출</h4>
                    {evidence.tool_calls.length ? (
                      <ul>
                        {evidence.tool_calls.map((call) => (
                          <li key={call.id}>
                            {call.tool_name} · {call.status}
                            {call.error_message ? ` · ${call.error_message}` : ""}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p>도구 호출이 없습니다.</p>
                    )}
                    <h4>산출물</h4>
                    {evidence.artifacts.length ? (
                      <ul>
                        {evidence.artifacts.map((artifact) => (
                          <li key={artifact.id}>
                            {artifact.kind} · {artifact.storage_key ?? "서버 보관"}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p>산출물이 없습니다.</p>
                    )}
                    <h4>연결된 문서</h4>
                    {evidence.documents.length ? (
                      <ul>
                        {evidence.documents.map((document) => (
                          <li key={document.id}>
                            <a href={`/documents/${document.document_id}`}>{document.document_title}</a> ·{" "}
                            {document.relation}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p>연결된 문서가 없습니다.</p>
                    )}
                    {(evidence.events.length >= 1000 ||
                      evidence.tool_calls.length >= 1000 ||
                      evidence.artifacts.length >= 1000 ||
                      evidence.documents.length >= 1000) && <p role="status">최근 1,000개 항목만 표시합니다.</p>}
                  </>
                ) : null}
              </section>
            )}
            <p role="status">{message}</p>
          </>
        )}
      </WorkbenchPanel>
    </div>
  );
}
