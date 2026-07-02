# @qrypto/e2e-suite

Playwright full-browser E2E suite for the qrypto QA platform.
Tests the UI risk surface against `@qrypto/frontend-mock`.

_Last updated: 2024-01-15_

---

## Prerequisites

Both services must be running:

```bash
# Terminal 1
npm run mock:start

# Terminal 2
npm run frontend:start
```

## Run

```bash
# Full suite — all browsers
npm run test:e2e

# Smoke tests only
npm run test:e2e -- --grep @smoke

# Accessibility tests only
npm run test:e2e -- --grep @a11y

# Mobile viewport tests only
npm run test:e2e -- --grep @mobile

# Single browser
npx playwright test --config=packages/e2e-suite/playwright.config.ts --project=chromium

# Show last report
npm run report --workspace=packages/e2e-suite
```

## Structure

```
src/
├── pages/             — Page Object Models
│   ├── BasePage.ts    — navigation, error detection, loading states
│   ├── LoginPage.ts   — login form + TwoFactorPage
│   ├── KycPage.ts     — KYC submission and status
│   ├── WalletPage.ts  — balances, withdrawal form, deposit
│   ├── TradingPage.ts — order form, order book, pair selector
│   └── AccountPage.ts — sessions, security, logout
├── fixtures/
│   └── index.ts       — SEED_USERS, loginViaUI(), resetMockServer()
├── config/
│   └── global-setup.ts — health checks + state reset
└── tests/
    ├── auth/          — login flow, 2FA, logout, session timeout
    ├── kyc/           — status display, document submission
    ├── wallet/        — balance display, withdrawal form, deposit
    ├── trading/       — order placement, order book, mobile viewport
    ├── account/       — sessions, 2FA status, logout
    └── accessibility/ — WCAG 2.1 AA via axe-core
```

## Test scope — what this suite tests

The e2e suite tests the **UI risk surface** — what only a browser can verify:
- Form validation and feedback
- Navigation state after actions
- Error message rendering
- Accessibility compliance
- Visual layout at different viewports

It does **not** duplicate api-suite tests. API contract correctness,
financial precision, KYC state machine logic — those live in api-suite.

## Browsers

| Project | When |
|---|---|
| Chromium | All tests |
| Firefox | Auth + wallet + trading |
| WebKit | Auth + wallet |
| Mobile (375px) | `*.mobile.test.ts` only |

## data-testid reference

See `packages/frontend-mock/README.md` for the complete `data-testid` table.
