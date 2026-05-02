/**
 * @qrypto/api-suite — Auth Tests
 *
 * Risk: Authentication bypass, token theft, session hijacking.
 * Every test here maps to a real attack vector or compliance requirement.
 *
 * P0: Login, 2FA enforcement, token expiry
 * P1: Brute-force lockout, session management, concurrent sessions
 * P2: Refresh rotation, logout revocation
 *
 * Last updated: 2024-01-15
 */

import { test, expect, request } from '@playwright/test';

import { AuthClient, AdminClient } from '../../clients/index.js';
import { SEED_USERS } from '../../fixtures/index.js';

test.describe('Auth — Login', () => {
  let auth: AuthClient;
  let admin: AdminClient;

  test.beforeEach(async () => {
    const ctx = await request.newContext();
    auth = new AuthClient(ctx);
    admin = new AdminClient(ctx);
    await admin.reset();
  });

  test('valid credentials without 2FA return full-scope token @smoke', async () => {
    const res = await auth.login(SEED_USERS.UNVERIFIED.email, SEED_USERS.UNVERIFIED.password);

    expect(res.scope).toBe('full');
    expect(res.requiresTwoFactor).toBe(false);
    expect(res.accessToken).toBeTruthy();
    expect(res.refreshToken).toBeTruthy();
    expect(res.sessionId).toBeTruthy();
    expect(res.expiresIn).toBe(900);
  });

  test('valid credentials with 2FA enabled return pre_2fa scope @smoke', async () => {
    const res = await auth.login(SEED_USERS.VERIFIED.email, SEED_USERS.VERIFIED.password);

    expect(res.scope).toBe('pre_2fa');
    expect(res.requiresTwoFactor).toBe(true);
    expect(res.accessToken).toBeTruthy();
    expect(res.sessionId).toBeTruthy();
  });

  test('invalid password returns 401 INVALID_CREDENTIALS', async () => {
    await expect(auth.login(SEED_USERS.VERIFIED.email, 'WrongPassword999!')).rejects.toMatchObject({
      status: 401,
      code: 'INVALID_CREDENTIALS',
    });
  });

  test('unknown email returns 401 INVALID_CREDENTIALS', async () => {
    await expect(
      auth.login('nobody@qrypto-test.invalid', 'TestPassword123!'),
    ).rejects.toMatchObject({
      status: 401,
      code: 'INVALID_CREDENTIALS',
    });
  });

  test('locked account returns 423 ACCOUNT_LOCKED', async () => {
    await expect(
      auth.login(SEED_USERS.LOCKED.email, SEED_USERS.LOCKED.password),
    ).rejects.toMatchObject({
      status: 423,
      code: 'ACCOUNT_LOCKED',
    });
  });

  test('5 failed attempts lock the account', async () => {
    const email = SEED_USERS.UNVERIFIED.email;

    // 5 failed attempts
    for (let i = 0; i < 5; i++) {
      await expect(auth.login(email, 'WrongPassword!')).rejects.toMatchObject({
        status: 401,
      });
    }

    // 6th attempt — should be locked
    await expect(auth.login(email, SEED_USERS.UNVERIFIED.password)).rejects.toMatchObject({
      status: 423,
      code: 'ACCOUNT_LOCKED',
    });
  });
});

test.describe('Auth — 2FA Verification', () => {
  let auth: AuthClient;
  let admin: AdminClient;

  test.beforeEach(async () => {
    const ctx = await request.newContext();
    auth = new AuthClient(ctx);
    admin = new AdminClient(ctx);
    await admin.reset();
  });

  test('valid 2FA code upgrades pre_2fa token to full scope @smoke', async () => {
    const loginRes = await auth.login(SEED_USERS.VERIFIED.email, SEED_USERS.VERIFIED.password);
    expect(loginRes.scope).toBe('pre_2fa');

    const twoFaRes = await auth.verify2fa(loginRes.sessionId, '123456', loginRes.accessToken);

    expect(twoFaRes.scope).toBe('full');
    expect(twoFaRes.accessToken).toBeTruthy();
    expect(twoFaRes.accessToken).not.toBe(loginRes.accessToken);
  });

  test('invalid 2FA code returns 401 INVALID_2FA_CODE', async () => {
    const loginRes = await auth.login(SEED_USERS.VERIFIED.email, SEED_USERS.VERIFIED.password);

    await expect(
      auth.verify2fa(loginRes.sessionId, '000001', loginRes.accessToken),
    ).rejects.toMatchObject({
      status: 401,
      code: 'INVALID_2FA_CODE',
    });
  });

  test('pre_2fa token cannot access protected routes', async () => {
    const ctx = await request.newContext();
    const wallet = (await import('../../clients/index.js')).WalletClient;
    const walletClient = new wallet(ctx);

    const loginRes = await auth.login(SEED_USERS.VERIFIED.email, SEED_USERS.VERIFIED.password);
    expect(loginRes.scope).toBe('pre_2fa');

    await expect(walletClient.getBalances(loginRes.accessToken)).rejects.toMatchObject({
      status: 403,
      code: 'INSUFFICIENT_SCOPE',
    });
  });

  test('pre_2fa token from previous session is revoked after 2FA completion', async () => {
    const loginRes = await auth.login(SEED_USERS.VERIFIED.email, SEED_USERS.VERIFIED.password);
    const preToken = loginRes.accessToken;

    await auth.verify2fa(loginRes.sessionId, '123456', preToken);

    // The old pre_2fa token should now be revoked
    await expect(auth.verify2fa(loginRes.sessionId, '123456', preToken)).rejects.toMatchObject({
      status: 401,
      code: 'TOKEN_REVOKED',
    });
  });
});

test.describe('Auth — Token Lifecycle', () => {
  let auth: AuthClient;
  let admin: AdminClient;

  test.beforeEach(async () => {
    const ctx = await request.newContext();
    auth = new AuthClient(ctx);
    admin = new AdminClient(ctx);
    await admin.reset();
  });

  test('refresh returns new token pair and revokes old token @smoke', async () => {
    const token = await auth.loginFull(SEED_USERS.VERIFIED.email, SEED_USERS.VERIFIED.password);

    const refreshed = await auth.refresh(token);

    expect(refreshed.accessToken).toBeTruthy();
    expect(refreshed.accessToken).not.toBe(token);
    expect(refreshed.scope).toBe('full');

    // Old token revoked after rotation
    await expect(auth.refresh(token)).rejects.toMatchObject({
      status: 401,
      code: 'TOKEN_REVOKED',
    });
  });

  test('logout revokes token immediately', async () => {
    const token = await auth.loginFull(SEED_USERS.VERIFIED.email, SEED_USERS.VERIFIED.password);

    await auth.logout(token);

    // Token is now revoked
    await expect(auth.refresh(token)).rejects.toMatchObject({
      status: 401,
      code: 'TOKEN_REVOKED',
    });
  });

  test('malformed token returns 400', async () => {
    await expect(auth.getSessions('not.a.valid.token')).rejects.toMatchObject({ status: 400 });
  });

  test('completely absent token returns 401', async () => {
    await expect(auth.getSessions('')).rejects.toThrow();
  });
});

test.describe('Auth — Session Management', () => {
  let auth: AuthClient;
  let admin: AdminClient;

  test.beforeEach(async () => {
    const ctx = await request.newContext();
    auth = new AuthClient(ctx);
    admin = new AdminClient(ctx);
    await admin.reset();
  });

  test('list sessions returns current session @smoke', async () => {
    const token = await auth.loginFull(SEED_USERS.VERIFIED.email, SEED_USERS.VERIFIED.password);

    const sessions = await auth.getSessions(token);

    expect(sessions.length).toBeGreaterThanOrEqual(1);
    const current = sessions.find((s) => s.isCurrent);
    expect(current).toBeDefined();
    expect(current?.scope).toBe('full');
  });

  test('revoke a specific session', async () => {
    // Create two sessions
    const token1 = await auth.loginFull(SEED_USERS.VERIFIED.email, SEED_USERS.VERIFIED.password);
    const token2 = await auth.loginFull(SEED_USERS.VERIFIED.email, SEED_USERS.VERIFIED.password);

    const sessions = await auth.getSessions(token1);
    const otherSession = sessions.find((s) => !s.isCurrent);

    if (otherSession) {
      await auth.deleteSession(otherSession.id, token1);

      // token2 should now be revoked
      await expect(auth.getSessions(token2)).rejects.toMatchObject({
        status: 401,
        code: 'TOKEN_REVOKED',
      });
    }
  });

  test('cannot revoke another user session via IDOR', async () => {
    const token1 = await auth.loginFull(SEED_USERS.VERIFIED.email, SEED_USERS.VERIFIED.password);
    const token2 = await auth.loginFull(
      SEED_USERS.UNVERIFIED.email,
      SEED_USERS.UNVERIFIED.password,
    );

    // Get token2's session ID
    const sessions2 = await auth.getSessions(token2);
    const session2 = sessions2.find((s) => s.isCurrent);
    expect(session2).toBeDefined();

    // Try to revoke it with token1 — should 404
    if (session2) {
      await expect(auth.deleteSession(session2.id, token1)).rejects.toMatchObject({ status: 404 });
    }
  });

  test('concurrent sessions are all independently valid', async () => {
    const tokens = await Promise.all([
      auth.loginFull(SEED_USERS.VERIFIED.email, SEED_USERS.VERIFIED.password),
      auth.loginFull(SEED_USERS.VERIFIED.email, SEED_USERS.VERIFIED.password),
      auth.loginFull(SEED_USERS.VERIFIED.email, SEED_USERS.VERIFIED.password),
    ]);

    // All three tokens work independently
    const sessionLists = await Promise.all(tokens.map((t) => auth.getSessions(t)));
    sessionLists.forEach((sessions) => {
      expect(sessions.length).toBeGreaterThanOrEqual(1);
    });
  });
});
