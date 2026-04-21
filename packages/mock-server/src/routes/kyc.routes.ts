/**
 * @qrypto/mock-server — KYC Routes
 *
 * POST /kyc/submit         — submit KYC documents
 * GET  /kyc/status         — get current KYC status
 * GET  /kyc/documents      — list submitted documents
 *
 * KYC state machine:
 *   unverified → pending → under_review → approved
 *                                       → rejected
 *   approved → rekyc_required → pending (re-submission)
 *
 * Last updated: 2024-01-15
 */

import { randomUUID } from 'crypto';

import type { KycDocument, KycDocumentType } from '@qrypto/shared-types';
import { KycDocumentTypeSchema } from '@qrypto/shared-types';
import { Router } from 'express';

import { requireAuth, requireFullScope } from '../middleware/auth.middleware.js';
import { getUser } from '../state.js';

export const kycRouter = Router();

// In-memory KYC document store (keyed by userId)
const kycDocuments = new Map<string, KycDocument[]>();

// ─── POST /kyc/submit ─────────────────────────────────────────────────────────

kycRouter.post('/submit', requireAuth, requireFullScope, (req, res) => {
  const auth = res.locals.auth;
  if (!auth) {
    res.status(401).json({ code: 'UNAUTHORIZED' });
    return;
  }

  const user = getUser(auth.userId);
  if (!user) {
    res.status(401).json({ code: 'UNAUTHORIZED' });
    return;
  }

  const blockedStatuses = ['pending', 'under_review', 'approved'];
  if (blockedStatuses.includes(user.kycStatus)) {
    res.status(409).json({
      code: 'KYC_ALREADY_SUBMITTED',
      message: `Cannot submit KYC — current status is: ${user.kycStatus}`,
    });
    return;
  }

  const body = req.body as { documentType?: string; filename?: string };
  const typeResult = KycDocumentTypeSchema.safeParse(body.documentType);
  if (!typeResult.success) {
    res.status(400).json({
      code: 'VALIDATION_ERROR',
      message:
        'documentType must be one of: passport, national_id, drivers_license, utility_bill, bank_statement',
    });
    return;
  }

  const doc: KycDocument = {
    id: randomUUID(),
    userId: user.id,
    type: typeResult.data as KycDocumentType,
    filename: body.filename ?? `${typeResult.data}-${Date.now()}.jpg`,
    mimeType: 'image/jpeg',
    uploadedAt: new Date(),
  };

  const existing = kycDocuments.get(auth.userId) ?? [];
  existing.push(doc);
  kycDocuments.set(auth.userId, existing);

  // Transition state machine: unverified/rejected/rekyc_required → pending
  user.kycStatus = 'pending';
  user.updatedAt = new Date();

  // Simulate auto-review after 2 seconds in test mode
  setTimeout(() => {
    if (user.kycStatus === 'pending') {
      user.kycStatus = 'under_review';
      user.updatedAt = new Date();
    }
  }, 2000);

  res.status(201).json({
    data: {
      documentId: doc.id,
      status: user.kycStatus,
      message: 'Documents received — under review',
    },
  });
});

// ─── GET /kyc/status ──────────────────────────────────────────────────────────

kycRouter.get('/status', requireAuth, requireFullScope, (req, res) => {
  const auth = res.locals.auth;
  if (!auth) {
    res.status(401).json({ code: 'UNAUTHORIZED' });
    return;
  }

  const user = getUser(auth.userId);
  if (!user) {
    res.status(401).json({ code: 'UNAUTHORIZED' });
    return;
  }

  res.status(200).json({
    data: {
      status: user.kycStatus,
      canWithdraw: user.kycStatus === 'approved' && user.amlFlags.length === 0,
      canTrade: user.kycStatus === 'approved',
      amlFlags: user.amlFlags,
    },
  });
});

// ─── GET /kyc/documents ───────────────────────────────────────────────────────

kycRouter.get('/documents', requireAuth, requireFullScope, (req, res) => {
  const auth = res.locals.auth;
  if (!auth) {
    res.status(401).json({ code: 'UNAUTHORIZED' });
    return;
  }

  const docs = kycDocuments.get(auth.userId) ?? [];
  res.status(200).json({ data: docs });
});

/** Reset KYC documents — called by admin reset */
export function resetKycDocuments(): void {
  kycDocuments.clear();
}
