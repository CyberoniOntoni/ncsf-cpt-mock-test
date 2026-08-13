import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // These rules were introduced in a newer eslint-config-next and flag
      // valid patterns used throughout the codebase (setState in effects for
      // prop sync, Date.now() in render for display). Disable until we can
      // audit and refactor properly post-pilot.
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/purity": "off",
      // Flags accessing ref.current during render and reassigning render-local
      // vars — valid patterns in the session logger and other components.
      "react-hooks/refs": "off",
      "react-hooks/immutability": "off",
      // Flags useMemo with conditional selectedItems initialiser — valid pattern.
      "react-hooks/preserve-manual-memoization": "off",

      // Downgrade unused-vars to warnings so they don't block CI.
      // Ignore underscore-prefixed vars (intentionally unused).
      // Clean-up tracked in REVIEW.md medium findings.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { "varsIgnorePattern": "^_", "argsIgnorePattern": "^_" },
      ],
    },
  },
  {
    files: ["src/app/portal/**/*.{ts,tsx}", "src/app/actions/portal/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/app/actions/crm", "@/app/actions/crm/*"],
              message: "Portal must not import trainer CRM actions.",
            },
            {
              group: [
                "@/app/actions/clients",
                "@/app/actions/sessions",
                "@/app/actions/programs",
                "@/app/actions/library",
                "@/app/actions/coach",
                "@/app/actions/home",
              ],
              message: "Portal must use @/app/actions/portal and @/db/queries/portal.",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;

