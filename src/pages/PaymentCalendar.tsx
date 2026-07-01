import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

interface PaymentEntry {
  id: string
  name: string
  amount: number
  due_date: string
  type: string
  status: string
  incoming_invoice_id: string | null
  regular_payment_id: string | null
  building_id: string | null
}

interface RegularPayment {
  id: string
  name: string
  amount: number
  day_of_month: number
  category: string | null
  description: string | null
  active: boolean
}

const ACCENT = '#4f6ef7'
const TEXT = '#1a2240'
const GRAY = '#8596b4'
const BORDER = '#e8ebf3'

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  PENDING: { label: 'Ожидает',   bg: '#eff3ff', color: '#4f6ef7' },
  PAID:    { label: 'Оплачен',   bg: '#f0fdf4', color: '#16a34a' },
  OVERDUE: { label: 'Просрочен', bg: '#fef2f2', color: '#ef4444' },
}

const TYPE_LABEL: Record<string, string> = {
  REGULAR: 'Регулярный',
  INVOICE: 'Счёт',
  TASK:    'Задача',
}

function fmt(n: number) {
  return n.toLocaleString('ru-RU', { minimumFractionDigits: 0 }) + ' ₽'
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function getWeekLabel(dateStr: string, monthStart: Date) {
  const d = new Date(dateStr)
  const diff = Math.floor((d.getTime() - monthStart.getTime()) / 86400000)
  const week = Math.floor(diff / 7) + 1
  return `Неделя ${week}`
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${BORDER}`,
  fontSize: 14, color: TEXT, fontFamily: 'inherit', outline: 'none', background: '#fff',
  boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = { fontSize: 13, color: GRAY, fontWeight: 500, marginBottom: 4, display: 'block' }

const CATEGORIES = ['Аренда', 'Коммунальные', 'Охрана', 'Уборка', 'Интернет', 'Страхование', 'Налоги', 'Прочее']

export default function PaymentCalendarPage() {
  const [entries, setEntries] = useState<PaymentEntry[]>([])
  const [regulars, setRegulars] = useState<RegularPayment[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list')
  const [showRegularForm, setShowRegularForm] = useState(false)
  const [regForm, setRegForm] = useState({ name: '', amount: '', day_of_month: '1', category: 'Прочее', description: '' })
  const [saving, setSaving] = useState(false)
  const [currentMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })

  const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0)

  async function generateMonthlyEntries(regs: RegularPayment[]) {
    const y = currentMonth.getFullYear()
    const m = currentMonth.getMonth() + 1
    const monthStr = `${y}-${String(m).padStart(2, '0')}`

    const { data: existing } = await supabase
      .from('payment_calendar')
      .select('regular_payment_id')
      .gte('due_date', `${monthStr}-01`)
      .lte('due_date', `${monthStr}-31`)
      .eq('type', 'REGULAR')

    const existingIds = new Set((existing || []).map((e: any) => e.regular_payment_id))

    const toInsert = regs
      .filter(r => r.active && !existingIds.has(r.id))
      .map(r => {
        const day = Math.min(r.day_of_month, new Date(y, m, 0).getDate())
        return {
          name: r.name,
          amount: r.amount,
          due_date: `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
          type: 'REGULAR',
          status: 'PENDING',
          regular_payment_id: r.id,
        }
      })

    if (toInsert.length > 0) {
      await supabase.from('payment_calendar').insert(toInsert)
    }
  }

  async function load() {
    setLoading(true)
    const { data: regs } = await supabase.from('regular_payments').select('*').order('day_of_month')
    const regList = (regs as RegularPayment[]) || []
    setRegulars(regList)

    await generateMonthlyEntries(regList)

    const y = currentMonth.getFullYear()
    const m = currentMonth.getMonth() + 1
    const monthStr = `${y}-${String(m).padStart(2, '0')}`

    const { data } = await supabase
      .from('payment_calendar')
      .select('*')
      .gte('due_date', `${monthStr}-01`)
      .lte('due_date', `${monthStr}-31`)
      .order('due_date')

    // Auto-mark overdue
    const now = new Date()
    const updated = ((data as PaymentEntry[]) || []).map(e => {
      if (e.status === 'PENDING' && new Date(e.due_date) < now) return { ...e, status: 'OVERDUE' }
      return e
    })
    setEntries(updated)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function markPaid(id: string) {
    await supabase.from('payment_calendar').update({ status: 'PAID' }).eq('id', id)
    setEntries(prev => prev.map(e => e.id === id ? { ...e, status: 'PAID' } : e))
  }

  async function saveRegular() {
    if (!regForm.name || !regForm.amount) return
    setSaving(true)
    await supabase.from('regular_payments').insert({
      name: regForm.name,
      amount: parseFloat(regForm.amount.replace(',', '.')) || 0,
      day_of_month: parseInt(regForm.day_of_month) || 1,
      category: regForm.category,
      description: regForm.description || null,
      active: true,
    })
    setSaving(false)
    setShowRegularForm(false)
    setRegForm({ name: '', amount: '', day_of_month: '1', category: 'Прочее', description: '' })
    load()
  }

  const totalPlanned = entries.reduce((s, e) => s + e.amount, 0)
  const totalPaid = entries.filter(e => e.status === 'PAID').reduce((s, e) => s + e.amount, 0)
  const totalPending = entries.filter(e => e.status !== 'PAID').reduce((s, e) => s + e.amount, 0)

  // Group by week
  const weeks: Record<string, PaymentEntry[]> = {}
  entries.forEach(e => {
    const w = getWeekLabel(e.due_date, currentMonth)
    if (!weeks[w]) weeks[w] = []
    weeks[w].push(e)
  })

  // Calendar grid
  const daysInMonth = monthEnd.getDate()
  const firstDow = (currentMonth.getDay() + 6) % 7 // Mon-based
  const calEntries: Record<number, PaymentEntry[]> = {}
  entries.forEach(e => {
    const day = new Date(e.due_date).getDate()
    if (!calEntries[day]) calEntries[day] = []
    calEntries[day].push(e)
  })

  const monthLabel = currentMonth.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })

  return (
    <div style={{ padding: 24, maxWidth: 1200 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: TEXT, textTransform: 'capitalize' }}>Платежи · {monthLabel}</div>
          <div style={{ fontSize: 13, color: GRAY, marginTop: 2 }}>Регулярные платежи и счета за месяц</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {/* View toggle */}
          <div style={{ display: 'flex', border: `1px solid ${BORDER}`, borderRadius: 8, overflow: 'hidden' }}>
            {(['list', 'calendar'] as const).map(m => (
              <button key={m} onClick={() => setViewMode(m)} style={{
                padding: '7px 14px', border: 'none', background: viewMode === m ? ACCENT : '#fff',
                color: viewMode === m ? '#fff' : GRAY, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500,
              }}>
                {m === 'list' ? '☰ Список' : '📅 Календарь'}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowRegularForm(true)}
            style={{ padding: '9px 16px', borderRadius: 8, border: `1px solid ${BORDER}`, background: '#fff', color: TEXT, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            + Регулярный платёж
          </button>
        </div>
      </div>

      {/* KPI */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Запланировано', value: fmt(totalPlanned), color: TEXT },
          { label: 'Оплачено', value: fmt(totalPaid), color: '#16a34a' },
          { label: 'Остаток', value: fmt(totalPending), color: totalPending > 0 ? '#ef4444' : TEXT },
          { label: 'Всего платежей', value: String(entries.length), color: TEXT },
        ].map(k => (
          <div key={k.label} style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 10, padding: '14px 18px', flex: 1 }}>
            <div style={{ fontSize: 12, color: GRAY, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 6 }}>{k.label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: GRAY }}>Загрузка...</div>
      ) : viewMode === 'list' ? (
        /* LIST VIEW */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {Object.entries(weeks).map(([week, items]) => (
            <div key={week}>
              <div style={{ fontSize: 12, fontWeight: 700, color: GRAY, textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 8 }}>{week}</div>
              <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 10, overflow: 'hidden' }}>
                {items.map((e, idx) => {
                  const sc = STATUS_CONFIG[e.status] ?? { label: e.status, bg: '#f3f4f6', color: GRAY }
                  return (
                    <div key={e.id} style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: idx < items.length - 1 ? `1px solid #f3f4f6` : 'none' }}>
                      <div style={{ width: 36, height: 36, borderRadius: 8, background: '#f0f2f8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: GRAY, marginRight: 12, flexShrink: 0 }}>
                        {new Date(e.due_date).getDate()}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: TEXT }}>{e.name}</div>
                        <div style={{ fontSize: 12, color: GRAY, marginTop: 2 }}>{TYPE_LABEL[e.type] ?? e.type} · {fmtDate(e.due_date)}</div>
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: e.status === 'PAID' ? '#16a34a' : TEXT, marginRight: 16 }}>{fmt(e.amount)}</div>
                      <span style={{ background: sc.bg, color: sc.color, padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, marginRight: 12, whiteSpace: 'nowrap' }}>{sc.label}</span>
                      {e.status !== 'PAID' && (
                        <button onClick={() => markPaid(e.id)} style={{ padding: '5px 12px', borderRadius: 6, border: 'none', background: '#dcfce7', color: '#15803d', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, whiteSpace: 'nowrap' }}>✓ Оплачен</button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
          {entries.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: GRAY, background: '#fff', borderRadius: 10, border: `1px solid ${BORDER}` }}>Нет платежей в этом месяце</div>}
        </div>
      ) : (
        /* CALENDAR VIEW */
        <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 10, overflow: 'hidden' }}>
          {/* Day headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: `1px solid ${BORDER}` }}>
            {['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(d => (
              <div key={d} style={{ padding: '10px 8px', textAlign: 'center', fontSize: 12, fontWeight: 700, color: GRAY, background: '#f8f9fb' }}>{d}</div>
            ))}
          </div>
          {/* Day cells */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
            {Array.from({ length: firstDow }).map((_, i) => (
              <div key={`e${i}`} style={{ minHeight: 90, borderRight: `1px solid #f3f4f6`, borderBottom: `1px solid #f3f4f6`, background: '#fafbfc' }} />
            ))}
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
              const items = calEntries[day] || []
              const isToday = day === new Date().getDate() && currentMonth.getMonth() === new Date().getMonth()
              return (
                <div key={day} style={{ minHeight: 90, borderRight: `1px solid #f3f4f6`, borderBottom: `1px solid #f3f4f6`, padding: 6 }}>
                  <div style={{ fontSize: 12, fontWeight: isToday ? 700 : 500, color: isToday ? '#fff' : GRAY, background: isToday ? ACCENT : 'transparent', width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}>{day}</div>
                  {items.map(e => {
                    const sc = STATUS_CONFIG[e.status] ?? { label: e.status, bg: '#f3f4f6', color: GRAY }
                    return (
                      <div key={e.id} style={{ background: sc.bg, color: sc.color, borderRadius: 4, padding: '2px 5px', fontSize: 11, fontWeight: 600, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={`${e.name} — ${fmt(e.amount)}`}>
                        {e.name}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Regular payment form modal */}
      {showRegularForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 28, width: 460, boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: TEXT, marginBottom: 20 }}>Регулярный платёж</div>

            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Название *</label>
              <input style={inputStyle} value={regForm.name} onChange={e => setRegForm(f => ({ ...f, name: e.target.value }))} placeholder="Аренда офиса" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <label style={labelStyle}>Сумма (₽) *</label>
                <input style={inputStyle} value={regForm.amount} onChange={e => setRegForm(f => ({ ...f, amount: e.target.value }))} placeholder="25000" />
              </div>
              <div>
                <label style={labelStyle}>День месяца</label>
                <input style={inputStyle} type="number" min="1" max="31" value={regForm.day_of_month} onChange={e => setRegForm(f => ({ ...f, day_of_month: e.target.value }))} />
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Категория</label>
              <select style={inputStyle} value={regForm.category} onChange={e => setRegForm(f => ({ ...f, category: e.target.value }))}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Описание</label>
              <textarea style={{ ...inputStyle, resize: 'vertical', minHeight: 60 }} value={regForm.description} onChange={e => setRegForm(f => ({ ...f, description: e.target.value }))} />
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowRegularForm(false)} style={{ padding: '9px 18px', borderRadius: 8, border: `1px solid ${BORDER}`, background: '#fff', color: GRAY, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>Отмена</button>
              <button
                onClick={saveRegular}
                disabled={saving || !regForm.name || !regForm.amount}
                style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: ACCENT, color: '#fff', fontSize: 14, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: saving || !regForm.name || !regForm.amount ? .6 : 1 }}
              >
                {saving ? 'Сохраняю...' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
