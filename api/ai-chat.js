const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY

async function sb(path, opts = {}) {
  const res = await fetch(SUPABASE_URL + '/rest/v1/' + path, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY,
      'Content-Type': 'application/json',
      ...opts.headers
    },
    ...opts
  })
  return res.json()
}

function fmt(n) { return Number(n || 0).toLocaleString('ru-RU') }

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const { messages } = req.body
  const lastMsg = messages[messages.length - 1]?.content || ''

  try {
    // Загружаем живые данные параллельно
    const today = new Date().toISOString().slice(0, 10)
    const in30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
    const monthStart = new Date().toISOString().slice(0, 7) + '-01'

    const [tenants, overdueInvs, expContracts, openTasks, recentInvs, units, kbArticles] = await Promise.all([
      sb('tenants?select=full_name,type,inn,monthly_rent,contract_end_date,email,phone&order=full_name'),
      sb('invoices?select=number,total_amount,period,tenants(full_name),units(number)&status=eq.OVERDUE&order=created_at&limit=10'),
      sb(`contracts?select=contract_number,end_date,tenants(full_name)&end_date=gte.${today}&end_date=lte.${in30}&order=end_date`),
      sb('tasks?select=title,status,priority,source&status=in.(open,in_progress)&order=created_at.desc&limit=10'),
      sb(`invoices?select=number,total_amount,status,period,tenants(full_name)&period=gte.${monthStart}&order=created_at.desc&limit=15`),
      sb('units?select=number,status&order=number'),
      sb('kb_articles?select=title,content,category&order=created_at.desc&limit=20'),
    ])

    // Фильтрация KB по ключевым словам из запроса
    const qWords = lastMsg.toLowerCase().split(/\s+/).filter(w => w.length > 3)
    const relevantKb = (Array.isArray(kbArticles) ? kbArticles : []).filter(a =>
      qWords.some(w => a.title?.toLowerCase().includes(w) || a.content?.toLowerCase().includes(w))
    ).slice(0, 5)

    const occupiedUnits = (Array.isArray(units) ? units : []).filter(u => u.status === 'occupied').length
    const totalUnits = (Array.isArray(units) ? units : []).length
    const overdueTotal = (Array.isArray(overdueInvs) ? overdueInvs : []).reduce((s, i) => s + (i.total_amount || 0), 0)
    const monthRevenue = (Array.isArray(recentInvs) ? recentInvs : []).filter(i => ['SENT','PAID'].includes(i.status)).reduce((s, i) => s + (i.total_amount || 0), 0)

    const tenantLines = (Array.isArray(tenants) ? tenants : []).map(t =>
      `• ${t.full_name} (${t.type}) — аренда ${fmt(t.monthly_rent)} ₽/мес, договор до ${t.contract_end_date || '—'}`
    ).join('\n')

    const overdueLines = (Array.isArray(overdueInvs) ? overdueInvs : []).map(i =>
      `• ${i.tenants?.full_name || '—'} офис ${i.units?.number || '—'}: ${fmt(i.total_amount)} ₽ (счёт №${i.number})`
    ).join('\n')

    const expiringLines = (Array.isArray(expContracts) ? expContracts : []).map(c =>
      `• ${c.tenants?.full_name || '—'} — истекает ${c.end_date} (№${c.contract_number || '—'})`
    ).join('\n')

    const tasksLines = (Array.isArray(openTasks) ? openTasks : []).map(t =>
      `• [${t.priority}] ${t.title} (${t.status})`
    ).join('\n')

    const kbLines = relevantKb.map(a =>
      `### ${a.title} (${a.category})\n${a.content}`
    ).join('\n\n')

    const systemPrompt = `Ты AI-ассистент системы управления бизнес-центром «Маяк» (Дмитров, МО). Отвечай по-русски, чётко и профессионально.

## ТЕКУЩИЕ ДАННЫЕ СИСТЕМЫ (обновлено только что)

### Заполняемость
Занято ${occupiedUnits} из ${totalUnits} офисов (${totalUnits ? Math.round(occupiedUnits/totalUnits*100) : 0}%)

### Финансы за текущий месяц
Выручка: ${fmt(monthRevenue)} ₽
Просрочено счетов: ${(Array.isArray(overdueInvs) ? overdueInvs : []).length} шт. на сумму ${fmt(overdueTotal)} ₽

### Арендаторы (${(Array.isArray(tenants) ? tenants : []).length} всего)
${tenantLines || 'Нет данных'}

### Просроченные счета
${overdueLines || 'Просроченных счетов нет'}

### Договоры, истекающие в ближайшие 30 дней
${expiringLines || 'Нет договоров с ближайшим истечением'}

### Открытые задачи
${tasksLines || 'Открытых задач нет'}

${kbLines ? `## ИЗ БАЗЫ ЗНАНИЙ\n${kbLines}` : ''}

## ИНСТРУКЦИИ
- Используй реальные данные выше для ответов на вопросы
- При расчёте пеней: стандартная ставка 0.1% в день если не указано иное
- При составлении писем — используй деловой стиль
- Если данных нет — честно говори об этом
- Цифры форматируй с пробелами: 20 500 ₽`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1500,
        system: systemPrompt,
        messages
      })
    })

    const data = await response.json()
    if (!data.content?.[0]?.text) return res.status(500).json({ ok: false, error: 'No response', raw: data })
    res.status(200).json({ ok: true, content: data.content[0].text })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
}
