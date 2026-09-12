import type { ReactNode } from "react";
import { useWorkbenchContext } from "./app/WorkbenchContext.js";
import { ThemeBootstrap } from "./ThemeBootstrap.js";

export function AuthenticatedThemeRoot({ children }: { children: ReactNode }) {
  const { themeScope } = useWorkbenchContext();
  return <ThemeBootstrap scope={themeScope}>{children}</ThemeBootstrap>;
}
