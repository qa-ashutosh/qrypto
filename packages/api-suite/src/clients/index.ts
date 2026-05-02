/**
 * @qrypto/api-suite — Domain Clients
 *
 * Typed API clients for every exchange domain.
 * Each client wraps the BaseApiClient with domain-specific methods
 * and return types matching the mock server contract.
 *
 * Last updated: 2024-01-15
 */

import { type APIRequestContext } from '@playwright/test';

import { BaseApiClient } from './base.client.js';

// ─── Auth Types ───────────────────────────────────────────────────────────────

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
  scope: 'full' | 'pre_2fa';
  requiresTwoFactor: boolean;
  sessionId: string;
}

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
  scope: 'full' | 'pre_2fa';
}

export interface SessionInfo {
  id: string;
  scope: 'full' | 'pre_2fa';
  createdAt: string;
  expiresAt: string;
  ipAddress: string;
  userAgent: string;
  isCurrent: boolean;
}

// ─── KYC Types ────────────────────────────────────────────────────────────────

export type KycStatus =
  | 'unverified'
  | 'pending'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'rekyc_required';

export interface KycStatusResponse {
  status: KycStatus;
  canWithdraw: boolean;
  canTrade: boolean;
  amlFlags: string[];
}

export interface KycDocument {
  id: string;
  userId: string;
  type: string;
  filename: string;
  mimeType: string;
  uploadedAt: string;
}

// ─── Wallet Types ─────────────────────────────────────────────────────────────

export interface WalletBalance {
  userId: string;
  currency: string;
  available: string;
  reserved: string;
  total: string;
  updatedAt: string;
}

export interface Transaction {
  id: string;
  userId: string;
  type: string;
  currency: string;
  amount: string;
  fee: string;
  status: string;
  blockchainTxId?: string;
  createdAt: string;
  confirmedAt?: string;
}

export interface WithdrawalResponse {
  transactionId: string;
  status: string;
  amount: string;
  fee: string;
  currency: string;
  destinationAddress: string;
  estimatedConfirmationMinutes: number;
}

// ─── Trading Types ────────────────────────────────────────────────────────────

export interface Order {
  id: string;
  userId: string;
  pair: string;
  side: 'buy' | 'sell';
  type: string;
  quantity: string;
  price?: string;
  stopPrice?: string;
  filledQuantity: string;
  averageFillPrice?: string;
  fee: string;
  feeCurrency: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrderBook {
  pair: string;
  bids: { price: string; quantity: string; orderCount: number }[];
  asks: { price: string; quantity: string; orderCount: number }[];
  timestamp: string;
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
  timestamp: string;
}

// ─── Auth Client ──────────────────────────────────────────────────────────────

export class AuthClient extends BaseApiClient {
  constructor(request: APIRequestContext) {
    super(request);
  }

  async login(email: string, password: string): Promise<LoginResponse> {
    return this.post<LoginResponse>('/auth/login', { email, password });
  }

  async verify2fa(sessionId: string, code: string, token: string): Promise<TokenResponse> {
    return this.post<TokenResponse>('/auth/2fa/verify', { sessionId, code }, { token });
  }

  async refresh(token: string): Promise<TokenResponse> {
    return this.post<TokenResponse>('/auth/refresh', undefined, { token });
  }

  async logout(token: string): Promise<void> {
    return this.post<void>('/auth/logout', undefined, { token });
  }

  async getSessions(token: string): Promise<SessionInfo[]> {
    return this.get<SessionInfo[]>('/auth/sessions', { token });
  }

  async deleteSession(sessionId: string, token: string): Promise<void> {
    return this.delete<void>(`/auth/sessions/${sessionId}`, { token });
  }

  /**
   * Complete the full login flow (password + 2FA) and return a full-scope token.
   * Convenience method used by most test suites.
   */
  async loginFull(email: string, password: string, twoFactorCode = '123456'): Promise<string> {
    const loginRes = await this.login(email, password);

    if (loginRes.scope === 'full') return loginRes.accessToken;

    const twoFaRes = await this.verify2fa(loginRes.sessionId, twoFactorCode, loginRes.accessToken);
    return twoFaRes.accessToken;
  }
}

// ─── KYC Client ───────────────────────────────────────────────────────────────

export class KycClient extends BaseApiClient {
  constructor(request: APIRequestContext) {
    super(request);
  }

  async submitKyc(
    documentType: string,
    filename: string,
    token: string,
  ): Promise<{ documentId: string; status: string; message: string }> {
    return this.post('/kyc/submit', { documentType, filename }, { token });
  }

  async getStatus(token: string): Promise<KycStatusResponse> {
    return this.get<KycStatusResponse>('/kyc/status', { token });
  }

  async getDocuments(token: string): Promise<KycDocument[]> {
    return this.get<KycDocument[]>('/kyc/documents', { token });
  }
}

// ─── Wallet Client ────────────────────────────────────────────────────────────

export class WalletClient extends BaseApiClient {
  constructor(request: APIRequestContext) {
    super(request);
  }

  async getBalances(token: string): Promise<WalletBalance[]> {
    return this.get<WalletBalance[]>('/wallet/balances', { token });
  }

  async getBalance(currency: string, token: string): Promise<WalletBalance> {
    return this.get<WalletBalance>(`/wallet/balances/${currency}`, { token });
  }

  async withdraw(
    payload: {
      currency: string;
      amount: string;
      destinationAddress: string;
      twoFactorCode: string;
    },
    token: string,
  ): Promise<WithdrawalResponse> {
    return this.post<WithdrawalResponse>('/wallet/withdraw', payload, { token });
  }

  async getTransactions(
    token: string,
    params?: { page?: number; limit?: number; currency?: string },
  ): Promise<{ data: Transaction[]; meta: { page: number; limit: number; total: number } }> {
    return this.getRaw('/wallet/transactions', {
      token,
      params: params as Record<string, string | number>,
    });
  }

  async getDepositAddress(
    currency: string,
    token: string,
  ): Promise<{ currency: string; address: string; network: string }> {
    return this.get(`/wallet/deposit/address/${currency}`, { token });
  }
}

// ─── Trading Client ───────────────────────────────────────────────────────────

export class TradingClient extends BaseApiClient {
  constructor(request: APIRequestContext) {
    super(request);
  }

  async placeOrder(
    payload: {
      pair: string;
      side: 'buy' | 'sell';
      type: string;
      quantity: string;
      price?: string;
      stopPrice?: string;
      timeInForce?: string;
    },
    token: string,
  ): Promise<Order> {
    return this.post<Order>('/trading/orders', payload, { token });
  }

  async getOrders(token: string, status?: string): Promise<Order[]> {
    return this.get<Order[]>('/trading/orders', {
      token,
      ...(status ? { params: { status } } : {}),
    });
  }

  async getOrder(orderId: string, token: string): Promise<Order> {
    return this.get<Order>(`/trading/orders/${orderId}`, { token });
  }

  async cancelOrder(orderId: string, token: string): Promise<{ id: string; status: string }> {
    return this.delete(`/trading/orders/${orderId}`, { token });
  }

  async getOrderBook(pair: string): Promise<OrderBook> {
    const urlPair = pair.replace('/', '-');
    return this.get<OrderBook>(`/trading/orderbook/${urlPair}`);
  }

  async getTicker(pair: string): Promise<Ticker> {
    const urlPair = pair.replace('/', '-');
    return this.get<Ticker>(`/trading/ticker/${urlPair}`);
  }

  async getTradeHistory(
    token: string,
    params?: { page?: number; limit?: number },
  ): Promise<{ data: Order[]; meta: { page: number; limit: number; total: number } }> {
    return this.getRaw('/trading/history', {
      token,
      params: params as Record<string, string | number>,
    });
  }
}

// ─── Admin Client ─────────────────────────────────────────────────────────────

export class AdminClient extends BaseApiClient {
  constructor(request: APIRequestContext) {
    super(request);
  }

  async reset(): Promise<{ ok: boolean; message: string }> {
    return this.post('/admin/reset');
  }

  async health(): Promise<{
    ok: boolean;
    uptime: number;
    users: number;
    orders: number;
  }> {
    return this.get('/admin/health');
  }

  async forceKycStatus(userId: string, status: string): Promise<{ ok: boolean }> {
    return this.post(`/admin/kyc/${userId}/force`, { status });
  }

  async forceAmlFlags(userId: string, flags: string[]): Promise<{ ok: boolean }> {
    return this.post(`/admin/aml/${userId}/force`, { flags });
  }

  async confirmDeposit(transactionId: string): Promise<{ ok: boolean }> {
    return this.post('/admin/deposit/confirm', { transactionId });
  }

  async setChaos(config: {
    latencyMs?: number;
    forceErrorCode?: number | null;
    dropWebSocket?: boolean;
    stalePriceFeedSeconds?: number | null;
  }): Promise<{ ok: boolean }> {
    return this.post('/admin/chaos', config);
  }

  async resetChaos(): Promise<{ ok: boolean }> {
    return this.delete('/admin/chaos');
  }
}
