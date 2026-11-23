import { requireStaff } from './_lib/auth.js'
/**
 * POST /api/sync-unit-status
 * Синхронизирует units.status на основе таблицы tenants.
 */
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

const SERVICE_ROOMS = new Set(['228', '301', '302', '326', '326A', '326B'])

function norm(s) {
  return String(s).toUpperCase()
    .replace(/А/g, 'A').replace(/а/g, 'A')
    .replace(/Б/g, 'B').replace(/б/g, 'B')
    .trim()
}

function parseUnitNumbers(raw) {
  if (!raw) return []
  const parts = raw.replace(/,/g, ' ').split(/\s+/)
  const result = []
  for (const p of parts) {
    const n = norm(p)
    if (!n || /^(И|ЕЩЁ)$/.test(n)) continue
    // "201.202" — combined unit: keep whole + individual parts
    if (/^\d{3}(\.\d{3})+$/.test(n)) {
      result.push(n)
      for (const sub of n.split('.')) result.push(sub)
    } else {
      result.push(n)
    }
  }
  return result
}

function isOccupied(unitNumber, occupiedSet) {
  const n = norm(unitNumber)
  if (occupiedSet.has(n)) return true
  if (n.includes('.')) return n.split('.').some(p => occupiedSet.has(p))
  return false
}

export default async function handler(req, res) {
  if (!(await requireStaff(req, res))) return
  if (req.method !== 'POST' && req.method !== 'GET') return res.status(405).end()

  const { data: tenants, error: tErr } = await supabase
    .from('tenants').select('unit_number').not('status', 'eq', 'archived')
  if (tErr) return res.status(500).json({ ok: false, error: tErr.message })

  const occupiedByTenant = new Set()
  for (const t of tenants) {
    for (const n of parseUnitNumbers(t.unit_number)) occupiedByTenant.add(n)
  }

  const { data: units, error: uErr } = await supabase.from('units').select('id, number, status')
  if (uErr) return res.status(500).json({ ok: false, error: uErr.message })

  const updates = []
  for (const u of units) {
    const n = norm(u.number)
    const correct = (SERVICE_ROOMS.has(n) || isOccupied(u.number, occupiedByTenant)) ? 'occupied' : 'free'
    if (u.status !== correct) {
      await supabase.from('units').update({ status: correct }).eq('id', u.id)
      updates.push({ number: u.number, from: u.status, to: correct })
    }
  }

  res.status(200).json({ ok: true, totalUnits: units.length, changed: updates.length, updates })
}
