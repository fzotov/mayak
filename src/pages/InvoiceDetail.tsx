import { useState } from 'react'

const STATUS_LABEL: Record<string, string> = { OVERDUE: 'Просрочен', SENT: 'Выставлен', DRAFT: 'Черновик', PAID: 'Оплачен' }
const STATUS_COLOR: Record<string, string> = { OVERDUE: '#ef4444', SENT: '#2563eb', DRAFT: '#6b7280', PAID: '#16a34a' }
const STATUS_BG: Record<string, string> = { OVERDUE: '#fef2f2', SENT: '#eff6ff', DRAFT: '#f1f5f9', PAID: '#f0fdf4' }

export function InvoiceDetailPage({ invoice, onBack }: { invoice: any; onBack: () => void }) {
  const [showQR, setShowQR] = useState(false)
  const s = {
    card: { background: '#fff', border: '1px solid #e8ebf3', borderRadius: 9, padding: 16, marginBottom: 12 } as React.CSSProperties,
    label: { fontSize: 11, color: '#8596b4', marginBottom: 3 } as React.CSSProperties,
    value: { fontSize: 13, color: '#1a2240', fontWeight: 500 } as React.CSSProperties,
  }
  const lines = [
    { name: 'Аренда (постоянная часть)', amount: Math.round(invoice.total * 0.85) },
    { name: 'Уборка помещения', amount: 2500 },
    { name: 'Электроэнергия', amount: Math.round(invoice.total * 0.1) },
    { name: 'Доп. услуги', amount: Math.round(invoice.total * 0.05) },
  ]
  return (
    <div style={{ maxWidth: 700 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button onClick={onBack} style={{ padding: '6px 12px', border: '1px solid #e8ebf3', borderRadius: 7, background: '#fff', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', color: '#6b7280' }}>
          {String.fromCharCode(8592)} Назад
        </button>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#1a2240' }}>Счёт №{invoice.number}</div>
          <div style={{ fontSize: 12, color: '#8596b4' }}>{invoice.lease.tenant.fullName} · Офис {invoice.lease.unit.number}</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button onClick={() => setShowQR(!showQR)} style={{ padding: '7px 14px', border: '1px solid #7c3aed', borderRadius: 7, background: '#f5f3ff', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', color: '#7c3aed', fontWeight: 500 }}>QR СБП</button>
          <button style={{ padding: '7px 14px', border: 'none', borderRadius: 7, background: '#4f6ef7', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', color: '#fff', fontWeight: 500 }}>Скачать PDF</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div style={s.card}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '.4px' }}>Арендодатель</div>
          <div><div style={s.label}>Наименование</div><div style={s.value}>ИП Зотова Екатерина Викторовна</div></div>
          <div style={{ marginTop: 8 }}><div style={s.label}>ИНН</div><div style={s.value}>500705271772</div></div>
          <div style={{ marginTop: 8 }}><div style={s.label}>Банк</div><div style={s.value}>ПАО Сбербанк России</div></div>
          <div style={{ marginTop: 8 }}><div style={s.label}>р/с</div><div style={{ ...s.value, fontFamily: 'monospace', fontSize: 12 }}>40802810340000024041</div></div>
          <div style={{ marginTop: 8 }}><div style={s.label}>БИК</div><div style={s.value}>044525225</div></div>
        </div>
        <div style={s.card}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '.4px' }}>Арендатор</div>
          <div><div style={s.label}>Наименование</div><div style={s.value}>{invoice.lease.tenant.fullName}</div></div>
          <div style={{ marginTop: 8 }}><div style={s.label}>Офис</div><div style={s.value}>№ {invoice.lease.unit.number}</div></div>
          <div style={{ marginTop: 8 }}><div style={s.label}>Период</div><div style={s.value}>{invoice.periodStart?.slice(0, 7)}</div></div>
          <div style={{ marginTop: 8 }}><div style={s.label}>Срок оплаты</div><div style={{ ...s.value, color: invoice.status === 'OVERDUE' ? '#ef4444' : '#1a2240' }}>{invoice.dueDate || '—'}</div></div>
          <div style={{ marginTop: 8 }}><div style={s.label}>Статус</div>
            <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 500, background: STATUS_BG[invoice.status], color: STATUS_COLOR[invoice.status] }}>{STATUS_LABEL[invoice.status]}</span>
          </div>
        </div>
      </div>

      <div style={s.card}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '.4px' }}>Состав счёта</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead><tr style={{ background: '#f8f9fc', borderBottom: '1px solid #e8ebf3' }}>
            <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 500, color: '#8596b4', fontSize: 11 }}>Наименование</th>
            <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 500, color: '#8596b4', fontSize: 11 }}>Сумма</th>
          </tr></thead>
          <tbody>
            {lines.map((line, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #f0f2f8' }}>
                <td style={{ padding: '9px 12px', color: '#374151' }}>{line.name}</td>
                <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 500 }}>{line.amount.toLocaleString('ru')} руб.</td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr style={{ background: '#f8f9fc', borderTop: '2px solid #e8ebf3' }}>
            <td style={{ padding: '10px 12px', fontWeight: 600, color: '#1a2240' }}>Итого</td>
            <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#1a2240', fontSize: 15 }}>{invoice.total.toLocaleString('ru')} руб.</td>
          </tr></tfoot>
        </table>
      </div>

      {showQR && (
        <div style={s.card}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '.4px' }}>QR для оплаты СБП</div>
          <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
            <svg width="150" height="150" viewBox="0 0 150 150" xmlns="http://www.w3.org/2000/svg">
              <rect width="150" height="150" fill="white"/>
              <g fill="black">
                <rect x="10" y="10" width="40" height="40" rx="2" fill="none" stroke="black" strokeWidth="4"/>
                <rect x="18" y="18" width="24" height="24"/>
                <rect x="100" y="10" width="40" height="40" rx="2" fill="none" stroke="black" strokeWidth="4"/>
                <rect x="108" y="18" width="24" height="24"/>
                <rect x="10" y="100" width="40" height="40" rx="2" fill="none" stroke="black" strokeWidth="4"/>
                <rect x="18" y="108" width="24" height="24"/>
                <rect x="58" y="10" width="8" height="8"/><rect x="68" y="10" width="8" height="8"/>
                <rect x="58" y="20" width="8" height="8"/><rect x="78" y="20" width="8" height="8"/>
                <rect x="58" y="58" width="8" height="8"/><rect x="68" y="58" width="8" height="8"/>
                <rect x="78" y="58" width="8" height="8"/><rect x="88" y="58" width="8" height="8"/>
                <rect x="58" y="68" width="8" height="8"/><rect x="78" y="68" width="8" height="8"/>
                <rect x="58" y="78" width="8" height="8"/><rect x="68" y="78" width="8" height="8"/>
                <rect x="88" y="78" width="8" height="8"/><rect x="98" y="78" width="8" height="8"/>
                <rect x="108" y="58" width="8" height="8"/><rect x="118" y="68" width="8" height="8"/>
                <rect x="58" y="100" width="8" height="8"/><rect x="68" y="100" width="8" height="8"/>
                <rect x="88" y="110" width="8" height="8"/><rect x="108" y="100" width="8" height="8"/>
                <rect x="118" y="110" width="8" height="8"/><rect x="128" y="100" width="8" height="8"/>
              </g>
            </svg>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1a2240', marginBottom: 6 }}>Оплата через СБП</div>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Получатель: ИП Зотова Е.В.</div>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Сумма: {invoice.total.toLocaleString('ru')} руб.</div>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 12 }}>Назначение: Аренда №{invoice.number}</div>
              <div style={{ fontSize: 11, color: '#9ca3af' }}>Отсканируйте QR в банковском приложении</div>
            </div>
          </div>
        </div>
      )}

      {(invoice.status === 'DRAFT') && (
        <button style={{ width: '100%', padding: '10px', border: 'none', borderRadius: 8, background: '#4f6ef7', color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
          Отправить арендатору
        </button>
      )}
      {(invoice.status === 'SENT' || invoice.status === 'OVERDUE') && (
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={{ flex: 1, padding: '10px', border: '1px solid #bbf7d0', borderRadius: 8, background: '#f0fdf4', color: '#16a34a', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
            Отметить оплаченным
          </button>
          <button style={{ padding: '10px 16px', border: '1px solid #e8ebf3', borderRadius: 8, background: '#fff', color: '#6b7280', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
            Напоминание
          </button>
        </div>
      )}
    </div>
  )
}
