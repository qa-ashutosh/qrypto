/**
 * @qrypto/api-suite — Financial Calculation Tests
 *
 * Risk: Floating-point precision errors in financial calculations.
 * A decimal bug in P&L or liquidation price loses real money.
 *
 * These tests assert that the server's returned amounts are mathematically
 * correct to the required precision — using decimal.js for all assertions.
 *
 * P0: Fee calculation accuracy
 * P0: Balance arithmetic after operations
 * P1: Float precision traps (0.1 + 0.2 ≠ 0.3 in JS)
 * P2: Rounding direction (fees round up, user balances round down)
 *
 * Last updated: 2024-01-15
 */

import { test, expect, request } from '@playwright/test';
import {
  add,
  subtract,
  multiply,
  calculateFee,
  isEqual,
  isWithinTolerance,
  toFixed,
} from '@qrypto/shared-types';

import { AuthClient, TradingClient, WalletClient, AdminClient } from '../../clients/index.js';
import { SEED_USERS, TEST_BTC_ADDRESS, TEST_ETH_ADDRESS } from '../../fixtures/index.js';

test.describe('Calculations — Fee Precision', () => {
  let auth: AuthClient;
  let trading: TradingClient;
  let wallet: WalletClient;
  let admin: AdminClient;

  test.beforeEach(async () => {
    const ctx = await request.newContext();
    auth = new AuthClient(ctx);
    trading = new TradingClient(ctx);
    wallet = new WalletClient(ctx);
    admin = new AdminClient(ctx);
    await admin.reset();
  });

  test('market order fee is 0.1% of notional value @smoke', async () => {
    const token = await auth.loginFull(SEED_USERS.VERIFIED.email, SEED_USERS.VERIFIED.password);

    // Place a market buy — fills at reference price 65000
    const order = await trading.placeOrder(
      { pair: 'BTC/USDT', side: 'buy', type: 'market', quantity: '0.01' },
      token,
    );

    expect(order.status).toBe('filled');
    expect(order.averageFillPrice).toBeTruthy();

    // fee = notional * 0.001
    const notional = multiply(order.quantity, order.averageFillPrice ?? '0');
    const expectedFee = calculateFee(notional, '0.001');

    // Fee should match within satoshi tolerance
    expect(isWithinTolerance(order.fee, expectedFee, 6)).toBe(true);
  });

  test('decimal.js 0.1 + 0.2 === 0.3 — float precision trap', () => {
    // This is the canonical JS floating point bug.
    // Native: 0.1 + 0.2 = 0.30000000000000004
    // With decimal.js: 0.1 + 0.2 = 0.3
    const result = add('0.1', '0.2');
    expect(isEqual(result, '0.3')).toBe(true);
    expect(result).toBe('0.3');
  });

  test('0.1 + 0.2 with native JS would be wrong', () => {
    // Explicitly document the trap we are protecting against
    const nativeResult = 0.1 + 0.2;
    expect(nativeResult).not.toBe(0.3); // native JS fails
    expect(nativeResult.toString()).toBe('0.30000000000000004');
  });

  test('BTC withdrawal fee is exactly 0.00010000', async () => {
    const token = await auth.loginFull(SEED_USERS.VERIFIED.email, SEED_USERS.VERIFIED.password);

    const res = await wallet.withdraw(
      {
        currency: 'BTC',
        amount: '0.01000000',
        destinationAddress: TEST_BTC_ADDRESS,
        twoFactorCode: '123456',
      },
      token,
    );

    expect(res.fee).toBe('0.00010000');
    expect(isEqual(res.fee, '0.00010000')).toBe(true);
  });

  test('multiple withdrawals do not accumulate precision error', async () => {
    const token = await auth.loginFull(SEED_USERS.VERIFIED.email, SEED_USERS.VERIFIED.password);

    const initial = await wallet.getBalance('USDT', token);
    const withdrawAmount = '100.000000';
    const usdtFee = '1.000000';
    const totalPerWithdrawal = add(withdrawAmount, usdtFee);

    // Make 3 withdrawals
    for (let i = 0; i < 3; i++) {
      await wallet.withdraw(
        {
          currency: 'USDT',
          amount: withdrawAmount,
          destinationAddress: TEST_ETH_ADDRESS,
          twoFactorCode: '123456',
        },
        token,
      );
    }

    const final = await wallet.getBalance('USDT', token);

    // Total deducted should be exactly 3 × (100 + 1) = 303
    const totalDeducted = multiply('3', totalPerWithdrawal);
    const expectedAvailable = subtract(initial.available, totalDeducted);

    expect(isEqual(final.available, toFixed(expectedAvailable, 6))).toBe(true);
  });
});

test.describe('Calculations — Balance Arithmetic Invariants', () => {
  let auth: AuthClient;
  let wallet: WalletClient;
  let admin: AdminClient;

  test.beforeEach(async () => {
    const ctx = await request.newContext();
    auth = new AuthClient(ctx);
    wallet = new WalletClient(ctx);
    admin = new AdminClient(ctx);
    await admin.reset();
  });

  test('total always equals available + reserved after withdrawal', async () => {
    const token = await auth.loginFull(SEED_USERS.VERIFIED.email, SEED_USERS.VERIFIED.password);

    await wallet.withdraw(
      {
        currency: 'BTC',
        amount: '0.01000000',
        destinationAddress: TEST_BTC_ADDRESS,
        twoFactorCode: '123456',
      },
      token,
    );

    const balance = await wallet.getBalance('BTC', token);
    const computedTotal = add(balance.available, balance.reserved);

    expect(isEqual(computedTotal, balance.total)).toBe(true);
  });

  test('total always equals available + reserved after deposit confirmation', async () => {
    const token = await auth.loginFull(SEED_USERS.VERIFIED.email, SEED_USERS.VERIFIED.password);

    await admin.confirmDeposit('c1000000-0000-0000-0000-000000000004');

    const balance = await wallet.getBalance('BTC', token);
    const computedTotal = add(balance.available, balance.reserved);

    expect(isEqual(computedTotal, balance.total)).toBe(true);
  });

  test('decimal precision preserved across currencies', async () => {
    const token = await auth.loginFull(SEED_USERS.VERIFIED.email, SEED_USERS.VERIFIED.password);

    const balances = await wallet.getBalances(token);

    for (const b of balances) {
      // BTC/ETH: 8 decimal places. Stables: 6 decimal places.
      const expectedDecimals = ['BTC', 'ETH'].includes(b.currency) ? 8 : 6;
      const decimalPart = b.available.split('.')[1] ?? '';
      expect(decimalPart.length).toBe(expectedDecimals);
    }
  });
});
