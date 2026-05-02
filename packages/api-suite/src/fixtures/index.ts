/**
 * @qrypto/api-suite — Test Fixtures
 *
 * Shared constants and helpers used across all test suites.
 * Seed IDs mirror SEED_USER_IDS in @qrypto/mock-server.
 *
 * Last updated: 2024-01-15
 */

// ─── Seed User IDs ────────────────────────────────────────────────────────────

export const SEED_USERS = {
  VERIFIED: {
    id: 'a1000000-0000-0000-0000-000000000001',
    email: 'verified@qrypto-test.invalid',
    password: 'TestPassword123!',
    twoFactorCode: '123456',
  },
  UNVERIFIED: {
    id: 'a1000000-0000-0000-0000-000000000002',
    email: 'unverified@qrypto-test.invalid',
    password: 'TestPassword123!',
    twoFactorCode: '123456',
  },
  KYC_PENDING: {
    id: 'a1000000-0000-0000-0000-000000000003',
    email: 'kyc-pending@qrypto-test.invalid',
    password: 'TestPassword123!',
    twoFactorCode: '123456',
  },
  KYC_REJECTED: {
    id: 'a1000000-0000-0000-0000-000000000004',
    email: 'kyc-rejected@qrypto-test.invalid',
    password: 'TestPassword123!',
    twoFactorCode: '123456',
  },
  AML_FLAGGED: {
    id: 'a1000000-0000-0000-0000-000000000005',
    email: 'aml-flagged@qrypto-test.invalid',
    password: 'TestPassword123!',
    twoFactorCode: '123456',
  },
  LOCKED: {
    id: 'a1000000-0000-0000-0000-000000000006',
    email: 'locked@qrypto-test.invalid',
    password: 'TestPassword123!',
    twoFactorCode: '123456',
  },
  REKYC_REQUIRED: {
    id: 'a1000000-0000-0000-0000-000000000007',
    email: 'rekyc@qrypto-test.invalid',
    password: 'TestPassword123!',
    twoFactorCode: '123456',
  },
  SANCTIONED: {
    id: 'a1000000-0000-0000-0000-000000000008',
    email: 'sanctioned@qrypto-test.invalid',
    password: 'TestPassword123!',
    twoFactorCode: '123456',
  },
  ZERO_BALANCE: {
    id: 'a1000000-0000-0000-0000-000000000009',
    email: 'zero-balance@qrypto-test.invalid',
    password: 'TestPassword123!',
    twoFactorCode: '123456',
  },
} as const;

// ─── Seed Transaction IDs ─────────────────────────────────────────────────────

export const SEED_TRANSACTIONS = {
  /** Confirmed BTC deposit on VERIFIED user */
  CONFIRMED_BTC_DEPOSIT: 'c1000000-0000-0000-0000-000000000001',
  /** Confirmed USDT deposit on VERIFIED user */
  CONFIRMED_USDT_DEPOSIT: 'c1000000-0000-0000-0000-000000000002',
  /** Confirmed USDT withdrawal on VERIFIED user */
  CONFIRMED_WITHDRAWAL: 'c1000000-0000-0000-0000-000000000003',
  /** Pending BTC deposit on VERIFIED user — use with /admin/deposit/confirm */
  PENDING_BTC_DEPOSIT: 'c1000000-0000-0000-0000-000000000004',
} as const;

// ─── Seed Order IDs ───────────────────────────────────────────────────────────

export const SEED_ORDERS = {
  /** Open BTC/USDT limit buy @ 64000 on VERIFIED user */
  OPEN_LIMIT: 'b1000000-0000-0000-0000-000000000001',
  /** Partially filled ETH/USDT limit sell @ 3600 on VERIFIED user */
  PARTIAL_FILL: 'b1000000-0000-0000-0000-000000000002',
  /** Fully filled BTC/USDT market buy on VERIFIED user */
  FILLED_MARKET: 'b1000000-0000-0000-0000-000000000003',
} as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Standard BTC withdrawal address for tests */
export const TEST_BTC_ADDRESS = '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa';

/** Standard ETH address for tests */
export const TEST_ETH_ADDRESS = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e';

/** Delay utility for race condition tests */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Generate a unique test email to avoid seed user conflicts in dynamic tests */
export function uniqueEmail(): string {
  return `test-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@qrypto-test.invalid`;
}
