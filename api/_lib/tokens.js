// Одноразовые ссылки: приглашение арендатора, приглашение сотрудника, сброс пароля.
// В базе хранится только SHA-256 от токена; таблица auth_tokens доступна лишь service key.
import crypto from 'crypto'
import { admin } from './auth.js'

export const hashToken = t => crypto.createHash('sha256').update(String(t)).digest('hex')

export async function issueToken({ kind, email, tenantId = null, payload = null, ttlHours }) {
  const token = crypto.randomBytes(32).toString('hex')
  const db = admin()
  // прежние неиспользованные ссылки того же вида для этого адреса гасим
  await db.from('auth_tokens').update({ used_at: new Date().toISOString() }).eq('email', email).eq('kind', kind).is('used_at', null)
  const { error } = await db.from('auth_tokens').insert({
    token_hash: hashToken(token), kind, email, tenant_id: tenantId, payload,
    expires_at: new Date(Date.now() + ttlHours * 3600 * 1000).toISOString(),
  })
  if (error) throw new Error(error.message)
  return token
}

export async function findToken(token) {
  if (!token || String(token).length < 32) return null
  const { data } = await admin().from('auth_tokens').select('*').eq('token_hash', hashToken(token)).maybeSingle()
  if (!data || data.used_at || new Date(data.expires_at) < new Date()) return null
  return data
}

export const normEmail = e => String(e || '').trim().toLowerCase()
export const validEmail = e => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)
