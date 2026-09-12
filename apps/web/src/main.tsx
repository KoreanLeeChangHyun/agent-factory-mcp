import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import { AuthenticatedThemeRoot } from "./AuthenticatedThemeRoot.js";
import { WorkbenchContextProvider } from "./app/WorkbenchContext.js";

const app = <App />;
const isCatalog = window.location.pathname === "/catalog" || window.location.pathname === "/catalog/";
const query = new URLSearchParams(window.location.search);
const initialSelection = {
  organizationId: query.get("organization") ?? "unselected",
  workspaceId: query.get("workspace") ?? "unselected",
};

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {isCatalog ? (
      app
    ) : (
      <WorkbenchContextProvider initialSelection={initialSelection}>
        <AuthenticatedThemeRoot>{app}</AuthenticatedThemeRoot>
      </WorkbenchContextProvider>
    )}
  </StrictMode>,
);
