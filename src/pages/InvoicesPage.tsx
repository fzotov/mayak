import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

interface Invoice {
  id: string
  number: string
  status: string
  period: string
  due_date: string
  rent_amount: number
  cleaning_amount: number
  utilities_amount: number
  services_amount: number
  total_amount: number
  tenant_id: string | null
  unit_id: string | null
  tenant?: { full_name: string }
  unit?: { number: string }
  _status?: string
}

interface Tenant { id: string; full_name: string }
interface Unit { id: string; number: string }
interface Service { id: string; name: string; price: number; unit: string; category: string }

const STATUSES: Record<string, { label: string; bg: string; color: string }> = {
  draft:   { label: 'Черновик',  bg: '#f1f5f9', color: '#64748b' },
  sent:    { label: 'Выставлен', bg: '#eff6ff', color: '#3b82f6' },
  paid:    { label: 'Оплачен',   bg: '#f0fdf4', color: '#22c55e' },
  overdue: { label: 'Просрочен', bg: '#fef2f2', color: '#ef4444' },
}

const MONTHS = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']

const SI: React.CSSProperties = {
  width: '100%', border: '1px solid #e5e7eb', borderRadius: 6,
  padding: '7px 10px', fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
}
const SL: React.CSSProperties = { fontSize: 12, color: '#6b7280', marginBottom: 4, display: 'block', fontWeight: 500 }

function Badge({ s }: { s: string }) {
  const b = STATUSES[s] ?? { label: s, bg: '#f1f5f9', color: '#64748b' }
  return <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 12, fontWeight: 500, background: b.bg, color: b.color }}>{b.label}</span>
}

const now = new Date()

function fmtPeriod(s: string) {
  if (!s) return '—'
  const [y, m] = s.split('-')
  return `${MONTHS[Number(m) - 1]} ${y}`
}
function fmtDate(s: string) { return s ? new Date(s).toLocaleDateString('ru') : '—' }
function fmtAmt(n: number) { return n != null ? n.toLocaleString('ru') + ' ₽' : '—' }

// ── Автономер ────────────────────────────────────────────────────────────────
async function nextInvoiceNumber(): Promise<string> {
  const year = now.getFullYear()
  const prefix = `${year}-`
  const { data } = await supabase
    .from('invoices')
    .select('number')
    .like('number', `${prefix}%`)
    .order('number', { ascending: false })
    .limit(1)
  const last = data?.[0]?.number
  const seq = last ? Number(last.replace(prefix, '')) + 1 : 1
  return `${prefix}${String(seq).padStart(3, '0')}`
}

// ── Модалка просмотра счёта ──────────────────────────────────────────────────
function InvoiceViewModal({ invoice, onClose, onStatusChange }: {
  invoice: Invoice
  onClose: () => void
  onStatusChange: (id: string, status: string) => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  function print() {
    const w = window.open('', '_blank')
    if (!w || !ref.current) return
    w.document.write(`<html><head><title>Счёт ${invoice.number}</title><style>
      body{font-family:Arial,sans-serif;margin:40px;color:#111;font-size:14px}
      h2{margin:0 0 4px;font-size:20px}
      .meta{color:#6b7280;margin:4px 0 20px;font-size:13px}
      .row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #eee}
      .total{font-size:18px;font-weight:700;text-align:right;margin-top:20px;padding-top:12px;border-top:2px solid #ddd}
    </style></head><body>`)
    w.document.write(ref.current.innerHTML)
    w.document.write('</body></html>')
    w.document.close()
    w.print()
  }

  const lines = [
    { label: 'Аренда', val: invoice.rent_amount },
    { label: 'Уборка', val: invoice.cleaning_amount },
    { label: 'Коммунальные услуги', val: invoice.utilities_amount },
    { label: 'Дополнительные услуги', val: invoice.services_amount },
  ].filter(l => Number(l.val) > 0)

  const status = invoice._status ?? invoice.status

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#00000066', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 560, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e8ebf3', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#1a2240' }}>Счёт {invoice.number}</div>
            <div style={{ fontSize: 13, color: '#8596b4', marginTop: 2 }}>{fmtPeriod(invoice.period)}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Badge s={status} />
            <button onClick={print} style={{ padding: '6px 12px', border: 'none', borderRadius: 7, background: '#4f6ef7', color: '#fff', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Печать</button>
            <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, color: '#9ca3af', cursor: 'pointer', lineHeight: 1 }}>✕</button>
          </div>
        </div>

        <div style={{ padding: 24 }}>
          <div ref={ref}>
            <h2>Счёт № {invoice.number}</h2>
            <p className="meta">Период: {fmtPeriod(invoice.period)} · Срок оплаты: {fmtDate(invoice.due_date)}</p>
            <div style={{ marginBottom: 16, fontSize: 14, color: '#374151' }}>
              <div><b>Арендатор:</b> {invoice.tenant?.full_name ?? '—'}</div>
              <div style={{ marginTop: 4 }}><b>Помещение:</b> {invoice.unit ? `Офис ${invoice.unit.number}` : '—'}</div>
            </div>
            {lines.map(l => (
              <div key={l.label} className="row" style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid #f0f2f8', fontSize: 14, color: '#374151' }}>
                <span>{l.label}</span>
                <span style={{ fontWeight: 500 }}>{Number(l.val).toLocaleString('ru')} ₽</span>
              </div>
            ))}
            <div className="total" style={{ fontSize: 18, fontWeight: 700, textAlign: 'right', marginTop: 16, paddingTop: 12, borderTop: '2px solid #e5e7eb', color: '#1a2240' }}>
              Итого: {invoice.total_amount.toLocaleString('ru')} ₽
            </div>
          </div>
        </div>

        {(status === 'draft' || status === 'sent' || status === 'overdue') && (
          <div style={{ padding: '14px 20px', borderTop: '1px solid #e8ebf3', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            {status === 'draft' && (
              <button onClick={() => { onStatusChange(invoice.id, 'sent'); onClose() }}
                style={{ padding: '8px 16px', border: 'none', borderRadius: 8, background: '#3b82f6', color: '#fff', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
                Выставить →
              </button>
            )}
            {(status === 'sent' || status === 'overdue') && (
              <button onClick={() => { onStatusChange(invoice.id, 'paid'); onClose() }}
                style={{ padding: '8px 16px', border: 'none', borderRadius: 8, background: '#22c55e', color: '#fff', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
                Отметить оплаченным ✓
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Модалка создания счёта ───────────────────────────────────────────────────
function InvoiceModal({ tenants, units, services, onClose, onSaved }: {
  tenants: Tenant[]; units: Unit[]; services: Service[]
  onClose: () => void; onSaved: () => void
}) {
  const defaultPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const [form, setForm] = useState({
    number: '', period: defaultPeriod, due_date: '', status: 'draft',
    tenant_id: '', unit_id: '', rent_amount: 0, cleaning_amount: 0, utilities_amount: 0,
  })
  const [selectedSvcs, setSelectedSvcs] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState(false)
  const [autoLoading, setAutoLoading] = useState(false)
  const [autoHint, setAutoHint] = useState('')

  useEffect(() => {
    nextInvoiceNumber().then(n => setForm(f => ({ ...f, number: n })))
  }, [])

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  const extraTotal = services.filter(s => selectedSvcs[s.id]).reduce((sum, s) => sum + s.price, 0)
  const total = Number(form.rent_amount) + Number(form.cleaning_amount) + Number(form.utilities_amount) + extraTotal

  async function onTenantChange(tenantId: string) {
    set('tenant_id', tenantId)
    if (!tenantId) { setAutoHint(''); return }
    setAutoLoading(true)
    setAutoHint('')

    const { data: contracts } = await supabase
      .from('contracts')
      .select('rent_amount, unit_id')
      .eq('tenant_id', tenantId)
      .in('status', ['active', 'draft'])
      .order('start_date', { ascending: false })
      .limit(1)

    const contract = contracts?.[0]
    const hints: string[] = []

    if (contract) {
      if (contract.rent_amount != null) {
        set('rent_amount', contract.rent_amount)
        hints.push(`аренда ${Number(contract.rent_amount).toLocaleString('ru')} ₽`)
      }
      if (contract.unit_id) {
        set('unit_id', contract.unit_id)
        const { data: meters } = await supabase.from('meters').select('id, tariff').eq('unit_id', contract.unit_id)
        if (meters?.length) {
          let utilTotal = 0
          for (const meter of meters) {
            const { data: readings } = await supabase
              .from('meter_readings').select('consumption, amount')
              .eq('meter_id', meter.id).order('reading_date', { ascending: false }).limit(1)
            const r = readings?.[0]
            if (r) utilTotal += Number(r.amount ?? (r.consumption && meter.tariff ? r.consumption * meter.tariff : 0))
          }
          if (utilTotal > 0) {
            set('utilities_amount', Math.round(utilTotal))
            hints.push(`коммунальные ${Math.round(utilTotal).toLocaleString('ru')} ₽`)
          }
        }
      }
    }

    setAutoHint(hints.length ? `✓ Автозаполнено: ${hints.join(', ')}` : '⚠ Договор не найден — заполните вручную')
    setAutoLoading(false)
  }

  async function save() {
    if (!form.number.trim()) return
    setSaving(true)
    const { error } = await supabase.from('invoices').insert({
      number: form.number.trim(), period: form.period,
      due_date: form.due_date || null,
      tenant_id: form.tenant_id || null, unit_id: form.unit_id || null,
      rent_amount: Number(form.rent_amount) || 0,
      cleaning_amount: Number(form.cleaning_amount) || 0,
      utilities_amount: Number(form.utilities_amount) || 0,
      services_amount: extraTotal,
      total_amount: total, status: form.status,
    })
    setSaving(false)
    if (error) { alert('Ошибка: ' + error.message); return }
    onSaved()
  }

  const optionalSvcs = services.filter(s => s.category !== 'Аренда')

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#00000066', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 560, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e8ebf3', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#1a2240' }}>Новый счёт</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, color: '#9ca3af', cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={SL}>Номер счёта</label>
              <input style={SI} value={form.number} onChange={e => set('number', e.target.value)} />
            </div>
            <div>
              <label style={SL}>Статус</label>
              <select style={SI} value={form.status} onChange={e => set('status', e.target.value)}>
                {Object.entries(STATUSES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label style={SL}>Арендатор {autoLoading && <span style={{ color: '#4f6ef7' }}>— загрузка...</span>}</label>
            <select style={SI} value={form.tenant_id} onChange={e => onTenantChange(e.target.value)}>
              <option value="">— не выбран —</option>
              {tenants.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
            </select>
            {autoHint && <div style={{ marginTop: 5, fontSize: 12, color: autoHint.startsWith('✓') ? '#16a34a' : '#d97706' }}>{autoHint}</div>}
          </div>
          <div>
            <label style={SL}>Помещение</label>
            <select style={SI} value={form.unit_id} onChange={e => set('unit_id', e.target.value)}>
              <option value="">— не выбрано —</option>
              {units.map(u => <option key={u.id} value={u.id}>Офис {u.number}</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={SL}>Период</label>
              <input style={SI} type="month" value={form.period} onChange={e => set('period', e.target.value)} />
            </div>
            <div>
              <label style={SL}>Срок оплаты</label>
              <input style={SI} type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)} />
            </div>
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#6b7280', borderTop: '1px solid #e5e7eb', paddingTop: 12 }}>Суммы</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={SL}>Аренда, ₽</label>
              <input style={SI} type="number" min="0" value={form.rent_amount} onChange={e => set('rent_amount', e.target.value)} />
            </div>
            <div>
              <label style={SL}>Уборка, ₽</label>
              <input style={SI} type="number" min="0" value={form.cleaning_amount} onChange={e => set('cleaning_amount', e.target.value)} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={SL}>Коммунальные, ₽</label>
              <input style={SI} type="number" min="0" value={form.utilities_amount} onChange={e => set('utilities_amount', e.target.value)} />
            </div>
          </div>
          {optionalSvcs.length > 0 && (
            <div>
              <label style={SL}>Доп. услуги (по выбору)</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '10px 12px', background: '#f8f9fc', borderRadius: 8, border: '1px solid #e5e7eb' }}>
                {optionalSvcs.map(s => (
                  <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14, color: '#374151' }}>
                    <input type="checkbox" checked={!!selectedSvcs[s.id]}
                      onChange={e => setSelectedSvcs(p => ({ ...p, [s.id]: e.target.checked }))}
                      style={{ width: 15, height: 15, cursor: 'pointer', accentColor: '#4f6ef7' }} />
                    <span style={{ flex: 1 }}>{s.name}</span>
                    <span style={{ color: '#6b7280', fontWeight: 500 }}>{s.price.toLocaleString('ru')} ₽</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          <div style={{ background: '#f0fdf4', borderRadius: 8, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 14, color: '#166534', fontWeight: 500 }}>Итого к оплате</span>
            <span style={{ fontSize: 22, fontWeight: 700, color: '#166534' }}>{total.toLocaleString('ru')} ₽</span>
          </div>
        </div>
        <div style={{ padding: '14px 20px', borderTop: '1px solid #e8ebf3', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 16px', border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', color: '#374151', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>Отмена</button>
          <button onClick={save} disabled={saving}
            style={{ padding: '8px 20px', border: 'none', borderRadius: 8, background: '#4f6ef7', color: '#fff', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Сохранение...' : 'Создать счёт'}
          </button>
        </div>
      </div>
    </div>
  )
}

const STATUS_UP: Record<string, string> = { draft: 'DRAFT', sent: 'SENT', paid: 'PAID', overdue: 'OVERDUE' }

function toDetailFormat(inv: Invoice & { _status?: string }) {
  return {
    ...inv,
    number: inv.number,
    total: inv.total_amount,
    periodStart: inv.period,
    dueDate: inv.due_date,
    status: STATUS_UP[inv._status ?? inv.status] ?? inv.status.toUpperCase(),
    lease: {
      tenant: { fullName: inv.tenant?.full_name ?? '—' },
      unit: { number: inv.unit?.number ?? '—' },
    },
  }
}

// ── Главная страница ─────────────────────────────────────────────────────────
export function InvoicesPage({ onOpenInvoice }: { onOpenInvoice?: (inv: any) => void }) {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('')
  const [filterTenant, setFilterTenant] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null)

  async function load() {
    const [{ data: inv }, { data: ten }, { data: un }, { data: svc }] = await Promise.all([
      supabase.from('invoices').select('*, tenant:tenants(full_name), unit:units(number)').order('created_at', { ascending: false }),
      supabase.from('tenants').select('id, full_name').order('full_name'),
      supabase.from('units').select('id, number').order('number'),
      supabase.from('services').select('id, name, price, unit, category').order('name'),
    ])
    setInvoices(inv || [])
    setTenants(ten || [])
    setUnits(un || [])
    setServices(svc || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function setStatus(id: string, status: string) {
    const { error } = await supabase.from('invoices').update({ status }).eq('id', id)
    if (error) { alert('Ошибка обновления статуса: ' + error.message); return }
    setInvoices(prev => prev.map(i => i.id === id ? { ...i, status } : i))
  }

  async function remove(id: string) {
    if (!confirm('Удалить счёт?')) return
    const { error } = await supabase.from('invoices').delete().eq('id', id)
    if (error) { alert('Ошибка удаления: ' + error.message); return }
    setInvoices(prev => prev.filter(i => i.id !== id))
  }

  const autoStatus = (inv: Invoice) => {
    if (inv.status === 'paid' || inv.status === 'draft') return inv.status
    if (inv.due_date && new Date(inv.due_date) < new Date()) return 'overdue'
    return inv.status
  }

  const displayed = invoices.map(i => ({ ...i, _status: autoStatus(i) }))
  const filtered = displayed
    .filter(i => !filterStatus || i._status === filterStatus)
    .filter(i => !filterTenant || i.tenant_id === filterTenant)

  const curMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const totalDebt = displayed.filter(i => i._status === 'overdue').reduce((s, i) => s + i.total_amount, 0)
  const paidMonth = displayed.filter(i => i._status === 'paid' && i.period?.startsWith(curMonth)).reduce((s, i) => s + i.total_amount, 0)
  const overdueCount = displayed.filter(i => i._status === 'overdue').length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
        {[
          { label: 'Всего счетов', value: String(displayed.length), color: '#1a2240' },
          { label: 'Оплачено в этом месяце', value: fmtAmt(paidMonth), color: '#22c55e' },
          { label: 'Просрочено', value: `${overdueCount} · ${fmtAmt(totalDebt)}`, color: '#ef4444' },
          { label: 'Выставлено', value: String(displayed.filter(i => i._status === 'sent').length), color: '#3b82f6' },
        ].map(k => (
          <div key={k.label} style={{ background: '#fff', border: '1px solid #e8ebf3', borderRadius: 9, padding: '11px 13px' }}>
            <div style={{ fontSize: 11, color: '#8596b4', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.4px' }}>{k.label}</div>
            <div style={{ fontSize: 17, fontWeight: 600, color: k.color, lineHeight: 1.3 }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Фильтры */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(['', 'draft', 'sent', 'paid', 'overdue'] as const).map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                borderColor: filterStatus === s ? '#4f6ef7' : '#e8ebf3',
                background: filterStatus === s ? '#eff3ff' : '#fff',
                color: filterStatus === s ? '#4f6ef7' : '#6b7280' }}>
              {s ? (STATUSES[s]?.label ?? s) : 'Все'}
            </button>
          ))}
          <select value={filterTenant} onChange={e => setFilterTenant(e.target.value)}
            style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #e8ebf3', fontSize: 13, background: filterTenant ? '#eff3ff' : '#fff', color: filterTenant ? '#4f6ef7' : '#6b7280', cursor: 'pointer', fontFamily: 'inherit', outline: 'none' }}>
            <option value="">Все арендаторы</option>
            {tenants.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
          </select>
        </div>
        <button onClick={() => setShowCreate(true)}
          style={{ padding: '8px 16px', border: 'none', borderRadius: 8, background: '#4f6ef7', color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
          + Новый счёт
        </button>
      </div>

      {/* Таблица */}
      <div style={{ background: '#fff', border: '1px solid #e8ebf3', borderRadius: 9, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#8596b4', fontSize: 14 }}>Загрузка...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#8596b4', fontSize: 14 }}>Счета не найдены</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: '#f8f9fc', borderBottom: '1px solid #e8ebf3' }}>
                {['Номер', 'Арендатор', 'Помещение', 'Период', 'Срок', 'Сумма', 'Статус', ''].map(h => (
                  <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 500, color: '#8596b4', fontSize: 13, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(inv => (
                <tr key={inv.id}
                  onClick={() => onOpenInvoice ? onOpenInvoice(toDetailFormat(inv)) : setViewInvoice(inv)}
                  style={{ borderBottom: '1px solid #f0f2f8', cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f3f6ff')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}>
                  <td style={{ padding: '9px 12px', fontWeight: 600, color: '#4f6ef7' }}>{inv.number}</td>
                  <td style={{ padding: '9px 12px', color: '#374151' }}>{inv.tenant?.full_name ?? '—'}</td>
                  <td style={{ padding: '9px 12px', color: '#6b7280' }}>{inv.unit ? `Офис ${inv.unit.number}` : '—'}</td>
                  <td style={{ padding: '9px 12px', color: '#8596b4', fontSize: 13 }}>{fmtPeriod(inv.period)}</td>
                  <td style={{ padding: '9px 12px', color: inv._status === 'overdue' ? '#ef4444' : '#6b7280', fontSize: 13 }}>{fmtDate(inv.due_date)}</td>
                  <td style={{ padding: '9px 12px', fontWeight: 600, color: '#1a2240', whiteSpace: 'nowrap' }}>{fmtAmt(inv.total_amount)}</td>
                  <td style={{ padding: '9px 12px' }}><Badge s={inv._status!} /></td>
                  <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }} onClick={e => e.stopPropagation()}>
                    {inv._status === 'draft' && (
                      <button onClick={() => setStatus(inv.id, 'sent')}
                        style={{ padding: '3px 8px', fontSize: 12, borderRadius: 5, border: '1px solid #3b82f6', color: '#3b82f6', background: '#eff6ff', cursor: 'pointer', marginRight: 4 }}>
                        Выставить
                      </button>
                    )}
                    {(inv._status === 'sent' || inv._status === 'overdue') && (
                      <button onClick={() => setStatus(inv.id, 'paid')}
                        style={{ padding: '3px 8px', fontSize: 12, borderRadius: 5, border: '1px solid #22c55e', color: '#22c55e', background: '#f0fdf4', cursor: 'pointer', marginRight: 4 }}>
                        Оплачен
                      </button>
                    )}
                    <button onClick={() => remove(inv.id)}
                      style={{ padding: '3px 8px', fontSize: 12, borderRadius: 5, border: '1px solid #fee2e2', color: '#ef4444', background: '#fef2f2', cursor: 'pointer' }}>
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && (
        <InvoiceModal tenants={tenants} units={units} services={services}
          onClose={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); load() }} />
      )}
      {viewInvoice && (
        <InvoiceViewModal invoice={viewInvoice} onClose={() => setViewInvoice(null)}
          onStatusChange={(id, status) => { setStatus(id, status); setViewInvoice(null) }} />
      )}
    </div>
  )
}
