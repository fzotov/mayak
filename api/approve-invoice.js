import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)

export default async function handler(req, res) {
  const { token, action } = req.query
  if (!token) return res.status(400).send('Токен не указан')

  const { data: inv, error } = await supabase
    .from('incoming_invoices')
    .select('id, supplier, amount, approval_token, approval_requested_to, status')
    .eq('approval_token', token)
    .single()

  if (error || !inv) return res.status(404).send('Счёт не найден или ссылка устарела')
  if (inv.status !== 'PENDING_APPROVAL') {
    return res.status(200).send(html('Уже обработано', `Счёт от ${inv.supplier} уже был обработан ранее.`, '#8596b4'))
  }

  const isApprove = action === 'approve'
  const newStatus = isApprove ? 'APPROVED' : 'NEW'

  await supabase.from('incoming_invoices').update({
    status: newStatus,
    approval_token: null,
    ...(isApprove ? { approved_by: inv.approval_requested_to, approved_at: new Date().toISOString() } : {}),
  }).eq('id', inv.id)

  const amountFmt = Number(inv.amount || 0).toLocaleString('ru-RU', { minimumFractionDigits: 2 }) + ' ₽'

  if (isApprove) {
    return res.status(200).send(html(
      '✓ Согласовано',
      `Счёт от <strong>${inv.supplier}</strong> на сумму <strong>${amountFmt}</strong> согласован к оплате.`,
      '#22c55e'
    ))
  } else {
    return res.status(200).send(html(
      '✗ Отклонено',
      `Счёт от <strong>${inv.supplier}</strong> на сумму <strong>${amountFmt}</strong> отклонён. Статус возвращён на «Новый».`,
      '#ef4444'
    ))
  }
}

function html(title, message, color) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
<style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;background:#f0f2f8;display:flex;align-items:center;justify-content:center;min-height:100vh;}
.card{background:#fff;border-radius:16px;padding:48px 40px;max-width:440px;text-align:center;box-shadow:0 8px 40px rgba(0,0,0,.1);}
.icon{width:64px;height:64px;border-radius:50%;background:${color}22;display:flex;align-items:center;justify-content:center;font-size:28px;margin:0 auto 20px;}
h1{color:#1a2240;font-size:22px;margin:0 0 12px;}
p{color:#4b5563;font-size:15px;line-height:1.6;margin:0 0 28px;}
a{display:inline-block;padding:12px 28px;background:#1a2240;color:#fff;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px;}
</style></head><body>
<div class="card">
  <div class="icon" style="color:${color}">${title.startsWith('✓') ? '✓' : title.startsWith('✗') ? '✗' : 'ℹ'}</div>
  <h1 style="color:${color}">${title}</h1>
  <p>${message}</p>
  <a href="https://mayak-xi.vercel.app">Перейти в систему</a>
</div>
</body></html>`
}
