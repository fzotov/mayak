export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { title, content, category } = req.body;

  try {
    // Получаем embedding
    const embRes = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + process.env.OPENAI_API_KEY
      },
      body: JSON.stringify({ input: content, model: 'text-embedding-3-small' })
    });
    const embData = await embRes.json();
    const embedding = embData.data[0].embedding;

    // Сохраняем в Supabase
    const sbRes = await fetch(process.env.VITE_SUPABASE_URL + '/rest/v1/knowledge_base', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.SUPABASE_SERVICE_KEY,
        'Authorization': 'Bearer ' + process.env.SUPABASE_SERVICE_KEY,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({ title, content, category, embedding })
    });
    const data = await sbRes.json();
    res.status(200).json({ ok: true, data });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
}
