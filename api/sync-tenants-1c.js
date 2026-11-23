import { requireStaff, fetch1cDebtsXml } from './_lib/auth.js'
const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY

async function sb(path, method = 'GET', body = null, prefer = 'return=representation') {
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

function detectType(name) {
  const n = name.toUpperCase()
  if (n.startsWith('ООО') || n.startsWith('АО') || n.startsWith('ПАО') || n.startsWith('ОАО') ||
      n.startsWith('ОБЩЕСТВО') || n.startsWith('АНО') || n.startsWith('МАУ') || n.startsWith('МКУ') ||
      n.startsWith('МУНИЦИПАЛЬНОЕ') || n.startsWith('АВТОНОМНАЯ') || n.startsWith('АКЦИОНЕРНОЕ') ||
      n.startsWith('ПУБЛИЧНОЕ') || n.startsWith('НОТАРИУС') || n.includes('ОРГАНИЗАЦИЯ')) return 'COMPANY'
  if (n.startsWith('ИП ') || n.startsWith('ИП\t') || n.startsWith('ИНДИВИДУАЛЬНЫЙ ПРЕДПРИНИМАТЕЛЬ'))
    return 'IP'
  return 'INDIVIDUAL'
}

function cleanName(raw) {
  return raw
    .replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/«/g, '"').replace(/»/g, '"').trim()
}

function attr(str, name) {
  const m = str.match(new RegExp(`${name}="([^"]*)"`, 'i'))
  return m ? cleanName(m[1]) : ''
}

function parseContractDate(contractName) {
  const m1 = contractName.match(/от\s+(\d{2})\.(\d{2})\.(\d{4})/)
  if (m1) return `${m1[3]}-${m1[2]}-${m1[1]}`
  const months = { 'января': '01', 'февраля': '02', 'марта': '03', 'апреля': '04', 'мая': '05',
    'июня': '06', 'июля': '07', 'августа': '08', 'сентября': '09', 'октября': '10', 'ноября': '11', 'декабря': '12' }
  const m2 = contractName.match(/от\s+(\d{1,2})\s+([а-яё]+)\s+(\d{4})/i)
  if (m2 && months[m2[2].toLowerCase()]) return `${m2[3]}-${months[m2[2].toLowerCase()]}-${m2[1].padStart(2,'0')}`
  return null
}

function extractContractNumber(contractName) {
  const m = contractName.match(/№\s*([\w\/\-\.]+)/)
  return m ? m[1] : null
}

export const config = { maxDuration: 60 }

export default async function handler(req, res) {
  if (!(await requireStaff(req, res, ['owner', 'manager', 'accountant']))) return
  if (req.method !== 'POST') return res.status(405).end()

  try {
    const xml = await fetch1cDebtsXml()

    // Load all tenants — index by id_1c (primary) and inn (fallback)
    const existing = await sb('tenants?select=id,inn,id_1c,full_name')
    const byId1c = {}
    const byInn = {}
    for (const t of (Array.isArray(existing) ? existing : [])) {
      if (t.id_1c) byId1c[t.id_1c] = t
      if (t.inn) byInn[t.inn] = t
    }

    const cpBlocks = xml.split('<Counterparty ').slice(1)
    const results = { created: 0, updated: 0, contracts_synced: 0 }

    for (const block of cpBlocks) {
      const cpTag = block.split('>')[0]
      const id1c = attr(cpTag, 'id')
      const rawName = attr(cpTag, 'name')
      const inn = attr(cpTag, 'inn') || null
      const kpp = attr(cpTag, 'kpp') || null
      if (!rawName) continue

      const type = detectType(rawName)

      let tenantId = null

      // Match: id_1c first → inn fallback → create new
      const existing1c = byId1c[id1c]
      const existingInn = inn ? byInn[inn] : null

      if (existing1c) {
        tenantId = existing1c.id
        await sb(`tenants?id=eq.${tenantId}`, 'PATCH',
          { full_name: rawName, inn, kpp, type, id_1c: id1c }, 'return=minimal')
        results.updated++
      } else if (existingInn) {
        tenantId = existingInn.id
        await sb(`tenants?id=eq.${tenantId}`, 'PATCH',
          { full_name: rawName, inn, kpp, type, id_1c: id1c }, 'return=minimal')
        byId1c[id1c] = existingInn
        results.updated++
      } else {
        const created = await sb('tenants', 'POST',
          { full_name: rawName, inn, kpp, type, id_1c: id1c })
        const newT = Array.isArray(created) ? created[0] : created
        if (newT?.id) {
          tenantId = newT.id
          byId1c[id1c] = newT
          if (inn) byInn[inn] = newT
          results.created++
        }
      }

      // Sync contracts
      if (tenantId) {
        const contractBlocks = block.split('<Contract ').slice(1)
        const existingCts = await sb(`contracts?tenant_id=eq.${tenantId}&select=id,contract_number`)
        const existingNums = new Set((Array.isArray(existingCts) ? existingCts : []).map(c => c.contract_number))

        for (const cb of contractBlocks) {
          const ctTag = cb.split('>')[0]
          const ctName = attr(ctTag, 'name')
          if (!ctName) continue
          const startDate = parseContractDate(ctName)
          const contractNumber = extractContractNumber(ctName) || ctName.slice(0, 50)
          if (!existingNums.has(contractNumber)) {
            await sb('contracts', 'POST',
              { tenant_id: tenantId, contract_number: contractNumber, start_date: startDate, status: 'active' },
              'return=minimal')
            results.contracts_synced++
          }
        }
      }
    }

    res.status(200).json({ ok: true, ...results, total: cpBlocks.length })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
}
