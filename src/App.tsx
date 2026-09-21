import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import TenantActivatePage from './pages/TenantActivate'
import { AuthPage } from './pages/Auth'
import { AIAssistantPage } from './pages/AIAssistant'
import { SettingsModal } from './pages/Settings'
import { KnowledgeBasePage } from './pages/KnowledgeBase'
import { TenantCardPage } from './pages/TenantCard'
import { InvoiceDetailPage } from './pages/InvoiceDetail'
import ReferencesPage from './pages/References'
import { BillingPage } from './pages/Billing'
import { TenantNewPage } from './pages/TenantNew'
import SiteAdminPage from './pages/SiteAdmin'
import { FloorPlanPage } from './pages/FloorPlan'
import StaffPage from './pages/Staff'
import InventoryPage from './pages/Inventory'
import LettersPage from './pages/Letters'
import MetersPage from './pages/Meters'
import UnitsPage from './pages/Units'
import TasksPage, { MyTasksPage } from './pages/Tasks'
import ContractsPage from './pages/Contracts'
import { InvoicesPage } from './pages/InvoicesPage'
import HeatPage from './pages/Heat'
import CounterpartiesPage from './pages/Counterparties'
import RepairsPage, { fetchHotRepairs } from './pages/Repairs'
import IncomingInvoicesPage from './pages/IncomingInvoices'
import PaymentCalendarPage from './pages/PaymentCalendar'
import BankPage from './pages/Bank'
import ReconcilePage from './pages/Reconcile'
import LedgerPage from './pages/Ledger'
import ImportTenantsPage from './pages/ImportTenants'
import AdvertisingStele from './pages/AdvertisingStele'
import { useRealTenants } from './lib/useRealData'

type Page = 'site' | 'dashboard' | 'tenants' | 'invoices' | 'tasks' | 'ai' | 'kb' | 'tenant-card' | 'reference' | 'billing' | 'invoice-detail' | 'settings' | 'tenant-new' | 'contracts' | 'letters' | 'floorplan' | 'units' | 'meters' | 'staff' | 'inventory' | 'my-tasks' | 'repairs' | 'bank' | 'reconcile' | 'ledger' | 'heat' | 'counterparties' | 'incoming-invoices' | 'payment-calendar' | 'import-tenants' | 'stele'

const NAV_GROUPS = [
  { label: '', items: [
    { id: 'dashboard', label: 'Сводка дня', icon: '⊞' },
  ] },
  { label: 'ОБЪЕКТ', items: [
    { id: 'floorplan', label: 'План этажей', icon: '🏢' },
    { id: 'units', label: 'Помещения', icon: '🚪' },
    { id: 'meters', label: 'Счётчики', icon: '⊙' },
    { id: 'heat', label: 'Тепло', icon: '🌡' },
    { id: 'stele', label: 'Рекламная стела', icon: '📢' },
  ] },
  { label: 'АРЕНДА', items: [
    { id: 'tenants', label: 'Арендаторы', icon: '◎' },
    { id: 'contracts', label: 'Договоры', icon: '📄' },
    { id: 'letters', label: 'Письма', icon: '✉' },
  ] },
  { label: 'ФИНАНСЫ', items: [
    { id: 'invoices', label: 'Счета аренд.', icon: '◈' },
    { id: 'billing', label: 'Биллинг', icon: '₽' },
    { id: 'bank', label: 'Банк', icon: '🏦' },
    { id: 'reconcile', label: 'Сверка', icon: '⚖' },
    { id: 'ledger', label: 'Баланс', icon: '⊟' },
    { id: 'incoming-invoices', label: 'Вх. счета', icon: '📥' },
    { id: 'payment-calendar', label: 'Платежи', icon: '📅' },
  ] },
  { label: 'ЭКСПЛУАТАЦИЯ', items: [
    { id: 'repairs', label: 'Заявки на ремонт', icon: '🔧' },
    { id: 'counterparties', label: 'Контрагенты', icon: '🏗' },
    { id: 'inventory', label: 'Инвентарь', icon: '📦' },
  ] },
  { label: 'ЗАДАЧИ И ПЕРСОНАЛ', items: [
    { id: 'tasks', label: 'Все задачи', icon: '✓' },
    { id: 'my-tasks', label: 'Мои задачи', icon: '☑' },
    { id: 'staff', label: 'Сотрудники', icon: '👥' },
  ] },
  { label: 'САЙТ', items: [
    { id: 'site', label: 'Сайт и заявки', icon: '🌐' },
  ] },
  { label: 'СИСТЕМА', items: [
    { id: 'kb', label: 'База знаний', icon: '◉' },
    { id: 'ai', label: 'AI Ассистент', icon: '✦' },
    { id: 'reference', label: 'Справочники', icon: '⚙' },
  ] },
]
const NAV = NAV_GROUPS.flatMap(g => g.items)

const SOURCE_COLOR: Record<string, string> = { OWNER: '#ef4444', SYSTEM: '#9ca3af', EMPLOYEE: '#3b82f6' }
const PRIORITY_PREFIX: Record<string, string> = { CRITICAL: '!! ', HIGH: '! ', NORMAL: '' }
const STATUS_BADGE: Record<string, { label: string; bg: string; color: string }> = {
  OVERDUE:  { label: 'Просрочен', bg: '#fef2f2', color: '#ef4444' },
  SENT:     { label: 'Выставлен', bg: '#eff6ff', color: '#3b82f6' },
  DRAFT:    { label: 'Черновик',  bg: '#f1f5f9', color: '#64748b' },
  PAID:     { label: 'Оплачен',   bg: '#f0fdf4', color: '#22c55e' },
  ACTIVE:   { label: 'Активен',   bg: '#f0fdf4', color: '#22c55e' },
  DEBT:     { label: 'Долг',      bg: '#fef2f2', color: '#ef4444' },
  EXPIRING: { label: 'Истекает',  bg: '#fffbeb', color: '#d97706' },
}
const TYPE_LABEL: Record<string, string> = { COMPANY: 'Юрлицо', IP: 'ИП', INDIVIDUAL: 'Физлицо' }
const EVENT_DOT: Record<string, string> = { lease_expiry: '#ef4444', meter_verification: '#f59e0b', maintenance: '#3b82f6' }

function Badge({ s }: { s: string }) {
  const b = STATUS_BADGE[s] ?? { label: s, bg: '#f1f5f9', color: '#64748b' }
  return <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 13, fontWeight: 500, background: b.bg, color: b.color }}>{b.label}</span>
}

function KpiCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e8ebf3', borderRadius: 9, padding: '11px 13px' }}>
      <div style={{ fontSize: 12, color: '#8596b4', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.4px' }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 600, color: color ?? '#1a2240', lineHeight: 1, marginBottom: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: '#8596b4' }}>{sub}</div>}
    </div>
  )
}

function Dashboard() {
  const [stats, setStats] = useState({ totalUnits: 0, occupiedUnits: 0, occupancyRate: 0, totalMonthlyRevenue: 0, overdueCount: 0, overdueTotal: 0, openRepairs: 0, expiringContracts: 0 })
  const [tasks, setTasks] = useState<any[]>([])
  const [overdueInvs, setOverdueInvs] = useState<any[]>([])
  const [events, setEvents] = useState<any[]>([])
  const [hotRepairs, setHotRepairs] = useState<any[]>([])
  const [repairsLoaded, setRepairsLoaded] = useState(false)
  const [approvedInvoices, setApprovedInvoices] = useState<any[]>([])

  useEffect(() => {
    fetchHotRepairs().then(data => { setHotRepairs(data); setRepairsLoaded(true) })
    supabase.from('incoming_invoices').select('id,supplier,amount,vat,description,due_date,approved_by,approved_at')
      .eq('status', 'APPROVED').order('approved_at', { ascending: false })
      .then(({ data }) => setApprovedInvoices(data || []))

    supabase.from('units').select('id,status')
      .then(({ data }) => {
        const total = data?.length || 0
        const occupied = data?.filter((u: any) => u.status === 'occupied').length || 0
        setStats(s => ({ ...s, totalUnits: total, occupiedUnits: occupied, occupancyRate: total ? Math.round(occupied / total * 100) : 0 }))
      })

    const monthStart = new Date().toISOString().slice(0, 7) + '-01'
    supabase.from('invoices').select('total_amount,status').gte('period', monthStart)
      .then(({ data }) => {
        const rev = (data || []).filter((i: any) => ['SENT', 'PAID'].includes(i.status)).reduce((s: number, i: any) => s + (i.total_amount || 0), 0)
        setStats(s => ({ ...s, totalMonthlyRevenue: rev }))
      })

    supabase.from('invoices').select('id,number,total_amount,created_at,tenants(full_name),units(number)').eq('status', 'OVERDUE').order('created_at').limit(5)
      .then(({ data }) => {
        const invs = data || []
        setOverdueInvs(invs)
        setStats(s => ({ ...s, overdueCount: invs.length, overdueTotal: invs.reduce((sum: number, i: any) => sum + (i.total_amount || 0), 0) }))
      })

    supabase.from('repairs').select('id', { count: 'exact', head: true }).in('status', ['new', 'accepted', 'in_progress'])
      .then(({ count }) => setStats(s => ({ ...s, openRepairs: count || 0 })))

    supabase.from('tasks').select('id,title,status,priority,source').in('status', ['open', 'in_progress']).order('created_at', { ascending: false }).limit(6)
      .then(({ data }) => setTasks(data || []))

    const today = new Date().toISOString().slice(0, 10)
    const in30 = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    supabase.from('contracts').select('id,contract_number,end_date,tenants(full_name)').gte('end_date', today).lte('end_date', in30).order('end_date').limit(10)
      .then(({ data }) => {
        setEvents(data || [])
        setStats(s => ({ ...s, expiringContracts: data?.length || 0 }))
      })
  }, [])

  const REPAIR_STATUS: Record<string, { label: string; bg: string; color: string }> = {
    new:         { label: 'Новая',     bg: '#f3f4f6', color: '#6b7280' },
    accepted:    { label: 'Принята',   bg: '#eff3ff', color: '#4f6ef7' },
    in_progress: { label: 'В работе',  bg: '#fef3c7', color: '#d97706' },
    completed:   { label: 'Готово',    bg: '#dcfce7', color: '#16a34a' },
    rejected:    { label: 'Отклонена', bg: '#fee2e2', color: '#ef4444' },
  }
  const SRC_LABEL: Record<string, string> = { OWNER: 'от руководителя', SYSTEM: 'авто', EMPLOYEE: 'личная' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 8 }}>
        <KpiCard label="Заполняемость" value={`${stats.occupancyRate}%`} sub={`${stats.occupiedUnits} из ${stats.totalUnits} офисов`} color="#22c55e" />
        <KpiCard label="Выручка / месяц" value={`${stats.totalMonthlyRevenue.toLocaleString('ru')} ₽`} />
        <KpiCard label="Просрочено счетов" value={stats.overdueCount} sub={`${stats.overdueTotal.toLocaleString('ru')} ₽ долг`} color="#ef4444" />
        <KpiCard label="Открытые заявки" value={stats.openRepairs} color="#f59e0b" />
        <KpiCard label="Истекают договоры" value={stats.expiringContracts} sub="в течение 30 дней" color="#f59e0b" />
        <KpiCard label="Аварийных заявок" value={hotRepairs.filter(r => r.priority === 'emergency').length} color="#ef4444" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div style={{ background: '#fff', border: '1px solid #e8ebf3', borderRadius: 9, padding: '13px 15px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#1a2240' }}>Открытые задачи</div>
            <button onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: 'tasks' }))} style={{ fontSize: 12, color: '#4f6ef7', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Все →</button>
          </div>
          {tasks.length === 0
            ? <div style={{ color: '#16a34a', fontSize: 14, fontWeight: 500, padding: '8px 0' }}>✓ Нет открытых задач</div>
            : tasks.map(t => (
              <div key={t.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '7px 0', borderBottom: '1px solid #f0f2f8' }}>
                <div style={{ width: 3, height: 36, borderRadius: 2, background: SOURCE_COLOR[t.source] || '#9ca3af', flexShrink: 0, marginTop: 2 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: '#1a2240' }}>{PRIORITY_PREFIX[t.priority] || ''}{t.title}</div>
                  <div style={{ fontSize: 12, color: '#8596b4', marginTop: 2 }}>{SRC_LABEL[t.source] || t.source}</div>
                </div>
                <Badge s={t.status === 'open' ? 'DRAFT' : 'SENT'} />
              </div>
            ))
          }
        </div>

        <div style={{ background: '#fff', border: '1px solid #e8ebf3', borderRadius: 9, padding: '13px 15px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#1a2240' }}>Просроченные счета</div>
            <button onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: 'invoices' }))} style={{ fontSize: 12, color: '#4f6ef7', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Все →</button>
          </div>
          {overdueInvs.length === 0
            ? <div style={{ color: '#16a34a', fontSize: 14, fontWeight: 500, padding: '8px 0' }}>✓ Просроченных счетов нет</div>
            : overdueInvs.map((inv: any) => (
              <div key={inv.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f0f2f8' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: '#1a2240' }}>{inv.tenants?.full_name || '—'}</div>
                  <div style={{ fontSize: 12, color: '#8596b4' }}>Офис {inv.units?.number || '—'} · №{inv.number}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#ef4444' }}>{(inv.total_amount || 0).toLocaleString('ru')} ₽</div>
                </div>
              </div>
            ))
          }
          {overdueInvs.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, marginTop: 4, borderTop: '1px solid #f0f2f8' }}>
              <span style={{ fontSize: 12, color: '#8596b4' }}>Итого долг</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#ef4444' }}>{stats.overdueTotal.toLocaleString('ru')} ₽</span>
            </div>
          )}
        </div>
      </div>

      {/* Горящие заявки */}
      <div style={{ background: '#fff', border: '1px solid #e8ebf3', borderRadius: 9, padding: '13px 15px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#1a2240' }}>⚡ Горящие заявки</div>
          {hotRepairs.length > 0 && (
            <span style={{ background: '#ef4444', color: '#fff', fontSize: 11, fontWeight: 700, borderRadius: 10, padding: '2px 7px' }}>{hotRepairs.length}</span>
          )}
          <button onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: 'repairs' }))} style={{ marginLeft: 'auto', padding: '4px 12px', borderRadius: 6, border: '1px solid #e8ebf3', background: '#fff', color: '#4f6ef7', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
            Все заявки →
          </button>
        </div>
        {!repairsLoaded ? (
          <div style={{ color: '#8596b4', fontSize: 13 }}>Загрузка...</div>
        ) : hotRepairs.length === 0 ? (
          <div style={{ color: '#16a34a', fontSize: 14, fontWeight: 500, padding: '8px 0' }}>✓ Срочных заявок нет</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {hotRepairs.map(r => {
              const isEmergency = r.priority === 'emergency'
              const st = REPAIR_STATUS[r.status] || REPAIR_STATUS.new
              return (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: '#f8f9fc', borderRadius: 8, borderLeft: `3px solid ${isEmergency ? '#ef4444' : '#ea580c'}` }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: isEmergency ? '#ef4444' : '#ea580c', minWidth: 32 }}>#{r.number}</div>
                  <div style={{ fontSize: 12, color: '#8596b4', minWidth: 60, whiteSpace: 'nowrap' }}>{(r.unit as any)?.number || '—'}</div>
                  <div style={{ fontSize: 12, color: '#6b7280', minWidth: 70, whiteSpace: 'nowrap' }}>{r.category}</div>
                  <div style={{ flex: 1, fontSize: 13, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.description.slice(0, 50)}{r.description.length > 50 ? '…' : ''}</div>
                  <div style={{ fontSize: 11, color: '#8596b4', whiteSpace: 'nowrap' }}>{new Date(r.created_at).toLocaleDateString('ru')}</div>
                  <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 8, background: st.bg, color: st.color, whiteSpace: 'nowrap' }}>{st.label}</span>
                  <button onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: 'repairs' }))} style={{ padding: '3px 10px', borderRadius: 6, border: '1px solid #e8ebf3', background: '#fff', color: '#4f6ef7', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>Открыть</button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Согласованные счета к оплате */}
      <div style={{ background: '#fff', border: '1px solid #e8ebf3', borderRadius: 9, padding: '13px 15px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#1a2240' }}>✅ Согласованные счета к оплате</div>
          {approvedInvoices.length > 0 && (
            <span style={{ background: '#4f6ef7', color: '#fff', fontSize: 11, fontWeight: 700, borderRadius: 10, padding: '2px 7px' }}>{approvedInvoices.length}</span>
          )}
          <span style={{ marginLeft: 'auto', fontSize: 14, fontWeight: 700, color: '#1a2240' }}>
            {approvedInvoices.reduce((s, i) => s + (i.amount || 0), 0).toLocaleString('ru-RU', { minimumFractionDigits: 2 })} ₽
          </span>
          <button onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: 'incoming-invoices' }))} style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid #e8ebf3', background: '#fff', color: '#4f6ef7', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
            Реестр →
          </button>
        </div>
        {approvedInvoices.length === 0 ? (
          <div style={{ color: '#8596b4', fontSize: 13, padding: '8px 0' }}>Нет счетов к оплате</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f8f9fb' }}>
                {['Поставщик', 'Сумма', 'НДС', 'Согласовал', 'Назначение'].map(h => (
                  <th key={h} style={{ padding: '7px 10px', textAlign: 'left', fontWeight: 600, color: '#8596b4', borderBottom: '1px solid #e8ebf3' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {approvedInvoices.map((inv: any) => (
                <tr key={inv.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '8px 10px', fontWeight: 600, color: '#1a2240' }}>{inv.supplier}</td>
                  <td style={{ padding: '8px 10px', fontWeight: 700, color: '#1a2240', whiteSpace: 'nowrap' }}>{Number(inv.amount).toLocaleString('ru-RU', { minimumFractionDigits: 2 })} ₽</td>
                  <td style={{ padding: '8px 10px', color: '#8596b4', whiteSpace: 'nowrap', fontSize: 12 }}>{inv.vat ? Number(inv.vat).toLocaleString('ru-RU', { minimumFractionDigits: 2 }) + ' ₽' : 'без НДС'}</td>
                  <td style={{ padding: '8px 10px', color: '#8596b4', fontSize: 12 }}>{inv.approved_by || '—'}</td>
                  <td style={{ padding: '8px 10px', color: '#374151', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inv.description || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Истекающие договоры */}
      <div style={{ background: '#fff', border: '1px solid #e8ebf3', borderRadius: 9, padding: '13px 15px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#1a2240' }}>📅 Истекающие договоры (30 дней)</div>
          <button onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: 'contracts' }))} style={{ fontSize: 12, color: '#4f6ef7', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Все →</button>
        </div>
        {events.length === 0
          ? <div style={{ color: '#16a34a', fontSize: 14, fontWeight: 500, padding: '8px 0' }}>✓ Нет договоров, истекающих в ближайшие 30 дней</div>
          : <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>
              {events.map((e: any) => (
                <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid #f0f2f8' }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#ef4444', flexShrink: 0 }} />
                  <div style={{ fontSize: 12, color: '#8596b4', width: 56, flexShrink: 0 }}>{e.end_date?.slice(5).replace('-', '.')}</div>
                  <div style={{ fontSize: 13, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {e.tenants?.full_name || '—'}{e.contract_number ? ` · №${e.contract_number}` : ''}
                  </div>
                </div>
              ))}
            </div>
        }
      </div>
    </div>
  )
}

async function sendWelcomeEmail(tenant: any) {
  const res = await fetch('/api/send-welcome', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: tenant.email, name: tenant.fullName, password: 'temp123' })
  })
  const data = await res.json()
  alert(data.ok ? 'Email sent!' : 'Error: ' + data.error)
}
const GROUP_TABS = [
  { key: '', label: 'Все' },
  { key: 'room', label: 'Помещения' },
  { key: 'stand', label: 'Стойки' },
  { key: 'advertising', label: 'Реклама' },
]

function Tenants({ onOpenTenant, onAddTenant }: { onOpenTenant: (id: string) => void; onAddTenant: () => void }) {
  const allTenants = useRealTenants()
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterGroup, setFilterGroup] = useState('')

  const filtered = allTenants.filter(t => {
    if (filterGroup && (t.tenant_group || 'room') !== filterGroup) return false
    if (filterType && t.type !== filterType) return false
    if (search) {
      const q = search.toLowerCase()
      if (!t.fullName?.toLowerCase().includes(q) && !t.unit_number?.toLowerCase().includes(q) && !t.activity_type?.toLowerCase().includes(q)) return false
    }
    return true
  })

  return (
    <div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
        {GROUP_TABS.map(tab => (
          <button key={tab.key} onClick={() => setFilterGroup(tab.key)}
            style={{ padding: '5px 14px', borderRadius: 6, border: filterGroup === tab.key ? '1.5px solid #4f6ef7' : '1px solid #e8ebf3', background: filterGroup === tab.key ? '#eff3ff' : '#fff', color: filterGroup === tab.key ? '#4f6ef7' : '#6b7280', fontSize: 13, fontWeight: filterGroup === tab.key ? 600 : 400, cursor: 'pointer', fontFamily: 'inherit' }}>
            {tab.label}
            <span style={{ marginLeft: 5, fontSize: 11, color: filterGroup === tab.key ? '#4f6ef7' : '#9ca3af' }}>
              {allTenants.filter(t => tab.key === '' || (t.tenant_group || 'room') === tab.key).length}
            </span>
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск по имени, офису..."
            style={{ padding: '6px 12px', border: '1px solid #e8ebf3', borderRadius: 7, fontSize: 13, fontFamily: 'inherit', outline: 'none', width: 200 }} />
          <select value={filterType} onChange={e => setFilterType(e.target.value)}
            style={{ padding: '6px 10px', border: '1px solid #e8ebf3', borderRadius: 7, fontSize: 13, fontFamily: 'inherit', outline: 'none', color: filterType ? '#1a2240' : '#8596b4' }}>
            <option value="">Все типы</option>
            <option value="COMPANY">Юрлицо</option>
            <option value="IP">ИП</option>
            <option value="INDIVIDUAL">Физлицо</option>
            <option value="SELF_EMPLOYED">Самозанятый</option>
          </select>
          {(search || filterType || filterGroup) && <span style={{ fontSize: 12, color: '#8596b4' }}>Найдено: {filtered.length}</span>}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: 'import-tenants' }))} style={{ padding: '8px 16px', border: '1px solid #4f6ef7', borderRadius: 8, background: '#eff3ff', color: '#4f6ef7', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>↑ Импорт из 1С</button>
          <button onClick={onAddTenant} style={{ padding: '8px 16px', border: 'none', borderRadius: 8, background: '#4f6ef7', color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>+ Добавить арендатора</button>
        </div>
      </div>
    <div style={{ background: '#fff', border: '1px solid #e8ebf3', borderRadius: 9, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <tr style={{ background: '#f8f9fc', borderBottom: '1px solid #e8ebf3' }}>
            {['Арендатор', 'Тип', 'Группа', 'Офис', 'S факт.', 'Аренда ₽/мес', 'Договор №', 'Дата начала', 'Вид деятельности', ''].map(h => (
              <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 500, color: '#8596b4', fontSize: 13, whiteSpace: 'nowrap' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0
            ? <tr><td colSpan={8} style={{ padding: '20px 12px', color: '#8596b4', textAlign: 'center' }}>Арендаторы не найдены</td></tr>
            : filtered.map(t => (
            <tr key={t.id} style={{ borderBottom: '1px solid #f0f2f8' }}>
              <td style={{ padding: '9px 12px', fontWeight: 500, color: '#4f6ef7', cursor: 'pointer', textDecoration: 'underline', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} onClick={() => onOpenTenant(t.id)}>{t.fullName}</td>
              <td style={{ padding: '9px 12px', color: '#6b7280', whiteSpace: 'nowrap' }}>{TYPE_LABEL[t.type]}</td>
              <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>
                {t.tenant_group === 'stand' ? <span style={{ padding: '2px 7px', borderRadius: 4, background: '#fef3c7', color: '#d97706', fontSize: 12, fontWeight: 500 }}>Стойка</span>
                : t.tenant_group === 'advertising' ? <span style={{ padding: '2px 7px', borderRadius: 4, background: '#ede9fe', color: '#7c3aed', fontSize: 12, fontWeight: 500 }}>Реклама</span>
                : t.tenant_group === 'agent' ? <span style={{ padding: '2px 7px', borderRadius: 4, background: '#f0fdf4', color: '#16a34a', fontSize: 12, fontWeight: 500 }}>Агент</span>
                : <span style={{ fontSize: 12, color: '#9ca3af' }}>Помещение</span>}
              </td>
              <td style={{ padding: '9px 12px', color: '#374151', fontSize: 13, whiteSpace: 'nowrap' }}>{t.unit_number || '—'}</td>
              <td style={{ padding: '9px 12px', color: '#374151', fontSize: 13, whiteSpace: 'nowrap' }}>{t.area_actual ? `${t.area_actual} м²` : '—'}</td>
              <td style={{ padding: '9px 12px', color: '#1a2240', fontWeight: 500, whiteSpace: 'nowrap' }}>{t.monthly_rent ? Number(t.monthly_rent).toLocaleString('ru-RU') + ' ₽' : '—'}</td>
              <td style={{ padding: '9px 12px', color: '#374151', fontSize: 13, whiteSpace: 'nowrap' }}>{(t as any).contract_number || '—'}</td>
              <td style={{ padding: '9px 12px', color: (t as any).contract_start_date ? '#374151' : '#8596b4', fontSize: 13, whiteSpace: 'nowrap' }}>{(t as any).contract_start_date ? new Date((t as any).contract_start_date).toLocaleDateString('ru-RU') : '—'}</td>
              <td style={{ padding: '9px 12px', color: '#6b7280', fontSize: 12, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.activity_type || '—'}</td>
              <td style={{ padding: '9px 12px' }}><button onClick={() => onOpenTenant(t.id)} style={{ padding: '3px 10px', fontSize: 13, borderRadius: 5, border: '1px solid #e8ebf3', color: '#374151', background: '#f9fafb', cursor: 'pointer' }}>Открыть</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </div>
  )
}

export default function App() {
  const [page, setPage] = useState<Page>('dashboard')
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null)
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const handler = (e: any) => setPage(e.detail)
    window.addEventListener('navigate', handler)
    return () => window.removeEventListener('navigate', handler)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null)
      setLoading(false)
    })
    supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null)
    })
  }, [])

  if (loading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif', color: '#8596b4' }}>Загрузка...</div>
  if (!user) return <AuthPage onLogin={() => supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null))} />

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#fafafa', fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>
      <aside style={{ width: 220, flexShrink: 0, background: '#fff', borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src="/favicon.ico" style={{ width: 30, height: 30, borderRadius: 8, objectFit: 'contain' }} alt="Маяк" />
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#111' }}>Маяк</div>
            <div style={{ fontSize: 11, color: '#6b7280' }}>Property OS</div>
          </div>
        </div>
        <nav style={{ padding: '8px 0', flex: 1, overflowY: 'auto' }}>
          {NAV_GROUPS.map((group, gi) => (
            <div key={gi}>
              {group.label ? <div style={{ fontSize: 10, fontWeight: 600, color: '#9ca3af', letterSpacing: '.8px', padding: '12px 16px 4px', textTransform: 'uppercase' as const }}>{group.label}</div> : null}
              {group.items.map(n => (
                <button key={n.id} onClick={() => setPage(n.id as Page)}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 16px', width: '100%', border: 'none', borderRadius: 0, background: page === n.id ? '#f3f4f6' : 'transparent', color: page === n.id ? '#111' : '#6b7280', cursor: 'pointer', fontSize: 14, fontFamily: 'inherit', textAlign: 'left', fontWeight: page === n.id ? 500 : 400, transition: 'background .1s' }}>
                  <span style={{ fontSize: 14, opacity: page === n.id ? 1 : 0.6 }}>{n.icon}</span>{n.label}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div style={{ padding: '12px 16px', borderTop: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#f3f4f6', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: '#374151' }}>АС</div>
          <div>
            <div onClick={() => setShowSettings(true)} style={{ fontSize: 12, fontWeight: 500, color: '#111', cursor: 'pointer' }}>Андрей Соколов</div>
            <div style={{ fontSize: 11, color: '#9ca3af' }}>Управляющий</div>
          </div>
        </div>
      </aside>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#fafafa' }}>
        <header style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 600, color: '#111' }}>
              {{
              'dashboard': 'Сводка дня',
              'tenants': 'Арендаторы',
              'invoices': 'Счета',
              'tasks': 'Задачи',
              'ai': 'AI Ассистент',
              'kb': 'База знаний',
              'reference': 'Справочники',
              'billing': 'Биллинг',
              'my-tasks': 'Мои задачи',
              'repairs': 'Заявки на ремонт',
              'contracts': 'Договоры',
              'letters': 'Письма',
              'bank': 'Банк',
              'reconcile': 'Сверка',
              'ledger': 'Баланс арендаторов',
              'heat': 'Тепло',
              'meters': 'Счётчики',
              'staff': 'Сотрудники',
              'inventory': 'Инвентарь',
              'tenant-card': 'Карточка арендатора',
              'stele': 'Рекламная стела',
              'counterparties': 'Контрагенты',
              'floorplan': 'План этажей',
              'site': 'Сайт и заявки',
              'units': 'Помещения',
              'kb': 'База знаний',
              'ai': 'AI Ассистент',
              'invoices': 'Счета арендаторов',
              'incoming-invoices': 'Входящие счета',
              'payment-calendar': 'Платёжный календарь',
            }[page] || 'Маяк'}
            </div>
            <div style={{ fontSize: 13, color: '#9ca3af', marginTop: 2 }}>Бизнес-центр Маяк</div>
          </div>
          <div style={{ display: 'flex', background: '#f3f4f6', borderRadius: 6, padding: 2, gap: 1 }}>
            {['Сегодня', 'Неделя', 'Месяц'].map((p, i) => (
              <button key={p} style={{ padding: '4px 12px', borderRadius: 4, fontSize: 12, fontWeight: 500, border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: i === 0 ? '#fff' : 'transparent', color: i === 0 ? '#111' : '#6b7280', boxShadow: i === 0 ? '0 1px 2px #0001' : 'none' }}>{p}</button>
            ))}
          </div>
        </header>
        <main style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          {page === 'dashboard' && <Dashboard />}
          {page === 'invoices' && <InvoicesPage onOpenInvoice={(inv) => { setSelectedInvoice(inv); setPage('invoice-detail') }} />}
          {page === 'tenants' && <Tenants onOpenTenant={(id) => { setSelectedTenantId(id); setPage('tenant-card') }} onAddTenant={() => setPage('tenant-new')} />}
          {page === 'tasks' && <TasksPage />}
          {page === 'ai' && <AIAssistantPage />}
          {page === 'kb' && <KnowledgeBasePage />}
          {page === 'tenant-card' && <TenantCardPage tenantId={selectedTenantId} onBack={() => setPage('tenants')} onCreateInvoice={() => setPage('billing')} />}
          {page === 'reference' && <ReferencesPage />}
          {page === 'billing' && <BillingPage />}
          {page === 'tenant-new' && <TenantNewPage onBack={() => setPage('tenants')} onSaved={() => setPage('tenants')} />}
          {page === 'my-tasks' && <MyTasksPage />}
          {page === 'repairs' && <RepairsPage />}
          {page === 'contracts' && <ContractsPage />}
          {page === 'counterparties' && <CounterpartiesPage />}
          {page === 'letters' && <LettersPage />}
          {page === 'bank' && <BankPage />}
          {page === 'reconcile' && <ReconcilePage />}
          {page === 'ledger' && <LedgerPage />}
          {page === 'heat' && <HeatPage />}
          {page === 'meters' && <MetersPage />}
          {page === 'staff' && <StaffPage />}
          {page === 'inventory' && <InventoryPage />}
          {page === 'floorplan' && <FloorPlanPage onOpenTenant={(id) => { setSelectedTenantId(id); setPage('tenant-card') }} />}
          {page === 'units' && <UnitsPage />}
          {page === 'site' && <SiteAdminPage />}
          {page === 'invoice-detail' && selectedInvoice && <InvoiceDetailPage invoice={selectedInvoice} onBack={() => setPage('invoices')} />}
          {page === 'import-tenants' && <ImportTenantsPage onDone={() => setPage('tenants')} />}
          {page === 'stele' && <AdvertisingStele />}
          {page === 'incoming-invoices' && <IncomingInvoicesPage />}
          {page === 'payment-calendar' && <PaymentCalendarPage />}
          {showSettings && <SettingsModal onClose={() => setShowSettings(false)} onLogout={() => { setShowSettings(false); setUser(null) }} />}
        </main>
      </div>
    </div>
  )
}
