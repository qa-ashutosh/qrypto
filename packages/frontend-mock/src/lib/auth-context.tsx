import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface AuthState {
  token: string | null;
  preToken: string | null;
  sessionId: string | null;
  scope: 'pre_2fa' | 'full' | null;
}

interface AuthContextValue extends AuthState {
  setPreAuth: (token: string, sessionId: string) => void;
  setFullAuth: (token: string) => void;
  clearAuth: () => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    token: null,
    preToken: null,
    sessionId: null,
    scope: null,
  });

  const setPreAuth = useCallback((token: string, sessionId: string) => {
    setState({ token, preToken: token, sessionId, scope: 'pre_2fa' });
  }, []);

  const setFullAuth = useCallback((token: string) => {
    setState((prev) => ({ ...prev, token, scope: 'full' }));
  }, []);

  const clearAuth = useCallback(() => {
    setState({ token: null, preToken: null, sessionId: null, scope: null });
  }, []);

  return (
    <AuthContext.Provider
      value={{
        ...state,
        setPreAuth,
        setFullAuth,
        clearAuth,
        logout: clearAuth,
        isAuthenticated: state.scope === 'full',
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
