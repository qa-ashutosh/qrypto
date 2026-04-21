# ADR 003 — Standalone Mock Server Over Docker

_Status: Accepted_
_Date: 2024-01-15_
_Author: QA Platform Team_

---

## Context

The test suites need a realistic exchange backend to run against. The options were:

1. A Docker-based mock — containerised service, started via `docker-compose`
2. A standalone Node.js server — started directly, zero container overhead
3. The production application itself — always-on staging environment

The choice affects setup time, CI dependency surface, and the barrier to running tests locally.

---

## Decision

Build a standalone Node.js mock server, published to npm as `@qrypto/mock-server`.
No Docker. No container runtime dependency. Starts in under 3 seconds.

---

## Rationale

**Docker is an infrastructure dependency, not a test tool.**

Requiring Docker to run tests means every engineer needs Docker Desktop (or an equivalent) installed and running before they can execute a single test. On a new machine this is a 10-minute setup task. In CI this is an additional layer that can fail independently of the tests themselves — Docker daemon not running, image pull rate limits, layer cache misses, network bridging issues.

The 10-minute git-clone-to-first-green-run requirement in the master prompt is not achievable if Docker is in the critical path.

**A Node.js process starts in under 3 seconds.**

The mock server is pure JavaScript/TypeScript. Starting it is `node dist/index.js`. There are no images to pull, no containers to orchestrate, no port mapping to configure. In CI, the server is started as a background process in the same job, tested for health via `GET /admin/health`, and killed when the suite completes. This is one step in a shell script.

**The mock server is the test infrastructure, not a product.**

Docker is appropriate when the thing being containerised needs to run in isolation from the host — production services, databases with persistent state, services with complex runtime dependencies. The mock server has none of these properties. It is a test fixture. Its state is in memory, intentionally ephemeral, and reset between test runs via `POST /admin/reset`. The isolation that Docker provides is not needed and adds friction.

**Published to npm for zero-install use by consumers.**

Because the mock server has no runtime dependencies beyond Node.js, it can be published to npm and run via `npx @qrypto/mock-server`. Any engineer with Node.js installed can start a fully functional exchange mock in one command without cloning this repository. This is useful for teams integrating against the mock API from their own test suites.

---

## Trade-offs Accepted

**No network isolation between the mock server and the test runner.**

Both run on `localhost`. This is intentional — network isolation between a test runner and its mock server adds complexity without benefit. The tests are not testing network topology.

**State is not durable across process restarts.**

This is the correct behaviour for a test fixture. The seed data is deterministic and version-controlled. `POST /admin/reset` restores the known state at any point. Durable state would make tests order-dependent and harder to reason about.

**Single process — no horizontal scaling.**

The mock server is not designed for production scale. The performance suite tests the mock server's behaviour under load to validate that the test infrastructure does not become the bottleneck, but we do not claim the mock server is production-grade. It is not. It is a test tool.

---

## Review Trigger

Revisit if the mock server needs persistent state between test runs (unlikely given the reset model), or if the test suite needs to run against multiple mock server instances simultaneously (addressable by running on different ports without Docker).
