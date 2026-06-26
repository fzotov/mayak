import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)

export default async function handler(req, res) {
  if (req.method !== 'PATCH') return res.status(405).end()
  const { tenantId, phone, email } = req.body
  if (!tenantId) return res.status(400).json({ ok: false, error: 'tenantId required' })
  const { error } = await supabase.from('tenants').update({ phone, email }).eq('id', tenantId)
  if (error) return res.status(500).json({ ok: false, error: error.message })
  res.status(200).json({ ok: true })
}
