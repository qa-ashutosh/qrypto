/**
 * @qrypto/shared-types — Domain Types
 * Single source of truth for all exchange domain types.
 * Last updated: 2024-01-01
 */

// ─── Identity & Auth ──────────────────────────────────────────────────────────

export type UserId = string & { readonly _brand: 'UserId' };
export type SessionId = string & { readonly _brand: 'SessionId' };
export type CorrelationId = string & { readonly _brand: 'CorrelationId' };

export interface User {
  id: UserId;
  email: string;
  passwordHash: string;
  twoFactorEnabled: boolean;
  twoFactorSecret?: string;
  kycStatus: KycStatus;
  amlFlags: AmlFlag[];
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
  failedLoginAttempts: number;
  lockedUntil?: Date;
}

export interface Session {
  id: SessionId;
  userId: UserId;
  scope: TokenScope;
  expiresAt: Date;
  createdAt: Date;
  ipAddress: string;
  userAgent: string;
  isRevoked: boolean;
}

export type TokenScope = 'full' | 'pre_2fa';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
  scope: TokenScope;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface TwoFactorRequest {
  sessionId: SessionId;
  code: string;
}

// ─── KYC / Compliance ────────────────────────────────────────────────────────

export type KycStatus =
  | 'unverified'
  | 'pending'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'rekyc_required';

export type KycDocumentType =
  | 'passport'
  | 'national_id'
  | 'drivers_license'
  | 'utility_bill'
  | 'bank_statement';

export interface KycDocument {
  id: string;
  userId: UserId;
  type: KycDocumentType;
  filename: string;
  mimeType: string;
  uploadedAt: Date;
  reviewedAt?: Date;
  rejectionReason?: string;
}

export interface KycSubmission {
  userId: UserId;
  documents: KycDocument[];
  submittedAt: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
  status: KycStatus;
  rejectionReason?: string;
}

export type AmlFlag =
  | 'suspicious_transaction_pattern'
  | 'high_velocity_withdrawal'
  | 'sanctions_list_match'
  | 'pep_match'
  | 'adverse_media'
  | 'manual_review_required';

export interface AmlCheck {
  userId: UserId;
  flags: AmlFlag[];
  checkedAt: Date;
  resolvedAt?: Date;
  resolvedBy?: string;
  notes?: string;
}

// ─── Wallet & Finance ────────────────────────────────────────────────────────

export type Currency = 'BTC' | 'ETH' | 'USDT' | 'USDC' | 'USD' | 'EUR';

export type AssetAmount = string & { readonly _brand: 'AssetAmount' };

export interface WalletBalance {
  userId: UserId;
  currency: Currency;
  /** Scaled integer string — never a float. Use decimal.util.ts for math. */
  available: AssetAmount;
  /** Funds reserved in open orders or pending withdrawals */
  reserved: AssetAmount;
  /** available + reserved */
  total: AssetAmount;
  updatedAt: Date;
}

export type TransactionType =
  | 'deposit'
  | 'withdrawal'
  | 'trade_buy'
  | 'trade_sell'
  | 'fee'
  | 'funding_payment'
  | 'liquidation';

export type TransactionStatus = 'pending' | 'processing' | 'confirmed' | 'failed' | 'cancelled';

export interface Transaction {
  id: string;
  userId: UserId;
  type: TransactionType;
  currency: Currency;
  /** Scaled integer string — never a float. Use decimal.util.ts for math. */
  amount: AssetAmount;
  fee: AssetAmount;
  status: TransactionStatus;
  blockchainTxId?: string;
  createdAt: Date;
  confirmedAt?: Date;
  correlationId?: CorrelationId;
}

export interface WithdrawalRequest {
  currency: Currency;
  /** String representation of the amount — validated via Zod schema */
  amount: string;
  destinationAddress: string;
  twoFactorCode: string;
}

export interface DepositAddress {
  userId: UserId;
  currency: Currency;
  address: string;
  network: string;
  createdAt: Date;
}

// ─── Trading ─────────────────────────────────────────────────────────────────

export type TradingPair = 'BTC/USDT' | 'ETH/USDT' | 'BTC/USD' | 'ETH/USD' | 'ETH/BTC';

export type OrderSide = 'buy' | 'sell';

export type OrderType = 'market' | 'limit' | 'stop_loss' | 'take_profit' | 'stop_limit';

export type OrderStatus =
  | 'pending'
  | 'open'
  | 'partially_filled'
  | 'filled'
  | 'cancelled'
  | 'rejected'
  | 'expired';

export interface Order {
  id: string;
  userId: UserId;
  pair: TradingPair;
  side: OrderSide;
  type: OrderType;
  /** Scaled integer string — use decimal.util.ts for math */
  quantity: AssetAmount;
  /** undefined for market orders */
  price?: AssetAmount;
  /** For stop orders */
  stopPrice?: AssetAmount;
  filledQuantity: AssetAmount;
  averageFillPrice?: AssetAmount;
  fee: AssetAmount;
  feeCurrency: Currency;
  status: OrderStatus;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
  correlationId?: CorrelationId;
}

export interface OrderRequest {
  pair: TradingPair;
  side: OrderSide;
  type: OrderType;
  quantity: string;
  price?: string;
  stopPrice?: string;
  timeInForce?: 'GTC' | 'IOC' | 'FOK';
}

export interface OrderBookEntry {
  price: AssetAmount;
  quantity: AssetAmount;
  orderCount: number;
}

export interface OrderBook {
  pair: TradingPair;
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
  timestamp: Date;
}

export interface Ticker {
  pair: TradingPair;
  lastPrice: AssetAmount;
  bidPrice: AssetAmount;
  askPrice: AssetAmount;
  high24h: AssetAmount;
  low24h: AssetAmount;
  volume24h: AssetAmount;
  priceChange24h: AssetAmount;
  priceChangePercent24h: string;
  timestamp: Date;
}

// ─── Derivatives / Margin ────────────────────────────────────────────────────

export type PositionSide = 'long' | 'short';

export type MarginType = 'isolated' | 'cross';

export interface Position {
  id: string;
  userId: UserId;
  pair: TradingPair;
  side: PositionSide;
  marginType: MarginType;
  leverage: number;
  /** Entry price — scaled integer string */
  entryPrice: AssetAmount;
  /** Current mark price */
  markPrice: AssetAmount;
  /** Position size in base currency */
  size: AssetAmount;
  /** Margin allocated */
  margin: AssetAmount;
  /** Unrealised P&L */
  unrealisedPnl: AssetAmount;
  /** Liquidation price */
  liquidationPrice: AssetAmount;
  openedAt: Date;
  updatedAt: Date;
}

export interface FundingRate {
  pair: TradingPair;
  rate: string;
  nextFundingTime: Date;
  timestamp: Date;
}

// ─── WebSocket Events ────────────────────────────────────────────────────────

export type WsEventType =
  | 'ticker'
  | 'orderbook'
  | 'trade'
  | 'order_update'
  | 'position_update'
  | 'account_update'
  | 'connection_ack'
  | 'ping'
  | 'pong'
  | 'error';

export interface WsMessage<T = unknown> {
  type: WsEventType;
  data: T;
  timestamp: Date;
  correlationId?: CorrelationId;
}

export interface WsSubscribeRequest {
  action: 'subscribe' | 'unsubscribe';
  channels: string[];
}

// ─── API Responses ───────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    correlationId?: string;
  };
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  correlationId?: string;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}
