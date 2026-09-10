import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

/**
 * Test runner config, kept separate from vite.config so the app build is
 * untouched. Scope: CRM regression tests (route guard, permission gating,
 * Can/useCan, API client shape, customer deep-link). jsdom env for the
 * component/hook tests; `@` alias mirrors the app.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    css: false,
  },
});
