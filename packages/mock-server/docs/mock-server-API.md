# @qrypto/mock-server — API Reference

**Version:** 0.2.0  
**Base URL:** `http://localhost:8080`  
**WebSocket:** `ws://localhost:4000`  
**Last updated:** 2026-04-20

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Request & Response Format](#request--response-format)
4. [Error Codes](#error-codes)
5. [Rate Limiting](#rate-limiting)
6. [Auth Routes](#auth-routes) — `/auth`
7. [KYC Routes](#kyc-routes) — `/kyc`
8. [Wallet Routes](#wallet-routes) — `/wallet`
9. [Trading Routes](#trading-routes) — `/trading`
10. [Admin Routes](#admin-routes) — `/admin`
11. [WebSocket](#websocket)
12. [Chaos Mode](#chaos-mode)
13. [Seed User Catalog](#seed-user-catalog)

---

## Overview

The mock server replicates the API surface of a crypto exchange platform. It is the single backend dependency for all qrypto test suites. Every route mirrors real exchange behaviour including KYC gates, AML checks, 2FA enforcement, balance validation, and IDOR protection.

**Key behaviours:**
- All protected routes require a `Bearer` token in the `Authorization` header
- Financial amounts are always strings, never floats — `"0.50000000"` not `0.5`
- All state is in-memory and resets via `POST /admin/reset`
- Structured JSON logs with correlation IDs are emitted on every request

---

## Authentication

The server uses JWT-based authentication with two scope levels.

| Scope | Issued when | Access |
|---|---|---|
| `pre_2fa` | After password login, when 2FA is enabled | Only `POST /auth/2fa/verify` |
| `full` | After 2FA completion, or directly when 2FA is disabled | All protected routes |

**Include tokens in every protected request:**

```
Authorization: Bearer <access_token>
```

**Token flow for users with 2FA enabled:**

```
POST /auth/login  →  pre_2fa token
POST /auth/2fa/verify  →  full token
All other routes  →  full token required
```

**Token flow for users without 2FA:**

```
POST /auth/login  →  full token directly
All other routes  →  full token required
```

---

## Request & Response Format

**All requests** with a body must include:
```
Content-Type: application/json
```

**Success responses** wrap data in a `data` envelope:
```json
{
  "data": { ... }
}
```

**Paginated responses** include a `meta` object:
```json
{
  "data": [...],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 47
  }
}
```

**Error responses** use a consistent `code` + `message` shape:
```json
{
  "code": "INSUFFICIENT_FUNDS",
  "message": "Insufficient available balance",
  "available": "0.00100000",
  "required": "0.01010000"
}
```

**Every response** includes an `x-correlation-id` header for tracing:
```
x-correlation-id: 3bbf6098-2f20-418a-9871-4c2566d8118c
```

---

## Error Codes

| Code | HTTP Status | Description |
|---|---|---|
| `UNAUTHORIZED` | 401 | Missing, invalid, or expired token |
| `TOKEN_REVOKED` | 401 | Token has been explicitly revoked |
| `EXPIRED` | 401 | Token has expired |
| `INVALID_SIGNATURE` | 401 | Token signature verification failed |
| `INVALID_CREDENTIALS` | 401 | Wrong email or password |
| `INVALID_2FA_CODE` | 401 | Wrong or expired 2FA code |
| `INSUFFICIENT_SCOPE` | 403 | `pre_2fa` token used on a `full`-only route |
| `ACCOUNT_INACTIVE` | 403 | Account is suspended |
| `ACCOUNT_LOCKED` | 423 | Too many failed login attempts |
| `KYC_REQUIRED` | 403 | KYC approval required for this action |
| `ACCOUNT_RESTRICTED` | 403 | Account under AML review |
| `INSUFFICIENT_FUNDS` | 422 | Not enough available balance |
| `INVALID_AMOUNT` | 400 | Amount is zero or negative |
| `INVALID_CURRENCY` | 400 | Unknown currency symbol |
| `INVALID_PAIR` | 400 | Unknown trading pair |
| `VALIDATION_ERROR` | 400 | Request body failed schema validation |
| `NOT_FOUND` | 404 | Resource does not exist or belongs to another user |
| `ORDER_NOT_CANCELLABLE` | 409 | Order is already filled or cancelled |
| `KYC_ALREADY_SUBMITTED` | 409 | KYC already pending or approved |
| `RATE_LIMITED` | 429 | Too many requests — see `Retry-After` header |
| `MALFORMED` | 400 | JWT cannot be decoded |
| `ALGORITHM_REJECTED` | 400 | JWT uses a disallowed algorithm (e.g. `alg:none`) |

---

## Rate Limiting

Rate limits are applied per IP address per endpoint group.

| Endpoint | Limit | Window |
|---|---|---|
| `POST /auth/login` | 5 requests | 15 minutes |
| `POST /wallet/withdraw` | 10 requests | 1 hour |
| All other routes | 100 requests | 1 minute |

When a limit is exceeded:

```
HTTP 429 Too Many Requests
Retry-After: 847

{
  "code": "RATE_LIMITED",
  "message": "Too many requests — slow down",
  "retryAfterSeconds": 847
}
```

Rate limit state is cleared by `POST /admin/reset`.

---

## Auth Routes

Base path: `/auth`

---

### POST /auth/login

Authenticate with email and password. Returns a `pre_2fa` token if the account has 2FA enabled, or a `full` token if it does not.

**Rate limit:** 5 requests per 15 minutes per IP.  
**Auth required:** No.

**Request body:**

```json
{
  "email": "verified@qrypto-test.invalid",
  "password": "TestPassword123!"
}
```

| Field | Type | Required | Validation |
|---|---|---|---|
| `email` | string | Yes | Valid email format |
| `password` | string | Yes | 8–128 characters |

**Response — user without 2FA `200 OK`:**

```json
{
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiJ9...",
    "expiresIn": 900,
    "tokenType": "Bearer",
    "scope": "full",
    "requiresTwoFactor": false,
    "sessionId": "a3f9b2c1-0000-0000-0000-000000000001"
  }
}
```

**Response — user with 2FA enabled `200 OK`:**

```json
{
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiJ9...",
    "expiresIn": 900,
    "tokenType": "Bearer",
    "scope": "pre_2fa",
    "requiresTwoFactor": true,
    "sessionId": "a3f9b2c1-0000-0000-0000-000000000001"
  }
}
```

**Error responses:**

```json
// 401 — wrong password
{ "code": "INVALID_CREDENTIALS", "message": "Invalid email or password" }

// 423 — account locked
{
  "code": "ACCOUNT_LOCKED",
  "message": "Account temporarily locked due to too many failed login attempts",
  "retryAfterSeconds": 1782
}

// 403 — account suspended
{ "code": "ACCOUNT_INACTIVE", "message": "Account is suspended" }
```

---

### POST /auth/2fa/verify

Complete 2FA verification. Upgrades a `pre_2fa` token to a `full` token.

**Auth required:** Yes — `pre_2fa` scope.

**Request body:**

```json
{
  "sessionId": "a3f9b2c1-0000-0000-0000-000000000001",
  "code": "123456"
}
```

| Field | Type | Required | Validation |
|---|---|---|---|
| `sessionId` | string (UUID) | Yes | Must match the session from login |
| `code` | string | Yes | Exactly 6 digits |

**Response `200 OK`:**

```json
{
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiJ9...",
    "expiresIn": 900,
    "tokenType": "Bearer",
    "scope": "full"
  }
}
```

**Error responses:**

```json
// 401 — wrong code
{ "code": "INVALID_2FA_CODE", "message": "Invalid or expired 2FA code" }

// 400 — 2FA already completed
{ "code": "BAD_REQUEST", "message": "2FA already completed for this session" }
```

> **Test codes:** `123456` and `000000` are always accepted in the mock server.

---

### POST /auth/refresh

Rotate tokens. Issues a new access + refresh token pair and revokes the current token.

**Auth required:** Yes — any scope.

**Request body:** None.

**Response `200 OK`:**

```json
{
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiJ9...",
    "expiresIn": 900,
    "tokenType": "Bearer",
    "scope": "full"
  }
}
```

> The previous token is revoked on refresh. Using the old token after this call returns `401 TOKEN_REVOKED`.

---

### POST /auth/logout

Revoke the current token and mark the session as inactive.

**Auth required:** Yes — any scope.

**Request body:** None.

**Response `204 No Content`**

---

### GET /auth/sessions

List all active (non-revoked, non-expired) sessions for the authenticated user.

**Auth required:** Yes — `full` scope.

**Response `200 OK`:**

```json
{
  "data": [
    {
      "id": "a3f9b2c1-0000-0000-0000-000000000001",
      "scope": "full",
      "createdAt": "2024-01-15T10:00:00.000Z",
      "expiresAt": "2024-01-15T10:15:00.000Z",
      "ipAddress": "127.0.0.1",
      "userAgent": "qrypto-test-agent/1.0",
      "isCurrent": true
    }
  ]
}
```

---

### DELETE /auth/sessions/:id

Revoke a specific session by ID. Users can only revoke their own sessions.

**Auth required:** Yes — `full` scope.

**Path parameter:** `id` — session UUID.

**Response `204 No Content`**

**Error responses:**

```json
// 404 — session not found or belongs to another user
{ "code": "NOT_FOUND", "message": "Session not found" }
```

---

## KYC Routes

Base path: `/kyc`

KYC state machine:

```
unverified
    │
    └─→ pending  (after POST /kyc/submit)
            │
            └─→ under_review  (after ~2s auto-transition in mock)
                    │
                    ├─→ approved   (withdrawal + trading unlocked)
                    └─→ rejected   (can re-submit)

approved ──→ rekyc_required ──→ pending  (re-submission)
```

---

### POST /kyc/submit

Submit a KYC document to start the verification process.

**Auth required:** Yes — `full` scope.

**Request body:**

```json
{
  "documentType": "passport",
  "filename": "passport-scan.jpg"
}
```

| Field | Type | Required | Values |
|---|---|---|---|
| `documentType` | string | Yes | `passport`, `national_id`, `drivers_license`, `utility_bill`, `bank_statement` |
| `filename` | string | No | Defaults to `{type}-{timestamp}.jpg` |

**Response `201 Created`:**

```json
{
  "data": {
    "documentId": "d4e5f6a7-0000-0000-0000-000000000001",
    "status": "pending",
    "message": "Documents received — under review"
  }
}
```

**Error responses:**

```json
// 409 — already submitted
{
  "code": "KYC_ALREADY_SUBMITTED",
  "message": "Cannot submit KYC — current status is: pending"
}

// 400 — invalid document type
{
  "code": "VALIDATION_ERROR",
  "message": "documentType must be one of: passport, national_id, ..."
}
```

---

### GET /kyc/status

Get the current KYC status and capability flags for the authenticated user.

**Auth required:** Yes — `full` scope.

**Response `200 OK`:**

```json
{
  "data": {
    "status": "approved",
    "canWithdraw": true,
    "canTrade": true,
    "amlFlags": []
  }
}
```

| Field | Description |
|---|---|
| `status` | Current KYC state |
| `canWithdraw` | `true` only when `approved` and no AML flags |
| `canTrade` | `true` only when `approved` |
| `amlFlags` | Active AML flags — empty array when clean |

---

### GET /kyc/documents

List all documents submitted by the authenticated user.

**Auth required:** Yes — `full` scope.

**Response `200 OK`:**

```json
{
  "data": [
    {
      "id": "d4e5f6a7-0000-0000-0000-000000000001",
      "userId": "a1000000-0000-0000-0000-000000000001",
      "type": "passport",
      "filename": "passport-scan.jpg",
      "mimeType": "image/jpeg",
      "uploadedAt": "2024-01-15T10:00:00.000Z"
    }
  ]
}
```

---

## Wallet Routes

Base path: `/wallet`

> **Financial precision:** All amounts are decimal strings with up to 8 decimal places for BTC/ETH and 6 for stablecoins/fiat. Never use JavaScript float arithmetic on these values.

---

### GET /wallet/balances

Get all currency balances for the authenticated user.

**Auth required:** Yes — `full` scope.

**Response `200 OK`:**

```json
{
  "data": [
    {
      "userId": "a1000000-0000-0000-0000-000000000001",
      "currency": "BTC",
      "available": "0.50000000",
      "reserved": "0.00000000",
      "total": "0.50000000",
      "updatedAt": "2024-01-15T10:00:00.000Z"
    },
    {
      "userId": "a1000000-0000-0000-0000-000000000001",
      "currency": "USDT",
      "available": "5000.000000",
      "reserved": "0.000000",
      "total": "5000.000000",
      "updatedAt": "2024-01-15T10:00:00.000Z"
    }
  ]
}
```

| Field | Description |
|---|---|
| `available` | Funds free to trade or withdraw |
| `reserved` | Funds locked in open orders or pending withdrawals |
| `total` | `available + reserved` — invariant always holds |

---

### GET /wallet/balances/:currency

Get the balance for a single currency.

**Auth required:** Yes — `full` scope.

**Path parameter:** `currency` — `BTC`, `ETH`, `USDT`, `USDC`, `USD`, `EUR` (case-insensitive).

**Response `200 OK`:**

```json
{
  "data": {
    "userId": "a1000000-0000-0000-0000-000000000001",
    "currency": "BTC",
    "available": "0.50000000",
    "reserved": "0.00000000",
    "total": "0.50000000",
    "updatedAt": "2024-01-15T10:00:00.000Z"
  }
}
```

**Error responses:**

```json
// 400 — unknown currency
{ "code": "INVALID_CURRENCY", "message": "Unknown currency" }

// 404 — no wallet for this currency
{ "code": "NOT_FOUND", "message": "Wallet not found for this currency" }
```

---

### POST /wallet/withdraw

Submit a withdrawal request. Deducts `amount + fee` from available balance and moves it to reserved pending confirmation.

**Auth required:** Yes — `full` scope.  
**Rate limit:** 10 requests per hour per IP.  
**Gates:** KYC must be `approved`. No active AML flags. Valid 2FA code required.

**Request body:**

```json
{
  "currency": "BTC",
  "amount": "0.05000000",
  "destinationAddress": "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
  "twoFactorCode": "123456"
}
```

| Field | Type | Required | Validation |
|---|---|---|---|
| `currency` | string | Yes | `BTC`, `ETH`, `USDT`, `USDC`, `USD`, `EUR` |
| `amount` | string | Yes | Positive decimal string |
| `destinationAddress` | string | Yes | 26–128 characters |
| `twoFactorCode` | string | Yes | Exactly 6 digits |

**Withdrawal fees:**

| Currency | Fee |
|---|---|
| BTC | `0.00010000` |
| ETH | `0.00200000` |
| USDT | `1.000000` |
| USDC | `1.000000` |
| USD | `5.000000` |
| EUR | `5.000000` |

**Response `201 Created`:**

```json
{
  "data": {
    "transactionId": "c4d5e6f7-0000-0000-0000-000000000001",
    "status": "pending",
    "amount": "0.05000000",
    "fee": "0.00010000",
    "currency": "BTC",
    "destinationAddress": "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
    "estimatedConfirmationMinutes": 30
  }
}
```

**Error responses:**

```json
// 403 — KYC not approved
{
  "code": "KYC_REQUIRED",
  "message": "KYC verification required before withdrawals",
  "kycStatus": "pending"
}

// 403 — AML flag active
{
  "code": "ACCOUNT_RESTRICTED",
  "message": "Account is under review — withdrawals are temporarily suspended",
  "flags": ["suspicious_transaction_pattern"]
}

// 401 — wrong 2FA code
{ "code": "INVALID_2FA_CODE", "message": "Invalid 2FA code" }

// 422 — not enough balance
{
  "code": "INSUFFICIENT_FUNDS",
  "message": "Insufficient available balance",
  "available": "0.00100000",
  "required": "0.05010000"
}

// 400 — zero or negative amount
{ "code": "INVALID_AMOUNT", "message": "Withdrawal amount must be positive" }
```

---

### GET /wallet/transactions

Paginated transaction history for the authenticated user.

**Auth required:** Yes — `full` scope.

**Query parameters:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `page` | integer | `1` | Page number |
| `limit` | integer | `20` | Results per page (max 100) |
| `currency` | string | — | Filter by currency |

**Example:** `GET /wallet/transactions?currency=BTC&page=1&limit=10`

**Response `200 OK`:**

```json
{
  "data": [
    {
      "id": "c1000000-0000-0000-0000-000000000001",
      "userId": "a1000000-0000-0000-0000-000000000001",
      "type": "deposit",
      "currency": "BTC",
      "amount": "0.50000000",
      "fee": "0.00000000",
      "status": "confirmed",
      "blockchainTxId": "0xabcdef...",
      "createdAt": "2024-01-05T12:00:00.000Z",
      "confirmedAt": "2024-01-05T12:10:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 4
  }
}
```

**Transaction types:** `deposit`, `withdrawal`, `trade_buy`, `trade_sell`, `fee`, `funding_payment`, `liquidation`  
**Transaction statuses:** `pending`, `processing`, `confirmed`, `failed`, `cancelled`

---

### GET /wallet/deposit/address/:currency

Get the deposit address for a specific currency.

**Auth required:** Yes — `full` scope.

**Path parameter:** `currency` — case-insensitive.

**Response `200 OK`:**

```json
{
  "data": {
    "currency": "BTC",
    "address": "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
    "network": "bitcoin"
  }
}
```

---

## Trading Routes

Base path: `/trading`

**Supported pairs:** `BTC/USDT`, `ETH/USDT`, `BTC/USD`, `ETH/USD`, `ETH/BTC`  
**Reference prices (seed):** BTC/USDT = 65000.00, ETH/USDT = 3500.00

> Note: When using pair names as URL path parameters, replace `/` with `-`. Example: `BTC/USDT` → `BTC-USDT`.

---

### POST /trading/orders

Place a new order. Reserves funds from available balance immediately.

**Auth required:** Yes — `full` scope.  
**Gate:** KYC must be `approved`.

**Request body:**

```json
{
  "pair": "BTC/USDT",
  "side": "buy",
  "type": "limit",
  "quantity": "0.01000000",
  "price": "64000.00",
  "timeInForce": "GTC"
}
```

| Field | Type | Required | Values |
|---|---|---|---|
| `pair` | string | Yes | `BTC/USDT`, `ETH/USDT`, `BTC/USD`, `ETH/USD`, `ETH/BTC` |
| `side` | string | Yes | `buy`, `sell` |
| `type` | string | Yes | `market`, `limit`, `stop_loss`, `take_profit`, `stop_limit` |
| `quantity` | string | Yes | Positive decimal string |
| `price` | string | For `limit` orders | Positive decimal string |
| `stopPrice` | string | For stop orders | Positive decimal string |
| `timeInForce` | string | No | `GTC`, `IOC`, `FOK` |

**Validation rules:**
- `limit` orders require `price`
- `stop_loss`, `take_profit`, `stop_limit` require `stopPrice`
- `market` orders ignore `price` — execute at reference price

**Response `201 Created`:**

```json
{
  "data": {
    "id": "b4c5d6e7-0000-0000-0000-000000000001",
    "userId": "a1000000-0000-0000-0000-000000000001",
    "pair": "BTC/USDT",
    "side": "buy",
    "type": "limit",
    "quantity": "0.01000000",
    "price": "64000.00",
    "filledQuantity": "0.00000000",
    "fee": "0.64000000",
    "feeCurrency": "USDT",
    "status": "open",
    "createdAt": "2024-01-15T10:00:00.000Z",
    "updatedAt": "2024-01-15T10:00:00.000Z"
  }
}
```

**Order statuses:** `pending`, `open`, `partially_filled`, `filled`, `cancelled`, `rejected`, `expired`

**Market order response** — fills immediately:

```json
{
  "data": {
    "id": "b4c5d6e7-0000-0000-0000-000000000002",
    "type": "market",
    "filledQuantity": "0.01000000",
    "averageFillPrice": "65000.00",
    "status": "filled",
    ...
  }
}
```

**Error responses:**

```json
// 403 — KYC not approved
{
  "code": "KYC_REQUIRED",
  "message": "KYC approval required to trade",
  "kycStatus": "pending"
}

// 422 — insufficient balance
{
  "code": "INSUFFICIENT_FUNDS",
  "message": "Insufficient balance to place this order",
  "required": "650.65000000",
  "available": "100.000000"
}

// 400 — limit order missing price
{
  "code": "VALIDATION_ERROR",
  "message": "Limit orders require a price"
}
```

---

### GET /trading/orders

List orders for the authenticated user.

**Auth required:** Yes — `full` scope.

**Query parameters:**

| Parameter | Type | Description |
|---|---|---|
| `status` | string | Filter by order status |

**Example:** `GET /trading/orders?status=open`

**Response `200 OK`:**

```json
{
  "data": [
    {
      "id": "b1000000-0000-0000-0000-000000000001",
      "pair": "BTC/USDT",
      "side": "buy",
      "type": "limit",
      "quantity": "0.10000000",
      "price": "64000.00",
      "filledQuantity": "0.00000000",
      "fee": "0.00000000",
      "feeCurrency": "USDT",
      "status": "open",
      "createdAt": "2024-01-14T10:00:00.000Z",
      "updatedAt": "2024-01-14T10:00:00.000Z"
    }
  ],
  "meta": { "total": 3 }
}
```

---

### GET /trading/orders/:id

Get a single order by ID. Returns 404 if the order belongs to another user (IDOR protection).

**Auth required:** Yes — `full` scope.

**Path parameter:** `id` — order UUID.

**Response `200 OK`:**

```json
{
  "data": {
    "id": "b1000000-0000-0000-0000-000000000002",
    "pair": "ETH/USDT",
    "side": "sell",
    "type": "limit",
    "quantity": "1.00000000",
    "price": "3600.00",
    "filledQuantity": "0.50000000",
    "averageFillPrice": "3601.50",
    "fee": "1.80075000",
    "feeCurrency": "USDT",
    "status": "partially_filled",
    "createdAt": "2024-01-14T11:00:00.000Z",
    "updatedAt": "2024-01-14T11:30:00.000Z"
  }
}
```

**Error responses:**

```json
// 404 — not found or belongs to another user
{ "code": "NOT_FOUND", "message": "Order not found" }
```

---

### DELETE /trading/orders/:id

Cancel an open order. Releases reserved funds back to available.

**Auth required:** Yes — `full` scope.

**Path parameter:** `id` — order UUID.

**Response `200 OK`:**

```json
{
  "data": {
    "id": "b1000000-0000-0000-0000-000000000001",
    "status": "cancelled"
  }
}
```

**Error responses:**

```json
// 409 — already terminal
{
  "code": "ORDER_NOT_CANCELLABLE",
  "message": "Cannot cancel order with status: filled"
}
```

---

### GET /trading/orderbook/:pair

Get order book depth snapshot. No auth required.

**Path parameter:** `pair` — use `-` instead of `/`. Example: `BTC-USDT`.

**Response `200 OK`:**

```json
{
  "data": {
    "pair": "BTC/USDT",
    "bids": [
      { "price": "64987.01", "quantity": "0.84231000", "orderCount": 3 },
      { "price": "64974.02", "quantity": "1.21500000", "orderCount": 2 }
    ],
    "asks": [
      { "price": "65013.01", "quantity": "0.63100000", "orderCount": 1 },
      { "price": "65026.02", "quantity": "2.10000000", "orderCount": 4 }
    ],
    "timestamp": "2024-01-15T10:00:00.000Z"
  }
}
```

> Bids are sorted highest price first. Asks are sorted lowest price first.

---

### GET /trading/ticker/:pair

Get current price ticker. No auth required.

**Path parameter:** `pair` — use `-` instead of `/`.

**Response `200 OK`:**

```json
{
  "data": {
    "pair": "BTC/USDT",
    "lastPrice": "65000.00",
    "bidPrice": "64993.50",
    "askPrice": "65006.50",
    "high24h": "66300.00",
    "low24h": "63700.00",
    "volume24h": "847.23150000",
    "priceChange24h": "1250.00",
    "priceChangePercent24h": "1.96",
    "timestamp": "2024-01-15T10:00:00.000Z"
  }
}
```

---

### GET /trading/history

Filled and partially-filled trade history for the authenticated user.

**Auth required:** Yes — `full` scope.

**Query parameters:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `page` | integer | `1` | Page number |
| `limit` | integer | `20` | Results per page (max 100) |

**Response `200 OK`:**

```json
{
  "data": [
    {
      "id": "b1000000-0000-0000-0000-000000000003",
      "pair": "BTC/USDT",
      "side": "buy",
      "type": "market",
      "quantity": "0.01000000",
      "filledQuantity": "0.01000000",
      "averageFillPrice": "65123.45",
      "fee": "0.65123450",
      "feeCurrency": "USDT",
      "status": "filled",
      "createdAt": "2024-01-13T09:00:00.000Z",
      "updatedAt": "2024-01-13T09:00:01.000Z"
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 1 }
}
```

---

## Admin Routes

Base path: `/admin`

> These routes are QA-only test control endpoints. No authentication required. In a real deployment they would be firewalled to the test runner IP range.

---

### GET /admin/health

Liveness check. Returns server state summary.

**Response `200 OK`:**

```json
{
  "ok": true,
  "uptime": 47.3,
  "users": 9,
  "sessions": 2,
  "orders": 3,
  "transactions": 4,
  "chaos": {
    "latencyMs": 0,
    "forceErrorCode": null,
    "dropWebSocket": false,
    "stalePriceFeedSeconds": null
  },
  "timestamp": "2024-01-15T10:00:47.000Z"
}
```

---

### GET /admin/users

List the full seed user catalog with login credentials.

**Response `200 OK`:**

```json
{
  "data": [
    {
      "key": "VERIFIED",
      "id": "a1000000-0000-0000-0000-000000000001",
      "email": "verified@qrypto-test.invalid",
      "password": "TestPassword123!",
      "twoFactorCode": "123456"
    },
    {
      "key": "UNVERIFIED",
      "id": "a1000000-0000-0000-0000-000000000002",
      "email": "unverified@qrypto-test.invalid",
      "password": "TestPassword123!",
      "twoFactorCode": "123456"
    }
  ]
}
```

---

### POST /admin/reset

Reset all server state to seed values. Clears sessions, orders placed during the run, rate limit counters, and KYC submissions. Seed users, wallets, and seed orders are restored.

**Call this in `beforeAll` / `afterEach` to guarantee test isolation.**

**Request body:** None.

**Response `200 OK`:**

```json
{
  "ok": true,
  "message": "State reset to seed values",
  "timestamp": "2024-01-15T10:00:00.000Z"
}
```

---

### POST /admin/kyc/:id/force

Force a user to a specific KYC status. Bypasses the state machine — useful for setting up specific test scenarios without going through the full submission flow.

**Path parameter:** `id` — user UUID.

**Request body:**

```json
{
  "status": "approved"
}
```

**Valid statuses:** `unverified`, `pending`, `under_review`, `approved`, `rejected`, `rekyc_required`

**Response `200 OK`:**

```json
{
  "ok": true,
  "userId": "a1000000-0000-0000-0000-000000000002",
  "kycStatus": "approved"
}
```

**Error responses:**

```json
// 404 — user not found
{ "code": "NOT_FOUND", "message": "User a1000000-... not found" }

// 400 — invalid status
{ "code": "VALIDATION_ERROR", "message": "Invalid KYC status. Must be one of: ..." }
```

---

### POST /admin/aml/:id/force

Force AML flags on a user. Pass an empty array to clear all flags.

**Path parameter:** `id` — user UUID.

**Request body:**

```json
{
  "flags": ["suspicious_transaction_pattern"]
}
```

**Valid flags:** `suspicious_transaction_pattern`, `high_velocity_withdrawal`, `sanctions_list_match`, `pep_match`, `adverse_media`, `manual_review_required`

**Clear all flags:**

```json
{ "flags": [] }
```

**Response `200 OK`:**

```json
{
  "ok": true,
  "userId": "a1000000-0000-0000-0000-000000000001",
  "amlFlags": ["suspicious_transaction_pattern"]
}
```

---

### POST /admin/deposit/confirm

Confirm a pending deposit transaction. Credits the user's wallet balance.

**Request body:**

```json
{
  "transactionId": "c1000000-0000-0000-0000-000000000004"
}
```

**Response `200 OK`:**

```json
{
  "ok": true,
  "transactionId": "c1000000-0000-0000-0000-000000000004",
  "status": "confirmed"
}
```

**Error responses:**

```json
// 404 — not found or not in pending deposit state
{
  "code": "NOT_FOUND",
  "message": "Transaction not found or not in pending deposit state"
}
```

---

### POST /admin/chaos

Configure chaos behaviour. All fields are optional — only provided fields are updated.

**Request body:**

```json
{
  "latencyMs": 500,
  "forceErrorCode": null,
  "dropWebSocket": false,
  "stalePriceFeedSeconds": null
}
```

| Field | Type | Description |
|---|---|---|
| `latencyMs` | number | Add artificial delay (ms) to all non-admin responses |
| `forceErrorCode` | number \| null | Force all non-admin responses to this HTTP status code |
| `dropWebSocket` | boolean | Immediately terminate all WebSocket connections |
| `stalePriceFeedSeconds` | number \| null | Pause WebSocket ticker updates for N seconds |

**Response `200 OK`:**

```json
{
  "ok": true,
  "chaos": {
    "latencyMs": 500,
    "forceErrorCode": null,
    "dropWebSocket": false,
    "stalePriceFeedSeconds": null
  }
}
```

---

### DELETE /admin/chaos

Reset all chaos settings to defaults (no latency, no forced errors, no drops).

**Response `200 OK`:**

```json
{
  "ok": true,
  "chaos": {
    "latencyMs": 0,
    "forceErrorCode": null,
    "dropWebSocket": false,
    "stalePriceFeedSeconds": null
  }
}
```

---

## WebSocket

**URL:** `ws://localhost:4000`

Connect and subscribe to channels to receive real-time updates.

### Subscribing

Send a JSON message after connecting:

```json
{
  "action": "subscribe",
  "channels": ["ticker:BTC/USDT", "orderbook:ETH/USDT"]
}
```

### Unsubscribing

```json
{
  "action": "unsubscribe",
  "channels": ["ticker:BTC/USDT"]
}
```

### Connection Acknowledgement

Received immediately on connect, and after each subscribe:

```json
{
  "type": "connection_ack",
  "data": { "correlationId": "3bbf6098-2f20-418a-9871-4c2566d8118c" },
  "timestamp": "2024-01-15T10:00:00.000Z"
}
```

### Keepalive

Send a ping, receive a pong:

```json
{ "type": "ping" }
```

```json
{ "type": "pong", "data": {}, "timestamp": "2024-01-15T10:00:01.000Z" }
```

---

### Channel: `ticker:<pair>`

**Frequency:** Every 1 second  
**Example:** Subscribe to `ticker:BTC/USDT`

```json
{
  "type": "ticker",
  "data": {
    "pair": "BTC/USDT",
    "lastPrice": "65012.34",
    "bidPrice": "65005.78",
    "askPrice": "65018.90",
    "timestamp": "2024-01-15T10:00:01.000Z"
  },
  "timestamp": "2024-01-15T10:00:01.000Z"
}
```

Price drifts with a small random walk each tick — not static.

---

### Channel: `orderbook:<pair>`

**Frequency:** Every 2 seconds  
**Example:** Subscribe to `orderbook:BTC/USDT`

```json
{
  "type": "orderbook",
  "data": {
    "pair": "BTC/USDT",
    "bids": [
      { "price": "65010.00", "quantity": "1.23400000", "orderCount": 3 },
      { "price": "65005.00", "quantity": "0.87600000", "orderCount": 2 }
    ],
    "asks": [
      { "price": "65015.00", "quantity": "0.54300000", "orderCount": 1 },
      { "price": "65020.00", "quantity": "2.10000000", "orderCount": 4 }
    ],
    "timestamp": "2024-01-15T10:00:02.000Z"
  },
  "timestamp": "2024-01-15T10:00:02.000Z"
}
```

---

### Supported Pairs

`BTC/USDT` · `ETH/USDT` · `BTC/USD` · `ETH/USD` · `ETH/BTC`

---

## Chaos Mode

Chaos is configured via `POST /admin/chaos` and reset via `DELETE /admin/chaos`. Admin routes are always exempt — test control always works regardless of active chaos.

### Example: Test retry behaviour under latency

```bash
# Inject 800ms latency
curl -X POST http://localhost:8080/admin/chaos \
  -H 'Content-Type: application/json' \
  -d '{ "latencyMs": 800 }'

# Run your retry tests...

# Reset
curl -X DELETE http://localhost:8080/admin/chaos
```

### Example: Test 503 handling

```bash
curl -X POST http://localhost:8080/admin/chaos \
  -H 'Content-Type: application/json' \
  -d '{ "forceErrorCode": 503 }'
```

### Example: Test WebSocket reconnection

```bash
curl -X POST http://localhost:8080/admin/chaos \
  -H 'Content-Type: application/json' \
  -d '{ "dropWebSocket": true }'
```

### Example: Test stale price feed detection

```bash
curl -X POST http://localhost:8080/admin/chaos \
  -H 'Content-Type: application/json' \
  -d '{ "stalePriceFeedSeconds": 15 }'
```

---

## Seed User Catalog

All seed users share the same password and 2FA code.

**Password:** `TestPassword123!`  
**2FA code:** `123456` (also `000000`)

| Key | User ID | Email | KYC | 2FA | Balance | Notes |
|---|---|---|---|---|---|---|
| `VERIFIED` | `a1000000-...0001` | verified@qrypto-test.invalid | approved | ✓ | funded | Primary happy-path user |
| `UNVERIFIED` | `a1000000-...0002` | unverified@qrypto-test.invalid | unverified | ✗ | funded | New user state |
| `KYC_PENDING` | `a1000000-...0003` | kyc-pending@qrypto-test.invalid | pending | ✗ | funded | Under review |
| `KYC_REJECTED` | `a1000000-...0004` | kyc-rejected@qrypto-test.invalid | rejected | ✗ | funded | Can re-submit |
| `AML_FLAGGED` | `a1000000-...0005` | aml-flagged@qrypto-test.invalid | approved | ✗ | funded | Withdrawals blocked |
| `LOCKED` | `a1000000-...0006` | locked@qrypto-test.invalid | unverified | ✗ | — | 5 failed logins, locked 30 min |
| `REKYC_REQUIRED` | `a1000000-...0007` | rekyc@qrypto-test.invalid | rekyc_required | ✓ | funded | Re-verification required |
| `SANCTIONED` | `a1000000-...0008` | sanctioned@qrypto-test.invalid | rejected | ✗ | — | Sanctions match, hard block |
| `ZERO_BALANCE` | `a1000000-...0009` | zero-balance@qrypto-test.invalid | approved | ✓ | zero | Insufficient funds tests |

### Seed Orders (on VERIFIED user)

| ID | Pair | Side | Type | Status |
|---|---|---|---|---|
| `b1000000-...0001` | BTC/USDT | buy | limit @ 64000 | open |
| `b1000000-...0002` | ETH/USDT | sell | limit @ 3600 | partially_filled (50%) |
| `b1000000-...0003` | BTC/USDT | buy | market | filled |

### Seed Transactions (on VERIFIED user)

| ID | Type | Currency | Amount | Status |
|---|---|---|---|---|
| `c1000000-...0001` | deposit | BTC | 0.50000000 | confirmed |
| `c1000000-...0002` | deposit | USDT | 5000.000000 | confirmed |
| `c1000000-...0003` | withdrawal | USDT | 500.000000 | confirmed |
| `c1000000-...0004` | deposit | BTC | 0.05000000 | **pending** |

> Transaction `c1000000-...0004` is the pending deposit used by `POST /admin/deposit/confirm` tests.
