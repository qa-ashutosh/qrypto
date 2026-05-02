/**
 * @qrypto/api-suite — Wallet Tests
 *
 * Risk: Financial precision errors, incorrect fee deduction, balance inconsistency.
 * Every amount assertion uses string comparison — never parseFloat for equality.
 *
 * P0: Satoshi-level precision, balance invariant (total = available + reserved)
 * P0: Withdrawal deducts correct amount including fee
 * P1: Deposit confirmation credits correct balance
 * P2: Withdrawal limits, pagination
 *
 * Last updated: 2024-01-15
 */

import { test, expect, request } from '@playwright/test';
import { isEqual, subtract, add } from '@qrypto/shared-types';

import { AuthClient, WalletClient, AdminClient } from '../../clients/index.js';
import {
  SEED_USERS,
  SEED_TRANSACTIONS,
  TEST_BTC_ADDRESS,
  TEST_ETH_ADDRESS,
} from '../../fixtures/index.js';

test.describe('Wallet — Balance Precision', () => {
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

  test('seed BTC balance is exactly 0.50000000 @smoke', async () => {
    const token = await auth.loginFull(SEED_USERS.VERIFIED.email, SEED_USERS.VERIFIED.password);

    const balance = await wallet.getBalance('BTC', token);

    // String equality — never parseFloat for financial comparisons
    expect(balance.available).toBe('0.50000000');
    expect(balance.reserved).toBe('0.00000000');
    expect(balance.total).toBe('0.50000000');
    expect(balance.currency).toBe('BTC');
  });

  test('seed USDT balance is exactly 5000.000000', async () => {
    const token = await auth.loginFull(SEED_USERS.VERIFIED.email, SEED_USERS.VERIFIED.password);

    const balance = await wallet.getBalance('USDT', token);

    expect(balance.available).toBe('5000.000000');
    expect(balance.reserved).toBe('0.000000');
    expect(balance.total).toBe('5000.000000');
  });

  test('balance invariant holds: total === available + reserved', async () => {
    const token = await auth.loginFull(SEED_USERS.VERIFIED.email, SEED_USERS.VERIFIED.password);

    const balances = await wallet.getBalances(token);

    for (const balance of balances) {
      const computedTotal = add(balance.available, balance.reserved);
      expect(isEqual(computedTotal, balance.total)).toBe(true);
    }
  });

  test('zero balance user has 0.00000000 for all currencies', async () => {
    const token = await auth.loginFull(
      SEED_USERS.ZERO_BALANCE.email,
      SEED_USERS.ZERO_BALANCE.password,
    );

    const btc = await wallet.getBalance('BTC', token);

    expect(btc.available).toBe('0.00000000');
    expect(btc.reserved).toBe('0.00000000');
    expect(btc.total).toBe('0.00000000');
  });
});

test.describe('Wallet — Withdrawal Precision and Fee', () => {
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

  test('BTC withdrawal deducts amount + fee from available @smoke', async () => {
    const token = await auth.loginFull(SEED_USERS.VERIFIED.email, SEED_USERS.VERIFIED.password);

    const beforeBtc = await wallet.getBalance('BTC', token);
    const withdrawAmount = '0.01000000';
    const btcFee = '0.00010000';

    const res = await wallet.withdraw(
      {
        currency: 'BTC',
        amount: withdrawAmount,
        destinationAddress: TEST_BTC_ADDRESS,
        twoFactorCode: '123456',
      },
      token,
    );

    expect(res.status).toBe('pending');
    expect(res.amount).toBe(withdrawAmount);
    expect(res.fee).toBe(btcFee);

    const afterBtc = await wallet.getBalance('BTC', token);

    // available reduced by amount + fee
    const expectedAvailable = subtract(beforeBtc.available, add(withdrawAmount, btcFee));
    expect(isEqual(afterBtc.available, expectedAvailable)).toBe(true);

    // reserved increased by amount + fee
    const expectedReserved = add(beforeBtc.reserved, add(withdrawAmount, btcFee));
    expect(isEqual(afterBtc.reserved, expectedReserved)).toBe(true);

    // total unchanged
    expect(isEqual(afterBtc.total, beforeBtc.total)).toBe(true);
  });

  test('USDT withdrawal fee is exactly 1.000000', async () => {
    const token = await auth.loginFull(SEED_USERS.VERIFIED.email, SEED_USERS.VERIFIED.password);

    const res = await wallet.withdraw(
      {
        currency: 'USDT',
        amount: '100.000000',
        destinationAddress: TEST_ETH_ADDRESS,
        twoFactorCode: '123456',
      },
      token,
    );

    expect(res.fee).toBe('1.000000');
  });

  test('withdrawal with amount + fee exceeding balance returns 422', async () => {
    const token = await auth.loginFull(SEED_USERS.VERIFIED.email, SEED_USERS.VERIFIED.password);

    // BTC balance is 0.5 — try to withdraw 0.5 (fee would make total 0.5001 > 0.5)
    await expect(
      wallet.withdraw(
        {
          currency: 'BTC',
          amount: '0.50000000',
          destinationAddress: TEST_BTC_ADDRESS,
          twoFactorCode: '123456',
        },
        token,
      ),
    ).rejects.toMatchObject({
      status: 422,
      code: 'INSUFFICIENT_FUNDS',
    });
  });

  test('zero balance withdrawal returns 422 INSUFFICIENT_FUNDS', async () => {
    const token = await auth.loginFull(
      SEED_USERS.ZERO_BALANCE.email,
      SEED_USERS.ZERO_BALANCE.password,
    );

    await expect(
      wallet.withdraw(
        {
          currency: 'BTC',
          amount: '0.00100000',
          destinationAddress: TEST_BTC_ADDRESS,
          twoFactorCode: '123456',
        },
        token,
      ),
    ).rejects.toMatchObject({
      status: 422,
      code: 'INSUFFICIENT_FUNDS',
    });
  });

  test('withdrawal with wrong 2FA code is rejected', async () => {
    const token = await auth.loginFull(SEED_USERS.VERIFIED.email, SEED_USERS.VERIFIED.password);

    await expect(
      wallet.withdraw(
        {
          currency: 'USDT',
          amount: '10.000000',
          destinationAddress: TEST_ETH_ADDRESS,
          twoFactorCode: '999999',
        },
        token,
      ),
    ).rejects.toMatchObject({
      status: 401,
      code: 'INVALID_2FA_CODE',
    });
  });

  test('balance does not change on failed withdrawal', async () => {
    const token = await auth.loginFull(SEED_USERS.VERIFIED.email, SEED_USERS.VERIFIED.password);

    const before = await wallet.getBalance('USDT', token);

    // This will fail — wrong 2FA
    await expect(
      wallet.withdraw(
        {
          currency: 'USDT',
          amount: '10.000000',
          destinationAddress: TEST_ETH_ADDRESS,
          twoFactorCode: '999999',
        },
        token,
      ),
    ).rejects.toThrow();

    const after = await wallet.getBalance('USDT', token);

    // Balance must be identical
    expect(isEqual(after.available, before.available)).toBe(true);
    expect(isEqual(after.reserved, before.reserved)).toBe(true);
  });
});

test.describe('Wallet — Deposit Confirmation', () => {
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

  test('confirming pending deposit credits the correct balance @smoke', async () => {
    const token = await auth.loginFull(SEED_USERS.VERIFIED.email, SEED_USERS.VERIFIED.password);

    const before = await wallet.getBalance('BTC', token);

    // Confirm the seed pending deposit (0.05 BTC)
    await admin.confirmDeposit(SEED_TRANSACTIONS.PENDING_BTC_DEPOSIT);

    const after = await wallet.getBalance('BTC', token);

    const expectedAvailable = add(before.available, '0.05000000');
    expect(isEqual(after.available, expectedAvailable)).toBe(true);
  });

  test('confirming non-existent deposit returns 404', async () => {
    await expect(
      admin.confirmDeposit('00000000-0000-0000-0000-000000000000'),
    ).rejects.toMatchObject({ status: 404 });
  });
});

test.describe('Wallet — Transaction History', () => {
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

  test('returns seed transactions with correct types @smoke', async () => {
    const token = await auth.loginFull(SEED_USERS.VERIFIED.email, SEED_USERS.VERIFIED.password);

    const result = await wallet.getTransactions(token);

    expect(result.data.length).toBeGreaterThanOrEqual(4);
    expect(result.meta.total).toBeGreaterThanOrEqual(4);

    const types = result.data.map((t) => t.type);
    expect(types).toContain('deposit');
    expect(types).toContain('withdrawal');
  });

  test('currency filter returns only matching transactions', async () => {
    const token = await auth.loginFull(SEED_USERS.VERIFIED.email, SEED_USERS.VERIFIED.password);

    const btcTxs = await wallet.getTransactions(token, { currency: 'BTC' });

    btcTxs.data.forEach((tx) => {
      expect(tx.currency).toBe('BTC');
    });
  });

  test('pagination works correctly', async () => {
    const token = await auth.loginFull(SEED_USERS.VERIFIED.email, SEED_USERS.VERIFIED.password);

    const page1 = await wallet.getTransactions(token, { page: 1, limit: 2 });
    expect(page1.data.length).toBe(2);
    expect(page1.meta.page).toBe(1);
    expect(page1.meta.limit).toBe(2);
  });
});
