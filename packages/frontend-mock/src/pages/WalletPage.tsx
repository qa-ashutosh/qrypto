import { useState, useEffect } from 'react';

import { walletApi, QryptoApiError, type WalletBalance, type Transaction } from '../lib/api';
import { useAuth } from '../lib/auth-context';

const CURRENCY_DECIMALS: Record<string, number> = {
  BTC: 8,
  ETH: 8,
  USDT: 6,
  USDC: 6,
  USD: 2,
  EUR: 2,
};

const TX_STATUS_CLASS: Record<string, string> = {
  confirmed: 'tag-green',
  pending: 'tag-yellow',
  failed: 'tag-red',
  processing: 'tag-blue',
  cancelled: 'tag-muted',
};

export function WalletPage() {
  const { token } = useAuth();
  const [balances, setBalances] = useState<WalletBalance[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [depositInfo, setDepositInfo] = useState<{ address: string; network: string } | null>(null);
  const [depositCurrency, setDepositCurrency] = useState('BTC');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'balances' | 'deposit' | 'withdraw' | 'history'>(
    'balances',
  );

  // Withdrawal form
  const [wCurrency, setWCurrency] = useState('BTC');
  const [wAmount, setWAmount] = useState('');
  const [wAddress, setWAddress] = useState('');
  const [wCode, setWCode] = useState('');
  const [wLoading, setWLoading] = useState(false);
  const [wMessage, setWMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null,
  );

  const load = async () => {
    if (!token) return;
    try {
      const [b, t] = await Promise.all([
        walletApi.getBalances(token),
        walletApi.getTransactions(token),
      ]);
      setBalances(b);
      setTransactions(t as unknown as Transaction[]);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [token]);

  const handleDeposit = async () => {
    if (!token) return;
    try {
      const info = await walletApi.getDepositAddress(depositCurrency, token);
      setDepositInfo(info);
    } catch {
      /* ignore */
    }
  };

  const handleWithdraw = async () => {
    if (!token) return;
    setWLoading(true);
    setWMessage(null);
    try {
      const res = await walletApi.withdraw(
        {
          currency: wCurrency,
          amount: wAmount,
          destinationAddress: wAddress,
          twoFactorCode: wCode,
        },
        token,
      );
      setWMessage({
        type: 'success',
        text: `Withdrawal initiated — TX ${res.transactionId.slice(0, 8)}...`,
      });
      setWAmount('');
      setWAddress('');
      setWCode('');
      void load();
    } catch (err) {
      setWMessage({
        type: 'error',
        text: err instanceof QryptoApiError ? err.message : 'Withdrawal failed',
      });
    } finally {
      setWLoading(false);
    }
  };

  const inputStyle = { width: '100%', marginBottom: 8 };
  const labelStyle = {
    display: 'block' as const,
    fontFamily: 'var(--font-mono)',
    fontSize: '0.65rem',
    color: 'var(--text-muted)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.1em',
    marginBottom: 5,
  };
  const primaryBtn = {
    fontFamily: 'var(--font-mono)',
    fontSize: '0.75rem',
    fontWeight: 500,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.1em',
    padding: '9px 16px',
    background: 'var(--accent)',
    color: 'var(--text-inverse)',
    border: 'none',
    borderRadius: 3,
    cursor: 'pointer',
    width: '100%',
  };

  const tabs = [
    { id: 'balances', label: 'Balances' },
    { id: 'deposit', label: 'Deposit' },
    { id: 'withdraw', label: 'Withdraw' },
    { id: 'history', label: 'History' },
  ] as const;

  if (loading)
    return (
      <div className="page" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
        Loading...
      </div>
    );

  return (
    <div className="page animate-in">
      <div className="page-title">Wallet</div>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          gap: 0,
          borderBottom: '1px solid var(--border-subtle)',
          marginBottom: 20,
        }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            data-testid={`wallet-tab-${tab.id}`}
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.7rem',
              fontWeight: 500,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              padding: '8px 16px',
              background: 'transparent',
              color: activeTab === tab.id ? 'var(--text-primary)' : 'var(--text-muted)',
              borderBottom:
                activeTab === tab.id ? '2px solid var(--accent)' : '2px solid transparent',
              borderTop: 'none',
              borderLeft: 'none',
              borderRight: 'none',
              cursor: 'pointer',
              marginBottom: -1,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Balances */}
      {activeTab === 'balances' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {balances.map((b) => (
            <div
              key={b.currency}
              className="card"
              data-testid={`balance-row-${b.currency}`}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 600,
                    fontSize: '0.875rem',
                    color: 'var(--accent)',
                    minWidth: 48,
                  }}
                >
                  {b.currency}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 32, textAlign: 'right' }}>
                {[
                  { label: 'Available', value: b.available },
                  { label: 'Reserved', value: b.reserved },
                  { label: 'Total', value: b.total },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <div
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.6rem',
                        color: 'var(--text-muted)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                      }}
                    >
                      {label}
                    </div>
                    <div
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.875rem',
                        color:
                          label === 'Reserved' && value !== '0.00000000' && value !== '0.000000'
                            ? 'var(--yellow)'
                            : 'var(--text-primary)',
                      }}
                    >
                      {value}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Deposit */}
      {activeTab === 'deposit' && (
        <div className="card" style={{ maxWidth: 480 }}>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.65rem',
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              marginBottom: 16,
            }}
          >
            Deposit Funds
          </div>
          <label style={labelStyle}>Currency</label>
          <select
            value={depositCurrency}
            onChange={(e) => {
              setDepositCurrency(e.target.value);
              setDepositInfo(null);
            }}
            style={inputStyle}
            data-testid="deposit-currency"
          >
            {['BTC', 'ETH', 'USDT', 'USDC', 'USD'].map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <button
            onClick={() => {
              void handleDeposit();
            }}
            style={{ ...primaryBtn, marginBottom: 12 }}
            data-testid="deposit-get-address"
          >
            Get Deposit Address
          </button>
          {depositInfo && (
            <div
              data-testid="deposit-address-container"
              style={{
                padding: '12px',
                background: 'var(--bg-input)',
                border: '1px solid var(--border-default)',
                borderRadius: 3,
              }}
            >
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.65rem',
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  marginBottom: 6,
                }}
              >
                {depositCurrency} Address ({depositInfo.network})
              </div>
              <div
                data-testid="deposit-address"
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.75rem',
                  color: 'var(--green)',
                  wordBreak: 'break-all',
                }}
              >
                {depositInfo.address}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Withdraw */}
      {activeTab === 'withdraw' && (
        <div className="card" style={{ maxWidth: 480 }}>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.65rem',
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              marginBottom: 16,
            }}
          >
            Withdraw Funds
          </div>
          <label style={labelStyle}>Currency</label>
          <select
            value={wCurrency}
            onChange={(e) => setWCurrency(e.target.value)}
            style={inputStyle}
            data-testid="withdraw-currency"
          >
            {['BTC', 'ETH', 'USDT', 'USDC', 'USD'].map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <label style={labelStyle}>Amount</label>
          <input
            type="number"
            step="any"
            value={wAmount}
            onChange={(e) => setWAmount(e.target.value)}
            placeholder={`0.${'0'.repeat(CURRENCY_DECIMALS[wCurrency] ?? 8)}`}
            style={inputStyle}
            data-testid="withdraw-amount"
          />
          <label style={labelStyle}>Destination Address</label>
          <input
            type="text"
            value={wAddress}
            onChange={(e) => setWAddress(e.target.value)}
            placeholder="Enter destination address"
            style={inputStyle}
            data-testid="withdraw-address"
          />
          <label style={labelStyle}>2FA Code</label>
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={wCode}
            onChange={(e) => setWCode(e.target.value.replace(/\D/g, ''))}
            placeholder="123456"
            style={inputStyle}
            data-testid="withdraw-2fa-code"
          />
          {wMessage && (
            <div
              data-testid={`withdraw-${wMessage.type}`}
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.75rem',
                color: wMessage.type === 'success' ? 'var(--green)' : 'var(--red)',
                padding: '8px 12px',
                background: wMessage.type === 'success' ? 'var(--green-dim)' : 'var(--red-dim)',
                borderRadius: 3,
                marginBottom: 10,
              }}
            >
              {wMessage.text}
            </div>
          )}
          <button
            onClick={() => {
              void handleWithdraw();
            }}
            disabled={wLoading || !wAmount || !wAddress || !wCode}
            style={{
              ...primaryBtn,
              background: wLoading ? 'var(--bg-overlay)' : 'var(--accent)',
              color: wLoading ? 'var(--text-muted)' : 'var(--text-inverse)',
              cursor: wLoading ? 'not-allowed' : 'pointer',
            }}
            data-testid="withdraw-submit"
          >
            {wLoading ? 'Processing...' : 'Withdraw'}
          </button>
        </div>
      )}

      {/* History */}
      {activeTab === 'history' && (
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
            Transaction History
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Type', 'Currency', 'Amount', 'Fee', 'Status', 'Date'].map((h) => (
                  <th
                    key={h}
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.65rem',
                      color: 'var(--text-muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      padding: '6px 8px',
                      textAlign: 'left',
                      borderBottom: '1px solid var(--border-subtle)',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <tr
                  key={tx.id}
                  data-testid="transaction-row"
                  style={{ borderBottom: '1px solid var(--border-subtle)' }}
                >
                  <td
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.75rem',
                      padding: '8px',
                      color:
                        tx.type === 'deposit'
                          ? 'var(--green)'
                          : tx.type === 'withdrawal'
                            ? 'var(--red)'
                            : 'var(--text-secondary)',
                    }}
                  >
                    {tx.type}
                  </td>
                  <td
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.75rem',
                      padding: '8px',
                      color: 'var(--accent)',
                    }}
                  >
                    {tx.currency}
                  </td>
                  <td
                    style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', padding: '8px' }}
                  >
                    {tx.amount}
                  </td>
                  <td
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.75rem',
                      padding: '8px',
                      color: 'var(--text-muted)',
                    }}
                  >
                    {tx.fee}
                  </td>
                  <td style={{ padding: '8px' }}>
                    <span className={`tag ${TX_STATUS_CLASS[tx.status] ?? 'tag-muted'}`}>
                      {tx.status}
                    </span>
                  </td>
                  <td
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.7rem',
                      padding: '8px',
                      color: 'var(--text-muted)',
                    }}
                  >
                    {new Date(tx.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
