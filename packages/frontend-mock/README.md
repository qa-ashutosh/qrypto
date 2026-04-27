# @qrypto/frontend-mock

Minimal but realistic exchange UI — test surface for `@qrypto/e2e-suite`.

Not a product. Not published. Not deployed. Exists solely to provide a stable,
QA-owned browser surface for Playwright e2e tests.

_Last updated: 2024-01-15_

---

## Start

```bash
# From repo root — mock server must be running first
npm run mock:start        # terminal 1
npm run frontend:start    # terminal 2
```

Opens at `http://localhost:3000`. All API calls proxy to `http://localhost:8080`.

---

## Pages

| Path | Route | What it tests |
|---|---|---|
| Login + 2FA | `/` (unauthenticated) | Auth flow, 2FA enforcement, lockout errors |
| Trading | `/trading` | Order placement, order book, ticker, cancel |
| Wallet | `/wallet` | Balances, withdrawal form, transaction history |
| KYC | `/kyc` | Document submission, status states |
| Account | `/account` | Session list, revocation, logout |

---

## Seed users — quick fill

The login page has a quick-fill panel for seed users. Click any row to pre-fill credentials.

| User | Email | State |
|---|---|---|
| Verified + 2FA | verified@qrypto-test.invalid | Full access |
| Unverified | unverified@qrypto-test.invalid | KYC/trade blocked |
| Zero Balance | zero-balance@qrypto-test.invalid | Withdrawal fails |

**Password:** `TestPassword123!` · **2FA code:** `123456`

---

## Test IDs

Every interactive element carries a `data-testid` attribute. Key ones:

| `data-testid` | Element |
|---|---|
| `login-email` | Email input |
| `login-password` | Password input |
| `login-submit` | Submit button |
| `login-error` | Error message |
| `2fa-code` | 2FA code input |
| `2fa-submit` | Verify button |
| `2fa-error` | 2FA error message |
| `nav-trading` | Trading nav link |
| `nav-wallet` | Wallet nav link |
| `nav-kyc` | KYC nav link |
| `nav-account` | Account nav link |
| `nav-logout` | Logout button |
| `pair-BTC-USDT` | Pair selector button |
| `side-buy` / `side-sell` | Buy/Sell tabs |
| `type-limit` / `type-market` | Order type selector |
| `order-price` | Price input |
| `order-quantity` | Quantity input |
| `order-submit` | Place order button |
| `order-error` | Order error message |
| `order-success` | Order success message |
| `cancel-{orderId}` | Cancel order button |
| `kyc-document-type` | Document type select |
| `kyc-submit` | Submit KYC button |
| `kyc-status` | KYC status display |
| `withdraw-currency` | Currency select |
| `withdraw-amount` | Amount input |
| `withdraw-address` | Address input |
| `withdraw-2fa` | 2FA code input |
| `withdraw-submit` | Submit withdrawal |
| `logout-btn` | Account page logout |

---

## Architecture

This package exists because a real QA architect builds their own test surface
when the production one is unavailable or unstable.

See `docs/adr/004-frontend-mock-rationale.md` for the full argument.

**Design decisions:**
- Connects only to `@qrypto/mock-server` — no external calls, no real exchange
- All seed user credentials visible in the UI — this is a test tool, not a product
- `data-testid` attributes on every interactive element — placed deliberately, not incidentally
- Error states are first-class — every failure path renders a testable error element
- Responsive layout — 375px mobile viewport is testable for the trading flow
