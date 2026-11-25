// «Этот телефон»: установка админки на главный экран и push-уведомления на этом устройстве.
// Push приходят о новой заявке с сайта, аварийном ремонте и крупном поступлении.
import { useEffect, useState } from 'react'
import { installState, onInstallChange, promptInstall, pushState, enablePush, disablePush, testPush, isIOS, type PushState } from '../lib/pwa'
import { Button, Badge, Notice, Row, Muted, C } from './ui'

const PUSH_LABEL: Record<PushState, [string, 'green' | 'neutral' | 'red' | 'amber']> = {
  on: ['включены', 'green'], off: ['выключены', 'neutral'], denied: ['запрещены', 'red'],
  'needs-install': ['нужна установка', 'amber'], unsupported: ['недоступны', 'neutral'],
}

export default function DeviceCard() {
  const [install, setInstall] = useState(installState())
  const [push, setPush] = useState<PushState | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ tone: 'green' | 'red'; text: string } | null>(null)

  const refresh = () => { pushState().then(setPush).catch(() => setPush('unsupported')) }
  useEffect(() => {
    refresh()
    return onInstallChange(() => { setInstall(installState()); refresh() })
  }, [])

  const run = async (f: () => Promise<unknown>, ok: string) => {
    setBusy(true); setMsg(null)
    try { await f(); setMsg({ tone: 'green', text: ok }) } catch (e: any) { setMsg({ tone: 'red', text: e?.message || 'Не получилось' }) }
    setBusy(false); refresh()
  }

  const h: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: C.text }
  const [pl, pt] = PUSH_LABEL[push || 'off']

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'grid', gap: 6 }}>
        <Row gap={8}><span style={h}>Приложение на телефоне</span>{install === 'installed' && <Badge tone="green">установлено</Badge>}</Row>
        {install === 'installed' && <Muted small>Админка открыта как приложение с главного экрана.</Muted>}
        {install === 'prompt' && <>
          <Muted small>Поставьте админку на главный экран: открывается в одно касание, без адресной строки, и умеет присылать уведомления.</Muted>
          <div><Button kind="primary" disabled={busy} onClick={() => run(async () => { if (!(await promptInstall())) throw new Error('Установка отменена') }, 'Приложение установлено')}>Установить на телефон</Button></div>
        </>}
        {install === 'ios' && (
          <Notice>
            На iPhone приложение ставится из Safari: нажмите <b>«Поделиться»</b> (квадрат со стрелкой) → <b>«На экран Домой»</b> → «Добавить».
            Затем откройте «Маяк» с главного экрана. Без этого iPhone не присылает push-уведомления.
          </Notice>
        )}
        {install === 'none' && <Muted small>Откройте админку в Chrome на Android или в Safari на iPhone, чтобы поставить её на главный экран.</Muted>}
      </div>

      <div style={{ display: 'grid', gap: 6, paddingTop: 12, borderTop: `1px solid ${C.line}` }}>
        <Row gap={8}><span style={h}>Уведомления на этом устройстве</span>{push && <Badge tone={pt}>{pl}</Badge>}</Row>
        <Muted small>Новая заявка с сайта, аварийный ремонт, крупное поступление денег. Включаются отдельно на каждом телефоне и компьютере.</Muted>
        {push === 'needs-install' && <Notice tone="amber">{isIOS() ? 'На iPhone уведомления работают только у приложения с главного экрана — сначала установите его (выше), затем откройте и включите здесь.' : 'Сначала установите приложение на главный экран.'}</Notice>}
        {push === 'denied' && <Notice tone="red">Уведомления для этого сайта запрещены в настройках браузера или телефона. Разрешите их там и вернитесь сюда.</Notice>}
        {push === 'unsupported' && <Muted small>Этот браузер не поддерживает push-уведомления.</Muted>}
        {(push === 'off' || push === 'on') && (
          <Row gap={8}>
            {push === 'off' && <Button kind="primary" disabled={busy} onClick={() => run(enablePush, 'Уведомления включены')}>{busy ? 'Включаю…' : 'Включить уведомления'}</Button>}
            {push === 'on' && <>
              <Button disabled={busy} onClick={() => run(testPush, 'Проверочное уведомление отправлено — должно прийти в течение минуты')}>Прислать проверочное</Button>
              <Button kind="danger" disabled={busy} onClick={() => run(disablePush, 'Уведомления на этом устройстве выключены')}>Выключить</Button>
            </>}
          </Row>
        )}
        {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      </div>
    </div>
  )
}
