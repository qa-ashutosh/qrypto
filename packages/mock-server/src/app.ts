/**
 * @qrypto/mock-server — Express App
 *
 * Assembles the Express application: middleware stack, route mounting.
 * Kept separate from server startup (index.ts) so it can be tested in isolation.
 *
 * Last updated: 2024-01-15
 */

import express, { json, urlencoded } from 'express';

import { chaosMiddleware } from './middleware/chaos.middleware.js';
import { requestLogger } from './middleware/logger.middleware.js';
import { adminRouter } from './routes/admin.routes.js';
import { authRouter } from './routes/auth.routes.js';
import { kycRouter } from './routes/kyc.routes.js';
import { tradingRouter } from './routes/trading.routes.js';
import { walletRouter } from './routes/wallet.routes.js';

export function createApp(): express.Application {
  const app = express();

  // ── Core Middleware ─────────────────────────────────────────────────────────
  app.use(json({ limit: '1mb' }));
  app.use(urlencoded({ extended: false }));
  app.use(requestLogger);

  // Chaos middleware — applied after request logging, before route handlers
  // Admin routes are exempt (handled inside chaosMiddleware)
  app.use((req, res, next) => {
    void chaosMiddleware(req, res, next);
  });

  // ── Security Headers ────────────────────────────────────────────────────────
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '0'); // Disabled in favour of CSP
    next();
  });

  // ── Routes ──────────────────────────────────────────────────────────────────
  app.use('/admin', adminRouter);
  app.use('/auth', authRouter);
  app.use('/kyc', kycRouter);
  app.use('/wallet', walletRouter);
  app.use('/trading', tradingRouter);

  // ── 404 Handler ─────────────────────────────────────────────────────────────
  app.use((req, res) => {
    res.status(404).json({
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} does not exist`,
    });
  });

  // ── Error Handler ────────────────────────────────────────────────────────────
  app.use(
    (
      err: Error,
      req: express.Request,
      res: express.Response,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      _next: express.NextFunction,
    ) => {
      console.error('Unhandled error:', err);
      res.status(500).json({
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      });
    },
  );

  return app;
}
