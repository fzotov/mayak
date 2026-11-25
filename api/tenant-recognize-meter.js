// POST /api/tenant-recognize-meter { meterId, imageBase64 } — арендатор: подсказка показания по фото своего счётчика.
import { requireTenant, admin } from './_lib/auth.js'
import { recognizeMeter } from './_lib/meterVision.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const me = await requireTenant(req, res)
  if (!me) return
  const { meterId, imageBase64 } = req.body || {}
  if (!meterId || !imageBase64 || String(imageBase64).length > 4_500_000) return res.status(400).json({ ok: false, error: 'Нет фото' })
  const { data: meter } = await admin().from('meters').select('id, tenant_id, serial, number').eq('id', meterId).maybeSingle()
  if (!meter || meter.tenant_id !== me.tenantId) return res.status(404).json({ ok: false, error: 'Счётчик не найден' })
  try {
    const r = await recognizeMeter({ imageBase64, meterNumbers: [meter.serial, meter.number].filter(Boolean), mediaType: 'image/jpeg' })
    if (!r.ok) return res.status(200).json({ ok: false, error: 'Не удалось распознать, введите показание вручную' })
    const best = (r.meters || []).find(m => typeof m.reading === 'number') || null
    res.status(200).json({ ok: true, reading: best?.reading ?? null, serial: best?.serial || '' })
  } catch {
    res.status(200).json({ ok: false, error: 'Не удалось распознать, введите показание вручную' })
  }
}
