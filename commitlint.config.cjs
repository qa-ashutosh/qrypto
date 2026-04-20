/** @type {import('@commitlint/types').UserConfig} */
module.exports = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [
      2,
      "always",
      ["feat", "fix", "docs", "chore", "test", "perf", "security", "revert"],
    ],
    "scope-enum": [
      2,
      "always",
      [
        "shared-types",
        "mock-server",
        "frontend-mock",
        "api-suite",
        "e2e-suite",
        "compliance",
        "performance",
        "security",
        "ci",
        "docs",
        "root",
      ],
    ],
    "scope-empty": [2, "never"],
    "subject-case": [2, "always", "lower-case"],
    "header-max-length": [2, "always", 100],
  },
};
