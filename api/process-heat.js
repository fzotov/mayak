export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { base64, mediaType } = req.body

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.json({ ok: false, raw: 'ANTHROPIC_API_KEY not configured on server' })
  }

  const content = []
  if (mediaType && mediaType.startsWith('image/')) {
    content.push({ type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } })
  } else {
    content.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } })
  }
  content.push({
    type: 'text',
    text: 'Это счёт от теплоснабжающей организации. Извлеки данные и верни JSON: {"period":"YYYY-MM","total_amount":0,"total_gcal":0,"supplier":""}. period — период в формате YYYY-MM, total_amount — итоговая сумма в рублях числом, total_gcal — объём тепловой энергии в Гкал числом (если не указано — 0). Только JSON без markdown, без пояснений.'
  })

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 512,
        messages: [{ role: 'user', content }],
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      return res.json({ ok: false, raw: `Claude API error ${response.status}: ${errText.slice(0, 200)}` })
    }

    const data = await response.json()
    const text = data.content?.[0]?.text || '{}'
    try {
      const parsed = JSON.parse(text.replace(/```json|```/g, '').trim())
      return res.json({ ok: true, ...parsed })
    } catch {
      return res.json({ ok: false, raw: text.slice(0, 200) })
    }
  } catch (e) {
    return res.json({ ok: false, raw: String(e).slice(0, 200) })
  }
}
