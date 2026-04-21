/**
 * @qrypto/mock-server — Admin Routes
 *
 * QA-only control endpoints. Not present in a real exchange.
 * These routes are the mechanism for test isolation and state control.
 *
 * POST /admin/reset              — wipe all state, reinitialise from seed
 * POST /admin/kyc/:id/force      — force a user to a specific KYC status
 * POST /admin/aml/:id/force      — force AML flags on a user
 * POST /admin/deposit/confirm    — confirm a pending deposit
 * POST /admin/chaos              — configure chaos behaviour
 * DELETE /admin/chaos            — reset chaos to defaults
 * GET  /admin/health             — liveness check
 * GET  /admin/users              — list all seed users (test catalog)
 *
 * No auth required on admin routes — they are only reachable in test environments.
 * In a real deployment these would be firewalled to the test runner IP range.
 *
 * Last updated: 2024-01-15
 */

import { KycStatusSchema, AmlFlagSchema } from '@qrypto/shared-types';
import type { AmlFlag } from '@qrypto/shared-types';
import { Router } from 'express';

import { clearRateLimits } from '../middleware/rate-limit.middleware.js';
import { SEED_USER_IDS, SEED_EMAILS } from '../seed/seed.data.js';
import type { ChaosConfig } from '../state.js';
import {
  resetState,
  forceKycStatus,
  forceAmlFlags,
  confirmPendingDeposit,
  setChaos,
  resetChaos,
  getState,
} from '../state.js';

import { resetKycDocuments } from './kyc.routes.js';

export const adminRouter = Router();

// ─── POST /admin/reset ────────────────────────────────────────────────────────

adminRouter.post('/reset', (req, res) => {
  resetState();
  resetKycDocuments();
  clearRateLimits();

  res.status(200).json({
    ok: true,
    message: 'State reset to seed values',
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /admin/health ────────────────────────────────────────────────────────

adminRouter.get('/health', (req, res) => {
  const state = getState();
  res.status(200).json({
    ok: true,
    uptime: process.uptime(),
    users: state.users.size,
    sessions: state.sessions.size,
    orders: state.orders.size,
    transactions: state.transactions.size,
    chaos: state.chaos,
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /admin/users ─────────────────────────────────────────────────────────

adminRouter.get('/users', (req, res) => {
  const catalog = Object.entries(SEED_USER_IDS).map(([key, id]) => ({
    key,
    id,
    email: SEED_EMAILS[key as keyof typeof SEED_USER_IDS],
    password: 'TestPassword123!',
    twoFactorCode: '123456',
  }));

  res.status(200).json({ data: catalog });
});

// ─── POST /admin/kyc/:id/force ────────────────────────────────────────────────

adminRouter.post('/kyc/:id/force', (req, res) => {
  const { id } = req.params;
  const body = req.body as { status?: string };

  const statusResult = KycStatusSchema.safeParse(body.status);
  if (!statusResult.success) {
    res.status(400).json({
      code: 'VALIDATION_ERROR',
      message: `Invalid KYC status. Must be one of: unverified, pending, under_review, approved, rejected, rekyc_required`,
    });
    return;
  }

  if (!id) {
    res.status(400).json({ code: 'VALIDATION_ERROR', message: 'User ID required' });
    return;
  }

  const updated = forceKycStatus(id, statusResult.data);
  if (!updated) {
    res.status(404).json({ code: 'NOT_FOUND', message: `User ${id} not found` });
    return;
  }

  res.status(200).json({
    ok: true,
    userId: id,
    kycStatus: statusResult.data,
  });
});

// ─── POST /admin/aml/:id/force ────────────────────────────────────────────────

adminRouter.post('/aml/:id/force', (req, res) => {
  const { id } = req.params;
  const body = req.body as { flags?: unknown };

  if (!Array.isArray(body.flags)) {
    res.status(400).json({
      code: 'VALIDATION_ERROR',
      message: 'flags must be an array of AmlFlag values',
    });
    return;
  }

  const flagResults = body.flags.map((f) => AmlFlagSchema.safeParse(f));
  const invalid = flagResults.filter((r) => !r.success);
  if (invalid.length > 0) {
    res.status(400).json({
      code: 'VALIDATION_ERROR',
      message: 'One or more invalid AML flag values',
    });
    return;
  }

  const flags = flagResults.filter((r) => r.success).map((r) => r.data) as AmlFlag[];

  if (!id) {
    res.status(400).json({ code: 'VALIDATION_ERROR', message: 'User ID required' });
    return;
  }

  const updated = forceAmlFlags(id, flags);
  if (!updated) {
    res.status(404).json({ code: 'NOT_FOUND', message: `User ${id} not found` });
    return;
  }

  res.status(200).json({ ok: true, userId: id, amlFlags: flags });
});

// ─── POST /admin/deposit/confirm ──────────────────────────────────────────────

adminRouter.post('/deposit/confirm', (req, res) => {
  const body = req.body as { transactionId?: string };

  if (!body.transactionId) {
    res.status(400).json({ code: 'VALIDATION_ERROR', message: 'transactionId required' });
    return;
  }

  const confirmed = confirmPendingDeposit(body.transactionId);
  if (!confirmed) {
    res.status(404).json({
      code: 'NOT_FOUND',
      message: 'Transaction not found or not in pending deposit state',
    });
    return;
  }

  res.status(200).json({
    ok: true,
    transactionId: body.transactionId,
    status: 'confirmed',
  });
});

// ─── POST /admin/chaos ────────────────────────────────────────────────────────

adminRouter.post('/chaos', (req, res) => {
  const body = req.body as Record<string, unknown>;
  const config: Partial<ChaosConfig> = {};

  const latencyMs = body['latencyMs'];
  if (latencyMs !== undefined) {
    if (typeof latencyMs !== 'number' || latencyMs < 0) {
      res
        .status(400)
        .json({ code: 'VALIDATION_ERROR', message: 'latencyMs must be a non-negative number' });
      return;
    }
    config.latencyMs = latencyMs;
  }

  const forceErrorCode = body['forceErrorCode'];
  if (forceErrorCode !== undefined) {
    if (forceErrorCode !== null && (typeof forceErrorCode !== 'number' || forceErrorCode < 400)) {
      res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'forceErrorCode must be an HTTP error code (>=400) or null',
      });
      return;
    }
    config.forceErrorCode = forceErrorCode;
  }

  const dropWebSocket = body['dropWebSocket'];
  if (dropWebSocket !== undefined) {
    config.dropWebSocket = Boolean(dropWebSocket);
  }

  const stalePriceFeedSeconds = body['stalePriceFeedSeconds'];
  if (stalePriceFeedSeconds !== undefined) {
    config.stalePriceFeedSeconds = (stalePriceFeedSeconds as number | null) ?? null;
  }

  setChaos(config);
  res.status(200).json({ ok: true, chaos: getState().chaos });
});

// ─── DELETE /admin/chaos ──────────────────────────────────────────────────────

adminRouter.delete('/chaos', (req, res) => {
  resetChaos();
  res.status(200).json({ ok: true, chaos: getState().chaos });
});
