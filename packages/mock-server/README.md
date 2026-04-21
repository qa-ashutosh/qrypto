# @qrypto/mock-server

Standalone exchange mock server for the qrypto QA platform.
Zero Docker. Starts in under 3 seconds. Runnable via `npx`.

_Last updated: 2024-01-15_

---

## Quickstart

```bash
npx @qrypto/mock-server
```

That's it. The server starts with sane defaults and seed data ready to use.

```
HTTP   →  http://localhost:8080
WS     →  ws://localhost:4000
```

---

## Configuration

All configuration is via environment variables. Every variable has a default — zero config required for local development.

| Variable | Default | Description |
|---|---|---|
| `MOCK_SERVER_PORT` | `8080` | HTTP server port |
| `MOCK_WS_PORT` | `4000` | WebSocket server port |
| `JWT_SECRET` | `qrypto-dev-secret-...` | JWT signing secret (use a real secret in CI) |
| `JWT_ACCESS_TTL_SECONDS` | `900` | Access token lifetime |
| `JWT_REFRESH_TTL_SECONDS` | `604800` | Refresh token lifetime |
| `LOG_LEVEL` | `info` | `debug` \| `info` \| `warn` \| `error` |
| `NODE_ENV` | `development` | `development` \| `test` \| `production` |

---

## Seed User Catalog

All seed users share the same password and 2FA code.

| Key | Email | State |
|---|---|---|
| `VERIFIED` | verified@qrypto-test.invalid | KYC approved, 2FA enabled, funded |
| `UNVERIFIED` | unverified@qrypto-test.invalid | No KYC, no 2FA |
| `KYC_PENDING` | kyc-pending@qrypto-test.invalid | KYC submitted, under review |
| `KYC_REJECTED` | kyc-rejected@qrypto-test.invalid | KYC rejected |
| `AML_FLAGGED` | aml-flagged@qrypto-test.invalid | AML flag: suspicious_transaction_pattern |
| `LOCKED` | locked@qrypto-test.invalid | 5 failed logins, locked for 30 min |
| `REKYC_REQUIRED` | rekyc@qrypto-test.invalid | Re-KYC required, 2FA enabled |
| `SANCTIONED` | sanctioned@qrypto-test.invalid | Sanctions match, AML flagged |
| `ZERO_BALANCE` | zero-balance@qrypto-test.invalid | KYC approved, zero balance |

**Password:** `TestPassword123!`
**2FA code:** `123456` (or `000000`)

---

## Endpoint Reference

### Auth — `/auth`

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/auth/login` | — | Login with email + password |
| `POST` | `/auth/2fa/verify` | pre_2fa | Complete 2FA verification |
| `POST` | `/auth/refresh` | any | Rotate tokens |
| `POST` | `/auth/logout` | any | Revoke current token |
| `GET` | `/auth/sessions` | full | List active sessions |
| `DELETE` | `/auth/sessions/:id` | full | Revoke a session |

### KYC — `/kyc`

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/kyc/submit` | full | Submit KYC documents |
| `GET` | `/kyc/status` | full | Get KYC status + capability flags |
| `GET` | `/kyc/documents` | full | List submitted documents |

### Wallet — `/wallet`

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/wallet/balances` | full | All currency balances |
| `GET` | `/wallet/balances/:currency` | full | Single currency balance |
| `POST` | `/wallet/withdraw` | full | Submit withdrawal |
| `GET` | `/wallet/transactions` | full | Transaction history (paginated) |
| `GET` | `/wallet/deposit/address/:currency` | full | Deposit address |

### Trading — `/trading`

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/trading/orders` | full | Place an order |
| `GET` | `/trading/orders` | full | List orders |
| `GET` | `/trading/orders/:id` | full | Get order by ID |
| `DELETE` | `/trading/orders/:id` | full | Cancel an order |
| `GET` | `/trading/orderbook/:pair` | — | Order book depth |
| `GET` | `/trading/ticker/:pair` | — | Price ticker |
| `GET` | `/trading/history` | full | Trade history |

### Admin — `/admin` (QA control, no auth)

| Method | Path | Description |
|---|---|---|
| `GET` | `/admin/health` | Liveness check |
| `GET` | `/admin/users` | Seed user catalog |
| `POST` | `/admin/reset` | Reset all state to seed |
| `POST` | `/admin/kyc/:id/force` | Force KYC status |
| `POST` | `/admin/aml/:id/force` | Force AML flags |
| `POST` | `/admin/deposit/confirm` | Confirm pending deposit |
| `POST` | `/admin/chaos` | Configure chaos |
| `DELETE` | `/admin/chaos` | Reset chaos |

---

## Authentication

The server issues JWTs with two scope levels:

- **`pre_2fa`** — issued after password login when 2FA is enabled. Only `POST /auth/2fa/verify` is accessible.
- **`full`** — issued after 2FA completion (or directly when 2FA is disabled). All protected routes are accessible.

Include in requests as: `Authorization: Bearer <token>`

---

## WebSocket

Connect to `ws://localhost:4000` and subscribe to channels:

```json
{ "action": "subscribe", "channels": ["ticker:BTC/USDT", "orderbook:ETH/USDT"] }
```

**Available channels:**

| Channel | Frequency | Description |
|---|---|---|
| `ticker:<pair>` | 1s | Price tick with random walk |
| `orderbook:<pair>` | 2s | Order book depth snapshot |

**Supported pairs:** `BTC/USDT`, `ETH/USDT`, `BTC/USD`, `ETH/USD`, `ETH/BTC`

---

## Admin API

### Reset state

Call this in `beforeAll` / `afterAll` to guarantee test isolation:

```bash
curl -X POST http://localhost:8080/admin/reset
```

### Force KYC status

```bash
curl -X POST http://localhost:8080/admin/kyc/<userId>/force \
  -H 'Content-Type: application/json' \
  -d '{ "status": "approved" }'
```

Valid statuses: `unverified`, `pending`, `under_review`, `approved`, `rejected`, `rekyc_required`

### Confirm a pending deposit

```bash
curl -X POST http://localhost:8080/admin/deposit/confirm \
  -H 'Content-Type: application/json' \
  -d '{ "transactionId": "<txId>" }'
```

### Force AML flags

```bash
curl -X POST http://localhost:8080/admin/aml/<userId>/force \
  -H 'Content-Type: application/json' \
  -d '{ "flags": ["suspicious_transaction_pattern"] }'
```

---

## Chaos Mode

Configure chaos to simulate adverse conditions:

```bash
# Inject 500ms latency on all responses
curl -X POST http://localhost:8080/admin/chaos \
  -H 'Content-Type: application/json' \
  -d '{ "latencyMs": 500 }'

# Force HTTP 503 on all non-admin responses
curl -X POST http://localhost:8080/admin/chaos \
  -H 'Content-Type: application/json' \
  -d '{ "forceErrorCode": 503 }'

# Drop all WebSocket connections
curl -X POST http://localhost:8080/admin/chaos \
  -H 'Content-Type: application/json' \
  -d '{ "dropWebSocket": true }'

# Stale price feed for 10 seconds
curl -X POST http://localhost:8080/admin/chaos \
  -H 'Content-Type: application/json' \
  -d '{ "stalePriceFeedSeconds": 10 }'

# Reset chaos to defaults
curl -X DELETE http://localhost:8080/admin/chaos
```

**Important:** Admin routes are always exempt from chaos. Test control always works.

---

## Rate Limits

| Endpoint | Limit |
|---|---|
| `POST /auth/login` | 5 requests per 15 minutes per IP |
| `POST /wallet/withdraw` | 10 requests per hour per IP |
| All other routes | 100 requests per minute per IP |

Rate limit state is cleared by `POST /admin/reset`.
