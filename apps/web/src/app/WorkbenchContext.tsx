import { accountClient, type SessionUser } from "../standard/account/index.js";
import { organizationClient, type OrganizationSummary } from "../standard/organization/index.js";
import { workspaceClient } from "../standard/workspace/index.js";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { ThemeContext } from "../theme-client.js";

export interface WorkbenchSelection {
  organizationId: string | null;
  workspaceId: string | null;
}
interface WorkbenchContextValue {
  user: SessionUser | null;
  organizations: OrganizationSummary[];
  selection: WorkbenchSelection;
  themeScope: ThemeContext | null;
  loading: boolean;
  error: string | null;
  selectContext(selection: WorkbenchSelection, options?: { replace?: boolean }): void;
  refreshIdentity(): void;
  refreshOrganizations(): void;
}

const Context = createContext<WorkbenchContextValue | null>(null);
const selectionFromLocation = (): WorkbenchSelection => {
  if (typeof window === "undefined") return { organizationId: null, workspaceId: null };
  const query = new URLSearchParams(window.location.search);
  return { organizationId: query.get("organization"), workspaceId: query.get("workspace") };
};
const authorizedSelection = async (
  candidate: WorkbenchSelection,
  organizations: OrganizationSummary[],
  signal: AbortSignal,
): Promise<WorkbenchSelection> => {
  if (!candidate.organizationId || !organizations.some((item) => item.id === candidate.organizationId)) {
    return { organizationId: null, workspaceId: null };
  }
  if (!candidate.workspaceId) return { organizationId: candidate.organizationId, workspaceId: null };
  const workspaces = await workspaceClient.workspaces(encodeURIComponent(candidate.organizationId), signal);
  return workspaces.some((item) => item.id === candidate.workspaceId)
    ? candidate
    : { organizationId: candidate.organizationId, workspaceId: null };
};

/** Authenticated discovery is intentionally independent of a selected Workspace. */
export function WorkbenchContextProvider({
  children,
  initialSelection = selectionFromLocation(),
}: {
  children: ReactNode;
  initialSelection?: WorkbenchSelection;
}) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [organizations, setOrganizations] = useState<OrganizationSummary[]>([]);
  const [selection, setSelection] = useState(initialSelection);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const selectionRef = useRef(selection);
  const generation = useRef(0);
  const historyGeneration = useRef(0);
  const controller = useRef<AbortController | null>(null);

  const refreshIdentity = useCallback(() => {
    const current = ++generation.current;
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    setLoading(true);
    setError(null);
    setUser(null);
    setOrganizations([]);
    void Promise.all([accountClient.me(request.signal), organizationClient.listForAccount(request.signal)])
      .then(async ([session, discovered]) => {
        if (current !== generation.current || request.signal.aborted) return;
        const restored = await authorizedSelection(selectionRef.current, discovered, request.signal);
        if (current !== generation.current || request.signal.aborted) return;
        setUser(session.user);
        setOrganizations(discovered);
        selectionRef.current = restored;
        setSelection(restored);
      })
      .catch((reason: unknown) => {
        if (request.signal.aborted || current !== generation.current) return;
        setUser(null);
        setOrganizations([]);
        setSelection({ organizationId: null, workspaceId: null });
        setError(reason instanceof Error ? reason.message : "로그인 정보를 불러오지 못했습니다.");
      })
      .finally(() => {
        if (current === generation.current) setLoading(false);
      });
  }, []);

  useEffect(() => {
    refreshIdentity();
    return () => {
      generation.current += 1;
      controller.current?.abort();
    };
  }, [refreshIdentity]);
  useEffect(() => {
    const restore = () => {
      const current = ++historyGeneration.current;
      const request = new AbortController();
      void authorizedSelection(selectionFromLocation(), organizations, request.signal)
        .then((restored) => {
          if (current !== historyGeneration.current) return;
          selectionRef.current = restored;
          setSelection(restored);
        })
        .catch((reason: unknown) => {
          if (current !== historyGeneration.current) return;
          if (!(reason instanceof DOMException && reason.name === "AbortError")) {
            setError(reason instanceof Error ? reason.message : "작업공간을 확인하지 못했습니다.");
          }
        });
    };
    window.addEventListener("popstate", restore);
    return () => {
      historyGeneration.current += 1;
      window.removeEventListener("popstate", restore);
    };
  }, [organizations]);

  const selectContext = useCallback((next: WorkbenchSelection, options?: { replace?: boolean }) => {
    selectionRef.current = next;
    setSelection(next);
    const url = new URL(window.location.href);
    if (next.organizationId) url.searchParams.set("organization", next.organizationId);
    else url.searchParams.delete("organization");
    if (next.workspaceId) url.searchParams.set("workspace", next.workspaceId);
    else url.searchParams.delete("workspace");
    window.history[options?.replace ? "replaceState" : "pushState"]({}, "", url);
  }, []);
  const refreshOrganizations = useCallback(() => {
    const current = generation.current;
    const request = controller.current;
    if (!user || !request) return;
    void organizationClient.listForAccount(request.signal).then((items) => {
      if (current === generation.current && !request.signal.aborted) setOrganizations(items);
    });
  }, [user]);
  const value = useMemo<WorkbenchContextValue>(
    () => ({
      user,
      organizations,
      selection,
      loading,
      error,
      themeScope: user
        ? { userId: user.id, organizationId: selection.organizationId ?? "", workspaceId: selection.workspaceId ?? "" }
        : null,
      selectContext,
      refreshIdentity,
      refreshOrganizations,
    }),
    [error, loading, organizations, refreshIdentity, refreshOrganizations, selectContext, selection, user],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useWorkbenchContext(): WorkbenchContextValue {
  const value = useContext(Context);
  if (!value) throw new Error("useWorkbenchContext requires WorkbenchContextProvider");
  return value;
}
