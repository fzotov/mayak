export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { subject, recipient, sender, prompt } = req.body

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: `Напиши деловое письмо на русском языке для управляющей компании бизнес-центра "Маяк".
Тема: ${subject || 'не указана'}
Получатель: ${recipient || 'арендатор'}
Отправитель: ${sender || 'Администрация БЦ Маяк'}
Инструкции: ${prompt}

Верни только текст письма без пояснений.`
      }]
    })
  })

  const data = await response.json()
  const text = data.content?.[0]?.text || ''
  res.json({ text })
}
