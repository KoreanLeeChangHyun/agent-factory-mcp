import type { FormEvent } from "react";
import type { Density, ThemeBase, ThemeOverrides, ThemeProfile } from "@agent-factory/contracts";

export const defaultThemeProfile = (userId: string): ThemeProfile => ({
  schemaVersion: "1.0",
  userId,
  revision: 0,
  base: "dark",
  density: "compact",
  overrides: {},
  reducedMotion: false,
});

type Palette = Required<ThemeOverrides> & {
  background: string;
  raised: string;
  hover: string;
  accentText: string;
};
const palettes: Record<ThemeBase, Palette> = {
  dark: {
    background: "#11151B",
    surface: "#181D25",
    raised: "#202631",
    hover: "#29313D",
    text: "#E8ECF2",
    accent: "#63A8FF",
    accentText: "#081525",
    focus: "#8FC1FF",
  },
  light: {
    background: "#EEF1F5",
    surface: "#FFFFFF",
    raised: "#F5F7FA",
    hover: "#E7EDF5",
    text: "#17202B",
    accent: "#075FAB",
    accentText: "#FFFFFF",
    focus: "#004F91",
  },
  "high-contrast": {
    background: "#000000",
    surface: "#000000",
    raised: "#111111",
    hover: "#202020",
    text: "#FFFFFF",
    accent: "#FFFF00",
    accentText: "#000000",
    focus: "#00FFFF",
  },
};
const overrideVariables: Record<keyof ThemeOverrides, string> = {
  accent: "--af-accent",
  focus: "--af-focus",
  surface: "--af-surface",
  text: "--af-text",
};
const colorPattern = /^#[0-9A-Fa-f]{6}$/;

function luminance(color: string): number {
  const channels = [1, 3, 5].map((offset) => Number.parseInt(color.slice(offset, offset + 2), 16) / 255);
  const linear = channels.map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
  return 0.2126 * linear[0]! + 0.7152 * linear[1]! + 0.0722 * linear[2]!;
}

export function contrastRatio(first: string, second: string): number {
  const [lighter, darker] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (lighter! + 0.05) / (darker! + 0.05);
}

export function validateResolvedTheme(profile: ThemeProfile): string[] {
  const errors: string[] = [];
  const keys = Object.keys(profile.overrides);
  if (keys.some((key) => !(key in overrideVariables))) errors.push("허용되지 않은 테마 토큰이 있습니다.");
  if (Object.values(profile.overrides).some((value) => !colorPattern.test(value)))
    errors.push("색상은 6자리 16진수 형식이어야 합니다.");
  if (errors.length) return errors;
  const palette = { ...palettes[profile.base], ...profile.overrides };
  const surfaces = [palette.background, palette.surface, palette.raised, palette.hover];
  if (surfaces.some((surface) => contrastRatio(palette.text, surface) < 4.5))
    errors.push("본문과 모든 애플리케이션 표면의 대비는 4.5:1 이상이어야 합니다.");
  if (surfaces.some((surface) => contrastRatio(palette.accent, surface) < 3))
    errors.push("강조색과 모든 애플리케이션 표면의 대비는 3:1 이상이어야 합니다.");
  if (contrastRatio(palette.accent, palette.accentText) < 4.5)
    errors.push("강조색과 강조 글자의 대비는 4.5:1 이상이어야 합니다.");
  if (surfaces.some((surface) => contrastRatio(palette.focus, surface) < 3))
    errors.push("포커스와 모든 애플리케이션 표면의 대비는 3:1 이상이어야 합니다.");
  return errors;
}

export function themeStyle(profile: ThemeProfile): Record<string, string> {
  const style: Record<string, string> = {};
  for (const key of Object.keys(overrideVariables) as (keyof ThemeOverrides)[]) {
    const value = profile.overrides[key];
    if (value && colorPattern.test(value)) style[overrideVariables[key]] = value;
  }
  return style;
}

export function applyTheme(root: HTMLElement, profile: ThemeProfile): void {
  if (validateResolvedTheme(profile).length) throw new Error("invalid resolved theme");
  root.dataset.afTheme = profile.base;
  root.dataset.afDensity = profile.density;
  root.dataset.afReducedMotion = String(profile.reducedMotion);
  for (const variable of Object.values(overrideVariables)) root.style.removeProperty(variable);
  for (const [variable, value] of Object.entries(themeStyle(profile))) root.style.setProperty(variable, value);
}

export function ThemeEditor({
  draft,
  busy = false,
  conflict = false,
  onPreview,
  onSave,
  onReload,
}: {
  draft: ThemeProfile;
  busy?: boolean;
  conflict?: boolean;
  onPreview(profile: ThemeProfile): void;
  onSave(profile: ThemeProfile): void;
  onReload(): void;
}) {
  const errors = validateResolvedTheme(draft);
  const update = (change: Partial<Pick<ThemeProfile, "base" | "density" | "reducedMotion">>) =>
    onPreview({ ...draft, ...change });
  const updateColor = (token: keyof ThemeOverrides, value: string) =>
    onPreview({ ...draft, overrides: { ...draft.overrides, [token]: value } });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!errors.length) onSave(draft);
  };
  return (
    <form className="af-theme-editor" onSubmit={submit} aria-label="테마 편집기">
      <label className="af-field">
        <span>기본 테마</span>
        <select
          className="af-select"
          value={draft.base}
          onChange={(event) => update({ base: event.target.value as ThemeBase })}
          disabled={busy}
        >
          <option value="dark">어둡게</option>
          <option value="light">밝게</option>
          <option value="high-contrast">고대비</option>
        </select>
      </label>
      <label className="af-field">
        <span>밀도</span>
        <select
          className="af-select"
          value={draft.density}
          onChange={(event) => update({ density: event.target.value as Density })}
          disabled={busy}
        >
          <option value="compact">간결하게</option>
          <option value="comfortable">여유 있게</option>
        </select>
      </label>
      {(Object.keys(overrideVariables) as (keyof ThemeOverrides)[]).map((token) => (
        <label className="af-field" key={token}>
          <span>{token}</span>
          <input
            type="color"
            value={draft.overrides[token] ?? palettes[draft.base][token]}
            onChange={(event) => updateColor(token, event.target.value.toUpperCase())}
            disabled={busy}
          />
        </label>
      ))}
      <label className="af-check">
        <input
          type="checkbox"
          checked={draft.reducedMotion}
          onChange={(event) => update({ reducedMotion: event.target.checked })}
          disabled={busy}
        />{" "}
        움직임 줄이기
      </label>
      {errors.length ? <div role="alert">{errors.join(" ")}</div> : null}
      {conflict ? (
        <div role="alert">
          다른 기기에서 테마가 변경되었습니다. 현재 편집 내용은 유지됩니다.
          <button type="button" onClick={onReload}>
            서버 버전 불러오기
          </button>
        </div>
      ) : null}
      <button className="af-button af-button--primary" type="submit" disabled={busy || Boolean(errors.length)}>
        {busy ? "저장 중…" : "저장"}
      </button>
    </form>
  );
}
