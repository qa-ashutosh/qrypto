# qrypto — Architecture

_Last updated: 2024-01-01_

## What this is

qrypto is a production-grade QA automation monorepo for a crypto exchange platform. It covers
the full testing surface: API contracts, browser user journeys, regulatory compliance flows,
load behaviour under market-event conditions, and security attack vectors.

It is built to the standard of a regulated fintech environment — where a decimal bug loses real
money and a KYC bypass is a regulatory breach. Every architectural decision is traceable to a
risk, a maintainability constraint, or a business requirement.

---

## Package Map

```
qrypto/
│
├── @qrypto/shared-types          ← Domain types, Zod schemas, test factories, utilities
│       │                           Built first. Everything else depends on this.
│       │
├── @qrypto/mock-server           ← Standalone exchange mock (HTTP + WebSocket)
│       │                           Published to npm. Zero Docker. Starts in <3s.
│       │
├── @qrypto/frontend-mock         ← Minimal but realistic exchange UI
│       │                           Test surface for the e2e suite.
│       │
├── @qrypto/api-suite    ──────── depends on: shared-types, mock-server
│       │                           Playwright API mode. Every API contract.
│       │
├── @qrypto/e2e-suite    ──────── depends on: shared-types, mock-server, frontend-mock
│       │                           Playwright browser. Critical user journeys.
│       │
├── @qrypto/compliance   ──────── depends on: shared-types, mock-server
│       │                           Cucumber BDD. Compliance officer-readable.
│       │
├── @qrypto/performance  ──────── depends on: mock-server
│       │                           k6 TypeScript. Crypto-specific load profiles.
│       │
└── @qrypto/security     ──────── depends on: shared-types, mock-server
                                    Playwright API mode. Attack surface coverage.
```

### Dependency order

```
shared-types → mock-server → frontend-mock → [all suites]
```

This order is enforced in CI. `shared-types` is built before any consuming package
runs typecheck. The mock server must be healthy before any suite starts.

---

## Package Responsibilities

### `@qrypto/shared-types`

The single source of truth consumed by every other package. Contains:

- **Domain types** — `Order`, `Transaction`, `KycStatus`, `WalletBalance`, `Position`, `FundingRate`, `AmlFlag`, and all supporting types. These are the canonical definitions — no package defines its own domain types.
- **Zod schemas** — Runtime validation at every external input boundary. Schema definitions are co-located with their types; they are not duplicated.
- **Env config** — Zod-validated environment parsing that fails at startup with a clear list of every missing variable. Silent misconfiguration is not acceptable in a financial system.
- **Test data factories** — `userFactory`, `orderFactory`, `walletFactory`, `kycSubmissionFactory`, `amlFactory` — each with traits that represent meaningful domain states, not arbitrary test data.
- **Utilities** — `decimal.util.ts` for all financial arithmetic (never native JS floats), `retry.util.ts` with a `COMPLIANCE_RETRY_OPTIONS` constant that enforces zero retries for compliance tests, `logger.ts` for structured JSON logging with correlation IDs, and `jwt.util.ts` for token issuance, verification, and test helpers including `issueAlgNoneToken` for security tests.

No test runner dependency. Pure TypeScript utility package.

### `@qrypto/mock-server`

A standalone exchange mock server. Published to npm — runnable via `npx @qrypto/mock-server`.

Provides two servers:
- **HTTP** on port 8080 — REST API matching the production exchange contract
- **WebSocket** on port 4000 — live price feeds, order book depth, order events

Key design properties:
- Zero Docker dependency. Node.js only. Starts in under 3 seconds.
- Full state machine for KYC, orders, and sessions — not stub responses.
- Chaos endpoints for injecting latency, forcing error codes, dropping WebSocket connections, and stalling price feeds.
- Admin/QA control endpoints for resetting state between test runs and forcing specific entity states.
- Structured logging with correlation IDs so test failures can be traced through both the test and the server logs.

See `docs/adr/003-mock-server-over-docker.md` for the rationale on the no-Docker decision.

### `@qrypto/frontend-mock`

A minimal but realistic exchange UI. Not a product. Not published. Purely a test surface.

Exists because a real QA architect builds their own test surface when the production application
is unavailable or unstable. Depending on the production frontend for e2e test stability is a
category error — it couples the reliability of your QA signal to a moving target you don't control.

See `docs/adr/004-frontend-mock-rationale.md` for the full argument.

### `@qrypto/api-suite`

Playwright in API mode — no browser overhead. Covers the full API surface:

- Auth flows, 2FA enforcement, token lifecycle, session management
- KYC state machine transitions and withdrawal enforcement
- Wallet operations at satoshi precision
- Trading: order placement, partial fills, stop-loss, margin
- Financial calculations: P&L, liquidation price, funding rates, float precision traps
- Race conditions: concurrent withdrawals, simultaneous order placement

Runs in under 3 minutes. Triggered on every PR (smoke subset) and every merge to develop (full).

### `@qrypto/e2e-suite`

Playwright in full browser mode — Chromium, Firefox, WebKit. Tests only the UI risk surface:
the interactions that must be exercised through a real browser because they involve visual state,
navigation, form behaviour, or accessibility.

Includes:
- WCAG 2.1 AA accessibility assertions via axe-core on every critical page
- Visual regression baselines across pages and viewports
- Lighthouse CI thresholds enforced as pass/fail gates (LCP, TBT, CLS)

Runs nightly. Not on every PR — browser tests are expensive and this suite is not the primary
signal for API contract correctness.

### `@qrypto/compliance`

Cucumber 10 + Gherkin. Every scenario is readable by a compliance officer or product owner
who makes business decisions from the output.

Strict scope rule: if only an engineer would read it, it belongs in `api-suite`. If a
compliance officer reads it and makes a decision, it belongs here.

Zero retries. Always. A compliance test that passes on retry is a silent failure — it would
produce a false regulatory signal. This is enforced by `COMPLIANCE_RETRY_OPTIONS` in
`shared-types/retry.util.ts` and verified in CI.

Generates two reports on every run:
- **Allure** — for engineers and CI dashboards. Trend history, drill-down into failed steps.
- **HTML** — for compliance and audit audiences. Single self-contained file. Plain English. Zero tech jargon. Can be emailed.

### `@qrypto/performance`

k6 TypeScript scenarios covering crypto-specific load profiles:

- Order burst: 500 concurrent market orders
- WebSocket load: 1000 simultaneous price feed subscribers
- Order book poll: sustained high-frequency GET /orderbook
- Withdrawal flood: concurrent withdrawals at scale
- Auth storm: simultaneous logins simulating a brute-force event

Threshold assertions are pass/fail gates — p95 < 200ms, p99 < 500ms, error rate < 0.1%.
Grafana-ready output. Baseline stored in repo; deviations trigger alerts.

### `@qrypto/security`

Playwright API mode. Pure TypeScript. Zero external tooling or services required.

Covers eight attack vectors:
JWT algorithm confusion (alg:none + RS256→HS256), IDOR via enumerated order IDs, withdrawal
field tampering, mass assignment on user profile, 2FA bypass, rate limit bypass via header
manipulation, token reuse after explicit logout, negative balance injection.

Every test documents its attack vector, expected system behaviour, and actual result assertion.
The suite is designed to be readable as a standalone security audit artifact.

---

## Data Flow

```
Test Suite
    │
    ├─→ @qrypto/shared-types   (types, schemas, factories, utilities)
    │
    ├─→ @qrypto/mock-server    (state, responses, WebSocket events)
    │       │
    │       └─→ HTTP :8080 / WS :4000
    │
    └─→ @qrypto/frontend-mock  (e2e-suite only)
            │
            └─→ http://localhost:3000 → talks only to mock-server
```

No test suite talks to the production exchange, Binance Testnet, or any external service.
The mock server is the single source of truth for all state in every test run.

---

## Key Invariants

These properties are enforced everywhere, not aspirational:

**Financial arithmetic** — All financial calculations use `decimal.js` via `decimal.util.ts`.
Native JS float arithmetic in a financial assertion is a bug. ESLint rules are not sufficient
to enforce this — the utility functions make the correct path the default path.

**No shared test state** — Every test is independent. The mock server's `/admin/reset` endpoint
is called in global setup and between test files where necessary. Tests that depend on each
other's state are bugs.

**Compliance: zero retries** — `COMPLIANCE_RETRY_OPTIONS` (maxAttempts: 1) is passed to all
retry-capable operations in the compliance suite. A retry would mask a genuine failure and
produce a false signal for regulatory purposes.

**Env validation at startup** — `parseEnv()` validates and lists every missing variable before
throwing. Packages call this in their global setup. A misconfigured environment fails loudly
before a single test runs.

**BDD scope discipline** — Playwright API tests and Cucumber BDD are not interchangeable.
The compliance suite is for business-readable regulatory scenarios. The api-suite is for
technical correctness. Mixing them degrades both.

---

## CI Strategy

| Trigger | What runs | Time target |
|---|---|---|
| Every PR | Lint, typecheck, commitlint | < 4 min |
| PR (Phase 4+) | + api-suite smoke | < 4 min |
| Merge to develop | api-suite full, e2e smoke, security suite | < 15 min |
| Nightly | All suites, 4 shards, performance baseline | < 45 min |
| Weekly | Compliance full run, security deep scan | < 30 min |
| Manual | Compliance pre-audit, performance spike | on demand |

---

## Docs Index

| Document | Audience | Purpose |
|---|---|---|
| `docs/architecture.md` | Engineers | This document |
| `docs/adr/001-monorepo-decision.md` | Engineers | Why a monorepo |
| `docs/adr/002-npm-workspaces-rationale.md` | Engineers | Why npm workspaces over Turborepo/Nx |
| `docs/adr/003-mock-server-over-docker.md` | Engineers | Why no Docker |
| `docs/adr/004-frontend-mock-rationale.md` | Engineers, hiring | Why we built our own UI |
| `docs/test-strategy.md` | Engineers, QA leads | Risk-based priority framework |
| `docs/onboarding.md` | New engineers | Zero to green in under 10 minutes |
| `docs/runbook.md` | On-call engineers | Operate, monitor, escalate, recover |
| `docs/compliance/RUNBOOK.md` | Compliance officers | Trigger, read, and escalate compliance runs |
| `docs/performance/THRESHOLDS.md` | Engineers, SREs | Every SLA defined and justified |
