/**
 * @qrypto/mock-server — Trading Routes
 *
 * POST /trading/orders          — place a new order
 * GET  /trading/orders          — list open orders
 * GET  /trading/orders/:id      — get order by ID
 * DELETE /trading/orders/:id    — cancel an order
 * GET  /trading/orderbook/:pair — order book depth
 * GET  /trading/ticker/:pair    — price ticker
 * GET  /trading/history         — trade history
 *
 * Last updated: 2024-01-15
 */

import { randomUUID } from 'crypto';

import type {
  AssetAmount,
  Order,
  OrderBook,
  OrderBookEntry,
  Ticker,
  TradingPair,
  UserId,
} from '@qrypto/shared-types';
import {
  OrderRequestSchema,
  TradingPairSchema,
  isGreaterThanOrEqual,
  multiply,
  calculateFee,
  add,
  subtract,
  toFixed,
} from '@qrypto/shared-types';
import { Router } from 'express';

import { requireAuth, requireFullScope } from '../middleware/auth.middleware.js';
import { getUser, getState, getOrder, getOrdersByUser, getWallet, setWallet } from '../state.js';

export const tradingRouter = Router();

// ─── Reference Prices (seed) ─────────────────────────────────────────────────

const REFERENCE_PRICES: Record<TradingPair, string> = {
  'BTC/USDT': '65000.00',
  'ETH/USDT': '3500.00',
  'BTC/USD': '65000.00',
  'ETH/USD': '3500.00',
  'ETH/BTC': '0.05384615',
};

const TAKER_FEE_RATE = '0.001'; // 0.1%

// ─── POST /trading/orders ─────────────────────────────────────────────────────

tradingRouter.post('/orders', requireAuth, requireFullScope, (req, res) => {
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

  if (user.kycStatus !== 'approved') {
    res.status(403).json({
      code: 'KYC_REQUIRED',
      message: 'KYC approval required to trade',
      kycStatus: user.kycStatus,
    });
    return;
  }

  const parse = OrderRequestSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ code: 'VALIDATION_ERROR', message: parse.error.message });
    return;
  }

  const { pair, side, type, quantity, price } = parse.data;

  // Determine execution price
  const execPrice = price ?? REFERENCE_PRICES[pair] ?? '100.00';
  const notional = multiply(quantity, execPrice);
  const fee = calculateFee(notional, TAKER_FEE_RATE);

  // Check balance
  const quoteCurrency = pair.split('/')[1] as 'USDT' | 'USD' | 'BTC';
  const baseCurrency = pair.split('/')[0] as 'BTC' | 'ETH';

  if (side === 'buy') {
    const requiredQuote = add(notional, fee);
    const quoteWallet = getWallet(auth.userId, quoteCurrency);
    if (!quoteWallet || !isGreaterThanOrEqual(quoteWallet.available, requiredQuote)) {
      res.status(422).json({
        code: 'INSUFFICIENT_FUNDS',
        message: 'Insufficient balance to place this order',
        required: requiredQuote,
        available: quoteWallet?.available ?? '0',
      });
      return;
    }
    // Reserve the funds
    const newAvail = toFixed(
      subtract(quoteWallet.available, requiredQuote),
      6,
    ) as unknown as AssetAmount;
    const newReserved = toFixed(
      add(quoteWallet.reserved, requiredQuote),
      6,
    ) as unknown as AssetAmount;
    setWallet({
      ...quoteWallet,
      available: newAvail,
      reserved: newReserved,
      total: toFixed(add(newAvail, newReserved), 6) as unknown as AssetAmount,
      updatedAt: new Date(),
    });
  } else {
    const baseWallet = getWallet(auth.userId, baseCurrency);
    if (!baseWallet || !isGreaterThanOrEqual(baseWallet.available, quantity)) {
      res.status(422).json({
        code: 'INSUFFICIENT_FUNDS',
        message: 'Insufficient base currency balance',
        required: quantity,
        available: baseWallet?.available ?? '0',
      });
      return;
    }
    const newAvail = toFixed(subtract(baseWallet.available, quantity), 8) as unknown as AssetAmount;
    const newReserved = toFixed(add(baseWallet.reserved, quantity), 8) as unknown as AssetAmount;
    setWallet({
      ...baseWallet,
      available: newAvail,
      reserved: newReserved,
      total: toFixed(add(newAvail, newReserved), 8) as unknown as AssetAmount,
      updatedAt: new Date(),
    });
  }

  const order: Order = {
    id: randomUUID(),
    userId: user.id as unknown as UserId,
    pair,
    side,
    type,
    quantity: quantity as unknown as AssetAmount,
    filledQuantity: '0.00000000' as unknown as AssetAmount,
    fee: fee as unknown as AssetAmount,
    feeCurrency: quoteCurrency,
    status: type === 'market' ? 'filled' : 'open',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  if (price !== undefined) order.price = price as unknown as AssetAmount;
  if (parse.data.stopPrice !== undefined)
    order.stopPrice = parse.data.stopPrice as unknown as AssetAmount;

  // Market orders fill immediately
  if (type === 'market') {
    order.filledQuantity = quantity as unknown as AssetAmount;
    order.averageFillPrice = execPrice as unknown as AssetAmount;
    order.status = 'filled';
  }

  getState().orders.set(order.id, order);

  res.status(201).json({ data: order });
});

// ─── GET /trading/orders ──────────────────────────────────────────────────────

tradingRouter.get('/orders', requireAuth, requireFullScope, (req, res) => {
  const auth = res.locals.auth;
  if (!auth) {
    res.status(401).json({ code: 'UNAUTHORIZED' });
    return;
  }

  const status = req.query['status'] as string | undefined;
  let orders = getOrdersByUser(auth.userId);

  if (status) orders = orders.filter((o) => o.status === status);

  res.status(200).json({ data: orders, meta: { total: orders.length } });
});

// ─── GET /trading/orders/:id ──────────────────────────────────────────────────

tradingRouter.get('/orders/:id', requireAuth, requireFullScope, (req, res) => {
  const auth = res.locals.auth;
  if (!auth) {
    res.status(401).json({ code: 'UNAUTHORIZED' });
    return;
  }

  const order = getOrder(req.params['id'] ?? '');
  if (!order) {
    res.status(404).json({ code: 'NOT_FOUND', message: 'Order not found' });
    return;
  }

  // IDOR protection — users can only see their own orders
  if (order.userId !== (auth.userId as unknown as UserId)) {
    res.status(404).json({ code: 'NOT_FOUND', message: 'Order not found' });
    return;
  }

  res.status(200).json({ data: order });
});

// ─── DELETE /trading/orders/:id ───────────────────────────────────────────────

tradingRouter.delete('/orders/:id', requireAuth, requireFullScope, (req, res) => {
  const auth = res.locals.auth;
  if (!auth) {
    res.status(401).json({ code: 'UNAUTHORIZED' });
    return;
  }

  const order = getOrder(req.params['id'] ?? '');
  if (!order || order.userId !== (auth.userId as unknown as UserId)) {
    res.status(404).json({ code: 'NOT_FOUND', message: 'Order not found' });
    return;
  }

  if (order.status === 'filled' || order.status === 'cancelled') {
    res.status(409).json({
      code: 'ORDER_NOT_CANCELLABLE',
      message: `Cannot cancel order with status: ${order.status}`,
    });
    return;
  }

  order.status = 'cancelled';
  order.updatedAt = new Date();

  res.status(200).json({ data: { id: order.id, status: 'cancelled' } });
});

// ─── GET /trading/orderbook/:pair ─────────────────────────────────────────────

tradingRouter.get('/orderbook/:pair', (req, res) => {
  const rawPair = req.params.pair?.replace('-', '/').toUpperCase() ?? '';
  const pairResult = TradingPairSchema.safeParse(rawPair);

  if (!pairResult.success) {
    res.status(400).json({ code: 'INVALID_PAIR', message: 'Unknown trading pair' });
    return;
  }

  const pair = pairResult.data;
  const midPrice = parseFloat(REFERENCE_PRICES[pair] ?? '100');
  const spread = midPrice * 0.0002;

  const bids: OrderBookEntry[] = Array.from({ length: 10 }, (_, i) => ({
    price: (midPrice - spread - i * spread * 2).toFixed(2) as unknown as AssetAmount,
    quantity: (Math.random() * 2 + 0.1).toFixed(8) as unknown as AssetAmount,
    orderCount: Math.floor(Math.random() * 5) + 1,
  }));

  const asks: OrderBookEntry[] = Array.from({ length: 10 }, (_, i) => ({
    price: (midPrice + spread + i * spread * 2).toFixed(2) as unknown as AssetAmount,
    quantity: (Math.random() * 2 + 0.1).toFixed(8) as unknown as AssetAmount,
    orderCount: Math.floor(Math.random() * 5) + 1,
  }));

  const orderBook: OrderBook = { pair, bids, asks, timestamp: new Date() };
  res.status(200).json({ data: orderBook });
});

// ─── GET /trading/ticker/:pair ────────────────────────────────────────────────

tradingRouter.get('/ticker/:pair', (req, res) => {
  const rawPair = req.params.pair?.replace('-', '/').toUpperCase() ?? '';
  const pairResult = TradingPairSchema.safeParse(rawPair);

  if (!pairResult.success) {
    res.status(400).json({ code: 'INVALID_PAIR', message: 'Unknown trading pair' });
    return;
  }

  const pair = pairResult.data;
  const lastPrice = parseFloat(REFERENCE_PRICES[pair] ?? '100');
  const change = (Math.random() - 0.5) * lastPrice * 0.02;

  const ticker: Ticker = {
    pair,
    lastPrice: lastPrice.toFixed(2) as unknown as AssetAmount,
    bidPrice: (lastPrice - lastPrice * 0.0001).toFixed(2) as unknown as AssetAmount,
    askPrice: (lastPrice + lastPrice * 0.0001).toFixed(2) as unknown as AssetAmount,
    high24h: (lastPrice * 1.02).toFixed(2) as unknown as AssetAmount,
    low24h: (lastPrice * 0.98).toFixed(2) as unknown as AssetAmount,
    volume24h: (Math.random() * 1000 + 100).toFixed(8) as unknown as AssetAmount,
    priceChange24h: change.toFixed(2) as unknown as AssetAmount,
    priceChangePercent24h: ((change / lastPrice) * 100).toFixed(2),
    timestamp: new Date(),
  };

  res.status(200).json({ data: ticker });
});

// ─── GET /trading/history ─────────────────────────────────────────────────────

tradingRouter.get('/history', requireAuth, requireFullScope, (req, res) => {
  const auth = res.locals.auth;
  if (!auth) {
    res.status(401).json({ code: 'UNAUTHORIZED' });
    return;
  }

  const filledOrders = getOrdersByUser(auth.userId)
    .filter((o) => o.status === 'filled' || o.status === 'partially_filled')
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

  const page = parseInt(String(req.query['page'] ?? '1'), 10);
  const limit = Math.min(parseInt(String(req.query['limit'] ?? '20'), 10), 100);
  const paginated = filledOrders.slice((page - 1) * limit, page * limit);

  res.status(200).json({ data: paginated, meta: { page, limit, total: filledOrders.length } });
});
