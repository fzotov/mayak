export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { query } = req.body;

  try {
    // Получаем embedding для запроса через OpenAI
    const embRes = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + process.env.OPENAI_API_KEY
      },
      body: JSON.stringify({ input: query, model: 'text-embedding-3-small' })
    });
    const embData = await embRes.json();
    const embedding = embData.data[0].embedding;

    // Ищем в Supabase
    const sbRes = await fetch(process.env.VITE_SUPABASE_URL + '/rest/v1/rpc/search_knowledge', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.SUPABASE_SERVICE_KEY,
        'Authorization': 'Bearer ' + process.env.SUPABASE_SERVICE_KEY
      },
      body: JSON.stringify({ query_embedding: embedding, match_count: 5 })
    });
    const results = await sbRes.json();
    res.status(200).json({ ok: true, results });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
}
