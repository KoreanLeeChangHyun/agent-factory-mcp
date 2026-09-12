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
});
