import { useState } from 'react'

const MONTHS = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']

interface InvoiceLine { tenant_name?: string; period: string; rent_amount: number; cleaning_amount: number; utilities_amount: number; services_amount: number; total_amount: number }

export function BillingPage() {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [loading, setLoading] = useState(false)
  const [invoices, setInvoices] = useState<InvoiceLine[]>([])
  const [tariffs, setTariffs] = useState<any>(null)
  const [msg, setMsg] = useState('')
  const [generated, setGenerated] = useState(false)

  const generate = async () => {
    setLoading(true); setMsg('')
    try {
      const res = await fetch('/api/billing-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month, year })
      })
      const data = await res.json()
      if (data.ok) {
        setInvoices(data.invoices)
        setTariffs(data.tariffs)
        setGenerated(true)
        if (data.preview) setMsg(data.message)
      }
    } catch (e) { setMsg('Ошибка генерации') }
    setLoading(false)
  }

  const totalSum = invoices.reduce((s, i) => s + i.total_amount, 0)

  const s = {
    card: { background: '#fff', border: '1px solid #e8ebf3', borderRadius: 9, padding: 16, marginBottom: 12 } as React.CSSProperties,
    inp: { padding: '7px 10px', border: '1px solid #e8ebf3', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', outline: 'none' } as React.CSSProperties,
  }

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ fontSize: 12, color: '#8596b4', marginBottom: 16 }}>Генерация счетов для всех арендаторов за выбранный период</div>

      <div style={s.card}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '.4px' }}>Параметры выставления</div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 11, color: '#8596b4', marginBottom: 4, fontWeight: 500 }}>Месяц</div>
            <select style={{ ...s.inp, width: 160 }} value={month} onChange={e => setMonth(Number(e.target.value))}>
              {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#8596b4', marginBottom: 4, fontWeight: 500 }}>Год</div>
            <select style={{ ...s.inp, width: 100 }} value={year} onChange={e => setYear(Number(e.target.value))}>
              {[2024, 2025, 2026].map(y => <option key={y}>{y}</option>)}
            </select>
          </div>
          <button onClick={generate} disabled={loading}
            style={{ padding: '8px 24px', border: 'none', borderRadius: 7, background: '#4f6ef7', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Расчёт...' : `Рассчитать счета за ${MONTHS[month-1]} ${year}`}
          </button>
        </div>

        {tariffs && (
          <div style={{ marginTop: 14, padding: '10px 14px', background: '#f8f9fc', borderRadius: 7, fontSize: 11, color: '#6b7280', display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            <span>Тариф эл-во: <b style={{ color: '#1a2240' }}>{tariffs.electricityTariff} руб/кВт·ч</b></span>
            <span>Надбавка: <b style={{ color: '#1a2240' }}>{tariffs.electricityMarkup}%</b></span>
            <span>Хол. вода: <b style={{ color: '#1a2240' }}>{tariffs.coldWaterTariff} руб/м³</b></span>
            <span>Уборка: <b style={{ color: '#1a2240' }}>{tariffs.cleaningPrice} руб/пом.</b></span>
          </div>
        )}
      </div>

      {msg && (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 12, color: '#92400e' }}>
          ⚠️ {msg}
        </div>
      )}

      {generated && invoices.length > 0 && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 12 }}>
            <div style={{ ...s.card, marginBottom: 0 }}>
              <div style={{ fontSize: 11, color: '#8596b4', marginBottom: 4 }}>Арендаторов</div>
              <div style={{ fontSize: 22, fontWeight: 600, color: '#1a2240' }}>{invoices.length}</div>
            </div>
            <div style={{ ...s.card, marginBottom: 0 }}>
              <div style={{ fontSize: 11, color: '#8596b4', marginBottom: 4 }}>Итого к выставлению</div>
              <div style={{ fontSize: 20, fontWeight: 600, color: '#1a2240' }}>{totalSum.toLocaleString('ru')} ₽</div>
            </div>
            <div style={{ ...s.card, marginBottom: 0 }}>
              <div style={{ fontSize: 11, color: '#8596b4', marginBottom: 4 }}>Срок оплаты</div>
<div style={{ fontSize: 16, fontWeight: 600, color: '#1a2240' }}>до 25 {MONTHS[month-1]}</div>
            </div>
          </div>

          <div style={s.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: '.4px' }}>Расчёт по арендаторам</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button style={{ padding: '6px 14px', border: '1px solid #e8ebf3', borderRadius: 7, background: '#fff', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', color: '#374151' }}>
                  Скачать Excel
                </button>
                <button style={{ padding: '6px 14px', border: 'none', borderRadius: 7, background: '#16a34a', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', color: '#fff', fontWeight: 500 }}>
                  Выставить все счета →
                </button>
              </div>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#f8f9fc', borderBottom: '1px solid #e8ebf3' }}>
                  {['Арендатор', 'Аренда', 'Уборка', 'Коммунальные', 'Доп. услуги', 'Итого', ''].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 500, color: '#8596b4', fontSize: 11 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f0f2f8' }}>
                    <td style={{ padding: '9px 12px', fontWeight: 500, color: '#1a2240' }}>{inv.tenant_name || 'Арендатор ' + (i+1)}</td>
                    <td style={{ padding: '9px 12px', color: '#6b7280' }}>{inv.rent_amount.toLocaleString('ru')} ₽</td>
                    <td style={{ padding: '9px 12px', color: '#6b7280' }}>{inv.cleaning_amount.toLocaleString('ru')} ₽</td>
                    <td style={{ padding: '9px 12px', color: '#6b7280' }}>{inv.utilities_amount.toLocaleString('ru')} ₽</td>
                    <td style={{ padding: '9px 12px', color: '#6b7280' }}>{inv.services_amount.toLocaleString('ru')} ₽</td>
                    <td style={{ padding: '9px 12px', fontWeight: 600, color: '#1a2240' }}>{inv.total_amount.toLocaleString('ru')} ₽</td>
                    <td style={{ padding: '9px 12px' }}>
                      <button style={{ padding: '3px 10px', border: '1px solid #e8ebf3', borderRadius: 5, background: '#fff', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', color: '#4f6ef7' }}>
                        PDF
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: '#f8f9fc', borderTop: '2px solid #e8ebf3' }}>
                  <td style={{ padding: '10px 12px', fontWeight: 600, color: '#1a2240' }}>Итого</td>
                  <td style={{ padding: '10px 12px', fontWeight: 600 }}>{invoices.reduce((s,i) => s+i.rent_amount, 0).toLocaleString('ru')} ₽</td>
                  <td style={{ padding: '10px 12px', fontWeight: 600 }}>{invoices.reduce((s,i) => s+i.cleaning_amount, 0).toLocaleString('ru')} ₽</td>
                  <td style={{ padding: '10px 12px', fontWeight: 600 }}>{invoices.reduce((s,i) => s+i.utilities_amount, 0).toLocaleString('ru')} ₽</td>
                  <td style={{ padding: '10px 12px', fontWeight: 600 }}>{invoices.reduce((s,i) => s+i.services_amount, 0).toLocaleString('ru')} ₽</td>
                  <td style={{ padding: '10px 12px', fontWeight: 700, color: '#4f6ef7', fontSize: 14 }}>{totalSum.toLocaleString('ru')} ₽</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
