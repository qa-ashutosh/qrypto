/**
 * @qrypto/mock-server — Rate Limit Middleware
 *
 * In-memory rate limiting per IP + endpoint combination.
 * Mirrors real exchange behaviour for brute-force and rate limit bypass tests.
 *
 * Last updated: 2024-01-15
 */

import type { NextFunction, Request, Response } from 'express';

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

const store = new Map<string, RateLimitEntry>();

export interface RateLimitOptions {
  /** Max requests per window. */
  max: number;
  /** Window size in milliseconds. */
  windowMs: number;
  /** Key prefix — differentiate limits per route. */
  keyPrefix: string;
}

export function rateLimit(options: RateLimitOptions) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    const key = `${options.keyPrefix}:${ip}`;
    const now = Date.now();

    const entry = store.get(key);

    if (!entry || now - entry.windowStart > options.windowMs) {
      store.set(key, { count: 1, windowStart: now });
      next();
      return;
    }

    entry.count++;

    if (entry.count > options.max) {
      const retryAfterSeconds = Math.ceil((options.windowMs - (now - entry.windowStart)) / 1000);
      res.setHeader('Retry-After', String(retryAfterSeconds));
      res.status(429).json({
        code: 'RATE_LIMITED',
        message: 'Too many requests — slow down',
        retryAfterSeconds,
      });
      return;
    }

    next();
  };
}

/** Clear the rate limit store — called by /admin/reset */
export function clearRateLimits(): void {
  store.clear();
}

// ─── Preset Limiters ──────────────────────────────────────────────────────────

export const loginRateLimit = rateLimit({
  max: 6, // 5 attempts + 1 to trigger lockout
  windowMs: 15 * 60 * 1000, // 6 attempts per 15 minutes
  keyPrefix: 'login',
});

export const withdrawalRateLimit = rateLimit({
  max: 10,
  windowMs: 60 * 60 * 1000, // 10 per hour
  keyPrefix: 'withdrawal',
});

export const apiRateLimit = rateLimit({
  max: 100,
  windowMs: 60 * 1000, // 100 per minute general API
  keyPrefix: 'api',
});
