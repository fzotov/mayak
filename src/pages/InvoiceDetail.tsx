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
      body{font-family:Arial,sans-serif;font-size:9pt;color:#000;padding:12mm 12mm 10mm 20mm}
      table.bank{width:100%;border-collapse:collapse;margin-bottom:10pt}
      table.bank td{border:1px solid #000;padding:3px 5px;vertical-align:top;font-size:8.5pt}
      .bik-label{color:#555;font-size:7.5pt}
      h1{font-size:12pt;font-weight:bold;margin:8pt 0 3pt}
      hr.thick{border:none;border-top:2px solid #000;margin:3pt 0}
      hr.thin{border:none;border-top:1px solid #000;margin:5pt 0}
      .parties{margin:5pt 0;font-size:8.5pt}
      .party{display:grid;grid-template-columns:105px 1fr;gap:2px;margin-bottom:4pt;line-height:1.3}
      .party-label{color:#000}
      .party-label small{display:block;color:#555;font-size:7.5pt}
      table.items{width:100%;border-collapse:collapse;margin:6pt 0;font-size:8.5pt}
      table.items th{border:1px solid #000;padding:3px 5px;text-align:center;font-weight:bold;background:#ebebeb;font-size:8pt}
      table.items td{border:1px solid #000;padding:2px 5px;font-size:8.5pt}
      .totals{text-align:right;margin:3pt 0 6pt;font-size:8.5pt;line-height:1.6}
      .total-bold{font-weight:bold;font-size:9.5pt}
      .notice{font-size:7.5pt;color:#333;line-height:1.4;margin:4pt 0}
      .signatures{display:grid;grid-template-columns:1fr 1fr;gap:30px;margin-top:14pt;font-size:8.5pt}
      .sig-title{margin-bottom:12pt}
      .sig-line{border-bottom:1px solid #000;margin-bottom:2px}
      .sig-name{font-size:8pt;text-align:center}
      @media print{@page{size:A4;margin:0}body{padding:12mm 12mm 10mm 20mm}}
    </style></head><body>

    <table class="bank">
      <tr>
        <td rowspan="4" style="width:55%">
          <div class="bik-label">Банк получателя</div>
          <div style="font-weight:bold;margin:1px 0">ПАО Сбербанк России</div>
        </td>
        <td style="width:18%" class="bik-label">БИК</td>
        <td style="width:27%;font-weight:bold">044525225</td>
        <td rowspan="4" style="width:80px;text-align:center;padding:4px">
          <svg width="72" height="72" viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg">
            <rect width="72" height="72" fill="white"/>
            <g fill="black">
              <rect x="3" y="3" width="20" height="20" rx="1" fill="none" stroke="black" stroke-width="2.5"/>
              <rect x="7" y="7" width="12" height="12"/>
              <rect x="49" y="3" width="20" height="20" rx="1" fill="none" stroke="black" stroke-width="2.5"/>
              <rect x="53" y="7" width="12" height="12"/>
              <rect x="3" y="49" width="20" height="20" rx="1" fill="none" stroke="black" stroke-width="2.5"/>
              <rect x="7" y="53" width="12" height="12"/>
              <rect x="27" y="3" width="4" height="4"/><rect x="33" y="3" width="4" height="4"/>
              <rect x="27" y="9" width="4" height="4"/><rect x="39" y="9" width="4" height="4"/>
              <rect x="27" y="27" width="4" height="4"/><rect x="33" y="27" width="4" height="4"/>
              <rect x="39" y="27" width="4" height="4"/><rect x="45" y="27" width="4" height="4"/>
              <rect x="27" y="33" width="4" height="4"/><rect x="39" y="33" width="4" height="4"/>
              <rect x="27" y="39" width="4" height="4"/><rect x="33" y="39" width="4" height="4"/>
              <rect x="45" y="39" width="4" height="4"/><rect x="51" y="39" width="4" height="4"/>
              <rect x="57" y="27" width="4" height="4"/><rect x="63" y="33" width="4" height="4"/>
              <rect x="57" y="39" width="4" height="4"/><rect x="63" y="45" width="4" height="4"/>
              <rect x="27" y="51" width="4" height="4"/><rect x="33" y="51" width="4" height="4"/>
              <rect x="45" y="57" width="4" height="4"/><rect x="57" y="51" width="4" height="4"/>
              <rect x="63" y="57" width="4" height="4"/>
            </g>
          </svg>
          <div style="font-size:6.5pt;text-align:center;margin-top:3px;color:#333">СБП · ${total.toLocaleString('ru-RU')} руб.</div>
        </td>
      </tr>
      <tr>
        <td class="bik-label">Сч. №</td>
        <td style="font-size:7.5pt">30101810400000000225</td>
      </tr>
      <tr>
        <td style="border-top:1px solid #000">
          <span style="font-size:7.5pt">ИНН&nbsp;500705271772&nbsp;&nbsp;&nbsp;ОГРНИП&nbsp;315500700008401</span><br>
          <span style="font-weight:bold">ИП Зотова Екатерина Викторовна</span><br>
          <span class="bik-label">Получатель</span>
        </td>
        <td class="bik-label">Сч. №</td>
        <td style="font-size:7.5pt">40802810340000024041</td>
      </tr>
    </table>

    <h1>Счёт на оплату № ${num} от ${date}</h1>
    <hr class="thick">

    <div class="parties">
      <div class="party">
        <div class="party-label">Поставщик<small>(Исполнитель):</small></div>
        <div>ИП Зотова Екатерина Викторовна, ИНН 500705271772, ОГРНИП 315500700008401, 141801, МО, г. Дмитров, мкр. им. Владимира Махалина, д.20, тел.: +7 916 763-02-07</div>
      </div>
      <div class="party">
        <div class="party-label">Покупатель<small>(Заказчик):</small></div>
        <div>${tenant}, Офис № ${unit}</div>
      </div>
      <div class="party">
        <div class="party-label">Основание:</div>
        <div>Договор аренды нежилого помещения</div>
      </div>
    </div>

    <table class="items">
      <thead><tr>
        <th style="width:24px">№</th>
        <th>Товары (работы, услуги)</th>
        <th style="width:44px">Кол-во</th>
        <th style="width:36px">Ед.</th>
        <th style="width:68px">Цена</th>
        <th style="width:76px">Сумма</th>
      </tr></thead>
      <tbody>
        ${lines.map((l,i) => `<tr><td style="text-align:center">${i+1}</td><td>${l.name}</td><td style="text-align:center">1</td><td style="text-align:center">мес</td><td style="text-align:right">${l.amount.toLocaleString('ru-RU')},00</td><td style="text-align:right">${l.amount.toLocaleString('ru-RU')},00</td></tr>`).join('')}
      </tbody>
    </table>

    <div class="totals">
      <div>Итого: ${total.toLocaleString('ru-RU')},00 руб.</div>
      <div>Без налога (НДС): —</div>
      <div class="total-bold">Всего к оплате: ${total.toLocaleString('ru-RU')},00 руб.</div>
    </div>

    <hr class="thin">
    <div class="notice">
      Оплата данного счёта означает согласие с условиями договора аренды нежилого помещения.<br>
      Уведомление об оплате обязательно — направьте копию платёжного поручения на Email: info@mayak-d.ru
    </div>
    <hr class="thin">

    <div class="signatures">
      <div>
        <div class="sig-title">Руководитель</div>
        <div class="sig-line"></div>
        <div class="sig-name">Зотова Е.В.</div>
      </div>
      <div>
        <div class="sig-title">Бухгалтер</div>
        <div class="sig-line"></div>
        <div class="sig-name">Зотова Е.В.</div>
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
