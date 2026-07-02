import type { Page } from '../App.tsx';
import { authApi } from '../lib/api';
import { useAuth } from '../lib/auth-context';

interface NavProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
}

const NAV_ITEMS = [
  { id: 'trading', label: 'Trading' },
  { id: 'wallet', label: 'Wallet' },
  { id: 'kyc', label: 'KYC' },
  { id: 'account', label: 'Account' },
];

export function Nav({ currentPage, onNavigate }: NavProps) {
  const { token, clearAuth } = useAuth();

  const handleLogout = async () => {
    if (token) {
      try {
        await authApi.logout(token);
      } catch {
        /* ignore */
      }
    }
    clearAuth();
    onNavigate('login' as Page);
  };

  return (
    <nav
      style={{
        height: 'var(--nav-height)',
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 24px',
        gap: 0,
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}
    >
      {/* Logo */}
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontWeight: 600,
          fontSize: '0.875rem',
          color: 'var(--accent)',
          letterSpacing: '0.1em',
          marginRight: 32,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: 'var(--green)',
            display: 'inline-block',
            animation: 'pulse-dot 2s ease-in-out infinite',
          }}
        />
        QRYPTO
      </div>

      {/* Nav items */}
      <div style={{ display: 'flex', gap: 0, flex: 1 }}>
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id as Page)}
            data-testid={`nav-${item.id}`}
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.75rem',
              fontWeight: 500,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              padding: '0 16px',
              height: 'var(--nav-height)',
              background: 'transparent',
              color: currentPage === item.id ? 'var(--text-primary)' : '#7a8ba8',
              borderBottom:
                currentPage === item.id ? '2px solid var(--accent)' : '2px solid transparent',
              borderTop: 'none',
              borderLeft: 'none',
              borderRight: 'none',
              cursor: 'pointer',
              transition: 'color 0.15s',
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Logout */}
      <button
        onClick={() => {
          void handleLogout();
        }}
        data-testid="nav-logout"
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.7rem',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          padding: '6px 12px',
          background: 'transparent',
          color: '#7a8ba8',
          border: '1px solid var(--border-default)',
          borderRadius: 3,
          cursor: 'pointer',
          transition: 'all 0.15s',
        }}
        onMouseEnter={(e) => {
          (e.target as HTMLButtonElement).style.color = 'var(--red)';
          (e.target as HTMLButtonElement).style.borderColor = 'var(--red)';
        }}
        onMouseLeave={(e) => {
          (e.target as HTMLButtonElement).style.color = '#7a8ba8';
          (e.target as HTMLButtonElement).style.borderColor = 'var(--border-default)';
        }}
      >
        Logout
      </button>
    </nav>
  );
}
