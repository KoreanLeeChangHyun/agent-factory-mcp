import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(eslint.configs.recommended, ...tseslint.configs.recommended, {
  ignores: [
    "**/dist/**",
    "**/dist-types/**",
    "static/**",
    "assets/**",
    "packages/contracts-ts/src/generated/validators.js",
  ],
}, {
  // Playwright scripts are CommonJS and mix Node code with page.evaluate() callbacks that read page globals,
  // so undefined-name checks cannot tell the two contexts apart.
  files: ["tests/**/browser/**/*.cjs", "tests/**/tools/**/*.cjs"],
  languageOptions: { sourceType: "commonjs" },
  rules: { "@typescript-eslint/no-require-imports": "off", "no-undef": "off" },
}, {
  files: ["tests/**/tools/**/*.mjs"],
  rules: { "no-undef": "off" },
}, {
  // Served into a sandboxed preview page; the server injects packageData before this script.
  files: ["apps/api/http/routes/knowledge/preview_runtime.js"],
  languageOptions: {
    sourceType: "script",
    globals: Object.fromEntries(["document", "addEventListener", "atob", "btoa", "URL", "DOMParser",
      "TextDecoder", "TextEncoder", "packageData"].map((name) => [name, "readonly"])),
  },
});
