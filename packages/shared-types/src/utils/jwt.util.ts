/**
 * @qrypto/shared-types — JWT Utility
 *
 * Token generation, decoding, and expiry helpers for the qrypto platform.
 * Used by the mock server to issue tokens and by test suites to inspect them.
 *
 * Implementation is intentionally minimal — no external JWT library dependency.
 * We use Node's built-in crypto for HMAC-SHA256 signing. This keeps the
 * shared-types package light and dependency-free for the signing path.
 *
 * Last updated: 2024-01-01
 */

import { createHmac, timingSafeEqual } from 'crypto';

import type { TokenScope } from '../types/domain.js';

export interface JwtPayload {
  sub: string; // userId
  sid: string; // sessionId
  scope: TokenScope;
  iat: number; // issued at (Unix seconds)
  exp: number; // expires at (Unix seconds)
  jti: string; // JWT ID — unique per token, used for revocation
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: Date;
  refreshExpiresAt: Date;
}

// ─── Encoding Helpers ─────────────────────────────────────────────────────────

function base64UrlEncode(input: string | Buffer): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : input;
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function base64UrlDecode(input: string): Buffer {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  const padLength = (4 - (padded.length % 4)) % 4;
  return Buffer.from(padded + '='.repeat(padLength), 'base64');
}

const HEADER = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));

function sign(headerPayload: string, secret: string): string {
  return base64UrlEncode(createHmac('sha256', secret).update(headerPayload).digest());
}

// ─── Core Operations ──────────────────────────────────────────────────────────

/**
 * Issue a signed JWT with the given payload.
 */
export function issueToken(payload: JwtPayload, secret: string): string {
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const headerPayload = `${HEADER}.${encodedPayload}`;
  const signature = sign(headerPayload, secret);
  return `${headerPayload}.${signature}`;
}

/**
 * Verify and decode a JWT.
 * Throws a descriptive error on any failure — expired, invalid signature,
 * malformed, wrong algorithm. Never returns a partial result.
 */
export function verifyToken(token: string, secret: string): JwtPayload {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new JwtError('MALFORMED', 'Token does not have three parts');
  }

  const [encodedHeader, encodedPayload, receivedSignature] = parts as [string, string, string];

  // Verify algorithm — reject alg:none and any non-HS256 algorithm
  let header: Record<string, unknown>;
  try {
    header = JSON.parse(base64UrlDecode(encodedHeader).toString('utf8')) as Record<string, unknown>;
  } catch {
    throw new JwtError('MALFORMED', 'Cannot decode token header');
  }

  if (header['alg'] !== 'HS256') {
    throw new JwtError(
      'ALGORITHM_REJECTED',
      `Algorithm "${String(header['alg'])}" rejected — only HS256 is accepted`,
    );
  }

  // Verify signature using timing-safe comparison
  const expectedSignature = sign(`${encodedHeader}.${encodedPayload}`, secret);
  const expectedBuf = Buffer.from(expectedSignature, 'utf8');
  const receivedBuf = Buffer.from(receivedSignature, 'utf8');

  if (expectedBuf.length !== receivedBuf.length || !timingSafeEqual(expectedBuf, receivedBuf)) {
    throw new JwtError('INVALID_SIGNATURE', 'Token signature verification failed');
  }

  // Decode payload
  let payload: JwtPayload;
  try {
    payload = JSON.parse(base64UrlDecode(encodedPayload).toString('utf8')) as JwtPayload;
  } catch {
    throw new JwtError('MALFORMED', 'Cannot decode token payload');
  }

  // Check expiry
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (payload.exp <= nowSeconds) {
    throw new JwtError('EXPIRED', `Token expired at ${new Date(payload.exp * 1000).toISOString()}`);
  }

  return payload;
}

/**
 * Decode a JWT without verifying the signature.
 * FOR TEST USE ONLY — inspecting token claims in assertions.
 * Never use in production auth paths.
 */
export function decodeTokenUnsafe(token: string): JwtPayload {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new JwtError('MALFORMED', 'Token does not have three parts');
  }
  const encodedPayload = parts[1];
  if (!encodedPayload) {
    throw new JwtError('MALFORMED', 'Missing token payload');
  }
  return JSON.parse(base64UrlDecode(encodedPayload).toString('utf8')) as JwtPayload;
}

/**
 * Check whether a token is expired without verifying its signature.
 * Safe to call on any JWT string format.
 */
export function isTokenExpired(token: string): boolean {
  try {
    const payload = decodeTokenUnsafe(token);
    return payload.exp <= Math.floor(Date.now() / 1000);
  } catch {
    return true;
  }
}

/**
 * Return the expiry Date of a token without signature verification.
 */
export function getTokenExpiry(token: string): Date {
  const payload = decodeTokenUnsafe(token);
  return new Date(payload.exp * 1000);
}

/**
 * Issue an access + refresh token pair for a user session.
 */
export function issueTokenPair(
  userId: string,
  sessionId: string,
  scope: TokenScope,
  secret: string,
  accessTtlSeconds = 900,
  refreshTtlSeconds = 604800,
): TokenPair {
  const now = Math.floor(Date.now() / 1000);

  const accessPayload: JwtPayload = {
    sub: userId,
    sid: sessionId,
    scope,
    iat: now,
    exp: now + accessTtlSeconds,
    jti: crypto.randomUUID(),
  };

  const refreshPayload: JwtPayload = {
    sub: userId,
    sid: sessionId,
    scope,
    iat: now,
    exp: now + refreshTtlSeconds,
    jti: crypto.randomUUID(),
  };

  return {
    accessToken: issueToken(accessPayload, secret),
    refreshToken: issueToken(refreshPayload, secret),
    accessExpiresAt: new Date((now + accessTtlSeconds) * 1000),
    refreshExpiresAt: new Date((now + refreshTtlSeconds) * 1000),
  };
}

/**
 * Issue an already-expired token. Used in auth tests to verify expiry handling.
 */
export function issueExpiredToken(
  userId: string,
  sessionId: string,
  scope: TokenScope,
  secret: string,
): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: JwtPayload = {
    sub: userId,
    sid: sessionId,
    scope,
    iat: now - 7200,
    exp: now - 3600, // expired 1 hour ago
    jti: crypto.randomUUID(),
  };
  return issueToken(payload, secret);
}

/**
 * Issue a token with alg:none header — used in security tests to verify
 * that the server rejects algorithm confusion attacks.
 */
export function issueAlgNoneToken(userId: string, sessionId: string): string {
  const now = Math.floor(Date.now() / 1000);
  const noneHeader = base64UrlEncode(JSON.stringify({ alg: 'none', typ: 'JWT' }));
  const payload: JwtPayload = {
    sub: userId,
    sid: sessionId,
    scope: 'full',
    iat: now,
    exp: now + 900,
    jti: crypto.randomUUID(),
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  return `${noneHeader}.${encodedPayload}.`;
}

// ─── Error Type ───────────────────────────────────────────────────────────────

export type JwtErrorCode =
  | 'MALFORMED'
  | 'EXPIRED'
  | 'INVALID_SIGNATURE'
  | 'ALGORITHM_REJECTED'
  | 'INSUFFICIENT_SCOPE';

export class JwtError extends Error {
  readonly code: JwtErrorCode;

  constructor(code: JwtErrorCode, message: string) {
    super(message);
    this.name = 'JwtError';
    this.code = code;
  }
}
