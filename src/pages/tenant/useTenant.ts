import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

export interface TenantData {
  tenant: any | null
  balance: { debt: number; advance: number; as_of: string | null } | null
  loading: boolean
}

/** Карточка арендатора и сальдо по 1С. Обе выборки ограничены RLS своим арендатором. */
export function useTenant(tenantId: string): TenantData {
  const [s, setS] = useState<TenantData>({ tenant: null, balance: null, loading: true })
  useEffect(() => {
    let off = false
    Promise.all([
      supabase.from('tenants').select('*').eq('id', tenantId).maybeSingle(),
      supabase.from('tenant_balances').select('debt, advance, as_of').eq('tenant_id', tenantId).maybeSingle(),
    ]).then(([t, b]) => { if (!off) setS({ tenant: t.data, balance: b.data ? { debt: Number(b.data.debt), advance: Number(b.data.advance), as_of: b.data.as_of } : null, loading: false }) })
    return () => { off = true }
  }, [tenantId])
  return s
}
