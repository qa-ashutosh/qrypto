# @qrypto/api-suite

Playwright API test suite for the qrypto exchange platform.
Zero browser overhead — pure HTTP, runs in under 3 minutes.

_Last updated: 2024-01-15_

---

## Prerequisites

Mock server must be running:
```bash
npm run mock:start
```

## Run

```bash
# Full suite
npm run test:api

# Smoke tests only (PR gate — ~30 seconds)
npm run test:api -- --grep @smoke

# Single domain
npx playwright test --config=packages/api-suite/playwright.config.ts src/tests/auth
```

## Structure

```
src/
├── clients/
│   ├── base.client.ts     — retry, auth injection, logging
│   └── index.ts           — AuthClient, KycClient, WalletClient, TradingClient, AdminClient
├── fixtures/
│   └── index.ts           — SEED_USERS, SEED_ORDERS, SEED_TRANSACTIONS, helpers
├── config/
│   ├── global-setup.ts    — server health check + state reset
│   └── global-teardown.ts
└── tests/
    ├── auth/              — login, 2FA, token lifecycle, sessions, brute-force
    ├── kyc/               — state machine, AML flags, withdrawal enforcement
    ├── wallet/            — satoshi precision, fee accuracy, deposit confirmation
    ├── trading/           — order placement, cancellation, IDOR protection
    ├── calculations/      — P&L precision, float traps, balance invariants
    └── race-conditions/   — concurrent withdrawals, simultaneous orders
```

## Test priorities

| Priority | Description | Examples |
|---|---|---|
| P0 | Financial correctness, auth bypass, regulatory gate | Balance invariants, KYC withdrawal block |
| P1 | State consistency, session management | Brute-force lockout, token rotation |
| P2 | Edge cases, pagination, error messages | Currency filter, 404 on unknown ID |

## Coverage

| Domain | What's tested |
|---|---|
| Auth | Login, 2FA flow, token lifecycle, refresh rotation, logout, session list + revoke, concurrent sessions, IDOR on sessions |
| KYC | Status flags, withdrawal gate for all KYC states, AML flag blocking, document submission state machine |
| Wallet | Satoshi precision, fee accuracy, balance invariant (total = available + reserved), deposit confirmation, insufficient funds |
| Trading | Order placement, market fill, balance reservation, stop-loss validation, cancellation, IDOR on orders, order book, ticker |
| Calculations | 0.1+0.2 float trap, fee precision, multi-operation balance accumulation, decimal precision per currency |
| Race Conditions | Double-spend prevention, balance over-allocation, parallel KYC |
