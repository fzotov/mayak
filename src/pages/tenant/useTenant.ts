import { supabase } from '../../lib/supabase'
import { sb, useSb } from '../../lib/query'
import type { Tables } from '../../lib/database.types'

export interface TenantData {
  tenant: Tables<'tenants'> | null
  balance: { debt: number; advance: number; as_of: string | null } | null
  loading: boolean
  /** Текст ошибки загрузки карточки (пусто, если всё загрузилось). */
  error: string
}

/** Карточка арендатора и сальдо по 1С. Обе выборки ограничены RLS своим арендатором. */
export function useTenant(tenantId: string, enabled = true): TenantData {
  const t = useSb<Tables<'tenants'> | null>(['tenants', tenantId, 'cabinet'], () => sb(supabase.from('tenants').select('*').eq('id', tenantId).maybeSingle()), { enabled })
  const b = useSb<Pick<Tables<'tenant_balances'>, 'debt' | 'advance' | 'as_of'> | null>(['tenant_balances', tenantId, 'cabinet'], () => sb(supabase.from('tenant_balances').select('debt, advance, as_of').eq('tenant_id', tenantId).maybeSingle()), { enabled })
  return {
    tenant: t.data ?? null,
    balance: b.data ? { debt: Number(b.data.debt), advance: Number(b.data.advance), as_of: b.data.as_of } : null,
    loading: t.isPending || b.isPending,
    error: t.error?.message || b.error?.message || '',
  }
}
