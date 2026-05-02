/**
 * @qrypto/mock-server — Seed Data
 *
 * Realistic seed state covering every lifecycle stage needed by the test suites.
 * These users, wallets, and orders are stable across runs — their IDs are
 * hardcoded so tests can reference them by a known catalog.
 *
 * See packages/mock-server/README.md for the full seed user catalog.
 *
 * Last updated: 2024-01-15
 */

import type {
  AssetAmount,
  Currency,
  Order,
  Transaction,
  User,
  UserId,
  WalletBalance,
} from '@qrypto/shared-types';

// ─── Known User IDs — reference these in tests ────────────────────────────────

export const SEED_USER_IDS = {
  /** Fully verified, 2FA enabled, funded. The happy-path user. */
  VERIFIED: 'a1000000-0000-0000-0000-000000000001' as unknown as UserId,
  /** Unverified — no KYC, no 2FA. New user state. */
  UNVERIFIED: 'a1000000-0000-0000-0000-000000000002' as unknown as UserId,
  /** KYC pending — submitted but not reviewed. */
  KYC_PENDING: 'a1000000-0000-0000-0000-000000000003' as unknown as UserId,
  /** KYC rejected. */
  KYC_REJECTED: 'a1000000-0000-0000-0000-000000000004' as unknown as UserId,
  /** AML flagged — suspicious transaction pattern. */
  AML_FLAGGED: 'a1000000-0000-0000-0000-000000000005' as unknown as UserId,
  /** Account locked — too many failed login attempts. */
  LOCKED: 'a1000000-0000-0000-0000-000000000006' as unknown as UserId,
  /** Re-KYC required — previously verified, anomaly detected. */
  REKYC_REQUIRED: 'a1000000-0000-0000-0000-000000000007' as unknown as UserId,
  /** Sanctions match — hardest block. */
  SANCTIONED: 'a1000000-0000-0000-0000-000000000008' as unknown as UserId,
  /** Zero balance — used for insufficient funds tests. */
  ZERO_BALANCE: 'a1000000-0000-0000-0000-000000000009' as unknown as UserId,
} as const;

export const SEED_EMAILS: Record<keyof typeof SEED_USER_IDS, string> = {
  VERIFIED: 'verified@qrypto-test.invalid',
  UNVERIFIED: 'unverified@qrypto-test.invalid',
  KYC_PENDING: 'kyc-pending@qrypto-test.invalid',
  KYC_REJECTED: 'kyc-rejected@qrypto-test.invalid',
  AML_FLAGGED: 'aml-flagged@qrypto-test.invalid',
  LOCKED: 'locked@qrypto-test.invalid',
  REKYC_REQUIRED: 'rekyc@qrypto-test.invalid',
  SANCTIONED: 'sanctioned@qrypto-test.invalid',
  ZERO_BALANCE: 'zero-balance@qrypto-test.invalid',
};

// bcrypt hash of 'TestPassword123!' — pre-computed, consistent across runs
const TEST_PASSWORD_HASH = '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/Lewkgue1gT0I.0Woi';
// Static TOTP secret for 2FA tests — generates predictable codes
export const SEED_TOTP_SECRET = 'JBSWY3DPEHPK3PXP';

function a(v: string): AssetAmount {
  return v as unknown as AssetAmount;
}

// ─── Seed Builder ─────────────────────────────────────────────────────────────

export function seedState(): {
  users: Map<string, User>;
  wallets: Map<string, WalletBalance>;
  orders: Map<string, Order>;
  transactions: Map<string, Transaction>;
} {
  const users = new Map<string, User>();
  const wallets = new Map<string, WalletBalance>();
  const orders = new Map<string, Order>();
  const transactions = new Map<string, Transaction>();

  // ── Users ──────────────────────────────────────────────────────────────────

  const baseUser = (id: UserId, email: string, overrides: Partial<User> = {}): User => ({
    id,
    email,
    passwordHash: TEST_PASSWORD_HASH,
    twoFactorEnabled: false,
    kycStatus: 'unverified',
    amlFlags: [],
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    isActive: true,
    failedLoginAttempts: 0,
    ...overrides,
  });

  users.set(
    SEED_USER_IDS.VERIFIED,
    baseUser(SEED_USER_IDS.VERIFIED, SEED_EMAILS.VERIFIED, {
      twoFactorEnabled: true,
      twoFactorSecret: SEED_TOTP_SECRET,
      kycStatus: 'approved',
    }),
  );

  users.set(SEED_USER_IDS.UNVERIFIED, baseUser(SEED_USER_IDS.UNVERIFIED, SEED_EMAILS.UNVERIFIED));

  users.set(
    SEED_USER_IDS.KYC_PENDING,
    baseUser(SEED_USER_IDS.KYC_PENDING, SEED_EMAILS.KYC_PENDING, {
      kycStatus: 'pending',
    }),
  );

  users.set(
    SEED_USER_IDS.KYC_REJECTED,
    baseUser(SEED_USER_IDS.KYC_REJECTED, SEED_EMAILS.KYC_REJECTED, {
      kycStatus: 'rejected',
    }),
  );

  users.set(
    SEED_USER_IDS.AML_FLAGGED,
    baseUser(SEED_USER_IDS.AML_FLAGGED, SEED_EMAILS.AML_FLAGGED, {
      kycStatus: 'approved',
      amlFlags: ['suspicious_transaction_pattern'],
    }),
  );

  users.set(
    SEED_USER_IDS.LOCKED,
    baseUser(SEED_USER_IDS.LOCKED, SEED_EMAILS.LOCKED, {
      failedLoginAttempts: 5,
      lockedUntil: new Date(Date.now() + 30 * 60 * 1000),
    }),
  );

  users.set(
    SEED_USER_IDS.REKYC_REQUIRED,
    baseUser(SEED_USER_IDS.REKYC_REQUIRED, SEED_EMAILS.REKYC_REQUIRED, {
      kycStatus: 'rekyc_required',
      twoFactorEnabled: true,
      twoFactorSecret: SEED_TOTP_SECRET,
    }),
  );

  users.set(
    SEED_USER_IDS.SANCTIONED,
    baseUser(SEED_USER_IDS.SANCTIONED, SEED_EMAILS.SANCTIONED, {
      kycStatus: 'rejected',
      amlFlags: ['sanctions_list_match', 'manual_review_required'],
    }),
  );

  users.set(
    SEED_USER_IDS.ZERO_BALANCE,
    baseUser(SEED_USER_IDS.ZERO_BALANCE, SEED_EMAILS.ZERO_BALANCE, {
      kycStatus: 'approved',
      twoFactorEnabled: true,
      twoFactorSecret: SEED_TOTP_SECRET,
    }),
  );

  // ── Wallets ────────────────────────────────────────────────────────────────

  const fundedCurrencies: [Currency, string, string][] = [
    ['BTC', '0.50000000', '8'],
    ['ETH', '5.00000000', '8'],
    ['USDT', '5000.000000', '6'],
    ['USDC', '2500.000000', '6'],
    ['USD', '10000.000000', '6'],
  ];

  const fundedUserIds: UserId[] = [
    SEED_USER_IDS.VERIFIED,
    SEED_USER_IDS.UNVERIFIED, // Unverified but funded to test KYC withdrawal blocks
    SEED_USER_IDS.KYC_PENDING,
    SEED_USER_IDS.KYC_REJECTED,
    SEED_USER_IDS.AML_FLAGGED,
    SEED_USER_IDS.REKYC_REQUIRED,
  ];
  for (const userId of fundedUserIds) {
    for (const [currency, amount] of fundedCurrencies) {
      const key = `${userId}:${currency}`;
      wallets.set(key, {
        userId,
        currency,
        available: a(amount),
        reserved: a(currency === 'BTC' || currency === 'ETH' ? '0.00000000' : '0.000000'),
        total: a(amount),
        updatedAt: new Date('2024-01-01T00:00:00Z'),
      });
    }
  }

  // Zero balance user
  for (const [currency] of fundedCurrencies) {
    const zero = currency === 'BTC' || currency === 'ETH' ? '0.00000000' : '0.000000';
    const key = `${SEED_USER_IDS.ZERO_BALANCE}:${currency}`;
    wallets.set(key, {
      userId: SEED_USER_IDS.ZERO_BALANCE,
      currency,
      available: a(zero),
      reserved: a(zero),
      total: a(zero),
      updatedAt: new Date('2024-01-01T00:00:00Z'),
    });
  }

  // ── Orders ─────────────────────────────────────────────────────────────────

  const seedOrders: Order[] = [
    {
      id: 'b1000000-0000-0000-0000-000000000001',
      userId: SEED_USER_IDS.VERIFIED,
      pair: 'BTC/USDT',
      side: 'buy',
      type: 'limit',
      quantity: a('0.10000000'),
      price: a('64000.00'),
      filledQuantity: a('0.00000000'),
      fee: a('0.00000000'),
      feeCurrency: 'USDT',
      status: 'open',
      createdAt: new Date('2024-01-14T10:00:00Z'),
      updatedAt: new Date('2024-01-14T10:00:00Z'),
    },
    {
      id: 'b1000000-0000-0000-0000-000000000002',
      userId: SEED_USER_IDS.VERIFIED,
      pair: 'ETH/USDT',
      side: 'sell',
      type: 'limit',
      quantity: a('1.00000000'),
      price: a('3600.00'),
      filledQuantity: a('0.50000000'),
      averageFillPrice: a('3601.50'),
      fee: a('1.80075000'),
      feeCurrency: 'USDT',
      status: 'partially_filled',
      createdAt: new Date('2024-01-14T11:00:00Z'),
      updatedAt: new Date('2024-01-14T11:30:00Z'),
    },
    {
      id: 'b1000000-0000-0000-0000-000000000003',
      userId: SEED_USER_IDS.VERIFIED,
      pair: 'BTC/USDT',
      side: 'buy',
      type: 'market',
      quantity: a('0.01000000'),
      filledQuantity: a('0.01000000'),
      averageFillPrice: a('65123.45'),
      fee: a('0.65123450'),
      feeCurrency: 'USDT',
      status: 'filled',
      createdAt: new Date('2024-01-13T09:00:00Z'),
      updatedAt: new Date('2024-01-13T09:00:01Z'),
    },
  ];

  for (const order of seedOrders) {
    orders.set(order.id, order);
  }

  // ── Transactions ───────────────────────────────────────────────────────────

  const seedTransactions: Transaction[] = [
    {
      id: 'c1000000-0000-0000-0000-000000000001',
      userId: SEED_USER_IDS.VERIFIED,
      type: 'deposit',
      currency: 'BTC',
      amount: a('0.50000000'),
      fee: a('0.00000000'),
      status: 'confirmed',
      blockchainTxId: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
      createdAt: new Date('2024-01-05T12:00:00Z'),
      confirmedAt: new Date('2024-01-05T12:10:00Z'),
    },
    {
      id: 'c1000000-0000-0000-0000-000000000002',
      userId: SEED_USER_IDS.VERIFIED,
      type: 'deposit',
      currency: 'USDT',
      amount: a('5000.000000'),
      fee: a('0.000000'),
      status: 'confirmed',
      blockchainTxId: '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
      createdAt: new Date('2024-01-06T10:00:00Z'),
      confirmedAt: new Date('2024-01-06T10:05:00Z'),
    },
    {
      id: 'c1000000-0000-0000-0000-000000000003',
      userId: SEED_USER_IDS.VERIFIED,
      type: 'withdrawal',
      currency: 'USDT',
      amount: a('500.000000'),
      fee: a('1.000000'),
      status: 'confirmed',
      blockchainTxId: '0x1111111111111111111111111111111111111111111111111111111111111111',
      createdAt: new Date('2024-01-10T15:00:00Z'),
      confirmedAt: new Date('2024-01-10T15:20:00Z'),
    },
    {
      id: 'c1000000-0000-0000-0000-000000000004',
      userId: SEED_USER_IDS.VERIFIED,
      type: 'deposit',
      currency: 'BTC',
      amount: a('0.05000000'),
      fee: a('0.00000000'),
      status: 'pending',
      blockchainTxId: '0x2222222222222222222222222222222222222222222222222222222222222222',
      createdAt: new Date('2024-01-15T08:00:00Z'),
    },
  ];

  for (const tx of seedTransactions) {
    transactions.set(tx.id, tx);
  }

  return { users, wallets, orders, transactions };
}
