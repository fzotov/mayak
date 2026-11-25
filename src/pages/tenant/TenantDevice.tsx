import { useEffect, useState } from 'react'
import { installState, onInstallChange, promptInstall, isIOS, pushState, enablePush, disablePush, testPush, type PushState } from '../../lib/pwa'
import { T, Card, Title, Button, Note } from './ui'

const text: React.CSSProperties = { fontSize: 14, color: T.sub, lineHeight: 1.55, margin: 0 }

function ShareIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-label="Поделиться" style={{ verticalAlign: '-3px', margin: '0 2px' }}>
      <path d="M8 1.5v9M5 4.5l3-3 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 7H3.5v7.5h9V7H11" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}

/** Карточка «Приложение на телефоне»: установка на главный экран и push-уведомления на этом устройстве. */
export function TenantDeviceCard() {
  const [install, setInstall] = useState(installState())
  const [push, setPush] = useState<PushState | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const refresh = () => pushState().then(setPush).catch(() => setPush('unsupported'))
  useEffect(() => {
    refresh()
    return onInstallChange(() => { setInstall(installState()); refresh() })
  }, [])

  const run = async (f: () => Promise<unknown>, ok: string) => {
    setBusy(true); setMsg(null)
    try { await f(); setMsg({ ok: true, text: ok }) } catch (e: any) { setMsg({ ok: false, text: e?.message || 'Не получилось, попробуйте ещё раз' }) }
    setBusy(false); refresh()
  }

  const installBlock = install === 'prompt' ? (
    <div style={{ marginBottom: 16 }}>
      <p style={{ ...text, marginBottom: 12 }}>Установите кабинет как приложение: он откроется с главного экрана одним касанием.</p>
      <Button full disabled={busy} onClick={() => run(async () => { if (!(await promptInstall())) throw new Error('Установка отменена') }, 'Приложение установлено')}>Установить приложение</Button>
    </div>
  ) : install === 'ios' ? (
    <div style={{ marginBottom: 16, padding: '12px 14px', borderRadius: 8, background: T.raised }}>
      <p style={{ ...text, color: T.text }}>Нажмите <b>Поделиться</b><ShareIcon /> внизу Safari, затем <b>На экран «Домой»</b>.</p>
      <p style={{ ...text, fontSize: 13, color: T.muted, marginTop: 6 }}>На iPhone уведомления работают только в установленном приложении. Откройте кабинет с главного экрана и включите их там.</p>
    </div>
  ) : null

  let pushBlock: React.ReactNode = null
  if (push === 'on') pushBlock = (
    <>
      <p style={{ ...text, marginBottom: 12 }}>Уведомления включены на этом устройстве: новые счета и изменения по заявкам придут сразу.</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 140px' }}><Button full disabled={busy} onClick={() => run(testPush, 'Проверочное уведомление отправлено. Если его нет, проверьте настройки уведомлений телефона.')}>Проверить</Button></div>
        <div style={{ flex: '1 1 140px' }}><Button full kind="ghost" disabled={busy} onClick={() => run(disablePush, 'Уведомления выключены на этом устройстве')}>Выключить</Button></div>
      </div>
    </>
  )
  else if (push === 'off') pushBlock = (
    <>
      <p style={{ ...text, marginBottom: 12 }}>Получайте уведомления о новых счетах и о том, что происходит с вашими заявками.</p>
      <Button full disabled={busy} onClick={() => run(enablePush, 'Уведомления включены')}>{busy ? 'Включаем…' : 'Включить уведомления'}</Button>
    </>
  )
  else if (push === 'denied') pushBlock = (
    <p style={text}>Уведомления для этого сайта запрещены в настройках браузера. Разрешите их в настройках сайта{isIOS() ? ' (Настройки → Уведомления → Маяк)' : ' (значок слева от адреса → Уведомления)'} и обновите страницу.</p>
  )
  else if (push === 'needs-install') pushBlock = install === 'ios' ? null : (
    <p style={text}>Чтобы получать уведомления на iPhone, добавьте кабинет на экран «Домой» и откройте его оттуда.</p>
  )
  else if (push === 'unsupported') pushBlock = (
    <p style={text}>Этот браузер не поддерживает уведомления. Откройте кабинет в Chrome на Android или в Safari на iPhone (iOS 16.4 и новее).</p>
  )

  if (!installBlock && !pushBlock && !msg) return null
  return (
    <Card>
      <Title>Приложение и уведомления</Title>
      {installBlock}
      {push === null ? <p style={{ ...text, color: T.muted }}>Проверяем…</p> : pushBlock}
      {msg && <Note tone={msg.ok ? 'ok' : 'bad'}>{msg.text}</Note>}
    </Card>
  )
}

export default TenantDeviceCard
