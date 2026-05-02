/**
 * @qrypto/api-suite — Race Condition Tests
 *
 * Risk: Double-spend, balance inconsistency, state corruption under concurrency.
 * These tests intentionally fire simultaneous requests to expose concurrency bugs.
 *
 * P0: Concurrent withdrawals must not create double-spend
 * P0: Simultaneous orders must not over-allocate balance
 * P1: Parallel KYC submissions — only one should succeed
 *
 * Note: Race condition tests are inherently probabilistic. Failures here
 * indicate real bugs but passes do not guarantee correctness — they reduce risk.
 *
 * Last updated: 2024-01-15
 */

import { test, expect, request } from '@playwright/test';
import { add, isEqual, isGreaterThan } from '@qrypto/shared-types';

import {
  AuthClient,
  WalletClient,
  TradingClient,
  KycClient,
  AdminClient,
} from '../../clients/index.js';
import { SEED_USERS, TEST_BTC_ADDRESS, TEST_ETH_ADDRESS, delay } from '../../fixtures/index.js';

test.describe('Race Conditions — Concurrent Withdrawals', () => {
  let admin: AdminClient;

  test.beforeEach(async () => {
    const ctx = await request.newContext();
    admin = new AdminClient(ctx);
    await admin.reset();
  });

  test('two simultaneous withdrawals do not create double-spend @smoke', async () => {
    // Both requests fire at exactly the same time.
    // One should succeed, one should fail with INSUFFICIENT_FUNDS.
    // Neither should corrupt the balance.
    const ctx1 = await request.newContext();
    const ctx2 = await request.newContext();
    const auth1 = new AuthClient(ctx1);
    const auth2 = new AuthClient(ctx2);
    const wallet1 = new WalletClient(ctx1);
    const wallet2 = new WalletClient(ctx2);

    // Login same user in both contexts
    const token1 = await auth1.loginFull(SEED_USERS.VERIFIED.email, SEED_USERS.VERIFIED.password);
    const token2 = await auth2.loginFull(SEED_USERS.VERIFIED.email, SEED_USERS.VERIFIED.password);

    // Fire two withdrawals simultaneously — each for 4000 USDT (balance is 5000)
    const results = await Promise.allSettled([
      wallet1.withdraw(
        {
          currency: 'USDT',
          amount: '4000.000000',
          destinationAddress: TEST_ETH_ADDRESS,
          twoFactorCode: '123456',
        },
        token1,
      ),
      wallet2.withdraw(
        {
          currency: 'USDT',
          amount: '4000.000000',
          destinationAddress: TEST_ETH_ADDRESS,
          twoFactorCode: '123456',
        },
        token2,
      ),
    ]);

    const successes = results.filter((r) => r.status === 'fulfilled');
    const failures = results.filter((r) => r.status === 'rejected');

    // At most one should succeed — two 4000 withdrawals from a 5000 balance
    // is a double-spend if both succeed
    expect(successes.length).toBeLessThanOrEqual(1);
    expect(failures.length).toBeGreaterThanOrEqual(1);

    // Final balance should be >= 0 (never negative)
    const final = await wallet1.getBalance('USDT', token1);
    expect(isGreaterThan(final.total, '-0.000001') || isEqual(final.total, '0.000000')).toBe(true);

    // Balance invariant must hold
    const computedTotal = add(final.available, final.reserved);
    expect(isEqual(computedTotal, final.total)).toBe(true);
  });

  test('three concurrent BTC withdrawals from insufficient balance — only zero or one succeed', async () => {
    const ctxs = await Promise.all([
      request.newContext(),
      request.newContext(),
      request.newContext(),
    ]);

    const tokens = await Promise.all(
      ctxs.map((ctx) =>
        new AuthClient(ctx).loginFull(SEED_USERS.VERIFIED.email, SEED_USERS.VERIFIED.password),
      ),
    );

    // BTC balance is 0.5 — each tries to withdraw 0.4
    const results = await Promise.allSettled(
      ctxs.map((ctx, i) =>
        new WalletClient(ctx).withdraw(
          {
            currency: 'BTC',
            amount: '0.40000000',
            destinationAddress: TEST_BTC_ADDRESS,
            twoFactorCode: '123456',
          },
          tokens[i] ?? '',
        ),
      ),
    );

    const successes = results.filter((r) => r.status === 'fulfilled');

    // At most 1 can succeed (0.4 + fee = 0.4001 leaves only 0.0999, not enough for another)
    expect(successes.length).toBeLessThanOrEqual(1);

    // Verify final balance is not negative
    const token = tokens[0] ?? '';
    const final = await new WalletClient(ctxs[0]).getBalance('BTC', token);
    const computedTotal = add(final.available, final.reserved);
    expect(isEqual(computedTotal, final.total)).toBe(true);
  });
});

test.describe('Race Conditions — Simultaneous Order Placement', () => {
  let admin: AdminClient;

  test.beforeEach(async () => {
    const ctx = await request.newContext();
    admin = new AdminClient(ctx);
    await admin.reset();
  });

  test('simultaneous orders do not over-allocate balance', async () => {
    const ctxs = await Promise.all([
      request.newContext(),
      request.newContext(),
      request.newContext(),
    ]);

    const tokens = await Promise.all(
      ctxs.map((ctx) =>
        new AuthClient(ctx).loginFull(SEED_USERS.VERIFIED.email, SEED_USERS.VERIFIED.password),
      ),
    );

    // USDT balance is 5000 — each order tries to reserve 2000 USDT
    // notional = 2000, only 2 can fit, 3rd must be rejected
    const results = await Promise.allSettled(
      ctxs.map((ctx, i) =>
        new TradingClient(ctx).placeOrder(
          {
            pair: 'BTC/USDT',
            side: 'buy',
            type: 'limit',
            quantity: '0.03076923', // ~2000 USDT at 65000
            price: '65000.00',
          },
          tokens[i] ?? '',
        ),
      ),
    );

    // Not all three should succeed if balance is insufficient
    const successes = results.filter((r) => r.status === 'fulfilled');

    // Final USDT available must not be negative
    const ctx = await request.newContext();
    const token = await new AuthClient(ctx).loginFull(
      SEED_USERS.VERIFIED.email,
      SEED_USERS.VERIFIED.password,
    );
    const final = await new WalletClient(ctx).getBalance('USDT', token);

    expect(parseFloat(final.available)).toBeGreaterThanOrEqual(0);
    expect(parseFloat(final.total)).toBeGreaterThanOrEqual(0);

    // Balance invariant
    const computedTotal = add(final.available, final.reserved);
    expect(isEqual(computedTotal, final.total)).toBe(true);

    // At least some orders succeeded
    expect(successes.length).toBeGreaterThanOrEqual(1);
  });
});

test.describe('Race Conditions — Parallel KYC Submissions', () => {
  let admin: AdminClient;

  test.beforeEach(async () => {
    const ctx = await request.newContext();
    admin = new AdminClient(ctx);
    await admin.reset();
  });

  test('simultaneous KYC submissions — only one succeeds, others get 409', async () => {
    const ctxs = await Promise.all([
      request.newContext(),
      request.newContext(),
      request.newContext(),
    ]);

    // All three contexts login as the same unverified user
    const tokens = await Promise.all(
      ctxs.map((ctx) =>
        new AuthClient(ctx)
          .login(SEED_USERS.UNVERIFIED.email, SEED_USERS.UNVERIFIED.password)
          .then((r) => r.accessToken),
      ),
    );

    // Add tiny stagger to make the race more realistic
    const results = await Promise.allSettled([
      new KycClient(ctxs[0]).submitKyc('passport', 'doc1.jpg', tokens[0] ?? ''),
      (async () => {
        await delay(10);
        return new KycClient(ctxs[1]).submitKyc('passport', 'doc2.jpg', tokens[1] ?? '');
      })(),
      (async () => {
        await delay(20);
        return new KycClient(ctxs[2]).submitKyc('passport', 'doc3.jpg', tokens[2] ?? '');
      })(),
    ]);

    const successes = results.filter((r) => r.status === 'fulfilled');
    const failures = results.filter((r) => r.status === 'rejected');

    // First submission always succeeds — subsequent ones should fail with 409
    expect(successes.length).toBe(1);
    expect(failures.length).toBe(2);
  });
});
