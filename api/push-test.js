// POST /api/push-test — пробное push-сообщение себе на все свои устройства.
import { admin } from './_lib/auth.js'
import { pushReady, sendOne } from './_lib/push.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const h = req.headers?.authorization || ''
  const token = h.startsWith('Bearer ') ? h.slice(7).trim() : ''
  const db = admin()
  const { data } = token ? await db.auth.getUser(token) : { data: null }
  const uid = data?.user?.id
  if (!uid) return res.status(401).json({ ok: false, error: 'Требуется вход' })
  if (!pushReady()) return res.status(503).json({ ok: false, error: 'Push не настроен на сервере' })
  const { data: subs } = await db.from('push_subscriptions').select('id, endpoint, p256dh, auth, kind').eq('user_id', uid)
  if (!subs?.length) return res.status(404).json({ ok: false, error: 'На этом аккаунте нет включённых устройств' })
  let ok = 0
  for (const s of subs) {
    const r = await sendOne(s, { title: 'Маяк: проверка уведомлений', body: 'Уведомления на этом устройстве работают.', url: s.kind === 'tenant' ? '/tenant' : '/', tag: 'test' })
    if (r === 'ok') ok++
    else if (r === 'gone') await db.from('push_subscriptions').delete().eq('id', s.id)
  }
  res.status(200).json({ ok: ok > 0, delivered: ok, devices: subs.length, error: ok ? undefined : 'Не доставлено ни на одно устройство' })
}
