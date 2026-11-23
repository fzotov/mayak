import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

interface TenantLayoutProps {
  children: React.ReactNode
  activePage: string
  onNavigate: (p: string) => void
}

const Icons = {
  home: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M1 6.5L8 1l7 5.5V15H10v-4H6v4H1V6.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="none"/>
    </svg>
  ),
  invoices: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="1" width="12" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M5 5h6M5 8h6M5 11h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  contract: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M9 1H3a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V6L9 1z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M9 1v5h5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
    </svg>
  ),
  meters: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M8 4.5v3.5l2.5 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  repairs: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M10.5 1.5a3 3 0 0 1 0 4.243L4.743 11.5a1.5 1.5 0 1 1-2.121-2.121L8.38 3.621A3 3 0 0 1 10.5 1.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M13 11l-2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  documents: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1.5" y="1.5" width="13" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M4.5 5.5h7M4.5 8h7M4.5 10.5h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  notifications: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M8 1.5a5 5 0 0 1 5 5v3l1 2H2l1-2v-3a5 5 0 0 1 5-5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M6.5 12a1.5 1.5 0 0 0 3 0" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  ),
  profile: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="5.5" r="3" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M2 14c0-3.314 2.686-5 6-5s6 1.686 6 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  logout: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M6 2H3a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M10 11l3-3-3-3M13 8H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  menu: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  bell: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M10 2a6 6 0 0 1 6 6v3.5l1.5 2.5h-15L4 11.5V8a6 6 0 0 1 6-6z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M8 16a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  ),
}

const NAV_ITEMS = [
  { key: 'home',          label: 'Главная',      icon: 'home' },
  { key: 'invoices',      label: 'Счета',         icon: 'invoices' },
  { key: 'contract',      label: 'Договор',       icon: 'contract' },
  { key: 'meters',        label: 'Счётчики',      icon: 'meters' },
  { key: 'repairs',       label: 'Заявки',        icon: 'repairs' },
  { key: 'documents',     label: 'Документы',     icon: 'documents' },
  { key: 'notifications', label: 'Уведомления',   icon: 'notifications' },
  { key: 'profile',       label: 'Мои данные',    icon: 'profile' },
] as const

const MOBILE_BOTTOM = [
  { key: 'home',     label: 'Главная',  icon: 'home' },
  { key: 'invoices', label: 'Счета',    icon: 'invoices' },
  { key: 'repairs',  label: 'Заявки',   icon: 'repairs' },
  { key: 'meters',   label: 'Счётчики', icon: 'meters' },
] as const

const PAGE_TITLES: Record<string, string> = {
  home: 'Главная', invoices: 'Счета', contract: 'Договор',
  meters: 'Счётчики', repairs: 'Заявки', documents: 'Документы',
  notifications: 'Уведомления', profile: 'Мои данные',
}

const C = {
  bg: '#0a0a0a',
  surface: '#111',
  border: '#1f1f1f',
  borderSubtle: '#1a1a1a',
  text: '#ededed',
  muted: '#666',
  mutedMid: '#888',
  accent: '#fff',
  danger: '#ff4444',
  font: '"Geist", system-ui, -apple-system, sans-serif',
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
    onNavigate('logout')
  }

  const ava = initials(email)

  // ─── DESKTOP ─────────────────────────────────────────────────────────────
  if (!isMobile) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', fontFamily: C.font, background: C.bg, color: C.text }}>
        {/* Sidebar */}
        <aside style={{
          width: 240, flexShrink: 0, background: C.bg, borderRight: `1px solid ${C.border}`,
          display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 50,
        }}>
          {/* Logo */}
          <div style={{ padding: '20px 16px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <img src="/mayak-logo.png" alt="Маяк" style={{ height: 40, display: 'block', borderRadius: 6 }} />
            </div>
            <div style={{ fontSize: 11, color: C.muted, fontWeight: 500, letterSpacing: '.5px', textTransform: 'uppercase', marginTop: 8 }}>
              Портал арендатора
            </div>
          </div>
          <div style={{ height: 1, background: C.border, margin: '0 16px 8px' }} />

          {/* Nav */}
          <nav style={{ flex: 1, padding: '0 8px', overflowY: 'auto' }}>
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
                    padding: '8px 10px', marginBottom: 1, border: 'none', borderRadius: 6,
                    background: active ? C.surface : 'transparent',
                    color: active ? C.accent : C.mutedMid,
                    fontSize: 13, fontWeight: active ? 500 : 400,
                    cursor: 'pointer', fontFamily: C.font, textAlign: 'left',
                    transition: 'background .1s, color .1s',
                  }}
                  onMouseEnter={e => { if (!active) { const b = e.currentTarget as HTMLButtonElement; b.style.background = C.surface; b.style.color = C.text } }}
                  onMouseLeave={e => { if (!active) { const b = e.currentTarget as HTMLButtonElement; b.style.background = 'transparent'; b.style.color = C.mutedMid } }}
                >
                  <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>{Icons[item.icon as keyof typeof Icons]}</span>
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {badge !== null && (
                    <span style={{
                      minWidth: 16, height: 16, borderRadius: 8, background: '#ef4444',
                      color: '#fff', fontSize: 10, fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px',
                    }}>{badge}</span>
                  )}
                </button>
              )
            })}
          </nav>

          {/* Profile card */}
          <div style={{ borderTop: `1px solid ${C.border}`, padding: '12px 12px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%', background: '#333',
                color: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 600, flexShrink: 0,
              }}>{ava}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {tenantName || email}
                </div>
                {unitNumber && (
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>{unitNumber}</div>
                )}
              </div>
            </div>
            <button
              onClick={logout}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '7px 10px',
                border: `1px solid ${C.border}`, borderRadius: 6, background: 'transparent',
                color: C.muted, fontSize: 12, cursor: 'pointer', fontFamily: C.font,
                transition: 'color .1s, border-color .1s',
              }}
              onMouseEnter={e => { const b = e.currentTarget as HTMLButtonElement; b.style.color = C.danger; b.style.borderColor = C.danger }}
              onMouseLeave={e => { const b = e.currentTarget as HTMLButtonElement; b.style.color = C.muted; b.style.borderColor = C.border }}
            >
              {Icons.logout} Выйти
            </button>
          </div>
        </aside>

        {/* Main */}
        <div style={{ flex: 1, marginLeft: 240, display: 'flex', flexDirection: 'column', minHeight: '100vh', background: C.bg }}>
          <main style={{ flex: 1, padding: 32 }}>
            {children}
          </main>
          <footer style={{ borderTop: `1px solid ${C.border}`, padding: '16px 32px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, fontSize: 11, color: C.muted }}>
              <div>© 2026 БЦ «Маяк»</div>
              <div style={{ textAlign: 'center' }}>г. Дмитров, мкр. Владимира Махалина, д. 20</div>
              <div style={{ textAlign: 'right' }}>+7 (916) 763-02-07</div>
            </div>
          </footer>
        </div>
      </div>
    )
  }

  // ─── MOBILE ──────────────────────────────────────────────────────────────
  const drawerItems = [
    { key: 'contract',      label: 'Договор',     icon: 'contract' },
    { key: 'documents',     label: 'Документы',   icon: 'documents' },
    { key: 'notifications', label: 'Уведомления', icon: 'notifications' },
    { key: 'profile',       label: 'Мои данные',  icon: 'profile' },
  ] as const

  return (
    <div style={{ fontFamily: C.font, background: C.bg, color: C.text, minHeight: '100vh', paddingTop: 52, paddingBottom: 60 }}>
      {/* Top bar */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: 52, zIndex: 100,
        background: C.bg, borderBottom: `1px solid ${C.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px',
      }}>
        <img src="/mayak-logo.png" alt="Маяк" style={{ height: 32, display: 'block', borderRadius: 4 }} />
        <div style={{ fontSize: 14, fontWeight: 500, color: C.text }}>{PAGE_TITLES[activePage] ?? 'Маяк'}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => onNavigate('notifications')} style={{ position: 'relative', border: 'none', background: 'none', cursor: 'pointer', padding: 4, color: C.mutedMid, display: 'flex' }}>
            {Icons.bell}
            {unreadCount > 0 && (
              <span style={{
                position: 'absolute', top: 0, right: 0, minWidth: 14, height: 14, borderRadius: 7,
                background: '#ef4444', color: '#fff', fontSize: 9, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px',
              }}>{unreadCount}</span>
            )}
          </button>
          <button onClick={() => setDrawerOpen(true)} style={{
            width: 30, height: 30, borderRadius: '50%', background: '#333',
            color: C.accent, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600,
          }}>{ava}</button>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: 16, minHeight: 'calc(100vh - 112px)' }}>
        {children}
      </div>

      {/* Bottom nav */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, height: 60, zIndex: 100,
        background: C.bg, borderTop: `1px solid ${C.border}`,
        display: 'flex', alignItems: 'stretch',
      }}>
        {MOBILE_BOTTOM.map(item => {
          const active = activePage === item.key
          return (
            <button key={item.key} onClick={() => onNavigate(item.key)} style={{
              flex: 1, border: 'none', background: 'none', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
              color: active ? C.accent : C.muted, fontFamily: C.font,
            }}>
              {Icons[item.icon as keyof typeof Icons]}
              <span style={{ fontSize: 10 }}>{item.label}</span>
            </button>
          )
        })}
        <button onClick={() => setDrawerOpen(true)} style={{
          flex: 1, border: 'none', background: 'none', cursor: 'pointer',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
          color: C.muted, fontFamily: C.font,
        }}>
          {Icons.menu}
          <span style={{ fontSize: 10 }}>Ещё</span>
        </button>
      </div>

      {/* Drawer overlay */}
      {drawerOpen && (
        <div
          onClick={() => setDrawerOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200 }}
        />
      )}

      {/* Drawer */}
      <div style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 201,
        background: C.surface, borderRadius: '12px 12px 0 0', borderTop: `1px solid ${C.border}`,
        padding: '16px 0 32px',
        transform: drawerOpen ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform .25s ease',
      }}>
        <div style={{ width: 32, height: 3, borderRadius: 2, background: C.border, margin: '0 auto 16px' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px 14px', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#333', color: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600 }}>{ava}</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 500, color: C.text }}>{tenantName || email}</div>
            {unitNumber && <div style={{ fontSize: 12, color: C.muted }}>{unitNumber}</div>}
          </div>
        </div>

        {drawerItems.map(item => {
          const badge = item.key === 'notifications' && unreadCount > 0 ? unreadCount : null
          return (
            <button key={item.key} onClick={() => { onNavigate(item.key); setDrawerOpen(false) }} style={{
              display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '13px 16px',
              border: 'none', background: 'none', cursor: 'pointer', fontFamily: C.font,
              fontSize: 14, color: C.text, textAlign: 'left',
            }}>
              <span style={{ color: C.mutedMid, display: 'flex' }}>{Icons[item.icon as keyof typeof Icons]}</span>
              <span style={{ flex: 1 }}>{item.label}</span>
              {badge !== null && (
                <span style={{ minWidth: 18, height: 18, borderRadius: 9, background: '#ef4444', color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>{badge}</span>
              )}
            </button>
          )
        })}

        <div style={{ height: 1, background: C.border, margin: '6px 0' }} />
        <button onClick={logout} style={{
          display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '13px 16px',
          border: 'none', background: 'none', cursor: 'pointer', fontFamily: C.font,
          fontSize: 14, color: C.danger, textAlign: 'left',
        }}>
          <span style={{ display: 'flex' }}>{Icons.logout}</span>
          Выйти
        </button>
      </div>
    </div>
  )
}
