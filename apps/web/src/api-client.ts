import { apiPath } from "./api-path.js";

export function csrfToken(): string {
  return decodeURIComponent(
    document.cookie
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith("agent_factory_csrf="))
      ?.split("=")
      .slice(1)
      .join("=") ?? "",
  );
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(
      typeof body === "object" && body && "detail" in body
        ? JSON.stringify((body as { detail: unknown }).detail)
        : `HTTP ${status}`,
    );
  }
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(apiPath(path), {
    ...options,
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(options.method && !["GET", "HEAD"].includes(options.method) ? { "X-CSRF-Token": csrfToken() } : {}),
      ...options.headers,
    },
  });
  if (!response.ok) {
    throw new ApiError(response.status, await response.json().catch(() => null));
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function apiBlob(path: string, signal?: AbortSignal): Promise<{ blob: Blob; mediaType: string }> {
  const response = await fetch(apiPath(path), { credentials: "same-origin", cache: "no-store", signal });
  if (!response.ok) throw new ApiError(response.status, await response.json().catch(() => null));
  return { blob: await response.blob(), mediaType: response.headers.get("content-type")?.split(";")[0] ?? "" };
}
