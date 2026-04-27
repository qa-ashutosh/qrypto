import { useState, useEffect, useCallback, useRef } from 'react';

import { tradingApi, QryptoApiError } from '../lib/api';
import type { Order, Ticker, OrderBook } from '../lib/api';
import { useAuth } from '../lib/auth-context';

const PAIRS = ['BTC/USDT', 'ETH/USDT', 'ETH/BTC'] as const;
type Pair = (typeof PAIRS)[number];

const statusColor: Record<string, string> = {
  open: 'var(--blue)',
  partially_filled: 'var(--yellow)',
  filled: 'var(--green)',
  cancelled: 'var(--text-muted)',
  rejected: 'var(--red)',
};

const labelStyle = {
  display: 'block',
  fontFamily: 'var(--font-mono)',
  fontSize: '0.65rem',
  color: 'var(--text-muted)',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.1em',
  marginBottom: 5,
};

export function TradingPage() {
  const { token } = useAuth();
  const [pair, setPair] = useState<Pair>('BTC/USDT');
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [orderType, setOrderType] = useState<'market' | 'limit'>('limit');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [ticker, setTicker] = useState<Ticker | null>(null);
  const [orderBook, setOrderBook] = useState<OrderBook | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchTicker = useCallback(async () => {
    try {
      const t = await tradingApi.getTicker(pair);
      setTicker(t);
    } catch {
      // silent — polling, don't surface transient errors
    }
  }, [pair]);

  const fetchOrderBook = useCallback(async () => {
    try {
      const ob = await tradingApi.getOrderBook(pair);
      setOrderBook(ob);
    } catch {
      // silent
    }
  }, [pair]);

  const fetchOrders = useCallback(async () => {
    if (!token) return;
    try {
      const o = await tradingApi.getOrders(token);
      setOrders(o);
    } catch {
      // silent
    }
  }, [token]);

  // Poll ticker + order book every 2s
  useEffect(() => {
    void fetchTicker();
    void fetchOrderBook();
    void fetchOrders();

    pollRef.current = setInterval(() => {
      void fetchTicker();
      void fetchOrderBook();
    }, 2000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchTicker, fetchOrderBook, fetchOrders]);

  // Refetch when pair changes
  useEffect(() => {
    void fetchTicker();
    void fetchOrderBook();
  }, [pair, fetchTicker, fetchOrderBook]);

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const order = await tradingApi.placeOrder(
        {
          pair,
          side,
          type: orderType,
          quantity,
          ...(orderType === 'limit' && price ? { price } : {}),
        },
        token,
      );
      setSuccess(`Order ${order.id.slice(0, 8)}... placed — ${order.status}`);
      setQuantity('');
      setPrice('');
      await fetchOrders();
    } catch (err) {
      setError(err instanceof QryptoApiError ? err.message : 'Order failed');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (id: string) => {
    if (!token) return;
    try {
      await tradingApi.cancelOrder(id, token);
      await fetchOrders();
    } catch (err) {
      setError(err instanceof QryptoApiError ? err.message : 'Cancel failed');
    }
  };

  const priceChange = ticker ? parseFloat(ticker.priceChangePercent24h) : 0;

  return (
    <div className="page animate-in">
      <div className="page-title">Trading</div>

      {/* Pair selector + ticker strip */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          marginBottom: 20,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        {PAIRS.map((p) => (
          <button
            key={p}
            data-testid={`pair-${p.replace('/', '-')}`}
            onClick={() => setPair(p)}
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.75rem',
              padding: '5px 12px',
              background: pair === p ? 'var(--accent)' : 'var(--bg-surface)',
              color: pair === p ? 'var(--text-inverse)' : 'var(--text-secondary)',
              border: `1px solid ${pair === p ? 'var(--accent)' : 'var(--border-default)'}`,
              borderRadius: 2,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {p}
          </button>
        ))}

        {ticker && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 20, alignItems: 'center' }}>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '1.1rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
              }}
            >
              {parseFloat(ticker.lastPrice).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
            <span
              data-testid="ticker-change"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.8rem',
                color: priceChange >= 0 ? 'var(--green)' : 'var(--red)',
              }}
            >
              {priceChange >= 0 ? '+' : ''}
              {priceChange.toFixed(2)}%
            </span>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.7rem',
                color: 'var(--text-muted)',
              }}
            >
              H: {parseFloat(ticker.high24h).toLocaleString()} · L:{' '}
              {parseFloat(ticker.low24h).toLocaleString()}
            </span>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 16 }}>
        {/* ── Order Form ────────────────────────────────────────────── */}
        <div>
          <div className="card">
            {/* Buy / Sell tabs */}
            <div
              style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 16 }}
            >
              {(['buy', 'sell'] as const).map((s) => (
                <button
                  key={s}
                  data-testid={`side-${s}`}
                  onClick={() => setSide(s)}
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    padding: '8px',
                    border: 'none',
                    borderRadius: 2,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    background:
                      side === s
                        ? s === 'buy'
                          ? 'var(--green)'
                          : 'var(--red)'
                        : 'var(--bg-overlay)',
                    color: side === s ? '#fff' : 'var(--text-muted)',
                  }}
                >
                  {s}
                </button>
              ))}
            </div>

            {/* Order type */}
            <div
              style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 16 }}
            >
              {(['limit', 'market'] as const).map((t) => (
                <button
                  key={t}
                  data-testid={`type-${t}`}
                  onClick={() => setOrderType(t)}
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.7rem',
                    padding: '5px',
                    border: `1px solid ${orderType === t ? 'var(--accent)' : 'var(--border-default)'}`,
                    borderRadius: 2,
                    cursor: 'pointer',
                    background: orderType === t ? 'var(--accent-glow)' : 'transparent',
                    color: orderType === t ? 'var(--accent)' : 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    transition: 'all 0.15s',
                  }}
                >
                  {t}
                </button>
              ))}
            </div>

            <form
              onSubmit={(e) => {
                void handlePlaceOrder(e);
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
            >
              {orderType === 'limit' && (
                <div>
                  <label style={labelStyle}>Price</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder={ticker ? ticker.lastPrice : '0.00'}
                    required
                    data-testid="order-price"
                    style={{ width: '100%' }}
                  />
                </div>
              )}

              <div>
                <label style={labelStyle}>Quantity</label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="0.00000000"
                  required
                  data-testid="order-quantity"
                  style={{ width: '100%' }}
                />
              </div>

              {error && (
                <div
                  data-testid="order-error"
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.72rem',
                    color: 'var(--red)',
                    padding: '7px 10px',
                    background: 'var(--red-dim)',
                    borderRadius: 2,
                  }}
                >
                  {error}
                </div>
              )}

              {success && (
                <div
                  data-testid="order-success"
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.72rem',
                    color: 'var(--green)',
                    padding: '7px 10px',
                    background: 'var(--green-dim)',
                    borderRadius: 2,
                  }}
                >
                  {success}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !token}
                data-testid="order-submit"
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  padding: '10px',
                  border: 'none',
                  borderRadius: 3,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  background: loading
                    ? 'var(--bg-overlay)'
                    : side === 'buy'
                      ? 'var(--green)'
                      : 'var(--red)',
                  color: loading ? 'var(--text-muted)' : '#fff',
                  transition: 'all 0.15s',
                }}
              >
                {loading
                  ? 'Placing...'
                  : `${side === 'buy' ? 'Buy' : 'Sell'} ${pair.split('/')[0]}`}
              </button>

              {!token && (
                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.65rem',
                    color: 'var(--text-muted)',
                    textAlign: 'center',
                  }}
                >
                  Sign in to trade
                </div>
              )}
            </form>
          </div>
        </div>

        {/* ── Right column ──────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Order Book */}
          <div className="card">
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.65rem',
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                marginBottom: 12,
              }}
            >
              Order Book — {pair}
            </div>

            {orderBook ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {/* Asks */}
                <div>
                  <div
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.62rem',
                      color: 'var(--text-muted)',
                      marginBottom: 6,
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: 4,
                    }}
                  >
                    <span>PRICE</span>
                    <span style={{ textAlign: 'right' }}>SIZE</span>
                  </div>
                  {orderBook.asks.slice(0, 8).map((ask, i) => (
                    <div
                      key={i}
                      data-testid={`ask-${i}`}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: 4,
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.75rem',
                        padding: '2px 0',
                      }}
                    >
                      <span className="text-red">{parseFloat(ask.price).toFixed(2)}</span>
                      <span style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
                        {parseFloat(ask.quantity).toFixed(4)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Bids */}
                <div>
                  <div
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.62rem',
                      color: 'var(--text-muted)',
                      marginBottom: 6,
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: 4,
                    }}
                  >
                    <span>PRICE</span>
                    <span style={{ textAlign: 'right' }}>SIZE</span>
                  </div>
                  {orderBook.bids.slice(0, 8).map((bid, i) => (
                    <div
                      key={i}
                      data-testid={`bid-${i}`}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: 4,
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.75rem',
                        padding: '2px 0',
                      }}
                    >
                      <span className="text-green">{parseFloat(bid.price).toFixed(2)}</span>
                      <span style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
                        {parseFloat(bid.quantity).toFixed(4)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.75rem',
                  color: 'var(--text-muted)',
                }}
              >
                Loading order book...
              </div>
            )}
          </div>

          {/* Open Orders */}
          {token && (
            <div className="card">
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.65rem',
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  marginBottom: 12,
                }}
              >
                Open Orders
              </div>
              {orders.filter((o) => ['open', 'partially_filled'].includes(o.status)).length ===
              0 ? (
                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.75rem',
                    color: 'var(--text-muted)',
                  }}
                >
                  No open orders
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {orders
                    .filter((o) => ['open', 'partially_filled'].includes(o.status))
                    .map((order) => (
                      <div
                        key={order.id}
                        data-testid={`order-row-${order.id}`}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '80px 60px 80px 1fr auto',
                          gap: 12,
                          alignItems: 'center',
                          padding: '6px 0',
                          borderBottom: '1px solid var(--border-subtle)',
                        }}
                      >
                        <span
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '0.72rem',
                            color: 'var(--text-secondary)',
                          }}
                        >
                          {order.pair}
                        </span>
                        <span
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '0.72rem',
                            color: order.side === 'buy' ? 'var(--green)' : 'var(--red)',
                            textTransform: 'uppercase',
                          }}
                        >
                          {order.side}
                        </span>
                        <span
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '0.72rem',
                            color: 'var(--text-primary)',
                          }}
                        >
                          {parseFloat(order.quantity).toFixed(4)}
                        </span>
                        <span
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '0.65rem',
                            color: statusColor[order.status] ?? 'var(--text-muted)',
                            textTransform: 'uppercase',
                          }}
                        >
                          {order.status.replace('_', ' ')}
                        </span>
                        <button
                          onClick={() => void handleCancel(order.id)}
                          data-testid={`cancel-${order.id}`}
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '0.65rem',
                            padding: '3px 8px',
                            background: 'transparent',
                            border: '1px solid var(--border-default)',
                            borderRadius: 2,
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
