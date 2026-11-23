// POST /api/tenant-meter-reading — арендатор передаёт показание своего счётчика.
import { requireTenant, admin } from './_lib/auth.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const me = await requireTenant(req, res)
  if (!me) return
  const { meterId } = req.body || {}
  const reading = Number(req.body?.reading)
  if (!meterId || !Number.isFinite(reading) || reading < 0) return res.status(400).json({ ok: false, error: 'Укажите счётчик и показание' })

  const db = admin()
  const { data: meter } = await db.from('meters').select('id, tariff, tenant_id').eq('id', meterId).maybeSingle()
  if (!meter || meter.tenant_id !== me.tenantId) return res.status(404).json({ ok: false, error: 'Счётчик не найден' })

  const { data: last } = await db.from('meter_readings').select('reading').eq('meter_id', meterId)
    .order('reading_date', { ascending: false }).order('created_at', { ascending: false }).limit(1).maybeSingle()
  const previous = Number(last?.reading ?? 0)
  if (reading < previous) return res.status(400).json({ ok: false, error: `Показание меньше предыдущего (${previous})` })
  const consumption = reading - previous
  const amount = Math.round(consumption * Number(meter.tariff ?? 0) * 100) / 100

  const { error } = await db.from('meter_readings').insert({
    meter_id: meterId, reading, previous_reading: previous, consumption, amount,
    reading_date: new Date().toISOString().slice(0, 10),
    period: new Date().toISOString().slice(0, 7) + '-01', prev_value: previous, curr_value: reading,
  })
  if (error) return res.status(500).json({ ok: false, error: error.message })
  res.status(200).json({ ok: true, consumption, amount })
}
