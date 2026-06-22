import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import { AuthPage } from './pages/Auth'
import { AIAssistantPage } from './pages/AIAssistant'
import { KnowledgeBasePage } from './pages/KnowledgeBase'
import { TenantCardPage } from './pages/TenantCard'
import { mockStats, mockTasks, mockOverdue, mockEvents, mockInvoices, mockTenants } from './lib/mockData'

type Page = 'dashboard' | 'tenants' | 'invoices' | 'tasks' | 'ai' | 'kb' | 'tenant-card'

const NAV = [
  { id: 'dashboard', label: 'Сводка дня', icon: '⊞' },
  { id: 'tenants', label: 'Арендаторы', icon: '◎' },
  { id: 'invoices', label: 'Счета', icon: '◈' },
  { id: 'tasks', label: 'Задачи', icon: '✓' },
  { id: 'ai', label: 'AI Ассистент', icon: '✦' },
  { id: 'kb', label: 'База знаний', icon: '◉' },
] as const

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
  return <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 500, background: b.bg, color: b.color }}>{b.label}</span>
}

function KpiCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e8ebf3', borderRadius: 9, padding: '11px 13px' }}>
      <div style={{ fontSize: 10, color: '#8596b4', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.4px' }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 600, color: color ?? '#1a2240', lineHeight: 1, marginBottom: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: '#8596b4' }}>{sub}</div>}
    </div>
  )
}

function Dashboard() {
  const s = mockStats
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 8 }}>
        <KpiCard label="Заполняемость" value={`${s.occupancyRate}%`} sub={`${s.occupiedUnits} из ${s.totalUnits} офисов`} color="#22c55e" />
        <KpiCard label="Выручка / месяц" value={`${s.totalMonthlyRevenue.toLocaleString('ru')} ₽`} />
        <KpiCard label="Просрочено счетов" value={s.overdueInvoicesCount} sub={`${s.overdueInvoicesTotal.toLocaleString('ru')} ₽ долг`} color="#ef4444" />
        <KpiCard label="Открытые заявки" value={s.openRequestsCount} color="#f59e0b" />
        <KpiCard label="Истекают договоры" value={s.expiringLeasesCount} sub="в течение 30 дней" color="#f59e0b" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div style={{ background: '#fff', border: '1px solid #e8ebf3', borderRadius: 9, padding: '13px 15px' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#1a2240', marginBottom: 10 }}>Задачи на сегодня</div>
          {mockTasks.map(t => (
            <div key={t.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '7px 0', borderBottom: '1px solid #f0f2f8' }}>
              <div style={{ width: 3, height: 36, borderRadius: 2, background: SOURCE_COLOR[t.source], flexShrink: 0, marginTop: 2 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: '#1a2240' }}>{PRIORITY_PREFIX[t.priority]}{t.title}</div>
                <div style={{ fontSize: 10, color: '#8596b4', marginTop: 2 }}>{t.source === 'OWNER' ? 'от руководителя' : t.source === 'SYSTEM' ? 'авто' : 'личная'}</div>
              </div>
              <Badge s={t.status === 'OPEN' ? 'DRAFT' : 'SENT'} />
            </div>
          ))}
        </div>

        <div style={{ background: '#fff', border: '1px solid #e8ebf3', borderRadius: 9, padding: '13px 15px' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#1a2240', marginBottom: 10 }}>Просроченные счета</div>
          {mockOverdue.map(inv => (
            <div key={inv.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f0f2f8' }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 500, color: '#1a2240' }}>{inv.lease.tenant.fullName}</div>
                <div style={{ fontSize: 10, color: '#8596b4' }}>Офис {inv.lease.unit.number} · №{inv.number}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#ef4444' }}>{inv.total.toLocaleString('ru')} ₽</div>
                <div style={{ fontSize: 10, color: '#bbc4d6' }}>+{inv.daysOverdue} дней</div>
              </div>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, marginTop: 4, borderTop: '1px solid #f0f2f8' }}>
            <span style={{ fontSize: 10, color: '#8596b4' }}>Итого долг</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#ef4444' }}>{mockStats.overdueInvoicesTotal.toLocaleString('ru')} ₽</span>
          </div>
        </div>
      </div>

      <div style={{ background: '#fff', border: '1px solid #e8ebf3', borderRadius: 9, padding: '13px 15px' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#1a2240', marginBottom: 10 }}>Ближайшие события</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>
          {mockEvents.map(e => (
            <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '1px solid #f0f2f8' }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: EVENT_DOT[e.eventType] ?? '#9ca3af', flexShrink: 0 }} />
              <div style={{ fontSize: 10, color: '#8596b4', width: 48, flexShrink: 0 }}>{e.eventDate.slice(5).replace('-', ' ')}</div>
              <div style={{ fontSize: 11, color: '#374151' }}>{e.title}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function Invoices() {
  const [filter, setFilter] = useState('')
  const filtered = filter ? mockInvoices.filter(i => i.status === filter) : mockInvoices
  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {['', 'DRAFT', 'SENT', 'OVERDUE', 'PAID'].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
              borderColor: filter === s ? '#4f6ef7' : '#e8ebf3',
              background: filter === s ? '#eff3ff' : '#fff',
              color: filter === s ? '#4f6ef7' : '#6b7280' }}>
            {s ? (STATUS_BADGE[s]?.label ?? s) : 'Все'}
          </button>
        ))}
      </div>
      <div style={{ background: '#fff', border: '1px solid #e8ebf3', borderRadius: 9, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#f8f9fc', borderBottom: '1px solid #e8ebf3' }}>
              {['Номер', 'Арендатор', 'Офис', 'Период', 'Сумма', 'Статус'].map(h => (
                <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 500, color: '#8596b4', fontSize: 11 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(inv => (
              <tr key={inv.id} style={{ borderBottom: '1px solid #f0f2f8' }}>
                <td style={{ padding: '9px 12px', fontWeight: 500, color: '#1a2240' }}>№{inv.number}</td>
                <td style={{ padding: '9px 12px', color: '#374151' }}>{inv.lease.tenant.fullName}</td>
                <td style={{ padding: '9px 12px', color: '#374151' }}>{inv.lease.unit.number}</td>
                <td style={{ padding: '9px 12px', color: '#8596b4' }}>{inv.periodStart?.slice(0, 7)}</td>
                <td style={{ padding: '9px 12px', fontWeight: 600, color: inv.status === 'OVERDUE' ? '#ef4444' : '#1a2240' }}>{inv.total.toLocaleString('ru')} ₽</td>
                <td style={{ padding: '9px 12px' }}><Badge s={inv.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
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
function Tenants({ onOpenTenant }: { onOpenTenant: () => void }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e8ebf3', borderRadius: 9, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: '#f8f9fc', borderBottom: '1px solid #e8ebf3' }}>
            {['Имя / компания', 'Тип', 'ИНН', 'Офис', 'Договор до', 'Статус'].map(h => (
              <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 500, color: '#8596b4', fontSize: 11 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {mockTenants.map(t => (
            <tr key={t.id} style={{ borderBottom: '1px solid #f0f2f8' }}>
              <td style={{ padding: '9px 12px', fontWeight: 500, color: '#4f6ef7', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => onOpenTenant()}>{t.fullName}</td>
              <td style={{ padding: '9px 12px', color: '#6b7280' }}>{TYPE_LABEL[t.type]}</td>
              <td style={{ padding: '9px 12px', fontFamily: 'monospace', color: '#8596b4', fontSize: 11 }}>{t.inn ?? '—'}</td>
              <td style={{ padding: '9px 12px', color: '#374151' }}>{t.unitNumber}</td>
              <td style={{ padding: '9px 12px', color: t.leaseStatus === 'DEBT' ? '#ef4444' : t.leaseStatus === 'EXPIRING' ? '#d97706' : '#6b7280' }}>{t.leaseEnd}</td>
              <td style={{ padding: '9px 12px' }}><Badge s={t.leaseStatus} /></td>
            <td style={{ padding: '9px 12px' }}><button onClick={() => onOpenTenant()} style={{ padding: '3px 10px', fontSize: 11, borderRadius: 5, border: '1px solid #e8ebf3', color: '#374151', background: '#f9fafb', cursor: 'pointer', marginRight: 4 }}>Открыть</button><button onClick={() => sendWelcomeEmail(t)} style={{ padding: '3px 10px', fontSize: 11, borderRadius: 5, border: '1px solid #4f6ef7', color: '#4f6ef7', background: '#eff3ff', cursor: 'pointer' }}>Email</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Tasks() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      {mockTasks.map(t => (
        <div key={t.id} style={{ background: '#fff', border: '1px solid #e8ebf3', borderRadius: 9, padding: '12px 15px', display: 'flex', alignItems: 'center', gap: 10, borderLeft: `3px solid ${SOURCE_COLOR[t.source]}` }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: '#1a2240' }}>{PRIORITY_PREFIX[t.priority]}{t.title}</div>
            <div style={{ fontSize: 11, color: '#8596b4', marginTop: 3 }}>
              {t.source === 'OWNER' ? 'от руководителя' : t.source === 'SYSTEM' ? 'авто · ежемесячно' : 'личная задача'} · срок: сегодня
            </div>
          </div>
          <Badge s={t.status === 'OPEN' ? 'DRAFT' : 'SENT'} />
        </div>
      ))}
    </div>
  )
}

export default function App() {
  const [page, setPage] = useState<Page>('dashboard')
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

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
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f0f2f8', fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>
      <aside style={{ width: 200, flexShrink: 0, background: '#1e2235', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '14px 14px 12px', borderBottom: '1px solid #ffffff12', display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: '#4f6ef7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff' }}>М</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>Маяк</div>
            <div style={{ fontSize: 10, color: '#6b7c9e' }}>Property OS</div>
          </div>
        </div>
        <nav style={{ padding: '8px 0', flex: 1 }}>
          {NAV.map(n => (
            <button key={n.id} onClick={() => setPage(n.id as Page)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 14px', width: '100%', border: 'none', borderLeft: `2px solid ${page === n.id ? '#4f6ef7' : 'transparent'}`, background: page === n.id ? '#4f6ef715' : 'transparent', color: page === n.id ? '#7c9dff' : '#8596b4', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', textAlign: 'left', fontWeight: page === n.id ? 500 : 400 }}>
              <span style={{ fontSize: 14 }}>{n.icon}</span>{n.label}
            </button>
          ))}
        </nav>
        <div style={{ padding: '12px 14px', borderTop: '1px solid #ffffff12', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#4f6ef7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 600, color: '#fff' }}>АС</div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 500, color: '#c9cdd8' }}>Андрей Соколов</div>
            <div style={{ fontSize: 10, color: '#4b5563' }}>Управляющий</div>
          </div>
        </div>
      </aside>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <header style={{ background: '#fff', borderBottom: '1px solid #e8ebf3', padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 600, color: '#1a2240' }}>
              {page === 'dashboard' ? 'Сводка дня' : page === 'tenants' ? 'Арендаторы' : page === 'invoices' ? 'Счета' : 'Задачи'}
            </div>
            <div style={{ fontSize: 11, color: '#8596b4', marginTop: 1 }}>Бизнес-центр Маяк</div>
          </div>
          <div style={{ display: 'flex', background: '#f0f2f8', borderRadius: 7, padding: 2, gap: 2 }}>
            {['Сегодня', 'Неделя', 'Месяц'].map((p, i) => (
              <button key={p} style={{ padding: '4px 11px', borderRadius: 5, fontSize: 11, fontWeight: 500, border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: i === 0 ? '#fff' : 'transparent', color: i === 0 ? '#1a2240' : '#8596b4' }}>{p}</button>
            ))}
          </div>
        </header>
        <main style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          {page === 'dashboard' && <Dashboard />}
          {page === 'invoices' && <Invoices />}
          {page === 'tenants' && <Tenants onOpenTenant={() => setPage('tenant-card')} />}
          {page === 'tasks' && <Tasks />}
          {page === 'ai' && <AIAssistantPage />}
          {page === 'kb' && <KnowledgeBasePage />}
          {page === 'tenant-card' && <TenantCardPage onBack={() => setPage('tenants')} />}
        </main>
      </div>
    </div>
  )
}
