import { useState, useEffect } from 'react';
import TenantLogin from './pages/tenant/TenantLogin';
import TenantActivatePage from './pages/TenantActivate';
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

  const sessionRaw = localStorage.getItem('tenant_session');
  const session = sessionRaw ? JSON.parse(sessionRaw) : null;
  const isAuthenticated = session !== null;

  const onNavigate = (pageName: string) => {
    if (pageName === 'home') {
      navigate('/tenant/dashboard');
    } else if (pageName === 'login') {
      navigate('/tenant/login');
    } else if (pageName === 'logout') {
      localStorage.removeItem('tenant_session');
      navigate('/tenant/login');
    } else {
      navigate('/tenant/' + pageName);
    }
  };

  if (path === '/tenant/login' || (!isAuthenticated && !path.startsWith('/tenant/activate'))) {
    return <TenantLogin onNavigate={onNavigate} />;
  }

  if (path.startsWith('/tenant/activate')) {
    return <TenantActivatePage />;
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

  let content: JSX.Element;
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
