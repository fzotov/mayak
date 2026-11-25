// Web Push: отправка через VAPID. Ключи — в переменных окружения VITE_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY.
import webpush from 'web-push'
import { APP_URL } from './auth.js'

let ready = false
export function pushReady() {
  if (ready) return true
  const pub = process.env.VITE_VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY
  if (!pub || !priv) return false
  webpush.setVapidDetails(APP_URL, pub, priv)
  ready = true
  return true
}

/** Отправить одно сообщение на одну подписку. Возвращает 'ok' | 'gone' | текст ошибки. */
export async function sendOne(sub, payload) {
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload),
      { TTL: 24 * 3600, urgency: 'high', topic: payload.tag ? String(payload.tag).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32) : undefined },
    )
    return 'ok'
  } catch (e) {
    if (e?.statusCode === 404 || e?.statusCode === 410) return 'gone'
    return String(e?.statusCode || '') + ' ' + String(e?.body || e?.message || e).slice(0, 200)
  }
}
