/**
 * @qrypto/mock-server — State Store
 *
 * Single in-memory state store for all mock server entities.
 * Every route handler reads from and writes to this store.
 * POST /admin/reset wipes and reinitialises it between test runs.
 *
 * This is intentionally simple: a plain object with Maps.
 * No database, no ORM, no persistence. Starts in under 3 seconds.
 *
 * Last updated: 2024-01-15
 */

import type {
  AmlFlag,
  Currency,
  KycStatus,
  Order,
  Session,
  Transaction,
  User,
  UserId,
  WalletBalance,
} from '@qrypto/shared-types';

import { seedState } from './seed/seed.data.js';

export interface MockState {
  users: Map<string, User>;
  sessions: Map<string, Session>;
  orders: Map<string, Order>;
  transactions: Map<string, Transaction>;
  wallets: Map<string, WalletBalance>; // key: `${userId}:${currency}`
  revokedTokens: Set<string>; // jti values of revoked tokens
  chaos: ChaosConfig;
}

export interface ChaosConfig {
  latencyMs: number;
  forceErrorCode: number | null;
  dropWebSocket: boolean;
  stalePriceFeedSeconds: number | null;
}

const DEFAULT_CHAOS: ChaosConfig = {
  latencyMs: 0,
  forceErrorCode: null,
  dropWebSocket: false,
  stalePriceFeedSeconds: null,
};

// ─── Global State ─────────────────────────────────────────────────────────────

let state: MockState = buildInitialState();

function buildInitialState(): MockState {
  const seed = seedState();
  return {
    users: seed.users,
    sessions: new Map(),
    orders: seed.orders,
    transactions: seed.transactions,
    wallets: seed.wallets,
    revokedTokens: new Set(),
    chaos: { ...DEFAULT_CHAOS },
  };
}

export function getState(): MockState {
  return state;
}

/**
 * Reset all state to initial seed values.
 * Called by POST /admin/reset between test runs.
 * This is the mechanism that guarantees test isolation.
 */
export function resetState(): void {
  state = buildInitialState();
}

// ─── Typed Accessors ─────────────────────────────────────────────────────────

export function getUser(userId: string): User | undefined {
  return state.users.get(userId);
}

export function getUserByEmail(email: string): User | undefined {
  for (const user of state.users.values()) {
    if (user.email === email) return user;
  }
  return undefined;
}

export function getSession(sessionId: string): Session | undefined {
  return state.sessions.get(sessionId);
}

export function getWallet(userId: string, currency: Currency): WalletBalance | undefined {
  return state.wallets.get(`${userId}:${currency}`);
}

export function getAllWallets(userId: string): WalletBalance[] {
  const result: WalletBalance[] = [];
  for (const [key, wallet] of state.wallets.entries()) {
    if (key.startsWith(`${userId}:`)) result.push(wallet);
  }
  return result;
}

export function setWallet(wallet: WalletBalance): void {
  state.wallets.set(`${wallet.userId}:${wallet.currency}`, wallet);
}

export function getOrder(orderId: string): Order | undefined {
  return state.orders.get(orderId);
}

export function getOrdersByUser(userId: string): Order[] {
  return Array.from(state.orders.values()).filter(
    (o) => o.userId === (userId as unknown as UserId),
  );
}

export function getTransactionsByUser(userId: string): Transaction[] {
  return Array.from(state.transactions.values())
    .filter((t) => t.userId === (userId as unknown as UserId))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export function isTokenRevoked(jti: string): boolean {
  return state.revokedTokens.has(jti);
}

export function revokeToken(jti: string): void {
  state.revokedTokens.add(jti);
}

// ─── Admin Helpers ────────────────────────────────────────────────────────────

export function forceKycStatus(userId: string, status: KycStatus): boolean {
  const user = state.users.get(userId);
  if (!user) return false;
  user.kycStatus = status;
  user.updatedAt = new Date();
  return true;
}

export function forceAmlFlags(userId: string, flags: AmlFlag[]): boolean {
  const user = state.users.get(userId);
  if (!user) return false;
  user.amlFlags = flags;
  user.updatedAt = new Date();
  return true;
}

export function confirmPendingDeposit(transactionId: string): boolean {
  const tx = state.transactions.get(transactionId);
  if (!tx || tx.type !== 'deposit' || tx.status !== 'pending') return false;

  tx.status = 'confirmed';
  tx.confirmedAt = new Date();

  // Credit the wallet
  const wallet = getWallet(tx.userId, tx.currency);
  if (wallet) {
    // Simple string addition via parseFloat — only used in test control path, not financial logic
    const newAvailable = (parseFloat(wallet.available) + parseFloat(tx.amount)).toFixed(8);
    wallet.available = newAvailable as typeof wallet.available;
    wallet.total = (parseFloat(wallet.available) + parseFloat(wallet.reserved)).toFixed(
      8,
    ) as typeof wallet.total;
    wallet.updatedAt = new Date();
  }

  return true;
}

export function setChaos(config: Partial<ChaosConfig>): void {
  state.chaos = { ...state.chaos, ...config };
}

export function resetChaos(): void {
  state.chaos = { ...DEFAULT_CHAOS };
}
