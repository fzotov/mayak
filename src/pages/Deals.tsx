// Сделки (этап 7, CRM): воронка новых клиентов и продлений действующих арендаторов.
// Доска по этапам или список; у каждой открытой сделки — следующий шаг с датой и ответственным.
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { sb, sbRpc, useSb, useAction, useInvalidate } from '../lib/query'
import { go } from '../lib/nav'
import { Page, Card, Row, Button, Badge, Stat, Stats, Table, Select, Search, Segmented, Loading, ErrorBox, Empty, Sub, C, dateRu, num, useNarrow, type Col } from '../components/ui'
import {
  type Deal, type Kind, type Stage, DEAL_SELECT, OPEN_STAGES, stagesOf, stageLabel, isOpen, StageBadge, SOURCES, sourceLabel,
  dueTone, hasNextStep, dealTitle, localDate, daysBetween, DealFormModal, useCrmRefs,
} from '../components/crm'

type View = 'board' | 'list'
type Due = '' | 'overdue' | 'today' | 'none'
type StageFilter = 'open' | 'all' | Stage

export default function DealsPage() {
  const narrow = useNarrow()
  const { units, people, me, error: refsError } = useCrmRefs()
  const dealsQ = useSb(['deals', 'list'], async (): Promise<Deal[]> => {
    const rows = await sb(supabase.from('deals').select(DEAL_SELECT).order('next_step_at', { ascending: true, nullsFirst: true }).order('created_at', { ascending: false }))
    // kind и stage в базе ограничены проверками (new/renewal и этапы воронки) — строки сужаются до типов сделки
    return rows as Deal[]
  })
  const deals = dealsQ.data ?? (dealsQ.isPending ? null : [])
  const error = dealsQ.error?.message || ''
  const load = () => { dealsQ.refetch() }
  const invalidate = useInvalidate()
  const [syncAdded, setSyncAdded] = useState('')
  const [kind, setKind] = useState<Kind>(() => (sessionGet('deals-kind') as Kind) || 'new')
  const [view, setView] = useState<View>(() => (sessionGet('deals-view') as View) || 'board')
  const [source, setSource] = useState('')
  const [owner, setOwner] = useState('')
  const [mine, setMine] = useState(false)
  const [q, setQ] = useState('')
  const [due, setDue] = useState<Due>('')
  const [stageF, setStageF] = useState<StageFilter>('open')
  const [creating, setCreating] = useState(false)

  useEffect(() => { sessionSet('deals-kind', kind) }, [kind])
  useEffect(() => { sessionSet('deals-view', view) }, [view])

  // Продления за 60/30 дней до конца договора: база создаёт их сама раз в сутки, здесь — подстраховка при открытии.
  const syncRenewals = useAction(() => sbRpc('crm_sync_renewals'), {
    invalidate: ['deals', 'deal_units', 'deal_events'],
    onSuccess: n => { if (Number(n) > 0) setSyncAdded(`Добавлено напоминаний о продлении: ${n}`) },
  })
  useEffect(() => { syncRenewals.mutate(undefined) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const syncNote = syncRenewals.error ? 'Продления не обновились: ' + syncRenewals.error : syncAdded

  const unitById = useMemo(() => Object.fromEntries(units.map(u => [u.id, u])), [units])
  const nameOf = (id: string | null) => people.find(p => p.user_id === id)?.full_name || (id ? 'Сотрудник' : '—')
  const unitNumbers = (d: Deal) => (d.deal_units || []).map(x => unitById[x.unit_id]?.number).filter(Boolean) as string[]

  const ofKind = (deals || []).filter(d => d.kind === kind)
  const open = ofKind.filter(d => isOpen(d.stage))
  const overdue = open.filter(d => dueTone(d) === 'red')
  const todayN = open.filter(d => dueTone(d) === 'amber')
  const noStep = open.filter(d => !hasNextStep(d))

  const s = q.trim().toLowerCase()
  const filtered = ofKind.filter(d => {
    if (stageF === 'open' ? !isOpen(d.stage) : stageF !== 'all' && d.stage !== stageF) return false
    if (source && d.source !== source) return false
    if (mine ? d.owner_id !== me : owner && (owner === 'none' ? d.owner_id : d.owner_id !== owner)) return false
    if (due === 'overdue' && dueTone(d) !== 'red') return false
    if (due === 'today' && dueTone(d) !== 'amber') return false
    if (due === 'none' && (!isOpen(d.stage) || hasNextStep(d))) return false
    if (s && ![d.name, d.company, d.phone, d.email, String(d.number), d.notes, ...unitNumbers(d)].some(v => (v || '').toLowerCase().includes(s))) return false
    return true
  })
  const anyFilter = source || owner || mine || q || due

  const header = (
    <Row gap={8}>
      <Segmented<Kind> value={kind} onChange={k => { setKind(k); setStageF('open') }} options={[
        ['new', `Новые клиенты · ${(deals || []).filter(d => d.kind === 'new' && isOpen(d.stage)).length}`],
        ['renewal', `Продления · ${(deals || []).filter(d => d.kind === 'renewal' && isOpen(d.stage)).length}`],
      ]} />
      {!narrow && <Segmented<View> value={view} onChange={setView} options={[['board', 'Доска'], ['list', 'Список']]} />}
      <div style={{ flex: 1 }} />
      <Button onClick={() => go('/deals/report')}>Отчёт</Button>
      {kind === 'new' && <Button kind="primary" onClick={() => setCreating(true)}>Новая сделка</Button>}
    </Row>
  )

  const stats = (
    <Stats>
      <Stat label="Открытых сделок" value={open.length} onClick={() => { setDue(''); setStageF('open') }} />
      <Stat label="Шаг просрочен" value={overdue.length} tone={overdue.length ? 'red' : undefined} onClick={() => { setDue(due === 'overdue' ? '' : 'overdue'); setStageF('open') }} sub={due === 'overdue' ? 'фильтр включён' : undefined} />
      <Stat label="Шаг сегодня" value={todayN.length} tone={todayN.length ? 'amber' : undefined} onClick={() => { setDue(due === 'today' ? '' : 'today'); setStageF('open') }} sub={due === 'today' ? 'фильтр включён' : undefined} />
      <Stat label="Без следующего шага" value={noStep.length} tone={noStep.length ? 'red' : 'green'} onClick={() => { setDue(due === 'none' ? '' : 'none'); setStageF('open') }} sub={due === 'none' ? 'фильтр включён' : noStep.length ? 'должно быть 0' : undefined} />
    </Stats>
  )

  const filters = (
    <Row gap={8}>
      <Search value={q} onChange={setQ} placeholder="Имя, компания, телефон, помещение" width={narrow ? 260 : 280} />
      <Select style={{ width: 'auto' }} value={source} onChange={e => setSource(e.target.value)}>
        <option value="">Все источники</option>
        {SOURCES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
      </Select>
      <Select style={{ width: 'auto' }} value={mine ? '' : owner} disabled={mine} onChange={e => setOwner(e.target.value)}>
        <option value="">Все ответственные</option>
        <option value="none">Без ответственного</option>
        {people.map(p => <option key={p.user_id} value={p.user_id}>{p.full_name || 'Без имени'}</option>)}
      </Select>
      <Button kind={mine ? 'primary' : 'secondary'} onClick={() => setMine(m => !m)}>Мои</Button>
      {view === 'list' && !narrow && (
        <Select style={{ width: 'auto' }} value={stageF} onChange={e => setStageF(e.target.value as StageFilter)}>
          <option value="open">Открытые</option>
          <option value="all">Все, включая закрытые</option>
          {[...stagesOf(kind), 'won' as Stage, 'lost' as Stage].map(st => <option key={st} value={st}>{stageLabel(st, kind)}</option>)}
        </Select>
      )}
      {anyFilter && <Button kind="ghost" onClick={() => { setSource(''); setOwner(''); setMine(false); setQ(''); setDue('') }}>Сбросить</Button>}
    </Row>
  )

  const notes = <>
    {(error || refsError) && <ErrorBox error={error || refsError} onRetry={load} />}
    {syncNote && <div style={{ fontSize: 13, color: C.muted }}>{syncNote}</div>}
  </>

  const modal = creating && (
    <DealFormModal deal={null} units={units} people={people} me={me} onClose={() => setCreating(false)} onSaved={id => { setCreating(false); invalidate('deals', 'deal_units', 'deal_events'); go('/deals/' + id) }} />
  )

  // ── Телефон: карточки и этапы-чипы ────────────────────────────────────────
  if (narrow) {
    const chips: [StageFilter, React.ReactNode][] = [
      ['open', `Все · ${open.length}`],
      ...stagesOf(kind).map(st => [st, `${stageLabel(st, kind)} · ${open.filter(d => d.stage === st).length}`] as [StageFilter, string]),
      ['won', stageLabel('won', kind)], ['lost', stageLabel('lost', kind)],
    ]
    return (
      <Page>
        <Row gap={8}>
          <Segmented<Kind> value={kind} onChange={k => { setKind(k); setStageF('open') }} options={[['new', 'Новые клиенты'], ['renewal', 'Продления']]} />
        </Row>
        <Row gap={8}>
          {kind === 'new' && <Button kind="primary" style={{ flex: 1, minHeight: 44 }} onClick={() => setCreating(true)}>Новая сделка</Button>}
          <Button style={{ flex: kind === 'new' ? undefined : 1, minHeight: 44 }} onClick={() => go('/deals/report')}>Отчёт</Button>
        </Row>
        {stats}
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
          {chips.map(([k, l]) => (
            <button key={k} type="button" onClick={() => setStageF(k)} style={{
              flexShrink: 0, border: `1px solid ${stageF === k ? C.accent : C.line}`, background: stageF === k ? C.accentBg : C.card, color: stageF === k ? C.accent : C.text,
              borderRadius: 16, padding: '6px 12px', fontSize: 13, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap',
            }}>{l}</button>
          ))}
        </div>
        {filters}
        {notes}
        {deals === null ? <Loading /> : filtered.length === 0 ? <Card><Empty>{ofKind.length === 0 ? (kind === 'new' ? 'Сделок пока нет' : 'Договоров, которые заканчиваются в ближайшие 60 дней, нет') : 'Ничего не найдено'}</Empty></Card> : (
          <div style={{ display: 'grid', gap: 10 }}>
            {filtered.map(d => <DealTile key={d.id} d={d} units={unitNumbers(d)} owner={nameOf(d.owner_id)} showStage big />)}
          </div>
        )}
        {modal}
      </Page>
    )
  }

  // ── Список ────────────────────────────────────────────────────────────────
  const cols: Col<Deal>[] = [
    { key: 'n', title: '№', sort: d => d.number, render: d => <span style={{ color: C.muted }}>{d.number}</span> },
    { key: 'c', title: kind === 'renewal' ? 'Арендатор' : 'Клиент', sort: d => dealTitle(d), render: d => <div style={{ minWidth: 160 }}>
      <div style={{ fontWeight: 500 }}>{dealTitle(d)}</div>
      {d.company && d.name && <Sub>{d.name}</Sub>}
      {d.phone && <Sub>{d.phone}</Sub>}
    </div> },
    { key: 's', title: 'Этап', sort: d => [...OPEN_STAGES, 'won', 'lost'].indexOf(d.stage), render: d => <><StageBadge stage={d.stage} kind={d.kind} />{d.stage === 'lost' && d.lost_reason && <Sub>{d.lost_reason}</Sub>}</> },
    { key: 'u', title: 'Помещения', render: d => unitNumbers(d).join(', ') || (d.area_wanted ? `${num(d.area_wanted, 1)} м²` : '—') },
    kind === 'renewal'
      ? { key: 'end', title: 'Конец договора', sort: d => d.lease?.end_date || null, render: d => d.lease?.end_date ? <>{dateRu(d.lease.end_date)}<Sub>{leftText(d.lease.end_date)}</Sub></> : '—' }
      : { key: 'src', title: 'Источник', sort: d => sourceLabel(d.source), render: d => <>{sourceLabel(d.source)}{d.source_detail && <Sub>{short(d.source_detail, 40)}</Sub>}</> },
    { key: 'step', title: 'Следующий шаг', sort: d => isOpen(d.stage) ? d.next_step_at : null, render: d => isOpen(d.stage) ? <NextStep d={d} /> : <span style={{ color: C.faint }}>закрыта {dateRu(d.closed_at)}</span> },
    { key: 'o', title: 'Ответственный', sort: d => nameOf(d.owner_id), render: d => <span style={{ color: C.muted, whiteSpace: 'nowrap' }}>{nameOf(d.owner_id)}</span> },
  ]

  return (
    <Page>
      {header}
      {stats}
      {filters}
      {notes}
      {deals === null ? <Loading /> : view === 'list' ? (
        <Card pad={false}>
          <Table rows={filtered} rowKey={d => d.id} onRow={d => go('/deals/' + d.id)} cols={cols}
            empty={ofKind.length === 0 ? (kind === 'new' ? 'Сделок пока нет: создайте первую или дождитесь заявки с сайта' : 'Договоров, которые заканчиваются в ближайшие 60 дней, нет') : 'Ничего не найдено'} />
        </Card>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${stagesOf(kind).length}, minmax(220px, 1fr))`, gap: 12, overflowX: 'auto', alignItems: 'start', paddingBottom: 4 }}>
          {stagesOf(kind).map(st => {
            const col = filtered.filter(d => d.stage === st)
            return (
              <div key={st} style={{ background: C.card2, border: `1px solid ${C.line}`, borderRadius: C.radius, padding: 8, display: 'grid', gap: 8, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 4px' }}>
                  <span style={{ fontWeight: 600, fontSize: 13, flex: 1 }}>{stageLabel(st, kind)}</span>
                  <Badge>{col.length}</Badge>
                </div>
                {col.length === 0 && <div style={{ fontSize: 12, color: C.faint, padding: '8px 4px' }}>Пусто</div>}
                {col.map(d => <DealTile key={d.id} d={d} units={unitNumbers(d)} owner={nameOf(d.owner_id)} />)}
              </div>
            )
          })}
        </div>
      )}
      {modal}
    </Page>
  )
}

// ── Карточка сделки на доске и на телефоне ──────────────────────────────────
function DealTile({ d, units, owner, showStage, big }: { d: Deal; units: string[]; owner: string; showStage?: boolean; big?: boolean }) {
  const tone = dueTone(d)
  return (
    <div role="button" tabIndex={0} onClick={() => go('/deals/' + d.id)} onKeyDown={e => { if (e.key === 'Enter') go('/deals/' + d.id) }}
      style={{ background: C.card, border: `1px solid ${tone === 'red' ? C.redLine : tone === 'amber' ? C.amberLine : C.line}`, borderRadius: C.radiusSm,
        padding: big ? 14 : 10, cursor: 'pointer', display: 'grid', gap: 6, minWidth: 0 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: big ? 15 : 13, overflowWrap: 'anywhere' }}>{dealTitle(d)}</div>
          {d.company && d.name && <div style={{ fontSize: 12, color: C.muted }}>{d.name}</div>}
        </div>
        {showStage && <StageBadge stage={d.stage} kind={d.kind} />}
      </div>
      <div style={{ fontSize: 12, color: C.muted, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {units.length > 0 ? <span>пом. {units.join(', ')}</span> : d.area_wanted ? <span>{num(d.area_wanted, 1)} м²</span> : null}
        {d.kind === 'renewal' && d.lease?.end_date ? <span>до {dateRu(d.lease.end_date)} ({leftText(d.lease.end_date)})</span> : <span>{sourceLabel(d.source)}</span>}
      </div>
      {isOpen(d.stage) ? <NextStep d={d} /> : <div style={{ fontSize: 12, color: C.faint }}>{d.stage === 'lost' ? d.lost_reason : 'закрыта'} · {dateRu(d.closed_at)}</div>}
      <div style={{ fontSize: 11, color: C.faint }}>{owner}</div>
    </div>
  )
}

function NextStep({ d }: { d: Deal }) {
  const tone = dueTone(d)
  if (!hasNextStep(d)) return <span style={{ color: C.red, fontSize: 12, fontWeight: 500 }}>Нет следующего шага</span>
  const color = tone === 'red' ? C.red : tone === 'amber' ? C.amber : C.muted
  const t = localDate()
  const when = d.next_step_at === t ? 'сегодня' : d.next_step_at! < t ? `${dateRu(d.next_step_at)}, просрочено ${daysBetween(d.next_step_at!, t)} дн.` : dateRu(d.next_step_at)
  return (
    <div style={{ fontSize: 12, minWidth: 0 }}>
      <div style={{ color: C.text, overflowWrap: 'anywhere' }}>{d.next_step}</div>
      <div style={{ color, fontWeight: tone ? 500 : 400 }}>{when}</div>
    </div>
  )
}

const short = (s: string, n: number) => (s.length > n ? s.slice(0, n) + '…' : s)
function leftText(end: string) {
  const n = daysBetween(localDate(), end)
  return n < 0 ? `истёк ${-n} дн. назад` : n === 0 ? 'сегодня' : `через ${n} дн.`
}

// Вид и вкладка запоминаются на время сеанса (необязательное удобство).
function sessionGet(k: string) { try { return sessionStorage.getItem(k) } catch { return null } }
function sessionSet(k: string, v: string) { try { sessionStorage.setItem(k, v) } catch { /* хранилище недоступно */ } }
