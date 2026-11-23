// POST /api/set-password — публичная, защищена одноразовым токеном из письма.
// { token, check: true }      → проверить ссылку, вернуть вид и адрес
// { token, password }         → создать/обновить пользователя и погасить ссылку
import { admin } from './_lib/auth.js'
import { findToken } from './_lib/tokens.js'

async function findUserIdByEmail(db, email) {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 })
    if (error || !data?.users?.length) return null
    const u = data.users.find(x => (x.email || '').toLowerCase() === email)
    if (u) return u.id
    if (data.users.length < 200) return null
  }
  return null
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const { token, password, check } = req.body || {}
  try {
    const rec = await findToken(token)
    if (!rec) return res.status(400).json({ ok: false, error: 'Ссылка недействительна или устарела' })
    if (check) return res.status(200).json({ ok: true, kind: rec.kind, email: rec.email })

    if (typeof password !== 'string' || password.length < 8 || password.length > 200) {
      return res.status(400).json({ ok: false, error: 'Пароль должен быть не короче 8 символов' })
    }
    const db = admin()
    const email = rec.email

    let userId = await findUserIdByEmail(db, email)
    if (rec.kind === 'reset' && !userId) return res.status(400).json({ ok: false, error: 'Ссылка недействительна или устарела' })
    if (userId) {
      const { error } = await db.auth.admin.updateUserById(userId, { password, email_confirm: true })
      if (error) throw new Error(error.message)
    } else {
      const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true })
      if (error) throw new Error(error.message)
      userId = data.user.id
    }

    let area = 'tenant'
    if (rec.kind === 'tenant_invite') {
      const { error } = await db.from('tenant_users').upsert(
        { user_id: userId, tenant_id: rec.tenant_id, email, activated_at: new Date().toISOString() }, { onConflict: 'user_id' })
      if (error) throw new Error(error.message)
    } else if (rec.kind === 'staff_invite') {
      const { error } = await db.from('profiles').upsert(
        { user_id: userId, email, full_name: rec.payload?.full_name || email, role: rec.payload?.role || 'manager' }, { onConflict: 'user_id' })
      if (error) throw new Error(error.message)
      area = 'staff'
    } else {
      const { data: p } = await db.from('profiles').select('user_id').eq('user_id', userId).maybeSingle()
      if (p) area = 'staff'
    }

    await db.from('auth_tokens').update({ used_at: new Date().toISOString() }).eq('id', rec.id)
    res.status(200).json({ ok: true, email, area })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
}
