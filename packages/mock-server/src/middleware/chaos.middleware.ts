/**
 * @qrypto/mock-server — Chaos Middleware
 *
 * Injects configured chaos into every non-admin request:
 *   - Artificial latency
 *   - Forced HTTP error codes
 *
 * Chaos state is configured via POST /admin/chaos and reset via POST /admin/reset.
 * Admin routes bypass chaos so test control always works.
 *
 * Last updated: 2024-01-15
 */

import type { NextFunction, Request, Response } from 'express';

import { getState } from '../state.js';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function chaosMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  // Admin routes are exempt — test control must always work
  if (req.path.startsWith('/admin')) {
    next();
    return;
  }

  const { chaos } = getState();

  if (chaos.latencyMs > 0) {
    await delay(chaos.latencyMs);
  }

  if (chaos.forceErrorCode !== null) {
    res.status(chaos.forceErrorCode).json({
      code: 'CHAOS_INJECTED',
      message: `Chaos: forced HTTP ${chaos.forceErrorCode}`,
    });
    return;
  }

  next();
}
