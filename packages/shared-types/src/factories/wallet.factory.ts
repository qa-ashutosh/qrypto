/**
 * @qrypto/shared-types — Wallet Factory
 *
 * Test data factory for WalletBalance, Transaction, and DepositAddress entities.
 * Amounts use string representation at satoshi precision (8dp for BTC, 6dp for stables).
 *
 * Last updated: 2024-01-01
 */

import { randomUUID } from 'crypto';

import type {
  AssetAmount,
  Currency,
  DepositAddress,
  Transaction,
  TransactionType,
  UserId,
  WalletBalance,
} from '../types/domain.js';

function asAmount(value: string): AssetAmount {
  return value as AssetAmount;
}

// ─── Wallet Balance Factory ───────────────────────────────────────────────────

function buildBalance(
  userId: UserId,
  currency: Currency,
  available: string,
  reserved: string,
): WalletBalance {
  // total = available + reserved — computed here for consistency
  // In real assertions, use decimal.util.ts to verify this invariant
  const totalNum = (parseFloat(available) + parseFloat(reserved)).toFixed(
    currency === 'BTC' || currency === 'ETH' ? 8 : 6,
  );

  return {
    userId,
    currency,
    available: asAmount(available),
    reserved: asAmount(reserved),
    total: asAmount(totalNum),
    updatedAt: new Date('2024-01-15T10:00:00Z'),
  };
}

export const walletFactory = {
  /**
   * Standard funded wallet — typical mid-tier user balance.
   * Available for all operations, none reserved.
   */
  build(
    userId: UserId,
    currency: Currency = 'BTC',
    overrides: Partial<WalletBalance> = {},
  ): WalletBalance {
    const defaults: Record<Currency, { available: string; reserved: string }> = {
      BTC: { available: '0.50000000', reserved: '0.00000000' },
      ETH: { available: '5.00000000', reserved: '0.00000000' },
      USDT: { available: '5000.000000', reserved: '0.000000' },
      USDC: { available: '5000.000000', reserved: '0.000000' },
      USD: { available: '5000.000000', reserved: '0.000000' },
      EUR: { available: '5000.000000', reserved: '0.000000' },
    };

    const { available, reserved } = defaults[currency] ?? { available: '0', reserved: '0' };
    return { ...buildBalance(userId, currency, available, reserved), ...overrides };
  },

  /**
   * Low balance — just enough to cover a minimum trade but not a large withdrawal.
   * Use for insufficient-funds rejection tests.
   */
  withLowBalance(
    userId: UserId,
    currency: Currency = 'BTC',
    overrides: Partial<WalletBalance> = {},
  ): WalletBalance {
    const low: Record<Currency, string> = {
      BTC: '0.00010000',
      ETH: '0.00100000',
      USDT: '1.000000',
      USDC: '1.000000',
      USD: '1.000000',
      EUR: '1.000000',
    };
    const available = low[currency] ?? '0.00000001';
    return { ...buildBalance(userId, currency, available, '0.00000000'), ...overrides };
  },

  /**
   * Zero balance — no funds at all.
   * Use for zero-balance guard tests and withdrawal block tests.
   */
  zeroed(
    userId: UserId,
    currency: Currency = 'BTC',
    overrides: Partial<WalletBalance> = {},
  ): WalletBalance {
    const zero = currency === 'BTC' || currency === 'ETH' ? '0.00000000' : '0.000000';
    return { ...buildBalance(userId, currency, zero, zero), ...overrides };
  },

  /**
   * Wallet with reserved funds (open order or pending withdrawal).
   * Use for balance consistency tests after order placement.
   */
  withReserved(
    userId: UserId,
    currency: Currency = 'BTC',
    availableAmount = '0.40000000',
    reservedAmount = '0.10000000',
    overrides: Partial<WalletBalance> = {},
  ): WalletBalance {
    return { ...buildBalance(userId, currency, availableAmount, reservedAmount), ...overrides };
  },

  /**
   * Full multi-currency portfolio — one balance per currency.
   * Use for portfolio overview and aggregate balance tests.
   */
  buildPortfolio(userId: UserId): WalletBalance[] {
    return (['BTC', 'ETH', 'USDT', 'USD'] as Currency[]).map((currency) =>
      walletFactory.build(userId, currency),
    );
  },
};

// ─── Transaction Factory ──────────────────────────────────────────────────────

export const transactionFactory = {
  build(
    userId: UserId,
    type: TransactionType = 'deposit',
    overrides: Partial<Transaction> = {},
  ): Transaction {
    const tx: Transaction = {
      id: randomUUID(),
      userId,
      type,
      currency: 'BTC',
      amount: asAmount('0.01000000'),
      fee: asAmount('0.00002000'),
      status: 'confirmed',
      createdAt: new Date('2024-01-15T09:00:00Z'),
      confirmedAt: new Date('2024-01-15T09:10:00Z'),
    };
    if (overrides.blockchainTxId !== undefined) tx.blockchainTxId = overrides.blockchainTxId;
    if (overrides.confirmedAt !== undefined) tx.confirmedAt = overrides.confirmedAt;
    if (overrides.correlationId !== undefined) tx.correlationId = overrides.correlationId;
    const rest = { ...overrides };
    delete rest.blockchainTxId;
    delete rest.confirmedAt;
    delete rest.correlationId;
    return Object.assign(tx, rest);
  },

  /**
   * Pending deposit — awaiting blockchain confirmation.
   * Use for deposit confirmation flow tests.
   */
  pendingDeposit(userId: UserId, overrides: Partial<Transaction> = {}): Transaction {
    const tx = transactionFactory.build(userId, 'deposit', {
      status: 'pending',
      blockchainTxId: `0x${randomUUID().replace(/-/g, '')}`,
      ...overrides,
    });
    // Remove confirmedAt — a pending deposit has not been confirmed
    delete tx.confirmedAt;
    return tx;
  },

  /**
   * Confirmed withdrawal.
   * Use for withdrawal history and balance-after-withdrawal tests.
   */
  confirmedWithdrawal(userId: UserId, overrides: Partial<Transaction> = {}): Transaction {
    const confirmedAt = overrides.confirmedAt ?? new Date('2024-01-15T09:30:00Z');
    const safeOverrides: Partial<Transaction> = { ...overrides };
    const tx = transactionFactory.build(userId, 'withdrawal', {
      amount: asAmount('0.05000000'),
      fee: asAmount('0.00010000'),
      status: 'confirmed',
      blockchainTxId: `0x${randomUUID().replace(/-/g, '')}`,
      ...safeOverrides,
    });
    tx.confirmedAt = confirmedAt;
    return tx;
  },

  /**
   * Failed transaction.
   * Use for failure handling and retry tests.
   */
  failed(
    userId: UserId,
    type: TransactionType = 'withdrawal',
    overrides: Partial<Transaction> = {},
  ): Transaction {
    const tx = transactionFactory.build(userId, type, {
      status: 'failed',
      ...overrides,
    });
    // Failed transactions have no confirmation timestamp
    delete tx.confirmedAt;
    return tx;
  },

  /**
   * Build a fee transaction.
   * Use for fee deduction accuracy assertions.
   */
  fee(userId: UserId, feeAmount: string, overrides: Partial<Transaction> = {}): Transaction {
    return transactionFactory.build(userId, 'fee', {
      amount: asAmount(feeAmount),
      fee: asAmount('0.00000000'),
      currency: 'USDT',
      ...overrides,
    });
  },

  buildMany(
    userId: UserId,
    count: number,
    type: TransactionType = 'deposit',
    overrides: Partial<Transaction> = {},
  ): Transaction[] {
    return Array.from({ length: count }, () => transactionFactory.build(userId, type, overrides));
  },
};

// ─── Deposit Address Factory ──────────────────────────────────────────────────

export const depositAddressFactory = {
  build(
    userId: UserId,
    currency: Currency = 'BTC',
    overrides: Partial<DepositAddress> = {},
  ): DepositAddress {
    const addresses: Record<Currency, { address: string; network: string }> = {
      BTC: { address: '1A1zP1eP5QGefi2DMPTfTL5SLmv7Divf Na', network: 'bitcoin' },
      ETH: { address: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e', network: 'ethereum' },
      USDT: { address: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e', network: 'ethereum' },
      USDC: { address: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e', network: 'ethereum' },
      USD: { address: 'WIRE-TRANSFER-REF-001', network: 'wire' },
      EUR: { address: 'SEPA-TRANSFER-REF-001', network: 'sepa' },
    };

    const defaults = addresses[currency] ?? { address: 'TEST-ADDRESS-001', network: 'test' };

    return {
      userId,
      currency,
      address: defaults.address,
      network: defaults.network,
      createdAt: new Date('2024-01-01T00:00:00Z'),
      ...overrides,
    };
  },
};
