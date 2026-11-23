import { supabase } from './supabase'

export interface TenantSession { tenantId: string; email: string }
const KEY = 'tenant_session'

/** Сессия арендатора: вход — Supabase Auth, привязка к арендатору — таблица tenant_users (читается под RLS). */
export async function loadTenantSession(): Promise<TenantSession | null> {
  const { data } = await supabase.auth.getSession()
  const user = data.session?.user
  if (!user) { localStorage.removeItem(KEY); return null }
  const { data: link } = await supabase.from('tenant_users').select('tenant_id').eq('user_id', user.id).maybeSingle()
  if (!link?.tenant_id) { localStorage.removeItem(KEY); return null }
  const s = { tenantId: link.tenant_id as string, email: user.email ?? '' }
  localStorage.setItem(KEY, JSON.stringify(s)) // только для отображения в шапке; доступ к данным даёт не он
  return s
}

export async function tenantSignOut() {
  localStorage.removeItem(KEY)
  await supabase.auth.signOut()
}
