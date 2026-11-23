import { Resend } from 'resend'
import { esc } from './auth.js'

const FROM = process.env.MAIL_FROM || 'БЦ Маяк <noreply@mayak-d.ru>'

export async function sendMail({ to, subject, html }) {
  if (!process.env.RESEND_API_KEY && !process.env.VERCEL) {
    // локальная разработка без ключа почты: письмо не уходит, ссылка печатается в консоль
    console.log('[mail:dev]', to, '|', subject, '|', (html.match(/href="([^"]+\/tenant\/[^"]+)"/) || [])[1] || '')
    return
  }
  const resend = new Resend(process.env.RESEND_API_KEY)
  const { error } = await resend.emails.send({ from: FROM, to, subject, html })
  if (error) throw new Error(error.message || 'Письмо не отправлено')
}

/** Единый шаблон письма: заголовок, абзацы, одна кнопка. Все значения экранируются здесь. */
export function letter({ title, paragraphs = [], buttonText, buttonUrl, note }) {
  const ps = paragraphs.map(p => `<p style="font-size:15px;color:#444;margin:0 0 16px;line-height:1.6;">${esc(p)}</p>`).join('')
  const btn = buttonUrl ? `<table cellpadding="0" cellspacing="0" width="100%"><tr><td align="center" style="padding:8px 0 4px;">
<a href="${esc(buttonUrl)}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;font-size:15px;font-weight:700;padding:14px 32px;border-radius:8px;">${esc(buttonText)}</a>
</td></tr></table>` : ''
  return `<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8"><title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:40px 0;"><tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#fff;border-radius:12px;overflow:hidden;">
<tr><td align="center" style="background:#3d2314;padding:28px 40px;"><img src="https://mayak-d.ru/pics/logo.png" alt="Маяк" style="max-height:52px;max-width:180px;" /></td></tr>
<tr><td style="padding:32px 40px 28px;">
<p style="font-size:20px;font-weight:700;color:#111;margin:0 0 16px;">${esc(title)}</p>
${ps}${btn}
${note ? `<p style="font-size:12px;color:#999;margin:20px 0 0;text-align:center;">${esc(note)}</p>` : ''}
</td></tr>
<tr><td style="padding:16px 40px;border-top:1px solid #eee;background:#fafafa;">
<p style="font-size:12px;color:#aaa;margin:0;line-height:1.6;">БЦ «Маяк» · г. Дмитров, мкр. Владимира Махалина, д. 20<br/>+7 (916) 763-02-07 | +7 (496) 227-00-44</p>
</td></tr></table></td></tr></table></body></html>`
}
