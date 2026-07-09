import Anthropic from '@anthropic-ai/sdk'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' })

  const { imageBase64, mimeType = 'image/jpeg' } = req.body || {}
  if (!imageBase64) return res.status(400).json({ ok: false, error: 'imageBase64 required' })

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ ok: false, error: 'ANTHROPIC_API_KEY не задан в переменных окружения Vercel' })
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const prompt = `Распознай счёт от поставщика и верни JSON с полями:
- supplier: название поставщика/организации
- amount: сумма к оплате (число, только цифры, без пробелов)
- invoice_date: дата счёта в формате YYYY-MM-DD
- due_date: срок оплаты в формате YYYY-MM-DD (если указан, иначе null)
- description: назначение платежа / наименование услуги

Верни ТОЛЬКО валидный JSON объект, без пояснений, без markdown. Если поле не найдено — null.`

  try {
    let contentBlock

    if (mimeType === 'application/pdf') {
      // PDF передаём как document
      contentBlock = [
        {
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: imageBase64 },
        },
        { type: 'text', text: prompt },
      ]
    } else {
      // Изображение
      const validImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
      const mediaType = validImageTypes.includes(mimeType) ? mimeType : 'image/jpeg'
      contentBlock = [
        {
          type: 'image',
          source: { type: 'base64', media_type: mediaType, data: imageBase64 },
        },
        { type: 'text', text: prompt },
      ]
    }

    const msg = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: contentBlock }],
    })

    const text = msg.content[0]?.text || ''
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return res.status(200).json({ ok: false, error: 'Не удалось распознать счёт' })

    const parsed = JSON.parse(match[0])
    return res.status(200).json({ ok: true, ...parsed })
  } catch (err) {
    console.error('recognize-invoice error:', err)
    return res.status(500).json({ ok: false, error: err.message || String(err) })
  }
}
