// @ts-check

import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  // Global ignore patterns
  {
    ignores: [
      "dist/",
      "node_modules/",
      "prisma/",
      "*.config.*",
    ],
  },

  // Apply recommended rules
  js.configs.recommended,
  ...tseslint.configs.recommended,

  // Main configuration for source files
  {
    files: ["src/**/*.ts"],
    rules: {
      // Override strict TypeScript rules
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["warn", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
      }],

      // Node.js environment
      "no-console": "off",

      // General best practices
      "prefer-const": "error",
      "no-var": "error",
      "eqeqeq": ["error", "always", { null: "ignore" }],
      "curly": ["warn", "multi-line"],
    },
  }
);
