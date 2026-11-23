import { requireStaff } from './_lib/auth.js'
const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY

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

function parseCSV(text) {
  // Handle BOM and normalize line endings
  text = text.replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = text.trim().split('\n')
  if (lines.length < 2) return []

  const sep = lines[0].includes(';') ? ';' : ','
  const headers = lines[0].split(sep).map(h => h.replace(/"/g, '').trim().toLowerCase())

  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].split(sep).map(v => v.replace(/"/g, '').trim())
    if (vals.length < 2) continue
    const row = {}
    headers.forEach((h, j) => { row[h] = vals[j] || '' })
    rows.push(row)
  }
  return rows
}

function detectFields(headers) {
  // Russian bank CSV field mapping
  const find = (keywords) => headers.find(h => keywords.some(k => h.includes(k))) || null
  return {
    date: find(['дата', 'date']),
    amount: find(['сумма', 'amount', 'кредит']),
    debit: find(['дебет', 'расход', 'debit']),
    credit: find(['кредит', 'приход', 'credit']),
    description: find(['назначение', 'описание', 'наименование', 'description', 'details']),
    counterparty: find(['контрагент', 'плательщик', 'получатель', 'counterparty', 'payer']),
    inn: find(['инн', 'inn']),
    ref: find(['номер', 'reference', 'ссылка', 'платежн']),
  }
}

function parseAmount(str) {
  if (!str) return 0
  return parseFloat(str.replace(/\s/g, '').replace(',', '.')) || 0
}

export default async function handler(req, res) {
  if (!(await requireStaff(req, res, ['owner', 'manager', 'accountant']))) return
  if (req.method !== 'POST') return res.status(405).end()

  try {
    const body = req.body
    if (!body || !body.csv) return res.status(400).json({ ok: false, error: 'No CSV data' })

    const rows = parseCSV(body.csv)
    if (!rows.length) return res.status(400).json({ ok: false, error: 'Empty CSV' })

    const headers = Object.keys(rows[0])
    const fields = detectFields(headers)

    // Load tenants for AI matching
    const tenants = await sb('tenants?select=id,full_name,inn&limit=200', 'GET', null, 'return=representation')
    const tenantList = Array.isArray(tenants) ? tenants : []

    // Extract credit rows (incoming payments)
    const credits = rows.filter(row => {
      const amt = fields.credit ? parseAmount(row[fields.credit]) :
                  fields.amount ? parseAmount(row[fields.amount]) : 0
      return amt > 0
    })

    if (!credits.length) return res.json({ ok: true, imported: 0, message: 'No credit transactions found' })

    // AI match: identify tenant per transaction
    const matchPrompt = `You are matching bank transactions to tenants. Return JSON only.

Tenants list:
${tenantList.map(t => `- id="${t.id}" inn="${t.inn || ''}" name="${t.full_name}"`).join('\n')}

Transactions to match (${credits.length} total):
${credits.slice(0, 50).map((r, i) => {
  const desc = fields.description ? r[fields.description] : ''
  const cp = fields.counterparty ? r[fields.counterparty] : ''
  const inn = fields.inn ? r[fields.inn] : ''
  const amt = fields.credit ? r[fields.credit] : fields.amount ? r[fields.amount] : ''
  return `${i}: date="${fields.date ? r[fields.date] : ''}" amount="${amt}" counterparty="${cp}" inn="${inn}" desc="${desc.slice(0, 120)}"`
}).join('\n')}

Return JSON array: [{"idx": 0, "tenant_id": "uuid or null", "confidence": 0-100, "reason": "brief"}]
Match by INN first, then by name. null if no match.`

    let matches = credits.map((_, i) => ({ idx: i, tenant_id: null, confidence: 0 }))

    if (ANTHROPIC_KEY) {
      try {
        const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': ANTHROPIC_KEY,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 4096,
            messages: [{ role: 'user', content: matchPrompt }],
          })
        })
        const aiData = await aiRes.json()
        const text = aiData.content?.[0]?.text || ''
        const jsonMatch = text.match(/\[[\s\S]*\]/)
        if (jsonMatch) matches = JSON.parse(jsonMatch[0])
      } catch (_) { /* use unmatched if AI fails */ }
    }

    const matchMap = {}
    for (const m of matches) matchMap[m.idx] = m

    // Build ledger entries
    const entries = []
    for (let i = 0; i < credits.length; i++) {
      const row = credits[i]
      const match = matchMap[i] || {}
      const dateRaw = fields.date ? row[fields.date] : ''
      const paid = fields.credit ? parseAmount(row[fields.credit]) :
                   fields.amount ? parseAmount(row[fields.amount]) : 0
      const desc = fields.description ? row[fields.description] : ''
      const cp = fields.counterparty ? row[fields.counterparty] : ''
      const innRaw = fields.inn ? row[fields.inn] : ''
      const ref = fields.ref ? row[fields.ref] : ''

      // Try to parse date (DD.MM.YYYY or YYYY-MM-DD)
      let dateISO = new Date().toISOString()
      if (dateRaw) {
        const m1 = dateRaw.match(/(\d{2})\.(\d{2})\.(\d{4})/)
        const m2 = dateRaw.match(/(\d{4})-(\d{2})-(\d{2})/)
        if (m1) dateISO = `${m1[3]}-${m1[2]}-${m1[1]}T00:00:00`
        else if (m2) dateISO = dateRaw
      }

      const id = `bank_${ref || i}_${dateRaw.replace(/\D/g, '')}_${Math.round(paid)}`

      entries.push({
        id,
        tenant_id: match.confidence >= 60 ? (match.tenant_id || null) : null,
        inn: innRaw || null,
        contract_1c_id: null,
        contract_name: null,
        kind: 'payment',
        doc_type: 'Поступление на расчетный счет',
        doc_number: ref,
        date: dateISO,
        charged: 0,
        paid,
        source: 'bank',
        note: [cp, desc].filter(Boolean).join(' | ').slice(0, 500),
      })
    }

    // Upsert
    const BATCH = 200
    for (let i = 0; i < entries.length; i += BATCH) {
      await sb('ledger_entries', 'POST', entries.slice(i, i + BATCH), 'resolution=merge-duplicates,return=minimal')
    }

    const matched = entries.filter(e => e.tenant_id).length
    res.status(200).json({
      ok: true,
      total: credits.length,
      imported: entries.length,
      matched,
      unmatched: entries.length - matched,
    })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
}
