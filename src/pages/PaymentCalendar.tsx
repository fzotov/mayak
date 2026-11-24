import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { C, Page, Card, Row, Button, Badge, Stat, Stats, Field, Input, Select, Textarea, Segmented, Modal, Notice, Loading, Empty, ErrorBox, Muted, type Tone } from '../components/ui'

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

const STATUS_CONFIG: Record<string, { label: string; tone: Tone }> = {
  PENDING: { label: 'Ожидает', tone: 'blue' },
  PAID:    { label: 'Оплачен', tone: 'green' },
  OVERDUE: { label: 'Просрочен', tone: 'red' },
}
const statusOf = (s: string) => STATUS_CONFIG[s] ?? { label: s, tone: 'neutral' as Tone }
/** Фон и цвет плашки в сетке календаря по тону статуса. */
const CHIP: Record<Tone, [string, string]> = {
  neutral: [C.hover, C.muted], blue: [C.accentBg, C.accent], green: [C.greenBg, C.green], red: [C.redBg, C.red], amber: [C.amberBg, C.amber], violet: [C.violetBg, C.violet],
}

const TYPE_LABEL: Record<string, string> = {
  REGULAR: 'Регулярный',
  INVOICE: 'Счёт',
  TASK:    'Задача',
}

function fmt(n: number) {
  return n.toLocaleString('ru-RU', { minimumFractionDigits: 0 }) + ' ₽'
}

/** «ГГГГ-ММ-ДД» как локальная дата, без сдвига часового пояса. */
function localDate(s: string) {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d)
}

function fmtDate(s: string) {
  return localDate(s).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function getWeekLabel(dateStr: string, monthStart: Date) {
  const d = localDate(dateStr)
  const diff = Math.floor((d.getTime() - monthStart.getTime()) / 86400000)
  const week = Math.floor(diff / 7) + 1
  return `Неделя ${week}`
}

const CATEGORIES = ['Аренда', 'Коммунальные', 'Охрана', 'Уборка', 'Интернет', 'Страхование', 'Налоги', 'Прочее']

/** Последний день месяца «ГГГГ-ММ»: в ноябре 30 дней, и база отклоняла запрос с 31-м числом. */
function lastDayOf(ym: string) {
  const [y, m] = ym.split('-').map(Number)
  return `${ym}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`
}

const groupHead: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 8 }

export default function PaymentCalendarPage() {
  const [entries, setEntries] = useState<PaymentEntry[]>([])
  const [regulars, setRegulars] = useState<RegularPayment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionErr, setActionErr] = useState('')
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list')
  const [showRegularForm, setShowRegularForm] = useState(false)
  const [regForm, setRegForm] = useState({ name: '', amount: '', day_of_month: '1', category: 'Прочее', description: '' })
  const [saving, setSaving] = useState(false)
  const [formErr, setFormErr] = useState('')
  const [currentMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })

  const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0)

  async function generateMonthlyEntries(regs: RegularPayment[]) {
    const y = currentMonth.getFullYear()
    const m = currentMonth.getMonth() + 1
    const monthStr = `${y}-${String(m).padStart(2, '0')}`

    const { data: existing, error } = await supabase
      .from('payment_calendar')
      .select('regular_payment_id')
      .gte('due_date', `${monthStr}-01`)
      .lte('due_date', lastDayOf(monthStr))
      .eq('type', 'REGULAR')
    if (error) throw new Error('Не удалось проверить платежи месяца: ' + error.message)

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
      const { error: insErr } = await supabase.from('payment_calendar').insert(toInsert)
      if (insErr) throw new Error('Не удалось добавить регулярные платежи месяца: ' + insErr.message)
    }
  }

  async function load() {
    setLoading(true); setError('')
    try {
      const { data: regs, error: regErr } = await supabase.from('regular_payments').select('*').order('day_of_month')
      if (regErr) throw new Error('Не удалось загрузить регулярные платежи: ' + regErr.message)
      const regList = (regs as RegularPayment[]) || []
      setRegulars(regList)

      await generateMonthlyEntries(regList)

      const y = currentMonth.getFullYear()
      const m = currentMonth.getMonth() + 1
      const monthStr = `${y}-${String(m).padStart(2, '0')}`

      const { data, error: calErr } = await supabase
        .from('payment_calendar')
        .select('*')
        .gte('due_date', `${monthStr}-01`)
        .lte('due_date', lastDayOf(monthStr))
        .order('due_date')
      if (calErr) throw new Error('Не удалось загрузить календарь платежей: ' + calErr.message)

      // Просрочен — срок раньше сегодняшнего дня (платёж со сроком сегодня ещё не просрочен)
      const now = new Date()
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const updated = ((data as PaymentEntry[]) || []).map(e => {
        if (e.status === 'PENDING' && localDate(e.due_date) < todayStart) return { ...e, status: 'OVERDUE' }
        return e
      })
      setEntries(updated)
    } catch (e: any) {
      setError(e?.message || 'Не удалось загрузить данные')
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function markPaid(id: string) {
    setActionErr('')
    const { error } = await supabase.from('payment_calendar').update({ status: 'PAID' }).eq('id', id)
    if (error) { setActionErr('Не удалось отметить оплату: ' + error.message); return }
    setEntries(prev => prev.map(e => e.id === id ? { ...e, status: 'PAID' } : e))
  }

  async function saveRegular() {
    if (!regForm.name || !regForm.amount) return
    setSaving(true); setFormErr('')
    const { error } = await supabase.from('regular_payments').insert({
      name: regForm.name,
      amount: parseFloat(regForm.amount.replace(',', '.')) || 0,
      day_of_month: parseInt(regForm.day_of_month) || 1,
      category: regForm.category,
      description: regForm.description || null,
      active: true,
    })
    setSaving(false)
    if (error) { setFormErr('Не удалось сохранить: ' + error.message); return }
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
    const day = localDate(e.due_date).getDate()
    if (!calEntries[day]) calEntries[day] = []
    calEntries[day].push(e)
  })

  const monthLabel = currentMonth.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })
  const now = new Date()
  const cellBorder = `1px solid ${C.line}`

  return (
    <Page actions={<>
      <Segmented<'list' | 'calendar'> options={[['list', 'Список'], ['calendar', 'Календарь']]} value={viewMode} onChange={setViewMode} />
      <Button onClick={() => { setFormErr(''); setShowRegularForm(true) }}>Регулярный платёж</Button>
    </>}>
      <Muted><span style={{ textTransform: 'capitalize' }}>{monthLabel}</span> · регулярные платежи и счета за месяц{regulars.length > 0 ? ` · регулярных: ${regulars.length}` : ''}</Muted>

      <Stats>
        <Stat label="Запланировано" value={fmt(totalPlanned)} />
        <Stat label="Оплачено" value={fmt(totalPaid)} tone="green" />
        <Stat label="Остаток" value={fmt(totalPending)} tone={totalPending > 0 ? 'red' : undefined} />
        <Stat label="Всего платежей" value={String(entries.length)} />
      </Stats>

      {error && <ErrorBox error={error} onRetry={load} />}
      {actionErr && <Notice tone="red">{actionErr}</Notice>}

      {loading ? <Loading /> : viewMode === 'list' ? (
        <div style={{ display: 'grid', gap: 16 }}>
          {Object.entries(weeks).map(([week, items]) => (
            <div key={week}>
              <div style={groupHead}>{week}</div>
              <Card pad={false}>
                {items.map((e, idx) => {
                  const sc = statusOf(e.status)
                  return (
                    <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '12px 16px', borderBottom: idx < items.length - 1 ? cellBorder : 'none' }}>
                      <div style={{ width: 36, height: 36, borderRadius: 8, background: C.hover, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: C.muted, flexShrink: 0 }}>
                        {localDate(e.due_date).getDate()}
                      </div>
                      <div style={{ flex: 1, minWidth: 160 }}>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>{e.name}</div>
                        <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{TYPE_LABEL[e.type] ?? e.type} · {fmtDate(e.due_date)}</div>
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: e.status === 'PAID' ? C.green : C.text, fontVariantNumeric: 'tabular-nums' }}>{fmt(e.amount)}</div>
                      <Badge tone={sc.tone}>{sc.label}</Badge>
                      {e.status !== 'PAID' && <Button small onClick={() => markPaid(e.id)}>Отметить оплату</Button>}
                    </div>
                  )
                })}
              </Card>
            </div>
          ))}
          {entries.length === 0 && !error && <Card><Empty>Нет платежей в этом месяце</Empty></Card>}
        </div>
      ) : (
        <Card pad={false}>
          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: 560 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: cellBorder }}>
                {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(d => (
                  <div key={d} style={{ padding: '10px 8px', textAlign: 'center', fontSize: 12, fontWeight: 600, color: C.muted, background: C.card2 }}>{d}</div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
                {Array.from({ length: firstDow }).map((_, i) => (
                  <div key={`e${i}`} style={{ minHeight: 90, borderRight: cellBorder, borderBottom: cellBorder, background: C.card2 }} />
                ))}
                {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                  const items = calEntries[day] || []
                  const isToday = day === now.getDate() && currentMonth.getMonth() === now.getMonth() && currentMonth.getFullYear() === now.getFullYear()
                  return (
                    <div key={day} style={{ minHeight: 90, borderRight: cellBorder, borderBottom: cellBorder, padding: 6, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: isToday ? 700 : 500, color: isToday ? C.onAccent : C.muted, background: isToday ? C.accent : 'transparent', width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}>{day}</div>
                      {items.map(e => {
                        const [bg, fg] = CHIP[statusOf(e.status).tone]
                        return (
                          <div key={e.id} style={{ background: bg, color: fg, borderRadius: 4, padding: '2px 5px', fontSize: 11, fontWeight: 600, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={`${e.name} — ${fmt(e.amount)}`}>
                            {e.name}
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </Card>
      )}

      {showRegularForm && (
        <Modal title="Регулярный платёж" onClose={() => setShowRegularForm(false)} width={460}
          footer={<>
            <Button onClick={() => setShowRegularForm(false)}>Отмена</Button>
            <Button kind="primary" onClick={saveRegular} disabled={saving || !regForm.name || !regForm.amount}>{saving ? 'Сохраняю…' : 'Сохранить'}</Button>
          </>}>
          <Field label="Название *">
            <Input value={regForm.name} onChange={e => setRegForm(f => ({ ...f, name: e.target.value }))} placeholder="Аренда офиса" />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Сумма (₽) *">
              <Input value={regForm.amount} onChange={e => setRegForm(f => ({ ...f, amount: e.target.value }))} placeholder="25000" />
            </Field>
            <Field label="День месяца">
              <Input type="number" min="1" max="31" value={regForm.day_of_month} onChange={e => setRegForm(f => ({ ...f, day_of_month: e.target.value }))} />
            </Field>
          </div>
          <Field label="Категория">
            <Select value={regForm.category} onChange={e => setRegForm(f => ({ ...f, category: e.target.value }))}>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </Select>
          </Field>
          <Field label="Описание">
            <Textarea value={regForm.description} onChange={e => setRegForm(f => ({ ...f, description: e.target.value }))} style={{ minHeight: 60 }} />
          </Field>
          {formErr && <Notice tone="red">{formErr}</Notice>}
        </Modal>
      )}
    </Page>
  )
}
