/**
 * @qrypto/shared-types — KYC & AML Factory
 *
 * Test data factory for KYC submissions, documents, and AML checks.
 * State machine coverage: every KYC state that drives a test scenario
 * has a corresponding factory method.
 *
 * Last updated: 2024-01-01
 */

import { randomUUID } from 'crypto';

import type {
  AmlCheck,
  AmlFlag,
  KycDocument,
  KycDocumentType,
  KycSubmission,
  UserId,
} from '../types/domain.js';

// ─── KYC Document Factory ─────────────────────────────────────────────────────

export const kycDocumentFactory = {
  build(
    userId: UserId,
    type: KycDocumentType = 'passport',
    overrides: Partial<KycDocument> = {},
  ): KycDocument {
    const doc: KycDocument = {
      id: randomUUID(),
      userId,
      type,
      filename: `${type}-${userId.slice(0, 8)}.jpg`,
      mimeType: 'image/jpeg',
      uploadedAt: new Date('2024-01-10T12:00:00Z'),
    };
    if (overrides.reviewedAt !== undefined) doc.reviewedAt = overrides.reviewedAt;
    if (overrides.rejectionReason !== undefined) doc.rejectionReason = overrides.rejectionReason;
    const rest = { ...overrides };
    delete rest.reviewedAt;
    delete rest.rejectionReason;
    return Object.assign(doc, rest);
  },

  reviewed(
    userId: UserId,
    type: KycDocumentType = 'passport',
    overrides: Partial<KycDocument> = {},
  ): KycDocument {
    return kycDocumentFactory.build(userId, type, {
      reviewedAt: new Date('2024-01-11T09:00:00Z'),
      ...overrides,
    });
  },

  rejected(
    userId: UserId,
    reason = 'Document is blurry or unreadable',
    overrides: Partial<KycDocument> = {},
  ): KycDocument {
    return kycDocumentFactory.build(userId, 'passport', {
      reviewedAt: new Date('2024-01-11T09:00:00Z'),
      rejectionReason: reason,
      ...overrides,
    });
  },

  /** Both sides of a national ID document. */
  nationalIdSet(userId: UserId): KycDocument[] {
    return [
      kycDocumentFactory.build(userId, 'national_id', {
        filename: `national_id_front_${userId.slice(0, 8)}.jpg`,
      }),
      kycDocumentFactory.build(userId, 'national_id', {
        filename: `national_id_back_${userId.slice(0, 8)}.jpg`,
      }),
    ];
  },
};

// ─── KYC Submission Factory ───────────────────────────────────────────────────

export const kycSubmissionFactory = {
  /** New submission — just uploaded, not yet reviewed. */
  build(userId: UserId, overrides: Partial<KycSubmission> = {}): KycSubmission {
    const sub: KycSubmission = {
      userId,
      documents: [kycDocumentFactory.build(userId, 'passport')],
      submittedAt: new Date('2024-01-10T12:00:00Z'),
      status: 'pending',
    };
    if (overrides.reviewedAt !== undefined) sub.reviewedAt = overrides.reviewedAt;
    if (overrides.reviewedBy !== undefined) sub.reviewedBy = overrides.reviewedBy;
    if (overrides.rejectionReason !== undefined) sub.rejectionReason = overrides.rejectionReason;
    const rest = { ...overrides };
    delete rest.reviewedAt;
    delete rest.reviewedBy;
    delete rest.rejectionReason;
    return Object.assign(sub, rest);
  },

  /** Under review — assigned to a compliance reviewer. */
  underReview(userId: UserId, overrides: Partial<KycSubmission> = {}): KycSubmission {
    return kycSubmissionFactory.build(userId, {
      status: 'under_review',
      ...overrides,
    });
  },

  /** Approved — withdrawal unlocked. */
  approved(userId: UserId, overrides: Partial<KycSubmission> = {}): KycSubmission {
    return kycSubmissionFactory.build(userId, {
      status: 'approved',
      reviewedAt: new Date('2024-01-11T09:00:00Z'),
      reviewedBy: 'compliance-reviewer-1',
      documents: [kycDocumentFactory.reviewed(userId, 'passport')],
      ...overrides,
    });
  },

  /** Rejected — with reason. */
  rejected(
    userId: UserId,
    reason = 'Document expired',
    overrides: Partial<KycSubmission> = {},
  ): KycSubmission {
    return kycSubmissionFactory.build(userId, {
      status: 'rejected',
      reviewedAt: new Date('2024-01-11T09:00:00Z'),
      reviewedBy: 'compliance-reviewer-1',
      rejectionReason: reason,
      documents: [kycDocumentFactory.rejected(userId, reason)],
      ...overrides,
    });
  },

  /** Requires re-KYC — previously approved, now flagged. */
  reKycRequired(userId: UserId, overrides: Partial<KycSubmission> = {}): KycSubmission {
    return kycSubmissionFactory.build(userId, {
      status: 'rekyc_required',
      reviewedAt: new Date('2024-01-11T09:00:00Z'),
      ...overrides,
    });
  },
};

// ─── AML Factory ──────────────────────────────────────────────────────────────

export const amlFactory = {
  build(userId: UserId, flags: AmlFlag[] = [], overrides: Partial<AmlCheck> = {}): AmlCheck {
    const check: AmlCheck = {
      userId,
      flags,
      checkedAt: new Date('2024-01-15T10:00:00Z'),
    };
    if (overrides.resolvedAt !== undefined) check.resolvedAt = overrides.resolvedAt;
    if (overrides.resolvedBy !== undefined) check.resolvedBy = overrides.resolvedBy;
    if (overrides.notes !== undefined) check.notes = overrides.notes;
    const rest = { ...overrides };
    delete rest.resolvedAt;
    delete rest.resolvedBy;
    delete rest.notes;
    return Object.assign(check, rest);
  },

  /** Clean check — no flags. */
  clean(userId: UserId): AmlCheck {
    return amlFactory.build(userId, []);
  },

  /** High velocity withdrawal flag. */
  highVelocity(userId: UserId): AmlCheck {
    return amlFactory.build(userId, ['high_velocity_withdrawal'], {
      notes: 'Automated: 15 withdrawals in 24-hour window exceeds threshold',
    });
  },

  /** Sanctions list match — hardest block, requires manual review. */
  sanctionsMatch(userId: UserId): AmlCheck {
    return amlFactory.build(userId, ['sanctions_list_match', 'manual_review_required'], {
      notes: 'Automated: Name and DOB match on OFAC SDN list',
    });
  },

  /** Resolved check — flags cleared after manual review. */
  resolved(userId: UserId, flags: AmlFlag[] = ['suspicious_transaction_pattern']): AmlCheck {
    return amlFactory.build(userId, flags, {
      resolvedAt: new Date('2024-01-16T14:00:00Z'),
      resolvedBy: 'compliance-officer-1',
      notes: 'Manual review complete — no action required',
    });
  },
};
