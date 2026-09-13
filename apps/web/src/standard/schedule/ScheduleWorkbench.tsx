import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { Button, SidebarPattern, WorkbenchPanel, WorkbenchSidebar, type NavItem } from "@agent-factory/design-system";
import { ApiError } from "../../api-client.js";
import {
  scheduleClient,
  type PlanItem,
  type PlanStatus,
  type PlanWrite,
  type PlanningDashboard,
} from "./schedule-client.js";
import "./schedule.css";

type View = "timeline" | "today" | "kanban";
export type Axis = "day" | "week" | "month";
const labels: Record<PlanStatus, string> = { pending: "대기", active: "진행 중", done: "완료" };
const DAY = 86_400_000;
const iso = (date: Date) => date.toISOString().slice(0, 10);
const parse = (value: string) => new Date(`${value}T00:00:00Z`);

export function confirmDeletion(item: PlanItem, confirm: (message: string) => boolean): boolean {
  return confirm(`“${item.name}” 작업을 삭제하시겠습니까?`);
}

export async function deletePlanItem(
  item: PlanItem,
  confirm: (message: string) => boolean,
  remove: (item: PlanItem) => Promise<void>,
): Promise<boolean> {
  if (!confirmDeletion(item, confirm)) return false;
  await remove(item);
  return true;
}

export function todayGroups(items: PlanItem[], today: string) {
  const unfinished = items.filter((item) => item.kind !== "domain" && item.status !== "done");
  return {
    today: unfinished.filter(
      (item) =>
        item.start_date === today ||
        item.target_date === today ||
        (!!item.start_date && !!item.target_date && item.start_date <= today && item.target_date >= today),
    ),
    overdue: unfinished.filter((item) => !!item.target_date && item.target_date < today),
  };
}

export function kanbanItems(items: PlanItem[]): PlanItem[] {
  return items.filter((item) => item.kind !== "domain");
}

export function canChangeKanbanStatus(item: PlanItem, canEdit: boolean, busy: boolean): boolean {
  return item.kind !== "domain" && canEdit && !busy;
}

function tree(items: PlanItem[]): NavItem[] {
  const groups = new Map<string | null, PlanItem[]>();
  for (const item of items) groups.set(item.parent_id, [...(groups.get(item.parent_id) ?? []), item]);
  const children = (parent: string | null): NavItem[] =>
    (groups.get(parent) ?? []).map((item) => ({
      id: item.id,
      label: item.name,
      meta: labels[item.status],
      children: children(item.id),
    }));
  return children(null);
}

export function timelineTicks(start: Date, end: Date, axis: Axis): Date[] {
  const ticks: Date[] = [];
  for (let value = start.getTime(); value <= end.getTime(); value += DAY) {
    const date = new Date(value);
    if (
      axis === "day" ||
      (axis === "week" && date.getUTCDay() === 1) ||
      (axis === "month" && date.getUTCDate() === 1) ||
      !ticks.length
    )
      ticks.push(date);
  }
  return ticks;
}

function Timeline({
  data,
  select,
  axis,
  setAxis,
}: {
  data: PlanningDashboard;
  select: (id: string) => void;
  axis: Axis;
  setAxis: (axis: Axis) => void;
}) {
  const values = data.items
    .flatMap((item) => [item.start_date, item.target_date])
    .filter(Boolean)
    .sort() as string[];
  const start = parse(values[0] ?? iso(new Date()));
  const end = parse(values.at(-1) ?? iso(new Date()));
  start.setUTCDate(start.getUTCDate() - 2);
  end.setUTCDate(end.getUTCDate() + 2);
  const count = Math.max(1, Math.round((end.getTime() - start.getTime()) / DAY) + 1);
  const dates = Array.from({ length: count }, (_, index) => new Date(start.getTime() + index * DAY));
  const ticks = timelineTicks(start, end, axis);
  const children = (id: string) => data.items.filter((item) => item.parent_id === id);
  return (
    <>
      <div className="af-schedule__axis" aria-label="날짜축 단위">
        {(["day", "week", "month"] as Axis[]).map((value) => (
          <Button key={value} aria-pressed={axis === value} onClick={() => setAxis(value)}>
            {{ day: "일", week: "주", month: "월" }[value]}
          </Button>
        ))}
      </div>
      <div className={`af-schedule__timeline is-${axis}`} style={{ "--days": count } as CSSProperties}>
        <div className="af-schedule__timeline-head">
          <strong>작업</strong>
          <div>
            {ticks.map((date) => {
              const value = iso(date);
              const holiday = data.calendar.holidays[value];
              const index = Math.round((date.getTime() - start.getTime()) / DAY);
              return (
                <time
                  key={value}
                  className={holiday ? "is-holiday" : date.getUTCDay() % 6 === 0 ? "is-weekend" : ""}
                  title={holiday || value}
                  style={{ "--column": index } as CSSProperties}
                >
                  {axis === "month" ? value.slice(0, 7) : value.slice(5)}
                </time>
              );
            })}
          </div>
        </div>
        {data.items.map((item, index) => {
          const related = children(item.id);
          const done = related.filter((row) => row.status === "done").length;
          const progress = related.length ? Math.round((done / related.length) * 100) : null;
          const left = item.start_date
            ? Math.max(0, Math.round((parse(item.start_date).getTime() - start.getTime()) / DAY))
            : 0;
          const right = item.target_date
            ? Math.round((parse(item.target_date).getTime() - start.getTime()) / DAY)
            : left;
          return (
            <div className="af-schedule__timeline-row" key={item.id}>
              <button type="button" onClick={() => select(item.id)}>
                {index + 1}. {item.name}
                {progress !== null && (
                  <span>
                    {progress}% ({done}/{related.length})
                  </span>
                )}
              </button>
              <div className="af-schedule__track">
                {dates.map((date, column) => {
                  const value = iso(date);
                  return (
                    <i
                      key={value}
                      className={
                        data.calendar.holidays[value] ? "is-holiday" : date.getUTCDay() % 6 === 0 ? "is-weekend" : ""
                      }
                      style={{ "--column": column } as CSSProperties}
                    />
                  );
                })}
                {item.start_date || item.target_date ? (
                  <button
                    type="button"
                    className={`af-schedule__bar is-${item.status}`}
                    aria-label={`${item.name} 기간`}
                    onClick={() => select(item.id)}
                    style={{ "--left": left, "--width": Math.max(1, right - left + 1) } as CSSProperties}
                  >
                    {progress !== null && <span style={{ width: `${progress}%` }} />}
                  </button>
                ) : (
                  <em>기간 미정</em>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

export function Editor({
  item,
  items,
  close,
  save,
  remove,
  busy,
}: {
  item: PlanItem | null;
  items: PlanItem[];
  close: () => void;
  save: (value: PlanWrite) => Promise<void>;
  remove: (() => Promise<void>) | null;
  busy: boolean;
}) {
  const [kind, setKind] = useState(item?.kind ?? "domain");
  const [name, setName] = useState(item?.name ?? "");
  const [parent, setParent] = useState(item?.parent_id ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [target, setTarget] = useState(item?.target_date ?? "");
  const [start, setStart] = useState(item?.start_date ?? "");
  const [status, setStatus] = useState<PlanStatus>(item?.status ?? "pending");
  const [assignee, setAssignee] = useState(item?.assignee ?? "");
  const [acceptance, setAcceptance] = useState(item?.acceptance ?? "");
  const [blocked, setBlocked] = useState(item?.blocked_reason ?? "");
  return (
    <dialog open className="af-schedule__dialog">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void save({
            kind,
            name,
            parent_id: parent || null,
            description,
            target_date: target || null,
            start_date: kind === "issue" ? null : start || null,
            acceptance: kind === "issue" || kind === "domain" ? "" : acceptance,
            assignee: kind === "domain" ? "" : assignee,
            status: kind === "domain" ? "pending" : status,
            blocked_reason: kind === "domain" ? "" : blocked,
          });
        }}
      >
        <h2>{item ? "작업 수정" : "작업 추가"}</h2>
        <label>
          종류
          <select value={kind} disabled={!!item} onChange={(event) => setKind(event.target.value as typeof kind)}>
            <option value="domain">작업</option>
            <option value="feature">하위 작업</option>
            <option value="issue">세부 작업</option>
          </select>
        </label>
        {kind !== "domain" && (
          <label>
            상위 작업
            <select value={parent} disabled={!!item} required onChange={(event) => setParent(event.target.value)}>
              <option value="">선택하세요</option>
              {items
                .filter((candidate) => candidate.kind === (kind === "feature" ? "domain" : "feature"))
                .map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.name}
                  </option>
                ))}
            </select>
          </label>
        )}
        <label>
          이름
          <input required value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label>
          설명
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} />
        </label>
        {kind !== "issue" && (
          <label>
            시작일
            <input type="date" value={start} onChange={(event) => setStart(event.target.value)} />
          </label>
        )}
        <label>
          목표일
          <input type="date" value={target} onChange={(event) => setTarget(event.target.value)} />
        </label>
        {kind !== "domain" && (
          <>
            <label>
              상태
              <select value={status} onChange={(event) => setStatus(event.target.value as PlanStatus)}>
                {Object.entries(labels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              담당자
              <input value={assignee} onChange={(event) => setAssignee(event.target.value)} />
            </label>
            <label>
              막힌 이유
              <textarea value={blocked} onChange={(event) => setBlocked(event.target.value)} />
            </label>
          </>
        )}
        {kind === "feature" && (
          <label>
            완료 조건
            <textarea value={acceptance} onChange={(event) => setAcceptance(event.target.value)} />
          </label>
        )}
        <footer>
          {remove && (
            <Button type="button" disabled={busy} onClick={() => void remove()}>
              삭제
            </Button>
          )}
          <Button type="button" disabled={busy} onClick={close}>
            취소
          </Button>
          <Button type="submit" busy={busy} disabled={busy}>
            저장
          </Button>
        </footer>
      </form>
    </dialog>
  );
}

export function ScheduleWorkbench({
  userId,
  organizationId,
  workspaceId,
  workbenchId = "schedule",
}: {
  userId: string;
  organizationId: string;
  workspaceId: string;
  workbenchId?: string;
}) {
  const key = `agent-factory:schedule:v2:${userId}:${organizationId}:${workspaceId}:${workbenchId}`;
  const restored = (() => {
    try {
      return JSON.parse(localStorage.getItem(key) ?? "{}") as {
        view?: View;
        axis?: Axis;
        selectedId?: string;
        expanded?: string[];
      };
    } catch {
      return {};
    }
  })();
  const [data, setData] = useState<PlanningDashboard | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(restored.selectedId ?? null);
  const [expanded, setExpanded] = useState(restored.expanded ?? []);
  const [view, setView] = useState<View>(restored.view ?? "timeline");
  const [axis, setAxis] = useState<Axis>(restored.axis ?? "day");
  const [message, setMessage] = useState("일정을 불러오는 중입니다.");
  const [phase, setPhase] = useState<"loading" | "ready" | "permission" | "error">("loading");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<PlanItem | "new" | null>(null);
  const request = useRef<AbortController | null>(null);
  const load = async () => {
    request.current?.abort();
    const next = new AbortController();
    request.current = next;
    setPhase("loading");
    try {
      const result = await scheduleClient.read(organizationId, workspaceId, next.signal);
      if (next.signal.aborted) return;
      setData(result);
      setPhase("ready");
      setMessage("");
      setSelectedId((current) =>
        result.items.some((item) => item.id === current) ? current : (result.items[0]?.id ?? null),
      );
    } catch (error) {
      if (!next.signal.aborted) {
        const denied = error instanceof ApiError && error.status === 403;
        setPhase(denied ? "permission" : "error");
        setMessage(denied ? "일정 읽기 권한이 없습니다." : "일정을 불러오지 못했습니다.");
      }
    }
  };
  useEffect(() => {
    void load();
    return () => request.current?.abort();
  }, [organizationId, workspaceId]);
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify({ view, axis, selectedId, expanded }));
    } catch {
      /* Navigation preferences are best effort. */
    }
  }, [axis, expanded, key, selectedId, view]);
  const selected = data?.items.find((item) => item.id === selectedId) ?? null;
  const roots = useMemo(() => tree(data?.items ?? []), [data]);
  const groups = todayGroups(data?.items ?? [], iso(new Date()));
  const kanban = kanbanItems(data?.items ?? []);
  const changeStatus = async (item: PlanItem, status: PlanStatus) => {
    if (!canChangeKanbanStatus(item, !!data?.can_edit, busy)) return;
    setBusy(true);
    try {
      await scheduleClient.update(organizationId, workspaceId, item, { status });
      await load();
      setMessage("상태를 저장했습니다.");
    } catch (error) {
      setMessage(
        error instanceof ApiError && error.status === 409
          ? "다른 변경과 충돌했습니다. 새로고침했습니다."
          : "상태를 저장하지 못했습니다.",
      );
      await load();
    } finally {
      setBusy(false);
    }
  };
  const save = async (value: PlanWrite) => {
    setBusy(true);
    try {
      if (editing === "new") await scheduleClient.create(organizationId, workspaceId, value);
      else if (editing) await scheduleClient.update(organizationId, workspaceId, editing, value);
      setEditing(null);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "저장하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  };
  const remove = async (item: PlanItem) => {
    setBusy(true);
    try {
      const removed = await deletePlanItem(item, window.confirm, (value) =>
        scheduleClient.remove(organizationId, workspaceId, value),
      );
      if (removed) {
        setEditing(null);
        await load();
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "작업을 삭제하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  };
  const rows = (items: PlanItem[]) => (
    <ol className="af-schedule__rows">
      {items.map((item) => (
        <li key={item.id}>
          <button type="button" onClick={() => setSelectedId(item.id)}>
            {item.name}
          </button>
          <span>{labels[item.status]}</span>
          <time>
            {item.start_date || "시작일 미정"} – {item.target_date || "목표일 미정"}
          </time>
        </li>
      ))}
    </ol>
  );
  return (
    <>
      <WorkbenchSidebar>
        {phase === "ready" ? (
          <SidebarPattern
            variant="tree"
            title="일정"
            items={roots}
            selectedId={selectedId}
            onSelect={setSelectedId}
            expanded={expanded}
            onExpandedChange={setExpanded}
            onCreate={data?.can_edit ? () => setEditing("new") : undefined}
          />
        ) : (
          <div className="af-schedule__state" role={phase === "loading" ? "status" : "alert"}>
            {message}
          </div>
        )}
      </WorkbenchSidebar>
      <WorkbenchPanel>
        <div className="af-schedule">
          <header className="af-schedule__header">
            <h1>일정 대시보드</h1>
            <nav aria-label="일정 보기">
              {(
                [
                  ["timeline", "전체 일정"],
                  ["today", "오늘 할 일"],
                  ["kanban", "칸반"],
                ] as const
              ).map(([id, label]) => (
                <Button key={id} aria-pressed={view === id} onClick={() => setView(id)}>
                  {label}
                </Button>
              ))}
            </nav>
            {data?.can_edit && <Button onClick={() => setEditing("new")}>작업 추가</Button>}
          </header>
          {message && phase === "ready" && <p role="status">{message}</p>}
          {phase === "ready" && data && !data.items.length && <p>등록된 일정 작업이 없습니다.</p>}
          {phase === "ready" && data && view === "timeline" && (
            <Timeline data={data} select={setSelectedId} axis={axis} setAxis={setAxis} />
          )}
          {phase === "ready" && data && view === "today" && (
            <div className="af-schedule__today">
              <section>
                <h2>오늘 기간에 포함된 작업</h2>
                {rows(groups.today)}
              </section>
              <section>
                <h2>기한 초과</h2>
                {rows(groups.overdue)}
              </section>
            </div>
          )}
          {phase === "ready" && data && view === "kanban" && (
            <div className="af-schedule__kanban">
              {(["pending", "active", "done"] as PlanStatus[]).map((status) => (
                <section
                  key={status}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    const item = kanban.find((candidate) => candidate.id === event.dataTransfer.getData("text/plain"));
                    if (item) void changeStatus(item, status);
                  }}
                >
                  <h2>{labels[status]}</h2>
                  {kanban
                    .filter((item) => item.status === status)
                    .map((item) => (
                      <article
                        key={item.id}
                        draggable={data.can_edit}
                        onDragStart={(event) => event.dataTransfer.setData("text/plain", item.id)}
                      >
                        <button type="button" onClick={() => setSelectedId(item.id)}>
                          {item.name}
                        </button>
                        <span>
                          {item.parent_id
                            ? data.items.find((parent) => parent.id === item.parent_id)?.name
                            : "최상위 작업"}{" "}
                          · {item.assignee || "담당자 미정"} · {item.target_date || "목표일 미정"}
                        </span>
                        {item.blocked_reason && <strong>막힘: {item.blocked_reason}</strong>}
                        {data.can_edit && (
                          <select
                            aria-label={`${item.name} 상태`}
                            value={item.status}
                            disabled={busy}
                            onChange={(event) => void changeStatus(item, event.target.value as PlanStatus)}
                          >
                            {Object.entries(labels).map(([id, label]) => (
                              <option key={id} value={id}>
                                {label}
                              </option>
                            ))}
                          </select>
                        )}
                      </article>
                    ))}
                </section>
              ))}
            </div>
          )}
          {selected && (
            <section className="af-schedule__detail">
              <header>
                <h2>{selected.name}</h2>
                {data?.can_edit && <Button onClick={() => setEditing(selected)}>수정</Button>}
              </header>
              <dl>
                <div>
                  <dt>상태</dt>
                  <dd>{labels[selected.status]}</dd>
                </div>
                <div>
                  <dt>담당자</dt>
                  <dd>{selected.assignee || "미정"}</dd>
                </div>
                <div>
                  <dt>목표일</dt>
                  <dd>{selected.target_date || "미정"}</dd>
                </div>
              </dl>
              <p>{selected.description || "설명이 없습니다."}</p>
            </section>
          )}
          {editing && data && (
            <Editor
              item={editing === "new" ? null : editing}
              items={data.items}
              close={() => setEditing(null)}
              save={save}
              remove={editing === "new" ? null : () => remove(editing)}
              busy={busy}
            />
          )}
        </div>
      </WorkbenchPanel>
    </>
  );
}
