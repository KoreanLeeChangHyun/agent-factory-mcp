import { apiBlob, apiRequest } from "../../api-client.js";

const json = (value: unknown): RequestInit => ({ body: JSON.stringify(value) });
export const adminClient = {
  admin: <T>(suffix: string, signal?: AbortSignal) => apiRequest<T>(`/api/admin/${suffix}`, { signal }),
  mutateAdmin: <T>(suffix: string, method: string, input?: unknown) =>
    apiRequest<T>(`/api/admin/${suffix}`, { method, ...(input === undefined ? {} : json(input)) }),
  catalog: () => apiBlob("/admin/assets/"),
};
