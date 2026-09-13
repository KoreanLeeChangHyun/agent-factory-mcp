import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  root: fileURLToPath(new URL("..", import.meta.url)),
  esbuild: { jsx: "automatic" },
  test: { include: ["tests/**/*.test.{ts,tsx}", "tests/**/*.spec.{ts,tsx}"], exclude: ["**/node_modules/**", "**/dist/**"] },
});
