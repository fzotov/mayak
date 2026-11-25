// POST /api/recognize-meter — сотрудник: распознать показание по фото.
import { requireStaff } from './_lib/auth.js'
import { recognizeMeter } from './_lib/meterVision.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  if (!(await requireStaff(req, res))) return
  const { imageBase64, meterNumbers, mediaType } = req.body || {}
  if (!imageBase64) return res.status(400).json({ ok: false, error: 'Нет фото' })
  try {
    const r = await recognizeMeter({ imageBase64, meterNumbers, mediaType })
    res.status(r.ok ? 200 : 500).json(r)
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
}
