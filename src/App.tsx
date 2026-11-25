// Админка «Маяка»: вход сотрудника, оболочка (меню по задачам, поиск, тема) и адреса страниц.
// У каждого экрана свой адрес (/tenants/<id>, /invoices/<id>): работают «Назад», обновление и ссылки.
import { useEffect, useState, type ReactNode, type CSSProperties } from 'react'
import { createBrowserRouter, RouterProvider, Outlet, NavLink, useLocation, useNavigate, useParams, Navigate } from 'react-router'
import { supabase } from './lib/supabase'
import { setNavigator, legacyHashPath, go } from './lib/nav'
import { AuthPage } from './pages/Auth'
import { Icon } from './components/icons'
import { C, useNarrow } from './components/ui'
import GlobalSearch from './components/GlobalSearch'
import { SettingsModal } from './pages/Settings'
import TodayPage from './pages/Today'
import TenantsPage from './pages/Tenants'
import DebtorsPage from './pages/Debtors'
import { AIAssistantPage } from './pages/AIAssistant'
import { KnowledgeBasePage } from './pages/KnowledgeBase'
import { TenantCardPage } from './pages/TenantCard'
import SettlementsPage from './pages/Settlements'
import ReferencesPage from './pages/References'
import { BillingPage } from './pages/Billing'
import { TenantNewPage } from './pages/TenantNew'
import SiteAdminPage from './pages/SiteAdmin'
import { FloorPlanPage } from './pages/FloorPlan'
import StaffPage from './pages/Staff'
import InventoryPage from './pages/Inventory'
import LettersPage from './pages/Letters'
import MetersPage from './pages/Meters'
import MeterRoundPage from './pages/MeterRound'
import UnitsPage from './pages/Units'
import TasksPage, { MyTasksPage } from './pages/Tasks'
import ContractsPage from './pages/Contracts'
import { InvoicesPage } from './pages/InvoicesPage'
import HeatPage from './pages/Heat'
import CounterpartiesPage from './pages/Counterparties'
import RepairsPage from './pages/Repairs'
import IncomingInvoicesPage from './pages/IncomingInvoices'
import PaymentCalendarPage from './pages/PaymentCalendar'
import BankPage from './pages/Bank'
import ReconcilePage from './pages/Reconcile'
import LedgerPage from './pages/Ledger'
import ImportTenantsPage from './pages/ImportTenants'
import AdvertisingStele from './pages/AdvertisingStele'
import DealsPage from './pages/Deals'
import DealCardPage from './pages/DealCard'
import DealsReportPage from './pages/DealsReport'
import OnecTransferPage from './pages/OnecTransfer'

// ── Меню: по задачам, а не по таблицам ──────────────────────────────────────
interface NavItem { to: string; label: string; icon: string }
const NAV: { label: string; items: NavItem[]; more?: boolean }[] = [
  { label: '', items: [{ to: '/', label: 'Сегодня', icon: 'dashboard' }] },
  { label: 'Арендаторы', items: [
    { to: '/deals', label: 'Сделки', icon: 'deals' },
    { to: '/tenants', label: 'Арендаторы', icon: 'tenants' },
    { to: '/contracts', label: 'Договоры', icon: 'contracts' },
    { to: '/letters', label: 'Письма', icon: 'letters' },
  ] },
  { label: 'Помещения', items: [
    { to: '/floorplan', label: 'План этажей', icon: 'floorplan' },
    { to: '/units', label: 'Помещения', icon: 'units' },
    { to: '/meters', label: 'Счётчики', icon: 'meters' },
    { to: '/meters/round', label: 'Обход счётчиков', icon: 'meters' },
  ] },
  { label: 'Деньги', items: [
    { to: '/invoices', label: 'Начисления и счета', icon: 'invoices' },
    { to: '/bank', label: 'Поступления', icon: 'bank' },
    { to: '/debtors', label: 'Должники', icon: 'debtors' },
    { to: '/deposits', label: 'Депозиты', icon: 'deposits' },
    { to: '/settlements', label: 'Оборотная ведомость', icon: 'settlements' },
    { to: '/incoming-invoices', label: 'Расходы', icon: 'incoming-invoices' },
  ] },
  { label: 'Заявки', items: [
    { to: '/repairs', label: 'Ремонты', icon: 'repairs' },
    { to: '/tasks', label: 'Задачи', icon: 'tasks' },
  ] },
  { label: 'Ещё', more: true, items: [
    { to: '/payment-calendar', label: 'Платёжный календарь', icon: 'payment-calendar' },
    { to: '/reconcile', label: 'Сверка расходов', icon: 'reconcile' },
    { to: '/ledger', label: 'Баланс по 1С', icon: 'ledger' },
    { to: '/onec', label: 'Переход с 1С', icon: 'ledger' },
    { to: '/heat', label: 'Тепло', icon: 'heat' },
    { to: '/stele', label: 'Рекламная стела', icon: 'stele' },
    { to: '/inventory', label: 'Склад', icon: 'inventory' },
    { to: '/counterparties', label: 'Контрагенты', icon: 'counterparties' },
    { to: '/staff', label: 'Персонал', icon: 'staff' },
    { to: '/my-tasks', label: 'Мои задачи', icon: 'my-tasks' },
    { to: '/kb', label: 'База знаний', icon: 'kb' },
    { to: '/ai', label: 'AI-ассистент', icon: 'ai' },
    { to: '/reference', label: 'Справочники', icon: 'reference' },
    { to: '/site', label: 'Сайт и заявки', icon: 'site' },
  ] },
]
const EXTRA_TITLES: [RegExp, string, string][] = [
  [/^\/deals\/report/, 'Отчёт по сделкам', '/deals'], [/^\/deals\//, 'Сделка', '/deals'],
  [/^\/tenants\/new/, 'Новый арендатор', '/tenants'], [/^\/tenants\/import/, 'Импорт арендаторов', '/tenants'],
  [/^\/tenants\//, 'Карточка арендатора', '/tenants'], [/^\/settlements\//, 'Расчёты с арендатором', '/settlements'],
  [/^\/invoices\//, 'Счёт', '/invoices'], [/^\/contracts\//, 'Договор', '/contracts'], [/^\/billing/, 'Биллинг', '/invoices'],
]
function sectionOf(path: string): { title: string; nav: string } {
  for (const [re, title, nav] of EXTRA_TITLES) if (re.test(path)) return { title, nav }
  const all = NAV.flatMap(g => g.items)
  const hit = all.find(i => i.to === path) || all.filter(i => i.to !== '/').find(i => path.startsWith(i.to + '/'))
  return { title: hit?.label || 'Маяк', nav: hit?.to || '/' }
}
const ROLE_LABEL: Record<string, string> = { owner: 'Владелец', manager: 'Управляющий' }

// ── Нижняя панель на телефоне: сценарии «на ходу» ───────────────────────────
const TABBAR: { to: string; label: string; icon: string }[] = [
  { to: '/', label: 'Сегодня', icon: 'dashboard' },
  { to: '/repairs', label: 'Заявки', icon: 'repairs' },
  { to: '/meters/round', label: 'Обход', icon: 'meters' },
  { to: '/debtors', label: 'Должники', icon: 'debtors' },
]
const TABBAR_H = 58
const SAFE_TOP = 'env(safe-area-inset-top, 0px)'
const SAFE_BOTTOM = 'env(safe-area-inset-bottom, 0px)'
const SAFE_LEFT = 'env(safe-area-inset-left, 0px)'
const SAFE_RIGHT = 'env(safe-area-inset-right, 0px)'

function TabBar({ nav, menuOpen, onMenu }: { nav: string; menuOpen: boolean; onMenu: () => void }) {
  const cell = (on: boolean): CSSProperties => ({
    flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
    height: TABBAR_H, textDecoration: 'none', border: 0, background: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0,
    fontSize: 11, fontWeight: on ? 600 : 500, color: on ? C.accent : C.muted,
  })
  return (
    <nav aria-label="Быстрые разделы" style={{
      position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 50, display: 'flex', background: C.card, borderTop: `1px solid ${C.line}`,
      paddingBottom: SAFE_BOTTOM, paddingLeft: SAFE_LEFT, paddingRight: SAFE_RIGHT,
    }}>
      {TABBAR.map(t => {
        const on = !menuOpen && nav === t.to
        return (
          <NavLink key={t.to} to={t.to} end style={cell(on)} aria-current={on ? 'page' : undefined}>
            <Icon name={t.icon} size={22} /><span>{t.label}</span>
          </NavLink>
        )
      })}
      <button type="button" onClick={onMenu} style={cell(menuOpen)} aria-label="Меню">
        <Icon name="menu" size={22} /><span>Меню</span>
      </button>
    </nav>
  )
}

// ── Тема ────────────────────────────────────────────────────────────────────
type Theme = 'light' | 'dark' | 'system'
function applyTheme(t: Theme) {
  const dark = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
}
function useTheme(): [Theme, (t: Theme) => void] {
  const [theme, setTheme] = useState<Theme>(() => { try { return (localStorage.getItem('mayak-theme') as Theme) || 'system' } catch { return 'system' } })
  useEffect(() => {
    applyTheme(theme)
    try { localStorage.setItem('mayak-theme', theme) } catch { /* хранилище недоступно */ }
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const on = () => theme === 'system' && applyTheme('system')
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [theme])
  return [theme, setTheme]
}

// ── Оболочка ────────────────────────────────────────────────────────────────
function Shell() {
  const navigate = useNavigate()
  const location = useLocation()
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<{ full_name: string; role: string } | null | undefined>(undefined)
  const [loading, setLoading] = useState(true)
  const [showSettings, setShowSettings] = useState(false)
  const [narrow, setNarrow] = useState(window.innerWidth < 960)
  const [menuOpen, setMenuOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [theme, setTheme] = useTheme()
  const phone = useNarrow()

  useEffect(() => { setNavigator(to => navigate(to)) }, [navigate])
  useEffect(() => { setMenuOpen(false) }, [location.pathname])
  useEffect(() => {
    // старые ссылки вида /#/tenant-card/<id>
    const fromHash = () => { const legacy = legacyHashPath(window.location.hash); if (legacy) navigate(legacy, { replace: true }) }
    fromHash()
    const onResize = () => setNarrow(window.innerWidth < 960)
    window.addEventListener('resize', onResize)
    window.addEventListener('hashchange', fromHash)
    return () => { window.removeEventListener('resize', onResize); window.removeEventListener('hashchange', fromHash) }
  }, [])

  const loadUser = async () => {
    const { data } = await supabase.auth.getSession()
    const u = data.session?.user ?? null
    setUser(u)
    if (u) {
      const { data: prof } = await supabase.from('profiles').select('full_name, role').eq('user_id', u.id).maybeSingle()
      setProfile(prof ?? null)
    } else setProfile(null)
    setLoading(false)
  }
  useEffect(() => {
    loadUser()
    const { data: sub } = supabase.auth.onAuthStateChange(event => { if (event === 'SIGNED_OUT') { setUser(null); setProfile(null) } })
    return () => sub.subscription.unsubscribe()
  }, [])
  const logout = async () => { setShowSettings(false); await supabase.auth.signOut(); setUser(null); setProfile(null) }

  if (loading || (user && profile === undefined)) return <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', color: C.faint }}>Загрузка…</div>
  if (!user) return <AuthPage onLogin={loadUser} />
  if (!profile) return <AuthPage denied onLogin={loadUser} />

  const { title, nav } = sectionOf(location.pathname)
  const inMore = NAV.find(g => g.more)!.items.some(i => i.to === nav)
  const initials = (profile.full_name || user.email || '?').split(/\s+/).map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()

  const item = (n: NavItem) => {
    const on = nav === n.to
    return (
      <NavLink key={n.to} to={n.to} end style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', borderRadius: 7, textDecoration: 'none', fontSize: 14,
        background: on ? C.hover : 'transparent', color: on ? C.text : C.muted, fontWeight: on ? 500 : 400 }}>
        <span style={{ display: 'flex', color: on ? C.text : C.faint }}><Icon name={n.icon} /></span>{n.label}
      </NavLink>
    )
  }

  const sidebar = (
    <aside style={{ width: 236, flexShrink: 0, background: C.card, borderRight: `1px solid ${C.line}`, display: 'flex', flexDirection: 'column', height: '100dvh', boxSizing: 'border-box',
      ...(narrow ? { position: 'fixed', top: 0, left: 0, zIndex: 60, transform: menuOpen ? 'none' : 'translateX(-100%)', transition: 'transform .2s ease', boxShadow: menuOpen ? C.shadow : 'none',
        paddingTop: SAFE_TOP, paddingBottom: SAFE_BOTTOM, paddingLeft: SAFE_LEFT, width: `calc(236px + ${SAFE_LEFT})`, maxWidth: '85vw' } : { position: 'sticky', top: 0 }) }}>
      <div style={{ padding: '14px 16px', borderBottom: `1px solid ${C.line}`, display: 'flex', alignItems: 'center', gap: 10 }}>
        <img src="/mayak-logo.png" style={{ width: 30, height: 30, borderRadius: 7, objectFit: 'cover' }} alt="" />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>Маяк</div>
          <div style={{ fontSize: 11, color: C.muted }}>Бизнес-центр, Дмитров</div>
        </div>
      </div>
      <nav style={{ padding: '6px 8px', flex: 1, overflowY: 'auto' }}>
        {NAV.map(g => (
          <div key={g.label || 'top'}>
            {g.more ? (
              <button type="button" onClick={() => setMoreOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', border: 0, background: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600, color: C.faint, letterSpacing: '.6px', padding: '14px 10px 5px', textTransform: 'uppercase', fontFamily: 'inherit' }}>
                {g.label}<span style={{ display: 'flex', transform: moreOpen || inMore ? 'rotate(180deg)' : 'none' }}><Icon name="chevron" size={12} /></span>
              </button>
            ) : g.label ? <div style={{ fontSize: 11, fontWeight: 600, color: C.faint, letterSpacing: '.6px', padding: '14px 10px 5px', textTransform: 'uppercase' }}>{g.label}</div> : null}
            {(!g.more || moreOpen || inMore) && g.items.map(item)}
          </div>
        ))}
      </nav>
      <div style={{ borderTop: `1px solid ${C.line}`, display: 'flex', alignItems: 'center' }}>
        <button type="button" onClick={() => setShowSettings(true)} title="Профиль, телефон и уведомления"
          style={{ flex: 1, minWidth: 0, padding: '12px 8px 12px 16px', border: 0, background: 'none', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
          <div style={{ width: 30, height: 30, borderRadius: '50%', background: C.text, display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 600, color: C.card, flexShrink: 0 }}>{initials}</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile.full_name || user.email}</div>
            <div style={{ fontSize: 11, color: C.faint }}>{ROLE_LABEL[profile.role] || profile.role}</div>
          </div>
        </button>
        <button type="button" onClick={() => setTheme(theme === 'dark' ? 'light' : theme === 'light' ? 'system' : 'dark')}
          title={theme === 'system' ? 'Тема как в системе' : theme === 'dark' ? 'Тёмная тема' : 'Светлая тема'} aria-label="Сменить тему"
          style={{ border: 0, background: 'none', color: C.faint, cursor: 'pointer', padding: 12, display: 'flex' }}>
          <Icon name={theme === 'dark' ? 'moon' : theme === 'light' ? 'sun' : 'settings'} />
        </button>
      </div>
    </aside>
  )

  return (
    <div style={{ display: 'flex', minHeight: '100dvh', background: C.bg, color: C.text }}>
      {sidebar}
      {narrow && menuOpen && <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, background: C.overlay, zIndex: 55 }} />}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <header style={{ background: C.card, borderBottom: `1px solid ${C.line}`, padding: narrow ? '10px 14px' : '12px 24px', display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', top: 0, zIndex: 40,
          ...(narrow ? { paddingTop: `calc(10px + ${SAFE_TOP})`, paddingLeft: `calc(14px + ${SAFE_LEFT})`, paddingRight: `calc(14px + ${SAFE_RIGHT})` } : {}) }}>
          {narrow && !phone && (
            <button type="button" onClick={() => setMenuOpen(true)} aria-label="Меню" style={{ border: `1px solid ${C.line}`, background: C.card, borderRadius: 8, width: 38, height: 38, display: 'grid', placeItems: 'center', cursor: 'pointer', color: C.text, flexShrink: 0 }}>
              <Icon name="menu" size={18} />
            </button>
          )}
          <h1 style={{ fontSize: narrow ? 16 : 18, fontWeight: 600, margin: 0, letterSpacing: '-0.2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{title}</h1>
          <div style={{ marginLeft: 'auto', flex: narrow ? 1 : '0 1 420px', minWidth: 0 }}><GlobalSearch /></div>
        </header>
        <main style={{ flex: 1, padding: narrow ? 14 : 24, minWidth: 0,
          ...(narrow ? { paddingLeft: `calc(14px + ${SAFE_LEFT})`, paddingRight: `calc(14px + ${SAFE_RIGHT})` } : {}),
          ...(phone ? { paddingBottom: `calc(${TABBAR_H + 20}px + ${SAFE_BOTTOM})` } : {}) }}>
          <Outlet />
        </main>
      </div>
      {phone && <TabBar nav={nav} menuOpen={menuOpen} onMenu={() => setMenuOpen(o => !o)} />}
      {showSettings && <SettingsModal user={user} profile={profile} onClose={() => setShowSettings(false)} onLogout={logout} />}
    </div>
  )
}

// ── Страницы, которым нужен параметр из адреса ─────────────────────────────
const P = (f: (id: string) => ReactNode) => function Param() { const { id = '' } = useParams(); return <>{f(id)}</> }
const TenantCardRoute = P(id => <TenantCardPage key={id} tenantId={id} onBack={() => go('/tenants')} />)
const SettlementsRoute = P(id => <SettlementsPage tenantId={id} />)
const InvoiceRoute = P(id => <InvoicesPage invoiceId={id} />)
const ContractRoute = P(id => <ContractsPage leaseId={id} />)
const DealRoute = P(id => <DealCardPage key={id} dealId={id} />)

function NotFound() {
  return <div style={{ padding: 40, textAlign: 'center', color: C.muted }}>Такой страницы нет. <a href="/" style={{ color: C.accent }}>На «Сегодня»</a></div>
}

const router = createBrowserRouter([{
  path: '/', element: <Shell />, children: [
    { index: true, element: <TodayPage /> },
    { path: 'deals', element: <DealsPage /> },
    { path: 'deals/report', element: <DealsReportPage /> },
    { path: 'deals/:id', element: <DealRoute /> },
    { path: 'tenants', element: <TenantsPage /> },
    { path: 'tenants/new', element: <TenantNewPage onBack={() => go('/tenants')} onSaved={() => go('/tenants')} /> },
    { path: 'tenants/import', element: <ImportTenantsPage onDone={() => go('/tenants')} /> },
    { path: 'tenants/:id', element: <TenantCardRoute /> },
    { path: 'contracts', element: <ContractsPage /> },
    { path: 'contracts/:id', element: <ContractRoute /> },
    { path: 'letters', element: <LettersPage /> },
    { path: 'floorplan', element: <FloorPlanPage onOpenTenant={id => go('/tenants/' + id)} /> },
    { path: 'units', element: <UnitsPage /> },
    { path: 'meters', element: <MetersPage /> },
    { path: 'meters/round', element: <MeterRoundPage /> },
    { path: 'invoices', element: <InvoicesPage /> },
    { path: 'invoices/:id', element: <InvoiceRoute /> },
    { path: 'billing', element: <BillingPage /> },
    { path: 'bank', element: <BankPage /> },
    { path: 'debtors', element: <DebtorsPage /> },
    { path: 'deposits', element: <SettlementsPage initialTab="deposits" /> },
    { path: 'settlements', element: <SettlementsPage /> },
    { path: 'settlements/:id', element: <SettlementsRoute /> },
    { path: 'incoming-invoices', element: <IncomingInvoicesPage /> },
    { path: 'payment-calendar', element: <PaymentCalendarPage /> },
    { path: 'reconcile', element: <ReconcilePage /> },
    { path: 'ledger', element: <LedgerPage /> },
    { path: 'onec', element: <OnecTransferPage /> },
    { path: 'repairs', element: <RepairsPage /> },
    { path: 'tasks', element: <TasksPage /> },
    { path: 'my-tasks', element: <MyTasksPage /> },
    { path: 'heat', element: <HeatPage /> },
    { path: 'stele', element: <AdvertisingStele /> },
    { path: 'inventory', element: <InventoryPage /> },
    { path: 'counterparties', element: <CounterpartiesPage /> },
    { path: 'staff', element: <StaffPage /> },
    { path: 'kb', element: <KnowledgeBasePage /> },
    { path: 'ai', element: <AIAssistantPage /> },
    { path: 'reference', element: <ReferencesPage /> },
    { path: 'site', element: <SiteAdminPage /> },
    { path: 'dashboard', element: <Navigate to="/" replace /> },
    { path: 'tenant-card/:id', element: <TenantCardLegacy /> },
    { path: '*', element: <NotFound /> },
  ],
}])

function TenantCardLegacy() { const { id } = useParams(); return <Navigate to={'/tenants/' + id} replace /> }

export default function App() {
  return <RouterProvider router={router} />
}
