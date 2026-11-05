import { NextResponse } from 'next/server'

/**
 * Приём заявок с сайта.
 * Проверки: honeypot, валидация телефона, ограничение частоты по IP.
 * Хранение: таблица site_leads в Supabase (та же база, что у системы управления зданием);
 * дополнительно — уведомление в Telegram, если заданы переменные окружения.
 */

const WINDOW_MS = 60 * 60 * 1000
const MAX_PER_WINDOW = 5
const hits = new Map<string, number[]>()

function rateLimited(ip: string): boolean {
  const now = Date.now()
  const recent = (hits.get(ip) ?? []).filter(t => now - t < WINDOW_MS)
  recent.push(now)
  hits.set(ip, recent)
  return recent.length > MAX_PER_WINDOW
}

const clean = (v: unknown, max = 500) => typeof v === 'string' ? v.trim().slice(0, max) : ''

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (rateLimited(ip)) {
    return NextResponse.json({ ok: false, error: 'too_many_requests' }, { status: 429 })
  }

  let body: Record<string, unknown>
  try { body = await request.json() } catch { return NextResponse.json({ ok: false }, { status: 400 }) }

  // honeypot: поле скрыто от человека, заполняют только боты
  if (clean(body.company)) return NextResponse.json({ ok: true })

  // форма, отправленная быстрее двух секунд после открытия, — почти наверняка бот
  const elapsed = Number(body.elapsed)
  if (Number.isFinite(elapsed) && elapsed > 0 && elapsed < 2000) return NextResponse.json({ ok: true })

  const phone = clean(body.phone, 32)
  if (phone.replace(/\D/g, '').length < 10) {
    return NextResponse.json({ ok: false, error: 'invalid_phone' }, { status: 400 })
  }

  const attribution = body.attribution && typeof body.attribution === 'object'
    ? Object.entries(body.attribution as Record<string, unknown>)
        .map(([k, v]) => `${k}=${clean(v, 120)}`)
        .join(' ')
    : ''

  const lead = {
    name: clean(body.name, 120) || null,
    phone,
    message: [clean(body.comment, 1000), clean(body.area, 60), attribution].filter(Boolean).join(' · ') || null,
    unit_number: clean(body.office, 40) || null,
    source: clean(body.source, 40) || 'site',
    page_url: clean(body.pageUrl, 300) || null,
  }

  // Заявка считается принятой, только если её удалось куда-то доставить:
  // иначе честно отвечаем ошибкой и просим позвонить, а не теряем обращение молча.
  let delivered = false

  const url = process.env.SUPABASE_URL
  const anonKey = process.env.SUPABASE_ANON_KEY
  const serviceKey = process.env.SUPABASE_SERVICE_KEY
  const key = serviceKey || anonKey

  if (url && key) {
    // Основное хранилище — таблица заявок
    const res = await fetch(`${url}/rest/v1/site_leads`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', apikey: key, Authorization: `Bearer ${key}`, Prefer: 'return=minimal' },
      body: JSON.stringify(lead),
    }).catch(() => null)

    if (res?.ok) {
      delivered = true
    } else {
      const reason = await res?.text()
      console.error('[lead] таблица site_leads недоступна, пишем в задачи:', reason)

      // Запасной канал: задача в админке, чтобы обращение не потерялось
      if (serviceKey) {
        const task = {
          title: `Заявка с сайта: ${lead.phone}${lead.unit_number ? ` — офис ${lead.unit_number}` : ''}`,
          description: [
            lead.name && `Имя: ${lead.name}`,
            `Телефон: ${lead.phone}`,
            lead.unit_number && `Помещение: ${lead.unit_number}`,
            lead.message && `Детали: ${lead.message}`,
            `Источник: ${lead.source}`,
            lead.page_url && `Страница: ${lead.page_url}`,
          ].filter(Boolean).join('\n'),
          status: 'todo',
          priority: 'high',
        }
        const taskRes = await fetch(`${url}/rest/v1/tasks`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
            Prefer: 'return=minimal',
          },
          body: JSON.stringify(task),
        }).catch(() => null)

        if (taskRes?.ok) delivered = true
        else console.error('[lead] не удалось создать задачу:', await taskRes?.text())
      }
    }
  } else {
    console.error('[lead] хранилище не настроено, заявка только в логах:', lead)
  }

  const tgToken = process.env.TELEGRAM_BOT_TOKEN
  const tgChat = process.env.TELEGRAM_CHAT_ID
  if (tgToken && tgChat) {
    const text = [
      '📩 Заявка с сайта mayak-d.ru',
      lead.name && `Имя: ${lead.name}`,
      `Телефон: ${lead.phone}`,
      lead.unit_number && `Офис: ${lead.unit_number}`,
      lead.message && `Комментарий: ${lead.message}`,
      `Источник: ${lead.source}`,
    ].filter(Boolean).join('\n')
    const tg = await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: tgChat, text }),
    }).catch(() => null)
    if (tg?.ok) delivered = true
  }

  if (!delivered) {
    console.error('[lead] заявку некуда сохранить — проверьте SUPABASE_URL/SUPABASE_ANON_KEY и таблицу site_leads:', lead)
    return NextResponse.json({ ok: false, error: 'not_delivered' }, { status: 502 })
  }

  return NextResponse.json({ ok: true })
}
