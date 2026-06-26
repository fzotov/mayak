import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

interface Unit { id: string; number: string; area: number; status: string; tenant_id: string | null; tenant?: { full_name: string } }
interface HeatBill { id: string; period: string; total_amount: number; total_gcal: number; coefficient: number; ai_extracted: boolean; items: HeatItem[]; created_at: string }
interface HeatItem { unit_id: string; unit_number: string; tenant_name: string; tenant_id?: string | null; area: number; share: number; amount_base: number; amount_final: number }
interface HeatSetting { coefficient: number; valid_from: string; total_area: number }

const MONTHS = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']

const now = new Date()

const SI: React.CSSProperties = { width: '100%', border: '1px solid #e5e7eb', borderRadius: 6, padding: '7px 10px', fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }
const SL: React.CSSProperties = { fontSize: 12, color: '#6b7280', marginBottom: 4, display: 'block', fontWeight: 500 }
const CARD: React.CSSProperties = { background: '#fff', border: '1px solid #e8ebf3', borderRadius: 9, padding: 16 }

function fmtAmt(n: number) { return n.toLocaleString('ru', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₽' }
function fmtPeriod(s: string) { const d = new Date(s); return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}` }

// ── История ────────────────────────────────────────────────────────────────
function HistoryPanel({ bills, onSelect }: { bills: HeatBill[]; onSelect: (b: HeatBill) => void }) {
  if (!bills.length) return null
  return (
    <div style={CARD}>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '.4px' }}>История расчётов</div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: '#f8f9fc', borderBottom: '1px solid #e8ebf3' }}>
            {['Период', 'Гкал', 'Сумма', 'Коэфф.', 'Источник', ''].map(h => (
              <th key={h} style={{ padding: '7px 10px', textAlign: 'left', fontWeight: 500, color: '#8596b4', fontSize: 12 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {bills.map(b => (
            <tr key={b.id} style={{ borderBottom: '1px solid #f0f2f8' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#f9fafb')}
              onMouseLeave={e => (e.currentTarget.style.background = '')}>
              <td style={{ padding: '7px 10px', fontWeight: 500, color: '#1a2240' }}>{fmtPeriod(b.period)}</td>
              <td style={{ padding: '7px 10px', color: '#6b7280' }}>{b.total_gcal ? b.total_gcal.toFixed(4) + ' Гкал' : '—'}</td>
              <td style={{ padding: '7px 10px', fontWeight: 500, color: '#1a2240' }}>{fmtAmt(b.total_amount)}</td>
              <td style={{ padding: '7px 10px', color: '#6b7280' }}>×{b.coefficient}</td>
              <td style={{ padding: '7px 10px' }}>
                <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 8, background: b.ai_extracted ? '#eff6ff' : '#f1f5f9', color: b.ai_extracted ? '#3b82f6' : '#64748b', fontWeight: 500 }}>
                  {b.ai_extracted ? 'AI' : 'Вручную'}
                </span>
              </td>
              <td style={{ padding: '7px 10px' }}>
                <button onClick={() => onSelect(b)}
                  style={{ padding: '3px 10px', fontSize: 12, borderRadius: 5, border: '1px solid #e8ebf3', color: '#4f6ef7', background: '#eff3ff', cursor: 'pointer', fontFamily: 'inherit' }}>
                  Открыть
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Таблица распределения ──────────────────────────────────────────────────
function DistTable({ items, coefficient }: { items: HeatItem[]; coefficient: number }) {
  if (!items.length) return null
  const totalArea = items.reduce((s, i) => s + i.area, 0)
  const totalBase = items.reduce((s, i) => s + i.amount_base, 0)
  const totalFinal = items.reduce((s, i) => s + i.amount_final, 0)
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: '#f8f9fc', borderBottom: '1px solid #e8ebf3' }}>
            {['Помещение','Арендатор','Площадь, м²','Доля, %','Сумма без коэф.','Коэфф.','Итоговая сумма'].map(h => (
              <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 500, color: '#8596b4', fontSize: 12, whiteSpace: 'nowrap' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map(item => (
            <tr key={item.unit_id} style={{ borderBottom: '1px solid #f0f2f8' }}>
              <td style={{ padding: '8px 12px', fontWeight: 600, color: '#1a2240' }}>Офис {item.unit_number}</td>
              <td style={{ padding: '8px 12px', color: '#374151' }}>{item.tenant_name}</td>
              <td style={{ padding: '8px 12px', color: '#6b7280' }}>{item.area.toFixed(1)}</td>
              <td style={{ padding: '8px 12px', color: '#6b7280' }}>{(item.share * 100).toFixed(2)}%</td>
              <td style={{ padding: '8px 12px', color: '#6b7280' }}>{fmtAmt(item.amount_base)}</td>
              <td style={{ padding: '8px 12px', color: '#6b7280' }}>×{coefficient}</td>
              <td style={{ padding: '8px 12px', fontWeight: 600, color: '#1a2240' }}>{fmtAmt(item.amount_final)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ background: '#f8f9fc', borderTop: '2px solid #e8ebf3' }}>
            <td style={{ padding: '9px 12px', fontWeight: 600, color: '#1a2240' }}>Итого</td>
            <td />
            <td style={{ padding: '9px 12px', fontWeight: 600 }}>{totalArea.toFixed(1)}</td>
            <td style={{ padding: '9px 12px', fontWeight: 600 }}>{(items.reduce((s,i)=>s+i.share,0)*100).toFixed(2)}%</td>
            <td style={{ padding: '9px 12px', fontWeight: 600 }}>{fmtAmt(totalBase)}</td>
            <td style={{ padding: '9px 12px', color: '#6b7280' }}>×{coefficient}</td>
            <td style={{ padding: '9px 12px', fontWeight: 700, color: '#4f6ef7', fontSize: 14 }}>{fmtAmt(totalFinal)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

// ── Главная страница ───────────────────────────────────────────────────────
export default function HeatPage() {
  const fileRef = useRef<HTMLInputElement>(null)

  // Данные счёта
  const [period, setPeriod] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
  const [totalAmount, setTotalAmount] = useState('')
  const [totalGcal, setTotalGcal] = useState('')
  const [coefficient, setCoefficient] = useState(1.2)
  const [totalBuildingArea, setTotalBuildingArea] = useState(0)
  const [savingSettings, setSavingSettings] = useState(false)

  // Состояние
  const [units, setUnits] = useState<Unit[]>([])
  const [bills, setBills] = useState<HeatBill[]>([])
  const [items, setItems] = useState<HeatItem[]>([])
  const [selectedBill, setSelectedBill] = useState<HeatBill | null>(null)

  const [aiLoading, setAiLoading] = useState(false)
  const [aiMsg, setAiMsg] = useState('')
  const [calculated, setCalculated] = useState(false)
  const [saving, setSaving] = useState(false)
  const [invoicing, setInvoicing] = useState(false)
  const [doneMsg, setDoneMsg] = useState('')

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    const [{ data: u }, { data: b }, { data: hs }] = await Promise.all([
      supabase.from('units').select('id, number, area, status, tenant_id, tenant:tenants(full_name)').gt('area', 0),
      supabase.from('heat_bills').select('*').order('period', { ascending: false }),
      supabase.from('heat_settings').select('coefficient, valid_from, total_area').order('valid_from', { ascending: false }).limit(1),
    ])
    setUnits(u || [])
    setBills(b || [])
    if (hs?.[0]) {
      setCoefficient(Number(hs[0].coefficient))
      setTotalBuildingArea(Number(hs[0].total_area) || 0)
    }
  }

  // Загрузка файла → AI
  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setAiLoading(true); setAiMsg(''); setCalculated(false); setDoneMsg('')
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const base64 = (ev.target?.result as string).split(',')[1]
      try {
        const res = await fetch('/api/process-heat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ base64, mediaType: file.type }),
        })
        const data = await res.json()
        if (data.ok) {
          if (data.period) setPeriod(data.period)
          if (data.total_amount != null && Number(data.total_amount) !== 0) setTotalAmount(String(data.total_amount))
          if (data.total_gcal != null && Number(data.total_gcal) !== 0) setTotalGcal(String(data.total_gcal))
          const parts = [
            data.period && `период: ${data.period}`,
            data.total_amount != null && Number(data.total_amount) !== 0 && `сумма: ${Number(data.total_amount).toLocaleString('ru')} ₽`,
            data.total_gcal != null && Number(data.total_gcal) !== 0 && `объём: ${data.total_gcal} Гкал`,
            data.supplier,
          ].filter(Boolean).join(' · ')
          setAiMsg(parts
            ? `✓ AI извлёк: ${parts}. Проверьте и нажмите Рассчитать.`
            : '⚠ AI не нашёл данных в файле — введите вручную.')
        } else {
          setAiMsg(`⚠ AI не смог разобрать файл — введите вручную.${data.raw ? ' (ответ: ' + String(data.raw).slice(0, 100) + ')' : ''}`)
        }
      } catch { setAiMsg('⚠ Ошибка обработки файла.') }
      setAiLoading(false)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  async function saveSettings() {
    setSavingSettings(true)
    const { data: existing } = await supabase.from('heat_settings').select('id').order('valid_from', { ascending: false }).limit(1)
    if (existing?.[0]) {
      await supabase.from('heat_settings').update({ coefficient, total_area: totalBuildingArea }).eq('id', existing[0].id)
    } else {
      await supabase.from('heat_settings').insert({ coefficient, total_area: totalBuildingArea, valid_from: new Date().toISOString().slice(0, 10) })
    }
    setSavingSettings(false)
  }

  // Расчёт распределения
  function calculate() {
    const amount = parseFloat(totalAmount)
    if (!amount || amount <= 0) { alert('Введите общую сумму'); return }
    if (!units.length) { alert('Нет помещений с площадью > 0'); return }
    if (!totalBuildingArea || totalBuildingArea <= 0) { alert('Укажите общую площадь здания в настройках выше'); return }
    const result: HeatItem[] = units.map(u => {
      const area = Number(u.area)
      const share = area / totalBuildingArea   // доля от всего здания
      const base = amount * share
      const final = base * coefficient
      return {
        unit_id: u.id,
        unit_number: u.number,
        tenant_name: (u.tenant as any)?.full_name ?? '—',
        tenant_id: u.tenant_id,
        area,
        share,
        amount_base: Math.round(base * 100) / 100,
        amount_final: Math.round(final * 100) / 100,
      }
    })
    setItems(result)
    setCalculated(true)
    setSelectedBill(null)
    setDoneMsg('')
  }

  // Сохранить расчёт
  async function saveCalculation(createInvoices = false) {
    const amount = parseFloat(totalAmount)
    const gcal = parseFloat(totalGcal) || 0
    if (!amount || !items.length) return
    setSaving(true)
    const { data: bill, error } = await supabase.from('heat_bills').insert({
      period: period + '-01',
      total_amount: amount,
      total_gcal: gcal,
      coefficient,
      ai_extracted: aiMsg.startsWith('✓'),
      items,
    }).select().single()
    if (error || !bill) { alert('Ошибка сохранения: ' + (error?.message ?? 'нет данных')); setSaving(false); return }

    const periodYear = parseInt(period.split('-')[0])
    const periodMonthIdx = parseInt(period.split('-')[1]) - 1

    if (createInvoices) {
      setInvoicing(true)
      const { data: lastInv } = await supabase.from('invoices').select('number').like('number', `${periodYear}-%`).order('number', { ascending: false }).limit(1)
      let seq = lastInv?.[0]?.number ? Number(lastInv[0].number.split('-')[1]) + 1 : 1

      const withTenant = items.filter(i => i.tenant_id)
      const { error: invErr } = await supabase.from('invoices').insert(
        withTenant.map(item => ({
          number: `${periodYear}-${String(seq++).padStart(3, '0')}`,
          period,
          due_date: period + '-25',
          status: 'draft',
          tenant_id: item.tenant_id,
          unit_id: item.unit_id,
          rent_amount: 0,
          cleaning_amount: 0,
          utilities_amount: item.amount_final,
          services_amount: 0,
          total_amount: item.amount_final,
          notes: `Тепло ${MONTHS[periodMonthIdx]} ${periodYear}`,
        }))
      )
      setInvoicing(false)
      if (invErr) { alert('Ошибка создания счетов: ' + invErr.message); setSaving(false); return }
      setDoneMsg(`✓ Сохранено и создано ${withTenant.length} счетов в разделе Счета`)
    } else {
      setDoneMsg('✓ Расчёт сохранён в истории')
    }

    await loadAll()
    setSaving(false)
  }

  // Открыть сохранённый расчёт
  function openBill(b: HeatBill) {
    setSelectedBill(b)
    setPeriod(b.period.slice(0, 7))
    setTotalAmount(String(b.total_amount))
    setTotalGcal(String(b.total_gcal))
    setCoefficient(b.coefficient)
    setItems(b.items || [])
    setCalculated(true)
    setDoneMsg('')
    setAiMsg(b.ai_extracted ? '✓ Данные были извлечены AI' : '')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const [month, year] = (() => {
    const [y, m] = period.split('-')
    return [Number(m), Number(y)]
  })()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 1000 }}>

      {/* Настройки здания */}
      <div style={{ ...CARD, background: '#eff6ff', border: '1px solid #bfdbfe' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 12 }}>
          Справочник — параметры здания
        </div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <label style={{ ...SL, color: '#1d4ed8' }}>Общая площадь здания, м² <span style={{ color: '#ef4444' }}>*</span></label>
            <input type="number" min="0" step="0.1" value={totalBuildingArea || ''}
              placeholder="Например: 1250.0"
              onChange={e => { setTotalBuildingArea(Number(e.target.value)); setCalculated(false) }}
              style={{ ...SI, width: 180, background: '#fff', border: '1px solid #93c5fd' }} />
            <div style={{ fontSize: 11, color: '#3b82f6', marginTop: 3 }}>100% — база для распределения тепла</div>
          </div>
          <div>
            <label style={{ ...SL, color: '#1d4ed8' }}>Коэффициент увеличения</label>
            <input type="number" step="0.01" min="1" max="5" value={coefficient}
              onChange={e => { setCoefficient(Number(e.target.value)); setCalculated(false) }}
              style={{ ...SI, width: 120, background: '#fff', border: '1px solid #93c5fd' }} />
            <div style={{ fontSize: 11, color: '#3b82f6', marginTop: 3 }}>Множитель к базовой сумме</div>
          </div>
          {/* Итоги площадей */}
          {units.length > 0 && totalBuildingArea > 0 && (
            <div style={{ background: '#dbeafe', borderRadius: 7, padding: '8px 12px', fontSize: 12, color: '#1e40af' }}>
              <div>Помещений в базе: <b>{units.length}</b> · {units.reduce((s,u)=>s+Number(u.area),0).toFixed(1)} м²</div>
              <div>Доля помещений: <b>{(units.reduce((s,u)=>s+Number(u.area),0)/totalBuildingArea*100).toFixed(1)}%</b> от здания</div>
              <div style={{ color: '#6b7280', marginTop: 2 }}>Остаток (коридоры, МОП): {(totalBuildingArea - units.reduce((s,u)=>s+Number(u.area),0)).toFixed(1)} м²</div>
            </div>
          )}
          <button onClick={saveSettings} disabled={savingSettings}
            style={{ padding: '8px 18px', border: 'none', borderRadius: 7, background: '#2563eb', color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', opacity: savingSettings ? 0.6 : 1, alignSelf: 'flex-end', marginBottom: 20 }}>
            {savingSettings ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </div>

      {/* Ввод данных счёта */}
      <div style={CARD}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '.4px' }}>
          Счёт от теплоснабжающей организации
        </div>

        {/* Загрузка файла */}
        <div style={{ marginBottom: 14 }}>
          <input ref={fileRef} type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={handleFile} />
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button onClick={() => fileRef.current?.click()} disabled={aiLoading}
              style={{ padding: '8px 18px', border: '1px solid #4f6ef7', borderRadius: 7, background: aiLoading ? '#e0e7ff' : '#eff3ff', color: '#4f6ef7', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', opacity: aiLoading ? 0.7 : 1 }}>
              {aiLoading ? '⏳ AI обрабатывает...' : '📎 Загрузить фото / PDF счёта'}
            </button>
            <span style={{ fontSize: 12, color: '#9ca3af' }}>AI извлечёт сумму, период и объём Гкал</span>
          </div>
          {aiMsg && (
            <div style={{ marginTop: 8, fontSize: 13, color: aiMsg.startsWith('✓') ? '#16a34a' : '#d97706', padding: '6px 10px', background: aiMsg.startsWith('✓') ? '#f0fdf4' : '#fffbeb', borderRadius: 6, border: `1px solid ${aiMsg.startsWith('✓') ? '#bbf7d0' : '#fde68a'}` }}>
              {aiMsg}
            </div>
          )}
        </div>

        {/* Ручной ввод */}
        <div style={{ borderTop: '1px solid #f0f2f8', paddingTop: 14 }}>
          <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 10 }}>Введите данные вручную или проверьте извлечённые AI</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <label style={SL}>Период</label>
              <input style={SI} type="month" value={period} onChange={e => { setPeriod(e.target.value); setCalculated(false) }} />
            </div>
            <div>
              <label style={SL}>Общая сумма, ₽</label>
              <input style={SI} type="number" min="0" step="0.01" value={totalAmount} placeholder="0.00"
                onChange={e => { setTotalAmount(e.target.value); setCalculated(false) }} />
            </div>
            <div>
              <label style={SL}>Объём тепла, Гкал</label>
              <input style={SI} type="number" min="0" step="0.0001" value={totalGcal} placeholder="0.0000"
                onChange={e => setTotalGcal(e.target.value)} />
            </div>
          </div>
        </div>

        <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
          <button onClick={calculate}
            style={{ padding: '9px 24px', border: 'none', borderRadius: 7, background: '#4f6ef7', color: '#fff', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
            Рассчитать распределение
          </button>
        </div>
      </div>

      {/* Результат */}
      {calculated && items.length > 0 && (
        <div style={CARD}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: '.4px' }}>
                Распределение тепла — {MONTHS[month - 1]} {year}
              </div>
              <div style={{ fontSize: 12, color: '#8596b4', marginTop: 3 }}>
                {items.length} помещений · коэф. ×{coefficient}
                {totalGcal && ` · ${parseFloat(totalGcal).toFixed(4)} Гкал`}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {selectedBill ? (
                <button onClick={() => { setSelectedBill(null); setCalculated(false); setItems([]); setTotalAmount(''); setTotalGcal(''); setAiMsg(''); setDoneMsg('') }}
                  style={{ padding: '7px 14px', border: '1px solid #4f6ef7', borderRadius: 7, background: '#eff3ff', color: '#4f6ef7', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                  + Новый расчёт
                </button>
              ) : (
                <>
                  <button onClick={() => saveCalculation(false)} disabled={saving}
                    style={{ padding: '7px 14px', border: '1px solid #e8ebf3', borderRadius: 7, background: '#fff', color: '#374151', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', opacity: saving ? 0.5 : 1 }}>
                    {saving ? 'Сохранение...' : 'Сохранить расчёт'}
                  </button>
                  <button onClick={() => saveCalculation(true)} disabled={saving || invoicing}
                    style={{ padding: '7px 16px', border: 'none', borderRadius: 7, background: '#16a34a', color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', opacity: saving || invoicing ? 0.5 : 1 }}>
                    {invoicing ? 'Создание...' : `Сформировать счета (${items.filter(i => i.tenant_id).length})`}
                  </button>
                </>
              )}
            </div>
          </div>

          {selectedBill && (
            <div style={{ marginBottom: 12, padding: '8px 12px', background: '#fafafa', borderRadius: 7, border: '1px solid #e8ebf3', fontSize: 13, color: '#6b7280' }}>
              📂 Архивный расчёт от {new Date(selectedBill.created_at).toLocaleDateString('ru')} — только просмотр. Нажмите «+ Новый расчёт» чтобы создать новый.
            </div>
          )}
          {doneMsg && (
            <div style={{ marginBottom: 12, padding: '8px 12px', background: '#f0fdf4', borderRadius: 7, border: '1px solid #bbf7d0', fontSize: 13, color: '#16a34a', fontWeight: 500 }}>
              {doneMsg}
            </div>
          )}

          {/* KPI */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 14 }}>
            {[
              { label: 'Исходная сумма', value: fmtAmt(parseFloat(totalAmount) || 0) },
              { label: 'Итого с коэффициентом', value: fmtAmt(items.reduce((s, i) => s + i.amount_final, 0)), color: '#4f6ef7' },
              { label: 'Площадь здания', value: totalBuildingArea.toFixed(1) + ' м² (100%)' },
              { label: 'Площадь помещений', value: items.reduce((s, i) => s + i.area, 0).toFixed(1) + ' м² · ' + (items.reduce((s,i)=>s+i.share,0)*100).toFixed(1) + '%' },
            ].map(k => (
              <div key={k.label} style={{ background: '#f8f9fc', borderRadius: 7, padding: '10px 12px' }}>
                <div style={{ fontSize: 11, color: '#8596b4', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.3px' }}>{k.label}</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: k.color ?? '#1a2240' }}>{k.value}</div>
              </div>
            ))}
          </div>

          <DistTable items={items} coefficient={coefficient} />
        </div>
      )}

      {calculated && items.length === 0 && (
        <div style={{ ...CARD, textAlign: 'center', color: '#8596b4', fontSize: 14 }}>
          Нет занятых помещений с площадью &gt; 0
        </div>
      )}

      {/* История */}
      <HistoryPanel bills={bills} onSelect={openBill} />
    </div>
  )
}
