/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
    project: ["./packages/*/tsconfig.json"],
  },
  plugins: ["@typescript-eslint", "import"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended-type-checked",
    "plugin:@typescript-eslint/stylistic-type-checked",
    "plugin:import/recommended",
    "plugin:import/typescript",
    "prettier",
  ],
  rules: {
    // Financial code: no unsafe arithmetic paths
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/no-unsafe-assignment": "error",
    "@typescript-eslint/no-unsafe-call": "error",
    "@typescript-eslint/no-unsafe-member-access": "error",
    "@typescript-eslint/no-unsafe-return": "error",
    "@typescript-eslint/no-floating-promises": "error",
    "@typescript-eslint/await-thenable": "error",
    "@typescript-eslint/no-misused-promises": "error",
    "@typescript-eslint/consistent-type-imports": [
      "error",
      { prefer: "type-imports" },
    ],
    "@typescript-eslint/consistent-type-exports": "error",
    "import/order": [
      "error",
      {
        groups: [
          "builtin",
          "external",
          "internal",
          "parent",
          "sibling",
          "index",
        ],
        "newlines-between": "always",
        alphabetize: { order: "asc" },
      },
    ],
    "import/no-cycle": "error",
    "no-console": ["warn", { allow: ["warn", "error"] }],
  },
  settings: {
    "import/resolver": {
      typescript: {
        project: ["./packages/*/tsconfig.json"],
      },
    },
  },
  ignorePatterns: [
    "dist/",
    "node_modules/",
    "*.js",
    "*.cjs",
    "*.mjs",
    "coverage/",
    "allure-results/",
    "allure-report/",
  ],
};
