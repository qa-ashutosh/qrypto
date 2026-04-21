# Changelog

All notable changes to the qrypto monorepo are documented here.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
Versioning: [Semantic Versioning](https://semver.org/spec/v2.0.0.html)

Every phase completion produces a new minor version entry.
No version bump ships without a CHANGELOG entry. Every entry maps to real commits.

---

## [Unreleased]

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

[Unreleased]: https://github.com/qrypto/qrypto/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/qrypto/qrypto/releases/tag/v0.1.0
