export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { base64, mediaType } = req.body

  const content = []
  if (mediaType.startsWith('image/')) {
    content.push({ type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } })
  } else {
    content.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } })
  }
  content.push({ type: 'text', text: 'Извлеки содержимое письма. Верни JSON: {"subject":"","sender":"","recipient":"","date":"YYYY-MM-DD","body":"","summary":"","action":""}. Только JSON без markdown.' })

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 1000, messages: [{ role: 'user', content }] })
  })

  const data = await response.json()
  const text = data.content?.[0]?.text || '{}'
  try {
    const parsed = JSON.parse(text.replace(/```json|```/g, '').trim())
    res.json(parsed)
  } catch {
    res.json({ body: text })
  }
}
