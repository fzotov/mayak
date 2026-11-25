// POST /api/push-subscribe   { endpoint, keys: { p256dh, auth } } — включить push на этом устройстве.
// DELETE /api/push-subscribe { endpoint } — выключить.
// Кто подписывается (сотрудник или арендатор) сервер определяет сам по входу.
import { admin } from './_lib/auth.js'

async function whoAmI(req) {
  const h = req.headers?.authorization || ''
  const token = h.startsWith('Bearer ') ? h.slice(7).trim() : ''
  if (!token) return null
  const db = admin()
  const { data, error } = await db.auth.getUser(token)
  if (error || !data?.user) return null
  const uid = data.user.id
  const { data: profile } = await db.from('profiles').select('user_id').eq('user_id', uid).maybeSingle()
  if (profile) return { uid, kind: 'staff', tenantId: null }
  const { data: link } = await db.from('tenant_users').select('tenant_id').eq('user_id', uid).maybeSingle()
  if (link?.tenant_id) return { uid, kind: 'tenant', tenantId: link.tenant_id }
  return null
}

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'DELETE') return res.status(405).end()
  const me = await whoAmI(req)
  if (!me) return res.status(401).json({ ok: false, error: 'Требуется вход' })
  const endpoint = String(req.body?.endpoint || '')
  if (!/^https:\/\//.test(endpoint) || endpoint.length > 1000) return res.status(400).json({ ok: false, error: 'Неверная подписка' })
  const db = admin()

  if (req.method === 'DELETE') {
    const { error } = await db.from('push_subscriptions').delete().eq('endpoint', endpoint).eq('user_id', me.uid)
    if (error) return res.status(500).json({ ok: false, error: error.message })
    return res.status(200).json({ ok: true })
  }

  const p256dh = String(req.body?.keys?.p256dh || ''), auth = String(req.body?.keys?.auth || '')
  if (!p256dh || !auth || p256dh.length > 200 || auth.length > 100) return res.status(400).json({ ok: false, error: 'Неверная подписка' })
  const { error } = await db.from('push_subscriptions').upsert({
    endpoint, p256dh, auth, user_id: me.uid, kind: me.kind, tenant_id: me.tenantId,
    user_agent: String(req.headers['user-agent'] || '').slice(0, 300),
  }, { onConflict: 'endpoint' })
  if (error) return res.status(500).json({ ok: false, error: error.message })
  res.status(200).json({ ok: true, kind: me.kind })
}
