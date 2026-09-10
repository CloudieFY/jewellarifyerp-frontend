// Minimal flat config for ESLint 9 (the repo shipped ESLint 9 with no config,
// so `npm run lint` crashed). Uses only devDependencies already in package.json.
// Deliberately conservative: it enforces the high-value React-hooks rules and
// leaves stylistic / `any` rules relaxed so it does not turn the large
// pre-existing ERP codebase red. Type-aware linting is intentionally NOT
// enabled (slow, needs extra project wiring) — `tsc --noEmit` remains the type
// gate.

import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";

export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "coverage/**",
      "*.config.js",
      "*.config.ts",
      "vite.config.*",
      "vitest.config.*",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: { ...globals.browser, ...globals.es2021 },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],

      // High-signal — keep as errors.
      "react-hooks/rules-of-hooks": "error",
      "no-debugger": "error",

      // Relaxed so the pre-existing ERP code doesn't hard-fail CI. tsc already
      // enforces unused locals/params; `any` is pervasive in this codebase.
      "react-hooks/exhaustive-deps": "warn",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", ignoreRestSiblings: true },
      ],
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/ban-ts-comment": "off",
      "no-empty": ["warn", { allowEmptyCatch: true }],
      "no-useless-escape": "warn",
      "prefer-const": "warn",
      "no-case-declarations": "warn",
      "no-fallthrough": "warn",

      // Two PRE-EXISTING ERP issues trip these as errors and would keep CI red
      // on debt unrelated to this work:
      //   src/components/InvoiceBranding.tsx:154  (empty object pattern)
      //   src/routes/inventory.tsx:935            (dead else-if branch)
      // Downgraded to warn so `npm run lint` is usable now; the ERP owners
      // should fix those two lines and restore these to "error".
      "no-empty-pattern": "warn",
      "no-dupe-else-if": "warn",
    },
  },
  {
    // CRM code is new — hold it to a stricter bar than the legacy ERP baseline.
    files: ["src/routes/crm/**/*.{ts,tsx}", "src/components/crm/**/*.{ts,tsx}", "src/lib/crm.ts"],
    rules: {
      "no-empty-pattern": "error",
      "no-dupe-else-if": "error",
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
  {
    files: ["src/**/*.{test,spec}.{ts,tsx}", "src/test/**/*.{ts,tsx}"],
    languageOptions: { globals: { ...globals.node } },
  },
);
