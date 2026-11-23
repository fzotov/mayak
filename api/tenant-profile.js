// PATCH /api/tenant-profile — арендатор меняет свои контактные данные (только телефон и email для связи).
import { requireTenant, admin } from './_lib/auth.js'

export default async function handler(req, res) {
  if (req.method !== 'PATCH') return res.status(405).end()
  const me = await requireTenant(req, res)
  if (!me) return
  const phone = String(req.body?.phone ?? '').trim().slice(0, 40)
  const email = String(req.body?.email ?? '').trim().slice(0, 120)
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return res.status(400).json({ ok: false, error: 'Некорректный email' })
  const { error } = await admin().from('tenants').update({ phone: phone || null, email: email || null }).eq('id', me.tenantId)
  if (error) return res.status(500).json({ ok: false, error: error.message })
  res.status(200).json({ ok: true })
}
