import { createContext, useContext, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { ThemeProfile } from "@agent-factory/contracts";
import { applyTheme, defaultThemeProfile, ThemeEditor } from "@agent-factory/design-system";
import { ThemeClient, ThemeConflict, readCachedTheme, type ThemeContext } from "./theme-client.js";

const anonymousProfile = defaultThemeProfile("00000000000000000000000000000000");
interface ThemeSettingsValue {
  draft: ThemeProfile;
  status: string;
  busy: boolean;
  conflict: boolean;
  preview(profile: ThemeProfile): void;
  save(profile: ThemeProfile): Promise<void>;
  reload(): void;
}
const ThemeSettingsContext = createContext<ThemeSettingsValue | null>(null);

export function ThemeSettingsPanel() {
  const settings = useContext(ThemeSettingsContext);
  if (!settings) return <p role="status">개인 테마를 불러오는 중입니다.</p>;
  return (
    <section className="theme-settings" aria-labelledby="theme-settings-title">
      <h2 id="theme-settings-title">개인 테마</h2>
      <p role="status">{settings.status}</p>
      <ThemeEditor
        draft={settings.draft}
        busy={settings.busy}
        conflict={settings.conflict}
        onPreview={settings.preview}
        onSave={settings.save}
        onReload={settings.reload}
      />
    </section>
  );
}

export function ThemeBootstrap({ scope, children }: { scope: ThemeContext | null; children: ReactNode }) {
  const client = useRef(new ThemeClient()).current;
  const editGeneration = useRef(0);
  const [context, setContext] = useState<ThemeContext | null>(null);
  const [server, setServer] = useState<ThemeProfile | null>(null);
  const [draft, setDraft] = useState<ThemeProfile | null>(null);
  const [status, setStatus] = useState("인증된 계정 테마를 기다리는 중입니다.");
  const [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState(false);

  useLayoutEffect(() => {
    let active = true;
    const loadEditGeneration = ++editGeneration.current;
    client.cancel();
    applyTheme(document.documentElement, anonymousProfile);
    setContext(scope);
    setServer(null);
    setDraft(null);
    setBusy(false);
    setConflict(false);
    if (!scope) {
      setStatus("인증된 계정 테마를 기다리는 중입니다.");
      return () => {
        active = false;
        client.cancel();
        applyTheme(document.documentElement, anonymousProfile);
      };
    }

    const fallback = readCachedTheme(scope) ?? defaultThemeProfile(scope.userId.replaceAll("-", ""));
    applyTheme(document.documentElement, fallback);
    setDraft(fallback);
    setStatus("서버 테마를 불러오는 중입니다.");
    void client
      .load(scope)
      .then((authoritative) => {
        if (!active) return;
        setServer(authoritative);
        if (editGeneration.current === loadEditGeneration) {
          applyTheme(document.documentElement, authoritative);
          setDraft(authoritative);
          setStatus("서버 테마를 적용했습니다.");
        } else {
          setStatus("서버 테마를 불러왔지만 미리보기는 아직 저장되지 않았습니다.");
        }
      })
      .catch((error: unknown) => {
        if (active && !(error instanceof DOMException && error.name === "AbortError"))
          setStatus(error instanceof Error ? error.message : "테마를 불러오지 못했습니다.");
      });
    return () => {
      active = false;
      client.cancel();
      applyTheme(document.documentElement, anonymousProfile);
    };
  }, [client, scope?.organizationId, scope?.userId, scope?.workspaceId]);

  const preview = (profile: ThemeProfile) => {
    editGeneration.current += 1;
    applyTheme(document.documentElement, profile);
    setDraft(profile);
    setConflict(false);
    setStatus("미리보기 중이며 아직 저장되지 않았습니다.");
  };
  const save = async (profile: ThemeProfile) => {
    if (!context) return;
    editGeneration.current += 1;
    setBusy(true);
    setConflict(false);
    setStatus("저장 중입니다.");
    try {
      const saved = await client.save(context, profile);
      applyTheme(document.documentElement, saved);
      setServer(saved);
      setDraft(saved);
      setStatus("서버에 저장했습니다.");
    } catch (error) {
      if (error instanceof ThemeConflict) {
        setServer(error.current);
        setConflict(true);
        setStatus("변경 충돌이 있습니다. 편집 내용은 유지했습니다.");
      } else if (!(error instanceof DOMException && error.name === "AbortError")) {
        setStatus(
          error instanceof Error
            ? `${error.message} 편집 내용은 유지했습니다.`
            : "저장하지 못했습니다. 편집 내용은 유지했습니다.",
        );
      }
    } finally {
      setBusy(false);
    }
  };

  if (!draft && !scope) return <>{children}</>;
  if (!draft)
    return (
      <main className="theme-loading" role="status">
        {status}
      </main>
    );
  const reloadServer = () => {
    if (server) {
      applyTheme(document.documentElement, server);
      setDraft(server);
    }
    setConflict(false);
    setStatus("서버 버전을 적용했습니다.");
  };
  const settings = { draft, status, busy, conflict, preview, save, reload: reloadServer };
  return <ThemeSettingsContext.Provider value={settings}>{children}</ThemeSettingsContext.Provider>;
}
