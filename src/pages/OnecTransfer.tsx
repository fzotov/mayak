// Переход с 1С (ТЗ v2, §5 «Этап 3»): загрузка выгрузки взаиморасчётов debts.xml, сопоставление арендаторов и договоров,
// входящие остатки с разбивкой по статьям, сверка «Маяк = 1С» до копейки и проведение остатков на дату перехода.
// Вся логика — в базе (supabase/migrations/20261201_onec.sql); экран только показывает и вызывает функции.
import { ask, notify } from '../components/Dialogs'
import { useMemo, useRef, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router'
import { supabase } from '../lib/supabase'
import { apiFetch } from '../lib/api'
import { loadArticles, type Article } from '../lib/accounting'
import { sb, sbRpc, useSb, useAction, useInvalidate } from '../lib/query'
import type { Json, Tables } from '../lib/database.types'
import { printAct } from './Settlements'
// Тот же разборщик, что и на сервере (api/onec-load.js): файл разбирается прямо в браузере. Типы — src/types/onecXml.d.ts.
import { parseDebtsXml, toStagePayload } from '../../api/_lib/onecXml.js'
import {
  Page, Card, Row, Button, Badge, Stat, Stats, Table, Field, Input, Select, Search, Segmented, Tabs, Modal, Notice, Loading, Empty,
  money, dateRu, dateTimeRu, today, C, type Col, type Tone,
} from '../components/ui'

// ── Типы строк из базы ──────────────────────────────────────────────────────
// status, source, match_by, kind в базе — текст с проверками; на экране сравниваются со строками.
type Imp = Tables<'onec_imports'>
type Cp = Tables<'onec_counterparties'> & { tenants: { full_name: string; inn: string | null } | null }
type Ct = Tables<'onec_contracts'>
// Функции базы возвращают строки, где часть полей бывает пустой (несопоставленный контрагент) — описываем это явно.
interface Line {
  cp_id: string; cp_name: string | null; tenant_id: string | null; tenant_name: string | null; contract_id: string; contract_name: string | null
  lease_id: string | null; doc_id: string; doc_label: string; kind: string; article_code: string | null
  article_name: string | null; amount: number; rule: string | null
}
interface Rec {
  tenant_id: string | null; tenant_name: string | null; cp_names: string | null; inn: string | null; onec_balance: number; onec_deposit: number
  mayak_balance: number; mayak_deposit: number; diff: number; diff_deposit: number; status: string
}
type Rule = Tables<'onec_article_rules'>
type Tenant = Pick<Tables<'tenants'>, 'id' | 'full_name' | 'inn' | 'id_1c' | 'status'>
type Lease = Pick<Tables<'leases'>, 'id' | 'tenant_id' | 'number' | 'start_date' | 'status'>
interface Missing { tenant_id: string; full_name: string; inn: string | null; id_1c: string | null; status: string | null; leases: number }
interface Skipped { cp: string; doc: string; amount: number; why: string }
interface PostResult { lines: number | null; skipped: Skipped[] }

type Tab = 'tenants' | 'contracts' | 'opening' | 'reconcile' | 'post'
const TABS: Tab[] = ['tenants', 'contracts', 'opening', 'reconcile', 'post']
type LineKind = 'charge' | 'advance' | 'deposit'
type RuleField = 'item' | 'contract' | 'doc_type' | 'account'

const STATUS: Record<string, [string, Tone]> = {
  staged: ['Загружено, не проведено', 'blue'], posted: ['Остатки проведены', 'green'], reversed: ['Отменено сторно', 'neutral'],
}
const SOURCE: Record<string, string> = { http: 'из 1С', file: 'файл', test: 'тест' }
const MATCH: Record<string, [string, Tone]> = {
  id_1c: ['по коду 1С', 'green'], inn: ['по ИНН', 'green'], manual: ['вручную', 'blue'], inn_ambiguous: ['ИНН у нескольких', 'amber'],
}
const LEASE_MATCH: Record<string, [string, Tone]> = { number: ['по номеру', 'green'], manual: ['вручную', 'blue'], created: ['создан из 1С', 'violet'] }
const KIND: Record<string, string> = { rent: 'Аренда', ad: 'Реклама', deposit: 'Обеспечение', service: 'Услуги', other: 'Прочее' }
const LINE_KIND: Record<string, string> = { charge: 'Долг', advance: 'Переплата', deposit: 'Депозит' }
const RULE_FIELD: Record<string, string> = { item: 'Номенклатура строки', contract: 'Наименование договора', doc_type: 'Вид документа', account: 'Счёт учёта' }
const REC_TONE: Record<string, Tone> = { 'совпадает': 'green', 'расхождение': 'red', 'нет в Маяке': 'amber', 'нет в 1С': 'amber' }

// Что обновить после записи (ключи запросов — см. src/lib/query.tsx).
const ONEC = ['onec_imports', 'onec_counterparties', 'onec_contracts', 'rpc:onec_opening_lines', 'rpc:onec_reconcile', 'rpc:onec_tenants_missing']
/** После проведения или сторно остатков меняется учёт: начисления, оплаты, проводки, депозиты и сальдо. */
const POSTED = [...ONEC, 'charges', 'payments', 'ledger_postings', 'allocations', 'deposit_operations', 'v_charge_state', 'v_payment_state', 'v_invoice_state', 'v_deposits', 'rpc:tenant_saldo', 'rpc:ledger_turnover']

const errText = (e: unknown) => String(e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String(e.message) : e).replace(/^.*?ERROR:\s*/, '')
const n = (v: number | string | null | undefined) => Number(v || 0)
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const nextMonthStart = () => { const d = new Date(); return iso(new Date(d.getFullYear(), d.getMonth() + 1, 1)) }
const signed = (v: number) => (v > 0 ? '+' : v < 0 ? '−' : '') + money(Math.abs(v))
const cpTitle = (c: Pick<Cp, 'name' | 'inn' | 'kpp'>) => (c.name || '—')

const isObj = (j: Json | null | undefined): j is { [key: string]: Json | undefined } => !!j && typeof j === 'object' && !Array.isArray(j)
const str = (j: Json | undefined) => (typeof j === 'string' ? j : j == null ? '' : String(j))
/** Версия выгрузки из meta загрузки ('2' — со строками номенклатуры). */
const metaVersion = (imp: Imp) => (isObj(imp.meta) && typeof imp.meta.version === 'string' ? imp.meta.version : undefined)
/** Итог проведения из onec_opening_post / onec_imports.post_result. */
function asPostResult(j: Json | null | undefined): PostResult {
  if (!isObj(j)) return { lines: null, skipped: [] }
  const sk = Array.isArray(j.skipped) ? j.skipped : []
  return {
    lines: typeof j.lines === 'number' ? j.lines : null,
    skipped: sk.filter(isObj).map(x => ({ cp: str(x.cp), doc: str(x.doc), amount: Number(x.amount) || 0, why: str(x.why) })),
  }
}


type Paged<T> = { range(from: number, to: number): PromiseLike<{ data: T[] | null; error: { message: string } | null }> }
/** Все строки запроса страницами по 1000 (столько отдаёт база за раз). */
async function fetchAll<T>(make: () => Paged<T>): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await make().range(from, from + 999)
    if (error) throw new Error(errText(error))
    out.push(...(data || []))
    if (!data || data.length < 1000) return out
  }
}

/** Текст файла: UTF-8, а если не читается — windows-1251 (так 1С иногда сохраняет). */
async function readXmlText(file: File): Promise<string> {
  const buf = await file.arrayBuffer()
  const head = new TextDecoder('ascii').decode(buf.slice(0, 200))
  if (/encoding=["'](windows-1251|cp1251)["']/i.test(head)) return new TextDecoder('windows-1251').decode(buf)
  try { return new TextDecoder('utf-8', { fatal: true }).decode(buf) }
  catch { return new TextDecoder('windows-1251').decode(buf) }
}

/** Ответ /api/onec-load. */
interface OnecLoadReply { ok?: boolean; error?: string; importId?: string; totals?: { counterparties?: number; matched?: number } }

export default function OnecTransferPage() {
  const [params, setParams] = useSearchParams()
  const tab: Tab = TABS.includes(params.get('tab') as Tab) ? params.get('tab') as Tab : 'tenants'
  const setQuery = (patch: Record<string, string | null>) => setParams(p => {
    const q = new URLSearchParams(p)
    for (const [k, v] of Object.entries(patch)) { if (v) q.set(k, v); else q.delete(k) }
    return q
  }, { replace: true })

  const invalidate = useInvalidate()
  const [msg, setMsg] = useState<{ tone: 'green' | 'red' | 'amber'; text: ReactNode } | null>(null)
  const [busy, setBusy] = useState<'http' | 'file' | null>(null)
  const [asOf, setAsOf] = useState('')
  // дата сверки выбирается для конкретной загрузки; по умолчанию — дата перехода или дата выгрузки
  const [recPick, setRecPick] = useState<{ imp: string; date: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const importsQ = useSb(['onec_imports', 'list'], () => sb(supabase.from('onec_imports').select('*').order('created_at', { ascending: false }).limit(100)))
  const articlesQ = useSb(['accounting_articles', 'onec'], loadArticles)
  const ownerQ = useSb(['profiles', 'me', 'is-owner'], async () => {
    const { data } = await supabase.auth.getUser()
    if (!data.user) return false
    const p = await sb(supabase.from('profiles').select('role').eq('user_id', data.user.id).maybeSingle())
    return (p as { role: string } | null)?.role === 'owner'
  })
  const imports = importsQ.data ?? (importsQ.error ? [] : null)
  const articles = articlesQ.data ?? []
  const isOwner = ownerQ.data ?? false

  const impId = params.get('import') || imports?.[0]?.id || ''
  const imp = imports?.find(i => i.id === impId) || null
  const curId = imp?.id || ''

  // данные выбранной загрузки
  const cpsQ = useSb(['onec_counterparties', curId], () => fetchAll<Cp>(() => supabase.from('onec_counterparties').select('*, tenants(full_name, inn)').eq('import_id', curId).order('name').order('cp_id')), { enabled: !!curId })
  const ctsQ = useSb(['onec_contracts', curId], () => fetchAll<Ct>(() => supabase.from('onec_contracts').select('*').eq('import_id', curId).order('cp_id').order('contract_id')), { enabled: !!curId })
  const tenantsQ = useSb(['tenants', 'onec-list'], () => fetchAll<Tenant>(() => supabase.from('tenants').select('id, full_name, inn, id_1c, status').order('full_name').order('id')), { enabled: !!curId })
  const cps = useMemo(() => cpsQ.data ?? [], [cpsQ.data])
  const cts = useMemo(() => ctsQ.data ?? [], [ctsQ.data])
  const tenants = useMemo(() => tenantsQ.data ?? [], [tenantsQ.data])
  const tenantIds = useMemo(() => [...new Set(cps.flatMap(c => (c.tenant_id ? [c.tenant_id] : [])))].sort(), [cps])
  const leasesQ = useSb(['leases', 'onec', tenantIds.join(',')], async () => {
    const ls: Lease[] = []
    for (let i = 0; i < tenantIds.length; i += 200) {
      const part = tenantIds.slice(i, i + 200)
      ls.push(...await fetchAll<Lease>(() => supabase.from('leases').select('id, tenant_id, number, start_date, status').in('tenant_id', part).order('start_date').order('id')))
    }
    return ls
  }, { enabled: cpsQ.isSuccess })
  const leases = leasesQ.data ?? []
  const loadingImp = !!curId && (cpsQ.isPending || ctsQ.isPending || tenantsQ.isPending || (cpsQ.isSuccess && leasesQ.isPending))

  const linesQ = useSb(['rpc:onec_opening_lines', curId], () => fetchAll<Line>(() => supabase.rpc('onec_opening_lines', { p_import: curId })), { enabled: !!curId })
  const lines: Line[] | null = linesQ.error ? [] : linesQ.data ?? null
  const linesErr = linesQ.error ? errText(linesQ.error) : null

  const recDate = recPick && recPick.imp === curId ? recPick.date : imp ? imp.transition_date || imp.as_of || today() : ''
  const setRecDate = (date: string) => setRecPick({ imp: curId, date })
  const recQ = useSb(['rpc:onec_reconcile', curId, recDate], () => fetchAll<Rec>(() => supabase.rpc('onec_reconcile', { p_import: curId, p_date: recDate })),
    { enabled: !!curId && !!recDate, placeholderData: prev => prev })
  // пока считается сальдо на новую дату — «Считаем сальдо…», как раньше
  const rec: Rec[] | null = recQ.error ? [] : (recQ.isPlaceholderData && recQ.isFetching) || (!recQ.data && !!recDate) ? null : recQ.data ?? null
  const recErr = recQ.error ? errText(recQ.error) : null

  const loadErr = importsQ.error || articlesQ.error || cpsQ.error || ctsQ.error || tenantsQ.error || leasesQ.error
  const error = loadErr ? errText(loadErr) : null

  // ── Загрузка выгрузки ──
  async function loadFrom1c() {
    setBusy('http'); setMsg(null)
    try {
      const r = await apiFetch('/api/onec-load', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(asOf ? { asOf } : {}) })
      const raw = await r.text()
      let j: OnecLoadReply | null = null
      try { j = JSON.parse(raw) as OnecLoadReply } catch { /* сервер ответил не JSON (например, таймаут шлюза) */ }
      if (!r.ok || !j?.ok) {
        const timeout = r.status === 504 || /таймаут|timeout|504/i.test(j?.error || raw)
        throw new Error(timeout
          ? '1С не успела сформировать выгрузку (ответ 504, таймаут). Выгрузку нужно доработать на стороне 1С — задание для программиста 1С в docs/1c-export-v2.md. Пока можно загрузить файл debts.xml вручную.'
          : (j?.error || `Сервер ответил ${r.status}`))
      }
      setMsg({ tone: 'green', text: <>Выгрузка из 1С загружена: контрагентов {j.totals?.counterparties ?? '—'}, сопоставлено {j.totals?.matched ?? '—'}.</> })
      await invalidate(...ONEC); setQuery({ import: j.importId || null, tab: 'tenants' })
    } catch (e) { setMsg({ tone: 'red', text: errText(e) }) }
    setBusy(null)
  }
  async function loadFile(file: File) {
    setBusy('file'); setMsg(null)
    try {
      const text = await readXmlText(file)
      const parsed = parseDebtsXml(text)
      if (!parsed.counterparties.length) throw new Error('В файле нет ни одного контрагента')
      const id = await sbRpc('onec_stage', { p: toStagePayload(parsed, 'file') })
      const v2 = parsed.meta?.version === '2'
      setMsg({ tone: v2 ? 'green' : 'amber', text: <>Файл {file.name} загружен: контрагентов {parsed.counterparties.length}, выгрузка на {dateRu(parsed.meta?.asOf)}.
        {!v2 && ' Это выгрузка старого формата (без номенклатуры строк) — долги по договорам аренды не разобьются по статьям.'}</> })
      await invalidate(...ONEC); setQuery({ import: id, tab: 'tenants' })
    } catch (e) { setMsg({ tone: 'red', text: errText(e) }) }
    setBusy(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  // ── Сводка для плашек ──
  const ctsWithTenant = useMemo(() => {
    const t = new Map(cps.map(c => [c.cp_id, c]))
    return cts.map(c => ({ ...c, cp: t.get(c.cp_id) || null }))
  }, [cps, cts])
  const matched = cps.filter(c => c.tenant_id).length
  const ctsMatchable = ctsWithTenant.filter(c => c.cp?.tenant_id)
  const ctsLinked = ctsMatchable.filter(c => c.lease_id).length
  const openingSum = (lines || []).filter(l => l.kind === 'charge' && l.article_code === 'OPENING').reduce((s, l) => s + n(l.amount), 0)
  const recBad = (rec || []).filter(r => r.status !== 'совпадает').length

  const chip = (label: ReactNode, tone: Tone, to: Tab) => (
    <button type="button" onClick={() => setQuery({ tab: to })} style={{ border: 0, background: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit' }}>
      <Badge tone={tone}>{label}</Badge>
    </button>
  )

  if (!imports) return <Loading />

  return (
    <Page title="Переход с 1С" actions={<>
      <input ref={fileRef} type="file" accept=".xml,text/xml,application/xml" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && loadFile(e.target.files[0])} />
      <Button disabled={!!busy} onClick={() => fileRef.current?.click()}>{busy === 'file' ? 'Разбираем файл…' : 'Загрузить файл debts.xml'}</Button>
      <Button kind="primary" disabled={!!busy} onClick={loadFrom1c}>{busy === 'http' ? 'Ждём 1С…' : 'Загрузить из 1С'}</Button>
    </>}>
      <Notice>Маяк становится главным по расчётам с арендаторами. Порядок: загрузить выгрузку взаиморасчётов из 1С → сопоставить арендаторов и договоры →
        проверить разбивку остатков по статьям → провести остатки на дату перехода → сверить сальдо с 1С до копейки. Арендаторы автоматически не создаются.</Notice>
      <Row gap={12} align="end">
        <Field label="Выгрузка из 1С на дату (необязательно)"><Input type="date" value={asOf} onChange={e => setAsOf(e.target.value)} style={{ width: 170 }} /></Field>
        {imports.length > 0 && (
          <Field label="Загрузка">
            <Select value={impId} onChange={e => setQuery({ import: e.target.value })} style={{ minWidth: 0, maxWidth: 420 }}>
              {imports.map(i => (
                <option key={i.id} value={i.id}>
                  {dateTimeRu(i.created_at)} · {SOURCE[i.source] || i.source} · на {dateRu(i.as_of)} · {STATUS[i.status]?.[0] || i.status}
                </option>
              ))}
            </Select>
          </Field>
        )}
      </Row>
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      {error && <Notice tone="red">{error}</Notice>}

      {!imp ? (
        <Card><Empty>Загрузок ещё не было. Нажмите «Загрузить из 1С» или загрузите файл debts.xml, выгруженный из 1С.</Empty></Card>
      ) : (
        <>
          <Row gap={6}>
            <Badge tone={STATUS[imp.status]?.[1] || 'neutral'}>{STATUS[imp.status]?.[0] || imp.status}{imp.transition_date ? ` на ${dateRu(imp.transition_date)}` : ''}</Badge>
            {chip(`Арендаторы: сопоставлено ${matched} из ${cps.length}`, matched === cps.length && cps.length ? 'green' : 'amber', 'tenants')}
            {chip(`Договоры: с парой ${ctsLinked} из ${ctsMatchable.length}`, ctsLinked === ctsMatchable.length ? 'green' : 'amber', 'contracts')}
            {chip(lines === null ? 'Без разбивки: …' : `Без разбивки: ${money(openingSum)}`, openingSum > 0 ? 'amber' : 'green', 'opening')}
            {chip(rec === null ? 'Сверка: …' : `Расхождений: ${recBad}`, recBad ? 'red' : 'green', 'reconcile')}
            {metaVersion(imp) !== '2' && <Badge tone="neutral">выгрузка v{metaVersion(imp) || '1'}</Badge>}
          </Row>
          <Tabs<Tab> value={tab} onChange={t => setQuery({ tab: t })} tabs={[
            ['tenants', 'Арендаторы'], ['contracts', 'Договоры'], ['opening', 'Остатки'], ['reconcile', 'Сверка'], ...(isOwner ? [['post', 'Проведение'] as [Tab, string]] : []),
          ]} />
          {loadingImp && <Loading />}
          {!loadingImp && tab === 'tenants' && <TenantsTab imp={imp} cps={cps} tenants={tenants} />}
          {!loadingImp && tab === 'contracts' && <ContractsTab imp={imp} rows={ctsWithTenant} leases={leases} isOwner={isOwner} />}
          {tab === 'opening' && <OpeningTab lines={lines} error={linesErr} articles={articles} isOwner={isOwner} />}
          {tab === 'reconcile' && <ReconcileTab rows={rec} error={recErr} date={recDate} articles={articles} tenants={tenants}
            onDate={setRecDate} />}
          {tab === 'post' && (isOwner
            ? <PostTab imp={imp} lines={lines} />
            : <Notice tone="amber">Проведение остатков доступно только владельцу.</Notice>)}
        </>
      )}
    </Page>
  )
}

// ── 1. Арендаторы ───────────────────────────────────────────────────────────
function TenantsTab({ imp, cps, tenants }: { imp: Imp; cps: Cp[]; tenants: Tenant[] }) {
  const [filter, setFilter] = useState<'all' | 'unmatched'>(() => cps.some(c => !c.tenant_id) ? 'unmatched' : 'all')
  const [q, setQ] = useState('')
  const [pick, setPick] = useState<Cp | null>(null)
  const missingQ = useSb(['rpc:onec_tenants_missing', imp.id], () => fetchAll<Missing>(() => supabase.rpc('onec_tenants_missing', { p_import: imp.id })))
  const missing: Missing[] | null = missingQ.error ? [] : missingQ.data ?? null
  const missingErr = missingQ.error ? errText(missingQ.error) : null
  // привязка пишет код 1С в карточку арендатора
  const linkA = useAction((a: { cp: Cp; tenantId: string | null }) => sbRpc('onec_link_tenant', { p_import: imp.id, p_cp: a.cp.cp_id, p_tenant: a.tenantId }),
    { invalidate: [...ONEC, 'tenants'], onSuccess: () => setPick(null) })
  const err = linkA.error ? errText(linkA.error) : null

  const rows = cps.filter(c => (filter === 'all' || !c.tenant_id || c.match_by === 'inn_ambiguous')
    && (!q || `${c.name} ${c.inn} ${c.tenants?.full_name}`.toLowerCase().includes(q.toLowerCase())))

  const link = (cp: Cp, tenantId: string | null) => linkA.mutate({ cp, tenantId })

  const cols: Col<Cp>[] = [
    { key: 'n', title: 'Контрагент 1С', sort: c => c.name || '', render: c => <><div>{cpTitle(c)}</div><div style={{ fontSize: 12, color: C.faint }}>{c.inn ? 'ИНН ' + c.inn : 'без ИНН'}{c.kpp ? ' · КПП ' + c.kpp : ''}</div></> },
    { key: 't', title: 'Арендатор Маяка', sort: c => c.tenants?.full_name || '', render: c => c.tenant_id
      ? <><div><a href={'/tenants/' + c.tenant_id} style={{ color: C.accent, textDecoration: 'none' }}>{c.tenants?.full_name || 'арендатор'}</a></div>
          <div style={{ marginTop: 2 }}>{c.match_by && MATCH[c.match_by] && <Badge tone={MATCH[c.match_by][1]}>{MATCH[c.match_by][0]}</Badge>}</div></>
      : <Badge tone={c.match_by === 'inn_ambiguous' ? 'amber' : 'red'}>{c.match_by === 'inn_ambiguous' ? 'ИНН у нескольких арендаторов' : 'не сопоставлен'}</Badge> },
    { key: 'd', title: 'Долг', align: 'right', sort: c => n(c.debt), render: c => money(c.debt, { zero: '—' }) },
    { key: 'a', title: 'Аванс', align: 'right', sort: c => n(c.advance), render: c => money(c.advance, { zero: '—' }) },
    { key: 'p', title: 'Депозит', align: 'right', sort: c => n(c.deposit), render: c => money(c.deposit, { zero: '—' }) },
    { key: 'x', title: '', render: c => imp.status === 'staged' ? (
      <Row gap={4} wrap={false}>
        <Button small onClick={() => setPick(c)}>{c.tenant_id ? 'Изменить' : 'Выбрать'}</Button>
        {c.tenant_id && <Button small kind="ghost" onClick={() => link(c, null)}>Отвязать</Button>}
      </Row>) : null },
  ]

  return (
    <>
      {err && <Notice tone="red">{err}</Notice>}
      {imp.status !== 'staged' && <Notice>Загрузка уже {imp.status === 'posted' ? 'проведена' : 'отменена'} — сопоставление менять нельзя. Для нового переноса загрузите выгрузку заново.</Notice>}
      <Card pad={false} title={`Контрагенты 1С · ${cps.length}`} actions={<Row gap={8}>
        <Segmented<typeof filter> value={filter} onChange={setFilter} options={[['unmatched', `Не сопоставлены · ${cps.filter(c => !c.tenant_id).length}`], ['all', 'Все']]} />
        <Search value={q} onChange={setQ} placeholder="Название или ИНН" width={200} />
      </Row>}>
        <Table rows={rows} rowKey={c => c.cp_id} cols={cols} dense empty={filter === 'unmatched' ? 'Все контрагенты сопоставлены' : 'Нет контрагентов'} />
      </Card>
      <Card pad={false} title={`Есть в Маяке, нет в 1С${missing ? ' · ' + missing.length : ''}`}>
        <div style={{ padding: '10px 16px 0' }}><Notice>Арендаторы Маяка, которых нет среди контрагентов этой выгрузки. Только для ручного разбора: возможно, у них в 1С другой ИНН, они ушли или ещё не заведены в 1С.</Notice></div>
        {missingErr && <div style={{ padding: 16 }}><Notice tone="red">{missingErr}</Notice></div>}
        {missing === null ? <Loading /> : (
          <Table rows={missing} rowKey={m => m.tenant_id} dense empty="Все арендаторы Маяка есть в выгрузке" cols={[
            { key: 'n', title: 'Арендатор', sort: m => m.full_name, render: m => <a href={'/tenants/' + m.tenant_id} style={{ color: C.accent, textDecoration: 'none' }}>{m.full_name}</a> },
            { key: 'i', title: 'ИНН', render: m => m.inn || '—' },
            { key: 'c', title: 'Код 1С', render: m => m.id_1c ? <span style={{ fontSize: 12, color: C.muted }}>{m.id_1c}</span> : '—' },
            { key: 's', title: 'Статус', render: m => m.status || '—' },
            { key: 'l', title: 'Договоров', align: 'right', sort: m => m.leases, render: m => m.leases },
          ]} />
        )}
      </Card>
      {pick && <TenantPicker cp={pick} tenants={tenants} onClose={() => setPick(null)} onPick={id => link(pick, id)} error={err} />}
    </>
  )
}

function TenantPicker({ cp, tenants, onClose, onPick, error }: { cp: Cp; tenants: Tenant[]; onClose: () => void; onPick: (id: string) => void; error: string | null }) {
  const [q, setQ] = useState('')
  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    const byInn = cp.inn ? tenants.filter(t => t.inn === cp.inn) : []
    const rest = tenants.filter(t => !byInn.includes(t) && (!s || `${t.full_name} ${t.inn || ''}`.toLowerCase().includes(s)))
    return [...byInn, ...rest].slice(0, 60)
  }, [q, tenants, cp])
  return (
    <Modal title="Арендатор Маяка для контрагента 1С" onClose={onClose} width={560}>
      <div><b>{cp.name}</b><div style={{ fontSize: 12, color: C.muted }}>{cp.inn ? 'ИНН ' + cp.inn : 'без ИНН'} · код 1С {cp.cp_id}</div></div>
      {error && <Notice tone="red">{error}</Notice>}
      <Search value={q} onChange={setQ} placeholder="Название или ИНН арендатора" width={9999} />
      <div style={{ display: 'grid', gap: 4, maxHeight: 360, overflowY: 'auto' }}>
        {list.length === 0 && <Empty>Никого не нашли</Empty>}
        {list.map(t => (
          <button key={t.id} type="button" onClick={() => onPick(t.id)} style={{
            textAlign: 'left', border: `1px solid ${C.line}`, background: C.card, color: C.text, borderRadius: 8, padding: '8px 12px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13,
          }}>
            <div>{t.full_name} {cp.inn && t.inn === cp.inn && <Badge tone="green">тот же ИНН</Badge>}</div>
            <div style={{ fontSize: 12, color: C.faint }}>{t.inn ? 'ИНН ' + t.inn : 'без ИНН'}{t.id_1c && t.id_1c !== cp.cp_id ? ' · уже связан с другим контрагентом 1С' : ''}</div>
          </button>
        ))}
      </div>
      <Muted>Выбор запоминается в карточке арендатора (код 1С): в следующих выгрузках он сопоставится сам.</Muted>
    </Modal>
  )
}
const Muted = ({ children }: { children: ReactNode }) => <div style={{ fontSize: 12, color: C.faint }}>{children}</div>

// ── 2. Договоры ─────────────────────────────────────────────────────────────
type CtRow = Ct & { cp: Cp | null }
function ContractsTab({ imp, rows, leases, isOwner }: { imp: Imp; rows: CtRow[]; leases: Lease[]; isOwner: boolean }) {
  const [filter, setFilter] = useState<'all' | 'unlinked'>('all')
  const [q, setQ] = useState('')
  const [confirm, setConfirm] = useState(false)
  const [result, setResult] = useState<{ updated: number; created: number } | null>(null)
  const linkA = useAction((a: { c: CtRow; leaseId: string }) => sbRpc('onec_link_contract', { p_import: imp.id, p_cp: a.c.cp_id, p_contract: a.c.contract_id, p_lease: a.leaseId || null }),
    { invalidate: ONEC })
  // перенос номеров и дат меняет и создаёт договоры Маяка
  const applyA = useAction(async () => {
    const r = await sbRpc('onec_apply_contracts', { p_import: imp.id })
    return isObj(r) ? { updated: Number(r.updated) || 0, created: Number(r.created) || 0 } : { updated: 0, created: 0 }
  }, { invalidate: [...ONEC, 'leases'], onSuccess: r => { setResult(r); setConfirm(false) } })
  const working = applyA.isPending
  const errRaw = applyA.error || linkA.error
  const err = errRaw ? errText(errRaw) : null
  const editable = imp.status === 'staged'

  const list = rows.filter(c => (filter === 'all' || (c.cp?.tenant_id && !c.lease_id))
    && (!q || `${c.name} ${c.number} ${c.cp?.name} ${c.cp?.tenants?.full_name}`.toLowerCase().includes(q.toLowerCase())))
  const unlinkedNew = rows.filter(c => c.cp?.tenant_id && !c.lease_id && c.number && ['rent', 'ad', 'other'].includes(c.kind || '')).length

  const linkLease = (c: CtRow, leaseId: string) => { applyA.reset(); linkA.mutate({ c, leaseId }) }
  const apply = () => { linkA.reset(); applyA.mutate(undefined, { onError: () => setConfirm(false) }) }

  const leaseLabel = (l: Lease) => `№ ${l.number || 'без номера'}${l.start_date ? ' от ' + dateRu(l.start_date) : ''}${l.status && l.status !== 'active' ? ' (' + l.status + ')' : ''}`
  const cols: Col<CtRow>[] = [
    { key: 'cp', title: 'Арендатор', sort: c => c.cp?.tenants?.full_name || c.cp?.name || '', render: c => c.cp?.tenant_id
      ? <a href={'/tenants/' + c.cp.tenant_id} style={{ color: C.accent, textDecoration: 'none' }}>{c.cp.tenants?.full_name}</a>
      : <><div>{c.cp?.name}</div><Badge tone="red">не сопоставлен</Badge></> },
    { key: 'n', title: 'Договор 1С', sort: c => c.name || '', render: c => <><div>{c.name || '—'}</div><div style={{ fontSize: 12, color: C.faint }}>
      {c.number ? '№ ' + c.number : 'номер не найден'}{c.date ? ' от ' + dateRu(c.date) : ''}</div></> },
    { key: 'k', title: 'Вид', sort: c => c.kind || '', render: c => KIND[c.kind || ''] || c.kind || '—' },
    { key: 'b', title: 'Сальдо 1С', align: 'right', sort: c => n(c.debt) - n(c.advance), render: c => <>
      <div style={{ color: n(c.debt) - n(c.advance) > 0 ? C.red : n(c.debt) - n(c.advance) < 0 ? C.green : undefined }}>{money(n(c.debt) - n(c.advance), { zero: '—' })}</div>
      {n(c.deposit) > 0 && <div style={{ fontSize: 12, color: C.faint }}>депозит {money(c.deposit)}</div>}</> },
    { key: 'l', title: 'Договор Маяка', sort: c => c.lease_match || '', render: c => {
      if (!c.cp?.tenant_id) return <span style={{ color: C.faint }}>сначала сопоставьте арендатора</span>
      const own = leases.filter(l => l.tenant_id === c.cp!.tenant_id)
      return (
        <div style={{ display: 'grid', gap: 4, minWidth: 200 }}>
          {editable
            ? <Select value={c.lease_id || ''} onChange={e => linkLease(c, e.target.value)} style={{ fontSize: 13, padding: '5px 8px' }}>
                <option value="">— нет пары —</option>
                {own.map(l => <option key={l.id} value={l.id}>{leaseLabel(l)}</option>)}
              </Select>
            : <span>{c.lease_id ? leaseLabel(own.find(l => l.id === c.lease_id) || { id: '', tenant_id: null, number: null, start_date: null, status: null }) : '—'}</span>}
          <div>{c.lease_match && LEASE_MATCH[c.lease_match]
            ? <Badge tone={LEASE_MATCH[c.lease_match][1]}>{LEASE_MATCH[c.lease_match][0]}</Badge>
            : <Badge tone="amber">{own.length ? 'не сопоставлен' : 'у арендатора нет договоров'}</Badge>}</div>
        </div>
      )
    } },
  ]

  return (
    <>
      {err && <Notice tone="red">{err}</Notice>}
      {result && <Notice tone="green">Договоры Маяка обновлены: номер и дата перенесены в {result.updated}, создано новых {result.created}.
        {result.created > 0 && ' У созданных договоров нет помещений и ставок — заполните их в разделе «Договоры» (в примечании договора: «Создан из 1С»).'}</Notice>}
      <Notice>Договоры сопоставляются по номеру. Из 1С в Маяк переносятся только номер и дата договора; помещения и ставки остаются из Маяка.
        Договоры 1С без пары у сопоставленных арендаторов (аренда, реклама, прочие — с номером) при переносе создаются в Маяке пустыми: без помещений и ставок, их нужно заполнить вручную.</Notice>
      <Card pad={false} title={`Договоры 1С · ${rows.length}`} actions={<Row gap={8}>
        <Segmented<typeof filter> value={filter} onChange={setFilter} options={[['all', 'Все'], ['unlinked', `Без пары · ${rows.filter(c => c.cp?.tenant_id && !c.lease_id).length}`]]} />
        <Search value={q} onChange={setQ} placeholder="Договор или арендатор" width={200} />
        {isOwner && editable && <Button kind="primary" disabled={working} onClick={() => setConfirm(true)}>Перенести номера и даты в договоры Маяка</Button>}
      </Row>}>
        <Table rows={list} rowKey={c => c.cp_id + '|' + c.contract_id} cols={cols} dense empty="Нет договоров" />
      </Card>
      {confirm && (
        <Modal title="Перенести договоры из 1С" onClose={() => setConfirm(false)} footer={<>
          <Button onClick={() => setConfirm(false)}>Отмена</Button>
          <Button kind="primary" disabled={working} onClick={apply}>{working ? 'Переносим…' : 'Перенести'}</Button>
        </>}>
          <div>У сопоставленных договоров Маяка номер и дата начала будут заменены на данные из 1С.</div>
          {unlinkedNew > 0 && <Notice tone="amber">Договоров 1С без пары: {unlinkedNew}. Они будут созданы в Маяке как действующие, но без помещений и ставок — заполните их вручную, иначе начисления по ним не пойдут.</Notice>}
        </Modal>
      )}
    </>
  )
}

// ── 3. Остатки ──────────────────────────────────────────────────────────────
function OpeningTab({ lines, error, articles, isOwner }: { lines: Line[] | null; error: string | null; articles: Article[]; isOwner: boolean }) {
  const [kind, setKind] = useState<'all' | LineKind>('all')
  const [art, setArt] = useState('')
  const [q, setQ] = useState('')
  const [onlyMatched, setOnlyMatched] = useState(false)

  const summary = useMemo(() => {
    const m = new Map<string, { key: string; label: string; kind: string; code: string | null; sum: number; count: number }>()
    for (const l of lines || []) {
      const key = l.kind === 'charge' ? 'c:' + l.article_code : l.kind
      const label = l.kind === 'charge' ? (l.article_name || l.article_code || '—') : l.kind === 'advance' ? 'Переплата (аванс)' : 'Депозит, полученный по договору'
      const cur = m.get(key) || { key, label, kind: l.kind, code: l.kind === 'charge' ? l.article_code : null, sum: 0, count: 0 }
      cur.sum += n(l.amount); cur.count += 1; m.set(key, cur)
    }
    return [...m.values()].sort((a, b) => (a.kind === b.kind ? b.sum - a.sum : a.kind === 'charge' ? -1 : b.kind === 'charge' ? 1 : a.kind.localeCompare(b.kind)))
  }, [lines])
  const opening = summary.find(s => s.code === 'OPENING')

  if (lines === null) return <Loading text="Разбиваем остатки по статьям…" />
  const filtered = lines.filter(l => (kind === 'all' || l.kind === kind) && (!art || l.article_code === art) && (!onlyMatched || l.tenant_id)
    && (!q || `${l.cp_name} ${l.tenant_name} ${l.contract_name} ${l.doc_label} ${l.rule}`.toLowerCase().includes(q.toLowerCase())))
  const shown = filtered.slice(0, 1000)

  return (
    <>
      {error && <Notice tone="red">{error}</Notice>}
      {opening && opening.sum > 0 && (
        <Notice tone="amber"><b>Без разбивки: {money(opening.sum)} ({opening.count} строк).</b> Эти долги не удалось отнести к статье: в выгрузке нет строк документов с номенклатурой,
          а договор аренды сам по себе статью не даёт (в акте бывают аренда, коммунальные, уборка). Варианты: доработать выгрузку 1С до версии 2 со строками номенклатуры
          (задание — docs/1c-export-v2.md) и загрузить заново, или после проведения бухгалтер разносит сумму статьи «Входящий остаток из 1С без разбивки» по статьям вручную до даты перехода.</Notice>
      )}
      <Card pad={false} title="Итог по статьям">
        <Table rows={summary} rowKey={s => s.key} dense empty="В выгрузке нет остатков" cols={[
          { key: 'l', title: 'Статья', render: s => <span style={s.code === 'OPENING' ? { color: C.amber, fontWeight: 600 } : undefined}>{s.label}{s.code === 'OPENING' && ' — без разбивки'}</span> },
          { key: 'k', title: 'Вид', render: s => <Badge tone={s.kind === 'charge' ? (s.code === 'OPENING' ? 'amber' : 'neutral') : s.kind === 'advance' ? 'green' : 'violet'}>{LINE_KIND[s.kind]}</Badge> },
          { key: 'c', title: 'Строк', align: 'right', render: s => s.count },
          { key: 's', title: 'Сумма', align: 'right', render: s => <span style={s.code === 'OPENING' ? { color: C.amber, fontWeight: 600 } : undefined}>{money(s.sum)}</span> },
          { key: 'f', title: '', render: s => <Button small kind="ghost" onClick={() => { setKind(s.kind as LineKind); setArt(s.code || '') }}>Показать</Button> },
        ]} />
      </Card>
      <Card pad={false} title={`Строки остатков · ${filtered.length}`} actions={<Row gap={8}>
        <Segmented value={kind} onChange={k => { setKind(k); if (k !== 'charge') setArt('') }} options={[['all', 'Все'], ['charge', 'Долги'], ['advance', 'Переплаты'], ['deposit', 'Депозиты']]} />
        <Select value={art} onChange={e => { setArt(e.target.value); if (e.target.value) setKind('charge') }} style={{ width: 200 }}>
          <option value="">Все статьи</option>
          {[...new Set(lines.filter(l => l.article_code).map(l => l.article_code!))].map(c => <option key={c} value={c}>{articles.find(a => a.code === c)?.name || c}</option>)}
        </Select>
        <label style={{ fontSize: 13, color: C.muted, display: 'flex', gap: 6, alignItems: 'center' }}>
          <input type="checkbox" checked={onlyMatched} onChange={e => setOnlyMatched(e.target.checked)} /> только сопоставленные</label>
        <Search value={q} onChange={setQ} placeholder="Арендатор, договор, документ" width={200} />
      </Row>}>
        <Table rows={shown} rowKey={l => [l.cp_id, l.contract_id, l.doc_id, l.kind, l.article_code, l.amount, l.rule].join('|') + '|' + lines.indexOf(l)} dense empty="Ничего не нашли" cols={[
          { key: 't', title: 'Арендатор', sort: l => l.tenant_name || l.cp_name || '', render: l => <>{l.tenant_name || <span style={{ color: C.red }}>{l.cp_name} · не сопоставлен</span>}</> },
          { key: 'c', title: 'Договор / документ', render: l => <><div>{l.contract_name || '—'}</div><div style={{ fontSize: 12, color: C.faint }}>{l.doc_label}</div></> },
          { key: 'k', title: 'Вид', render: l => LINE_KIND[l.kind] },
          { key: 'a', title: 'Статья', sort: l => l.article_name || '', render: l => l.article_code === 'OPENING' ? <Badge tone="amber">без разбивки</Badge> : (l.article_name || '—') },
          { key: 's', title: 'Сумма', align: 'right', sort: l => n(l.amount), render: l => money(l.amount) },
          { key: 'r', title: 'Правило', render: l => <span style={{ fontSize: 12, color: C.muted }}>{l.rule || '—'}</span> },
        ]} />
        {filtered.length > shown.length && <div style={{ padding: 12, fontSize: 12, color: C.faint }}>Показаны первые {shown.length} строк — уточните фильтр.</div>}
      </Card>
      <RulesCard articles={articles} isOwner={isOwner} />
    </>
  )
}

// правила меняют разбивку остатков (а через неё — и сверку)
const RULE_TABLES = ['onec_article_rules', 'rpc:onec_opening_lines', 'rpc:onec_reconcile']
function RulesCard({ articles, isOwner }: { articles: Article[]; isOwner: boolean }) {
  const rulesQ = useSb(['onec_article_rules'], () => sb(supabase.from('onec_article_rules').select('*').order('priority').order('id')))
  const rules: Rule[] | null = rulesQ.error ? [] : rulesQ.data ?? null
  const [localErr, setLocalErr] = useState<string | null>(null)
  const [form, setForm] = useState<{ field: RuleField; pattern: string; article_code: string; priority: string; note: string } | null>(null)
  const addA = useAction((f: NonNullable<typeof form>) => sb(supabase.from('onec_article_rules').insert({ field: f.field, pattern: f.pattern.trim(), article_code: f.article_code, priority: Number(f.priority) || 100, note: f.note || null })),
    { invalidate: RULE_TABLES, onSuccess: () => setForm(null) })
  const delA = useAction((id: number) => sb(supabase.from('onec_article_rules').delete().eq('id', id)), { invalidate: RULE_TABLES })
  const actErr = addA.error || delA.error
  const err = localErr || (actErr ? errText(actErr) : null) || (rulesQ.error ? errText(rulesQ.error) : null)
  function save() {
    if (!form) return
    setLocalErr(null); delA.reset()
    try { new RegExp(form.pattern, 'i') } catch { setLocalErr('Шаблон — не регулярное выражение'); return }
    addA.mutate(form)
  }
  async function remove(r: Rule) {
    if (!(await ask(`Удалить правило «${r.pattern}» → ${articles.find(a => a.code === r.article_code)?.name || r.article_code}?`, { ok: 'Удалить', danger: true }))) return
    setLocalErr(null); addA.reset()
    delA.mutate(r.id)
  }
  return (
    <Card pad={false} title="Правила разбивки по статьям" actions={isOwner && <Button small onClick={() => setForm({ field: 'item', pattern: '', article_code: articles[0]?.code || '', priority: '100', note: '' })}>Добавить правило</Button>}>
      <div style={{ padding: '10px 16px 0' }}><Notice>Статья определяется первым подходящим правилом: сначала по номенклатуре строки и счёту учёта, затем по договору и виду документа; внутри — по приоритету (меньше — раньше).
        Шаблон — регулярное выражение без учёта регистра. Изменения правил сразу меняют разбивку выше (до проведения).</Notice></div>
      {err && <div style={{ padding: '10px 16px 0' }}><Notice tone="red">{err}</Notice></div>}
      {rules === null ? <Loading /> : (
        <Table rows={rules} rowKey={r => String(r.id)} dense cols={[
          { key: 'p', title: 'Приоритет', align: 'right', sort: r => r.priority, render: r => r.priority },
          { key: 'f', title: 'Поле', sort: r => r.field, render: r => RULE_FIELD[r.field] || r.field },
          { key: 'r', title: 'Шаблон', render: r => <code style={{ fontSize: 12 }}>{r.pattern}</code> },
          { key: 'a', title: 'Статья', sort: r => r.article_code, render: r => <>{articles.find(a => a.code === r.article_code)?.name || r.article_code}{r.note && <div style={{ fontSize: 12, color: C.faint }}>{r.note}</div>}</> },
          ...(isOwner ? [{ key: 'x', title: '', render: (r: Rule) => <Button small kind="danger" onClick={() => remove(r)}>Удалить</Button> }] : []),
        ]} />
      )}
      {form && (
        <Modal title="Новое правило разбивки" onClose={() => setForm(null)} footer={<>
          <Button onClick={() => setForm(null)}>Отмена</Button>
          <Button kind="primary" disabled={!form.pattern.trim() || !form.article_code || addA.isPending} onClick={save}>Сохранить</Button>
        </>}>
          {err && <Notice tone="red">{err}</Notice>}
          <Field label="Поле"><Select value={form.field} onChange={e => setForm({ ...form, field: e.target.value as RuleField })}>
            {Object.entries(RULE_FIELD).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
          <Field label="Шаблон" hint="Например: охран|видеонаблюд"><Input value={form.pattern} onChange={e => setForm({ ...form, pattern: e.target.value })} /></Field>
          <Field label="Статья"><Select value={form.article_code} onChange={e => setForm({ ...form, article_code: e.target.value })}>
            {articles.filter(a => a.active).map(a => <option key={a.code} value={a.code}>{a.name}</option>)}</Select></Field>
          <Field label="Приоритет" hint="Меньше — проверяется раньше"><Input type="number" value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })} /></Field>
          <Field label="Примечание"><Input value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} /></Field>
        </Modal>
      )}
    </Card>
  )
}

// ── 4. Сверка ───────────────────────────────────────────────────────────────
function ReconcileTab({ rows, error, date, articles, tenants, onDate }: {
  rows: Rec[] | null; error: string | null; date: string; articles: Article[]; tenants: Tenant[]; onDate: (d: string) => void
}) {
  const [onlyBad, setOnlyBad] = useState(true)
  const [q, setQ] = useState('')
  const list = (rows || []).filter(r => (!onlyBad || r.status !== 'совпадает') && (!q || `${r.tenant_name} ${r.cp_names} ${r.inn}`.toLowerCase().includes(q.toLowerCase())))
  const ok = (rows || []).filter(r => r.status === 'совпадает').length
  const bad = (rows || []).filter(r => r.status !== 'совпадает')
  const absDiff = bad.reduce((s, r) => s + Math.abs(n(r.diff)) + Math.abs(n(r.diff_deposit)), 0)
  const yearStart = (date || today()).slice(0, 4) + '-01-01'

  function act(r: Rec) {
    const t = tenants.find(x => x.id === r.tenant_id)
    if (!r.tenant_id) return
    printAct({ id: r.tenant_id, full_name: t?.full_name || r.tenant_name || '', inn: t?.inn || r.inn }, yearStart, date, '', articles)
  }

  const diffCell = (v: number) => <span style={{ color: Math.abs(n(v)) >= 0.005 ? C.red : C.faint, fontWeight: Math.abs(n(v)) >= 0.005 ? 600 : undefined }}>{Math.abs(n(v)) >= 0.005 ? signed(n(v)) : '0'}</span>
  return (
    <>
      <Row gap={12} align="end">
        <Field label="Сальдо на дату"><Input type="date" value={date} onChange={e => onDate(e.target.value)} style={{ width: 170 }} /></Field>
        <Segmented value={onlyBad ? 'bad' : 'all'} onChange={v => setOnlyBad(v === 'bad')} options={[['bad', 'Только расхождения'], ['all', 'Все']]} />
        <Search value={q} onChange={setQ} placeholder="Арендатор или ИНН" width={200} />
      </Row>
      {error && <Notice tone="red">{error}</Notice>}
      <Stats>
        <Stat label="Совпадает" value={rows ? ok : '…'} tone="green" />
        <Stat label="Расхождений" value={rows ? bad.length : '…'} tone={bad.length ? 'red' : undefined} sub={rows ? `в т.ч. нет в Маяке ${bad.filter(r => r.status === 'нет в Маяке').length}, нет в 1С ${bad.filter(r => r.status === 'нет в 1С').length}` : undefined} />
        <Stat label="Сумма расхождений по модулю" value={rows ? money(absDiff) : '…'} tone={absDiff ? 'red' : undefined} sub="расчёты и депозиты" />
      </Stats>
      <Notice>Сальдо = долг − переплата; депозиты сверяются отдельно. Разница = Маяк − 1С, должна быть ноль до копейки.
        «Акт сверки» открывает акт за период с начала года по выбранную дату по данным Маяка; печать — через окно браузера, там же «Сохранить как PDF».</Notice>
      <Card pad={false} title={`Сверка на ${dateRu(date)}`}>
        {rows === null ? <Loading text="Считаем сальдо…" /> : (
          <Table rows={list} rowKey={r => (r.tenant_id || '') + '|' + (r.cp_names || '')} dense empty={onlyBad ? 'Расхождений нет' : 'Нет данных'} cols={[
            { key: 't', title: 'Арендатор', sort: r => r.tenant_name || r.cp_names || '', render: r => <>
              <div>{r.tenant_id ? <a href={'/settlements/' + r.tenant_id} style={{ color: C.accent, textDecoration: 'none' }}>{r.tenant_name}</a> : (r.cp_names || '—')}</div>
              <div style={{ fontSize: 12, color: C.faint }}>{r.tenant_id && r.cp_names ? '1С: ' + r.cp_names : ''}{r.inn ? (r.tenant_id && r.cp_names ? ' · ' : '') + 'ИНН ' + r.inn : ''}</div></> },
            { key: 'o', title: 'Сальдо 1С', align: 'right', sort: r => n(r.onec_balance), render: r => money(r.onec_balance) },
            { key: 'm', title: 'Сальдо Маяк', align: 'right', sort: r => n(r.mayak_balance), render: r => money(r.mayak_balance) },
            { key: 'd', title: 'Разница', align: 'right', sort: r => Math.abs(n(r.diff)), render: r => diffCell(r.diff) },
            { key: 'od', title: 'Депозит 1С', align: 'right', render: r => money(r.onec_deposit, { zero: '—' }) },
            { key: 'md', title: 'Депозит Маяк', align: 'right', render: r => money(r.mayak_deposit, { zero: '—' }) },
            { key: 'dd', title: 'Разница депозита', align: 'right', sort: r => Math.abs(n(r.diff_deposit)), render: r => diffCell(r.diff_deposit) },
            { key: 's', title: 'Статус', sort: r => r.status, render: r => <Badge tone={REC_TONE[r.status] || 'neutral'}>{r.status}</Badge> },
            { key: 'a', title: '', render: r => r.tenant_id ? <Button small onClick={() => act(r)}>Акт сверки</Button> : null },
          ]} />
        )}
      </Card>
    </>
  )
}

// ── 5. Проведение ───────────────────────────────────────────────────────────
function PostTab({ imp, lines }: { imp: Imp; lines: Line[] | null }) {
  const [date, setDate] = useState(nextMonthStart())
  const [confirm, setConfirm] = useState(false)
  const [typed, setTyped] = useState('')
  const [result, setResult] = useState<PostResult | null>(null)
  const [storno, setStorno] = useState(false)
  const [reason, setReason] = useState('')
  const postA = useAction(async (d: string) => asPostResult(await sbRpc('onec_opening_post', { p_import: imp.id, p_date: d })),
    { invalidate: POSTED, onSuccess: r => { setResult(r); setConfirm(false); setTyped('') } })
  const stornoA = useAction((why: string) => sbRpc('onec_opening_storno', { p_import: imp.id, p_reason: why }), {
    invalidate: POSTED,
    onSuccess: k => { setStorno(false); setReason(''); setResult(null); notify(`Остатки отменены сторно: документов ${k}.`, 'green') },
  })
  const working = postA.isPending || stornoA.isPending
  const errRaw = postA.error || stornoA.error
  const err = errRaw ? errText(errRaw) : null

  const preview = useMemo(() => {
    const ls = lines || []
    const byArt = new Map<string, { name: string; sum: number; count: number }>()
    let adv = 0, advN = 0, dep = 0, depN = 0, skip = 0, skipN = 0, depNoLease = 0
    for (const l of ls) {
      if (!l.tenant_id) { skip += n(l.amount); skipN++; continue }
      if (l.kind === 'advance') { adv += n(l.amount); advN++; continue }
      if (l.kind === 'deposit') { if (!l.lease_id) { depNoLease += n(l.amount); skipN++; skip += n(l.amount); continue } dep += n(l.amount); depN++; continue }
      // депозит по правилу без договора Маяка база проводит на «без разбивки»
      const code = l.article_code === 'DEPOSIT' && !l.lease_id ? 'OPENING' : (l.article_code || 'OPENING')
      const name = code === 'OPENING' ? 'Входящий остаток из 1С без разбивки' : (l.article_name || code)
      const cur = byArt.get(code) || { name, sum: 0, count: 0 }
      cur.sum += n(l.amount); cur.count++; byArt.set(code, cur)
    }
    const charges = [...byArt.entries()].map(([code, v]) => ({ code, ...v })).sort((a, b) => b.sum - a.sum)
    return { charges, chargeSum: charges.reduce((s, c) => s + c.sum, 0), adv, advN, dep, depN, skip, skipN, depNoLease }
  }, [lines])

  const dateText = dateRu(date)
  function post() { stornoA.reset(); postA.mutate(date, { onError: () => setConfirm(false) }) }
  function doStorno() { postA.reset(); stornoA.mutate(reason.trim(), { onError: () => setStorno(false) }) }

  const skippedList = (s: Skipped[]) => s.length ? (
    <Table rows={s} rowKey={x => JSON.stringify(x) + s.indexOf(x)} dense cols={[
      { key: 'c', title: 'Контрагент', render: x => x.cp }, { key: 'd', title: 'Документ', render: x => x.doc },
      { key: 'a', title: 'Сумма', align: 'right', render: x => money(x.amount) }, { key: 'w', title: 'Почему', render: x => x.why },
    ]} />
  ) : <Empty>Пропущенных строк нет</Empty>

  if (imp.status === 'posted') {
    const pr = result || asPostResult(imp.post_result)
    return (
      <>
        {err && <Notice tone="red">{err}</Notice>}
        <Notice tone="green">Остатки проведены на {dateRu(imp.transition_date)} ({dateTimeRu(imp.posted_at)}): строк {pr.lines ?? '—'}, пропущено {pr.skipped.length}.
          Проверьте вкладку «Сверка» на дату перехода.</Notice>
        <Card pad={false} title="Пропущено при проведении">{skippedList(pr.skipped)}</Card>
        <Card title="Отменить проведённые остатки">
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ fontSize: 13 }}>Все начисления и оплаты этой загрузки будут отменены сторно (в истории останутся). После этого можно провести другую загрузку.</div>
            <div><Button kind="danger" onClick={() => setStorno(true)}>Отменить остатки сторно</Button></div>
          </div>
        </Card>
        {storno && (
          <Modal title="Отменить остатки сторно" onClose={() => setStorno(false)} footer={<>
            <Button onClick={() => setStorno(false)}>Не отменять</Button>
            <Button kind="danger" disabled={working || !reason.trim()} onClick={doStorno}>{working ? 'Отменяем…' : 'Отменить сторно'}</Button>
          </>}>
            <Field label="Причина" hint="Попадёт в описание сторно-документов и журнал"><Input value={reason} onChange={e => setReason(e.target.value)} autoFocus /></Field>
          </Modal>
        )}
      </>
    )
  }
  if (imp.status === 'reversed') {
    return <Notice>Эта загрузка была проведена на {dateRu(imp.transition_date)} и затем отменена сторно. Для повторного переноса загрузите выгрузку из 1С заново и проведите новую загрузку.</Notice>
  }
  if (lines === null) return <Loading />

  return (
    <>
      {err && <Notice tone="red">{err}</Notice>}
      {result && <Notice tone="green">Проведено строк: {result.lines}. Пропущено: {result.skipped.length}.</Notice>}
      <Row gap={12} align="end">
        <Field label="Дата перехода" hint="Обычно первое число месяца"><Input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ width: 170 }} /></Field>
      </Row>
      <Stats>
        <Stat label="Долги по статьям" value={money(preview.chargeSum)} tone="red" sub={`строк ${preview.charges.reduce((s, c) => s + c.count, 0)}`} />
        <Stat label="Переплаты (аванс)" value={money(preview.adv)} tone="green" sub={`строк ${preview.advN}`} />
        <Stat label="Депозиты" value={money(preview.dep)} sub={`строк ${preview.depN}`} />
        <Stat label="Будет пропущено" value={money(preview.skip)} tone={preview.skipN ? 'amber' : undefined} sub={`строк ${preview.skipN}: контрагент не сопоставлен${preview.depNoLease ? ' или депозит без договора' : ''}`} />
      </Stats>
      <Card pad={false} title="Начисления по статьям">
        <Table rows={preview.charges} rowKey={c => c.code} dense empty="Долгов нет" cols={[
          { key: 'n', title: 'Статья', render: c => <span style={c.code === 'OPENING' ? { color: C.amber, fontWeight: 600 } : undefined}>{c.name}</span> },
          { key: 'k', title: 'Строк', align: 'right', render: c => c.count },
          { key: 's', title: 'Сумма', align: 'right', render: c => money(c.sum) },
        ]} />
      </Card>
      <Notice tone="red"><b>Проведение создаёт в учёте Маяка начисления, оплаты и депозиты с датой {dateText} на все суммы выше.</b> Проверьте до проведения:
        все арендаторы сопоставлены (несопоставленные будут пропущены), договоры перенесены, сумма «без разбивки» понятна бухгалтеру.
        В Маяке не должно быть начислений и оплат до даты перехода — иначе база откажет. Ошибочное проведение отменяется только сторно, целиком.</Notice>
      <div><Button kind="primary" disabled={!date || working} onClick={() => { setTyped(''); setConfirm(true) }}>Провести остатки на {dateText}</Button></div>
      {confirm && (
        <Modal title="Провести входящие остатки из 1С" onClose={() => setConfirm(false)} footer={<>
          <Button onClick={() => setConfirm(false)}>Отмена</Button>
          <Button kind="danger" disabled={working || typed.trim() !== dateText} onClick={post}>{working ? 'Проводим…' : 'Провести'}</Button>
        </>}>
          <div style={{ fontSize: 13 }}>Будет проведено: долги {money(preview.chargeSum)}, переплаты {money(preview.adv)}, депозиты {money(preview.dep)}.
            Пропущено: {money(preview.skip)}.</div>
          <Field label={`Для подтверждения введите дату перехода: ${dateText}`}><Input value={typed} onChange={e => setTyped(e.target.value)} placeholder={dateText} autoFocus /></Field>
        </Modal>
      )}
    </>
  )
}
