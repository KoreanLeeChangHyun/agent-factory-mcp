import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";

export type TaskIconName =
  | "documents"
  | "workspace"
  | "knowledge"
  | "connections"
  | "jobs"
  | "audit"
  | "calendar"
  | "agents"
  | "logs"
  | "tests"
  | "database"
  | "account"
  | "admin"
  | "search"
  | "settings"
  | "favorites";

const iconPaths: Record<TaskIconName, ReactNode> = {
  documents: (
    <>
      <path d="M5 3h9l5 5v13H5z" />
      <path d="M14 3v5h5M8 12h8M8 16h8" />
    </>
  ),
  workspace: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M8 4v16M3 9h5" />
    </>
  ),
  knowledge: (
    <>
      <path d="M4 5.5A3.5 3.5 0 0 1 7.5 2H11v18H7.5A3.5 3.5 0 0 0 4 23zM20 5.5A3.5 3.5 0 0 0 16.5 2H13v18h3.5a3.5 3.5 0 0 1 3.5 3z" />
    </>
  ),
  connections: (
    <>
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="6" r="3" />
      <circle cx="18" cy="18" r="3" />
      <path d="m9 11 6-4M9 13l6 4" />
    </>
  ),
  jobs: (
    <>
      <rect x="3" y="5" width="18" height="15" rx="2" />
      <path d="M8 5V3h8v2M8 11h8M8 15h5" />
    </>
  ),
  audit: (
    <>
      <path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z" />
      <path d="m8 12 3 3 5-6" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M7 3v4M17 3v4M3 10h18" />
    </>
  ),
  agents: (
    <>
      <circle cx="12" cy="8" r="3" />
      <path d="M5 21v-2a7 7 0 0 1 14 0v2M4 8H2M22 8h-2" />
    </>
  ),
  logs: (
    <>
      <path d="M5 3h14v18H5zM8 8h8M8 12h8M8 16h5" />
    </>
  ),
  tests: (
    <>
      <path d="M9 3v5l-5 10a2 2 0 0 0 2 3h12a2 2 0 0 0 2-3L15 8V3M8 13h8" />
    </>
  ),
  database: (
    <>
      <ellipse cx="12" cy="5" rx="8" ry="3" />
      <path d="M4 5v7c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12v7c0 1.7 3.6 3 8 3s8-1.3 8-3v-7" />
    </>
  ),
  account: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  admin: (
    <>
      <path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z" />
      <path d="M9 12h6M12 9v6" />
    </>
  ),
  search: (
    <>
      <circle cx="10" cy="10" r="6" />
      <path d="m15 15 6 6" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19 13.5v-3l-2-.7-.7-1.7.9-1.9-2.1-2.1-1.9.9-1.7-.7-.7-2h-3l-.7 2-1.7.7-1.9-.9-2.1 2.1.9 1.9-.7 1.7-2 .7v3l2 .7.7 1.7-.9 1.9 2.1 2.1 1.9-.9 1.7.7.7 2h3l.7-2 1.7-.7 1.9.9 2.1-2.1-.9-1.9.7-1.7z" />
    </>
  ),
  favorites: <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9z" />,
};

export function Icon({ name, label }: { name: TaskIconName; label?: string }) {
  return (
    <svg
      className="af-icon"
      viewBox="0 0 24 24"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {iconPaths[name]}
    </svg>
  );
}

export function TaskIcon({
  name,
  selected = false,
  disabled = false,
  notification = false,
  label,
}: {
  name: TaskIconName;
  selected?: boolean;
  disabled?: boolean;
  notification?: boolean;
  label: string;
}) {
  return (
    <span className="af-task-icon" data-selected={selected} data-disabled={disabled} data-notification={notification}>
      <Icon name={name} label={label} />
    </span>
  );
}

export function Button({
  children,
  busy = false,
  variant = "secondary",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { busy?: boolean; variant?: "primary" | "secondary" }) {
  return (
    <button className="af-button" data-variant={variant} aria-busy={busy} {...props} disabled={busy || props.disabled}>
      {busy ? "처리 중…" : children}
    </button>
  );
}

export function WorkbenchFrame({
  sidebarOpen,
  sidebarWidth,
  children,
}: {
  sidebarOpen: boolean;
  sidebarWidth: number;
  children: ReactNode;
}) {
  return (
    <main
      className={`af-shell${sidebarOpen ? "" : " af-shell--sidebar-closed"}`}
      style={{ "--af-runtime-sidebar-width": `${sidebarWidth}px` } as CSSProperties}
    >
      {children}
    </main>
  );
}

export function WorkbenchTaskList({ children }: { children: ReactNode }) {
  return (
    <nav className="af-shell-task-list" aria-label="작업 목록">
      {children}
    </nav>
  );
}

export function WorkbenchSidebar({ children }: { children: ReactNode }) {
  return (
    <aside className="af-shell-sidebar" aria-label="사이드바">
      {children}
    </aside>
  );
}

export function WorkbenchPanel({ children }: { children: ReactNode }) {
  return (
    <section className="af-shell-panel" aria-label="패널">
      {children}
    </section>
  );
}

export function ShellResizeHandle({ width, onChange }: { width: number; onChange: (width: number) => void }) {
  const stop = useRef<(() => void) | null>(null);
  useEffect(() => () => stop.current?.(), []);
  const clamp = (value: number) => onChange(Math.max(180, Math.min(520, Math.round(value))));
  return (
    <button
      type="button"
      className="af-runtime-resizer"
      role="separator"
      aria-label="사이드바 너비 조절"
      aria-orientation="vertical"
      aria-valuemin={180}
      aria-valuemax={520}
      aria-valuenow={width}
      onKeyDown={(event) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
        clamp(width + (event.key === "ArrowLeft" ? -16 : 16));
      }}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        const origin = event.clientX;
        const initial = width;
        const move = (pointer: PointerEvent) => clamp(initial + pointer.clientX - origin);
        const cleanup = () => {
          window.removeEventListener("pointermove", move);
          window.removeEventListener("pointerup", cleanup);
          window.removeEventListener("pointercancel", cleanup);
          stop.current = null;
        };
        stop.current?.();
        stop.current = cleanup;
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", cleanup);
        window.addEventListener("pointercancel", cleanup);
        event.currentTarget.setPointerCapture?.(event.pointerId);
      }}
    />
  );
}

export function IconButton({
  icon,
  label,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { icon: TaskIconName; label: string }) {
  return (
    <button className="af-icon-button" type="button" aria-label={label} title={label} {...props}>
      <Icon name={icon} />
    </button>
  );
}

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children?: ReactNode;
}) {
  const id = useId();
  return (
    <label className="af-field">
      <span>{label}</span>
      <span id={id}>{children}</span>
      {error ? (
        <span role="alert" style={{ color: "var(--af-danger)" }}>
          {error}
        </span>
      ) : hint ? (
        <span className="af-meta">{hint}</span>
      ) : null}
    </label>
  );
}

export const TextInput = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input className="af-input" type="text" {...props} />
);
export const NumberInput = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input className="af-input" type="number" {...props} />
);
export const DateInput = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input className="af-input" type="date" {...props} />
);
export const Select = (props: React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <select className="af-select" {...props} />
);
export function MultiSelect({
  label,
  options,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  options: string[];
  value: string[];
  onChange: (value: string[]) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset className="af-stack" disabled={disabled}>
      <legend>{label}</legend>
      {options.map((option) => (
        <label className="af-check" key={option}>
          <input
            type="checkbox"
            checked={value.includes(option)}
            onChange={() =>
              onChange(value.includes(option) ? value.filter((item) => item !== option) : [...value, option])
            }
          />
          {option}
        </label>
      ))}
    </fieldset>
  );
}
export const Checkbox = ({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) => (
  <label className="af-check">
    <input type="checkbox" {...props} />
    {label}
  </label>
);
export const Toggle = ({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) => (
  <label className="af-check">
    <input className="af-toggle" type="checkbox" role="switch" {...props} />
    {label}
  </label>
);

export function Tabs({
  labels,
  items = labels.map((label) => ({ id: label, label })),
  onSelect,
}: {
  labels: string[];
  items?: { id: string; label: string }[];
  onSelect?: (id: string) => void;
}) {
  const [active, setActive] = useState(0);
  return (
    <div className="af-tabs" role="tablist">
      {items.map((item, index) => (
        <button
          className="af-tab"
          role="tab"
          aria-selected={active === index}
          tabIndex={active === index ? 0 : -1}
          key={item.id}
          onClick={() => {
            setActive(index);
            onSelect?.(item.id);
          }}
          onKeyDown={(event) => {
            const next =
              event.key === "ArrowRight"
                ? (index + 1) % items.length
                : event.key === "ArrowLeft"
                  ? (index - 1 + items.length) % items.length
                  : -1;
            if (next >= 0) {
              event.preventDefault();
              setActive(next);
              onSelect?.(items[next]!.id);
              event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>("[role='tab']")[next]?.focus();
            }
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

export type NavItem = {
  id: string;
  label: string;
  meta?: string;
  group?: string;
  favorite?: boolean;
  recent?: boolean;
  children?: NavItem[];
};
const resourceIconUrls = {
  group: new URL("./assets/icons/group-open.svg", import.meta.url).href,
  item: new URL("./assets/icons/workspace.svg", import.meta.url).href,
  leaf: new URL("./assets/icons/subtask.svg", import.meta.url).href,
};

export type SidebarVariant =
  | "flat-list"
  | "group-list"
  | "tree"
  | "search-list"
  | "filter-list"
  | "detail-list"
  | "favorites-recent";
function NavRows({
  items,
  selected,
  onSelect,
  tree = false,
  nested = false,
  expanded = [],
  onExpandedChange,
}: {
  items: NavItem[];
  selected: string;
  onSelect: (id: string) => void;
  tree?: boolean;
  nested?: boolean;
  expanded?: string[];
  onExpandedChange?: (ids: string[]) => void;
}) {
  return (
    <ul
      className="af-nav-list"
      role={tree ? (nested ? "group" : "tree") : "list"}
      onKeyDown={
        tree && !nested
          ? (event) => {
              if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
              const rows = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>(".af-nav-row"));
              const index = rows.indexOf(document.activeElement as HTMLButtonElement);
              const next =
                event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? rows.length - 1
                    : event.key === "ArrowDown"
                      ? Math.min(rows.length - 1, index + 1)
                      : Math.max(0, index - 1);
              event.preventDefault();
              rows[next]?.focus();
            }
          : undefined
      }
    >
      {items.map((item) => (
        <li key={item.id} role={tree ? "treeitem" : undefined} aria-selected={tree ? selected === item.id : undefined}>
          <button
            className="af-nav-row"
            aria-label={`${item.label} 항목`}
            aria-current={!tree && selected === item.id ? "page" : undefined}
            onClick={() => onSelect(item.id)}
          >
            {tree && (
              <img
                width="16"
                height="16"
                alt=""
                src={item.children ? resourceIconUrls.group : nested ? resourceIconUrls.leaf : resourceIconUrls.item}
              />
            )}
            <span className="af-nav-label">{item.label}</span>
            <span className="af-spacer" />
            {item.meta && <span className="af-meta">{item.meta}</span>}
          </button>
          {tree && item.children && (
            <button
              type="button"
              aria-label={`${item.label} 펼치기`}
              aria-expanded={expanded.includes(item.id)}
              onClick={() =>
                onExpandedChange?.(
                  expanded.includes(item.id) ? expanded.filter((id) => id !== item.id) : [...expanded, item.id],
                )
              }
            >
              {expanded.includes(item.id) ? "−" : "+"}
            </button>
          )}
          {tree && item.children && expanded.includes(item.id) && (
            <div style={{ paddingInlineStart: "var(--af-space-4)" }}>
              <NavRows
                items={item.children}
                selected={selected}
                onSelect={onSelect}
                tree
                nested
                expanded={expanded}
                onExpandedChange={onExpandedChange}
              />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

export function SidebarPattern({
  variant = "flat-list",
  title = "",
  items = [],
  onSelect,
  onSettings,
  onCreate,
  selectedId,
  expanded = [],
  onExpandedChange,
  children,
}: {
  variant?: SidebarVariant;
  title?: string;
  items?: NavItem[];
  onSelect?: (id: string) => void;
  onSettings?: () => void;
  onCreate?: () => void;
  selectedId?: string | null;
  expanded?: string[];
  onExpandedChange?: (ids: string[]) => void;
  children?: ReactNode;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [localSelected, setSelected] = useState(items[0]?.id ?? "");
  const selected = selectedId ?? localSelected;
  const visible = useMemo(
    () =>
      items.filter(
        (item) =>
          item.label.toLocaleLowerCase("ko").includes(query.toLocaleLowerCase("ko")) &&
          (filter === "all" || item.group === filter),
      ),
    [filter, items, query],
  );
  const groups = [...new Set(visible.map((item) => item.group ?? "기타"))];
  const select = (id: string) => {
    setSelected(id);
    onSelect?.(id);
  };
  return (
    <nav className="af-sidebar-host" aria-label={`${title} 사이드바`}>
      <header className="af-sidebar-header">
        <div className="af-row">
          {title && <strong>{title}</strong>}
          <span className="af-spacer" />
          {onSettings && <IconButton icon="settings" label="사이드바 설정" onClick={onSettings} />}
        </div>
        {["search-list", "filter-list"].includes(variant) && (
          <TextInput
            aria-label="목록 검색"
            placeholder="검색"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        )}{" "}
        {variant === "filter-list" && (
          <Select aria-label="그룹 필터" value={filter} onChange={(event) => setFilter(event.target.value)}>
            <option value="all">모든 그룹</option>
            {groups.map((group) => (
              <option key={group}>{group}</option>
            ))}
          </Select>
        )}
      </header>
      <div className="af-sidebar-body">
        {children ? (
          children
        ) : variant === "group-list" ? (
          groups.map((group) => (
            <details className="af-section" open key={group}>
              <summary>{group}</summary>
              <NavRows
                items={visible.filter((item) => (item.group ?? "기타") === group)}
                selected={selected}
                onSelect={select}
              />
            </details>
          ))
        ) : variant === "favorites-recent" ? (
          <>
            {["즐겨찾기", "최근 항목"].map((heading, index) => (
              <section key={heading}>
                <h3>{heading}</h3>
                <NavRows
                  items={visible.filter((item) => (index ? item.recent : item.favorite))}
                  selected={selected}
                  onSelect={select}
                />
              </section>
            ))}
          </>
        ) : (
          <NavRows
            items={visible}
            selected={selected}
            onSelect={select}
            tree={variant === "tree"}
            expanded={expanded}
            onExpandedChange={onExpandedChange}
          />
        )}{" "}
        {!visible.length && <StateView state="empty" />}
      </div>
      {onCreate && (
        <footer className="af-sidebar-footer">
          <Button onClick={onCreate}>새 항목</Button>
        </footer>
      )}
    </nav>
  );
}

export type PanelVariant =
  | "detail"
  | "list-detail"
  | "collection"
  | "settings"
  | "dashboard"
  | "document"
  | "split"
  | "timeline"
  | "kanban";
export type PanelSlot = {
  id: string;
  title: string;
  content?: string;
  meta?: string;
  node?: ReactNode;
};

export function PanelLayout({
  variant = "detail",
  onAction,
  slots = [],
  composedSlots = [],
}: {
  variant?: PanelVariant;
  onAction?: (action: "submit" | "toggle", value?: unknown) => void;
  slots?: PanelSlot[];
  composedSlots?: { id: string; content: ReactNode }[];
}) {
  const [split, setSplit] = useState(45);
  const splitValue = useRef(45);
  const [vertical, setVertical] = useState(() => typeof window !== "undefined" && window.innerWidth <= 520);
  const container = useRef<HTMLDivElement>(null);
  const style = { "--af-split": `${split}%`, "--af-split-ratio": split / 100 } as CSSProperties;
  const resizeSplit = (value: number) => {
    const next = Math.max(25, Math.min(75, value));
    splitValue.current = next;
    setSplit(next);
    onAction?.("toggle", next);
  };
  useEffect(() => {
    const update = () => setVertical(window.innerWidth <= 520);
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  const visibleSlots: PanelSlot[] = composedSlots.length
    ? composedSlots.map((slot) => ({ id: slot.id, title: "", node: slot.content }))
    : slots;
  const slotBody = (slot: PanelSlot) => slot.node ?? (slot.content ? <p>{slot.content}</p> : null);
  const card = (slot: PanelSlot) => (
    <section className="af-card" key={slot.id} data-slot={slot.id}>
      {slot.title && <strong>{slot.title}</strong>}
      {slotBody(slot)}
      {slot.meta && <p className="af-meta">{slot.meta}</p>}
    </section>
  );
  if (!visibleSlots.length)
    return (
      <div className={`af-panel-layout af-layout-${variant}`}>
        <StateView state="empty" />
      </div>
    );
  const primary = visibleSlots[0]!;
  const secondary = visibleSlots[1] ?? primary;
  const contents: Record<Exclude<PanelVariant, "split">, ReactNode> = {
    detail: (
      <>
        <header className="af-card">
          {primary.title && <h2>{primary.title}</h2>}
          {slotBody(primary)}
          <Button variant="primary" onClick={() => onAction?.("submit")}>
            적용
          </Button>
        </header>
        {visibleSlots.slice(1).map(card)}
      </>
    ),
    "list-detail": (
      <>
        <nav aria-label={primary.title}>{card(primary)}</nav>
        <article>{card(secondary)}</article>
      </>
    ),
    collection: <>{visibleSlots.map(card)}</>,
    settings: (
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onAction?.("submit");
        }}
      >
        {visibleSlots.map((slot) => (
          <Field key={slot.id} label={slot.title} hint={slot.meta}>
            {slot.node ?? <TextInput defaultValue={slot.content} />}
          </Field>
        ))}
        <Button type="submit" variant="primary">
          적용
        </Button>
      </form>
    ),
    dashboard: (
      <>
        {visibleSlots.map((slot) =>
          slot.node ? card(slot) : <Metric key={slot.id} label={slot.title} value={slot.content ?? "—"} />,
        )}
      </>
    ),
    document: (
      <article className="af-card">
        <section data-slot={primary.id}>
          {primary.title && <h2>{primary.title}</h2>}
          {primary.meta && <p className="af-meta">{primary.meta}</p>}
          {primary.node ?? <CodeBlock value={primary.content ?? ""} />}
        </section>
        {visibleSlots.slice(1).map(card)}
      </article>
    ),
    timeline: (
      <>
        <aside>{card(primary)}</aside>
        <section>{visibleSlots.slice(1).map(card)}</section>
      </>
    ),
    kanban: (
      <>
        {visibleSlots.map((slot) => (
          <section className="af-card" key={slot.id} data-slot={slot.id}>
            {slot.title && <h3>{slot.title}</h3>}
            {slotBody(slot)}
          </section>
        ))}
      </>
    ),
  };
  if (variant !== "split") return <div className={`af-panel-layout af-layout-${variant}`}>{contents[variant]}</div>;
  return (
    <div ref={container} className="af-panel-layout af-layout-split" style={style}>
      {card(primary)}
      <button
        className="af-splitter"
        aria-label="분할 위치 조절"
        aria-valuemin={25}
        aria-valuemax={75}
        aria-valuenow={split}
        aria-orientation={vertical ? "horizontal" : "vertical"}
        role="separator"
        onKeyDown={(event) => {
          const decrease = vertical ? event.key === "ArrowUp" : event.key === "ArrowLeft";
          const increase = vertical ? event.key === "ArrowDown" : event.key === "ArrowRight";
          if (!decrease && !increase) return;
          event.preventDefault();
          resizeSplit(splitValue.current + (decrease ? -5 : 5));
        }}
        onPointerDown={(event) => {
          const move = (pointer: PointerEvent) => {
            const rect = container.current?.getBoundingClientRect();
            if (rect) {
              const ratio = vertical
                ? (pointer.clientY - rect.top) / rect.height
                : (pointer.clientX - rect.left) / rect.width;
              resizeSplit(ratio * 100);
            }
          };
          const stop = () => {
            window.removeEventListener("pointermove", move);
            window.removeEventListener("pointerup", stop);
          };
          window.addEventListener("pointermove", move);
          window.addEventListener("pointerup", stop);
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
      />
      {card(secondary)}
    </div>
  );
}

export interface DataTableColumn<Row extends { id: string }> {
  id: keyof Row & string;
  label: string;
  width?: string;
  render?: (value: Row[keyof Row], row: Row) => ReactNode;
}
export function DataTable<Row extends { id: string; title: string; status?: string }>({
  rows = [],
  columns,
  caption = "리소스",
  empty = "표시할 항목이 없습니다.",
}: {
  rows?: Row[];
  columns?: DataTableColumn<Row>[];
  caption?: string;
  empty?: string;
}) {
  const resolved =
    columns ??
    ([
      { id: "title", label: "이름" },
      { id: "status", label: "상태" },
    ] as DataTableColumn<Row>[]);
  return (
    <table className="af-table">
      <caption className="af-meta">{caption}</caption>
      <thead>
        <tr>
          {resolved.map((column) => (
            <th key={column.id} style={{ width: column.width }}>
              {column.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {!rows.length && (
          <tr>
            <td colSpan={resolved.length}>{empty}</td>
          </tr>
        )}
        {rows.map((row) => (
          <tr key={row.id}>
            {resolved.map((column) => {
              const value = row[column.id];
              return <td key={column.id}>{column.render ? column.render(value, row) : String(value ?? "—")}</td>;
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
export function ResourceHeader({
  title = "",
  status = "",
  onRefresh,
}: {
  title?: string;
  status?: string;
  onRefresh?: () => void;
}) {
  return (
    <header className="af-card af-row">
      <div>
        <h2>{title}</h2>
        <span className="af-meta">{status}</span>
      </div>
      <span className="af-spacer" />
      {onRefresh && <Button onClick={onRefresh}>새로고침</Button>}
    </header>
  );
}
export function Metric({ label = "", value = "—" }: { label?: string; value?: string }) {
  return (
    <div className="af-metric">
      <span className="af-meta">{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
export function ChartFrame() {
  return (
    <div className="af-chart-frame" role="img" aria-label="차트 구현을 지연 로드하는 프레임">
      선택적 시각화 프레임
    </div>
  );
}
export function CodeBlock({ value = "" }: { value?: string }) {
  return (
    <pre className="af-code">
      <code>{value}</code>
    </pre>
  );
}
export function JsonView({ value = null }: { value?: unknown }) {
  return <pre className="af-json">{JSON.stringify(value, null, 2)}</pre>;
}
export function Markdown({ value = "" }: { value?: string }) {
  const match = value.match(/^(.*?)\[([^\]]+)]\((https?:\/\/[^\s)]+)\)(.*)$/);
  if (!match) return <p>{value.replace(/<[^>]*>/g, "")}</p>;
  return (
    <p>
      {match[1]}
      <a href={match[3]} rel="noreferrer" target="_blank">
        {match[2]}
      </a>
      {match[4]}
    </p>
  );
}

export type CommonState =
  | "loading"
  | "empty"
  | "error"
  | "permission-denied"
  | "busy"
  | "stale"
  | "success"
  | "progress";
const stateCopy: Record<CommonState, [string, string]> = {
  loading: ["불러오는 중…", "데이터를 기다리고 있습니다."],
  empty: ["항목 없음", "표시할 항목이 없습니다."],
  error: ["불러오지 못함", "잠시 후 다시 시도해 주세요."],
  "permission-denied": ["권한 없음", "이 항목을 볼 권한이 없습니다."],
  busy: ["처리 중…", "작업이 완료될 때까지 기다려 주세요."],
  stale: ["최신 상태 아님", "새로고침하여 최신 데이터를 확인하세요."],
  success: ["완료", "요청이 완료되었습니다."],
  progress: ["진행 중", "3 / 5 단계를 완료했습니다."],
};
export function StateView({ state = "loading" }: { state?: CommonState }) {
  const [title, detail] = stateCopy[state];
  return (
    <div
      className="af-state"
      role={state === "error" ? "alert" : "status"}
      aria-live={state === "error" ? "assertive" : "polite"}
      data-tone={state === "error" ? "error" : state === "success" ? "success" : undefined}
    >
      <strong>{title}</strong>
      <span className="af-meta">{detail}</span>
      {state === "progress" && (
        <progress value={3} max={5}>
          60%
        </progress>
      )}
    </div>
  );
}

const dialogStack: symbol[] = [];

export function Dialog({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children?: ReactNode;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const titleId = `af-dialog-${useId()}`;
  const stackId = useRef(Symbol("dialog"));
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const isTopmost = () => dialogStack.at(-1) === stackId.current;
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    dialogStack.push(stackId.current);
    if (isTopmost()) closeRef.current?.focus();
    const key = (event: KeyboardEvent) => {
      if (!isTopmost()) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        onCloseRef.current();
        return;
      }
      if (event.key === "Tab") {
        event.stopImmediatePropagation();
        const focusable = Array.from(
          dialogRef.current?.querySelectorAll<HTMLElement>(
            "button, input, select, textarea, [tabindex]:not([tabindex='-1'])",
          ) ?? [],
        ).filter((node) => !node.hasAttribute("disabled"));
        if (!focusable.length) return;
        const index = focusable.indexOf(document.activeElement as HTMLElement);
        const next = event.shiftKey ? (index <= 0 ? focusable.length - 1 : index - 1) : (index + 1) % focusable.length;
        event.preventDefault();
        focusable[next]?.focus();
      }
    };
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("keydown", key);
      const wasTopmost = isTopmost();
      const index = dialogStack.lastIndexOf(stackId.current);
      if (index >= 0) dialogStack.splice(index, 1);
      if (wasTopmost && previous?.isConnected) previous.focus();
    };
  }, [open]);
  if (!open) return null;
  return (
    <div
      className="af-dialog-backdrop"
      onMouseDown={(event) => {
        if (isTopmost() && event.target === event.currentTarget) onClose();
      }}
    >
      <section ref={dialogRef} className="af-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="af-row">
          <h2 id={titleId}>{title}</h2>
          <span className="af-spacer" />
          <button ref={closeRef} className="af-icon-button" aria-label="대화상자 닫기" onClick={onClose}>
            ×
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
export function Menu({ open, onSelect }: { open: boolean; onSelect?: (value: string) => void }) {
  return open ? (
    <div className="af-menu" role="menu">
      <button className="af-nav-row" role="menuitem" onClick={() => onSelect?.("open")}>
        열기
      </button>
      <button className="af-nav-row" role="menuitem" onClick={() => onSelect?.("duplicate")}>
        복제
      </button>
    </div>
  ) : null;
}
export function Popover({ open }: { open: boolean }) {
  return open ? (
    <aside className="af-popover" role="dialog" aria-label="추가 정보">
      선택 항목의 추가 정보입니다.
    </aside>
  ) : null;
}
export function Toast({ open, onClose }: { open: boolean; onClose: () => void }) {
  return open ? (
    <div className="af-toast" role="status">
      <div className="af-row">
        <span>변경 사항을 저장했습니다.</span>
        <button className="af-icon-button" aria-label="알림 닫기" onClick={onClose}>
          ×
        </button>
      </div>
    </div>
  ) : null;
}
