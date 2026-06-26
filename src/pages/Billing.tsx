import { useState } from 'react'
import { supabase } from '../lib/supabase'

const MONTHS = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']

interface InvoiceLine {
  tenant_id: string
  tenant_name: string
  unit_id: string | null
  unit_number: string
  rent_amount: number
  cleaning_amount: number
  utilities_amount: number
  services_amount: number
  total_amount: number
  existing: boolean // уже есть счёт за этот период
}

const now = new Date()

async function nextNumberForBatch(count: number): Promise<string[]> {
  const year = now.getFullYear()
  const prefix = `${year}-`
  const { data } = await supabase
    .from('invoices').select('number').like('number', `${prefix}%`)
    .order('number', { ascending: false }).limit(1)
  const last = data?.[0]?.number
  let seq = last ? Number(last.replace(prefix, '')) + 1 : 1
  return Array.from({ length: count }, () => `${prefix}${String(seq++).padStart(3, '0')}`)
}

export function BillingPage() {
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [loading, setLoading] = useState(false)
  const [lines, setLines] = useState<InvoiceLine[]>([])
  const [calculated, setCalculated] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const period = `${year}-${String(month).padStart(2, '0')}`

  async function calculate() {
    setLoading(true); setLines([]); setCalculated(false); setDone(false); setError('')
    try {
      // Активные арендаторы с договорами и помещениями
      const { data: tenants } = await supabase
        .from('tenants')
        .select('id, full_name, status')
        .eq('status', 'ACTIVE')

      if (!tenants?.length) { setError('Нет активных арендаторов (статус ACTIVE)'); setLoading(false); return }

      // Существующие счета за этот период
      const { data: existing } = await supabase
        .from('invoices')
        .select('tenant_id')
        .eq('period', period)

      const existingSet = new Set((existing || []).map((i: any) => i.tenant_id))

      const result: InvoiceLine[] = []

      for (const tenant of tenants) {
        // Договор арендатора
        const { data: contracts } = await supabase
          .from('contracts')
          .select('rent_amount, unit_id, units(number)')
          .eq('tenant_id', tenant.id)
          .in('status', ['active', 'draft'])
          .order('start_date', { ascending: false })
          .limit(1)

        const contract = contracts?.[0]
        const rent = Number(contract?.rent_amount ?? 0)
        const unit_id = contract?.unit_id ?? null
        const unit_number = (contract?.units as any)?.number ?? '—'

        // Коммунальные по счётчикам
        let utilities = 0
        if (unit_id) {
          const { data: meters } = await supabase
            .from('meters').select('id, tariff').eq('unit_id', unit_id)
          for (const meter of meters || []) {
            const { data: readings } = await supabase
              .from('meter_readings').select('consumption, amount')
              .eq('meter_id', meter.id)
              .order('reading_date', { ascending: false }).limit(1)
            const r = readings?.[0]
            utilities += Number(r?.amount ?? (r?.consumption && meter.tariff ? r.consumption * meter.tariff : 0))
          }
        }

        // Доп. услуги конкретного арендатора
        const { data: svcRows } = await supabase
          .from('services').select('price').eq('tenant_id', tenant.id)
        const svcTotal = (svcRows || []).reduce((s: number, r: any) => s + Number(r.price), 0)

        const total = rent + Math.round(utilities) + svcTotal

        result.push({
          tenant_id: tenant.id,
          tenant_name: tenant.full_name,
          unit_id,
          unit_number,
          rent_amount: rent,
          cleaning_amount: 0,
          utilities_amount: Math.round(utilities),
          services_amount: svcTotal,
          total_amount: total,
          existing: existingSet.has(tenant.id),
        })
      }

      setLines(result)
      setCalculated(true)
    } catch (e: any) {
      setError('Ошибка расчёта: ' + e.message)
    }
    setLoading(false)
  }

  async function generate() {
    const toCreate = lines.filter(l => !l.existing && l.total_amount > 0)
    if (!toCreate.length) { alert('Нет счетов для создания'); return }
    setGenerating(true)
    try {
      const numbers = await nextNumberForBatch(toCreate.length)
      const dueDate = `${year}-${String(month).padStart(2, '0')}-25`
      const { error } = await supabase.from('invoices').insert(
        toCreate.map((l, i) => ({
          number: numbers[i],
          period,
          due_date: dueDate,
          status: 'draft',
          tenant_id: l.tenant_id,
          unit_id: l.unit_id,
          rent_amount: l.rent_amount,
          cleaning_amount: l.cleaning_amount,
          utilities_amount: l.utilities_amount,
          services_amount: l.services_amount,
          total_amount: l.total_amount,
        }))
      )
      if (error) { alert('Ошибка создания счетов: ' + error.message); return }
      setDone(true)
      setLines(prev => prev.map(l => ({ ...l, existing: true })))
    } catch (e: any) {
      alert('Ошибка: ' + e.message)
    } finally {
      setGenerating(false)
    }
  }

  const s = {
    card: { background: '#fff', border: '1px solid #e8ebf3', borderRadius: 9, padding: 16 } as React.CSSProperties,
    inp: { padding: '7px 10px', border: '1px solid #e8ebf3', borderRadius: 6, fontSize: 14, fontFamily: 'inherit', outline: 'none' } as React.CSSProperties,
  }

  const toCreate = lines.filter(l => !l.existing)
  const total = lines.reduce((s, l) => s + l.total_amount, 0)

  return (
    <div style={{ maxWidth: 860, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ fontSize: 13, color: '#8596b4' }}>
        Массовая генерация счетов для всех активных арендаторов за выбранный период.
        Суммы рассчитываются автоматически по договорам и показаниям счётчиков.
      </div>

      {/* Параметры */}
      <div style={s.card}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '.4px' }}>Период выставления</div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 12, color: '#8596b4', marginBottom: 4, fontWeight: 500 }}>Месяц</div>
            <select style={{ ...s.inp, width: 160 }} value={month} onChange={e => { setMonth(Number(e.target.value)); setCalculated(false); setDone(false) }}>
              {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#8596b4', marginBottom: 4, fontWeight: 500 }}>Год</div>
            <select style={{ ...s.inp, width: 90 }} value={year} onChange={e => { setYear(Number(e.target.value)); setCalculated(false); setDone(false) }}>
              {[2024, 2025, 2026, 2027].map(y => <option key={y}>{y}</option>)}
            </select>
          </div>
          <button onClick={calculate} disabled={loading}
            style={{ padding: '8px 24px', border: 'none', borderRadius: 7, background: '#4f6ef7', color: '#fff', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Расчёт...' : `Рассчитать за ${MONTHS[month - 1]} ${year}`}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', fontSize: 14, color: '#b91c1c' }}>{error}</div>
      )}

      {done && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '12px 16px', fontSize: 14, color: '#166534', fontWeight: 500 }}>
          ✓ Счета созданы и сохранены в разделе «Счета»
        </div>
      )}

      {calculated && lines.length > 0 && (
        <>
          {/* Итоговые KPI */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {[
              { label: 'Арендаторов', value: lines.length },
              { label: 'К выставлению', value: `${toCreate.length} счетов` },
              { label: 'Итого сумма', value: total.toLocaleString('ru') + ' ₽' },
            ].map(k => (
              <div key={k.label} style={{ ...s.card }}>
                <div style={{ fontSize: 12, color: '#8596b4', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.4px' }}>{k.label}</div>
                <div style={{ fontSize: 20, fontWeight: 600, color: '#1a2240' }}>{k.value}</div>
              </div>
            ))}
          </div>

          {/* Таблица расчёта */}
          <div style={s.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: '.4px' }}>
                Расчёт по арендаторам — {MONTHS[month - 1]} {year}
              </div>
              {!done && toCreate.length > 0 && (
                <button onClick={generate} disabled={generating}
                  style={{ padding: '8px 20px', border: 'none', borderRadius: 7, background: '#16a34a', color: '#fff', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', opacity: generating ? 0.7 : 1 }}>
                  {generating ? 'Создание...' : `Выставить ${toCreate.length} счетов →`}
                </button>
              )}
              {(done || toCreate.length === 0) && (
                <span style={{ fontSize: 13, color: '#16a34a', fontWeight: 500 }}>✓ Все счета уже выставлены</span>
              )}
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ background: '#f8f9fc', borderBottom: '1px solid #e8ebf3' }}>
                  {['Арендатор', 'Офис', 'Аренда', 'Коммунальные', 'Услуги', 'Итого', 'Статус'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 500, color: '#8596b4', fontSize: 12, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f0f2f8', opacity: l.existing ? 0.55 : 1 }}>
                    <td style={{ padding: '9px 12px', fontWeight: 500, color: '#1a2240' }}>{l.tenant_name}</td>
                    <td style={{ padding: '9px 12px', color: '#6b7280' }}>{l.unit_number !== '—' ? `Офис ${l.unit_number}` : '—'}</td>
                    <td style={{ padding: '9px 12px', color: '#6b7280' }}>{l.rent_amount != null ? l.rent_amount.toLocaleString('ru') + ' ₽' : '—'}</td>
                    <td style={{ padding: '9px 12px', color: '#6b7280' }}>{l.utilities_amount != null ? l.utilities_amount.toLocaleString('ru') + ' ₽' : '—'}</td>
                    <td style={{ padding: '9px 12px', color: '#6b7280' }}>{l.services_amount != null ? l.services_amount.toLocaleString('ru') + ' ₽' : '—'}</td>
                    <td style={{ padding: '9px 12px', fontWeight: 600, color: '#1a2240' }}>{l.total_amount.toLocaleString('ru')} ₽</td>
                    <td style={{ padding: '9px 12px' }}>
                      {l.existing
                        ? <span style={{ fontSize: 12, color: '#22c55e', fontWeight: 500 }}>✓ Выставлен</span>
                        : <span style={{ fontSize: 12, color: '#f59e0b', fontWeight: 500 }}>Новый</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: '#f8f9fc', borderTop: '2px solid #e8ebf3' }}>
                  <td colSpan={2} style={{ padding: '10px 12px', fontWeight: 600, color: '#1a2240' }}>Итого</td>
                  <td style={{ padding: '10px 12px', fontWeight: 600 }}>{lines.reduce((s, l) => s + l.rent_amount, 0).toLocaleString('ru')} ₽</td>
                  <td style={{ padding: '10px 12px', fontWeight: 600 }}>{lines.reduce((s, l) => s + l.utilities_amount, 0).toLocaleString('ru')} ₽</td>
                  <td style={{ padding: '10px 12px', fontWeight: 600 }}>{lines.reduce((s, l) => s + l.services_amount, 0).toLocaleString('ru')} ₽</td>
                  <td style={{ padding: '10px 12px', fontWeight: 700, color: '#4f6ef7', fontSize: 15 }}>{total.toLocaleString('ru')} ₽</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
