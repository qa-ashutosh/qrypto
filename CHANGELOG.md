# Changelog

All notable changes to the qrypto monorepo are documented here.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
Versioning: [Semantic Versioning](https://semver.org/spec/v2.0.0.html)

Every phase completion produces a new minor version entry.
No version bump ships without a CHANGELOG entry. Every entry maps to real commits.

---

## [Unreleased]

---

## [0.5.0] — 2026-07-02

_Phase 5 — E2E Suite_

### Added

- `@qrypto/e2e-suite` complete implementation — Playwright full-browser E2E
  suite running against `@qrypto/frontend-mock`. Chromium, Firefox, WebKit,
  and mobile (375px) viewport coverage.

- Page Object Models for all five pages:
  - `BasePage` — navigation, error detection, loading state helpers
  - `LoginPage` + `TwoFactorPage` — login form, 2FA verification, back navigation
  - `KycPage` — document type selector, submission, status display
  - `WalletPage` — balance cards, withdrawal form, deposit address
  - `TradingPage` — pair selector, buy/sell tabs, order form, order book
  - `AccountPage` — session list, 2FA status, logout

- Critical user journey tests:
  - Complete login + 2FA flow landing on trading page
  - Login without 2FA (direct full scope)
  - Invalid credentials error rendering
  - Back navigation from 2FA to login
  - Invalid 2FA code error state
  - KYC status display for all five states (unverified, pending, rejected, approved)
  - KYC document submission transitions status to pending
  - Withdrawal success for verified user
  - Withdrawal blocked for unverified user (KYC error rendered)
  - Withdrawal failure for zero-balance user
  - Limit and market order placement
  - Order failure for zero-balance user
  - Pair switching updates order book
  - Order book live polling (2s interval)
  - Buy/sell tab label switching
  - Logout redirects to login
  - Account page 2FA status, session list, logout

- Mobile viewport tests at 375px — trading flow fully operable on narrow viewport.

- Accessibility suite via `@axe-core/playwright` — WCAG 2.1 AA assertions
  on all five critical pages (login, trading, wallet, KYC, account).
  Zero violations required to pass.

- Global setup — health checks for both mock server and frontend before
  any test runs. State reset to seed values.

- `workers: 1` — stateful mock server requires serial execution (same
  reasoning as api-suite).

- `packages/e2e-suite/README.md` — run instructions, project matrix,
  scope definition, data-testid reference pointer.

- Root `package.json` bumped to `0.5.0`.

---

## [0.4.0] — 2026-05-03

_Phase 4 — API Suite_

### Added

- `@qrypto/api-suite` complete implementation — Playwright API test suite,
  zero browser overhead, full suite runs in under 3 minutes.

- `BaseApiClient` — retry with exponential backoff, auth token injection,
  correlation ID on every request, rate-limit (429) handling, typed error parsing.

- Domain clients: `AuthClient`, `KycClient`, `WalletClient`, `TradingClient`,
  `AdminClient` — typed methods for every mock server endpoint. `AuthClient.loginFull()`
  convenience method completes the full password + 2FA flow in one call.

- `src/fixtures/index.ts` — `SEED_USERS`, `SEED_ORDERS`, `SEED_TRANSACTIONS` catalogs
  mirroring mock server seed data. Tests reference users by semantic key, not raw UUID.

- **Auth tests** — login (with/without 2FA), invalid credentials, 5-attempt brute-force
  lockout, pre_2fa scope enforcement, token revocation after 2FA, refresh rotation, logout
  revocation, malformed token rejection, session list, session IDOR protection, concurrent
  sessions all independently valid.

- **KYC tests** — capability flags for all KYC states, withdrawal gate for unverified/
  pending/rejected, AML flag blocking, clearing AML re-enables withdrawals, trading gate,
  admin KYC approval immediately enables trading, document submission state machine,
  double-submission rejection (409).

- **Wallet tests** — satoshi-level seed balance assertions (string equality, never
  parseFloat), balance invariant (total = available + reserved) verified after every
  operation, BTC fee exactly 0.00010000, USDT fee exactly 1.000000, insufficient funds
  on amount+fee exceeding balance, balance unchanged on failed withdrawal, deposit
  confirmation credits correct amount, currency filter, pagination.

- **Trading tests** — limit/market order placement, market order fills immediately,
  balance reservation on limit order, limit order requires price, stop order requires
  stopPrice, insufficient balance rejection, status filter, IDOR protection (other user's
  order returns 404), cancellation of open order, 409 on filled/cancelled order, order
  book bids < asks, invalid pair 400.

- **Calculation tests** — 0.1 + 0.2 float precision trap (documented and tested),
  fee is 0.1% of notional, multi-withdrawal balance accumulation precision, balance
  invariant after withdrawal and deposit confirmation, decimal precision per currency
  (8dp BTC/ETH, 6dp stablecoins).

- **Race condition tests** — two simultaneous 4000 USDT withdrawals from 5000 balance
  (at most one succeeds), three concurrent BTC withdrawals from insufficient balance,
  simultaneous orders do not over-allocate, parallel KYC submissions (only one succeeds,
  others get 409).

- Global setup — server health check with retry before first test, full state reset
  to seed values. Tests cannot start if mock server is not healthy.

- `packages/api-suite/README.md` — run instructions, test structure, coverage map,
  P0/P1/P2 priority classification.

- Root `package.json` bumped to `0.4.0`.

---

## [0.3.0] — 2026-04-27

_Phase 3 — Frontend Mock_

### Added

- `@qrypto/frontend-mock` complete implementation — minimal but realistic exchange UI
  serving as the dedicated test surface for `@qrypto/e2e-suite`. Not published, not
  deployed, owned entirely by the QA platform.

- Five pages covering the full exchange user journey:
  - Login + 2FA — email + password, 2FA verification flow, brute-force lockout error,
    seed user quick-fill panel, back-to-credentials from 2FA
  - Trading — pair selector (BTC/USDT, ETH/USDT, ETH/BTC), buy/sell tabs, limit/market
    order form, live order book polling (2s), price ticker with 24h change, open orders
    list with per-order cancel
  - Wallet — multi-currency balance cards, withdrawal form (KYC gate, AML gate, 2FA),
    paginated transaction history, deposit address lookup
  - KYC — document type selector, submission flow, KYC status with capability flags,
    all status states rendered (pending, under_review, approved, rejected, rekyc_required)
  - Account — active session list with revoke, security info panel, sign out

- Dark terminal design system — IBM Plex Mono + IBM Plex Sans, electric amber accent
  (#f5a623), semantic green/red for buy/sell and profit/loss, scanline texture overlay,
  full CSS variable palette in `index.css`.

- `data-testid` attributes on every interactive element — placed deliberately to support
  specific e2e test scenarios, documented in `packages/frontend-mock/README.md`.

- Error states as first-class citizens — every failure path renders a distinct, testable
  error element. Failed login, locked account, KYC rejection, insufficient funds, invalid
  2FA — all visually distinct and `data-testid`'d.

- Vite dev proxy — all API calls proxy to `http://localhost:8080`. No hardcoded ports
  in components. Zero CORS configuration.

- Mobile viewport support — responsive layout operable at 375px.

- `packages/frontend-mock/README.md` — startup instructions, page map, complete
  `data-testid` reference table.

- `packages/mock-server/API.md` — full production-grade API reference: every endpoint,
  request/response shapes, error codes, rate limits, WebSocket protocol, chaos mode
  examples, seed user catalog with IDs.

- `docs/adr/004-frontend-mock-rationale.md` — why a QA architect builds their own test
  surface. The most portfolio-differentiating decision in the platform.

- Root `package.json` version bumped to `0.3.0`. `lint-staged` config added.

---

## [0.2.0] — 2026-04-21

_Phase 2 — Mock Server_

### Added

- `@qrypto/mock-server` complete implementation — standalone exchange mock server
  published to npm, runnable via `npx @qrypto/mock-server`. Zero Docker dependency.
  Starts in under 3 seconds.

- HTTP server on port 8080 with structured JSON request/response logging and
  correlation IDs on every request.

- Auth routes (`/auth`): login with brute-force lockout (5 attempts -> 30 min lock),
  `pre_2fa` -> `full` scope upgrade flow, token rotation on refresh, session list and
  per-session revocation.

- KYC routes (`/kyc`): document submission triggering the full state machine
  (unverified -> pending -> under_review -> approved/rejected), status with capability
  flags (canWithdraw, canTrade), document list.

- Wallet routes (`/wallet`): multi-currency balances, withdrawal with KYC gate, AML
  gate, and 2FA validation. All arithmetic via `decimal.js`. Paginated transaction
  history, deposit addresses per currency.

- Trading routes (`/trading`): order placement (market/limit/stop) with balance
  reservation, IDOR-protected order access, cancellation, order book depth, price
  ticker, filled trade history.

- Admin/QA control routes (`/admin`): `POST /admin/reset` for guaranteed test
  isolation, force KYC status, force AML flags, confirm pending deposits, health
  check with state summary, seed user catalog with credentials.

- Chaos mode via `POST /admin/chaos`: configurable response latency, forced HTTP
  error codes, WebSocket connection drops, stale price feed injection.

- WebSocket server on port 4000: `ticker:<pair>` channel (1s, random walk price),
  `orderbook:<pair>` channel (2s depth snapshots). Chaos integration: `dropWebSocket`
  terminates all connections, `stalePriceFeedSeconds` pauses ticker updates.

- Seed data: 9 users covering every KYC/AML lifecycle state with hardcoded IDs
  (`SEED_USER_IDS` catalog), pre-funded multi-currency wallets, 3 seed orders
  (open/partial/filled), 4 seed transactions including a pending deposit.

- In-memory rate limiting: 10 login attempts per 15 min, 10 withdrawals per hour,
  100 API calls per minute. Cleared by `POST /admin/reset`.

- `packages/mock-server/CHANGELOG.md` — npm consumer changelog.
- `packages/mock-server/README.md` — npx quickstart, endpoint reference, admin API
  docs, chaos mode guide, seed user catalog, rate limit table.
- `docs/adr/003-mock-server-over-docker.md` — rationale for standalone Node.js server
  over Docker.

### Security

- JWT algorithm rejection — `alg:none` and RS256->HS256 confusion attacks blocked
  at the middleware layer. `issueAlgNoneToken` helper in `shared-types` enables
  security suite to test this attack vector.
- Timing-safe token comparison in JWT verification.
- IDOR protection on all order endpoints — users can only access their own orders.
- Session deletion now revokes the associated token via `revokedSessions` set.

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
    - `userFactory` with `.withKyc()`, `.withAmlFlag()`, `.locked()`, `.inactive()` etc.
    - `sessionFactory` with `.pre2fa()`, `.expired()`, `.revoked()`
    - `orderFactory` with `.partial()`, `.market()`, `.atMarketPrice()`, `.stopLoss()` etc.
    - `walletFactory` with `.withLowBalance()`, `.zeroed()`, `.withReserved()` etc.
    - `transactionFactory`, `kycSubmissionFactory`, `amlFactory` with full trait coverage

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

[Unreleased]: https://github.com/qa-ashutosh/qrypto/compare/v0.5.0...HEAD
[0.5.0]: https://github.com/qa-ashutosh/qrypto/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/qa-ashutosh/qrypto/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/qa-ashutosh/qrypto/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/qa-ashutosh/qrypto/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/qa-ashutosh/qrypto/releases/tag/v0.1.0