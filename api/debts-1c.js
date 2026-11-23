// GET /api/debts-1c — взаиморасчёты по данным 1С.
// ?refresh=1 — обязательно свежая выгрузка; иначе свежая, а если 1С не отвечает — последний сохранённый снимок.
import { requireStaff } from './_lib/auth.js'
import { loadDebtsFresh, loadDebtsSnapshot } from './_lib/onec.js'

export const config = { maxDuration: 60 }

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()
  if (!(await requireStaff(req, res))) return
  try {
    const fresh = await loadDebtsFresh()
    return res.status(200).json({ ok: true, ...fresh })
  } catch (e) {
    if (req.query?.refresh) return res.status(502).json({ ok: false, error: e.message })
    const snap = await loadDebtsSnapshot().catch(() => null)
    if (snap) return res.status(200).json({ ok: true, ...snap, warning: e.message })
    return res.status(502).json({ ok: false, error: e.message })
  }
}
