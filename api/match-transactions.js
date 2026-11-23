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
    let txQuery = 'bank_transactions?direction=eq.credit&matched_type=is.null&order=date.desc'
    if (transactionIds?.length) {
      txQuery = `bank_transactions?id=in.(${transactionIds.join(',')})&order=date.desc`
    }
    const [txs, tenants, invoices] = await Promise.all([
      sb(txQuery + '&limit=50'),
      sb('tenants?select=id,full_name,inn,monthly_rent,type&order=full_name'),
      sb('invoices?select=id,number,total_amount,period,status,tenant_id&status=in.(SENT,OVERDUE)&order=created_at.desc&limit=100'),
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

    // Auto-apply high-confidence matches (>= 80)
    const applied = []
    for (const m of matches) {
      // Платёж проводится без человека только по твёрдому признаку: ИНН арендатора есть в реквизитах платежа.
      // Догадка модели сама по себе деньги не проводит — такие строки остаются предложением для оператора.
      const tx = txs.find(t => t.id === m.tx_id)
      const tenant = tenants.find(t => t.id === m.tenant_id)
      const inn = String(tenant?.inn || '').trim()
      const haystack = `${tx?.counterparty || ''} ${tx?.description || ''}`
      const innMatched = inn.length >= 10 && new RegExp(`(^|\\D)${inn}(\\D|$)`).test(haystack)
      m.auto = !!(tx && tenant && innMatched)
      if (m.auto) {
        const [payment] = await sb('payments', {
          method: 'POST',
          body: JSON.stringify({
            tenant_id: m.tenant_id,
            date: tx.date,
            amount: tx.amount,
            type: m.type || 'payment',
            description: tx.description || tx.counterparty || '',
            bank_transaction_id: tx.id,
            invoice_id: m.invoice_id || null,
            note: m.note || null,
          })
        })
        // Update bank transaction
        await sb(`bank_transactions?id=eq.${tx.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ matched_type: m.type || 'tenant', matched_id: m.tenant_id })
        })
        applied.push({ ...m, payment_id: payment?.id })
      }
    }

    res.status(200).json({ ok: true, matches, applied })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
}
