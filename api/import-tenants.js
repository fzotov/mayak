export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' })

  try {
    const { fileBase64, mimeType, fileName } = req.body || {}
    if (!fileBase64) return res.status(400).json({ ok: false, error: 'fileBase64 required' })

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return res.status(500).json({ ok: false, error: 'ANTHROPIC_API_KEY not set' })

    const isPdf = (mimeType || '').includes('pdf') || (fileName || '').endsWith('.pdf')
    const isImage = (mimeType || '').startsWith('image/')

    // For Excel/CSV we send as document, for images as image
    let content
    if (isImage) {
      content = [
        { type: 'image', source: { type: 'base64', media_type: mimeType, data: fileBase64 } },
        { type: 'text', text: PROMPT },
      ]
    } else {
      // Send as PDF document (works for PDF; for Excel Claude reads text)
      content = [
        { type: 'document', source: { type: 'base64', media_type: isPdf ? 'application/pdf' : 'application/pdf', data: fileBase64 } },
        { type: 'text', text: PROMPT },
      ]
    }

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
        max_tokens: 16000,
        messages: [{ role: 'user', content }],
      }),
    })

    const data = await resp.json()
    if (!resp.ok) return res.status(500).json({ ok: false, error: data?.error?.message || JSON.stringify(data) })

    const text = data.content?.[0]?.text || ''

    // Extract JSON array
    let tenants = null
    const arrMatch = text.match(/\[[\s\S]*\]/)
    if (arrMatch) {
      try { tenants = JSON.parse(arrMatch[0]) } catch { /* fallback */ }
    }

    // Fallback: extract individual objects
    if (!tenants) {
      const objs = []
      const re = /\{[^{}]*"full_name"[^{}]*\}/g
      let m
      while ((m = re.exec(text)) !== null) {
        try { objs.push(JSON.parse(m[0])) } catch { /* skip */ }
      }
      if (objs.length > 0) tenants = objs
    }

    if (!tenants || tenants.length === 0) {
      return res.status(200).json({ ok: false, error: 'Не удалось распознать контрагентов', raw: text.slice(0, 600) })
    }

    return res.status(200).json({ ok: true, tenants })
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) })
  }
}

const PROMPT = `Извлеки всех контрагентов/арендаторов из этого файла и верни строго JSON массив без пояснений:
[
  {
    "full_name": "Полное наименование организации или ФИО",
    "type": "COMPANY" | "IP" | "INDIVIDUAL",
    "inn": "ИНН или null",
    "kpp": "КПП или null",
    "ogrn": "ОГРН/ОГРНИП или null",
    "email": "email или null",
    "phone": "телефон или null",
    "legal_address": "юридический адрес или null",
    "bank_name": "название банка или null",
    "bank_account": "расчётный счёт или null",
    "bik": "БИК или null",
    "monthly_rent": число или null
  }
]

Правила:
- type: "COMPANY" если ООО/АО/ЗАО/ПАО, "IP" если ИП, "INDIVIDUAL" если физлицо
- monthly_rent: сумма аренды в рублях если есть в файле, иначе null
- Включи ВСЕХ контрагентов из файла
- Верни только JSON массив, никакого текста`
