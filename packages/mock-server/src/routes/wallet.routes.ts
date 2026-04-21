/**
 * @qrypto/mock-server — Wallet Routes
 *
 * GET  /wallet/balances          — all balances for current user
 * GET  /wallet/balances/:currency — single currency balance
 * POST /wallet/withdraw           — submit withdrawal request
 * GET  /wallet/transactions       — transaction history
 * GET  /wallet/deposit/address/:currency — get deposit address
 *
 * Financial correctness: all arithmetic uses decimal.js via decimal.util.ts.
 * Native JS float arithmetic is never used on amounts.
 *
 * Last updated: 2024-01-15
 */

import { randomUUID } from 'crypto';

import {
  CurrencySchema,
  WithdrawalRequestSchema,
  add,
  subtract,
  isGreaterThanOrEqual,
  isNegative,
  toFixed,
} from '@qrypto/shared-types';
import type { AssetAmount, Currency, Transaction, UserId } from '@qrypto/shared-types';
import { Router } from 'express';

import { requireAuth, requireFullScope } from '../middleware/auth.middleware.js';
import { withdrawalRateLimit } from '../middleware/rate-limit.middleware.js';
import {
  getUser,
  getAllWallets,
  getWallet,
  setWallet,
  getTransactionsByUser,
  getState,
} from '../state.js';

export const walletRouter = Router();

const WITHDRAWAL_FEES: Record<Currency, string> = {
  BTC: '0.00010000',
  ETH: '0.00200000',
  USDT: '1.000000',
  USDC: '1.000000',
  USD: '5.000000',
  EUR: '5.000000',
};

const DEPOSIT_ADDRESSES: Record<Currency, { address: string; network: string }> = {
  BTC: { address: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa', network: 'bitcoin' },
  ETH: { address: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e', network: 'ethereum' },
  USDT: { address: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e', network: 'ethereum' },
  USDC: { address: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e', network: 'ethereum' },
  USD: { address: 'WIRE-TRANSFER-QRYPTO-001', network: 'wire' },
  EUR: { address: 'SEPA-TRANSFER-QRYPTO-001', network: 'sepa' },
};

// ─── GET /wallet/balances ─────────────────────────────────────────────────────

walletRouter.get('/balances', requireAuth, requireFullScope, (req, res) => {
  const auth = res.locals.auth;
  if (!auth) {
    res.status(401).json({ code: 'UNAUTHORIZED' });
    return;
  }

  const balances = getAllWallets(auth.userId);
  res.status(200).json({ data: balances });
});

// ─── GET /wallet/balances/:currency ──────────────────────────────────────────

walletRouter.get('/balances/:currency', requireAuth, requireFullScope, (req, res) => {
  const auth = res.locals.auth;
  if (!auth) {
    res.status(401).json({ code: 'UNAUTHORIZED' });
    return;
  }

  const currencyResult = CurrencySchema.safeParse(req.params['currency']?.toUpperCase());
  if (!currencyResult.success) {
    res.status(400).json({ code: 'INVALID_CURRENCY', message: 'Unknown currency' });
    return;
  }

  const wallet = getWallet(auth.userId, currencyResult.data);
  if (!wallet) {
    res.status(404).json({ code: 'NOT_FOUND', message: 'Wallet not found for this currency' });
    return;
  }

  res.status(200).json({ data: wallet });
});

// ─── POST /wallet/withdraw ────────────────────────────────────────────────────

walletRouter.post('/withdraw', requireAuth, requireFullScope, withdrawalRateLimit, (req, res) => {
  const auth = res.locals.auth;
  if (!auth) {
    res.status(401).json({ code: 'UNAUTHORIZED' });
    return;
  }

  const user = getUser(auth.userId);
  if (!user) {
    res.status(401).json({ code: 'UNAUTHORIZED' });
    return;
  }

  // KYC gate
  if (user.kycStatus !== 'approved') {
    res.status(403).json({
      code: 'KYC_REQUIRED',
      message: 'KYC verification required before withdrawals',
      kycStatus: user.kycStatus,
    });
    return;
  }

  // AML gate
  if (user.amlFlags.length > 0) {
    res.status(403).json({
      code: 'ACCOUNT_RESTRICTED',
      message: 'Account is under review — withdrawals are temporarily suspended',
      flags: user.amlFlags,
    });
    return;
  }

  const parse = WithdrawalRequestSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ code: 'VALIDATION_ERROR', message: parse.error.message });
    return;
  }

  const { currency, amount, destinationAddress } = parse.data;

  // 2FA code validation (static test codes accepted)
  const { twoFactorCode } = parse.data;
  if (twoFactorCode !== '123456' && twoFactorCode !== '000000') {
    res.status(401).json({ code: 'INVALID_2FA_CODE', message: 'Invalid 2FA code' });
    return;
  }

  const wallet = getWallet(auth.userId, currency);
  if (!wallet) {
    res.status(404).json({ code: 'NOT_FOUND', message: 'Wallet not found' });
    return;
  }

  const fee = WITHDRAWAL_FEES[currency] ?? '0';
  const totalDeducted = add(amount, fee);

  // Validate: amount must be positive
  if (isNegative(amount) || amount === '0') {
    res.status(400).json({ code: 'INVALID_AMOUNT', message: 'Withdrawal amount must be positive' });
    return;
  }

  // Validate: sufficient available balance
  if (!isGreaterThanOrEqual(wallet.available, totalDeducted)) {
    res.status(422).json({
      code: 'INSUFFICIENT_FUNDS',
      message: 'Insufficient available balance',
      available: wallet.available,
      required: totalDeducted,
    });
    return;
  }

  // Deduct from available, add to reserved (pending confirmation)
  const newAvailable = toFixed(
    subtract(wallet.available, totalDeducted),
    8,
  ) as unknown as AssetAmount;
  const newReserved = toFixed(add(wallet.reserved, totalDeducted), 8) as unknown as AssetAmount;
  const newTotal = toFixed(add(newAvailable, newReserved), 8) as unknown as AssetAmount;

  setWallet({
    ...wallet,
    available: newAvailable,
    reserved: newReserved,
    total: newTotal,
    updatedAt: new Date(),
  });

  // Create transaction record
  const tx: Transaction = {
    id: randomUUID(),
    userId: user.id as unknown as UserId,
    type: 'withdrawal',
    currency,
    amount: amount as unknown as AssetAmount,
    fee: fee as unknown as AssetAmount,
    status: 'pending',
    createdAt: new Date(),
  };
  getState().transactions.set(tx.id, tx);

  res.status(201).json({
    data: {
      transactionId: tx.id,
      status: 'pending',
      amount,
      fee,
      currency,
      destinationAddress,
      estimatedConfirmationMinutes: 30,
    },
  });
});

// ─── GET /wallet/transactions ─────────────────────────────────────────────────

walletRouter.get('/transactions', requireAuth, requireFullScope, (req, res) => {
  const auth = res.locals.auth;
  if (!auth) {
    res.status(401).json({ code: 'UNAUTHORIZED' });
    return;
  }

  const page = parseInt(String(req.query['page'] ?? '1'), 10);
  const limit = Math.min(parseInt(String(req.query['limit'] ?? '20'), 10), 100);
  const currency = req.query['currency'] as string | undefined;

  let txs = getTransactionsByUser(auth.userId);
  if (currency) {
    const currencyResult = CurrencySchema.safeParse(currency.toUpperCase());
    if (currencyResult.success) {
      txs = txs.filter((t) => t.currency === currencyResult.data);
    }
  }

  const total = txs.length;
  const paginated = txs.slice((page - 1) * limit, page * limit);

  res.status(200).json({
    data: paginated,
    meta: { page, limit, total },
  });
});

// ─── GET /wallet/deposit/address/:currency ────────────────────────────────────

walletRouter.get('/deposit/address/:currency', requireAuth, requireFullScope, (req, res) => {
  const auth = res.locals.auth;
  if (!auth) {
    res.status(401).json({ code: 'UNAUTHORIZED' });
    return;
  }

  const currencyResult = CurrencySchema.safeParse(req.params['currency']?.toUpperCase());
  if (!currencyResult.success) {
    res.status(400).json({ code: 'INVALID_CURRENCY', message: 'Unknown currency' });
    return;
  }

  const addressInfo = DEPOSIT_ADDRESSES[currencyResult.data];
  if (!addressInfo) {
    res.status(404).json({ code: 'NOT_FOUND', message: 'No deposit address for this currency' });
    return;
  }

  res.status(200).json({
    data: {
      currency: currencyResult.data,
      address: addressInfo.address,
      network: addressInfo.network,
    },
  });
});
