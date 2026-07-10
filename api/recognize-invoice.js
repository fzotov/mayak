export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' })

  try {
    const body = req.body || {}
    const { imageBase64, mimeType } = body

    if (!imageBase64) {
      return res.status(400).json({ ok: false, error: 'imageBase64 required' })
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return res.status(500).json({ ok: false, error: 'ANTHROPIC_API_KEY not set' })
    }

    const mime = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(mimeType)
      ? mimeType
      : 'image/jpeg'

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-8',
        max_tokens: 512,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: mime, data: imageBase64 },
              },
              {
                type: 'text',
                text: 'Извлеки из счёта данные и верни строго JSON без пояснений:\n{"supplier":"название поставщика","amount":число с копейками например 175600.00,"vat":число сумма НДС или null если нет НДС,"invoice_date":"YYYY-MM-DD или null","due_date":"YYYY-MM-DD или null","description":"Оплата по счёту №XXX от ДД.ММ.ГГГГ за [конкретное наименование товара/услуги из счёта]"}\n\nПравила:\n- amount: итоговая сумма к оплате с копейками (два знака после точки)\n- vat: сумма НДС если указана в счёте, иначе null\n- description: номер счёта + дата + наименование товара/услуги/работ\nNull только если поле совсем не найдено.',
              },
            ],
          },
        ],
      }),
    })

    const data = await resp.json()

    if (!resp.ok) {
      return res.status(500).json({ ok: false, error: data?.error?.message || JSON.stringify(data) })
    }

    const text = data.content?.[0]?.text || ''
    const match = text.match(/\{[\s\S]*?\}/)
    if (!match) return res.status(200).json({ ok: false, error: 'Не удалось распознать' })

    return res.status(200).json({ ok: true, ...JSON.parse(match[0]) })
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) })
  }
}
