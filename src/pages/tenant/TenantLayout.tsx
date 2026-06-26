import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

interface TenantLayoutProps {
  children: React.ReactNode
  activePage: string
  onNavigate: (p: string) => void
}

const NAV_ITEMS = [
  { key: 'home',          label: 'Главная',      icon: '🏠' },
  { key: 'invoices',      label: 'Счета',         icon: '💳' },
  { key: 'contract',      label: 'Договор',       icon: '📋' },
  { key: 'meters',        label: 'Счётчики',      icon: '📊' },
  { key: 'repairs',       label: 'Заявки',        icon: '🔧' },
  { key: 'documents',     label: 'Документы',     icon: '📁' },
  { key: 'notifications', label: 'Уведомления',   icon: '🔔' },
  { key: 'profile',       label: 'Мои данные',    icon: '👤' },
]

const MOBILE_BOTTOM = [
  { key: 'home',     label: 'Главная',  icon: '🏠' },
  { key: 'invoices', label: 'Счета',    icon: '💳' },
  { key: 'repairs',  label: 'Заявки',   icon: '🔧' },
  { key: 'meters',   label: 'Счётчики', icon: '📊' },
]

const PAGE_TITLES: Record<string, string> = {
  home: 'Главная', invoices: 'Счета', contract: 'Договор',
  meters: 'Счётчики', repairs: 'Заявки', documents: 'Документы',
  notifications: 'Уведомления', profile: 'Мои данные',
}

function getSession() {
  try { return JSON.parse(localStorage.getItem('tenant_session') || 'null') } catch { return null }
}

function initials(email: string) {
  const parts = email.split('@')[0].split(/[._-]/)
  return parts.slice(0, 2).map(p => p[0]?.toUpperCase() ?? '').join('') || email[0]?.toUpperCase() || '?'
}

export default function TenantLayout({ children, activePage, onNavigate }: TenantLayoutProps) {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [hasDebt, setHasDebt] = useState(false)
  const [tenantName, setTenantName] = useState('')
  const [unitNumber, setUnitNumber] = useState('')

  const session = getSession()
  const email = session?.email ?? ''
  const tenantId = session?.tenantId

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  useEffect(() => {
    if (!tenantId) return
    supabase.from('tenant_notifications').select('id', { count: 'exact' })
      .eq('tenant_id', tenantId).eq('is_read', false)
      .then(({ count }) => setUnreadCount(count ?? 0))

    supabase.from('invoices').select('total_amount')
      .eq('tenant_id', tenantId).in('status', ['SENT', 'sent', 'OVERDUE', 'overdue'])
      .then(({ data }) => setHasDebt((data?.length ?? 0) > 0))

    supabase.from('tenants').select('full_name').eq('id', tenantId).single()
      .then(({ data }) => setTenantName(data?.full_name ?? ''))

    supabase.from('units').select('number').eq('tenant_id', tenantId).limit(1).single()
      .then(({ data }) => setUnitNumber(data?.number ? `Офис №${data.number}` : ''))
  }, [tenantId])

  function logout() {
    localStorage.removeItem('tenant_session')
    window.location.href = '/tenant/login'
  }

  const ava = initials(email)

  // ─── DESKTOP ─────────────────────────────────────────────────────────────
  if (!isMobile) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', fontFamily: '-apple-system,BlinkMacSystemFont,"Inter",sans-serif' }}>
        {/* Sidebar */}
        <aside style={{
          width: 260, flexShrink: 0, background: '#fff', borderRight: '1px solid #e5e7eb',
          display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 50,
        }}>
          {/* Logo */}
          <div style={{ padding: '24px 20px 16px' }}>
            <img src="https://mayak-d.ru/pics/logo.png" alt="Маяк" style={{ maxHeight: 44, display: 'block', marginBottom: 10 }} />
            <div style={{ fontSize: 12, color: '#9ca3af', fontWeight: 500, letterSpacing: '.5px', textTransform: 'uppercase' }}>
              Портал арендатора
            </div>
          </div>
          <div style={{ height: 1, background: '#e5e7eb', margin: '0 20px 12px' }} />

          {/* Nav */}
          <nav style={{ flex: 1, padding: '0 12px', overflowY: 'auto' }}>
            {NAV_ITEMS.map(item => {
              const active = activePage === item.key
              const badge = item.key === 'notifications' && unreadCount > 0
                ? unreadCount : item.key === 'invoices' && hasDebt ? '!' : null
              return (
                <button
                  key={item.key}
                  onClick={() => onNavigate(item.key)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                    padding: '10px 12px', marginBottom: 2, border: 'none', borderRadius: 8,
                    background: active ? '#111' : 'transparent',
                    color: active ? '#fff' : '#6b7280',
                    fontSize: 14, fontWeight: active ? 600 : 400,
                    cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                    transition: 'background .15s, color .15s',
                  }}
                  onMouseEnter={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = '#f3f4f6' }}
                  onMouseLeave={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
                >
                  <span style={{ fontSize: 16, width: 20, textAlign: 'center' }}>{item.icon}</span>
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {badge !== null && (
                    <span style={{
                      minWidth: 18, height: 18, borderRadius: 9, background: '#ef4444',
                      color: '#fff', fontSize: 11, fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px',
                    }}>{badge}</span>
                  )}
                </button>
              )
            })}
          </nav>

          {/* Profile card */}
          <div style={{ borderTop: '1px solid #e5e7eb', padding: '16px 16px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%', background: '#111',
                color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 700, flexShrink: 0,
              }}>{ava}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {tenantName || email}
                </div>
                {unitNumber && (
                  <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 1 }}>{unitNumber}</div>
                )}
              </div>
            </div>
            <button
              onClick={logout}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '8px 10px',
                border: '1px solid #e5e7eb', borderRadius: 7, background: '#fff',
                color: '#6b7280', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                transition: 'color .15s, border-color .15s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#ef4444'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#fecaca' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#6b7280'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#e5e7eb' }}
            >
              <span>🚪</span> Выйти
            </button>
          </div>
        </aside>

        {/* Main */}
        <div style={{ flex: 1, marginLeft: 260, display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#f9fafb' }}>
          <main style={{ flex: 1, padding: 32 }}>
            {children}
          </main>
          <footer style={{ borderTop: '1px solid #e5e7eb', padding: '18px 32px', background: '#fff' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, fontSize: 12, color: '#9ca3af' }}>
              <div>© 2026 БЦ «Маяк». Все права защищены.</div>
              <div style={{ textAlign: 'center' }}>г. Дмитров, Московская область, мкр. Владимира Махалина, д. 20</div>
              <div style={{ textAlign: 'right' }}>+7 (916) 763-02-07 | +7 (496) 227-00-44</div>
            </div>
          </footer>
        </div>
      </div>
    )
  }

  // ─── MOBILE ──────────────────────────────────────────────────────────────
  const drawerItems = [
    { key: 'contract',      label: 'Договор',     icon: '📋' },
    { key: 'documents',     label: 'Документы',   icon: '📁' },
    { key: 'notifications', label: 'Уведомления', icon: '🔔' },
    { key: 'profile',       label: 'Мои данные',  icon: '👤' },
  ]

  return (
    <div style={{ fontFamily: '-apple-system,BlinkMacSystemFont,"Inter",sans-serif', background: '#fff', minHeight: '100vh', paddingTop: 56, paddingBottom: 64 }}>
      {/* Top bar */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: 56, zIndex: 100,
        background: '#fff', borderBottom: '1px solid #e5e7eb',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px',
      }}>
        <img src="https://mayak-d.ru/pics/logo.png" alt="Маяк" style={{ height: 28, display: 'block' }} />
        <div style={{ fontSize: 15, fontWeight: 600, color: '#111' }}>{PAGE_TITLES[activePage] ?? 'Маяк'}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => onNavigate('notifications')} style={{ position: 'relative', border: 'none', background: 'none', cursor: 'pointer', padding: 4, fontSize: 20 }}>
            🔔
            {unreadCount > 0 && (
              <span style={{
                position: 'absolute', top: 0, right: 0, minWidth: 16, height: 16, borderRadius: 8,
                background: '#ef4444', color: '#fff', fontSize: 10, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px',
              }}>{unreadCount}</span>
            )}
          </button>
          <button onClick={() => setDrawerOpen(true)} style={{
            width: 32, height: 32, borderRadius: '50%', background: '#111',
            color: '#fff', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700,
          }}>{ava}</button>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: 16, background: '#fff', minHeight: 'calc(100vh - 120px)' }}>
        {children}
      </div>

      {/* Bottom nav */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, height: 64, zIndex: 100,
        background: '#fff', borderTop: '1px solid #e5e7eb', boxShadow: '0 -2px 10px rgba(0,0,0,0.08)',
        display: 'flex', alignItems: 'stretch',
      }}>
        {MOBILE_BOTTOM.map(item => {
          const active = activePage === item.key
          return (
            <button key={item.key} onClick={() => onNavigate(item.key)} style={{
              flex: 1, border: 'none', background: 'none', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
              color: active ? '#111' : '#9ca3af', fontFamily: 'inherit',
            }}>
              <span style={{ fontSize: 22 }}>{item.icon}</span>
              <span style={{ fontSize: 10 }}>{item.label}</span>
            </button>
          )
        })}
        {/* Ещё */}
        <button onClick={() => setDrawerOpen(true)} style={{
          flex: 1, border: 'none', background: 'none', cursor: 'pointer',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
          color: '#9ca3af', fontFamily: 'inherit',
        }}>
          <span style={{ fontSize: 22 }}>≡</span>
          <span style={{ fontSize: 10 }}>Ещё</span>
        </button>
      </div>

      {/* Drawer overlay */}
      {drawerOpen && (
        <div
          onClick={() => setDrawerOpen(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200,
            transition: 'opacity .2s',
          }}
        />
      )}

      {/* Drawer */}
      <div style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 201,
        background: '#fff', borderRadius: '16px 16px 0 0',
        padding: '20px 0 32px',
        transform: drawerOpen ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform .3s ease',
      }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: '#e5e7eb', margin: '0 auto 20px' }} />

        {/* Profile row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 20px 16px', borderBottom: '1px solid #f3f4f6' }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#111', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700 }}>{ava}</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#111' }}>{tenantName || email}</div>
            {unitNumber && <div style={{ fontSize: 12, color: '#9ca3af' }}>{unitNumber}</div>}
          </div>
        </div>

        {drawerItems.map(item => {
          const badge = item.key === 'notifications' && unreadCount > 0 ? unreadCount : null
          return (
            <button key={item.key} onClick={() => { onNavigate(item.key); setDrawerOpen(false) }} style={{
              display: 'flex', alignItems: 'center', gap: 14, width: '100%', padding: '14px 20px',
              border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 15, color: '#111', textAlign: 'left',
            }}>
              <span style={{ fontSize: 20, width: 24, textAlign: 'center' }}>{item.icon}</span>
              <span style={{ flex: 1 }}>{item.label}</span>
              {badge !== null && (
                <span style={{ minWidth: 20, height: 20, borderRadius: 10, background: '#ef4444', color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px' }}>{badge}</span>
              )}
            </button>
          )
        })}

        <div style={{ height: 1, background: '#f3f4f6', margin: '8px 0' }} />
        <button onClick={logout} style={{
          display: 'flex', alignItems: 'center', gap: 14, width: '100%', padding: '14px 20px',
          border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit',
          fontSize: 15, color: '#ef4444', textAlign: 'left',
        }}>
          <span style={{ fontSize: 20, width: 24, textAlign: 'center' }}>🚪</span>
          Выйти
        </button>
      </div>
    </div>
  )
}
