import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const { meterId, reading, readingDate } = req.body
  if (!meterId || reading == null) return res.status(400).json({ ok: false, error: 'meterId and reading required' })

  // Get last reading for previous_reading calculation
  const { data: last } = await supabase.from('meter_readings').select('reading').eq('meter_id', meterId).order('reading_date', { ascending: false }).limit(1).single()
  const previousReading = last?.reading ?? 0
  const consumption = Math.max(0, reading - previousReading)

  // Get meter tariff
  const { data: meter } = await supabase.from('meters').select('tariff').eq('id', meterId).single()
  const amount = consumption * (meter?.tariff ?? 0)

  const { error } = await supabase.from('meter_readings').insert({
    meter_id: meterId,
    reading,
    previous_reading: previousReading,
    consumption,
    amount,
    reading_date: readingDate || new Date().toISOString().split('T')[0],
  })
  if (error) return res.status(500).json({ ok: false, error: error.message })
  res.status(200).json({ ok: true, consumption, amount })
}
