// Распознавание показаний счётчика по фото (Claude). Используется сотрудниками и арендаторами.
export async function recognizeMeter({ imageBase64, meterNumbers, mediaType }) {
  const knownList = (meterNumbers || []).join(', ') || 'не указаны';
  const prompt = `На фото — счётчик ресурсов (электричество, вода, тепло или газ).

Твоя задача:
1. Определи серийный номер счётчика (обычно напечатан на корпусе или шильдике)
2. Считай текущее показание (цифры на дисплее или барабанах)
3. Если на фото несколько счётчиков — извлеки данные каждого

Известные серийные номера в системе: ${knownList}

Верни ТОЛЬКО JSON без пояснений:
{"meters": [{"serial": "серийный_номер", "reading": числовое_показание, "matched": true_если_совпадает_с_известными, "type": "electricity|water|heat|gas|unknown"}]}

Если не удаётся распознать показание — поставь null. Если серийник не виден — пустую строку.`;

    const imgMediaType = mediaType || 'image/jpeg';
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 512,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: imgMediaType, data: imageBase64 } },
            { type: 'text', text: prompt }
          ]
        }]
      })
    });
    const data = await response.json();
    if (!data.content?.[0]?.text) return { ok: false, error: 'Пустой ответ распознавания' };
    const text = data.content[0].text;
    const jsonStr = text.replace(/```json|```/g, '').trim();
    const json = JSON.parse(jsonStr);
    return { ok: true, ...json };
}
