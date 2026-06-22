export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { imageBase64, meterNumbers } = req.body;
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 512,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: 'image/jpeg', data: imageBase64 }
            },
            {
              type: 'text',
              text: 'This is a photo of utility meters. Extract the serial number and current reading from each visible meter. Known meter numbers in system: ' + (meterNumbers || []).join(', ') + '. Return JSON only: {"meters": [{"serial": "...", "reading": 12345.67, "matched": true/false}]}. No other text.'
            }
          ]
        }]
      })
    });
    const data = await response.json();
    const text = data.content[0].text;
    const json = JSON.parse(text.replace(/```json|```/g, '').trim());
    res.status(200).json({ ok: true, ...json });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
}
