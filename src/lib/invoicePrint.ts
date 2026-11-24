// Печатная форма счёта на оплату с QR по ГОСТ Р 56042-2014. Реквизиты — из таблицы landlords.
import QRCode from 'qrcode'

export interface PrintLine { name: string; amount: number }
export interface PrintInvoice { number: string; date: string; tenantName: string; tenantInn?: string | null; basis: string; lines: PrintLine[]; balanceNote?: string | null; toPay: number }

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))
const fmt = (n: number) => n.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const dateLong = (s: string) => new Date(s + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })

export async function printInvoice(inv: PrintInvoice, ll: any) {
  const w = window.open('', '_blank')
  if (!w) return
  const total = inv.lines.reduce((s, l) => s + l.amount, 0)
  const purpose = `Оплата по счёту № ${inv.number} от ${new Date(inv.date + 'T00:00:00').toLocaleDateString('ru-RU')}. Без НДС`
  const qr = await QRCode.toDataURL([
    'ST00012', `Name=${ll.name}`, `PersonalAcc=${ll.account}`, `BankName=${ll.bank_name}`, `BIC=${ll.bik}`,
    `CorrespAcc=${ll.corr_account}`, `PayeeINN=${ll.inn}`, `Sum=${Math.round(inv.toPay * 100)}`, `Purpose=${purpose}`,
  ].join('|'), { width: 160, margin: 1, errorCorrectionLevel: 'M' })
  const td = 'border:1px solid #000;padding:3px 6px'
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Счёт ${esc(inv.number)}</title><style>
    *{box-sizing:border-box} body{font-family:Arial,sans-serif;font-size:9pt;color:#000;margin:0;padding:10mm 15mm}
    table{border-collapse:collapse} h1{font-size:13pt;margin:10pt 0 2pt} .l1{border-top:2px solid #000;margin:3pt 0 6pt}
    .party{display:flex;margin-bottom:4pt} .pl{width:120px;min-width:120px} .items{width:100%;margin:4pt 0 6pt}
    .items th{border:1px solid #000;padding:4px 5px;background:#f0f0f0} .items td{border:1px solid #000;padding:3px 5px}
    .r{text-align:right;white-space:nowrap} .tot{float:right;margin-bottom:6pt} .tot td{padding:0 0 0 20px}
    .sig{display:flex;justify-content:space-between;margin-top:18pt} .sig div{width:45%} .line{border-bottom:1px solid #000;margin:14pt 0 2pt}
    @media print{@page{size:A4;margin:0}}
  </style></head><body>
    <table style="width:100%;margin-bottom:10pt">
      <tr><td rowspan="3" style="${td};width:100px;text-align:center"><img src="${qr}" style="width:90px;height:90px"></td>
        <td style="${td};font-weight:bold">${esc(ll.bank_name)}</td><td style="${td};width:55px">БИК</td><td style="${td};width:150px">${esc(ll.bik)}</td></tr>
      <tr><td style="${td};font-size:7.5pt;color:#555">Банк получателя</td><td style="${td}">Сч. №</td><td style="${td}">${esc(ll.corr_account)}</td></tr>
      <tr><td style="${td}"><div>ИНН ${esc(ll.inn)}${ll.ogrn ? ' &nbsp; ОГРН ' + esc(ll.ogrn) : ''}</div><div style="font-weight:bold;margin-top:2px">${esc(ll.name)}</div><div style="font-size:7.5pt;color:#555">Получатель</div></td>
        <td style="${td}">Сч. №</td><td style="${td}">${esc(ll.account)}</td></tr>
    </table>
    <h1>Счёт на оплату № ${esc(inv.number)} от ${dateLong(inv.date)}</h1><div class="l1"></div>
    <div class="party"><div class="pl">Поставщик:</div><div>${esc(ll.name)}, ИНН ${esc(ll.inn)}, ${esc(ll.legal_address || '')}${ll.phone ? ', тел. ' + esc(ll.phone) : ''}</div></div>
    <div class="party"><div class="pl">Покупатель:</div><div>${esc(inv.tenantName)}${inv.tenantInn ? ', ИНН ' + esc(inv.tenantInn) : ''}</div></div>
    <div class="party"><div class="pl">Основание:</div><div>${esc(inv.basis)}</div></div>
    <table class="items"><thead><tr><th style="width:24px">№</th><th>Наименование</th><th style="width:90px">Сумма, руб.</th></tr></thead><tbody>
      ${inv.lines.map((l, i) => `<tr><td style="text-align:center">${i + 1}</td><td>${esc(l.name)}</td><td class="r">${fmt(l.amount)}</td></tr>`).join('')}
    </tbody></table>
    <table class="tot">
      <tr><td>Итого по счёту:</td><td class="r"><b>${fmt(total)}</b></td></tr>
      <tr><td>НДС:</td><td class="r">без НДС</td></tr>
      ${inv.balanceNote ? `<tr><td colspan="2" style="padding-top:4px">${esc(inv.balanceNote)}</td></tr>` : ''}
      <tr><td><b>Всего к оплате:</b></td><td class="r"><b>${fmt(inv.toPay)}</b></td></tr>
    </table><div style="clear:both"></div>
    <p style="font-size:8pt">Назначение платежа: ${esc(purpose)}. Оплату можно сделать по QR-коду в приложении банка.</p>
    <div class="sig"><div>Поставщик<div class="line"></div></div><div>Бухгалтер<div class="line"></div></div></div>
    <script>window.onload=function(){window.print()}</script>
  </body></html>`)
  w.document.close()
}
