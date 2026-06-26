import React from 'react';

interface TenantLayoutProps {
  children: React.ReactNode;
  activePage: string;
  onNavigate: (p: string) => void;
}

const NAV_TABS = [
  { key: 'home', label: 'Главная', emoji: '🏠' },
  { key: 'profile', label: 'Мои данные', emoji: '📄' },
  { key: 'contract', label: 'Договор', emoji: '📋' },
  { key: 'invoices', label: 'Счета', emoji: '💳' },
  { key: 'meters', label: 'Счётчики', emoji: '📊' },
  { key: 'repairs', label: 'Заявки', emoji: '🔧' },
  { key: 'documents', label: 'Документы', emoji: '📁' },
  { key: 'notifications', label: 'Уведомления', emoji: '🔔' },
];

function getEmail(): string {
  try {
    const raw = localStorage.getItem('tenant_session');
    if (!raw) return '';
    const parsed = JSON.parse(raw);
    return parsed?.email ?? '';
  } catch {
    return '';
  }
}

function handleLogout() {
  localStorage.clear();
  window.location.href = '/tenant/login';
}

export default function TenantLayout({ children, activePage, onNavigate }: TenantLayoutProps) {
  const email = getEmail();

  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", sans-serif', background: '#fff', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', height: 64, borderBottom: '1px solid #e5e7eb', background: '#fff' }}>
        {/* Left: logo + name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img src="https://mayak-d.ru/pics/logo.png" alt="Маяк" style={{ maxHeight: 40, display: 'block' }} />
          <span style={{ fontWeight: 700, fontSize: 18, color: '#111' }}>БЦ Маяк</span>
        </div>

        {/* Right: email + logout */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {email && (
            <span style={{ fontSize: 14, color: '#374151' }}>{email}</span>
          )}
          <button
            onClick={handleLogout}
            style={{
              fontSize: 14,
              padding: '6px 14px',
              border: '1px solid #d1d5db',
              borderRadius: 6,
              background: '#fff',
              color: '#374151',
              cursor: 'pointer',
            }}
          >
            Выйти
          </button>
        </div>
      </div>

      {/* Horizontal nav */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0 24px', borderBottom: '1px solid #e5e7eb', background: '#fff', overflowX: 'auto' }}>
        {NAV_TABS.map((tab) => {
          const isActive = activePage === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => onNavigate(tab.key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '10px 14px',
                margin: '6px 0',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 14,
                fontFamily: 'inherit',
                whiteSpace: 'nowrap',
                background: isActive ? '#111' : 'transparent',
                color: isActive ? '#fff' : '#6b7280',
                fontWeight: isActive ? 600 : 400,
                transition: 'background 0.15s, color 0.15s',
              }}
            >
              <span>{tab.emoji}</span>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 16px' }}>
        {children}
      </div>
    </div>
  );
}
