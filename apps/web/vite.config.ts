import process from "node:process";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

const apiTarget = process.env.WORKBENCH_API_TARGET;
const proxy = apiTarget ? { "/api": { target: apiTarget } } : undefined;

export default defineConfig({
  base: "/workbench/",
  build: { manifest: true },
  plugins: [react()],
  server: proxy ? { proxy } : undefined,
  preview: proxy ? { proxy } : undefined,
  test: {
    exclude: ["**/node_modules/**", "**/dist/**", "**/dist-types/**"],
  },
});
