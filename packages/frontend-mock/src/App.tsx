import { useState, useEffect } from 'react';

import { Nav } from './components/Nav';
import { useAuth } from './lib/auth-context';
import { AccountPage } from './pages/AccountPage';
import { KycPage } from './pages/KycPage';
import { LoginPage } from './pages/LoginPage';
import { TradingPage } from './pages/TradingPage';
import { WalletPage } from './pages/WalletPage';

export type Page = 'login' | 'kyc' | 'wallet' | 'trading' | 'account';

export function App() {
  const { isAuthenticated, scope } = useAuth();
  const [currentPage, setCurrentPage] = useState<Page>('trading');

  // Redirect to login when not authenticated
  useEffect(() => {
    if (!isAuthenticated && currentPage !== 'login') {
      setCurrentPage('login');
    }
  }, [isAuthenticated, currentPage]);

  // Session timeout detection — poll token expiry
  useEffect(() => {
    if (!isAuthenticated) return;

    const check = setInterval(() => {
      // In a real app this would check token expiry from JWT decode.
      // The mock server will return 401 on expired tokens — handled by API client.
    }, 30000);

    return () => clearInterval(check);
  }, [isAuthenticated]);

  const handleLoginSuccess = () => {
    setCurrentPage('trading');
  };

  const handleNavigate = (page: Page) => {
    setCurrentPage(page);
  };

  if (!isAuthenticated || scope === 'pre_2fa') {
    return <LoginPage onSuccess={handleLoginSuccess} />;
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
      <Nav currentPage={currentPage} onNavigate={handleNavigate} />

      <div style={{ paddingTop: 'var(--nav-height)' }}>
        {currentPage === 'kyc' && <KycPage />}
        {currentPage === 'wallet' && <WalletPage />}
        {currentPage === 'trading' && <TradingPage />}
        {currentPage === 'account' && <AccountPage />}
      </div>
    </div>
  );
}
