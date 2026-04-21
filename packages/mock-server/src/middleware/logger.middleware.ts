/**
 * @qrypto/mock-server — Request Logger Middleware
 *
 * Structured JSON request/response logging with correlation IDs.
 * Every request gets a correlation ID in the response header.
 * Ties test logs to server logs — essential for debugging failures.
 *
 * Last updated: 2024-01-15
 */

import { randomUUID } from 'crypto';

import { logger } from '@qrypto/shared-types';
import type { NextFunction, Request, Response } from 'express';

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const correlationId = (req.headers['x-correlation-id'] as string | undefined) ?? randomUUID();
  const start = Date.now();

  res.setHeader('x-correlation-id', correlationId);

  const reqLogger = logger.child({
    correlationId,
    method: req.method,
    path: req.path,
    ip: req.ip,
  });

  reqLogger.info('request received');

  res.on('finish', () => {
    const durationMs = Date.now() - start;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    reqLogger[level](`request completed`, {
      statusCode: res.statusCode,
      durationMs,
    });
  });

  next();
}
