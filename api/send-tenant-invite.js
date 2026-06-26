import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const resend = new Resend(process.env.RESEND_API_KEY)
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { tenantId, email, tenantName, unitNumber } = req.body
  if (!email) return res.status(400).json({ ok: false, error: 'email required' })

  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  const { error: dbErr } = await supabase.from('tenant_portal_access').upsert(
    {
      tenant_id: tenantId || null,
      email,
      invite_token: token,
      invite_sent_at: new Date().toISOString(),
      invite_expires_at: expiresAt,
      status: 'invited',
    },
    { onConflict: 'email' }
  )

  if (dbErr) return res.status(500).json({ ok: false, error: dbErr.message })

  const activateUrl = `https://mayak-xi.vercel.app/tenant/activate?token=${token}`

  const html = `<!DOCTYPE html>
<html lang="ru">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Приглашение на портал арендаторов</title></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr>
          <td align="center" style="padding:32px 40px 24px;">
            <img src="https://mayak-d.ru/pics/logo.png" alt="Маяк" style="max-height:56px;max-width:180px;" />
          </td>
        </tr>
        <tr>
          <td style="padding:0 40px 32px;">
            <p style="font-size:16px;color:#111111;margin:0 0 20px;">Уважаемый(ая) <strong>${tenantName || email}</strong>,</p>
            <p style="font-size:15px;color:#333333;margin:0 0 24px;line-height:1.6;">
              Вы приглашены на портал арендаторов Бизнес-центра <strong>«Маяк»</strong>.
            </p>
            <table cellpadding="0" cellspacing="0" style="background:#f8f9fc;border-radius:8px;padding:20px;margin-bottom:24px;width:100%;box-sizing:border-box;">
              <tr><td style="font-size:14px;color:#333;padding:4px 0;">✓&nbsp; Просматривать и скачивать счета</td></tr>
              <tr><td style="font-size:14px;color:#333;padding:4px 0;">✓&nbsp; Передавать показания счётчиков</td></tr>
              <tr><td style="font-size:14px;color:#333;padding:4px 0;">✓&nbsp; Подавать заявки на ремонт</td></tr>
              <tr><td style="font-size:14px;color:#333;padding:4px 0;">✓&nbsp; Скачивать документы и договоры</td></tr>
              <tr><td style="font-size:14px;color:#333;padding:4px 0;">✓&nbsp; Отслеживать статус заявок</td></tr>
            </table>
            <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;width:100%;">
              <tr><td style="font-size:14px;color:#555;padding:3px 0;">📧&nbsp; Логин: <strong>${email}</strong></td></tr>
              ${unitNumber ? `<tr><td style="font-size:14px;color:#555;padding:3px 0;">🏢&nbsp; Помещение: <strong>№${unitNumber}</strong></td></tr>` : ''}
            </table>
            <p style="font-size:14px;color:#333;margin:0 0 20px;">Для активации нажмите кнопку и создайте пароль:</p>
            <table cellpadding="0" cellspacing="0" width="100%">
              <tr><td align="center">
                <a href="${activateUrl}" style="display:inline-block;background:#111111;color:#ffffff;text-decoration:none;font-size:15px;font-weight:bold;padding:14px 32px;border-radius:8px;letter-spacing:0.3px;">АКТИВИРОВАТЬ АККАУНТ</a>
              </td></tr>
            </table>
            <p style="font-size:13px;color:#888;margin:20px 0 0;text-align:center;">Ссылка действительна 7 дней.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 40px;border-top:1px solid #eeeeee;background:#fafafa;">
            <p style="font-size:13px;color:#888;margin:0;line-height:1.6;">
              С уважением,<br/>
              Администрация БЦ «Маяк»<br/>
              г. Дмитров, мкр. Владимира Махалина, д. 20<br/>
              +7 (916) 763-02-07 | +7 (496) 227-00-44
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

  try {
    await resend.emails.send({
      from: 'БЦ Маяк <noreply@mayak-d.ru>',
      to: email,
      subject: 'Приглашение на портал арендаторов БЦ «Маяк»',
      html,
    })
    res.status(200).json({ ok: true, token })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
}
