export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { messages } = req.body;
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + process.env.OPENAI_API_KEY
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: 'You are an AI assistant for Mayak property management system. Help with tenant management, invoices, and property operations. Answer in Russian.' },
          ...messages
        ]
      })
    });
    const data = await response.json();
    res.status(200).json({ ok: true, content: data.choices[0].message.content });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
}
