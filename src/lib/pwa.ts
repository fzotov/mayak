// Приложение на телефоне: регистрация service worker, установка на главный экран, push-уведомления.
import { apiFetch } from './api'

const VAPID = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return
  window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {}) })
}

export const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true
export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

// ── Установка ───────────────────────────────────────────────────────────────
type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }
let deferred: InstallEvent | null = null
const listeners = new Set<() => void>()
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e as InstallEvent; listeners.forEach(f => f()) })
window.addEventListener('appinstalled', () => { deferred = null; listeners.forEach(f => f()) })

/** Можно ли предложить установку кнопкой (Android/Chrome) или инструкцией (iPhone). */
export function installState(): 'installed' | 'prompt' | 'ios' | 'none' {
  if (isStandalone()) return 'installed'
  if (deferred) return 'prompt'
  if (isIOS()) return 'ios'
  return 'none'
}
export function onInstallChange(f: () => void) { listeners.add(f); return () => { listeners.delete(f) } }
export async function promptInstall() {
  if (!deferred) return false
  await deferred.prompt()
  const { outcome } = await deferred.userChoice
  deferred = null; listeners.forEach(f => f())
  return outcome === 'accepted'
}

// ── Push ────────────────────────────────────────────────────────────────────
export type PushState = 'unsupported' | 'needs-install' | 'denied' | 'off' | 'on'

export async function pushState(): Promise<PushState> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window) || !VAPID) {
    return isIOS() && !isStandalone() ? 'needs-install' : 'unsupported'
  }
  if (Notification.permission === 'denied') return 'denied'
  const reg = await navigator.serviceWorker.getRegistration('/')
  const sub = await reg?.pushManager.getSubscription()
  return sub ? 'on' : 'off'
}

function key(b64: string) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4)
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, c => c.charCodeAt(0))
}

/** Включить push на этом устройстве. Бросает исключение с понятным текстом. */
export async function enablePush() {
  if (!VAPID) throw new Error('Push не настроен')
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') throw new Error('Уведомления запрещены в настройках браузера')
  const reg = (await navigator.serviceWorker.getRegistration('/')) || (await navigator.serviceWorker.register('/sw.js', { scope: '/' }))
  await navigator.serviceWorker.ready
  const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key(VAPID) }))
  const r = await apiFetch('/api/push-subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sub.toJSON()) })
  const d = await r.json().catch(() => ({ ok: false }))
  if (!d.ok) throw new Error(d.error || 'Сервер не сохранил подписку')
}

export async function disablePush() {
  const reg = await navigator.serviceWorker.getRegistration('/')
  const sub = await reg?.pushManager.getSubscription()
  if (!sub) return
  await apiFetch('/api/push-subscribe', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => {})
  await sub.unsubscribe()
}

export async function testPush() {
  const r = await apiFetch('/api/push-test', { method: 'POST' })
  const d = await r.json().catch(() => ({ ok: false }))
  if (!d.ok) throw new Error(d.error || 'Не удалось отправить')
}
