import { requireStaff } from './_lib/auth.js'
const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY

async function sb(path, opts = {}) {
  const res = await fetch(SUPABASE_URL + '/rest/v1/' + path, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
      ...opts.headers
    },
    ...opts
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Supabase ${path}: ${err}`)
  }
  return res.json()
}

export default async function handler(req, res) {
  if (!(await requireStaff(req, res))) return
  if (req.method !== 'POST') return res.status(405).end()
  const { transactionIds } = req.body

  try {
    // Load unmatched credit transactions
    let txQuery = 'bank_transactions?direction=eq.credit&status=eq.unrecognized&order=date.desc'
    if (transactionIds?.length) {
      txQuery = `bank_transactions?id=in.(${transactionIds.join(',')})&order=date.desc`
    }
    const [txs, tenants, invoices] = await Promise.all([
      sb(txQuery + '&limit=50'),
      sb('tenants?select=id,full_name,inn,monthly_rent,type&order=full_name'),
      sb('v_invoice_state?select=id,number,total_amount:open_amount,period,tenant_id&pay_status=neq.paid&order=date.desc&limit=100'),
    ])

    if (!txs.length) return res.status(200).json({ ok: true, matches: [] })

    const tenantList = tenants.map(t =>
      `ID:${t.id} | "${t.full_name}" | ИНН:${t.inn || '?'} | аренда ~${t.monthly_rent || '?'}₽/мес | тип:${t.type}`
    ).join('\n')

    const invoiceList = invoices.map(i =>
      `ID:${i.id} | №${i.number} | ${i.total_amount}₽ | арендатор:${i.tenant_id} | период:${i.period}`
    ).join('\n')

    const txList = txs.map(t =>
      `TXID:${t.id} | ${t.date} | ${t.amount}₽ | "${t.counterparty || ''}" | "${t.description || ''}"`
    ).join('\n')

    const prompt = `Ты — система учёта платежей бизнес-центра. Сопоставь банковские платежи с арендаторами.

АРЕНДАТОРЫ:
${tenantList}

НЕОПЛАЧЕННЫЕ СЧЕТА:
${invoiceList || 'нет'}

БАНКОВСКИЕ ТРАНЗАКЦИИ (входящие платежи):
${txList}

Для каждой транзакции (TXID) верни JSON-массив объектов:
{
  "tx_id": "uuid транзакции",
  "tenant_id": "uuid арендатора или null",
  "invoice_id": "uuid счёта или null",
  "type": "rent|utilities|advance|other",
  "confidence": 0-100,
  "note": "краткое объяснение"
}

Правила:
- Ищи совпадение по ИНН, названию компании, сумме аренды, номеру счёта в назначении платежа
- Если сумма совпадает со счётом — указывай invoice_id
- Если нет конкретного счёта но арендатор определён — type="advance" если сумма > месячная аренда, иначе "rent"
- Если арендатор не определён — tenant_id=null, confidence<40
- Верни ТОЛЬКО JSON-массив без пояснений`

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }]
      })
    })
    const aiData = await resp.json()
    if (!aiData.content?.[0]?.text) return res.status(500).json({ ok: false, error: 'AI no response', raw: aiData })

    const text = aiData.content[0].text.replace(/```json|```/g, '').trim()
    const matches = JSON.parse(text)

    // ИИ только подсказывает: поступление зачисляет оператор (bank_assign) или сама база по ИНН и привязкам.
    res.status(200).json({ ok: true, matches })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
}
