// Журнал обращений арендатора: звонки, визиты, письма, заметки и события сделок (в том числе продлений).
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Card, Row, Button, Badge, Field, Select, Textarea, Notice, Loading, Empty, Link, Sub, C } from './ui'

export const EVENT_KINDS: Record<string, string> = {
  call: 'Звонок', visit: 'Визит', viewing: 'Показ', email: 'Письмо', message: 'Сообщение', meeting: 'Встреча', note: 'Заметка', stage: 'Этап', system: 'Система',
}
const STAGES: Record<string, string> = { new: 'Новая', contacted: 'Связались', viewing: 'Показ', offer: 'Предложение', contract: 'Договор', won: 'Заселён', lost: 'Отказ' }

export function TenantJournal({ tenantId }: { tenantId: string }) {
  const [events, setEvents] = useState<any[] | null>(null)
  const [deals, setDeals] = useState<any[]>([])
  const [kind, setKind] = useState('call')
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const load = async () => {
    const [e, d] = await Promise.all([
      supabase.from('deal_events').select('id, deal_id, kind, text, created_by_name, created_at').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(200),
      supabase.from('deals').select('id, number, kind, stage, next_step, next_step_at').eq('tenant_id', tenantId).order('created_at', { ascending: false }),
    ])
    if (e.error || d.error) setErr((e.error || d.error)!.message)
    setEvents(e.data || []); setDeals(d.data || [])
  }
  useEffect(() => { load() }, [tenantId])

  const add = async () => {
    if (!text.trim()) { setErr('Опишите обращение'); return }
    setBusy(true); setErr('')
    const { error } = await supabase.from('deal_events').insert({ tenant_id: tenantId, kind, text: text.trim() })
    setBusy(false)
    if (error) { setErr(error.message); return }
    setText(''); load()
  }

  if (!events) return <Loading />
  return (
    <>
      {deals.length > 0 && (
        <Card title="Сделки">
          <div style={{ display: 'grid', gap: 8 }}>
            {deals.map(d => (
              <Row key={d.id} justify="space-between">
                <span><Link to={'/deals/' + d.id}>{d.kind === 'renewal' ? 'Продление' : 'Сделка'} № {d.number}</Link> <Badge tone={d.stage === 'won' ? 'green' : d.stage === 'lost' ? 'red' : 'blue'}>{STAGES[d.stage] || d.stage}</Badge></span>
                {!['won', 'lost'].includes(d.stage) && <Sub>{d.next_step} · {d.next_step_at ? new Date(d.next_step_at).toLocaleDateString('ru-RU') : ''}</Sub>}
              </Row>
            ))}
          </div>
        </Card>
      )}
      <Card title="Новое обращение">
        <div style={{ display: 'grid', gap: 10 }}>
          <Field label="Тип">
            <Select value={kind} onChange={e => setKind(e.target.value)}>
              {['call', 'visit', 'email', 'message', 'meeting', 'note'].map(k => <option key={k} value={k}>{EVENT_KINDS[k]}</option>)}
            </Select>
          </Field>
          <Field label="Что обсудили"><Textarea value={text} onChange={e => setText(e.target.value)} placeholder="Например: просит снизить ставку при продлении на 2 года" /></Field>
          {err && <Notice tone="red">{err}</Notice>}
          <Row justify="flex-end"><Button kind="primary" onClick={add} disabled={busy}>{busy ? 'Сохранение…' : 'Добавить в журнал'}</Button></Row>
        </div>
      </Card>
      <Card title="Журнал обращений">
        {events.length === 0 ? <Empty>Обращений пока нет</Empty> : (
          <div style={{ display: 'grid' }}>
            {events.map(e => (
              <div key={e.id} style={{ padding: '10px 0', borderTop: `1px solid ${C.line}` }}>
                <Row gap={8}>
                  <Badge tone={e.kind === 'stage' || e.kind === 'system' ? 'neutral' : 'blue'}>{EVENT_KINDS[e.kind] || e.kind}</Badge>
                  <Sub>{new Date(e.created_at).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })}{e.created_by_name ? ' · ' + e.created_by_name : ''}</Sub>
                </Row>
                {e.text && <div style={{ marginTop: 6, fontSize: 14, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{e.text}</div>}
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  )
}
