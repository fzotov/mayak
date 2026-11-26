// Обход счётчиков с телефона: помещение → фото счётчика → распознанное показание → подтвердить.
// Показание сохраняется так же, как в «Счётчиках»: строка meter_readings с расходом, суммой и фото.
import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useSb, useAction, sb, errText } from '../lib/query'
import type { Tables } from '../lib/database.types'
import { apiFetch } from '../lib/api'
import { compressImage, blobToBase64 } from '../lib/photo'
import { TYPES, parseRecognizeMeter, type RecognizedMeter } from './Meters'
import { Page, Card, Button, Badge, Input, Segmented, Notice, Loading, ErrorBox, Empty, Muted, Sub, Row, money, num, monthRu, C } from '../components/ui'
import { Icon } from '../components/icons'

type Meter = Tables<'meters'>
type Unit = Pick<Tables<'units'>, 'id' | 'number' | 'floor' | 'tenant_id'>
type Reading = Pick<Tables<'meter_readings'>, 'meter_id' | 'period' | 'curr_value'>
interface Group { key: string; title: string; floor: number | null; tenant: string; meters: Meter[] }
interface Active { meter: Meter; blob: Blob | null; preview: string; value: string; recognized: number | null; notice: { tone: 'green' | 'amber' | 'neutral'; text: string } | null }

const COMMON = '__common'
const period = () => new Date().toISOString().slice(0, 7) + '-01'
const clean = (s?: string | null) => (s || '').toLowerCase().replace(/[^0-9a-zа-я]/gi, '')
const sameSerial = (a?: string | null, b?: string | null) => { const x = clean(a), y = clean(b); return !!x && !!y && (x === y || x.includes(y) || y.includes(x)) }
const big: React.CSSProperties = { width: '100%', padding: '12px 16px', fontSize: 15, minHeight: 46 }
const meterName = (m: Meter) => `${TYPES[m.type]?.label || m.type} № ${m.number || m.serial || '—'}`

export default function MeterRoundPage() {
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<'todo' | 'all'>('all')
  const [groupKey, setGroupKey] = useState<string | null>(null)

  const metersQ = useSb(['meters'], () => sb(supabase.from('meters').select('*')))
  const unitsQ = useSb(['units', 'id,number,floor,tenant_id'], () => sb(supabase.from('units').select('id, number, floor, tenant_id')))
  const tenantsQ = useSb(['tenants', 'id,full_name'], () => sb(supabase.from('tenants').select('id, full_name')))
  const doneQ = useSb(['meter_readings', 'period', period()], () => sb(supabase.from('meter_readings').select('meter_id').eq('period', period())))
  const all = [metersQ, unitsQ, tenantsQ, doneQ]
  const loading = all.some(x => x.isPending)
  const loadErr = all.find(x => x.error)?.error
  const error = loadErr ? 'Не удалось загрузить счётчики: ' + loadErr.message : ''
  const load = () => { for (const x of all) x.refetch() }

  const meters: Meter[] = useMemo(() => metersQ.data ?? [], [metersQ.data])
  const units: Unit[] = useMemo(() => unitsQ.data ?? [], [unitsQ.data])
  const tenants = useMemo<Record<string, string>>(() => Object.fromEntries((tenantsQ.data ?? []).map(x => [x.id, x.full_name])), [tenantsQ.data])
  // Снятые за месяц: из базы плюс сохранённые только что (до обновления запроса).
  const doneIds = useMemo(() => {
    const ids = new Set(savedIds)
    for (const r of doneQ.data ?? []) if (r.meter_id) ids.add(r.meter_id)
    return ids
  }, [doneQ.data, savedIds])

  const groups = useMemo<Group[]>(() => {
    const byUnit = new Map<string, Meter[]>()
    for (const m of meters) {
      const k = m.unit_id && units.some(u => u.id === m.unit_id) ? m.unit_id : COMMON
      byUnit.set(k, [...(byUnit.get(k) || []), m])
    }
    const out: Group[] = []
    for (const [k, ms] of byUnit) {
      const u = units.find(x => x.id === k)
      const tid = u?.tenant_id || ms.find(x => x.tenant_id)?.tenant_id || null
      out.push({
        key: k, title: u ? 'Помещение ' + u.number : 'Общие и без помещения', floor: u?.floor ?? null,
        tenant: k === COMMON ? '' : (tid && tenants[tid]) || '', meters: ms,
      })
    }
    return out.sort((a, b) => a.key === COMMON ? 1 : b.key === COMMON ? -1 : a.title.localeCompare(b.title, 'ru', { numeric: true }))
  }, [meters, units, tenants])

  const isDone = (g: Group) => g.meters.every(m => doneIds.has(m.id))
  const shown = groups.filter(g => (filter === 'all' || !isDone(g)) && (!q || (g.title + ' ' + g.tenant).toLowerCase().includes(q.toLowerCase().trim())))
  const doneCount = meters.filter(m => doneIds.has(m.id)).length
  const group = groupKey ? groups.find(g => g.key === groupKey) : null

  if (loading) return <Page><Loading /></Page>

  if (group) return (
    <UnitRound key={group.key} group={group} doneIds={doneIds}
      onSaved={id => setSavedIds(s => new Set(s).add(id))}
      onBack={() => setGroupKey(null)}
      onNext={() => {
        const i = groups.findIndex(g => g.key === group.key)
        const next = [...groups.slice(i + 1), ...groups.slice(0, i)].find(g => !g.meters.every(m => doneIds.has(m.id)))
        setGroupKey(next ? next.key : null)
      }} />
  )

  return (
    <Page>
      {error && <ErrorBox error={error} onRetry={load} />}
      <Card>
        <div style={{ display: 'grid', gap: 8 }}>
          <Row justify="space-between">
            <span style={{ fontWeight: 600 }}>{monthRu(period())}</span>
            <Muted>снято {doneCount} из {meters.length}</Muted>
          </Row>
          <div style={{ height: 6, background: C.hover, borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ width: `${meters.length ? (doneCount / meters.length) * 100 : 0}%`, height: '100%', background: doneCount === meters.length && meters.length ? C.green : C.accent }} />
          </div>
        </div>
      </Card>
      <div style={{ display: 'grid', gap: 8 }}>
        <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Номер помещения или арендатор"
          style={{ width: '100%', boxSizing: 'border-box', border: `1px solid ${C.line}`, borderRadius: C.radiusSm, padding: '11px 12px', fontSize: 16, background: C.card, color: C.text, fontFamily: 'inherit', outline: 'none' }} />
        <div><Segmented<'todo' | 'all'> value={filter} onChange={setFilter} options={[['all', 'Все помещения'], ['todo', 'Не снятые']]} /></div>
      </div>
      {meters.length === 0 ? <Card><Empty>Счётчики не заведены — добавьте их в разделе «Счётчики».</Empty></Card>
        : shown.length === 0 ? <Card><Empty>{filter === 'todo' && !q ? 'Все счётчики за этот месяц сняты' : 'Ничего не найдено'}</Empty></Card>
        : (
          <div style={{ display: 'grid', gap: 8 }}>
            {shown.map(g => {
              const done = g.meters.filter(m => doneIds.has(m.id)).length
              const all = done === g.meters.length
              return (
                <button key={g.key} type="button" onClick={() => setGroupKey(g.key)} style={{
                  display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', padding: '12px 14px', minHeight: 56,
                  background: C.card, border: `1px solid ${all ? C.green : C.line}`, borderRadius: C.radius, cursor: 'pointer', fontFamily: 'inherit', color: C.text,
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>{g.title}{g.floor != null && <span style={{ color: C.faint, fontWeight: 400 }}> · {g.floor} эт.</span>}</div>
                    <div style={{ fontSize: 13, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.tenant || (g.key === COMMON ? 'общие счётчики здания' : 'свободно')}</div>
                  </div>
                  {all ? <Badge tone="green">готово</Badge> : <Badge tone={done ? 'amber' : 'neutral'}>{done} из {g.meters.length}</Badge>}
                </button>
              )
            })}
          </div>
        )}
    </Page>
  )
}

// ── Одно помещение ──────────────────────────────────────────────────────────
function UnitRound({ group, doneIds, onSaved, onBack, onNext }: { group: Group; doneIds: Set<string>; onSaved: (meterId: string) => void; onBack: () => void; onNext: () => void }) {
  const [active, setActive] = useState<Active | null>(null)
  const [busy, setBusy] = useState<'' | 'recognize' | 'save'>('')
  const [msg, setMsg] = useState<{ tone: 'green' | 'red' | 'amber'; text: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const shootFor = useRef<Meter | null>(null)
  const p = period()

  const meterIds = group.meters.map(m => m.id)
  const readingsQ = useSb(['meter_readings', 'round', ...meterIds], () => sb(supabase.from('meter_readings').select('meter_id, period, curr_value')
    .in('meter_id', meterIds).order('period', { ascending: false }).order('created_at', { ascending: false })))
  const loading = readingsQ.isPending
  const error = readingsQ.error ? 'Не удалось загрузить показания: ' + readingsQ.error.message : ''
  const loadReadings = () => { readingsQ.refetch() }
  // Последнее показание до этого месяца и показание этого месяца по каждому счётчику.
  const { last, current } = useMemo(() => {
    const prev: Record<string, Reading> = {}, cur: Record<string, Reading> = {}
    for (const r of readingsQ.data ?? []) {
      if (!r.meter_id) continue
      if (r.period?.slice(0, 7) === p.slice(0, 7)) { if (!cur[r.meter_id]) cur[r.meter_id] = r }
      else if (!prev[r.meter_id]) prev[r.meter_id] = r
    }
    return { last: prev, current: cur }
  }, [readingsQ.data, p])

  const saveReading = useAction(async (v: { m: Meter; blob: Blob | null; prevValue: number; value: number; consumption: number; amount: number; recognized: boolean }) => {
    let photo_url: string | null = null
    let photoFailed = false
    if (v.blob) {
      const path = `${v.m.id}/${p.slice(0, 7)}-${Date.now()}.jpg`
      const { error: upErr } = await supabase.storage.from('meter-photos').upload(path, v.blob, { upsert: true, contentType: 'image/jpeg' })
      if (!upErr) photo_url = supabase.storage.from('meter-photos').getPublicUrl(path).data.publicUrl
      else photoFailed = true
    }
    await sb(supabase.from('meter_readings').insert({
      meter_id: v.m.id, period: p, prev_value: v.prevValue, curr_value: v.value, consumption: v.consumption, amount: v.amount, notes: '',
      reading: v.value, previous_reading: v.prevValue, reading_date: new Date().toISOString().slice(0, 10),
      recognized_by_ai: v.recognized,
      ...(photo_url ? { photo_url } : {}),
    }))
    return { photoFailed }
  }, { invalidate: ['meter_readings', 'meters'] })
  useEffect(() => () => { if (active?.preview) URL.revokeObjectURL(active.preview) }, [active?.preview])

  const done = (m: Meter) => doneIds.has(m.id) || !!current[m.id]
  const todo = group.meters.filter(m => !done(m))
  const nextMeter = todo[0] || null

  function shoot(m: Meter | null) {
    shootFor.current = m
    setMsg(null)
    fileRef.current?.click()
  }

  async function onPhoto(file: File) {
    setBusy('recognize'); setMsg(null)
    const tapped = shootFor.current
    let blob: Blob = file
    try { blob = await compressImage(file) } catch { /* отправим как есть */ }
    const preview = URL.createObjectURL(blob)
    let target: Meter | null = tapped
    let recognized: number | null = null
    let notice: Active['notice'] = null
    try {
      const res = await apiFetch('/api/recognize-meter', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: await blobToBase64(blob), meterNumbers: group.meters.map(m => m.serial || m.number).filter(Boolean), mediaType: blob.type || 'image/jpeg' }),
      })
      const found: RecognizedMeter[] = parseRecognizeMeter(await res.json().catch(() => null))
      // какой из счётчиков помещения на фото: по серийному номеру, иначе тот, что выбрали
      let hit: { m: Meter; r: RecognizedMeter } | null = null
      for (const r of found) {
        const m = group.meters.find(x => sameSerial(x.serial, r.serial) || sameSerial(x.number, r.serial))
        if (m && (!hit || (tapped && m.id === tapped.id))) hit = { m, r }
      }
      const best = hit?.r || found[0]
      if (hit) {
        if (tapped && hit.m.id !== tapped.id) notice = { tone: 'amber', text: `На фото другой счётчик: ${meterName(hit.m)}. Показание записываем к нему.` }
        else notice = { tone: 'green', text: `Серийный номер ${hit.r.serial} совпал.` }
        target = hit.m
      } else if (best?.serial) {
        notice = { tone: 'amber', text: `Серийный номер на фото (${best.serial}) не совпал со счётчиками помещения — проверьте, тот ли это счётчик.` }
      }
      if (best && typeof best.reading === 'number' && !isNaN(best.reading)) recognized = best.reading
      else notice = { tone: 'amber', text: (notice?.text ? notice.text + ' ' : '') + 'Показание не распознано — введите его вручную, фото сохранится.' }
    } catch {
      notice = { tone: 'amber', text: 'Распознавание не ответило — введите показание вручную, фото сохранится.' }
    }
    target = target || nextMeter || group.meters[0]
    setActive({ meter: target, blob, preview, value: recognized != null ? String(recognized) : '', recognized, notice })
    setBusy('')
  }

  async function confirm() {
    if (!active) return
    const m = active.meter
    const value = Number(active.value.replace(',', '.').replace(/\s/g, ''))
    const prevValue = Number(last[m.id]?.curr_value ?? 0)
    if (active.value.trim() === '' || isNaN(value)) { setMsg({ tone: 'red', text: 'Введите показание числом' }); return }
    if (value < prevValue) { setMsg({ tone: 'red', text: `Показание ${num(value, 3)} меньше предыдущего (${num(prevValue, 3)}). Проверьте цифры или переснимите счётчик.` }); return }
    setBusy('save'); setMsg(null)
    const consumption = Math.max(0, value - prevValue)
    const amount = m.type === 'heat' ? consumption * (m.heat_tariff || 0) * (m.area || 1) : consumption * (m.tariff || 0)
    let photoFailed: boolean
    try {
      ({ photoFailed } = await saveReading.mutateAsync({
        m, blob: active.blob, prevValue, value, consumption, amount, recognized: active.recognized != null && active.recognized === value,
      }))
    } catch (e) {
      setBusy('')
      setMsg({ tone: 'red', text: 'Показание не сохранено: ' + errText(e) })
      return
    }
    setBusy('')
    onSaved(m.id)
    setActive(null)
    const left = group.meters.filter(x => x.id !== m.id && !done(x))
    setMsg({ tone: photoFailed ? 'amber' : 'green', text: `Сохранено: ${meterName(m)} — ${num(value, 3)}.${photoFailed ? ' Фото не загрузилось.' : ''}${left.length ? ` Осталось: ${left.length}.` : ' Помещение готово.'}` })
  }

  const fileInput = <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
    onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onPhoto(f) }} />

  // ── Подтверждение показания ──
  if (active) {
    const m = active.meter
    const t = TYPES[m.type] || { label: m.type, unit: '' }
    const prevValue = Number(last[m.id]?.curr_value ?? 0)
    const value = Number(active.value.replace(',', '.').replace(/\s/g, ''))
    const valid = active.value.trim() !== '' && !isNaN(value)
    const consumption = valid ? Math.max(0, value - prevValue) : 0
    const amount = m.type === 'heat' ? consumption * (m.heat_tariff || 0) * (m.area || 1) : consumption * (m.tariff || 0)
    const below = valid && value < prevValue
    return (
      <Page>
        {fileInput}
        <div><Button kind="ghost" small style={{ paddingLeft: 0 }} onClick={() => { setActive(null); setMsg(null) }}>Назад к счётчикам</Button></div>
        <Card>
          <div style={{ display: 'grid', gap: 12 }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 16 }}>{meterName(m)}</div>
              <Sub>{group.title}{group.tenant ? ' · ' + group.tenant : ''}</Sub>
            </div>
            {active.preview && <img src={active.preview} alt="Фото счётчика" style={{ width: '100%', maxHeight: 260, objectFit: 'contain', borderRadius: C.radiusSm, background: C.hover }} />}
            {active.notice && <Notice tone={active.notice.tone}>{active.notice.text}</Notice>}
            {group.meters.length > 1 && (
              <label style={{ display: 'grid', gap: 4, fontSize: 12, color: C.muted, fontWeight: 500 }}>Счётчик
                <select value={m.id} onChange={e => { const x = group.meters.find(y => y.id === e.target.value); if (x) setActive(a => a && { ...a, meter: x }) }}
                  style={{ width: '100%', border: `1px solid ${C.line}`, borderRadius: C.radiusSm, padding: '10px 12px', fontSize: 16, background: C.card, color: C.text, fontFamily: 'inherit' }}>
                  {group.meters.map(x => <option key={x.id} value={x.id}>{meterName(x)}{done(x) ? ' (уже снят)' : ''}</option>)}
                </select>
              </label>
            )}
            <label style={{ display: 'grid', gap: 4, fontSize: 12, color: C.muted, fontWeight: 500 }}>
              Показание{active.recognized != null ? ' (распознано, можно исправить)' : ''}
              <Input inputMode="decimal" autoComplete="off" value={active.value} onChange={e => setActive(a => a && { ...a, value: e.target.value })}
                style={{ fontSize: 26, fontWeight: 600, padding: '10px 12px', fontVariantNumeric: 'tabular-nums', borderColor: below ? C.red : undefined }} />
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, fontSize: 13 }}>
              <div><Muted small>Предыдущее</Muted><div style={{ fontWeight: 500 }}>{last[m.id] ? num(prevValue, 3) : '—'}</div></div>
              <div><Muted small>Расход</Muted><div style={{ fontWeight: 500 }}>{num(consumption, 3)} {t.unit}</div></div>
              <div><Muted small>Сумма</Muted><div style={{ fontWeight: 600 }}>{money(amount)}</div></div>
            </div>
            {below && <Notice tone="red">Меньше предыдущего показания ({num(prevValue, 3)}) — так сохранить нельзя. Проверьте цифры или переснимите.</Notice>}
            {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
            <Button kind="primary" style={big} disabled={busy !== '' || !valid || below} onClick={confirm}>{busy === 'save' ? 'Сохраняю…' : 'Подтвердить'}</Button>
            <Row gap={8}>
              <Button style={{ flex: 1, minHeight: 44 }} disabled={busy !== ''} onClick={() => shoot(m)}>{busy === 'recognize' ? 'Распознаю…' : 'Переснять'}</Button>
              <Button style={{ flex: 1, minHeight: 44 }} onClick={() => { setActive(null); setMsg(null) }}>Отмена</Button>
            </Row>
          </div>
        </Card>
      </Page>
    )
  }

  // ── Список счётчиков помещения ──
  return (
    <Page>
      {fileInput}
      <div><Button kind="ghost" small style={{ paddingLeft: 0 }} onClick={onBack}>К списку помещений</Button></div>
      <div>
        <div style={{ fontWeight: 600, fontSize: 18 }}>{group.title}</div>
        {group.tenant && <Muted>{group.tenant}</Muted>}
      </div>
      {error && <ErrorBox error={error} onRetry={loadReadings} />}
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      {busy === 'recognize' && <Notice>Распознаю показание…</Notice>}
      {loading ? <Loading /> : nextMeter ? (
        <Button kind="primary" style={big} disabled={busy !== ''} onClick={() => shoot(nextMeter)}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Icon name="meters" size={18} />Сфотографировать счётчик</span>
        </Button>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          <Notice tone="green">Все счётчики помещения сняты за {monthRu(p).toLowerCase()}.</Notice>
          <Button kind="primary" style={big} onClick={onNext}>Следующее помещение</Button>
        </div>
      )}
      {!loading && (
        <div style={{ display: 'grid', gap: 8 }}>
          {group.meters.map(m => {
            const isDone = done(m)
            const t = TYPES[m.type] || { label: m.type, unit: '' }
            return (
              <Card key={m.id}>
                <div style={{ display: 'grid', gap: 10 }}>
                  <Row justify="space-between" wrap={false} align="flex-start">
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600 }}>{t.label}</div>
                      <Sub>№ {m.number || m.serial || '—'}</Sub>
                    </div>
                    {isDone ? <Badge tone="green">снят</Badge> : m.id === nextMeter?.id ? <Badge tone="blue">следующий</Badge> : null}
                  </Row>
                  <div style={{ display: 'flex', gap: 16, fontSize: 13, flexWrap: 'wrap' }}>
                    <span><Muted small>Предыдущее </Muted>{last[m.id] ? num(last[m.id].curr_value, 3) : '—'}</span>
                    {current[m.id] && <span><Muted small>Сейчас </Muted><b>{num(current[m.id].curr_value, 3)}</b></span>}
                  </div>
                  {!isDone && (
                    <Row gap={8}>
                      <Button style={{ flex: 2, minHeight: 44 }} disabled={busy !== ''} onClick={() => shoot(m)}>Сфотографировать</Button>
                      <Button style={{ flex: 1, minHeight: 44 }} kind="ghost" disabled={busy !== ''} onClick={() => setActive({ meter: m, blob: null, preview: '', value: '', recognized: null, notice: null })}>Вручную</Button>
                    </Row>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </Page>
  )
}
