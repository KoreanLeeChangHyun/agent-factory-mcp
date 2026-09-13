import { apiRequest } from "../../api-client.js";
import type { SessionUser } from "./account-types.js";

export const accountClient = {
  me: (signal?: AbortSignal) => apiRequest<{ user: SessionUser }>("/api/auth/me", { signal }),
  sessions: (signal?: AbortSignal) => apiRequest<Record<string, unknown>[]>("/api/auth/sessions", { signal }),
  tokens: (signal?: AbortSignal) => apiRequest<Record<string, unknown>[]>("/api/auth/tokens", { signal }),
  revokeSession: (id: string) => apiRequest<void>(`/api/auth/sessions/${id}`, { method: "DELETE" }),
  revokeToken: (id: string) => apiRequest<void>(`/api/auth/tokens/${id}`, { method: "DELETE" }),
  logout: () => apiRequest<void>("/api/auth/logout", { method: "POST" }),
};
