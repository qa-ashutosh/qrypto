/**
 * @qrypto/frontend-mock — API Client
 *
 * All HTTP calls to @qrypto/mock-server.
 * Single source of truth for API communication in the frontend.
 * Uses the Vite dev proxy — no CORS, no hardcoded ports in components.
 *
 * Last updated: 2024-01-15
 */

const BASE = '';

export interface ApiError {
  code: string;
  message: string;
  [key: string]: unknown;
}

export class QryptoApiError extends Error {
  code: string;
  status: number;
  details: Record<string, unknown>;

  constructor(status: number, body: ApiError) {
    super(body.message);
    this.name = 'QryptoApiError';
    this.code = body.code;
    this.status = status;
    this.details = body as Record<string, unknown>;
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  token?: string,
): Promise<T> {
  const headerMap: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headerMap['Authorization'] = `Bearer ${token}`;
  const headers: HeadersInit = headerMap;

  const init: RequestInit = { method, headers };
  if (body !== undefined) init.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, init);

  if (!res.ok) {
    const err = (await res.json().catch(() => ({
      code: 'UNKNOWN',
      message: res.statusText,
    }))) as ApiError;
    throw new QryptoApiError(res.status, err);
  }

  if (res.status === 204) return undefined as T;
  const json = (await res.json()) as { data?: T };
  return (json.data ?? json) as T;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  scope: 'pre_2fa' | 'full';
  requiresTwoFactor: boolean;
  sessionId: string;
  expiresIn: number;
}

export const authApi = {
  login: (email: string, password: string) =>
    request<LoginResponse>('POST', '/auth/login', { email, password }),

  verify2fa: (sessionId: string, code: string, token: string) =>
    request<LoginResponse>('POST', '/auth/2fa/verify', { sessionId, code }, token),

  logout: (token: string) => request<void>('POST', '/auth/logout', undefined, token),

  getSessions: (token: string) => request<Session[]>('GET', '/auth/sessions', undefined, token),

  deleteSession: (id: string, token: string) =>
    request<void>('DELETE', `/auth/sessions/${id}`, undefined, token),
};

// ── KYC ───────────────────────────────────────────────────────────────────────

export interface KycStatus {
  status: string;
  canWithdraw: boolean;
  canTrade: boolean;
  amlFlags: string[];
}

export const kycApi = {
  getStatus: (token: string) => request<KycStatus>('GET', '/kyc/status', undefined, token),

  submit: (documentType: string, token: string) =>
    request<{ documentId: string; status: string }>('POST', '/kyc/submit', { documentType }, token),

  getDocuments: (token: string) =>
    request<KycDocument[]>('GET', '/kyc/documents', undefined, token),
};

// ── Wallet ────────────────────────────────────────────────────────────────────

export interface WalletBalance {
  currency: string;
  available: string;
  reserved: string;
  total: string;
  updatedAt: string;
}

export interface Transaction {
  id: string;
  type: string;
  currency: string;
  amount: string;
  fee: string;
  status: string;
  blockchainTxId?: string;
  createdAt: string;
  confirmedAt?: string;
}

export const walletApi = {
  getBalances: (token: string) =>
    request<WalletBalance[]>('GET', '/wallet/balances', undefined, token),

  withdraw: (data: WithdrawalRequest, token: string) =>
    request<WithdrawalResponse>('POST', '/wallet/withdraw', data, token),

  getTransactions: (token: string, page = 1, limit = 20) =>
    request<Transaction[]>(
      'GET',
      `/wallet/transactions?page=${page}&limit=${limit}`,
      undefined,
      token,
    ),

  getDepositAddress: (currency: string, token: string) =>
    request<{ address: string; network: string }>(
      'GET',
      `/wallet/deposit/address/${currency}`,
      undefined,
      token,
    ),
};

// ── Trading ───────────────────────────────────────────────────────────────────

export interface Order {
  id: string;
  pair: string;
  side: 'buy' | 'sell';
  type: string;
  quantity: string;
  price?: string;
  filledQuantity: string;
  averageFillPrice?: string;
  fee: string;
  feeCurrency: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface Ticker {
  pair: string;
  lastPrice: string;
  bidPrice: string;
  askPrice: string;
  high24h: string;
  low24h: string;
  volume24h: string;
  priceChange24h: string;
  priceChangePercent24h: string;
}

export interface OrderBook {
  pair: string;
  bids: { price: string; quantity: string; orderCount: number }[];
  asks: { price: string; quantity: string; orderCount: number }[];
}

export const tradingApi = {
  getTicker: (pair: string) => request<Ticker>('GET', `/trading/ticker/${pair.replace('/', '-')}`),

  getOrderBook: (pair: string) =>
    request<OrderBook>('GET', `/trading/orderbook/${pair.replace('/', '-')}`),

  placeOrder: (order: PlaceOrderRequest, token: string) =>
    request<Order>('POST', '/trading/orders', order, token),

  getOrders: (token: string, status?: string) =>
    request<Order[]>(
      'GET',
      `/trading/orders${status ? `?status=${status}` : ''}`,
      undefined,
      token,
    ),

  cancelOrder: (id: string, token: string) =>
    request<{ id: string; status: string }>('DELETE', `/trading/orders/${id}`, undefined, token),

  getHistory: (token: string, page = 1) =>
    request<Order[]>('GET', `/trading/history?page=${page}`, undefined, token),
};

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Session {
  id: string;
  scope: string;
  createdAt: string;
  expiresAt: string;
  ipAddress: string;
  isCurrent: boolean;
}

export interface KycDocument {
  id: string;
  type: string;
  filename: string;
  uploadedAt: string;
}

export interface WithdrawalRequest {
  currency: string;
  amount: string;
  destinationAddress: string;
  twoFactorCode: string;
}

export interface WithdrawalResponse {
  transactionId: string;
  status: string;
  amount: string;
  fee: string;
  currency: string;
  estimatedConfirmationMinutes: number;
}

export interface PlaceOrderRequest {
  pair: string;
  side: 'buy' | 'sell';
  type: 'market' | 'limit' | 'stop_loss' | 'take_profit';
  quantity: string;
  price?: string;
  stopPrice?: string;
}
