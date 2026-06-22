import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(url, key)

export async function getTenants() {
  const { data } = await supabase.from('tenants').select('*, units(*)').order('full_name')
  return data || []
}

export async function getInvoices() {
  const { data } = await supabase.from('invoices').select('*, tenants(*), units(*)').order('created_at', { ascending: false })
  return data || []
}
