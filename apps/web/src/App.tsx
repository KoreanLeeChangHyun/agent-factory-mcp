import { documentsFixture } from "@agent-factory/contracts";
import { summarizeWorkbench } from "@agent-factory/workbench-runtime";
import "@agent-factory/design-system/tokens.css";
import "./app.css";
import { CatalogPreview } from "./CatalogPreview.js";

export function App({ path = window.location.pathname }: { path?: string }) {
  if (path === "/catalog" || path === "/catalog/") return <CatalogPreview />;
  const summary = summarizeWorkbench(documentsFixture);
  return (
    <main className="health-shell">
      <nav className="task-list" aria-label="작업 목록">
        <button type="button" aria-current="page">
          문서
        </button>
      </nav>
      <aside className="sidebar" aria-label="사이드바">
        <h1>{summary.sidebar}</h1>
        <p>공유 계약 fixture가 유효합니다.</p>
      </aside>
      <section className="panel" aria-label="패널">
        <header>
          <span className="status" role="status">
            정상
          </span>
          <h2>{summary.title}</h2>
        </header>
        <dl>
          <div>
            <dt>Workbench</dt>
            <dd>{summary.id}</dd>
          </div>
          <div>
            <dt>구성 요소</dt>
            <dd>{summary.componentCount}</dd>
          </div>
          <div>
            <dt>API</dt>
            <dd>
              <code>/livez · /readyz</code>
            </dd>
          </div>
        </dl>
      </section>
    </main>
  );
}
