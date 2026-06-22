export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { messages } = req.body;
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
        max_tokens: 1024,
        system: 'You are an AI assistant for Mayak property management system. Help with tenant management, invoices, and property operations. Answer in Russian.',
        messages
      })
    });
    const data = await response.json();
    res.status(200).json({ ok: true, content: data.content[0].text });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
}
