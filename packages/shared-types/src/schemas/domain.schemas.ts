/**
 * @qrypto/shared-types — Zod Schemas
 * Runtime validation for all domain objects and API payloads.
 * These schemas are the authoritative validation layer — they run at the
 * boundary of every external input.
 * Last updated: 2024-01-01
 */

import { z } from 'zod';

// ─── Branded Scalar Schemas ───────────────────────────────────────────────────

/**
 * Financial amount: positive decimal string with up to 18 decimal places.
 * Stored as string to preserve precision — never coerce to JS number.
 */
export const AssetAmountSchema = z
  .string()
  .regex(/^\d+(\.\d{1,18})?$/, 'Invalid asset amount — must be a positive decimal string')
  .brand<'AssetAmount'>();

export const UserIdSchema = z.string().uuid().brand<'UserId'>();
export const SessionIdSchema = z.string().uuid().brand<'SessionId'>();
export const CorrelationIdSchema = z.string().uuid().brand<'CorrelationId'>();

// ─── Enums ───────────────────────────────────────────────────────────────────

export const KycStatusSchema = z.enum([
  'unverified',
  'pending',
  'under_review',
  'approved',
  'rejected',
  'rekyc_required',
]);

export const KycDocumentTypeSchema = z.enum([
  'passport',
  'national_id',
  'drivers_license',
  'utility_bill',
  'bank_statement',
]);

export const AmlFlagSchema = z.enum([
  'suspicious_transaction_pattern',
  'high_velocity_withdrawal',
  'sanctions_list_match',
  'pep_match',
  'adverse_media',
  'manual_review_required',
]);

export const CurrencySchema = z.enum(['BTC', 'ETH', 'USDT', 'USDC', 'USD', 'EUR']);

export const TradingPairSchema = z.enum(['BTC/USDT', 'ETH/USDT', 'BTC/USD', 'ETH/USD', 'ETH/BTC']);

export const OrderSideSchema = z.enum(['buy', 'sell']);

export const OrderTypeSchema = z.enum([
  'market',
  'limit',
  'stop_loss',
  'take_profit',
  'stop_limit',
]);

export const OrderStatusSchema = z.enum([
  'pending',
  'open',
  'partially_filled',
  'filled',
  'cancelled',
  'rejected',
  'expired',
]);

export const TransactionTypeSchema = z.enum([
  'deposit',
  'withdrawal',
  'trade_buy',
  'trade_sell',
  'fee',
  'funding_payment',
  'liquidation',
]);

export const TransactionStatusSchema = z.enum([
  'pending',
  'processing',
  'confirmed',
  'failed',
  'cancelled',
]);

export const TokenScopeSchema = z.enum(['full', 'pre_2fa']);

// ─── Request Schemas ─────────────────────────────────────────────────────────

export const LoginRequestSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password too long'),
});

export const TwoFactorRequestSchema = z.object({
  sessionId: SessionIdSchema,
  code: z
    .string()
    .length(6, '2FA code must be exactly 6 digits')
    .regex(/^\d{6}$/),
});

export const WithdrawalRequestSchema = z.object({
  currency: CurrencySchema,
  amount: AssetAmountSchema,
  destinationAddress: z
    .string()
    .min(26, 'Invalid address — too short')
    .max(128, 'Invalid address — too long'),
  twoFactorCode: z
    .string()
    .length(6, '2FA code must be exactly 6 digits')
    .regex(/^\d{6}$/),
});

export const OrderRequestSchema = z
  .object({
    pair: TradingPairSchema,
    side: OrderSideSchema,
    type: OrderTypeSchema,
    quantity: AssetAmountSchema,
    price: AssetAmountSchema.optional(),
    stopPrice: AssetAmountSchema.optional(),
    timeInForce: z.enum(['GTC', 'IOC', 'FOK']).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.type === 'limit' && data.price === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Limit orders require a price',
        path: ['price'],
      });
    }
    if (
      (data.type === 'stop_loss' || data.type === 'take_profit' || data.type === 'stop_limit') &&
      data.stopPrice === undefined
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Stop orders require a stopPrice',
        path: ['stopPrice'],
      });
    }
  });

export const PaginationParamsSchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

// ─── Entity Schemas ───────────────────────────────────────────────────────────

export const WalletBalanceSchema = z.object({
  userId: UserIdSchema,
  currency: CurrencySchema,
  available: AssetAmountSchema,
  reserved: AssetAmountSchema,
  total: AssetAmountSchema,
  updatedAt: z.coerce.date(),
});

export const OrderSchema = z.object({
  id: z.string().uuid(),
  userId: UserIdSchema,
  pair: TradingPairSchema,
  side: OrderSideSchema,
  type: OrderTypeSchema,
  quantity: AssetAmountSchema,
  price: AssetAmountSchema.optional(),
  stopPrice: AssetAmountSchema.optional(),
  filledQuantity: AssetAmountSchema,
  averageFillPrice: AssetAmountSchema.optional(),
  fee: AssetAmountSchema,
  feeCurrency: CurrencySchema,
  status: OrderStatusSchema,
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  expiresAt: z.coerce.date().optional(),
  correlationId: CorrelationIdSchema.optional(),
});

export const TransactionSchema = z.object({
  id: z.string().uuid(),
  userId: UserIdSchema,
  type: TransactionTypeSchema,
  currency: CurrencySchema,
  amount: AssetAmountSchema,
  fee: AssetAmountSchema,
  status: TransactionStatusSchema,
  blockchainTxId: z.string().optional(),
  createdAt: z.coerce.date(),
  confirmedAt: z.coerce.date().optional(),
  correlationId: CorrelationIdSchema.optional(),
});

// ─── API Response Wrapper ────────────────────────────────────────────────────

export const ApiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    data: dataSchema,
    meta: z
      .object({
        page: z.number().optional(),
        limit: z.number().optional(),
        total: z.number().optional(),
        correlationId: z.string().optional(),
      })
      .optional(),
  });

export const ApiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.record(z.unknown()).optional(),
  correlationId: z.string().optional(),
});

// ─── Inferred Types ──────────────────────────────────────────────────────────

export type LoginRequestInput = z.input<typeof LoginRequestSchema>;
export type TwoFactorRequestInput = z.input<typeof TwoFactorRequestSchema>;
export type WithdrawalRequestInput = z.input<typeof WithdrawalRequestSchema>;
export type OrderRequestInput = z.input<typeof OrderRequestSchema>;
export type PaginationParamsInput = z.input<typeof PaginationParamsSchema>;
