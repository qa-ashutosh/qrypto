# ADR 001 — Monorepo Structure

_Status: Accepted_
_Date: 2024-01-01_
_Author: QA Platform Team_

---

## Context

The qrypto QA platform consists of eight distinct packages that need to share types, utilities,
and test infrastructure. The question was how to organise them: separate repositories, a monorepo
with a build orchestrator, or a monorepo with npm workspaces alone.

The packages are not independent — they form a layered system with a well-defined dependency
order. `shared-types` is consumed by everything. The mock server is depended on by all five
test suites. This coupling is intentional; it is the property that makes the platform coherent.

The team building this is a QA platform team, not a product engineering team running dozens of
microservices. The tooling choice should match the scale of the problem.

---

## Decision

Use a single npm workspaces monorepo under the `@qrypto` scope.

---

## Consequences

**Positive:**

- A single `npm install` at the root installs all dependencies across all packages. New engineers
  reach a runnable state in minutes, not hours.

- Shared code — types, factories, utilities — is a local workspace dependency. There is no
  publish-install cycle when iterating on shared utilities during development. Changes in
  `shared-types` are immediately available to all consuming packages.

- TypeScript project references enforce the dependency graph at compile time. A package cannot
  accidentally import from a package it does not declare as a dependency.

- A single root `tsconfig.base.json` ensures consistent compiler settings — strict mode, no any,
  exact optional properties — across every package without drift.

- One CI pipeline definition can orchestrate the full dependency-ordered build and test sequence.
  Cross-package failures are visible in a single pipeline run.

- `CHANGELOG.md` at the root tells the coherent story of the platform as a whole. Individual
  package changelogs (mock-server, which is published to npm) track their own history separately.

**Negative / trade-offs:**

- All packages share the same Node.js and npm version. This is acceptable — they are all
  TypeScript, and version alignment is a feature, not a constraint.

- A change in `shared-types` triggers downstream typecheck in all packages. This is intentional:
  breaking changes to shared types should be visible immediately, not discovered when a consuming
  package runs its tests in isolation.

- The monorepo grows over time. This is a QA platform with a defined scope — it will not exhibit
  the unbounded growth that makes large product monorepos difficult.

---

## Alternatives considered

**Multiple separate repositories**

Each package in its own repository with versioned npm dependencies between them.

Rejected. The development loop becomes: edit shared-types → publish → bump version in
consuming package → install → test. This cycle is prohibitive when iterating on the type
definitions or factory methods that underpin all test suites. It optimises for independence
that these packages do not have and do not need.

**Single repository, no workspaces**

Everything in `src/` with subdirectories, no package boundaries.

Rejected. Without package boundaries, import cycles become invisible. The dependency order —
which is architecturally meaningful — becomes implicit and unenforceable. TypeScript project
references require proper package structure to work.

See also: `docs/adr/002-npm-workspaces-rationale.md` for the choice of workspaces tooling.
