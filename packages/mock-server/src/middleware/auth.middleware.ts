/**
 * @qrypto/mock-server — JWT Middleware
 *
 * Validates Bearer tokens on protected routes.
 * Enforces scope: routes that require full access reject pre_2fa tokens.
 * Attaches decoded payload to res.locals for downstream handlers.
 *
 * Last updated: 2024-01-15
 */

import { JwtError, verifyToken } from '@qrypto/shared-types';
import type { NextFunction, Request, Response } from 'express';

import { getEnvOrThrow } from '../config.js';
import { isTokenRevoked } from '../state.js';

export interface AuthLocals {
  userId: string;
  sessionId: string;
  scope: 'full' | 'pre_2fa';
  jti: string;
}

declare module 'express-serve-static-core' {
  interface Locals {
    auth: AuthLocals;
  }
}

/**
 * Require a valid JWT. Attaches auth context to res.locals.auth.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;

  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({
      code: 'UNAUTHORIZED',
      message: 'Missing or malformed Authorization header',
    });
    return;
  }

  const token = header.slice(7);
  const secret = getEnvOrThrow('JWT_SECRET');

  try {
    const payload = verifyToken(token, secret);

    if (isTokenRevoked(payload.jti)) {
      res.status(401).json({
        code: 'TOKEN_REVOKED',
        message: 'Token has been revoked',
      });
      return;
    }

    res.locals.auth = {
      userId: payload.sub,
      sessionId: payload.sid,
      scope: payload.scope,
      jti: payload.jti,
    };

    next();
  } catch (err) {
    if (err instanceof JwtError) {
      const statusMap: Record<string, number> = {
        EXPIRED: 401,
        INVALID_SIGNATURE: 401,
        MALFORMED: 400,
        ALGORITHM_REJECTED: 400,
        INSUFFICIENT_SCOPE: 403,
      };

      const jwtErr = err;
      res.status(statusMap[jwtErr.code] ?? 401).json({
        code: jwtErr.code,
        message: jwtErr.message,
      });
      return;
    }

    res.status(401).json({ code: 'UNAUTHORIZED', message: 'Invalid token' });
  }
}

/**
 * Require full scope — rejects pre_2fa tokens.
 * Use after requireAuth on routes that must not be accessible before 2FA completion.
 */
export function requireFullScope(req: Request, res: Response, next: NextFunction): void {
  const auth = res.locals.auth as AuthLocals | undefined;

  if (!auth) {
    res.status(401).json({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
    return;
  }

  if (auth.scope !== 'full') {
    res.status(403).json({
      code: 'INSUFFICIENT_SCOPE',
      message: '2FA verification required to access this resource',
    });
    return;
  }

  next();
}
