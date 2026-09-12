import { documentsFixture } from "@agent-factory/contracts";
import { summarizeWorkbench } from "@agent-factory/workbench-runtime";
import type { ReactNode } from "react";
import "@agent-factory/design-system/tokens.css";
import "./app.css";
import { CatalogPreview } from "./CatalogPreview.js";
import { RuntimePreview, WorkbenchAuthoring } from "./WorkbenchAuthoring.js";
import { AuthenticatedThemeRoot } from "./AuthenticatedThemeRoot.js";
import { WorkbenchContextProvider, type WorkbenchSelection } from "./app/WorkbenchContext.js";
import { WorkbenchShell } from "./shell/WorkbenchShell.js";

function Providers({ children, initialSelection }: { children: ReactNode; initialSelection?: WorkbenchSelection }) {
  return (
    <WorkbenchContextProvider initialSelection={initialSelection}>
      <AuthenticatedThemeRoot>{children}</AuthenticatedThemeRoot>
    </WorkbenchContextProvider>
  );
}

export function App({
  path = typeof window === "undefined" ? "/" : window.location.pathname,
  initialSelection,
  composeProviders = false,
}: {
  path?: string;
  initialSelection?: WorkbenchSelection;
  composeProviders?: boolean;
}) {
  if (path.endsWith("/catalog") || path.endsWith("/catalog/")) return <CatalogPreview />;
  if (path.endsWith("/authoring") || path.endsWith("/authoring/")) {
    const content = <WorkbenchAuthoring />;
    return composeProviders ? <Providers initialSelection={initialSelection}>{content}</Providers> : content;
  }
  if (path.endsWith("/runtime-preview") || path.endsWith("/runtime-preview/")) {
    const content = <RuntimePreview />;
    return composeProviders ? <Providers initialSelection={initialSelection}>{content}</Providers> : content;
  }
  if (path.includes("/workbench"))
    return (
      <Providers initialSelection={initialSelection}>
        <WorkbenchShell />
      </Providers>
    );
  const summary = summarizeWorkbench(documentsFixture);
  const content = (
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
  return composeProviders ? <Providers initialSelection={initialSelection}>{content}</Providers> : content;
}
