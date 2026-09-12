import type { ThemeProfile } from "@agent-factory/contracts";
import { validate, ContractValidationError } from "@agent-factory/contracts";
import { apiPath } from "./api-path.js";

export interface ThemeContext {
  userId: string;
  organizationId: string;
  workspaceId: string;
}

interface CachedTheme {
  version: 1;
  context: ThemeContext;
  profile: ThemeProfile;
}

export class ThemeConflict extends Error {
  constructor(public readonly current: ThemeProfile) {
    super("theme profile revision conflict");
  }
}

const profileSchema = "schemas/appearance/v1/theme-profile.schema.json";
const key = ({ userId, organizationId, workspaceId }: ThemeContext) =>
  `agent-factory:theme:v1:${userId}:${organizationId}:${workspaceId}`;

function validProfile(value: unknown, userId: string): ThemeProfile | null {
  try {
    validate(value, profileSchema);
    const profile = value as ThemeProfile;
    return profile.userId === userId.replaceAll("-", "") ? profile : null;
  } catch (error) {
    if (error instanceof ContractValidationError) return null;
    throw error;
  }
}

export function readCachedTheme(context: ThemeContext): ThemeProfile | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(key(context)) ?? "null") as CachedTheme | null;
    if (!parsed || parsed.version !== 1 || JSON.stringify(parsed.context) !== JSON.stringify(context)) return null;
    return validProfile(parsed.profile, context.userId);
  } catch {
    return null;
  }
}

export function writeCachedTheme(context: ThemeContext, profile: ThemeProfile): void {
  if (!validProfile(profile, context.userId)) return;
  try {
    localStorage.setItem(key(context), JSON.stringify({ version: 1, context, profile } satisfies CachedTheme));
  } catch {
    // Storage is an optional first-paint optimization.
  }
}

export function clearThemeCache(context: ThemeContext): void {
  try {
    localStorage.removeItem(key(context));
  } catch {
    /* Storage may be unavailable. */
  }
}

function csrfToken(): string | undefined {
  const encoded = document.cookie
    .split("; ")
    .find((part) => part.startsWith("agent_factory_csrf="))
    ?.split("=")
    .slice(1)
    .join("=");
  return encoded ? decodeURIComponent(encoded) : undefined;
}

async function payload(response: Response): Promise<unknown> {
  return response.json().catch(() => null);
}

export class ThemeClient {
  private generation = 0;
  private controller?: AbortController;

  cancel(): void {
    this.generation += 1;
    this.controller?.abort();
  }

  async load(context: ThemeContext): Promise<ThemeProfile> {
    const generation = ++this.generation;
    this.controller?.abort();
    this.controller = new AbortController();
    const response = await fetch(apiPath("/api/appearance/theme-profile"), {
      credentials: "same-origin",
      cache: "no-store",
      signal: this.controller.signal,
    });
    if (!response.ok) throw new Error("테마를 불러오지 못했습니다.");
    const profile = validProfile(await payload(response), context.userId);
    if (generation !== this.generation) throw new DOMException("stale theme response", "AbortError");
    if (!profile) throw new Error("서버가 유효하지 않은 테마를 반환했습니다.");
    writeCachedTheme(context, profile);
    return profile;
  }

  async save(context: ThemeContext, profile: ThemeProfile): Promise<ThemeProfile> {
    const generation = this.generation;
    const response = await fetch(apiPath("/api/appearance/theme-profile"), {
      method: "PUT",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", ...(csrfToken() ? { "X-CSRF-Token": csrfToken()! } : {}) },
      body: JSON.stringify({
        base: profile.base,
        density: profile.density,
        overrides: profile.overrides,
        reducedMotion: profile.reducedMotion,
        expectedRevision: profile.revision,
      }),
    });
    const body = (await payload(response)) as { detail?: { current?: unknown; messages?: string[] } } | null;
    if (generation !== this.generation) throw new DOMException("stale theme response", "AbortError");
    if (response.status === 409) {
      const current = validProfile(body?.detail?.current, context.userId);
      if (current) {
        writeCachedTheme(context, current);
        throw new ThemeConflict(current);
      }
    }
    if (!response.ok) throw new Error(body?.detail?.messages?.join(" ") || "테마를 저장하지 못했습니다.");
    const saved = validProfile(body, context.userId);
    if (!saved) throw new Error("서버가 유효하지 않은 테마를 반환했습니다.");
    writeCachedTheme(context, saved);
    return saved;
  }
}
