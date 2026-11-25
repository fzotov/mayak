// POST /api/tenant-repair — арендатор создаёт заявку на ремонт. Все служебные поля задаёт сервер.
import { requireTenant, admin } from './_lib/auth.js'
import { savePhoto } from './_lib/upload.js'
import { randomUUID } from 'node:crypto'

const CATEGORIES = ['Электрика', 'Сантехника', 'Отопление', 'Интернет', 'Уборка', 'Другое']

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const me = await requireTenant(req, res)
  if (!me) return
  const category = CATEGORIES.includes(req.body?.category) ? req.body.category : 'Другое'
  const description = String(req.body?.description || '').trim().slice(0, 2000)
  if (description.length < 5) return res.status(400).json({ ok: false, error: 'Опишите проблему подробнее' })

  const db = admin()
  // не больше 10 заявок в сутки от одного арендатора
  const { count } = await db.from('repairs').select('id', { count: 'exact', head: true }).eq('tenant_id', me.tenantId)
    .gte('created_at', new Date(Date.now() - 24 * 3600 * 1000).toISOString())
  if ((count || 0) >= 10) return res.status(429).json({ ok: false, error: 'Слишком много заявок за сутки. Позвоните в администрацию.' })

  const raw = Array.isArray(req.body?.photos) ? req.body.photos.slice(0, 3) : []
  let photos = []
  try {
    photos = await Promise.all(raw.map(b64 => savePhoto('repair-photos', `tenant/${me.tenantId}/${randomUUID()}.jpg`, b64)))
  } catch (e) { return res.status(400).json({ ok: false, error: e.message }) }

  const { data: unit } = await db.from('units').select('id').eq('tenant_id', me.tenantId).limit(1).maybeSingle()
  const { data, error } = await db.from('repairs').insert({
    tenant_id: me.tenantId, unit_id: unit?.id || null, category, description,
    priority: req.body?.urgent ? 'emergency' : 'medium', status: 'new', photos: photos.length ? photos : null,
  }).select('id, number').single()
  if (error) return res.status(500).json({ ok: false, error: error.message })
  res.status(200).json({ ok: true, id: data.id, number: data.number })
}
