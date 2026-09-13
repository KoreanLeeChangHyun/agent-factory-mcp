import { describe, expect, it } from "vitest";
import { defaultThemeProfile, themeStyle, validateResolvedTheme } from "../../../packages/design-system/src/theme.js";

describe("semantic theme resolution", () => {
  it("validates combined contrast", () => {
    const profile = defaultThemeProfile("0123456789abcdef0123456789abcdef");
    expect(validateResolvedTheme(profile)).toEqual([]);
    expect(validateResolvedTheme({ ...profile, overrides: { surface: "#181D25", text: "#202631" } })).toContain(
      "본문과 모든 애플리케이션 표면의 대비는 4.5:1 이상이어야 합니다.",
    );
  });

  it("maps only allowlisted semantic variables", () => {
    const profile = { ...defaultThemeProfile("0123456789abcdef0123456789abcdef"), overrides: { accent: "#FFFFFF" } };
    expect(themeStyle(profile)).toEqual({ "--af-accent": "#FFFFFF" });
  });
});
