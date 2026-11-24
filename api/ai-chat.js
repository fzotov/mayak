import { requireStaff } from './_lib/auth.js'
const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY

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
  if (!(await requireStaff(req, res))) return
  if (req.method !== 'POST') return res.status(405).end()
  const { messages } = req.body
  const lastMsg = messages[messages.length - 1]?.content || ''

  try {
    // Загружаем живые данные параллельно
    const today = new Date().toISOString().slice(0, 10)
    const in30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
    const monthStart = new Date().toISOString().slice(0, 7) + '-01'

    const [tenants, overdueInvs, expContracts, openTasks, recentInvs, units, balances, kbArticles] = await Promise.all([
      sb('tenants?select=full_name,type,inn,monthly_rent,contract_end_date,email,phone&order=full_name'),
      sb('v_invoice_state?select=number,open_amount,period,due_date,tenant_name&pay_status=in.(overdue,partial_overdue)&order=due_date&limit=30'),
      sb(`leases?select=number,end_date,tenants(full_name)&status=eq.active&end_date=gte.${today}&end_date=lte.${in30}&order=end_date`),
      sb('tasks?select=title,status,priority,source&status=in.(open,in_progress)&order=created_at.desc&limit=10'),
      sb(`v_invoice_state?select=number,total,paid,pay_status&period=eq.${monthStart.slice(0, 7)}`),
      sb('units?select=number,floor,area,status,rent_rate&order=number'),
      sb('tenant_balances?select=debt,advance,as_of,tenants(full_name)&order=debt.desc&limit=30'),
      sb('kb_articles?select=title,content,category&order=created_at.desc&limit=300'),
    ])

    // Фильтрация KB по ключевым словам из запроса
    const qWords = lastMsg.toLowerCase().split(/\s+/).filter(w => w.length > 3)
    const relevantKb = (Array.isArray(kbArticles) ? kbArticles : []).filter(a =>
      qWords.some(w => a.title?.toLowerCase().includes(w) || a.content?.toLowerCase().includes(w))
    ).slice(0, 5)

    const occupiedUnits = (Array.isArray(units) ? units : []).filter(u => u.status === 'occupied').length
    const totalUnits = (Array.isArray(units) ? units : []).length
    const overdueTotal = (Array.isArray(overdueInvs) ? overdueInvs : []).reduce((s, i) => s + Number(i.open_amount || 0), 0)
    const monthRevenue = (Array.isArray(recentInvs) ? recentInvs : []).reduce((s, i) => s + Number(i.total || 0), 0)

    const freeUnits = (Array.isArray(units) ? units : []).filter(u => u.status === 'free')
    const freeLines = freeUnits.map(u => `• №${u.number}, ${u.floor ?? '?'} этаж, ${u.area ?? '?'} м²${u.rent_rate ? `, ставка ${fmt(u.rent_rate)} ₽/м²` : ''}`).join('\n')
    const debtLines = (Array.isArray(balances) ? balances : []).filter(b => Number(b.debt) - Number(b.advance) > 0)
      .map(b => `• ${b.tenants?.full_name || '—'}: долг ${fmt(Number(b.debt) - Number(b.advance))} ₽ (по 1С на ${String(b.as_of || '').slice(0, 10)})`).join('\n')

    const tenantLines = (Array.isArray(tenants) ? tenants : []).map(t =>
      `• ${t.full_name} (${t.type}) — аренда ${fmt(t.monthly_rent)} ₽/мес, договор до ${t.contract_end_date || '—'}`
    ).join('\n')

    const overdueLines = (Array.isArray(overdueInvs) ? overdueInvs : []).map(i =>
      `• ${i.tenant_name || '—'}: не оплачено ${fmt(i.open_amount)} ₽ по счёту №${i.number}, срок был ${i.due_date}`
    ).join('\n')

    const expiringLines = (Array.isArray(expContracts) ? expContracts : []).map(c =>
      `• ${c.tenants?.full_name || '—'} — истекает ${c.end_date} (№${c.number || '—'})`
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

### Свободные помещения (${freeUnits.length})
${freeLines || 'Свободных помещений нет'}

### Задолженность арендаторов по данным 1С
${debtLines || 'Сальдо из 1С ещё не загружено'}

### Финансы за текущий месяц
Выставлено счетов за месяц: ${fmt(monthRevenue)} ₽
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
- Цифры форматируй с пробелами: 20 500 ₽
- Пиши простым текстом: без эмодзи, без markdown-заголовков и таблиц; списки — строками с «•»; выделять можно только **жирным**`

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
