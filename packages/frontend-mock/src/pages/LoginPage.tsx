import { useState, type FormEvent } from 'react';

import { authApi, QryptoApiError } from '../lib/api';
import { useAuth } from '../lib/auth-context';

interface LoginPageProps {
  onSuccess: () => void;
}

export function LoginPage({ onSuccess }: LoginPageProps) {
  const { setPreAuth, setFullAuth, sessionId } = useAuth();
  const [step, setStep] = useState<'credentials' | 'twofa'>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { token } = useAuth();

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await authApi.login(email, password);
      if (res.requiresTwoFactor) {
        setPreAuth(res.accessToken, res.sessionId);
        setStep('twofa');
      } else {
        setFullAuth(res.accessToken);
        onSuccess();
      }
    } catch (err) {
      if (err instanceof QryptoApiError) {
        if (err.code === 'ACCOUNT_LOCKED') {
          const secs = err.details['retryAfterSeconds'] as number;
          setError(`Account locked. Try again in ${Math.ceil(secs / 60)} minutes.`);
        } else {
          setError(err.message);
        }
      } else {
        setError('Connection failed — is the mock server running on port 8080?');
      }
    } finally {
      setLoading(false);
    }
  };

  const handle2fa = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await authApi.verify2fa(sessionId ?? '', code, token ?? '');
      setFullAuth(res.accessToken);
      onSuccess();
    } catch (err) {
      setError(err instanceof QryptoApiError ? err.message : 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const btnStyle = {
    fontFamily: 'var(--font-mono)',
    fontSize: '0.8rem',
    fontWeight: 500,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.1em',
    padding: '10px 24px',
    background: loading ? 'var(--bg-overlay)' : 'var(--accent)',
    color: loading ? 'var(--text-muted)' : 'var(--text-inverse)',
    border: 'none',
    borderRadius: 3,
    cursor: loading ? 'not-allowed' : 'pointer',
    width: '100%',
    transition: 'background 0.15s',
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-base)',
        padding: 24,
      }}
    >
      {/* Background grid */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          pointerEvents: 'none',
          backgroundImage:
            'linear-gradient(var(--border-subtle) 1px, transparent 1px), linear-gradient(90deg, var(--border-subtle) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
          opacity: 0.4,
        }}
      />

      <div
        className="animate-in"
        style={{
          width: '100%',
          maxWidth: 380,
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '1.5rem',
              fontWeight: 600,
              color: 'var(--accent)',
              letterSpacing: '0.15em',
              marginBottom: 4,
            }}
          >
            QRYPTO
          </div>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.7rem',
              color: 'var(--text-muted)',
              letterSpacing: '0.1em',
            }}
          >
            QA TEST SURFACE — MOCK EXCHANGE
          </div>
        </div>

        {/* Card */}
        <div
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-default)',
            borderRadius: 4,
            padding: 28,
          }}
        >
          {step === 'credentials' ? (
            <>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.7rem',
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  marginBottom: 20,
                }}
              >
                Sign In
              </div>
              <form
                onSubmit={(e) => {
                  void handleLogin(e);
                }}
                style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
              >
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.65rem',
                      color: 'var(--text-muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.1em',
                      marginBottom: 6,
                    }}
                  >
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="user@qrypto-test.invalid"
                    required
                    data-testid="login-email"
                    style={{ width: '100%' }}
                    autoComplete="username"
                  />
                </div>
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.65rem',
                      color: 'var(--text-muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.1em',
                      marginBottom: 6,
                    }}
                  >
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    required
                    data-testid="login-password"
                    style={{ width: '100%' }}
                    autoComplete="current-password"
                  />
                </div>
                {error && (
                  <div
                    data-testid="login-error"
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.75rem',
                      color: 'var(--red)',
                      padding: '8px 12px',
                      background: 'var(--red-dim)',
                      borderRadius: 3,
                      border: '1px solid rgba(255,77,106,0.2)',
                    }}
                  >
                    {error}
                  </div>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  style={btnStyle}
                  data-testid="login-submit"
                >
                  {loading ? 'Authenticating...' : 'Sign In'}
                </button>
              </form>

              {/* Seed user hints */}
              <div
                style={{
                  marginTop: 20,
                  paddingTop: 16,
                  borderTop: '1px solid var(--border-subtle)',
                }}
              >
                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.65rem',
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    marginBottom: 8,
                  }}
                >
                  Quick fill — seed users
                </div>
                {[
                  { label: 'Verified + 2FA', email: 'verified@qrypto-test.invalid' },
                  { label: 'Unverified', email: 'unverified@qrypto-test.invalid' },
                  { label: 'Zero Balance', email: 'zero-balance@qrypto-test.invalid' },
                ].map((u) => (
                  <button
                    key={u.email}
                    type="button"
                    onClick={() => {
                      setEmail(u.email);
                      setPassword('TestPassword123!');
                    }}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      padding: '5px 8px',
                      marginBottom: 3,
                      background: 'transparent',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 2,
                      color: 'var(--text-secondary)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.7rem',
                      cursor: 'pointer',
                      transition: 'all 0.1s',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--accent)';
                      (e.currentTarget as HTMLButtonElement).style.color = 'var(--accent)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.borderColor =
                        'var(--border-subtle)';
                      (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)';
                    }}
                  >
                    <span style={{ color: 'var(--text-muted)' }}>{u.label} → </span>
                    {u.email}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.7rem',
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  marginBottom: 4,
                }}
              >
                Two-Factor Authentication
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.75rem',
                  color: 'var(--text-secondary)',
                  marginBottom: 20,
                }}
              >
                Enter your 6-digit code to continue.
              </div>
              <form
                onSubmit={(e) => {
                  void handle2fa(e);
                }}
                style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
              >
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  required
                  data-testid="2fa-code"
                  style={{
                    width: '100%',
                    textAlign: 'center',
                    fontSize: '1.5rem',
                    letterSpacing: '0.3em',
                  }}
                  autoFocus
                />
                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.65rem',
                    color: 'var(--text-muted)',
                    textAlign: 'center',
                  }}
                >
                  Mock code: <span style={{ color: 'var(--accent)' }}>123456</span>
                </div>
                {error && (
                  <div
                    data-testid="2fa-error"
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.75rem',
                      color: 'var(--red)',
                      padding: '8px 12px',
                      background: 'var(--red-dim)',
                      borderRadius: 3,
                    }}
                  >
                    {error}
                  </div>
                )}
                <button type="submit" disabled={loading} style={btnStyle} data-testid="2fa-submit">
                  {loading ? 'Verifying...' : 'Verify'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStep('credentials');
                    setError('');
                    setCode('');
                  }}
                  style={{
                    ...btnStyle,
                    background: 'transparent',
                    color: 'var(--text-muted)',
                    border: '1px solid var(--border-default)',
                  }}
                >
                  Back
                </button>
              </form>
            </>
          )}
        </div>

        <div
          style={{
            textAlign: 'center',
            marginTop: 16,
            fontFamily: 'var(--font-mono)',
            fontSize: '0.65rem',
            color: 'var(--text-muted)',
          }}
        >
          Password: <span style={{ color: 'var(--text-secondary)' }}>TestPassword123!</span>
        </div>
      </div>
    </div>
  );
}
