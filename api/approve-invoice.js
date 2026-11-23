// Согласование входящего счёта по ссылке из письма.
// GET  — показывает счёт и кнопку подтверждения (ничего не меняет: почтовые сканеры открывают ссылки сами).
// POST — выполняет решение.
import { admin, APP_URL, esc } from './_lib/auth.js'

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).end()
  const token = String(req.query?.token || '')
  const action = req.query?.action === 'approve' ? 'approve' : 'reject'
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  if (token.length < 32) return res.status(400).send(page('Ссылка недействительна', 'Токен не указан.', '#8596b4'))

  const db = admin()
  const { data: inv } = await db.from('incoming_invoices')
    .select('id, supplier, amount, approval_requested_to, approval_requested_at, status').eq('approval_token', token).maybeSingle()
  if (!inv) return res.status(404).send(page('Ссылка недействительна', 'Счёт не найден, уже обработан или ссылка устарела.', '#8596b4'))
  const week = 7 * 24 * 3600 * 1000
  if (inv.status !== 'PENDING_APPROVAL' || (inv.approval_requested_at && Date.now() - new Date(inv.approval_requested_at).getTime() > week)) {
    return res.status(200).send(page('Уже обработано', 'Этот счёт уже был обработан ранее или срок ссылки истёк.', '#8596b4'))
  }
  const amountFmt = Number(inv.amount || 0).toLocaleString('ru-RU', { minimumFractionDigits: 2 }) + ' ₽'
  const what = `Счёт от <strong>${esc(inv.supplier)}</strong> на сумму <strong>${esc(amountFmt)}</strong>`
  const isApprove = action === 'approve'

  if (req.method === 'GET') {
    return res.status(200).send(page(isApprove ? 'Согласовать оплату?' : 'Отклонить счёт?', what + '.', isApprove ? '#16a34a' : '#dc2626',
      `<form method="POST" action="/api/approve-invoice?token=${esc(token)}&action=${action}"><button type="submit">${isApprove ? 'Согласовать' : 'Отклонить'}</button></form>`))
  }

  await db.from('incoming_invoices').update({
    status: isApprove ? 'APPROVED' : 'NEW', approval_token: null,
    ...(isApprove ? { approved_by: inv.approval_requested_to, approved_at: new Date().toISOString() } : {}),
  }).eq('id', inv.id)
  return res.status(200).send(isApprove
    ? page('Согласовано', what + ' согласован к оплате.', '#16a34a')
    : page('Отклонено', what + ' отклонён. Статус возвращён на «Новый».', '#dc2626'))
}

function page(title, message, color, extra = '') {
  return `<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>
<style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;background:#f0f2f8;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:16px;box-sizing:border-box}
.card{background:#fff;border-radius:16px;padding:40px 32px;max-width:440px;width:100%;text-align:center;box-sizing:border-box}
h1{font-size:22px;margin:0 0 12px}p{color:#4b5563;font-size:15px;line-height:1.6;margin:0 0 24px}
button,a.btn{display:inline-block;padding:12px 28px;background:#1a2240;color:#fff;border:0;border-radius:10px;text-decoration:none;font-weight:600;font-size:15px;cursor:pointer;font-family:inherit}
form{margin:0 0 16px}a.link{color:#8596b4;font-size:13px}</style></head><body>
<div class="card"><h1 style="color:${color}">${esc(title)}</h1><p>${message}</p>${extra}
<div><a class="link" href="${esc(APP_URL)}">Перейти в систему</a></div></div></body></html>`
}
