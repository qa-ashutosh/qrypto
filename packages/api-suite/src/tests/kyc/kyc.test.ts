/**
 * @qrypto/api-suite — KYC Tests
 *
 * Risk: Unverified users accessing restricted operations is a regulatory breach.
 * KYC state machine correctness is a compliance obligation, not a feature.
 *
 * P0: KYC gate on withdrawals and trading
 * P0: State machine transitions
 * P1: AML flag behaviour
 * P2: Document submission, rejection flows
 *
 * Last updated: 2024-01-15
 */

import { test, expect, request } from '@playwright/test';

import {
  AuthClient,
  KycClient,
  WalletClient,
  TradingClient,
  AdminClient,
} from '../../clients/index.js';
import { SEED_USERS, TEST_BTC_ADDRESS } from '../../fixtures/index.js';

test.describe('KYC — Status and Capability Flags', () => {
  let auth: AuthClient;
  let kyc: KycClient;
  let admin: AdminClient;

  test.beforeEach(async () => {
    const ctx = await request.newContext();
    auth = new AuthClient(ctx);
    kyc = new KycClient(ctx);
    admin = new AdminClient(ctx);
    await admin.reset();
  });

  test('approved user has canWithdraw and canTrade flags set @smoke', async () => {
    const token = await auth.loginFull(SEED_USERS.VERIFIED.email, SEED_USERS.VERIFIED.password);

    const status = await kyc.getStatus(token);

    expect(status.status).toBe('approved');
    expect(status.canWithdraw).toBe(true);
    expect(status.canTrade).toBe(true);
    expect(status.amlFlags).toHaveLength(0);
  });

  test('unverified user cannot withdraw or trade @smoke', async () => {
    const token = await auth
      .login(SEED_USERS.UNVERIFIED.email, SEED_USERS.UNVERIFIED.password)
      .then((r) => r.accessToken);

    const status = await kyc.getStatus(token);

    expect(status.status).toBe('unverified');
    expect(status.canWithdraw).toBe(false);
    expect(status.canTrade).toBe(false);
  });

  test('AML-flagged user cannot withdraw even with approved KYC', async () => {
    const token = await auth
      .login(SEED_USERS.AML_FLAGGED.email, SEED_USERS.AML_FLAGGED.password)
      .then((r) => r.accessToken);

    const status = await kyc.getStatus(token);

    expect(status.status).toBe('approved');
    expect(status.canWithdraw).toBe(false); // blocked by AML
    expect(status.canTrade).toBe(true);
    expect(status.amlFlags).toContain('suspicious_transaction_pattern');
  });
});

test.describe('KYC — Withdrawal Gate', () => {
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

  test('unverified user withdrawal is blocked with KYC_REQUIRED @smoke', async () => {
    const token = await auth
      .login(SEED_USERS.UNVERIFIED.email, SEED_USERS.UNVERIFIED.password)
      .then((r) => r.accessToken);

    await expect(
      wallet.withdraw(
        {
          currency: 'USDT',
          amount: '100.000000',
          destinationAddress: TEST_BTC_ADDRESS,
          twoFactorCode: '123456',
        },
        token,
      ),
    ).rejects.toMatchObject({
      status: 403,
      code: 'KYC_REQUIRED',
    });
  });

  test('pending KYC user withdrawal is blocked', async () => {
    const token = await auth
      .login(SEED_USERS.KYC_PENDING.email, SEED_USERS.KYC_PENDING.password)
      .then((r) => r.accessToken);

    await expect(
      wallet.withdraw(
        {
          currency: 'USDT',
          amount: '100.000000',
          destinationAddress: TEST_BTC_ADDRESS,
          twoFactorCode: '123456',
        },
        token,
      ),
    ).rejects.toMatchObject({
      status: 403,
      code: 'KYC_REQUIRED',
    });
  });

  test('rejected KYC user withdrawal is blocked', async () => {
    const token = await auth
      .login(SEED_USERS.KYC_REJECTED.email, SEED_USERS.KYC_REJECTED.password)
      .then((r) => r.accessToken);

    await expect(
      wallet.withdraw(
        {
          currency: 'USDT',
          amount: '100.000000',
          destinationAddress: TEST_BTC_ADDRESS,
          twoFactorCode: '123456',
        },
        token,
      ),
    ).rejects.toMatchObject({
      status: 403,
      code: 'KYC_REQUIRED',
    });
  });

  test('AML-flagged user withdrawal is blocked with ACCOUNT_RESTRICTED', async () => {
    const token = await auth
      .login(SEED_USERS.AML_FLAGGED.email, SEED_USERS.AML_FLAGGED.password)
      .then((r) => r.accessToken);

    await expect(
      wallet.withdraw(
        {
          currency: 'USDT',
          amount: '100.000000',
          destinationAddress: TEST_BTC_ADDRESS,
          twoFactorCode: '123456',
        },
        token,
      ),
    ).rejects.toMatchObject({
      status: 403,
      code: 'ACCOUNT_RESTRICTED',
    });
  });

  test('clearing AML flags re-enables withdrawals', async () => {
    await admin.forceAmlFlags(SEED_USERS.AML_FLAGGED.id, []);

    const token = await auth
      .login(SEED_USERS.AML_FLAGGED.email, SEED_USERS.AML_FLAGGED.password)
      .then((r) => r.accessToken);

    // Should now succeed — no AML flags, KYC approved
    const res = await wallet.withdraw(
      {
        currency: 'USDT',
        amount: '100.000000',
        destinationAddress: TEST_BTC_ADDRESS,
        twoFactorCode: '123456',
      },
      token,
    );

    expect(res.status).toBe('pending');
  });
});

test.describe('KYC — Trading Gate', () => {
  let auth: AuthClient;
  let trading: TradingClient;
  let admin: AdminClient;

  test.beforeEach(async () => {
    const ctx = await request.newContext();
    auth = new AuthClient(ctx);
    trading = new TradingClient(ctx);
    admin = new AdminClient(ctx);
    await admin.reset();
  });

  test('unverified user cannot place orders', async () => {
    const token = await auth
      .login(SEED_USERS.UNVERIFIED.email, SEED_USERS.UNVERIFIED.password)
      .then((r) => r.accessToken);

    await expect(
      trading.placeOrder(
        { pair: 'BTC/USDT', side: 'buy', type: 'market', quantity: '0.001' },
        token,
      ),
    ).rejects.toMatchObject({ status: 403, code: 'KYC_REQUIRED' });
  });

  test('admin KYC approval immediately enables trading', async () => {
    await admin.forceKycStatus(SEED_USERS.UNVERIFIED.id, 'approved');

    const token = await auth
      .login(SEED_USERS.UNVERIFIED.email, SEED_USERS.UNVERIFIED.password)
      .then((r) => r.accessToken);

    const order = await trading.placeOrder(
      { pair: 'BTC/USDT', side: 'buy', type: 'market', quantity: '0.001' },
      token,
    );

    expect(order.status).toBe('filled');
  });
});

test.describe('KYC — Document Submission State Machine', () => {
  let auth: AuthClient;
  let kyc: KycClient;
  let admin: AdminClient;

  test.beforeEach(async () => {
    const ctx = await request.newContext();
    auth = new AuthClient(ctx);
    kyc = new KycClient(ctx);
    admin = new AdminClient(ctx);
    await admin.reset();
  });

  test('unverified user can submit KYC documents @smoke', async () => {
    const token = await auth
      .login(SEED_USERS.UNVERIFIED.email, SEED_USERS.UNVERIFIED.password)
      .then((r) => r.accessToken);

    const res = await kyc.submitKyc('passport', 'passport-front.jpg', token);

    expect(res.documentId).toBeTruthy();
    expect(res.status).toBe('pending');
  });

  test('already-pending user cannot re-submit', async () => {
    const token = await auth
      .login(SEED_USERS.KYC_PENDING.email, SEED_USERS.KYC_PENDING.password)
      .then((r) => r.accessToken);

    await expect(kyc.submitKyc('passport', 'passport.jpg', token)).rejects.toMatchObject({
      status: 409,
      code: 'KYC_ALREADY_SUBMITTED',
    });
  });

  test('rejected user can re-submit', async () => {
    const token = await auth
      .login(SEED_USERS.KYC_REJECTED.email, SEED_USERS.KYC_REJECTED.password)
      .then((r) => r.accessToken);

    const res = await kyc.submitKyc('national_id', 'id-front.jpg', token);
    expect(res.status).toBe('pending');
  });

  test('approved user cannot re-submit', async () => {
    const token = await auth.loginFull(SEED_USERS.VERIFIED.email, SEED_USERS.VERIFIED.password);

    await expect(kyc.submitKyc('passport', 'passport.jpg', token)).rejects.toMatchObject({
      status: 409,
      code: 'KYC_ALREADY_SUBMITTED',
    });
  });
});
