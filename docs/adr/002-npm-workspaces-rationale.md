# ADR 002 — npm Workspaces Over Turborepo / Nx

_Status: Accepted_
_Date: 2024-01-01_
_Author: QA Platform Team_

---

## Context

Having decided on a monorepo (ADR 001), the next decision was which tooling to use to manage
the workspace: npm workspaces alone, Turborepo, or Nx.

Turborepo and Nx both offer build caching, task parallelism, dependency graph visualisation,
and remote caching. They are widely used and well-documented. The question was whether the
additional capability justifies the additional dependency and complexity for this project.

---

## Decision

Use npm workspaces only. No Turborepo. No Nx.

---

## Rationale

**The dependency graph is simple and stable.**

There are eight packages with a well-defined, documented dependency order. This is not a
product monorepo with fifty packages and complex inter-dependencies where a build orchestrator's
dependency graph visualisation earns its place. The order is: `shared-types` → `mock-server` →
`frontend-mock` → suites. That fits in a single line of documentation.

**Build orchestration is not the bottleneck.**

The primary CI concern for this platform is test execution time — specifically, running five
test suites in parallel against a live mock server. npm workspaces with `--workspace` flags and
GitHub Actions matrix jobs handles this cleanly. Turborepo's incremental build cache does not
help with the dominant cost: running Playwright tests.

**Tooling should match the team's mental model.**

Every engineer on a QA platform team knows how npm workspaces work. Adding Turborepo or Nx
introduces concepts — pipeline definitions, task graphs, caching semantics — that require
ongoing familiarity to operate correctly. When a CI pipeline fails at 2 AM, the operator should
be diagnosing a test failure, not debugging a build orchestrator cache invalidation.

**Dependencies are a liability in a test infrastructure package.**

`@qrypto/mock-server` is published to npm. Its dependency tree should be as shallow as
possible. A build orchestrator is a devDependency and would not affect the published package,
but it sets a norm for the project: add tools only when they solve a real problem.

**The complexity is addable later.**

If the package count grows significantly, or if remote caching becomes valuable for CI cost
reduction, Turborepo can be adopted incrementally. The inverse — removing a build orchestrator
from a project that does not need it — is a larger change. Start simple.

---

## What npm workspaces provides

- `npm install` at root installs all workspace package dependencies
- `npm run <script> --workspaces --if-present` runs a script across all packages
- `npm run <script> --workspace=packages/<name>` targets a single package
- TypeScript project references enforce the dependency graph at compile time
- `package.json` `workspaces` field makes workspace packages available as local dependencies

This covers 100% of the cross-package orchestration needed for this project.

---

## Alternatives considered

**Turborepo**

Provides incremental builds, remote caching, and parallel task execution with dependency
awareness.

Would add value in a larger monorepo where incremental builds materially reduce CI time.
Does not add meaningful value here given the package count and the fact that test execution
(not compilation) dominates CI runtime.

**Nx**

Provides a superset of Turborepo's capabilities plus generators, executors, and a plugin
ecosystem.

The additional capability is the reason it was not chosen: it introduces a large surface area
of configuration and concepts that this project does not need. Nx is appropriate for large
engineering organisations managing many product teams in one repository.

---

## Review trigger

Revisit this decision if the package count exceeds 15 or if CI compile times exceed 5 minutes.
