// Разбор выгрузки взаиморасчётов 1С (debts.xml) и сохранение сальдо в базе.
import { admin, fetch1cDebtsXml } from './auth.js'

const unesc = s => s.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&apos;/g, "'").replace(/&amp;/g, '&')
export const attr = (str, name) => { const m = str.match(new RegExp(`(?:^|\\s)${name}="([^"]*)"`, 'i')); return m ? unesc(m[1]).trim() : '' }
const num = v => { const n = parseFloat(String(v || '0').replace(',', '.')); return Number.isFinite(n) ? n : 0 }

export function parseDebtsXml(xml) {
  const counterparties = []
  for (const block of xml.split('<Counterparty ').slice(1)) {
    const cpTag = block.split('>')[0]
    const cp = {
      id: attr(cpTag, 'id'), name: attr(cpTag, 'name'), inn: attr(cpTag, 'inn'), kpp: attr(cpTag, 'kpp'),
      debt: num(attr(cpTag, 'debt')), advance: num(attr(cpTag, 'advance')), contracts: [], operations: [],
    }
    for (const cb of block.split('<Contract ').slice(1)) {
      const ctTag = cb.split('>')[0]
      const contract = { id: attr(ctTag, 'id'), name: attr(ctTag, 'name'), debt: num(attr(ctTag, 'debt')), advance: num(attr(ctTag, 'advance')), docs: [] }
      for (const db of cb.split('<Doc ').slice(1)) {
        const t = db.split('/>')[0].split('>')[0]
        if (!attr(t, 'id')) continue
        contract.docs.push({ id: attr(t, 'id'), type: attr(t, 'type'), number: attr(t, 'number'), date: attr(t, 'date'), debt: num(attr(t, 'debt')), advance: num(attr(t, 'advance')) })
      }
      cp.contracts.push(contract)
    }
    for (const ob of block.split('<Op ').slice(1)) {
      const t = ob.split('/>')[0].split('>')[0]
      if (!attr(t, 'id')) continue
      cp.operations.push({ id: attr(t, 'id'), kind: attr(t, 'kind'), type: attr(t, 'type'), number: attr(t, 'number'), date: attr(t, 'date'), contractId: attr(t, 'contractId'), charged: num(attr(t, 'charged')), paid: num(attr(t, 'paid')) })
    }
    counterparties.push(cp)
  }
  const metaM = xml.match(/<Debts([^>]*)>/)
  const meta = metaM ? { generated: attr(metaM[1], 'generated'), asOf: attr(metaM[1], 'asOf'), operationsFrom: attr(metaM[1], 'operationsFrom'), org: attr(metaM[1], 'org'), orgInn: attr(metaM[1], 'orgInn') } : {}
  if (!metaM) throw new Error('1С вернула не выгрузку взаиморасчётов')
  return { meta, counterparties }
}

/** Свежая выгрузка: разобрать, сохранить снимок и сальдо арендаторов. */
export async function loadDebtsFresh() {
  const parsed = parseDebtsXml(await fetch1cDebtsXml())
  const db = admin()
  const now = new Date().toISOString()
  await db.from('onec_snapshot').upsert({ id: 1, fetched_at: now, as_of: parsed.meta.asOf || null, data: parsed })

  const { data: tenants } = await db.from('tenants').select('id, inn, id_1c')
  const byId1c = {}, byInn = {}
  for (const t of tenants || []) { if (t.id_1c) byId1c[t.id_1c] = t.id; if (t.inn) byInn[t.inn] = t.id }
  const rows = new Map()
  for (const cp of parsed.counterparties) {
    const tid = byId1c[cp.id] || (cp.inn && byInn[cp.inn])
    if (!tid) continue
    const r = rows.get(tid) || { tenant_id: tid, debt: 0, advance: 0, as_of: parsed.meta.asOf || now, updated_at: now }
    r.debt = Math.round((r.debt + cp.debt) * 100) / 100
    r.advance = Math.round((r.advance + cp.advance) * 100) / 100
    rows.set(tid, r)
  }
  if (rows.size) await db.from('tenant_balances').upsert([...rows.values()])
  // у кого в выгрузке больше нет остатков — обнуляем
  const have = new Set(rows.keys())
  const { data: old } = await db.from('tenant_balances').select('tenant_id')
  const gone = (old || []).map(o => o.tenant_id).filter(id => !have.has(id))
  if (gone.length) await db.from('tenant_balances').update({ debt: 0, advance: 0, as_of: parsed.meta.asOf || now, updated_at: now }).in('tenant_id', gone)
  return { ...parsed, fetchedAt: now, stale: false }
}

/** Последний сохранённый снимок — когда 1С недоступна. */
export async function loadDebtsSnapshot() {
  const { data } = await admin().from('onec_snapshot').select('fetched_at, data').eq('id', 1).maybeSingle()
  return data ? { ...data.data, fetchedAt: data.fetched_at, stale: true } : null
}
