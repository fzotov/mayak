// CRM (этап 7): общие справочники, загрузка и формы для «Сделок», карточки сделки и отчёта.
import { useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useSb, useAction } from '../lib/query'
import type { TablesInsert, TablesUpdate } from '../lib/database.types'
import { Badge, Button, Field, Input, Select, Textarea, Modal, Notice, C, num, type Tone } from './ui'

// ── Справочники ─────────────────────────────────────────────────────────────
export type Stage = 'new' | 'contacted' | 'viewing' | 'offer' | 'contract' | 'won' | 'lost'
export type Kind = 'new' | 'renewal'
export const OPEN_STAGES: Stage[] = ['new', 'contacted', 'viewing', 'offer', 'contract']
/** Этапы воронки по виду сделки: продлению показ не нужен. */
export const stagesOf = (kind: Kind): Stage[] => kind === 'renewal' ? ['new', 'contacted', 'offer', 'contract'] : OPEN_STAGES
export const isOpen = (s: string) => s !== 'won' && s !== 'lost'

const STAGE_LABEL: Record<Stage, string> = { new: 'Новая', contacted: 'Связались', viewing: 'Показ', offer: 'Предложение', contract: 'Договор', won: 'Заселён', lost: 'Отказ' }
export const stageLabel = (s: string, kind: Kind = 'new') =>
  kind === 'renewal' && s === 'won' ? 'Продлён' : kind === 'renewal' && s === 'lost' ? 'Съезжает' : kind === 'renewal' && s === 'contract' ? 'Допсоглашение' : STAGE_LABEL[s as Stage] || s
export const STAGE_TONE: Record<Stage, Tone> = { new: 'neutral', contacted: 'blue', viewing: 'violet', offer: 'amber', contract: 'amber', won: 'green', lost: 'red' }
export function StageBadge({ stage, kind }: { stage: string; kind: Kind }) {
  return <Badge tone={STAGE_TONE[stage as Stage] || 'neutral'}>{stageLabel(stage, kind)}</Badge>
}

export const SOURCES: [string, string][] = [
  ['site', 'Сайт'], ['call', 'Звонок'], ['visit', 'Визит'], ['telegram', 'Телеграм'], ['referral', 'Рекомендация'], ['tenant', 'Арендатор'], ['other', 'Другое'],
]
export const sourceLabel = (s?: string | null) => SOURCES.find(x => x[0] === s)?.[1] || s || '—'
/** Источники, которые выбирают вручную (арендатор — только у продлений). */
export const MANUAL_SOURCES = SOURCES.filter(([k]) => k !== 'tenant')

export const TOUCH_KINDS: [string, string][] = [
  ['call', 'Звонок'], ['visit', 'Визит'], ['viewing', 'Показ'], ['email', 'Письмо'], ['message', 'Сообщение'], ['meeting', 'Встреча'], ['note', 'Заметка'],
]
export const eventLabel = (k: string) => TOUCH_KINDS.find(x => x[0] === k)?.[1] || (k === 'stage' ? 'Этап' : k === 'system' ? 'Система' : k)

export const LOST_REASONS: Record<Kind, string[]> = {
  new: ['Дорого', 'Не подошло помещение', 'Выбрал другой объект', 'Не выходит на связь', 'Передумал'],
  renewal: ['Съезжает', 'Не договорились о ставке', 'Переезд в другое помещение', 'Закрытие бизнеса'],
}

// ── Данные ──────────────────────────────────────────────────────────────────
export interface Deal {
  id: string; number: number; kind: Kind; stage: Stage; lost_reason: string | null
  name: string | null; company: string | null; phone: string | null; email: string | null
  source: string; source_detail: string | null; lead_id: string | null; tenant_id: string | null; lease_id: string | null
  area_wanted: number | null; budget: number | null; notes: string | null; owner_id: string | null
  next_step: string | null; next_step_at: string | null
  created_at: string; updated_at: string; stage_changed_at: string; closed_at: string | null
  deal_units?: { unit_id: string }[]
  tenant?: { id: string; full_name: string } | null
  lease?: { id: string; number: string | null; end_date: string | null; status: string | null } | null
}
export interface UnitLite { id: string; number: string; floor: number | null; area: number | null; status: string; tenant_id: string | null }
export interface Person { user_id: string; full_name: string | null }
export interface DealEvent { id: string; kind: string; text: string | null; stage_from: string | null; stage_to: string | null; created_by_name: string | null; created_at: string }

export const DEAL_SELECT = '*, deal_units(unit_id), tenant:tenants!deals_tenant_id_fkey(id, full_name), lease:leases!deals_lease_id_fkey(id, number, end_date, status)'

export async function loadUnits(): Promise<UnitLite[]> {
  const { data, error } = await supabase.from('units').select('id, number, floor, area, status, tenant_id').order('floor').order('number')
  if (error) throw new Error(error.message)
  return (data || []).map(u => ({ ...u, status: u.status ?? '' }))
}
export async function loadPeople(): Promise<Person[]> {
  const { data } = await supabase.from('profiles').select('user_id, full_name').order('full_name')
  return (data || []).filter(p => p.user_id)
}
export async function myId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  return data.session?.user.id ?? null
}

/** Ошибка базы — понятным текстом (ограничения сделки). */
export function dbError(e: { message?: string } | null | undefined): string {
  const m = e?.message || 'Не сохранилось'
  if (m.includes('deals_next_step')) return 'У открытой сделки должен быть следующий шаг с датой.'
  if (m.includes('deals_lost_reason')) return 'Укажите причину отказа.'
  if (m.includes('deals_open_renewal_uq')) return 'По этому договору уже есть открытая сделка продления.'
  if (m.includes('deals_lead_id_key')) return 'По этой заявке с сайта уже есть сделка.'
  return m
}

// ── Даты ────────────────────────────────────────────────────────────────────
/** Сегодня по местному времени (YYYY-MM-DD), а не по UTC. */
export const localDate = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
export const addDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return localDate(d) }
export const daysBetween = (from: string, to: string) => Math.round((new Date(to + 'T00:00:00').getTime() - new Date(from + 'T00:00:00').getTime()) / 86400000)
/** Срок следующего шага: просрочен — красный, сегодня — жёлтый. */
export function dueTone(d: Pick<Deal, 'stage' | 'next_step_at'>): 'red' | 'amber' | null {
  if (!isOpen(d.stage) || !d.next_step_at) return null
  const t = localDate()
  return d.next_step_at < t ? 'red' : d.next_step_at === t ? 'amber' : null
}
export const hasNextStep = (d: Pick<Deal, 'next_step' | 'next_step_at'>) => !!(d.next_step || '').trim() && !!d.next_step_at
export const dealTitle = (d: Pick<Deal, 'name' | 'company' | 'phone' | 'number'>) => d.company || d.name || d.phone || `Сделка №${d.number}`

// ── Выбор помещений ─────────────────────────────────────────────────────────
export function UnitStatus({ u }: { u: Pick<UnitLite, 'status'> }) {
  return u.status === 'free' ? <Badge tone="green">свободно</Badge> : <Badge tone="neutral">занято</Badge>
}

export function UnitPicker({ units, value, onChange }: { units: UnitLite[]; value: string[]; onChange: (ids: string[]) => void }) {
  const [q, setQ] = useState('')
  const [onlyFree, setOnlyFree] = useState(true)
  const s = q.trim().toLowerCase()
  const shown = units.filter(u => (value.includes(u.id) || !onlyFree || u.status === 'free') && (!s || u.number.toLowerCase().includes(s)))
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter(x => x !== id) : [...value, id])
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Номер помещения" style={{ flex: '1 1 140px', width: 'auto' }} />
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: C.muted, fontWeight: 400 }}>
          <input type="checkbox" checked={onlyFree} onChange={e => setOnlyFree(e.target.checked)} /> только свободные
        </label>
      </div>
      <div style={{ maxHeight: 200, overflowY: 'auto', border: `1px solid ${C.line}`, borderRadius: C.radiusSm }}>
        {shown.length === 0 && <div style={{ padding: 12, color: C.faint, fontSize: 13 }}>Ничего не найдено</div>}
        {shown.map(u => (
          <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px', borderBottom: `1px solid ${C.line}`, cursor: 'pointer', fontSize: 13, color: C.text, fontWeight: 400 }}>
            <input type="checkbox" checked={value.includes(u.id)} onChange={() => toggle(u.id)} />
            <span style={{ fontWeight: 500, minWidth: 48 }}>{u.number}</span>
            <span style={{ color: C.muted, flex: 1 }}>{u.floor ? `${u.floor} эт.` : ''}{u.area ? ` · ${num(u.area, 1)} м²` : ''}</span>
            <UnitStatus u={u} />
          </label>
        ))}
      </div>
      {value.length > 0 && <div style={{ fontSize: 12, color: C.muted, fontWeight: 400 }}>
        Выбрано: {value.map(id => units.find(u => u.id === id)?.number).filter(Boolean).join(', ')}
        {' · '}{num(value.reduce((s, id) => s + Number(units.find(u => u.id === id)?.area || 0), 0), 1)} м²
      </div>}
    </div>
  )
}

// ── Форма сделки: создание и правка карточки ────────────────────────────────
const grid2: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: 12 }

/** Новая сделка (deal = null) или правка контакта, источника, помещений и заметок. */
export function DealFormModal({ deal, units, people, me, onClose, onSaved }: {
  deal: Deal | null; units: UnitLite[]; people: Person[]; me: string | null; onClose: () => void; onSaved: (id: string) => void
}) {
  const [f, setF] = useState({
    name: deal?.name || '', company: deal?.company || '', phone: deal?.phone || '', email: deal?.email || '',
    source: deal?.source || 'call', source_detail: deal?.source_detail || '',
    area_wanted: deal?.area_wanted != null ? String(deal.area_wanted) : '', budget: deal?.budget != null ? String(deal.budget) : '', notes: deal?.notes || '',
    next_step: 'Связаться с клиентом', next_step_at: localDate(), owner_id: me || '',
  })
  const [unitIds, setUnitIds] = useState<string[]>(deal?.deal_units?.map(x => x.unit_id) || [])
  const [err, setErr] = useState('')
  const set = (k: keyof typeof f, v: string) => setF(x => ({ ...x, [k]: v }))
  const isNew = !deal
  const area = useMemo(() => unitIds.reduce((s, id) => s + Number(units.find(u => u.id === id)?.area || 0), 0), [unitIds, units])

  const saveA = useAction(async (row: TablesUpdate<'deals'>): Promise<string> => {
    let id: string
    if (!deal) {
      const ins: TablesInsert<'deals'> = { ...row, kind: 'new', stage: 'new', next_step: f.next_step.trim(), next_step_at: f.next_step_at, owner_id: f.owner_id || null }
      const { data, error } = await supabase.from('deals').insert(ins).select('id').single()
      if (error) throw new Error(dbError(error))
      id = data.id
    } else {
      const { error } = await supabase.from('deals').update(row).eq('id', deal.id)
      if (error) throw new Error(dbError(error))
      id = deal.id
    }
    // помещения: добавить новые, убрать снятые
    const before = deal?.deal_units?.map(x => x.unit_id) || []
    const add = unitIds.filter(x => !before.includes(x)), del = before.filter(x => !unitIds.includes(x))
    if (add.length) {
      const { error } = await supabase.from('deal_units').insert(add.map(unit_id => ({ deal_id: id, unit_id })))
      if (error) throw new Error('Сделка сохранена, но помещения не привязались: ' + error.message)
    }
    if (del.length) {
      const { error } = await supabase.from('deal_units').delete().eq('deal_id', id).in('unit_id', del)
      if (error) throw new Error('Сделка сохранена, но помещения не сняты: ' + error.message)
    }
    return id
  }, { invalidate: ['deals', 'deal_units', 'deal_events'], onSuccess: id => onSaved(id) })
  const busy = saveA.isPending

  function save() {
    if (!f.name.trim() && !f.company.trim() && !f.phone.trim()) { setErr('Укажите контакт: имя, компанию или телефон.'); return }
    if (isNew && (!f.next_step.trim() || !f.next_step_at)) { setErr('Следующий шаг и дата обязательны.'); return }
    const n = (s: string) => { const v = Number(s.replace(',', '.').replace(/\s/g, '')); return s.trim() && Number.isFinite(v) ? v : null }
    if (f.area_wanted.trim() && n(f.area_wanted) === null) { setErr('Площадь — число, м².'); return }
    if (f.budget.trim() && n(f.budget) === null) { setErr('Бюджет — число, ₽ в месяц.'); return }
    setErr('')
    saveA.mutate({
      name: f.name.trim() || null, company: f.company.trim() || null, phone: f.phone.trim() || null, email: f.email.trim() || null,
      source: f.source, source_detail: f.source_detail.trim() || null,
      area_wanted: n(f.area_wanted) ?? (isNew && area ? area : null), budget: n(f.budget), notes: f.notes.trim() || null,
    })
  }

  return (
    <Modal title={isNew ? 'Новая сделка' : `Сделка №${deal.number}: контакт и запрос`} onClose={onClose} width={640} footer={<>
      <Button onClick={onClose}>Отмена</Button>
      <Button kind="primary" disabled={busy} onClick={save}>{busy ? 'Сохраняю…' : isNew ? 'Создать сделку' : 'Сохранить'}</Button>
    </>}>
      {(err || saveA.error) && <Notice tone="red">{err || saveA.error}</Notice>}
      <div style={grid2}>
        <Field label="Контактное лицо"><Input value={f.name} onChange={e => set('name', e.target.value)} autoFocus={isNew} /></Field>
        <Field label="Компания"><Input value={f.company} onChange={e => set('company', e.target.value)} /></Field>
        <Field label="Телефон"><Input type="tel" value={f.phone} onChange={e => set('phone', e.target.value)} placeholder="+7…" /></Field>
        <Field label="Почта"><Input type="email" value={f.email} onChange={e => set('email', e.target.value)} /></Field>
        <Field label="Источник">
          <Select value={f.source} onChange={e => set('source', e.target.value)}>
            {(deal?.source === 'tenant' ? SOURCES : MANUAL_SOURCES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </Select>
        </Field>
        <Field label="Откуда подробнее" hint="Реклама, страница сайта, кто порекомендовал"><Input value={f.source_detail} onChange={e => set('source_detail', e.target.value)} /></Field>
      </div>
      <Field label="Помещения, которые интересуют"><UnitPicker units={units} value={unitIds} onChange={setUnitIds} /></Field>
      <div style={grid2}>
        <Field label="Нужная площадь, м²" hint={!f.area_wanted && area ? `По выбранным помещениям: ${num(area, 1)} м²` : undefined}>
          <Input inputMode="decimal" value={f.area_wanted} onChange={e => set('area_wanted', e.target.value)} />
        </Field>
        <Field label="Бюджет, ₽ в месяц"><Input inputMode="decimal" value={f.budget} onChange={e => set('budget', e.target.value)} /></Field>
      </div>
      <Field label="Заметки"><Textarea value={f.notes} onChange={e => set('notes', e.target.value)} style={{ minHeight: 60 }} /></Field>
      {isNew && <>
        <div style={grid2}>
          <Field label="Следующий шаг *"><Input value={f.next_step} onChange={e => set('next_step', e.target.value)} /></Field>
          <Field label="Когда *"><Input type="date" value={f.next_step_at} onChange={e => set('next_step_at', e.target.value)} /></Field>
        </div>
        <Field label="Ответственный">
          <Select value={f.owner_id} onChange={e => set('owner_id', e.target.value)}>
            <option value="">Не назначен</option>
            {people.map(p => <option key={p.user_id} value={p.user_id}>{p.full_name || 'Без имени'}{p.user_id === me ? ' (я)' : ''}</option>)}
          </Select>
        </Field>
      </>}
    </Modal>
  )
}

/** Следующий шаг: текст, дата и быстрые даты. Используется при смене этапа и в карточке. */
export function NextStepFields({ step, at, onStep, onAt }: { step: string; at: string; onStep: (v: string) => void; onAt: (v: string) => void }) {
  const quick: [string, number][] = [['Сегодня', 0], ['Завтра', 1], ['Через 3 дня', 3], ['Через неделю', 7]]
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <Field label="Следующий шаг *"><Input value={step} onChange={e => onStep(e.target.value)} placeholder="Позвонить, показать помещение, отправить предложение…" /></Field>
      <Field label="Когда *"><Input type="date" value={at} onChange={e => onAt(e.target.value)} /></Field>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {quick.map(([l, n]) => <Button key={l} small kind={at === addDays(n) ? 'primary' : 'secondary'} onClick={() => onAt(addDays(n))}>{l}</Button>)}
      </div>
    </div>
  )
}

/** Загрузка справочников один раз на экран. */
const NO_UNITS: UnitLite[] = []
const NO_PEOPLE: Person[] = []
export function useCrmRefs() {
  const unitsQ = useSb(['units', 'lite'], loadUnits)
  const peopleQ = useSb(['profiles', 'people'], loadPeople)
  const meQ = useSb(['auth:me'], myId, { staleTime: Infinity })
  const error = unitsQ.error?.message || peopleQ.error?.message || meQ.error?.message || ''
  const reload = async () => { await Promise.all([unitsQ.refetch(), peopleQ.refetch(), meQ.refetch()]) }
  return { units: unitsQ.data || NO_UNITS, people: peopleQ.data || NO_PEOPLE, me: meQ.data ?? null, error, reload }
}
