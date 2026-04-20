/**
 * @qrypto/shared-types — User Factory
 *
 * Test data factory for User entities and auth-related objects.
 * All traits represent realistic, domain-meaningful states — not
 * arbitrary test data. Each factory method exists because a real
 * test scenario requires that specific state.
 *
 * Last updated: 2024-01-01
 */

import { randomUUID } from 'crypto';

import type {
  AmlFlag,
  AuthTokens,
  Session,
  SessionId,
  TokenScope,
  User,
  UserId,
} from '../types/domain.js';

// ─── Base Factory ─────────────────────────────────────────────────────────────

let _userSeq = 1;

function nextUserId(): UserId {
  return randomUUID() as UserId;
}

function nextEmail(seq: number): string {
  return `user-${seq}@qrypto-test.invalid`;
}

/**
 * Build a base User with sane defaults.
 * Every trait method calls this and overrides specific fields.
 */
function buildBase(overrides: Partial<User> = {}): User {
  const seq = _userSeq++;
  return {
    id: nextUserId(),
    email: nextEmail(seq),
    passwordHash: '$2b$12$test.hash.for.password.hashing.purposes.only.never.real',
    twoFactorEnabled: false,
    kycStatus: 'unverified',
    amlFlags: [],
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    isActive: true,
    failedLoginAttempts: 0,
    ...overrides,
  };
}

// ─── User Factory ─────────────────────────────────────────────────────────────

export const userFactory = {
  /**
   * Default user — unverified, no 2FA, clean record.
   * Use for basic auth tests and new user flows.
   */
  build(overrides: Partial<User> = {}): User {
    return buildBase(overrides);
  },

  /**
   * KYC-approved user with 2FA enabled.
   * Use for trading, withdrawal, and full-access flow tests.
   */
  withKyc(overrides: Partial<User> = {}): User {
    return buildBase({
      twoFactorEnabled: true,
      twoFactorSecret: 'JBSWY3DPEHPK3PXP', // static TOTP secret for test predictability
      kycStatus: 'approved',
      ...overrides,
    });
  },

  /**
   * User with KYC pending review — submitted but not yet approved.
   * Use for testing the "pending" state gate on withdrawals and trading.
   */
  withPendingKyc(overrides: Partial<User> = {}): User {
    return buildBase({
      kycStatus: 'pending',
      ...overrides,
    });
  },

  /**
   * User with KYC rejected.
   * Use for rejection flow tests and error message assertions.
   */
  withRejectedKyc(overrides: Partial<User> = {}): User {
    return buildBase({
      kycStatus: 'rejected',
      ...overrides,
    });
  },

  /**
   * User flagged by AML — account under review.
   * Use for AML freeze and manual review flow tests.
   */
  withAmlFlag(
    flags: AmlFlag[] = ['suspicious_transaction_pattern'],
    overrides: Partial<User> = {},
  ): User {
    return buildBase({
      kycStatus: 'approved',
      amlFlags: flags,
      ...overrides,
    });
  },

  /**
   * User with sanctions list match — hardest block.
   * Use for sanctions check rejection tests.
   */
  withSanctionsFlag(overrides: Partial<User> = {}): User {
    return userFactory.withAmlFlag(['sanctions_list_match'], overrides);
  },

  /**
   * Locked account — too many failed login attempts.
   * Use for brute-force lockout tests.
   */
  locked(overrides: Partial<User> = {}): User {
    const lockedUntil = new Date(Date.now() + 30 * 60 * 1000); // locked for 30 min
    return buildBase({
      failedLoginAttempts: 5,
      lockedUntil,
      ...overrides,
    });
  },

  /**
   * Inactive / suspended user.
   * Use for testing that inactive accounts cannot authenticate.
   */
  inactive(overrides: Partial<User> = {}): User {
    return buildBase({
      isActive: false,
      ...overrides,
    });
  },

  /**
   * User requiring re-KYC — triggered by account anomaly.
   * Use for the re-KYC trigger compliance flow.
   */
  requiresReKyc(overrides: Partial<User> = {}): User {
    return buildBase({
      kycStatus: 'rekyc_required',
      twoFactorEnabled: true,
      ...overrides,
    });
  },

  /**
   * Build multiple users at once.
   * Useful for concurrent session and race condition tests.
   */
  buildMany(count: number, overrides: Partial<User> = {}): User[] {
    return Array.from({ length: count }, () => buildBase(overrides));
  },

  /**
   * Reset the internal sequence counter.
   * Call in beforeAll/afterAll to keep emails deterministic across test files.
   */
  resetSequence(): void {
    _userSeq = 1;
  },
};

// ─── Session Factory ──────────────────────────────────────────────────────────

export const sessionFactory = {
  build(userId: UserId, scope: TokenScope = 'full', overrides: Partial<Session> = {}): Session {
    return {
      id: randomUUID() as SessionId,
      userId,
      scope,
      expiresAt: new Date(Date.now() + 900 * 1000), // 15 min
      createdAt: new Date(),
      ipAddress: '127.0.0.1',
      userAgent: 'qrypto-test-agent/1.0',
      isRevoked: false,
      ...overrides,
    };
  },

  /** A session in pre-2FA state — 2FA not yet completed. */
  pre2fa(userId: UserId, overrides: Partial<Session> = {}): Session {
    return sessionFactory.build(userId, 'pre_2fa', overrides);
  },

  /** An already-expired session. */
  expired(userId: UserId, overrides: Partial<Session> = {}): Session {
    return sessionFactory.build(userId, 'full', {
      expiresAt: new Date(Date.now() - 3600 * 1000), // expired 1 hour ago
      ...overrides,
    });
  },

  /** A revoked session (after explicit logout). */
  revoked(userId: UserId, overrides: Partial<Session> = {}): Session {
    return sessionFactory.build(userId, 'full', {
      isRevoked: true,
      ...overrides,
    });
  },
};

// ─── Auth Token Factory ───────────────────────────────────────────────────────

export const authTokenFactory = {
  /**
   * Build a synthetic AuthTokens response object.
   * Tokens are non-functional placeholder strings — use jwt.util.ts
   * to issue real signed tokens for auth middleware tests.
   */
  build(scope: TokenScope = 'full', overrides: Partial<AuthTokens> = {}): AuthTokens {
    return {
      accessToken: `test.access.token.${randomUUID()}`,
      refreshToken: `test.refresh.token.${randomUUID()}`,
      expiresIn: 900,
      tokenType: 'Bearer',
      scope,
      ...overrides,
    };
  },

  pre2fa(overrides: Partial<AuthTokens> = {}): AuthTokens {
    return authTokenFactory.build('pre_2fa', overrides);
  },
};
