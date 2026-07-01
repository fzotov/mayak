import Anthropic from '@anthropic-ai/sdk'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' })

  const { imageBase64, mimeType = 'image/jpeg' } = req.body || {}
  if (!imageBase64) return res.status(400).json({ ok: false, error: 'imageBase64 required' })

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  try {
    const msg = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mimeType, data: imageBase64 },
          },
          {
            type: 'text',
            text: `Распознай счёт от поставщика и верни JSON с полями:
- supplier: название поставщика/организации
- amount: сумма к оплате (число, только цифры)
- invoice_date: дата счёта в формате YYYY-MM-DD
- due_date: срок оплаты в формате YYYY-MM-DD (если указан)
- description: назначение платежа / наименование услуги

Верни ТОЛЬКО валидный JSON, без пояснений. Если поле не найдено — null.`,
          },
        ],
      }],
    })

    const text = msg.content[0]?.text || ''
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return res.status(200).json({ ok: false, error: 'Не удалось распознать счёт' })

    const parsed = JSON.parse(match[0])
    return res.status(200).json({ ok: true, ...parsed })
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message })
  }
}
