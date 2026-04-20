/**
 * @qrypto/shared-types — Order Factory
 *
 * Test data factory for Order entities.
 * Traits represent the specific lifecycle states that drive test scenarios.
 * All amounts are string representations — decimal.util.ts handles arithmetic.
 *
 * Last updated: 2024-01-01
 */

import { randomUUID } from 'crypto';

import type {
  AssetAmount,
  Order,
  OrderRequest,
  OrderSide,
  OrderStatus,
  OrderType,
  TradingPair,
  UserId,
} from '../types/domain.js';

// ─── Reference Prices ─────────────────────────────────────────────────────────
// Stable reference prices for test scenarios — not real market data.

const REF_PRICES: Record<TradingPair, string> = {
  'BTC/USDT': '65000.00',
  'ETH/USDT': '3500.00',
  'BTC/USD': '65000.00',
  'ETH/USD': '3500.00',
  'ETH/BTC': '0.05384615',
};

function asAmount(value: string): AssetAmount {
  return value as AssetAmount;
}

// ─── Base Factory ─────────────────────────────────────────────────────────────

function buildBase(userId: UserId, overrides: Partial<Order> = {}): Order {
  const pair: TradingPair = overrides.pair ?? 'BTC/USDT';
  const side: OrderSide = overrides.side ?? 'buy';
  const type: OrderType = overrides.type ?? 'limit';
  const price = overrides.price ?? asAmount(REF_PRICES[pair] ?? '100.00');

  const base: Order = {
    id: randomUUID(),
    userId,
    pair,
    side,
    type,
    quantity: asAmount('0.01000000'),
    filledQuantity: asAmount('0.00000000'),
    fee: asAmount('0.00000000'),
    feeCurrency: 'USDT',
    status: 'open',
    createdAt: new Date('2024-01-15T10:00:00Z'),
    updatedAt: new Date('2024-01-15T10:00:00Z'),
  };

  // Assign optional fields conditionally to satisfy exactOptionalPropertyTypes
  if (type !== 'market') base.price = price;
  if (overrides.stopPrice !== undefined) base.stopPrice = overrides.stopPrice;
  if (overrides.averageFillPrice !== undefined) base.averageFillPrice = overrides.averageFillPrice;
  if (overrides.expiresAt !== undefined) base.expiresAt = overrides.expiresAt;
  if (overrides.correlationId !== undefined) base.correlationId = overrides.correlationId;

  // Apply scalar overrides
  const scalar: Partial<Order> = { ...overrides };
  delete scalar.price;
  delete scalar.stopPrice;
  delete scalar.averageFillPrice;
  delete scalar.expiresAt;
  delete scalar.correlationId;
  Object.assign(base, scalar);

  return base;
}

// ─── Order Factory ────────────────────────────────────────────────────────────

export const orderFactory = {
  /**
   * Open limit buy order at reference price.
   */
  build(userId: UserId, overrides: Partial<Order> = {}): Order {
    return buildBase(userId, overrides);
  },

  /**
   * Partially filled order — qty filled is half of total.
   * Use for partial fill assertions and order state tests.
   */
  partial(userId: UserId, overrides: Partial<Order> = {}): Order {
    return buildBase(userId, {
      quantity: asAmount('0.10000000'),
      filledQuantity: asAmount('0.05000000'),
      averageFillPrice: asAmount('65000.00'),
      fee: asAmount('3.25000000'),
      status: 'partially_filled',
      ...overrides,
    });
  },

  /**
   * Market order — no price field.
   * Use for market order placement and slippage tests.
   */
  market(userId: UserId, side: OrderSide = 'buy', overrides: Partial<Order> = {}): Order {
    const order = buildBase(userId, {
      type: 'market',
      side,
      ...overrides,
    });
    // market orders have no price — delete it after base construction
    delete order.price;
    return order;
  },

  /**
   * Limit order at current market price.
   * Use for order matching simulation tests.
   */
  atMarketPrice(
    userId: UserId,
    side: OrderSide = 'buy',
    pair: TradingPair = 'BTC/USDT',
    overrides: Partial<Order> = {},
  ): Order {
    const order = buildBase(userId, {
      type: 'limit',
      side,
      pair,
      ...overrides,
    });
    order.price = asAmount(REF_PRICES[pair] ?? '100.00');
    return order;
  },

  /**
   * Stop-loss order.
   * Use for stop-loss trigger and cancellation tests.
   */
  stopLoss(userId: UserId, overrides: Partial<Order> = {}): Order {
    return buildBase(userId, {
      type: 'stop_loss',
      side: 'sell',
      price: asAmount('60000.00'),
      stopPrice: asAmount('61000.00'), // triggers before limit price
      ...overrides,
    });
  },

  /**
   * Fully filled order.
   * Use for P&L calculation tests and trade history assertions.
   */
  filled(userId: UserId, overrides: Partial<Order> = {}): Order {
    return buildBase(userId, {
      quantity: asAmount('0.01000000'),
      filledQuantity: asAmount('0.01000000'),
      averageFillPrice: asAmount('65000.00'),
      fee: asAmount('0.65000000'),
      feeCurrency: 'USDT',
      status: 'filled',
      updatedAt: new Date('2024-01-15T10:00:05Z'),
      ...overrides,
    });
  },

  /**
   * Cancelled order.
   * Use for order cancellation and balance-release tests.
   */
  cancelled(userId: UserId, overrides: Partial<Order> = {}): Order {
    return buildBase(userId, {
      status: 'cancelled',
      updatedAt: new Date('2024-01-15T10:05:00Z'),
      ...overrides,
    });
  },

  /**
   * Rejected order — insufficient funds, invalid params, etc.
   * Use for rejection reason and error response tests.
   */
  rejected(userId: UserId, overrides: Partial<Order> = {}): Order {
    return buildBase(userId, {
      status: 'rejected',
      ...overrides,
    });
  },

  /**
   * Large order that would exhaust the order book depth.
   * Use for liquidity and order book impact tests.
   */
  large(userId: UserId, overrides: Partial<Order> = {}): Order {
    const order = buildBase(userId, {
      quantity: asAmount('10.00000000'),
      type: 'market',
      ...overrides,
    });
    delete order.price;
    return order;
  },

  /**
   * Build an OrderRequest (API input) for a limit order.
   */
  buildRequest(overrides: Partial<OrderRequest> = {}): OrderRequest {
    return {
      pair: 'BTC/USDT',
      side: 'buy',
      type: 'limit',
      quantity: '0.01000000',
      price: '65000.00',
      timeInForce: 'GTC',
      ...overrides,
    };
  },

  /**
   * Build multiple orders — for order book depth and concurrent tests.
   */
  buildMany(userId: UserId, count: number, overrides: Partial<Order> = {}): Order[] {
    return Array.from({ length: count }, () => buildBase(userId, overrides));
  },
};

// ─── Order Status Helpers ─────────────────────────────────────────────────────

export function isTerminalStatus(status: OrderStatus): boolean {
  return ['filled', 'cancelled', 'rejected', 'expired'].includes(status);
}

export function isActiveStatus(status: OrderStatus): boolean {
  return ['pending', 'open', 'partially_filled'].includes(status);
}
