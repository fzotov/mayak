export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { messages } = req.body;
  const lastMessage = messages[messages.length - 1].content;

  try {
    // 1. Ищем в базе знаний
    let knowledgeContext = '';
    try {
      const embRes = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + process.env.OPENAI_API_KEY },
        body: JSON.stringify({ input: lastMessage, model: 'text-embedding-3-small' })
      });
      const embData = await embRes.json();
      const embedding = embData.data[0].embedding;

      const sbRes = await fetch(process.env.VITE_SUPABASE_URL + '/rest/v1/rpc/search_knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': process.env.SUPABASE_SERVICE_KEY, 'Authorization': 'Bearer ' + process.env.SUPABASE_SERVICE_KEY },
        body: JSON.stringify({ query_embedding: embedding, match_count: 3 })
      });
      const results = await sbRes.json();
      if (results && results.length > 0) {
        knowledgeContext = 'Relevant information from knowledge base:\n' + results.map(r => r.title + ': ' + r.content).join('\n\n');
      }
    } catch(e) {}

    // 2. Отправляем в Claude с контекстом
    const systemPrompt = `You are an AI assistant for Mayak property management system in Russia. Help with tenant management, invoices, lease agreements, and property operations. Answer in Russian. Be concise and professional.${knowledgeContext ? '\n\n' + knowledgeContext : ''}`;

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
        system: systemPrompt,
        messages
      })
    });
    const data = await response.json();
    res.status(200).json({ ok: true, content: data.content[0].text });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
}
