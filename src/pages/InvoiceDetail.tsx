import { useState } from 'react'
import jsPDF from 'jspdf'

const STATUS_LABEL: Record<string, string> = { OVERDUE: 'Просрочен', SENT: 'Выставлен', DRAFT: 'Черновик', PAID: 'Оплачен' }
const STATUS_COLOR: Record<string, string> = { OVERDUE: '#ef4444', SENT: '#2563eb', DRAFT: '#6b7280', PAID: '#16a34a' }
const STATUS_BG: Record<string, string> = { OVERDUE: '#fef2f2', SENT: '#eff6ff', DRAFT: '#f1f5f9', PAID: '#f0fdf4' }

export function InvoiceDetailPage({ invoice, onBack }: { invoice: any; onBack: () => void }) {
  const [showQR, setShowQR] = useState(false)

  const generatePDF = () => {
    const doc = new jsPDF()
    const tenant = invoice.lease.tenant.fullName
    const unit = invoice.lease.unit.number
    const num = invoice.number
    const total = invoice.total

    doc.setFont('helvetica')
    doc.setFontSize(10)

    // Реквизиты банка вверху
    doc.rect(10, 10, 130, 28)
    doc.rect(140, 10, 60, 28)
    doc.text('Банк получателя', 12, 16)
    doc.text('ПАО Сбербанк России', 12, 22)
    doc.text('ИНН  500705271772', 12, 32)
    doc.text('ИП Зотова Екатерина Викторовна', 12, 38)
    doc.text('Получатель', 12, 44)
    doc.text('БИК', 142, 16)
    doc.text('044525225', 165, 16)
    doc.text('Сч. №', 142, 22)
    doc.text('30101810400000000225', 158, 22)
    doc.text('Сч. №', 142, 32)
    doc.text('40802810340000024041', 158, 32)

    // Заголовок
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('Счет на оплату № ' + num + ' от ' + new Date().toLocaleDateString('ru'), 10, 58)
    doc.setFont('helvetica', 'normal')

    doc.line(10, 62, 200, 62)
    doc.line(10, 63, 200, 63)

    // Стороны
    doc.setFontSize(10)
    doc.text('Поставщик', 10, 72)
    doc.text('(Исполнитель):', 10, 77)
    doc.text('ИП Зотова Екатерина Викторовна, ИНН 500705271772, ОГРНИП 315500700008401,', 45, 72)
    doc.text('141801, МО, г. Дмитров, мкр. им. Владимира Махалина, д.20', 45, 77)

    doc.text('Покупатель', 10, 87)
    doc.text('(Заказчик):', 10, 92)
    doc.text(tenant + ', Офис № ' + unit, 45, 87)

    doc.text('Основание:', 10, 102)
    doc.text('Договор аренды', 45, 102)

    // Таблица
    doc.line(10, 108, 200, 108)
    doc.rect(10, 108, 10, 10)
    doc.rect(20, 108, 100, 10)
    doc.rect(120, 108, 20, 10)
    doc.rect(140, 108, 20, 10)
    doc.rect(160, 108, 20, 10)
    doc.rect(180, 108, 20, 10)

    doc.setFont('helvetica', 'bold')
    doc.text('N', 14, 115)
    doc.text('Товары (работы, услуги)', 22, 115)
    doc.text('Кол.', 122, 115)
    doc.text('Ед.', 142, 115)
    doc.text('Цена', 162, 115)
    doc.text('Сумма', 182, 115)
    doc.setFont('helvetica', 'normal')

    const lines = [
      { name: 'Аренда помещения № ' + unit, amount: Math.round(total * 0.85) },
      { name: 'Уборка помещения', amount: 2500 },
      { name: 'Электроэнергия', amount: Math.round(total * 0.1) },
    ]

    let y = 118
    lines.forEach((line, i) => {
      doc.rect(10, y, 10, 10)
      doc.rect(20, y, 100, 10)
      doc.rect(120, y, 20, 10)
      doc.rect(140, y, 20, 10)
      doc.rect(160, y, 20, 10)
      doc.rect(180, y, 20, 10)
      doc.text(String(i + 1), 14, y + 7)
      doc.text(line.name, 22, y + 7)
      doc.text('1', 128, y + 7)
      doc.text('мес', 142, y + 7)
      doc.text(line.amount.toLocaleString('ru'), 162, y + 7)
      doc.text(line.amount.toLocaleString('ru'), 182, y + 7)
      y += 10
    })

    // Итого
    doc.setFont('helvetica', 'bold')
    doc.text('Итого:', 150, y + 10)
    doc.text(total.toLocaleString('ru') + ' руб.', 175, y + 10)
    doc.text('Всего к оплате:', 140, y + 20)
    doc.text(total.toLocaleString('ru') + ' руб.', 175, y + 20)
    doc.setFont('helvetica', 'normal')

    doc.line(10, y + 28, 200, y + 28)
    doc.line(10, y + 29, 200, y + 29)

    doc.text('Руководитель _________________ Зотова Е.В.', 10, y + 40)
    doc.text('Бухгалтер _________________ Зотова Е.В.', 120, y + 40)

    doc.save('invoice-' + num + '.pdf')
  }
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
          <button onClick={generatePDF} style={{ padding: '7px 14px', border: 'none', borderRadius: 7, background: '#4f6ef7', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', color: '#fff', fontWeight: 500 }}>Скачать PDF</button>
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
