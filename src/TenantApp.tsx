import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import { loadTenantSession, tenantSignOut, type TenantSession } from './lib/tenantSession';
import TenantLogin from './pages/tenant/TenantLogin';
import TenantActivatePage from './pages/TenantActivate';
import TenantResetPassword from './pages/TenantResetPassword';
import TenantDashboard from './pages/tenant/TenantDashboard';
import TenantProfile from './pages/tenant/TenantProfile';
import TenantContract from './pages/tenant/TenantContract';
import TenantInvoices from './pages/tenant/TenantInvoices';
import TenantMeters from './pages/tenant/TenantMeters';
import TenantRepairs from './pages/tenant/TenantRepairs';
import TenantDocuments from './pages/tenant/TenantDocuments';
import TenantNotifications from './pages/tenant/TenantNotifications';
import TenantLayout from './pages/tenant/TenantLayout';

export default function TenantApp() {
  const [path, setPath] = useState(window.location.pathname);

  useEffect(() => {
    const handlePopState = () => setPath(window.location.pathname);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (to: string) => {
    window.history.pushState({}, '', to);
    setPath(to);
  };

  // undefined — ещё проверяем вход; null — не вошёл
  const [session, setSession] = useState<TenantSession | null | undefined>(undefined);
  useEffect(() => {
    loadTenantSession().then(setSession);
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') setSession(null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);
  const isAuthenticated = !!session;

  const onNavigate = (pageName: string) => {
    if (pageName === 'home') {
      loadTenantSession().then(s => { setSession(s); navigate('/tenant/dashboard'); });
    } else if (pageName === 'login') {
      navigate('/tenant/login');
    } else if (pageName === 'logout') {
      tenantSignOut().then(() => { setSession(null); navigate('/tenant/login'); });
    } else {
      navigate('/tenant/' + pageName);
    }
  };

  if (path.startsWith('/tenant/activate')) {
    return <TenantActivatePage />;
  }

  if (path.startsWith('/tenant/reset-password')) {
    return <TenantResetPassword />;
  }

  if (session === undefined) {
    return <div style={{ minHeight: '100dvh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666', fontFamily: '"Geist", system-ui, sans-serif', fontSize: 14 }}>Загрузка…</div>;
  }

  if (!session || !isAuthenticated) {
    return <TenantLogin onNavigate={onNavigate} />;
  }

  if (path === '/tenant/login') {
    window.history.replaceState({}, '', '/tenant/dashboard');
  }

  let page = 'home';
  if (path === '/tenant' || path === '/tenant/' || path === '/tenant/dashboard') {
    page = 'home';
  } else if (path.startsWith('/tenant/profile')) {
    page = 'profile';
  } else if (path.startsWith('/tenant/contract')) {
    page = 'contract';
  } else if (path.startsWith('/tenant/invoices')) {
    page = 'invoices';
  } else if (path.startsWith('/tenant/meters')) {
    page = 'meters';
  } else if (path.startsWith('/tenant/repairs')) {
    page = 'repairs';
  } else if (path.startsWith('/tenant/documents')) {
    page = 'documents';
  } else if (path.startsWith('/tenant/notifications')) {
    page = 'notifications';
  }

  let content: React.ReactElement;
  if (page === 'home') {
    content = <TenantDashboard tenantId={session.tenantId} onNavigate={onNavigate} />;
  } else if (page === 'profile') {
    content = <TenantProfile tenantId={session.tenantId} />;
  } else if (page === 'contract') {
    content = <TenantContract tenantId={session.tenantId} />;
  } else if (page === 'invoices') {
    content = <TenantInvoices tenantId={session.tenantId} />;
  } else if (page === 'meters') {
    content = <TenantMeters tenantId={session.tenantId} />;
  } else if (page === 'repairs') {
    content = <TenantRepairs tenantId={session.tenantId} />;
  } else if (page === 'documents') {
    content = <TenantDocuments tenantId={session.tenantId} />;
  } else if (page === 'notifications') {
    content = <TenantNotifications tenantId={session.tenantId} />;
  } else {
    content = <TenantDashboard tenantId={session.tenantId} onNavigate={onNavigate} />;
  }

  return (
    <TenantLayout activePage={page} onNavigate={onNavigate}>
      {content}
    </TenantLayout>
  );
}
