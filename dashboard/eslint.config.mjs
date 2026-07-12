// @ts-check

import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  // Global ignore patterns
  {
    ignores: [
      ".next/",
      "node_modules/",
      "public/",
      "next-env.d.ts",
      "next.config.js",
      "postcss.config.js",
      "tailwind.config.ts",
    ],
  },

  // Apply recommended rules
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...tseslint.configs.stylistic,

  // Main configuration for source files
  {
    files: ["src/**/*.ts", "src/**/*.tsx"],
    rules: {
      // Override strict TypeScript rules
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["warn", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
      }],

      // General best practices
      "prefer-const": "error",
      "no-var": "error",
      "eqeqeq": ["error", "always", { null: "ignore" }],
      "curly": ["warn", "multi-line"],
    },
  }
);
