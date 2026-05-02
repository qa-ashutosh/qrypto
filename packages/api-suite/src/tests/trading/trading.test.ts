/**
 * @qrypto/api-suite — Trading Tests
 *
 * Risk: Order book manipulation, balance leakage, incorrect fill logic.
 *
 * P0: Order placement, balance reservation, market order fills
 * P1: Partial fills, stop-loss, cancellation and balance release
 * P2: Order history, IDOR protection on order access
 *
 * Last updated: 2024-01-15
 */

import { test, expect, request } from '@playwright/test';
import { isEqual, add } from '@qrypto/shared-types';

import { AuthClient, TradingClient, WalletClient, AdminClient } from '../../clients/index.js';
import { SEED_USERS, SEED_ORDERS } from '../../fixtures/index.js';

test.describe('Trading — Order Placement', () => {
  let auth: AuthClient;
  let trading: TradingClient;
  let wallet: WalletClient;
  let admin: AdminClient;

  test.beforeEach(async () => {
    const ctx = await request.newContext();
    auth = new AuthClient(ctx);
    trading = new TradingClient(ctx);
    wallet = new WalletClient(ctx);
    admin = new AdminClient(ctx);
    await admin.reset();
  });

  test('limit buy order is accepted and status is open @smoke', async () => {
    const token = await auth.loginFull(SEED_USERS.VERIFIED.email, SEED_USERS.VERIFIED.password);

    const order = await trading.placeOrder(
      {
        pair: 'BTC/USDT',
        side: 'buy',
        type: 'limit',
        quantity: '0.01000000',
        price: '60000.00',
        timeInForce: 'GTC',
      },
      token,
    );

    expect(order.id).toBeTruthy();
    expect(order.status).toBe('open');
    expect(order.pair).toBe('BTC/USDT');
    expect(order.side).toBe('buy');
    expect(order.quantity).toBe('0.01000000');
    expect(order.price).toBe('60000.00');
    expect(order.filledQuantity).toBe('0.00000000');
  });

  test('market buy order fills immediately @smoke', async () => {
    const token = await auth.loginFull(SEED_USERS.VERIFIED.email, SEED_USERS.VERIFIED.password);

    const order = await trading.placeOrder(
      {
        pair: 'BTC/USDT',
        side: 'buy',
        type: 'market',
        quantity: '0.001',
      },
      token,
    );

    expect(order.status).toBe('filled');
    expect(order.filledQuantity).toBe('0.001');
    expect(order.averageFillPrice).toBeTruthy();
  });

  test('limit order reserves quote balance', async () => {
    const token = await auth.loginFull(SEED_USERS.VERIFIED.email, SEED_USERS.VERIFIED.password);

    const beforeUsdt = await wallet.getBalance('USDT', token);

    const quantity = '0.01000000';
    const price = '60000.00';
    // notional = 600, fee = 0.6 => total reserved = 600.6
    const notional = '600.000000';
    const fee = '0.600000'; // 0.1% of 600

    await trading.placeOrder(
      { pair: 'BTC/USDT', side: 'buy', type: 'limit', quantity, price },
      token,
    );

    const afterUsdt = await wallet.getBalance('USDT', token);
    const totalReserved = add(notional, fee);

    // Available reduced by notional + fee
    expect(
      isEqual(
        afterUsdt.available,
        // available should decrease by notional + fee
        (parseFloat(beforeUsdt.available) - parseFloat(totalReserved)).toFixed(6),
      ),
    ).toBe(true);
  });

  test('limit order without price is rejected', async () => {
    const token = await auth.loginFull(SEED_USERS.VERIFIED.email, SEED_USERS.VERIFIED.password);

    await expect(
      trading.placeOrder({ pair: 'BTC/USDT', side: 'buy', type: 'limit', quantity: '0.01' }, token),
    ).rejects.toMatchObject({ status: 400, code: 'VALIDATION_ERROR' });
  });

  test('stop-loss order requires stopPrice', async () => {
    const token = await auth.loginFull(SEED_USERS.VERIFIED.email, SEED_USERS.VERIFIED.password);

    await expect(
      trading.placeOrder(
        { pair: 'BTC/USDT', side: 'sell', type: 'stop_loss', quantity: '0.01' },
        token,
      ),
    ).rejects.toMatchObject({ status: 400, code: 'VALIDATION_ERROR' });
  });

  test('insufficient balance prevents order placement', async () => {
    const token = await auth.loginFull(
      SEED_USERS.ZERO_BALANCE.email,
      SEED_USERS.ZERO_BALANCE.password,
    );

    await expect(
      trading.placeOrder(
        { pair: 'BTC/USDT', side: 'buy', type: 'limit', quantity: '1.0', price: '65000' },
        token,
      ),
    ).rejects.toMatchObject({ status: 422, code: 'INSUFFICIENT_FUNDS' });
  });
});

test.describe('Trading — Order Retrieval', () => {
  let auth: AuthClient;
  let trading: TradingClient;
  let admin: AdminClient;

  test.beforeEach(async () => {
    const ctx = await request.newContext();
    auth = new AuthClient(ctx);
    trading = new TradingClient(ctx);
    admin = new AdminClient(ctx);
    await admin.reset();
  });

  test('GET /trading/orders returns seed orders for verified user @smoke', async () => {
    const token = await auth.loginFull(SEED_USERS.VERIFIED.email, SEED_USERS.VERIFIED.password);

    const orders = await trading.getOrders(token);

    expect(orders.length).toBeGreaterThanOrEqual(3);
  });

  test('status filter returns only matching orders', async () => {
    const token = await auth.loginFull(SEED_USERS.VERIFIED.email, SEED_USERS.VERIFIED.password);

    const openOrders = await trading.getOrders(token, 'open');
    openOrders.forEach((o) => expect(o.status).toBe('open'));
  });

  test('GET /trading/orders/:id returns correct order', async () => {
    const token = await auth.loginFull(SEED_USERS.VERIFIED.email, SEED_USERS.VERIFIED.password);

    const order = await trading.getOrder(SEED_ORDERS.OPEN_LIMIT, token);

    expect(order.id).toBe(SEED_ORDERS.OPEN_LIMIT);
    expect(order.status).toBe('open');
    expect(order.pair).toBe('BTC/USDT');
  });

  test('IDOR: user cannot access another users order', async () => {
    // VERIFIED user tries to access an order — if that order belonged to a
    // different user it should return 404
    const tokenOther = await auth
      .login(SEED_USERS.UNVERIFIED.email, SEED_USERS.UNVERIFIED.password)
      .then((r) => r.accessToken);

    // SEED_ORDERS.OPEN_LIMIT belongs to VERIFIED, not UNVERIFIED
    await expect(trading.getOrder(SEED_ORDERS.OPEN_LIMIT, tokenOther)).rejects.toMatchObject({
      status: 404,
    });
  });

  test('non-existent order returns 404', async () => {
    const token = await auth.loginFull(SEED_USERS.VERIFIED.email, SEED_USERS.VERIFIED.password);

    await expect(
      trading.getOrder('00000000-0000-0000-0000-000000000000', token),
    ).rejects.toMatchObject({ status: 404 });
  });
});

test.describe('Trading — Order Cancellation', () => {
  let auth: AuthClient;
  let trading: TradingClient;
  let admin: AdminClient;

  test.beforeEach(async () => {
    const ctx = await request.newContext();
    auth = new AuthClient(ctx);
    trading = new TradingClient(ctx);
    admin = new AdminClient(ctx);
    await admin.reset();
  });

  test('open order can be cancelled @smoke', async () => {
    const token = await auth.loginFull(SEED_USERS.VERIFIED.email, SEED_USERS.VERIFIED.password);

    const result = await trading.cancelOrder(SEED_ORDERS.OPEN_LIMIT, token);

    expect(result.status).toBe('cancelled');

    const order = await trading.getOrder(SEED_ORDERS.OPEN_LIMIT, token);
    expect(order.status).toBe('cancelled');
  });

  test('filled order cannot be cancelled — returns 409', async () => {
    const token = await auth.loginFull(SEED_USERS.VERIFIED.email, SEED_USERS.VERIFIED.password);

    await expect(trading.cancelOrder(SEED_ORDERS.FILLED_MARKET, token)).rejects.toMatchObject({
      status: 409,
      code: 'ORDER_NOT_CANCELLABLE',
    });
  });

  test('already-cancelled order returns 409', async () => {
    const token = await auth.loginFull(SEED_USERS.VERIFIED.email, SEED_USERS.VERIFIED.password);

    await trading.cancelOrder(SEED_ORDERS.OPEN_LIMIT, token);

    await expect(trading.cancelOrder(SEED_ORDERS.OPEN_LIMIT, token)).rejects.toMatchObject({
      status: 409,
      code: 'ORDER_NOT_CANCELLABLE',
    });
  });
});

test.describe('Trading — Market Data', () => {
  test('order book returns bids and asks for valid pair @smoke', async () => {
    const ctx = await request.newContext();
    const trading = new TradingClient(ctx);

    const book = await trading.getOrderBook('BTC/USDT');

    expect(book.pair).toBe('BTC/USDT');
    expect(book.bids.length).toBeGreaterThan(0);
    expect(book.asks.length).toBeGreaterThan(0);

    // Bids should be at lower price than asks
    const topBid = parseFloat(book.bids[0]?.price ?? '0');
    const topAsk = parseFloat(book.asks[0]?.price ?? '999999');
    expect(topBid).toBeLessThan(topAsk);
  });

  test('ticker returns current price for valid pair @smoke', async () => {
    const ctx = await request.newContext();
    const trading = new TradingClient(ctx);

    const ticker = await trading.getTicker('BTC/USDT');

    expect(ticker.pair).toBe('BTC/USDT');
    expect(parseFloat(ticker.lastPrice)).toBeGreaterThan(0);
    expect(parseFloat(ticker.bidPrice)).toBeGreaterThan(0);
    expect(parseFloat(ticker.askPrice)).toBeGreaterThan(0);
  });

  test('invalid pair returns 400', async () => {
    const ctx = await request.newContext();
    const trading = new TradingClient(ctx);

    await expect(trading.getOrderBook('INVALID/PAIR')).rejects.toMatchObject({
      status: 400,
      code: 'INVALID_PAIR',
    });
  });
});
