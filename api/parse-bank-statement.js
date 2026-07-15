export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' })

  try {
    const { pdfBase64, mimeType } = req.body || {}
    if (!pdfBase64) return res.status(400).json({ ok: false, error: 'pdfBase64 required' })

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return res.status(500).json({ ok: false, error: 'ANTHROPIC_API_KEY not set' })

    const mime = mimeType || 'application/pdf'
    const isImage = mime.startsWith('image/')

    const content = isImage
      ? [
          { type: 'image', source: { type: 'base64', media_type: mime, data: pdfBase64 } },
          { type: 'text', text: PROMPT },
        ]
      : [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 } },
          { type: 'text', text: PROMPT },
        ]

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'pdfs-2024-09-25',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-8',
        max_tokens: 32000,
        messages: [{ role: 'user', content }],
      }),
    })

    const data = await resp.json()
    if (!resp.ok) return res.status(500).json({ ok: false, error: data?.error?.message || JSON.stringify(data) })

    const text = data.content?.[0]?.text || ''

    // Try full array parse first
    let transactions = null
    const arrMatch = text.match(/\[[\s\S]*\]/)
    if (arrMatch) {
      try { transactions = JSON.parse(arrMatch[0]) } catch { /* try fallback */ }
    }

    // Fallback: extract individual objects even if array is truncated
    if (!transactions) {
      const objs = []
      const re = /\{[^{}]*"date"[^{}]*"amount"[^{}]*\}/g
      let m
      while ((m = re.exec(text)) !== null) {
        try { objs.push(JSON.parse(m[0])) } catch { /* skip malformed */ }
      }
      if (objs.length > 0) transactions = objs
    }

    if (!transactions || transactions.length === 0) {
      return res.status(200).json({ ok: false, error: 'Не удалось распознать транзакции', raw: text.slice(0, 800) })
    }

    return res.status(200).json({ ok: true, transactions })
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) })
  }
}

const PROMPT = `Извлеки все банковские транзакции из выписки и верни строго JSON массив без пояснений:
[
  {
    "date": "YYYY-MM-DD",
    "amount": число с копейками,
    "direction": "credit" или "debit",
    "counterparty": "название контрагента",
    "description": "назначение платежа",
    "reference": "номер документа или пустая строка"
  }
]

Правила:
- credit = поступление на счёт (приход)
- debit = списание со счёта (расход)
- amount всегда положительное число
- Включи ВСЕ операции без исключения
- Верни только JSON массив, никакого текста до или после`
