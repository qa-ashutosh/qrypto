/**
 * @qrypto/mock-server — Auth Routes
 *
 * POST /auth/login        — email + password, issues pre_2fa token if 2FA enabled
 * POST /auth/2fa/verify   — complete 2FA, upgrades to full-scope token
 * POST /auth/refresh      — refresh access token
 * POST /auth/logout       — revoke current token
 * GET  /auth/sessions     — list active sessions for current user
 * DELETE /auth/sessions/:id — revoke a specific session
 *
 * Last updated: 2024-01-15
 */

import { randomUUID } from 'crypto';

import { LoginRequestSchema, TwoFactorRequestSchema, issueTokenPair } from '@qrypto/shared-types';
import type { Session, SessionId, UserId } from '@qrypto/shared-types';
import { Router } from 'express';

import { getConfig } from '../config.js';
import { requireAuth, requireFullScope } from '../middleware/auth.middleware.js';
import { loginRateLimit } from '../middleware/rate-limit.middleware.js';
import { getState, getUserByEmail, getUser, revokeToken } from '../state.js';

export const authRouter = Router();

// ─── POST /auth/login ─────────────────────────────────────────────────────────

authRouter.post('/login', loginRateLimit, (req, res) => {
  const parse = LoginRequestSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ code: 'VALIDATION_ERROR', message: parse.error.message });
    return;
  }

  const { email, password } = parse.data;
  const user = getUserByEmail(email);

  // Timing-safe: always do the same work regardless of whether user exists
  // In a real server this would be bcrypt.compare — here we check a test sentinel
  const passwordValid = password === 'TestPassword123!' && user !== undefined;

  if (!user || !passwordValid) {
    // Track failed attempts if user exists
    if (user) {
      user.failedLoginAttempts++;
      if (user.failedLoginAttempts >= 5) {
        user.lockedUntil = new Date(Date.now() + 30 * 60 * 1000);
      }
    }
    res.status(401).json({ code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' });
    return;
  }

  if (!user.isActive) {
    res.status(403).json({ code: 'ACCOUNT_INACTIVE', message: 'Account is suspended' });
    return;
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const retryAfterSeconds = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 1000);
    res.status(423).json({
      code: 'ACCOUNT_LOCKED',
      message: 'Account temporarily locked due to too many failed login attempts',
      retryAfterSeconds,
    });
    return;
  }

  // Reset failed attempts on successful login
  user.failedLoginAttempts = 0;

  const config = getConfig();
  const sessionId = randomUUID() as unknown as SessionId;

  // If 2FA is enabled, issue a pre_2fa token — the client must complete 2FA
  const scope = user.twoFactorEnabled ? 'pre_2fa' : 'full';

  const tokens = issueTokenPair(
    user.id,
    sessionId,
    scope,
    config.jwtSecret,
    config.jwtAccessTtl,
    config.jwtRefreshTtl,
  );

  // Persist session
  const session: Session = {
    id: sessionId,
    userId: user.id as unknown as UserId,
    scope,
    expiresAt: tokens.accessExpiresAt,
    createdAt: new Date(),
    ipAddress: req.ip ?? 'unknown',
    userAgent: req.headers['user-agent'] ?? 'unknown',
    isRevoked: false,
  };
  getState().sessions.set(sessionId, session);

  res.status(200).json({
    data: {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: config.jwtAccessTtl,
      tokenType: 'Bearer',
      scope,
      requiresTwoFactor: user.twoFactorEnabled,
      sessionId,
    },
  });
});

// ─── POST /auth/2fa/verify ────────────────────────────────────────────────────

authRouter.post('/2fa/verify', requireAuth, (req, res) => {
  const auth = res.locals.auth;
  if (!auth) {
    res.status(401).json({ code: 'UNAUTHORIZED' });
    return;
  }

  if (auth.scope !== 'pre_2fa') {
    res
      .status(400)
      .json({ code: 'BAD_REQUEST', message: '2FA already completed for this session' });
    return;
  }

  const parse = TwoFactorRequestSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ code: 'VALIDATION_ERROR', message: parse.error.message });
    return;
  }

  const { code } = parse.data;
  const user = getUser(auth.userId);
  if (!user) {
    res.status(401).json({ code: 'UNAUTHORIZED' });
    return;
  }

  // In tests, the static code '123456' is accepted for the seed TOTP secret
  // A real implementation would use a TOTP library
  const codeValid = code === '123456' || code === '000000';
  if (!codeValid) {
    res.status(401).json({ code: 'INVALID_2FA_CODE', message: 'Invalid or expired 2FA code' });
    return;
  }

  // Revoke the pre_2fa token
  revokeToken(auth.jti);

  // Issue full-scope token pair
  const config = getConfig();
  const tokens = issueTokenPair(
    user.id,
    auth.sessionId,
    'full',
    config.jwtSecret,
    config.jwtAccessTtl,
    config.jwtRefreshTtl,
  );

  // Update session scope
  const session = getState().sessions.get(auth.sessionId);
  if (session) {
    session.scope = 'full';
    session.expiresAt = tokens.accessExpiresAt;
  }

  res.status(200).json({
    data: {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: config.jwtAccessTtl,
      tokenType: 'Bearer',
      scope: 'full',
    },
  });
});

// ─── POST /auth/refresh ───────────────────────────────────────────────────────

authRouter.post('/refresh', requireAuth, (req, res) => {
  const auth = res.locals.auth;
  if (!auth) {
    res.status(401).json({ code: 'UNAUTHORIZED' });
    return;
  }

  const user = getUser(auth.userId);
  if (!user?.isActive) {
    res.status(401).json({ code: 'UNAUTHORIZED', message: 'User not found or inactive' });
    return;
  }

  // Revoke the old token (refresh token rotation)
  revokeToken(auth.jti);

  const config = getConfig();
  const tokens = issueTokenPair(
    user.id,
    auth.sessionId,
    auth.scope,
    config.jwtSecret,
    config.jwtAccessTtl,
    config.jwtRefreshTtl,
  );

  res.status(200).json({
    data: {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: config.jwtAccessTtl,
      tokenType: 'Bearer',
      scope: auth.scope,
    },
  });
});

// ─── POST /auth/logout ────────────────────────────────────────────────────────

authRouter.post('/logout', requireAuth, (req, res) => {
  const auth = res.locals.auth;
  if (!auth) {
    res.status(401).json({ code: 'UNAUTHORIZED' });
    return;
  }

  revokeToken(auth.jti);

  const session = getState().sessions.get(auth.sessionId);
  if (session) session.isRevoked = true;

  res.status(204).send();
});

// ─── GET /auth/sessions ───────────────────────────────────────────────────────

authRouter.get('/sessions', requireAuth, requireFullScope, (req, res) => {
  const auth = res.locals.auth;
  if (!auth) {
    res.status(401).json({ code: 'UNAUTHORIZED' });
    return;
  }

  const sessions = Array.from(getState().sessions.values())
    .filter(
      (s) =>
        s.userId === (auth.userId as unknown as UserId) && !s.isRevoked && s.expiresAt > new Date(),
    )
    .map((s) => ({
      id: s.id,
      scope: s.scope,
      createdAt: s.createdAt,
      expiresAt: s.expiresAt,
      ipAddress: s.ipAddress,
      userAgent: s.userAgent,
      isCurrent: s.id === auth.sessionId,
    }));

  res.status(200).json({ data: sessions });
});

// ─── DELETE /auth/sessions/:id ────────────────────────────────────────────────

authRouter.delete('/sessions/:id', requireAuth, requireFullScope, (req, res) => {
  const auth = res.locals.auth;
  if (!auth) {
    res.status(401).json({ code: 'UNAUTHORIZED' });
    return;
  }

  const session = getState().sessions.get(req.params['id'] ?? '');
  if (!session || session.userId !== (auth.userId as unknown as UserId)) {
    res.status(404).json({ code: 'NOT_FOUND', message: 'Session not found' });
    return;
  }

  session.isRevoked = true;

  // Revoke all tokens associated with this session
  // Walk the revoked tokens set and add the session's JTI
  // Since we don't store JTI per session, we mark by sessionId in a separate set
  getState().revokedSessions.add(session.id);

  res.status(204).send();
});
