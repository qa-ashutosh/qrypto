# @qrypto/mock-server — Changelog

All notable changes to the mock server npm package are documented here.
This file is for npm consumers who install `@qrypto/mock-server`.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
Versioning: [Semantic Versioning](https://semver.org/spec/v2.0.0.html)

---

## [Unreleased]

---

## [0.2.0] — 2024-01-15

Initial release of `@qrypto/mock-server`.

### Added

- HTTP server on port 8080 (configurable via `MOCK_SERVER_PORT`)
- WebSocket server on port 4000 (configurable via `MOCK_WS_PORT`)
- Zero Docker dependency — Node.js only, starts in under 3 seconds
- `npx @qrypto/mock-server` quickstart with zero configuration required

**Auth routes** (`/auth`):
- `POST /auth/login` — email + password, issues `pre_2fa` token when 2FA is enabled
- `POST /auth/2fa/verify` — completes 2FA, upgrades to full-scope token
- `POST /auth/refresh` — refresh token rotation
- `POST /auth/logout` — revokes current token
- `GET /auth/sessions` — lists active sessions
- `DELETE /auth/sessions/:id` — revokes a specific session

**KYC routes** (`/kyc`):
- `POST /kyc/submit` — document submission, triggers state machine
- `GET /kyc/status` — current KYC status and capability flags
- `GET /kyc/documents` — submitted document list

**Wallet routes** (`/wallet`):
- `GET /wallet/balances` — all currency balances
- `GET /wallet/balances/:currency` — single currency balance
- `POST /wallet/withdraw` — withdrawal with KYC gate, AML gate, decimal.js arithmetic
- `GET /wallet/transactions` — paginated transaction history
- `GET /wallet/deposit/address/:currency` — deposit address per currency

**Trading routes** (`/trading`):
- `POST /trading/orders` — place market/limit/stop orders
- `GET /trading/orders` — list orders (filterable by status)
- `GET /trading/orders/:id` — single order with IDOR protection
- `DELETE /trading/orders/:id` — cancel open order
- `GET /trading/orderbook/:pair` — order book depth snapshot
- `GET /trading/ticker/:pair` — price ticker
- `GET /trading/history` — filled trade history

**Admin/QA control routes** (`/admin`):
- `GET /admin/health` — liveness check with state summary
- `GET /admin/users` — seed user catalog with credentials
- `POST /admin/reset` — wipe all state, reinitialise from seed
- `POST /admin/kyc/:id/force` — force user KYC status
- `POST /admin/aml/:id/force` — force AML flags on user
- `POST /admin/deposit/confirm` — confirm a pending deposit
- `POST /admin/chaos` — configure chaos behaviour
- `DELETE /admin/chaos` — reset chaos to defaults

**WebSocket channels** (port 4000):
- `ticker:<pair>` — price tick every 1 second with random walk
- `orderbook:<pair>` — depth snapshot every 2 seconds
- Subscribe via: `{ "action": "subscribe", "channels": ["ticker:BTC/USDT"] }`

**Chaos mode**:
- `latencyMs` — inject artificial response latency
- `forceErrorCode` — force all non-admin responses to a specific HTTP status
- `dropWebSocket` — terminate all WebSocket connections immediately
- `stalePriceFeedSeconds` — pause ticker updates for N seconds

**Seed data**:
- 9 seed users covering every KYC/AML lifecycle state
- Pre-funded wallets for BTC, ETH, USDT, USDC, USD
- Open, partially-filled, and filled seed orders
- Confirmed and pending seed transactions
- All seed credentials: password `TestPassword123!`, 2FA code `123456`

---

[Unreleased]: https://github.com/qrypto/qrypto/compare/mock-server/v0.2.0...HEAD
[0.2.0]: https://github.com/qrypto/qrypto/releases/tag/mock-server/v0.2.0
