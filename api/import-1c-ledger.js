import { requireStaff, fetch1cDebtsXml } from './_lib/auth.js'
const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY

async function sb(path, method = 'GET', body = null, prefer = 'return=minimal') {
  const res = await fetch(SUPABASE_URL + '/rest/v1/' + path, {
    method,
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY,
      'Content-Type': 'application/json',
      'Prefer': prefer,
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  })
  const text = await res.text()
  try { return JSON.parse(text) } catch { return text }
}

function attr(str, name) {
  const m = str.match(new RegExp(`${name}="([^"]*)"`, 'i'))
  return m ? m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim() : ''
}

export const config = { maxDuration: 60 }

export default async function handler(req, res) {
  if (!(await requireStaff(req, res, ['owner', 'manager', 'accountant']))) return
  if (req.method !== 'POST') return res.status(405).end()

  try {
    const xml = await fetch1cDebtsXml()

    const metaMatch = xml.match(/<Debts([^>]*)>/)
    const meta = metaMatch ? {
      asOf: attr(metaMatch[1], 'asOf'),
      operationsFrom: attr(metaMatch[1], 'operationsFrom'),
    } : {}

    // Load tenants — index by id_1c (primary) and inn (fallback)
    const tenants = await sb('tenants?select=id,inn,id_1c&limit=500', 'GET', null, 'return=representation')
    const byId1c = {}
    const byInn = {}
    for (const t of (Array.isArray(tenants) ? tenants : [])) {
      if (t.id_1c) byId1c[t.id_1c] = t.id
      if (t.inn) byInn[t.inn] = t.id
    }

    const entries = []
    const cpBlocks = xml.split('<Counterparty ').slice(1)

    for (const block of cpBlocks) {
      const cpTag = block.split('>')[0]
      const id1c = attr(cpTag, 'id')
      const inn = attr(cpTag, 'inn')
      // Match by id_1c first, then inn
      const tenantId = byId1c[id1c] || byInn[inn] || null

      // Contract name map: id → name
      const contractMap = {}
      for (const cm of block.matchAll(/<Contract ([^>]+)>/g)) {
        const cid = attr(cm[1], 'id')
        const cname = attr(cm[1], 'name')
        if (cid) contractMap[cid] = cname
      }

      // Doc elements = outstanding documents (pre-period balance)
      for (const dm of block.matchAll(/<Doc ([^/]+)\/>/g)) {
        const tag = dm[1]
        const id = attr(tag, 'id')
        if (!id) continue

        const debt = parseFloat(attr(tag, 'debt') || '0')
        const advance = parseFloat(attr(tag, 'advance') || '0')
        const date = attr(tag, 'date')

        // Find parent contract by position in block
        const pos = block.indexOf(dm[0])
        const beforeDoc = block.slice(0, pos)
        const lastContract = beforeDoc.lastIndexOf('<Contract ')
        let contractId = ''
        if (lastContract > -1) {
          contractId = attr(beforeDoc.slice(lastContract).split('>')[0], 'id')
        }

        entries.push({
          id: 'doc_' + id,
          tenant_id: tenantId,
          counterparty_1c_id: id1c || null,
          inn: inn || null,
          contract_1c_id: contractId || null,
          contract_name: contractMap[contractId] || null,
          kind: debt > 0 ? 'charge' : 'payment',
          doc_type: attr(tag, 'type'),
          doc_number: attr(tag, 'number'),
          date: date || new Date().toISOString(),
          charged: debt,
          paid: advance,
          source: '1c',
          note: 'Входящий остаток',
        })
      }

      // Op elements = operations in the period
      for (const om of block.matchAll(/<Op ([^/]+)\/>/g)) {
        const tag = om[1]
        const id = attr(tag, 'id')
        if (!id) continue
        const contractId = attr(tag, 'contractId')
        entries.push({
          id: 'op_' + id,
          tenant_id: tenantId,
          counterparty_1c_id: id1c || null,
          inn: inn || null,
          contract_1c_id: contractId || null,
          contract_name: contractMap[contractId] || null,
          kind: attr(tag, 'kind'),
          doc_type: attr(tag, 'type'),
          doc_number: attr(tag, 'number'),
          date: attr(tag, 'date') || new Date().toISOString(),
          charged: parseFloat(attr(tag, 'charged') || '0'),
          paid: parseFloat(attr(tag, 'paid') || '0'),
          source: '1c',
          note: null,
        })
      }
    }

    // Upsert in batches of 200
    const BATCH = 200
    for (let i = 0; i < entries.length; i += BATCH) {
      await sb('ledger_entries', 'POST', entries.slice(i, i + BATCH), 'resolution=merge-duplicates,return=minimal')
    }

    const matched = entries.filter(e => e.tenant_id).length

    res.status(200).json({
      ok: true,
      meta,
      imported: entries.length,
      docs: entries.filter(e => e.id.startsWith('doc_')).length,
      ops: entries.filter(e => e.id.startsWith('op_')).length,
      matched,
      unmatched: entries.length - matched,
    })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
}
