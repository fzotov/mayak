import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const resend = new Resend(process.env.RESEND_API_KEY)
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { email } = req.body
  if (!email) return res.status(400).json({ ok: false, error: 'email required' })

  const { data, error } = await supabase
    .from('tenant_portal_access')
    .select('id, email, status')
    .eq('email', email)
    .single()

  // Не раскрываем существует ли пользователь
  if (error || !data || data.status === 'blocked') {
    return res.status(200).json({ ok: true })
  }

  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString() // 2 часа

  await supabase
    .from('tenant_portal_access')
    .update({ invite_token: token, invite_expires_at: expiresAt })
    .eq('id', data.id)

  const resetUrl = `https://mayak-xi.vercel.app/tenant/reset-password?token=${token}`

  const html = `<!DOCTYPE html>
<html lang="ru">
<head><meta charset="UTF-8"><title>Сброс пароля</title></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr>
          <td align="center" style="background:#3d2314;padding:28px 40px;">
            <img src="https://mayak-d.ru/pics/logo.png" alt="Маяк" style="max-height:52px;max-width:180px;" />
          </td>
        </tr>
        <tr>
          <td style="padding:32px 40px 28px;">
            <p style="font-size:20px;font-weight:700;color:#111;margin:0 0 12px;">Сброс пароля</p>
            <p style="font-size:15px;color:#444;margin:0 0 24px;line-height:1.6;">
              Мы получили запрос на сброс пароля для аккаунта <strong>${email}</strong>.
            </p>
            <p style="font-size:14px;color:#555;margin:0 0 20px;">
              Нажмите кнопку ниже, чтобы задать новый пароль. Ссылка действительна <strong>2 часа</strong>.
            </p>
            <table cellpadding="0" cellspacing="0" width="100%">
              <tr><td align="center">
                <a href="${resetUrl}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;font-size:15px;font-weight:700;padding:14px 32px;border-radius:8px;">СБРОСИТЬ ПАРОЛЬ</a>
              </td></tr>
            </table>
            <p style="font-size:12px;color:#999;margin:20px 0 0;text-align:center;">
              Если вы не запрашивали сброс пароля — проигнорируйте это письмо.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 40px;border-top:1px solid #eee;background:#fafafa;">
            <p style="font-size:12px;color:#aaa;margin:0;line-height:1.6;">
              БЦ «Маяк» · г. Дмитров, мкр. Владимира Махалина, д. 20<br/>
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
      subject: 'Сброс пароля — портал арендаторов БЦ «Маяк»',
      html,
    })
  } catch {
    // не сообщаем об ошибке отправки
  }

  res.status(200).json({ ok: true })
}
