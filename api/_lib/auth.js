// Общая проверка входа для всех серверных функций.
// Service key используется только после того, как вызывающий опознан.
import { createClient } from '@supabase/supabase-js'

const URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY

export const APP_URL = (process.env.APP_URL || 'https://mayak-xi.vercel.app').replace(/\/$/, '')

let _admin = null
/** Клиент с полным доступом. Вызывать только после requireStaff / requireTenant или в публичных функциях с собственной проверкой токена. */
export function admin() {
  if (!URL || !SERVICE_KEY) throw new Error('Не заданы SUPABASE_URL / SUPABASE_SERVICE_KEY')
  if (!_admin) _admin = createClient(URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  return _admin
}

async function userFromRequest(req) {
  const h = req.headers?.authorization || req.headers?.Authorization || ''
  const token = h.startsWith('Bearer ') ? h.slice(7).trim() : ''
  if (!token) return null
  const { data, error } = await admin().auth.getUser(token)
  if (error || !data?.user) return null
  return data.user
}

/** Сотрудник. roles — допустимые роли; пусто = любая. Возвращает { user, profile } или null (ответ уже отправлен). */
export async function requireStaff(req, res, roles = []) {
  let user
  try { user = await userFromRequest(req) } catch { user = null }
  if (!user) { res.status(401).json({ ok: false, error: 'Требуется вход' }); return null }
  const { data: profile } = await admin().from('profiles').select('user_id, full_name, role').eq('user_id', user.id).maybeSingle()
  if (!profile) { res.status(403).json({ ok: false, error: 'Нет доступа' }); return null }
  if (roles.length && !roles.includes(profile.role)) { res.status(403).json({ ok: false, error: 'Недостаточно прав' }); return null }
  return { user, profile }
}

/** Арендатор. Возвращает { user, tenantId } или null (ответ уже отправлен). */
export async function requireTenant(req, res) {
  let user
  try { user = await userFromRequest(req) } catch { user = null }
  if (!user) { res.status(401).json({ ok: false, error: 'Требуется вход' }); return null }
  const { data: link } = await admin().from('tenant_users').select('tenant_id').eq('user_id', user.id).maybeSingle()
  if (!link?.tenant_id) { res.status(403).json({ ok: false, error: 'Нет доступа' }); return null }
  return { user, tenantId: link.tenant_id }
}

/** Экранирование для вставки пользовательских строк в HTML писем и страниц. */
export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}

/** Выгрузка взаиморасчётов из 1С. Адрес и токен — только из переменных окружения. */
export async function fetch1cDebtsXml() {
  const url = process.env.ONEC_DEBTS_URL || 'https://o.mayak-d.ru/export/debts.xml'
  const token = process.env.ONEC_TOKEN
  if (!token) throw new Error('Не задан ONEC_TOKEN')
  const resp = await fetch(url, { headers: { 'X-Auth-Token': token }, signal: AbortSignal.timeout(50000) })
  if (!resp.ok) throw new Error('1С не отвечает: ' + resp.status)
  return await resp.text()
}
