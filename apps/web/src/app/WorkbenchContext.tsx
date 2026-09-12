import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { ThemeContext } from "../theme-client.js";

interface Session {
  user: { id: string };
}

export interface WorkbenchSelection {
  organizationId: string;
  workspaceId: string;
}

interface WorkbenchContextValue {
  themeScope: ThemeContext | null;
  selectContext(selection: WorkbenchSelection): void;
  refreshIdentity(): void;
}

const Context = createContext<WorkbenchContextValue | null>(null);
const unselected: WorkbenchSelection = { organizationId: "unselected", workspaceId: "unselected" };

export function WorkbenchContextProvider({
  children,
  initialSelection = unselected,
}: {
  children: ReactNode;
  initialSelection?: WorkbenchSelection;
}) {
  const [userId, setUserId] = useState<string | null>(null);
  const [selection, setSelection] = useState(initialSelection);
  const generation = useRef(0);
  const controller = useRef<AbortController | null>(null);

  const refreshIdentity = useCallback(() => {
    const requestGeneration = ++generation.current;
    controller.current?.abort();
    const requestController = new AbortController();
    controller.current = requestController;
    setUserId(null);
    void fetch("/api/auth/me", {
      credentials: "same-origin",
      cache: "no-store",
      signal: requestController.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("authenticated account unavailable");
        return response.json() as Promise<Session>;
      })
      .then((session) => {
        if (requestGeneration === generation.current) setUserId(session.user.id);
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) setUserId(null);
      });
  }, []);

  useEffect(() => {
    refreshIdentity();
    return () => {
      generation.current += 1;
      controller.current?.abort();
    };
  }, [refreshIdentity]);

  const value = useMemo<WorkbenchContextValue>(
    () => ({
      themeScope: userId ? { userId, ...selection } : null,
      selectContext: setSelection,
      refreshIdentity,
    }),
    [refreshIdentity, selection, userId],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useWorkbenchContext(): WorkbenchContextValue {
  const value = useContext(Context);
  if (!value) throw new Error("useWorkbenchContext requires WorkbenchContextProvider");
  return value;
}
