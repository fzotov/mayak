import { useState } from 'react'
import jsPDF from 'jspdf'

const STATUS_LABEL: Record<string, string> = { OVERDUE: 'Просрочен', SENT: 'Выставлен', DRAFT: 'Черновик', PAID: 'Оплачен' }
const STATUS_COLOR: Record<string, string> = { OVERDUE: '#ef4444', SENT: '#2563eb', DRAFT: '#6b7280', PAID: '#16a34a' }
const STATUS_BG: Record<string, string> = { OVERDUE: '#fef2f2', SENT: '#eff6ff', DRAFT: '#f1f5f9', PAID: '#f0fdf4' }

export function InvoiceDetailPage({ invoice, onBack }: { invoice: any; onBack: () => void }) {
  const [showQR, setShowQR] = useState(false)

  const generatePDF = () => {
    const tenant = invoice.lease.tenant.fullName
    const unit = invoice.lease.unit.number
    const num = invoice.number
    const total = invoice.total
    const date = new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
    const lines = [
      { name: 'Аренда нежилого помещения № ' + unit + ' за ' + (invoice.periodStart?.slice(0,7) || ''), amount: Math.round(total * 0.85) },
      { name: 'Уборка помещения', amount: 2500 },
      { name: 'Электроэнергия (по показаниям приборов учёта)', amount: Math.round(total * 0.1) },
    ]
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Счёт ${num}</title>
    <style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:Arial,sans-serif;font-size:9pt;color:#000;padding:15mm 15mm 10mm 20mm}
      .header{display:grid;grid-template-columns:1fr 220px;gap:0;margin-bottom:12pt}
      .bank-left{border:1px solid #000;border-right:none;padding:5px 8px}
      .bank-right{border:1px solid #000;padding:5px 8px}
      .bank-row{display:flex;margin-bottom:2px}
      .bank-label{width:60px;flex-shrink:0;color:#000}
      .bank-val{font-weight:bold;font-size:8.5pt}
      .qr-block{border:1px solid #000;padding:6px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px}
      .qr-block svg{display:block}
      .qr-label{font-size:7pt;text-align:center;color:#333}
      h1{font-size:13pt;font-weight:bold;margin:10pt 0 4pt}
      .divider{border:none;border-top:2px solid #000;margin:4pt 0}
      .divider2{border:none;border-top:1px solid #000;margin:6pt 0}
      .parties{margin:6pt 0}
      .party{display:grid;grid-template-columns:110px 1fr;gap:4px;margin-bottom:5pt}
      .party-label{font-size:9pt;color:#000}
      .party-label small{display:block;color:#555;font-size:8pt}
      .party-val{font-size:9pt}
      table{width:100%;border-collapse:collapse;margin:8pt 0;font-size:9pt}
      table th{border:1px solid #000;padding:4px 6px;text-align:center;font-weight:bold;background:#f0f0f0}
      table td{border:1px solid #000;padding:3px 6px}
      table td:nth-child(3),table td:nth-child(4){text-align:center}
      table td:nth-child(5),table td:nth-child(6){text-align:right}
      .totals{text-align:right;margin:4pt 0 8pt}
      .total-row{margin:1pt 0;font-size:9pt}
      .total-final{font-weight:bold;font-size:10pt;margin-top:3pt}
      .notice{font-size:8.5pt;color:#333;margin:6pt 0;line-height:1.4}
      .signatures{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:16pt}
      .sig-row{font-size:9pt}
      .sig-line{display:flex;align-items:flex-end;gap:6px;margin-top:4px}
      .sig-dash{flex:1;border-bottom:1px solid #000;min-width:80px}
      .sig-name{font-size:9pt}
      @media print{@page{margin:0}body{padding:15mm 15mm 10mm 20mm}}
    </style></head><body>
    <div class="header">
      <div>
        <div class="bank-left">
          <div class="bank-row"><span class="bank-label">Банк получателя</span></div>
          <div class="bank-row"><span style="font-weight:bold">ПАО Сбербанк России</span></div>
          <div class="bank-row" style="margin-top:4px">
            <span class="bank-label">ИНН</span><span class="bank-val">500705271772</span>
            <span class="bank-label" style="margin-left:16px">ОГРНИП</span><span class="bank-val">315500700008401</span>
          </div>
          <div class="bank-row"><span style="font-weight:bold">ИП Зотова Екатерина Викторовна</span></div>
          <div class="bank-row" style="margin-top:2px;color:#555;font-size:8pt">Получатель</div>
        </div>
        <div class="bank-right" style="margin-top:-1px">
          <div class="bank-row"><span class="bank-label">БИК</span><span class="bank-val">044525225</span></div>
          <div class="bank-row"><span class="bank-label">Сч. №</span><span class="bank-val" style="font-size:8pt">30101810400000000225</span></div>
          <div class="bank-row" style="margin-top:6px"><span class="bank-label">Сч. №</span><span class="bank-val" style="font-size:8pt">40802810340000024041</span></div>
        </div>
      </div>
      <div class="qr-block">
        <svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <rect width="100" height="100" fill="white"/>
          <g fill="black">
            <rect x="5" y="5" width="28" height="28" rx="1" fill="none" stroke="black" stroke-width="3"/>
            <rect x="11" y="11" width="16" height="16"/>
            <rect x="67" y="5" width="28" height="28" rx="1" fill="none" stroke="black" stroke-width="3"/>
            <rect x="73" y="11" width="16" height="16"/>
            <rect x="5" y="67" width="28" height="28" rx="1" fill="none" stroke="black" stroke-width="3"/>
            <rect x="11" y="73" width="16" height="16"/>
            <rect x="38" y="5" width="5" height="5"/><rect x="45" y="5" width="5" height="5"/>
            <rect x="38" y="12" width="5" height="5"/><rect x="52" y="12" width="5" height="5"/>
            <rect x="38" y="38" width="5" height="5"/><rect x="45" y="38" width="5" height="5"/>
            <rect x="52" y="38" width="5" height="5"/><rect x="59" y="38" width="5" height="5"/>
            <rect x="38" y="45" width="5" height="5"/><rect x="52" y="45" width="5" height="5"/>
            <rect x="38" y="52" width="5" height="5"/><rect x="45" y="52" width="5" height="5"/>
            <rect x="59" y="52" width="5" height="5"/><rect x="66" y="52" width="5" height="5"/>
            <rect x="73" y="38" width="5" height="5"/><rect x="80" y="38" width="5" height="5"/>
            <rect x="87" y="45" width="5" height="5"/><rect x="80" y="52" width="5" height="5"/>
            <rect x="38" y="67" width="5" height="5"/><rect x="45" y="67" width="5" height="5"/>
            <rect x="59" y="74" width="5" height="5"/><rect x="73" y="67" width="5" height="5"/>
            <rect x="80" y="74" width="5" height="5"/><rect x="87" y="67" width="5" height="5"/>
          </g>
        </svg>
        <div class="qr-label">Оплата через СБП<br>Сбербанк · ${total.toLocaleString('ru-RU')} руб.</div>
      </div>
    </div>

    <h1>Счёт на оплату № ${num} от ${date}</h1>
    <hr class="divider">

    <div class="parties">
      <div class="party">
        <div class="party-label">Поставщик<small>(Исполнитель):</small></div>
        <div class="party-val">ИП Зотова Екатерина Викторовна, ИНН 500705271772, ОГРНИП 315500700008401,<br>141801, МО, г. Дмитров, мкр. им. Владимира Махалина, д.20, тел.: +7 916 763-02-07, Email: info@mayak-d.ru</div>
      </div>
      <div class="party">
        <div class="party-label">Покупатель<small>(Заказчик):</small></div>
        <div class="party-val">${tenant}, Офис № ${unit}</div>
      </div>
      <div class="party">
        <div class="party-label">Основание:</div>
        <div class="party-val">Договор аренды нежилого помещения</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width:28px">№</th>
          <th>Товары (работы, услуги)</th>
          <th style="width:50px">Кол-во</th>
          <th style="width:40px">Ед.</th>
          <th style="width:70px">Цена</th>
          <th style="width:80px">Сумма</th>
        </tr>
      </thead>
      <tbody>
        ${lines.map((l,i) => `<tr><td style="text-align:center">${i+1}</td><td>${l.name}</td><td style="text-align:center">1</td><td style="text-align:center">мес</td><td style="text-align:right">${l.amount.toLocaleString('ru-RU')},00</td><td style="text-align:right">${l.amount.toLocaleString('ru-RU')},00</td></tr>`).join('')}
      </tbody>
    </table>

    <div class="totals">
      <div class="total-row">Итого: ${total.toLocaleString('ru-RU')},00 руб.</div>
      <div class="total-row">Без налога (НДС): —</div>
      <div class="total-final">Всего к оплате: ${total.toLocaleString('ru-RU')},00 руб.</div>
    </div>

    <hr class="divider2">

    <div class="notice">
      Оплата данного счёта означает согласие с условиями договора аренды.<br>
      Уведомление об оплате обязательно — направьте платёжное поручение на Email: info@mayak-d.ru
    </div>

    <hr class="divider2">

    <div class="signatures">
      <div class="sig-row">
        Руководитель
        <div class="sig-line"><div class="sig-dash"></div><span class="sig-name">Зотова Е.В.</span></div>
      </div>
      <div class="sig-row">
        Бухгалтер
        <div class="sig-line"><div class="sig-dash"></div><span class="sig-name">Зотова Е.В.</span></div>
      </div>
    </div>

    <script>window.onload=function(){window.print();}<\/script>
    </body></html>`
    const w = window.open('', '_blank')
    if (w) { w.document.write(html); w.document.close() }
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
