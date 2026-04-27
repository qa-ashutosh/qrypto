import { useState, useEffect, useCallback } from 'react';

import { authApi, QryptoApiError } from '../lib/api';
import type { Session } from '../lib/api';
import { useAuth } from '../lib/auth-context';

export function AccountPage() {
  const { token, logout } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revoking, setRevoking] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    if (!token) return;
    try {
      const s = await authApi.getSessions(token);
      setSessions(s);
    } catch (err) {
      setError(err instanceof QryptoApiError ? err.message : 'Failed to load sessions');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void fetchSessions();
  }, [fetchSessions]);

  const handleRevokeSession = async (id: string) => {
    if (!token) return;
    setRevoking(id);
    try {
      await authApi.deleteSession(id, token);
      setSessions((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      setError(err instanceof QryptoApiError ? err.message : 'Failed to revoke session');
    } finally {
      setRevoking(null);
    }
  };

  const handleLogout = async () => {
    if (!token) return;
    try {
      await authApi.logout(token);
    } catch {
      // ignore — still clear local state
    }
    logout();
  };

  const rowStyle = {
    display: 'grid',
    gridTemplateColumns: '1fr 100px 120px 80px',
    gap: 12,
    alignItems: 'center',
    padding: '10px 0',
    borderBottom: '1px solid var(--border-subtle)',
  };

  const headerStyle = {
    fontFamily: 'var(--font-mono)',
    fontSize: '0.62rem',
    color: 'var(--text-muted)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.1em',
  };

  return (
    <div className="page animate-in">
      <div className="page-title">Account</div>

      <div style={{ maxWidth: 800, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Profile */}
        <div className="card">
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
            Profile
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 10 }}>
            {[
              ['Environment', 'QA Test Surface'],
              ['Mock Server', 'http://localhost:8080'],
              ['Auth Status', token ? 'Authenticated' : 'Not authenticated'],
              ['Token', token ? `${token.slice(0, 24)}...` : '—'],
            ].map(([label, value]) => (
              <div key={label} style={{ display: 'contents' }}>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.7rem',
                    color: 'var(--text-muted)',
                  }}
                >
                  {label}
                </span>
                <span
                  data-testid={`profile-${label?.toLowerCase().replace(' ', '-')}`}
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.7rem',
                    color: 'var(--text-secondary)',
                    wordBreak: 'break-all',
                  }}
                >
                  {value}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Active Sessions */}
        <div className="card">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 16,
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.65rem',
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
              }}
            >
              Active Sessions
            </div>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.65rem',
                color: 'var(--text-muted)',
              }}
            >
              {sessions.length} session{sessions.length !== 1 ? 's' : ''}
            </span>
          </div>

          {error && (
            <div
              data-testid="sessions-error"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.75rem',
                color: 'var(--red)',
                padding: '7px 10px',
                background: 'var(--red-dim)',
                borderRadius: 2,
                marginBottom: 12,
              }}
            >
              {error}
            </div>
          )}

          {/* Header row */}
          <div style={{ ...rowStyle, borderBottom: '1px solid var(--border-default)' }}>
            <span style={headerStyle}>IP Address</span>
            <span style={headerStyle}>Scope</span>
            <span style={headerStyle}>Expires</span>
            <span style={headerStyle}>Action</span>
          </div>

          {loading ? (
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
                padding: '12px 0',
              }}
            >
              Loading sessions...
            </div>
          ) : sessions.length === 0 ? (
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
                padding: '12px 0',
              }}
            >
              No active sessions
            </div>
          ) : (
            sessions.map((session) => (
              <div key={session.id} data-testid={`session-row-${session.id}`} style={rowStyle}>
                <div>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.75rem',
                      color: 'var(--text-primary)',
                    }}
                  >
                    {session.ipAddress}
                  </span>
                  {session.isCurrent && (
                    <span className="tag tag-green" style={{ marginLeft: 8 }}>
                      Current
                    </span>
                  )}
                </div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem' }}>
                  <span className={`tag ${session.scope === 'full' ? 'tag-blue' : 'tag-yellow'}`}>
                    {session.scope}
                  </span>
                </span>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.7rem',
                    color: 'var(--text-secondary)',
                  }}
                >
                  {new Date(session.expiresAt).toLocaleTimeString()}
                </span>
                {!session.isCurrent && (
                  <button
                    onClick={() => void handleRevokeSession(session.id)}
                    disabled={revoking === session.id}
                    data-testid={`revoke-${session.id}`}
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.65rem',
                      padding: '4px 8px',
                      background: 'transparent',
                      border: '1px solid var(--border-default)',
                      borderRadius: 2,
                      color: revoking === session.id ? 'var(--text-muted)' : 'var(--red)',
                      cursor: revoking === session.id ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {revoking === session.id ? '...' : 'Revoke'}
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        {/* Security */}
        <div className="card">
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
            Security
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px 0',
                borderBottom: '1px solid var(--border-subtle)',
              }}
            >
              <div>
                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.75rem',
                    color: 'var(--text-primary)',
                  }}
                >
                  Two-Factor Authentication
                </div>
                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.68rem',
                    color: 'var(--text-muted)',
                    marginTop: 2,
                  }}
                >
                  Test code: <span style={{ color: 'var(--accent)' }}>123456</span>
                </div>
              </div>
              <span className="tag tag-green" data-testid="2fa-status">
                Enabled
              </span>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px 0',
                borderBottom: '1px solid var(--border-subtle)',
              }}
            >
              <div>
                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.75rem',
                    color: 'var(--text-primary)',
                  }}
                >
                  Password
                </div>
                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.68rem',
                    color: 'var(--text-muted)',
                    marginTop: 2,
                  }}
                >
                  Test password: <span style={{ color: 'var(--accent)' }}>TestPassword123!</span>
                </div>
              </div>
              <span className="tag tag-muted">Mock — read-only</span>
            </div>
          </div>
        </div>

        {/* Danger zone */}
        <div className="card" style={{ borderColor: 'rgba(255,77,106,0.2)' }}>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.65rem',
              color: 'var(--red)',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              marginBottom: 16,
            }}
          >
            Session
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.75rem',
                  color: 'var(--text-primary)',
                }}
              >
                Sign Out
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.68rem',
                  color: 'var(--text-muted)',
                  marginTop: 2,
                }}
              >
                Revokes the current access token
              </div>
            </div>
            <button
              onClick={() => void handleLogout()}
              data-testid="logout-btn"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.75rem',
                fontWeight: 500,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                padding: '8px 16px',
                background: 'transparent',
                border: '1px solid var(--red)',
                borderRadius: 3,
                color: 'var(--red)',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
