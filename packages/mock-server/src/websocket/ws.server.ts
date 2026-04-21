/**
 * @qrypto/mock-server — WebSocket Server
 *
 * Runs on port 4000 (separate from the HTTP server on 8080).
 *
 * Channels (subscribe by sending a JSON subscribe message):
 *   ticker:<pair>       — live price tick every 1s
 *   orderbook:<pair>    — order book depth snapshot every 2s
 *   orders              — order lifecycle events for authenticated user
 *   account             — account balance update events
 *
 * Subscribe message format:
 *   { "action": "subscribe", "channels": ["ticker:BTC/USDT", "orderbook:ETH/USDT"] }
 *
 * Chaos integration:
 *   - dropWebSocket: true  → drops all connections immediately
 *   - stalePriceFeedSeconds: N → pauses ticker updates for N seconds
 *
 * Last updated: 2024-01-15
 */

import type { IncomingMessage } from 'http';

import { logger } from '@qrypto/shared-types';
import type { AssetAmount, TradingPair, WsMessage } from '@qrypto/shared-types';
import { WebSocketServer, WebSocket } from 'ws';

import { getState } from '../state.js';

const wsLogger = logger.child({ service: 'websocket' });

// ─── Types ────────────────────────────────────────────────────────────────────

interface SubscribeMessage {
  action: 'subscribe' | 'unsubscribe';
  channels: string[];
}

interface ConnectedClient {
  ws: WebSocket;
  subscriptions: Set<string>;
  connectedAt: Date;
  correlationId: string;
}

// ─── State ────────────────────────────────────────────────────────────────────

const clients = new Map<WebSocket, ConnectedClient>();

const REFERENCE_PRICES: Record<string, number> = {
  'BTC/USDT': 65000,
  'ETH/USDT': 3500,
  'BTC/USD': 65000,
  'ETH/USD': 3500,
  'ETH/BTC': 0.05384615,
};

// Price drift simulation — tiny random walk per tick
const currentPrices: Record<string, number> = { ...REFERENCE_PRICES };

let tickerInterval: ReturnType<typeof setInterval> | null = null;
let orderBookInterval: ReturnType<typeof setInterval> | null = null;
let stalePriceFeedUntil: Date | null = null;

// ─── Server Setup ─────────────────────────────────────────────────────────────

export function createWsServer(port: number): WebSocketServer {
  const wss = new WebSocketServer({ port });

  wss.on('listening', () => {
    wsLogger.info(`WebSocket server listening`, { port });
  });

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const correlationId = crypto.randomUUID();
    const client: ConnectedClient = {
      ws,
      subscriptions: new Set(),
      connectedAt: new Date(),
      correlationId,
    };
    clients.set(ws, client);

    wsLogger.info('client connected', {
      correlationId,
      ip: req.socket.remoteAddress,
      totalClients: clients.size,
    });

    // Send connection acknowledgement
    send(ws, { type: 'connection_ack', data: { correlationId }, timestamp: new Date() });

    ws.on('message', (raw) => {
      const msg = Buffer.isBuffer(raw) ? raw.toString('utf8') : String(raw);
      handleMessage(ws, client, msg);
    });

    ws.on('close', () => {
      clients.delete(ws);
      wsLogger.info('client disconnected', { correlationId, totalClients: clients.size });
    });

    ws.on('error', (err) => {
      wsLogger.error('client error', err, { correlationId });
      clients.delete(ws);
    });

    // Ping/pong keepalive
    ws.on('ping', () => ws.pong());
  });

  // Start broadcast loops
  startTickerBroadcast();
  startOrderBookBroadcast();

  return wss;
}

// ─── Message Handling ─────────────────────────────────────────────────────────

function handleMessage(ws: WebSocket, client: ConnectedClient, raw: string): void {
  try {
    const msg = JSON.parse(raw) as Partial<SubscribeMessage>;

    if (msg.action === 'subscribe' && Array.isArray(msg.channels)) {
      for (const channel of msg.channels) {
        client.subscriptions.add(channel);
      }
      send(ws, {
        type: 'connection_ack',
        data: { subscribed: msg.channels },
        timestamp: new Date(),
      });
      wsLogger.debug('client subscribed', {
        correlationId: client.correlationId,
        channels: msg.channels,
      });
    } else if (msg.action === 'unsubscribe' && Array.isArray(msg.channels)) {
      for (const channel of msg.channels) {
        client.subscriptions.delete(channel);
      }
    } else if ((msg as Record<string, unknown>)['type'] === 'ping') {
      send(ws, { type: 'pong', data: {}, timestamp: new Date() });
    }
  } catch {
    send(ws, {
      type: 'error',
      data: { message: 'Invalid message format — expected JSON' },
      timestamp: new Date(),
    });
  }
}

// ─── Broadcast Loops ──────────────────────────────────────────────────────────

function startTickerBroadcast(): void {
  if (tickerInterval) clearInterval(tickerInterval);

  tickerInterval = setInterval(() => {
    const { chaos } = getState();

    // Chaos: drop all connections
    if (chaos.dropWebSocket) {
      for (const [ws] of clients) {
        ws.terminate();
      }
      clients.clear();
      return;
    }

    // Chaos: stale price feed
    if (chaos.stalePriceFeedSeconds !== null) {
      if (stalePriceFeedUntil === null) {
        stalePriceFeedUntil = new Date(Date.now() + chaos.stalePriceFeedSeconds * 1000);
      }
      if (new Date() < stalePriceFeedUntil) return;
      stalePriceFeedUntil = null;
    }

    for (const pair of Object.keys(currentPrices) as TradingPair[]) {
      const channel = `ticker:${pair}`;
      const subscribers = getSubscribers(channel);
      if (subscribers.length === 0) continue;

      // Random walk — tiny drift each tick
      const drift = (Math.random() - 0.5) * 0.002;
      currentPrices[pair] = (currentPrices[pair] ?? 100) * (1 + drift);

      const price = (currentPrices[pair] ?? 100).toFixed(2);
      const message: WsMessage = {
        type: 'ticker',
        data: {
          pair,
          lastPrice: price as AssetAmount,
          bidPrice: ((currentPrices[pair] ?? 100) * 0.9999).toFixed(2) as AssetAmount,
          askPrice: ((currentPrices[pair] ?? 100) * 1.0001).toFixed(2) as AssetAmount,
          timestamp: new Date().toISOString(),
        },
        timestamp: new Date(),
      };

      broadcast(subscribers, message);
    }
  }, 1000);
}

function startOrderBookBroadcast(): void {
  if (orderBookInterval) clearInterval(orderBookInterval);

  orderBookInterval = setInterval(() => {
    const { chaos } = getState();
    if (chaos.dropWebSocket || chaos.stalePriceFeedSeconds !== null) return;

    for (const pair of Object.keys(currentPrices) as TradingPair[]) {
      const channel = `orderbook:${pair}`;
      const subscribers = getSubscribers(channel);
      if (subscribers.length === 0) continue;

      const mid = currentPrices[pair] ?? 100;
      const spread = mid * 0.0002;

      const message: WsMessage = {
        type: 'orderbook',
        data: {
          pair,
          bids: Array.from({ length: 5 }, (_, i) => ({
            price: (mid - spread - i * spread * 2).toFixed(2),
            quantity: (Math.random() * 2 + 0.1).toFixed(8),
            orderCount: Math.floor(Math.random() * 5) + 1,
          })),
          asks: Array.from({ length: 5 }, (_, i) => ({
            price: (mid + spread + i * spread * 2).toFixed(2),
            quantity: (Math.random() * 2 + 0.1).toFixed(8),
            orderCount: Math.floor(Math.random() * 5) + 1,
          })),
          timestamp: new Date().toISOString(),
        },
        timestamp: new Date(),
      };

      broadcast(subscribers, message);
    }
  }, 2000);
}

// ─── Broadcast Helpers ────────────────────────────────────────────────────────

function getSubscribers(channel: string): WebSocket[] {
  const result: WebSocket[] = [];
  for (const [ws, client] of clients) {
    if (client.subscriptions.has(channel) && ws.readyState === WebSocket.OPEN) {
      result.push(ws);
    }
  }
  return result;
}

function broadcast(sockets: WebSocket[], message: WsMessage): void {
  const payload = JSON.stringify(message);
  for (const ws of sockets) {
    try {
      ws.send(payload);
    } catch {
      // Client disconnected mid-send — will be cleaned up on close event
    }
  }
}

function send(ws: WebSocket, message: WsMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

/**
 * Broadcast an order update to all clients subscribed to the orders channel.
 * Called by trading routes when order status changes.
 */
export function broadcastOrderUpdate(userId: string, order: unknown): void {
  const channel = `orders:${userId}`;
  const subscribers = getSubscribers(channel);
  broadcast(subscribers, {
    type: 'order_update',
    data: order,
    timestamp: new Date(),
  });
}

export function getConnectedClientCount(): number {
  return clients.size;
}

export function stopWsServer(): void {
  if (tickerInterval) clearInterval(tickerInterval);
  if (orderBookInterval) clearInterval(orderBookInterval);
  for (const [ws] of clients) ws.terminate();
  clients.clear();
}
