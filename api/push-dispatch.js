// POST /api/push-dispatch — разослать очередь push_outbox. Вызывается базой (pg_net) после каждой вставки в очередь.
// Входных данных нет: функция сама забирает неотправленное, поэтому посторонний вызов лишь досылает уже стоящее в очереди.
import { admin } from './_lib/auth.js'
import { pushReady, sendOne } from './_lib/push.js'

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') return res.status(405).end()
  if (!pushReady()) return res.status(503).json({ ok: false, error: 'Push не настроен' })
  const db = admin()
  let total = 0
  for (let round = 0; round < 5; round++) {
    const { data: batch, error } = await db.rpc('push_claim', { p_limit: 50 })
    if (error) return res.status(500).json({ ok: false, error: error.message })
    if (!batch?.length) break
    for (const m of batch) {
      let q = db.from('push_subscriptions').select('id, endpoint, p256dh, auth').eq('kind', m.audience)
      if (m.audience === 'tenant') q = q.eq('tenant_id', m.tenant_id)
      const { data: subs } = await q
      let delivered = 0
      const errors = []
      await Promise.all((subs || []).map(async s => {
        const r = await sendOne(s, { title: m.title, body: m.body || '', url: m.url || '/', tag: m.tag || String(m.id) })
        if (r === 'ok') { delivered++; await db.from('push_subscriptions').update({ last_ok_at: new Date().toISOString() }).eq('id', s.id) }
        else if (r === 'gone') await db.from('push_subscriptions').delete().eq('id', s.id)
        else errors.push(r)
      }))
      await db.from('push_outbox').update({ delivered, error: errors.length ? errors.join('; ').slice(0, 500) : null }).eq('id', m.id)
      total++
    }
  }
  res.status(200).json({ ok: true, processed: total })
}
