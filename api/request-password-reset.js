// POST /api/request-password-reset — публичная. Никогда не сообщает, есть ли такой адрес.
import { admin, APP_URL } from './_lib/auth.js'
import { issueToken, normEmail, validEmail } from './_lib/tokens.js'
import { sendMail, letter } from './_lib/mail.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const email = normEmail(req.body?.email)
  if (!validEmail(email)) return res.status(200).json({ ok: true })

  try {
    const db = admin()
    const [{ data: t }, { data: p }] = await Promise.all([
      db.from('tenant_users').select('user_id').eq('email', email).limit(1),
      db.from('profiles').select('user_id').eq('email', email).limit(1),
    ])
    const known = (t?.length || 0) + (p?.length || 0) > 0
    // не чаще одного письма в 2 минуты на адрес
    const { data: recent } = await db.from('auth_tokens').select('id').eq('email', email).eq('kind', 'reset')
      .gte('created_at', new Date(Date.now() - 2 * 60 * 1000).toISOString()).limit(1)
    if (known && !recent?.length) {
      const token = await issueToken({ kind: 'reset', email, ttlHours: 2 })
      await sendMail({
        to: email,
        subject: 'Сброс пароля — БЦ «Маяк»',
        html: letter({
          title: 'Сброс пароля',
          paragraphs: [`Мы получили запрос на сброс пароля для ${email}.`, 'Нажмите кнопку, чтобы задать новый пароль. Ссылка действует 2 часа.'],
          buttonText: 'Задать новый пароль',
          buttonUrl: `${APP_URL}/tenant/reset-password?token=${token}`,
          note: 'Если вы не запрашивали сброс — проигнорируйте это письмо, пароль останется прежним.',
        }),
      })
    }
  } catch { /* наружу ошибку не отдаём */ }
  res.status(200).json({ ok: true })
}
