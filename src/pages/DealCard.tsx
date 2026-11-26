// Карточка сделки: этапы, контакт, помещения, следующий шаг, касания и история.
// Новый клиент заселяется через мастер арендатора (/tenants/new?deal=…), продление — через договор и индексацию ставки.
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { sb, useSb, useAction, useInvalidate } from '../lib/query'
import type { TablesUpdate } from '../lib/database.types'
import { go } from '../lib/nav'
import {
  Page, Card, Row, Button, Badge, Field, Select, Textarea, Modal, Notice, Loading, ErrorBox, Empty, Link, PhoneLink, Muted, Sub,
  C, dateRu, dateTimeRu, money, num, useNarrow,
} from '../components/ui'
import {
  type Deal, type DealEvent, type Kind, type Stage, DEAL_SELECT, stagesOf, stageLabel, isOpen, StageBadge, STAGE_TONE, sourceLabel, TOUCH_KINDS, eventLabel,
  LOST_REASONS, dueTone, hasNextStep, dealTitle, localDate, daysBetween, dbError, DealFormModal, NextStepFields, UnitStatus, useCrmRefs,
} from '../components/crm'

type Move = { to: Stage } | null

/** Все таблицы, которые меняет запись по сделке (события пишет и база — триггерами этапов). */
const DEAL_TABLES = ['deals', 'deal_units', 'deal_events']

export default function DealCardPage({ dealId }: { dealId: string }) {
  const narrow = useNarrow()
  const { units, people, me } = useCrmRefs()
  const invalidate = useInvalidate()
  const dealQ = useSb(['deals', 'card', dealId], async (): Promise<Deal | null> => {
    const row = await sb(supabase.from('deals').select(DEAL_SELECT).eq('id', dealId).maybeSingle())
    // kind и stage в базе ограничены проверками — строка сужается до типа сделки
    return (row as Deal | null) ?? null
  })
  const eventsQ = useSb(['deal_events', 'deal', dealId], (): Promise<DealEvent[]> =>
    sb(supabase.from('deal_events').select('id, kind, text, stage_from, stage_to, created_by_name, created_at').eq('deal_id', dealId).order('created_at', { ascending: false })))
  const deal = dealQ.isPending ? undefined : dealQ.data ?? null
  const events = eventsQ.data ?? []
  const error = dealQ.error?.message || eventsQ.error?.message || ''
  const load = () => { dealQ.refetch(); eventsQ.refetch() }
  const [msg, setMsg] = useState<{ tone: 'green' | 'red'; text: string } | null>(null)
  const [move, setMove] = useState<Move>(null)
  const [editing, setEditing] = useState(false)

  if (deal === undefined) return <Loading />
  if (deal === null) return <Page>{error ? <ErrorBox error={error} onRetry={load} /> : <Card><Empty>Сделка не найдена. <Link to="/deals">Ко всем сделкам</Link></Empty></Card>}</Page>

  const open = isOpen(deal.stage)
  const dealUnits = (deal.deal_units || []).flatMap(x => units.filter(u => u.id === x.unit_id))
  // записи через useAction уже обновили сделку и историю; здесь — только сообщение
  const done = (text: string) => { setMsg({ tone: 'green', text }) }
  const ownerName = people.find(p => p.user_id === deal.owner_id)?.full_name

  const lease = deal.lease
  const left = lease?.end_date ? daysBetween(localDate(), lease.end_date) : null

  // Действия под заголовком
  const actions: React.ReactNode[] = []
  if (deal.kind === 'new' && open && (deal.stage === 'offer' || deal.stage === 'contract'))
    actions.push(<Button key="settle" kind="primary" onClick={() => go('/tenants/new?deal=' + deal.id)}>Заселить</Button>)
  if (deal.kind === 'renewal') {
    if (deal.lease_id) actions.push(<Button key="idx" onClick={() => go('/contracts/' + deal.lease_id)}>Индексировать ставку</Button>)
    if (open) {
      actions.push(<Button key="won" kind="primary" onClick={() => setMove({ to: 'won' })}>Продлён</Button>)
      actions.push(<Button key="lost" kind="danger" onClick={() => setMove({ to: 'lost' })}>Съезжает</Button>)
    }
  }
  if (deal.tenant_id && (deal.kind === 'renewal' || deal.stage === 'won'))
    actions.push(<Button key="t" onClick={() => go('/tenants/' + deal.tenant_id)}>Карточка арендатора</Button>)

  return (
    <Page title={<span>{dealTitle(deal)} <span style={{ color: C.faint, fontWeight: 400, fontSize: 14 }}>№{deal.number}</span></span>}
      actions={<><Button onClick={() => go('/deals')}>Все сделки</Button></>}>
      <Row gap={8}>
        <Badge tone={deal.kind === 'renewal' ? 'violet' : 'blue'}>{deal.kind === 'renewal' ? 'Продление' : 'Новый клиент'}</Badge>
        <StageBadge stage={deal.stage} kind={deal.kind} />
        {deal.stage === 'lost' && deal.lost_reason && <Muted>{deal.lost_reason}</Muted>}
        {deal.closed_at && <Muted small>закрыта {dateRu(deal.closed_at)}</Muted>}
      </Row>

      <Stepper deal={deal} onPick={to => to !== deal.stage && setMove({ to })} narrow={narrow} />
      {actions.length > 0 && <Row gap={8}>{actions}</Row>}
      {error && <ErrorBox error={error} onRetry={load} />}
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      {deal.stage === 'won' && deal.kind === 'new' && deal.tenant && <Notice tone="green">Клиент заселён: <Link to={'/tenants/' + deal.tenant.id}>{deal.tenant.full_name}</Link></Notice>}

      <div style={{ display: 'grid', gridTemplateColumns: narrow ? '1fr' : 'minmax(0, 1fr) minmax(0, 1.25fr)', gap: 16, alignItems: 'start' }}>
        <div style={{ display: 'grid', gap: 16, minWidth: 0 }}>
          <NextStepCard deal={deal} people={people} me={me} onSaved={() => done('Следующий шаг сохранён')} />

          <Card title="Контакт" actions={<Button small onClick={() => setEditing(true)}>Изменить</Button>}>
            <div style={{ display: 'grid', gap: 8, fontSize: 14 }}>
              <Line label="Компания">{deal.company || '—'}</Line>
              <Line label="Контактное лицо">{deal.name || '—'}</Line>
              <Line label="Телефон"><PhoneLink phone={deal.phone} /></Line>
              <Line label="Почта">{deal.email ? <a href={'mailto:' + deal.email} style={{ color: C.accent, textDecoration: 'none' }}>{deal.email}</a> : '—'}</Line>
              <Line label="Источник">{sourceLabel(deal.source)}{deal.source_detail && <Sub>{deal.source_detail}</Sub>}{deal.lead_id && <Sub><Link to="/site">Заявка с сайта</Link></Sub>}</Line>
              {deal.area_wanted != null && <Line label="Нужная площадь">{num(deal.area_wanted, 1)} м²</Line>}
              {deal.budget != null && <Line label="Бюджет">{money(deal.budget)} в месяц</Line>}
              {deal.notes && <Line label="Заметки"><span style={{ whiteSpace: 'pre-wrap' }}>{deal.notes}</span></Line>}
              <Line label="Создана">{dateTimeRu(deal.created_at)}{ownerName && <Sub>ответственный: {ownerName}</Sub>}</Line>
            </div>
          </Card>

          {deal.kind === 'renewal' && (
            <Card title="Договор">
              <div style={{ display: 'grid', gap: 8, fontSize: 14 }}>
                <Line label="Арендатор">{deal.tenant ? <Link to={'/tenants/' + deal.tenant.id}>{deal.tenant.full_name}</Link> : '—'}</Line>
                <Line label="Договор">{lease ? <Link to={'/contracts/' + lease.id}>№{lease.number || 'б/н'}</Link> : '—'}</Line>
                <Line label="Окончание">{lease?.end_date ? <>{dateRu(lease.end_date)}{' '}
                  {left !== null && <Badge tone={left < 0 ? 'red' : left <= 30 ? 'red' : 'amber'}>{left < 0 ? `истёк ${-left} дн. назад` : left === 0 ? 'сегодня' : `осталось ${left} дн.`}</Badge>}</> : '—'}</Line>
              </div>
            </Card>
          )}

          <Card title={`Помещения${dealUnits.length ? ' · ' + dealUnits.length : ''}`} actions={<Button small onClick={() => setEditing(true)}>Изменить</Button>}>
            {dealUnits.length === 0 ? <Muted>Помещения не выбраны</Muted> : (
              <div style={{ display: 'grid', gap: 6 }}>
                {dealUnits.map(u => (
                  <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 }}>
                    <Link to={'/units?q=' + encodeURIComponent(u.number)}>{u.number}</Link>
                    <span style={{ color: C.muted, flex: 1 }}>{u.floor ? `${u.floor} эт.` : ''}{u.area ? ` · ${num(u.area, 1)} м²` : ''}</span>
                    {u.status === 'occupied' && u.tenant_id && u.tenant_id === deal.tenant_id ? <Badge tone="blue">этот арендатор</Badge> : <UnitStatus u={u} />}
                  </div>
                ))}
                {deal.kind === 'new' && open && dealUnits.some(u => u.status !== 'free') && <Sub>Часть помещений сейчас занята: проверьте сроки освобождения.</Sub>}
              </div>
            )}
          </Card>
        </div>

        <div style={{ display: 'grid', gap: 16, minWidth: 0 }}>
          <TouchForm deal={deal} onSaved={(t) => done(t)} />
          <Card title="История" pad={false}>
            {events.length === 0 ? <Empty>Пока пусто</Empty> : (
              <div>
                {events.map(e => (
                  <div key={e.id} style={{ display: 'flex', gap: 10, padding: '10px 16px', borderBottom: `1px solid ${C.line}` }}>
                    <div style={{ width: 8, height: 8, borderRadius: 4, marginTop: 6, flexShrink: 0, background: e.kind === 'stage' ? `var(--${toneVar(e.stage_to && e.stage_to in STAGE_TONE ? STAGE_TONE[e.stage_to as Stage] : undefined)})` : e.kind === 'system' ? C.lineStrong : C.accent }} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{e.kind === 'stage' ? 'Этап' : eventLabel(e.kind)}</span>
                        <span style={{ fontSize: 12, color: C.faint }}>{dateTimeRu(e.created_at)}{e.created_by_name ? ' · ' + e.created_by_name : ''}</span>
                      </div>
                      {e.kind === 'stage'
                        ? <div style={{ fontSize: 13, color: C.muted }}>{stageLabel(e.stage_from || '', deal.kind)} → {stageLabel(e.stage_to || '', deal.kind)}{e.stage_to === 'lost' && e.text?.includes(': ') ? ': ' + e.text.split(': ').slice(1).join(': ') : ''}</div>
                        : e.text && <div style={{ fontSize: 13, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{e.text}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {move && <MoveModal deal={deal} to={move.to} onClose={() => setMove(null)} onDone={t => { setMove(null); done(t) }} />}
      {editing && <DealFormModal deal={deal} units={units} people={people} me={me} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); invalidate(...DEAL_TABLES); done('Сделка сохранена') }} />}
    </Page>
  )
}

const toneVar = (t?: string) => (t === 'blue' ? 'accent' : t === 'neutral' || !t ? 'border-strong' : t)

function Line({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '130px minmax(0, 1fr)', gap: 8 }}>
      <span style={{ color: C.muted, fontSize: 13 }}>{label}</span>
      <div style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{children}</div>
    </div>
  )
}

// ── Этапы ───────────────────────────────────────────────────────────────────
function Stepper({ deal, onPick, narrow }: { deal: Deal; onPick: (s: Stage) => void; narrow: boolean }) {
  const stages = [...stagesOf(deal.kind), 'won' as Stage]
  const cur = stages.indexOf(deal.stage)
  const lost = deal.stage === 'lost'
  return (
    <div style={{ display: 'flex', gap: 4, overflowX: 'auto', paddingBottom: 2 }} role="list" aria-label="Этапы сделки">
      {[...stages, 'lost' as Stage].map((st, i) => {
        const isLost = st === 'lost'
        const active = st === deal.stage
        const passed = !lost && !isLost && cur >= 0 && i < cur
        const bg = active ? (isLost ? C.redBg : st === 'won' ? C.greenBg : C.accentBg) : passed ? C.hover : C.card
        const fg = active ? (isLost ? C.red : st === 'won' ? C.green : C.accent) : isLost ? C.red : passed ? C.text : C.muted
        return (
          <button key={st} type="button" role="listitem" onClick={() => onPick(st)} aria-current={active ? 'step' : undefined}
            title={active ? 'Текущий этап' : 'Перевести на этап'}
            style={{
              flex: narrow ? '0 0 auto' : isLost ? '0 0 auto' : 1, minWidth: 0, padding: narrow ? '8px 12px' : '9px 12px', marginLeft: isLost ? 8 : 0,
              border: `1px solid ${active ? fg : isLost ? C.redLine : C.line}`, background: bg, color: fg, borderRadius: C.radiusSm,
              fontSize: 13, fontWeight: active ? 600 : 500, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap', minHeight: narrow ? 40 : undefined,
            }}>
            {!isLost && <span style={{ opacity: 0.6, marginRight: 6 }}>{i + 1}</span>}{stageLabel(st, deal.kind)}
          </button>
        )
      })}
    </div>
  )
}

/** Смена этапа: открытый → просит следующий шаг; отказ → причину; заселение → мастер или существующий арендатор. */
function MoveModal({ deal, to, onClose, onDone }: { deal: Deal; to: Stage; onClose: () => void; onDone: (text: string) => void }) {
  const [step, setStep] = useState(isOpen(deal.stage) ? deal.next_step || '' : '')
  const [at, setAt] = useState(isOpen(deal.stage) && deal.next_step_at && deal.next_step_at >= localDate() ? deal.next_step_at : localDate())
  const [reason, setReason] = useState('')
  const [tenantId, setTenantId] = useState('')
  const [err, setErr] = useState('')
  const toOpen = isOpen(to)
  const settleNew = to === 'won' && deal.kind === 'new'
  const tenantsQ = useSb(['tenants', 'deal-move-names'], () => sb(supabase.from('tenants').select('id, full_name').order('full_name')), { enabled: settleNew })
  const tenants = tenantsQ.data ?? null
  const act = useAction((patch: TablesUpdate<'deals'>) => sb(supabase.from('deals').update(patch).eq('id', deal.id)), {
    invalidate: DEAL_TABLES, onSuccess: () => onDone(`Этап: ${stageLabel(to, deal.kind)}`),
  })
  const busy = act.isPending

  function save() {
    const patch: TablesUpdate<'deals'> = { stage: to }
    if (toOpen) {
      if (!step.trim() || !at) { setErr('Укажите следующий шаг и дату.'); return }
      Object.assign(patch, { next_step: step.trim(), next_step_at: at, lost_reason: null })
    } else if (to === 'lost') {
      if (!reason.trim()) { setErr('Укажите причину.'); return }
      patch.lost_reason = reason.trim()
    } else if (settleNew) {
      if (!tenantId) { setErr('Выберите арендатора или заселите через мастер.'); return }
      patch.tenant_id = tenantId
    }
    setErr('')
    act.mutate(patch)
  }

  const title = to === 'lost' ? (deal.kind === 'renewal' ? 'Арендатор съезжает' : 'Отказ') : to === 'won' ? stageLabel('won', deal.kind) : `Этап «${stageLabel(to, deal.kind)}»`
  return (
    <Modal title={title} onClose={onClose} width={520} footer={<>
      <Button onClick={onClose}>Отмена</Button>
      {!(settleNew && !tenantId) && <Button kind={to === 'lost' ? 'danger' : 'primary'} disabled={busy} onClick={save}>{busy ? 'Сохраняю…' : 'Сохранить'}</Button>}
    </>}>
      {(err || act.error) && <Notice tone="red">{err || dbError({ message: act.error })}</Notice>}
      {tenantsQ.error && <Notice tone="red">Список арендаторов не загрузился: {tenantsQ.error.message}</Notice>}
      {toOpen && <>
        {!isOpen(deal.stage) && <Notice tone="amber">Сделка снова станет открытой.</Notice>}
        <NextStepFields step={step} at={at} onStep={setStep} onAt={setAt} />
      </>}
      {to === 'lost' && <>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {LOST_REASONS[deal.kind as Kind].map(r => <Button key={r} small kind={reason === r ? 'primary' : 'secondary'} onClick={() => setReason(r)}>{r}</Button>)}
        </div>
        <Field label="Причина *"><Textarea value={reason} onChange={e => setReason(e.target.value)} style={{ minHeight: 60 }} /></Field>
        {deal.kind === 'renewal' && <Muted small>Договор не меняется: дату выезда и расторжение оформите в договоре.</Muted>}
      </>}
      {to === 'won' && deal.kind === 'renewal' && <>
        <div style={{ fontSize: 14 }}>Договор продлён. Если меняется ставка, задайте её в договоре кнопкой «Новая ставка».</div>
        {deal.lease_id && <div><Button small onClick={() => go('/contracts/' + deal.lease_id)}>Открыть договор</Button></div>}
      </>}
      {settleNew && <>
        <div style={{ fontSize: 14 }}>Новый арендатор заводится через мастер: данные из сделки подставятся, после сохранения сделка закроется как «Заселён», а помещения станут заняты.</div>
        <div><Button kind="primary" onClick={() => go('/tenants/new?deal=' + deal.id)}>Открыть мастер заселения</Button></div>
        <Field label="Или клиент уже арендатор" hint="Например, берёт ещё одно помещение">
          <Select value={tenantId} onChange={e => setTenantId(e.target.value)} disabled={!tenants}>
            <option value="">{tenants ? 'Выберите арендатора' : 'Загрузка…'}</option>
            {(tenants || []).map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
          </Select>
        </Field>
      </>}
    </Modal>
  )
}

// ── Следующий шаг ───────────────────────────────────────────────────────────
function NextStepCard({ deal, people, me, onSaved }: { deal: Deal; people: { user_id: string; full_name: string | null }[]; me: string | null; onSaved: () => void }) {
  const [step, setStep] = useState(deal.next_step || '')
  const [at, setAt] = useState(deal.next_step_at || '')
  const [owner, setOwner] = useState(deal.owner_id || '')
  const [err, setErr] = useState('')
  const act = useAction((patch: TablesUpdate<'deals'>) => sb(supabase.from('deals').update(patch).eq('id', deal.id)), { invalidate: DEAL_TABLES, onSuccess: () => onSaved() })
  const busy = act.isPending
  const shownErr = err || (act.error ? dbError({ message: act.error }) : '')
  useEffect(() => { setStep(deal.next_step || ''); setAt(deal.next_step_at || ''); setOwner(deal.owner_id || '') }, [deal.next_step, deal.next_step_at, deal.owner_id])
  const open = isOpen(deal.stage)
  const changed = step !== (deal.next_step || '') || at !== (deal.next_step_at || '') || owner !== (deal.owner_id || '')
  const tone = dueTone(deal)

  function save() {
    if (open && (!step.trim() || !at)) { setErr('У открытой сделки должен быть следующий шаг с датой.'); return }
    setErr('')
    act.mutate({ next_step: step.trim() || null, next_step_at: at || null, owner_id: owner || null })
  }

  if (!open) return (
    <Card title="Ответственный">
      <Row gap={8}>
        <Select value={owner} onChange={e => setOwner(e.target.value)} style={{ flex: 1, width: 'auto' }}>
          <option value="">Не назначен</option>
          {people.map(p => <option key={p.user_id} value={p.user_id}>{p.full_name || 'Без имени'}{p.user_id === me ? ' (я)' : ''}</option>)}
        </Select>
        {changed && <Button kind="primary" disabled={busy} onClick={save}>Сохранить</Button>}
      </Row>
      {shownErr && <div style={{ marginTop: 8 }}><Notice tone="red">{shownErr}</Notice></div>}
    </Card>
  )

  return (
    <Card title={<span>Следующий шаг {tone === 'red' ? <Badge tone="red">просрочен</Badge> : tone === 'amber' ? <Badge tone="amber">сегодня</Badge> : !hasNextStep(deal) ? <Badge tone="red">не задан</Badge> : null}</span>}>
      <div style={{ display: 'grid', gap: 10 }}>
        {shownErr && <Notice tone="red">{shownErr}</Notice>}
        <NextStepFields step={step} at={at} onStep={setStep} onAt={setAt} />
        <Field label="Ответственный">
          <Select value={owner} onChange={e => setOwner(e.target.value)}>
            <option value="">Не назначен</option>
            {people.map(p => <option key={p.user_id} value={p.user_id}>{p.full_name || 'Без имени'}{p.user_id === me ? ' (я)' : ''}</option>)}
          </Select>
        </Field>
        <div><Button kind="primary" disabled={!changed || busy} onClick={save}>{busy ? 'Сохраняю…' : 'Сохранить шаг'}</Button></div>
      </div>
    </Card>
  )
}

// ── Касание ─────────────────────────────────────────────────────────────────
function TouchForm({ deal, onSaved }: { deal: Deal; onSaved: (text: string) => void }) {
  const [kind, setKind] = useState('call')
  const [text, setText] = useState('')
  const [nextOpen, setNextOpen] = useState(false)
  const [step, setStep] = useState('')
  const [at, setAt] = useState('')
  const [err, setErr] = useState('')
  const open = isOpen(deal.stage)
  const act = useAction(async (a: { text: string; next: { step: string; at: string } | null }) => {
    await sb(supabase.from('deal_events').insert({ deal_id: deal.id, tenant_id: deal.tenant_id, kind, text: a.text }))
    if (a.next) {
      const { error } = await supabase.from('deals').update({ next_step: a.next.step, next_step_at: a.next.at }).eq('id', deal.id)
      if (error) throw new Error('Касание записано, но шаг не сохранился: ' + dbError(error))
    }
  }, {
    invalidate: DEAL_TABLES,
    onSuccess: (_r, a) => {
      setText(''); setStep(''); setAt(''); setNextOpen(false)
      onSaved(a.next ? 'Касание записано, следующий шаг обновлён' : 'Касание записано')
    },
  })
  const busy = act.isPending

  function save() {
    if (!text.trim()) { setErr('Опишите, что было: о чём договорились, что ответил клиент.'); return }
    if (nextOpen && (!step.trim() || !at)) { setErr('Новый следующий шаг: текст и дата.'); return }
    setErr('')
    act.mutate({ text: text.trim(), next: nextOpen ? { step: step.trim(), at } : null })
  }

  return (
    <Card title="Добавить касание">
      <div style={{ display: 'grid', gap: 10 }}>
        {(err || act.error) && <Notice tone="red">{err || act.error}</Notice>}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {TOUCH_KINDS.map(([k, l]) => <Button key={k} small kind={kind === k ? 'primary' : 'secondary'} onClick={() => setKind(k)}>{l}</Button>)}
        </div>
        <Textarea value={text} onChange={e => setText(e.target.value)} placeholder="Что было и о чём договорились" style={{ minHeight: 70 }} />
        {open && (nextOpen
          ? <NextStepFields step={step} at={at} onStep={setStep} onAt={setAt} />
          : <div><Button small kind="ghost" onClick={() => { setNextOpen(true); setStep(''); setAt(localDate()) }}>Задать новый следующий шаг</Button></div>)}
        <div><Button kind="primary" disabled={busy} onClick={save}>{busy ? 'Сохраняю…' : 'Записать'}</Button></div>
      </div>
    </Card>
  )
}
