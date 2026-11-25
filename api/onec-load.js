// POST /api/onec-load { asOf? } — забрать выгрузку взаиморасчётов из 1С, разобрать и положить в промежуточные таблицы (onec_stage).
import { requireStaff, fetch1cDebtsXml } from './_lib/auth.js'
import { parseDebtsXml, toStagePayload } from './_lib/onecXml.js'
import { createClient } from '@supabase/supabase-js'

export const config = { maxDuration: 60 }

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const me = await requireStaff(req, res)
  if (!me) return
  const asOf = /^\d{4}-\d{2}-\d{2}$/.test(String(req.body?.asOf || '')) ? req.body.asOf : null
  let parsed
  try {
    parsed = parseDebtsXml(await fetch1cDebtsXml(asOf))
  } catch (e) {
    const msg = String(e?.message || e)
    return res.status(502).json({ ok: false, error: /504|timeout|aborted/i.test(msg)
      ? '1С не успела сформировать выгрузку (таймаут). Нужна доработка выгрузки на стороне 1С — см. docs/1c-export-v2.md, или загрузите файл debts.xml вручную.'
      : msg })
  }
  // onec_stage вызывается от имени сотрудника: в журнале видно, кто загрузил
  const token = (req.headers.authorization || '').slice(7)
  const db = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: 'Bearer ' + token } }, auth: { persistSession: false } })
  const { data: importId, error } = await db.rpc('onec_stage', { p: toStagePayload(parsed, 'http') })
  if (error) return res.status(500).json({ ok: false, error: error.message })
  const { data: imp } = await db.from('onec_imports').select('totals, as_of').eq('id', importId).maybeSingle()
  res.status(200).json({ ok: true, importId, asOf: imp?.as_of, totals: imp?.totals })
}
