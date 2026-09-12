export function applicationRoot(pathname?: string): string {
  const resolvedPathname = pathname ?? (typeof window === "undefined" ? "/" : window.location.pathname);
  const marker = "/workbench";
  const index = resolvedPathname.indexOf(marker);
  return index < 0 ? "" : resolvedPathname.slice(0, index);
}

export function apiPath(path: string, pathname?: string): string {
  return `${applicationRoot(pathname)}${path.startsWith("/") ? path : `/${path}`}`;
}

export function legacyWorkspacePath(pathname?: string): string {
  return `${applicationRoot(pathname)}/workspace/`;
}
