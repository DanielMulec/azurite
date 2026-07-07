import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import jsdoc from "eslint-plugin-jsdoc";
import jsxA11y from "eslint-plugin-jsx-a11y";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

const codeFileLineLimit = 400;

const sharedTypeScriptRules = {
  "@typescript-eslint/no-explicit-any": "error",
  "@typescript-eslint/no-floating-promises": "error",
  "@typescript-eslint/no-misused-promises": "error",
  "@typescript-eslint/no-non-null-assertion": "error",
  "@typescript-eslint/no-unnecessary-condition": "error",
  "@typescript-eslint/no-unsafe-argument": "error",
  "@typescript-eslint/no-unsafe-assignment": "error",
  "@typescript-eslint/no-unsafe-call": "error",
  "@typescript-eslint/no-unsafe-member-access": "error",
  "@typescript-eslint/no-unsafe-return": "error",
  "@typescript-eslint/strict-boolean-expressions": "error",
  "@typescript-eslint/switch-exhaustiveness-check": "error",
  complexity: ["error", 3],
  curly: "error",
  eqeqeq: "error",
  "max-depth": ["error", 2],
  "max-lines-per-function": [
    "error",
    { max: 60, skipBlankLines: true, skipComments: true },
  ],
  "max-params": ["error", 3],
  "no-implied-eval": "error",
  "no-var": "error",
  "prefer-const": "error",
};

export default tseslint.config(
  {
    ignores: [
      "**/coverage/**",
      "**/dist/**",
      "**/node_modules/**",
      "eslint.config.mjs",
      "pnpm-lock.yaml",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  prettier,
  {
    files: ["**/*.{cjs,js,jsx,mjs,ts,tsx}"],
    rules: {
      "max-lines": [
        "error",
        {
          max: codeFileLineLimit,
          skipBlankLines: false,
          skipComments: false,
        },
      ],
    },
  },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        ...globals.browser,
        ...globals.es2024,
        ...globals.node,
      },
    },
    rules: sharedTypeScriptRules,
  },
  {
    files: ["apps/*/src/**/*.{ts,tsx}", "packages/*/src/**/*.{ts,tsx}"],
    plugins: {
      jsdoc,
    },
    rules: {
      "jsdoc/require-description": "error",
      "jsdoc/require-jsdoc": [
        "error",
        {
          contexts: [
            "ExportNamedDeclaration > ClassDeclaration",
            "ExportNamedDeclaration > TSEnumDeclaration",
            "ExportNamedDeclaration > TSInterfaceDeclaration",
            "ExportNamedDeclaration > TSTypeAliasDeclaration",
            "ExportNamedDeclaration > VariableDeclaration",
          ],
          publicOnly: {
            ancestorsOnly: true,
            cjs: false,
            esm: true,
            window: false,
          },
          require: {
            ClassDeclaration: true,
            FunctionDeclaration: true,
          },
        },
      ],
    },
  },
  {
    files: ["apps/web/**/*.{ts,tsx}"],
    plugins: {
      "jsx-a11y": jsxA11y,
      "react-hooks": reactHooks,
    },
    rules: {
      ...jsxA11y.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      "no-console": "error",
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@azurite/server",
              message: "The web app must not import server internals.",
            },
          ],
        },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message:
            "Only the approved sanitized markdown renderer may use dangerouslySetInnerHTML.",
        },
      ],
    },
  },
  {
    files: ["apps/server/**/*.{ts,tsx}"],
    rules: {
      "no-console": "off",
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@azurite/web",
              message: "The server must not import web app code.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["packages/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@azurite/server",
              message: "Shared packages must not import app packages.",
            },
            {
              name: "@azurite/web",
              message: "Shared packages must not import app packages.",
            },
          ],
        },
      ],
    },
  },
);
