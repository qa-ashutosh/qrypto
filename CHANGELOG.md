# Changelog

All notable changes to the qrypto monorepo are documented here.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
Versioning: [Semantic Versioning](https://semver.org/spec/v2.0.0.html)

Every phase completion produces a new minor version entry.
No version bump ships without a CHANGELOG entry. Every entry maps to real commits.

---

## [Unreleased]

---

## [0.2.0] — 2026-04-21

_Phase 2 — Mock Server_

### Added

- `@qrypto/mock-server` complete implementation — standalone exchange mock server
  published to npm, runnable via `npx @qrypto/mock-server`. Zero Docker dependency.
  Starts in under 3 seconds.

- **HTTP server** on port 8080 with structured JSON request/response logging and
  correlation IDs on every request. All routes return `{ data }` / `{ code, message }`
  envelope format consistent with a real exchange API.

- **Auth routes** (`/auth`): login with brute-force lockout (5 attempts → 30 min lock),
  `pre_2fa` → `full` scope upgrade flow, token rotation on refresh, session list and
  per-session revocation.

- **KYC routes** (`/kyc`): document submission triggering the full state machine
  (`unverified → pending → under_review → approved/rejected`), status with capability
  flags (`canWithdraw`, `canTrade`), document list.

- **Wallet routes** (`/wallet`): multi-currency balances, withdrawal with KYC gate +
  AML gate + 2FA validation, all arithmetic via `decimal.js`, paginated transaction
  history, deposit addresses per currency.

- **Trading routes** (`/trading`): order placement (market/limit/stop) with balance
  reservation, IDOR-protected order access, cancellation, order book depth, price
  ticker, filled trade history.

- **Admin/QA control routes** (`/admin`): `POST /admin/reset` for guaranteed test
  isolation, force KYC status, force AML flags, confirm pending deposits, health check
  with state summary, seed user catalog with credentials.

- **Chaos mode** via `POST /admin/chaos`: configurable response latency, forced HTTP
  error codes, WebSocket connection drops, stale price feed injection. All chaos resets
  via `DELETE /admin/chaos`. Admin routes are always exempt from chaos.

- **WebSocket server** on port 4000: `ticker:<pair>` channel (1s interval, random walk
  price simulation), `orderbook:<pair>` channel (2s interval depth snapshots). Chaos
  integration: `dropWebSocket` terminates all connections, `stalePriceFeedSeconds`
  pauses ticker updates.

- **Seed data**: 9 users covering every KYC/AML lifecycle state with hardcoded IDs
  (`SEED_USER_IDS` catalog), pre-funded multi-currency wallets, 3 seed orders
  (open/partial/filled), 4 seed transactions (confirmed deposits, confirmed withdrawal,
  pending deposit). All accessible via `GET /admin/users`.

- **In-memory rate limiting**: 5 login attempts per 15 min, 10 withdrawals per hour,
  100 API calls per minute. Cleared by `POST /admin/reset`.

- `packages/mock-server/CHANGELOG.md` — npm consumer changelog tracking mock server
  changes independently of the monorepo root.

- `packages/mock-server/README.md` — npx quickstart, full endpoint reference, admin
  API docs, chaos mode guide, seed user catalog, rate limit table.

- `docs/adr/003-mock-server-over-docker.md` — rationale for standalone Node.js server
  over Docker: setup time, no container runtime dependency, publishable to npm,
  10-minute green run requirement.

---

## [0.1.0] — 2026-04-20

_Phase 1 — Platform Foundation_

### Added

- Monorepo scaffold with npm workspaces. Eight packages scoped under `@qrypto/*`,
  all wired as workspace dependencies in the correct dependency order.

- `@qrypto/shared-types` — complete implementation:
  - All domain TypeScript types: `User`, `Session`, `Order`, `Position`, `Transaction`,
    `WalletBalance`, `Ticker`, `OrderBook`, `KycSubmission`, `AmlCheck`, `FundingRate`,
    `DepositAddress`, and all supporting enums and branded scalar types (`UserId`,
    `SessionId`, `AssetAmount`, `CorrelationId`).
  - Zod schemas for every domain type, all API request payloads, and all response wrappers.
    `OrderRequestSchema` includes cross-field validation (limit orders require `price`,
    stop orders require `stopPrice`).
  - `env.config.ts` — Zod-validated environment parsing. Fails at startup with a formatted
    list of every missing or invalid variable. Never fails mid-test.
  - `decimal.util.ts` — All financial arithmetic via `decimal.js`. Includes `calculateFee`,
    `calculatePnl`, `calculateLiquidationPrice`, `toSatoshiPrecision`, and
    `isWithinTolerance`. Native JS float arithmetic is not used anywhere in the codebase.
  - `retry.util.ts` — Configurable retry with exponential backoff and jitter.
    `COMPLIANCE_RETRY_OPTIONS` (maxAttempts: 1) enforces the zero-retry invariant for
    compliance tests at the configuration level.
  - `logger.ts` — Structured JSON logger with correlation ID support. `.child()` and
    `.withCorrelation()` for tracing related log entries across a test run.
  - `jwt.util.ts` — `issueToken`, `verifyToken` (timing-safe signature comparison,
    algorithm validation), `decodeTokenUnsafe` (test use only), `issueExpiredToken`,
    `issueAlgNoneToken` (for security suite algorithm confusion tests), `JwtError` with
    typed error codes.
  - Test data factories with domain-meaningful traits:
    - `userFactory` — `.withKyc()`, `.withPendingKyc()`, `.withRejectedKyc()`,
      `.withAmlFlag()`, `.withSanctionsFlag()`, `.locked()`, `.inactive()`,
      `.requiresReKyc()`, `.buildMany()`
    - `sessionFactory` — `.pre2fa()`, `.expired()`, `.revoked()`
    - `orderFactory` — `.partial()`, `.market()`, `.atMarketPrice()`, `.stopLoss()`,
      `.filled()`, `.cancelled()`, `.rejected()`, `.large()`, `.buildRequest()`,
      `.buildMany()`
    - `walletFactory` — `.withLowBalance()`, `.zeroed()`, `.withReserved()`,
      `.buildPortfolio()`
    - `transactionFactory` — `.pendingDeposit()`, `.confirmedWithdrawal()`,
      `.failed()`, `.fee()`
    - `kycSubmissionFactory` — `.underReview()`, `.approved()`, `.rejected()`,
      `.reKycRequired()`
    - `amlFactory` — `.clean()`, `.highVelocity()`, `.sanctionsMatch()`, `.resolved()`

- Root `tsconfig.base.json` — strict TypeScript 5.5+ configuration applied uniformly
  across all packages: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
  `noImplicitOverride`.

- Root `.eslintrc.cjs` — ESLint with `@typescript-eslint/recommended-type-checked`.
  Rules enforce no-any, no-unsafe-*, floating promise detection, import cycle prevention,
  and consistent type imports.

- Commitlint with `@commitlint/config-conventional`. Scope enum enforced for all eleven
  valid scopes. Husky pre-commit and commit-msg hooks wired.

- `.github/workflows/ci-pr.yml` — PR pipeline: lint, typecheck across all packages,
  format check, and commit message validation. Target: under 4 minutes.

- `.github/PULL_REQUEST_TEMPLATE.md` — Structured PR checklist including financial
  correctness, compliance impact, and security impact sections.

- `docs/architecture.md` — System overview, package map, data flow, key invariants,
  CI strategy, and docs index.

- `docs/adr/001-monorepo-decision.md` — Rationale for monorepo structure.

- `docs/adr/002-npm-workspaces-rationale.md` — Rationale for npm workspaces over
  Turborepo and Nx.

- Stub `package.json` files for all seven downstream packages, establishing the
  workspace dependency graph before their implementations are built.

---

[Unreleased]: https://github.com/qrypto/qrypto/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/qrypto/qrypto/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/qrypto/qrypto/releases/tag/v0.1.0
