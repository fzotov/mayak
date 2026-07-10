import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const resend = new Resend(process.env.RESEND_API_KEY)
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { invoiceId, toEmail, toName, invoiceData } = req.body
  if (!invoiceId || !toEmail) return res.status(400).json({ ok: false, error: 'invoiceId and toEmail required' })

  const token = crypto.randomBytes(32).toString('hex')
  const baseUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : 'https://mayak-xi.vercel.app'
  const approveUrl = `${baseUrl}/api/approve-invoice?token=${token}&action=approve`
  const rejectUrl = `${baseUrl}/api/approve-invoice?token=${token}&action=reject`

  const { error } = await supabase.from('incoming_invoices').update({
    approval_token: token,
    approval_requested_at: new Date().toISOString(),
    approval_requested_to: toEmail,
    status: 'PENDING_APPROVAL',
  }).eq('id', invoiceId)

  if (error) return res.status(500).json({ ok: false, error: error.message })

  const { supplier, amount, vat, description, invoice_date } = invoiceData || {}
  const amountFmt = Number(amount || 0).toLocaleString('ru-RU', { minimumFractionDigits: 2 }) + ' ₽'
  const vatFmt = vat ? Number(vat).toLocaleString('ru-RU', { minimumFractionDigits: 2 }) + ' ₽' : 'без НДС'
  const dateFmt = invoice_date ? new Date(invoice_date).toLocaleDateString('ru-RU') : '—'

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; background: #f0f2f8; }
  .wrap { max-width: 560px; margin: 32px auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,.08); }
  .header { background: #1a2240; padding: 28px 32px; }
  .header h1 { color: #fff; margin: 0; font-size: 20px; }
  .header p { color: #8596b4; margin: 4px 0 0; font-size: 14px; }
  .body { padding: 28px 32px; }
  .invoice-card { background: #f8f9fb; border: 1px solid #e8ebf3; border-radius: 10px; padding: 20px; margin-bottom: 24px; }
  .row { display: flex; justify-content: space-between; padding: 7px 0; border-bottom: 1px solid #e8ebf3; }
  .row:last-child { border-bottom: none; }
  .row label { color: #8596b4; font-size: 13px; }
  .row value { color: #1a2240; font-size: 14px; font-weight: 600; text-align: right; }
  .amount-big { font-size: 22px; font-weight: 700; color: #1a2240; margin-bottom: 4px; }
  .vat { font-size: 12px; color: #8596b4; }
  .desc { font-size: 13px; color: #374151; margin-top: 12px; padding-top: 12px; border-top: 1px solid #e8ebf3; }
  .btns { display: flex; gap: 12px; margin-bottom: 24px; }
  .btn { flex: 1; display: block; padding: 14px; border-radius: 10px; text-align: center; text-decoration: none; font-weight: 700; font-size: 15px; }
  .btn-approve { background: #22c55e; color: #fff; }
  .btn-reject { background: #fff; color: #ef4444; border: 2px solid #ef4444; }
  .footer { color: #8596b4; font-size: 12px; line-height: 1.6; }
</style></head>
<body>
<div class="wrap">
  <div class="header">
    <h1>🏢 БЦ Маяк</h1>
    <p>Запрос на согласование оплаты</p>
  </div>
  <div class="body">
    <p style="color:#1a2240;font-size:15px;margin:0 0 20px">Здравствуйте${toName ? ', ' + toName : ''}!<br><br>
    Вам направлен счёт на согласование оплаты.</p>

    <div class="invoice-card">
      <div class="amount-big">${amountFmt}</div>
      <div class="vat">НДС: ${vatFmt}</div>
      <div style="margin-top:14px">
        <div class="row"><label>Поставщик</label><value>${supplier || '—'}</value></div>
        <div class="row"><label>Дата счёта</label><value>${dateFmt}</value></div>
      </div>
      ${description ? `<div class="desc">${description}</div>` : ''}
    </div>

    <div class="btns">
      <a href="${approveUrl}" class="btn btn-approve">✓ Согласовать</a>
      <a href="${rejectUrl}" class="btn btn-reject">✗ Отклонить</a>
    </div>

    <div class="footer">
      Кнопки действительны 7 дней. Если вы получили это письмо по ошибке — просто проигнорируйте его.
    </div>
  </div>
</div>
</body>
</html>`

  const { error: mailErr } = await resend.emails.send({
    from: 'БЦ Маяк <noreply@mayak-d.ru>',
    to: toEmail,
    subject: `Согласование оплаты: ${supplier} — ${amountFmt}`,
    html,
  })

  if (mailErr) return res.status(500).json({ ok: false, error: mailErr.message })
  return res.status(200).json({ ok: true })
}
