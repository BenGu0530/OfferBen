// Shared, monorepo-wide ESLint config (flat). Prettier owns *formatting*;
// ESLint owns *correctness* — dead imports, `==` vs `===`, unused vars, etc.
// Kept intentionally lenient (most things `warn`, `any` allowed) so it flags
// real problems without drowning an MVP in style noise. Run: `npm run lint`.
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import unusedImports from "eslint-plugin-unused-imports";
import reactHooks from "eslint-plugin-react-hooks";
import prettier from "eslint-config-prettier";
import globals from "globals";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/.next/**",
      "**/dist/**",
      "**/build/**",
      "**/coverage/**",
      "**/.turbo/**",
    ],
  },

  // Baseline for every JS/TS file.
  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    plugins: { "unused-imports": unusedImports },
    rules: {
      // Auto-removable dead imports — the single most useful autofix for
      // keeping PR diffs clean. `--fix` strips these on save via the hook.
      "unused-imports/no-unused-imports": "error",
      // Unused vars: warn (not autofixable — needs human intent). `_`-prefixed
      // args/vars are deliberate and ignored.
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "unused-imports/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" },
      ],
      // Correctness nudges.
      eqeqeq: ["warn", "smart"],
      "prefer-const": "warn",
      // The AI-parsing / schema layer legitimately deals in `any`/`unknown`.
      "@typescript-eslint/no-explicit-any": "off",
    },
  },

  // React hooks correctness for the web app (the plugin ships just two rules:
  // rules-of-hooks + exhaustive-deps — exactly the useEffect-dependency class
  // of bug, no style noise).
  {
    files: ["apps/web/**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },

  // The extension is intentionally plain JS with no bundler: files share
  // globals across <script> tags and the injected content scripts, so
  // `no-undef` (cross-file) and top-level "unused" functions (they're the
  // cross-file API) are false positives. Its ternary statements
  // (`ok ? a++ : b++`) are deliberate. Give it the right environment instead.
  {
    files: ["apps/extension/**/*.js"],
    languageOptions: {
      globals: { ...globals.browser, ...globals.webextensions, chrome: "readonly" },
      sourceType: "script",
    },
    rules: {
      "no-undef": "off",
      "unused-imports/no-unused-vars": "off",
      "@typescript-eslint/no-unused-expressions": ["error", { allowTernary: true, allowShortCircuit: true }],
    },
  },

  // Tests (Vitest) + Node config files.
  {
    files: ["**/*.test.ts", "**/test/**", "**/*.config.{js,mjs,ts}"],
    languageOptions: { globals: { ...globals.node } },
  },

  // Prettier LAST — turns off every rule that would fight the formatter.
  prettier,
);
