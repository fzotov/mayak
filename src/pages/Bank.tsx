// Банк: загрузка выписки СберБизнес (kl_to_1c.txt), поступления и их зачисление арендаторам,
// очередь «Не распознано», расходы и архив выписок со сверкой остатков.
// Поступление с ИНН арендатора (или от запомненного плательщика) база зачисляет сама; человек разбирает только остальное.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { go } from '../lib/nav'
import { supabase } from '../lib/supabase'
import { apiFetch } from '../lib/api'
import { rpc } from '../lib/accounting'
import { parseClientBank } from '../lib/clientBank'
import { Page, Card, Button, Badge, Stat, Stats, Table, Field, Modal, Notice, Tabs, Loading, inputStyle, money, dateRu, monthStart, today, C } from '../components/ui'

interface Tx {
  id: string; date: string; amount: number; direction: 'credit' | 'debit'; counterparty: string | null; description: string | null
  payer_inn: string | null; counter_inn: string | null; status: string; tenant_id: string | null; match_note: string | null; doc_number: string | null
  tenants: { full_name: string } | null
}
interface StatementFile { id: string; file_name: string | null; account: string; date_from: string | null; date_to: string | null; opening: number | null; total_in: number | null; total_out: number | null; closing: number | null; check_status: string; check_note: string | null; added: number; skipped: number; created_at: string }
type Tab = 'in' | 'unrec' | 'out' | 'files'

const STATUS: Record<string, { label: string; tone: 'green' | 'amber' | 'neutral' | 'blue' }> = {
  credited: { label: 'Зачислено', tone: 'green' }, unrecognized: { label: 'Не распознано', tone: 'amber' },
  ignored: { label: 'Не от арендатора', tone: 'neutral' }, expense: { label: 'Сверено', tone: 'neutral' }, new: { label: 'Ждёт сверки', tone: 'blue' },
}

export default function BankPage() {
  const [params] = useSearchParams()
  const [tab, setTab] = useState<Tab>((['in', 'unrec', 'out', 'files'] as Tab[]).includes(params.get('tab') as Tab) ? params.get('tab') as Tab : 'in')
  const [from, setFrom] = useState(monthStart())
  const [to, setTo] = useState(today())
  const [txs, setTxs] = useState<Tx[] | null>(null)
  const [unrec, setUnrec] = useState<Tx[]>([])
  const [files, setFiles] = useState<StatementFile[]>([])
  const [tenants, setTenants] = useState<{ id: string; full_name: string; inn: string | null }[]>([])
  const [msg, setMsg] = useState<{ tone: 'green' | 'red' | 'amber'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [assign, setAssign] = useState<{ tx: Tx; tenant?: string; note?: string } | null>(null)
  const [hints, setHints] = useState<Record<string, { tenant_id: string | null; note: string }>>({})
  const fileRef = useRef<HTMLInputElement>(null)

  async function load() {
    const [a, b, c, d] = await Promise.all([
      supabase.from('bank_transactions').select('*, tenants(full_name)').gte('date', from).lte('date', to).order('date', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('bank_transactions').select('*, tenants(full_name)').eq('status', 'unrecognized').order('date'),
      supabase.from('bank_statement_files').select('*').order('created_at', { ascending: false }).limit(50),
      supabase.from('tenants').select('id, full_name, inn').order('full_name'),
    ])
    setTxs((a.data || []) as Tx[]); setUnrec((b.data || []) as Tx[]); setFiles((c.data || []) as StatementFile[]); setTenants(d.data || [])
  }
  useEffect(() => { load() }, [from, to])

  async function upload(file: File) {
    setBusy(true); setMsg(null)
    try {
      const statements = await parseClientBank(file)
      const parts: string[] = []
      let warn = false
      for (const st of statements) {
        const r = await rpc<any>('bank_import', { p_file: st })
        parts.push(`счёт …${st.account.slice(-4)}: новых операций ${r.added}${r.skipped ? `, уже были ${r.skipped}` : ''}, зачислено арендаторам ${r.credited}, не распознано ${r.unrecognized}` +
          (r.check === 'mismatch' ? `. Сверка с банком не сошлась: ${r.check_note}` : ''))
        if (r.check === 'mismatch' || r.unrecognized > 0) warn = true
      }
      setMsg({ tone: warn ? 'amber' : 'green', text: 'Выписка загружена — ' + parts.join('; ') + '.' })
      if (statements.some(s => s.date_from)) { const f = statements.map(s => s.date_from!).filter(Boolean).sort()[0]; if (f < from) setFrom(f) }
      await load()
    } catch (e: any) { setMsg({ tone: 'red', text: e.message }) }
    setBusy(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function askAi() {
    setBusy(true); setMsg(null)
    try {
      const r = await apiFetch('/api/match-transactions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
      const j = await r.json()
      if (!j.ok) throw new Error(j.error || 'Подсказки не получены')
      const h: typeof hints = {}
      for (const m of j.matches || []) if (m.tx_id) h[m.tx_id] = { tenant_id: m.tenant_id, note: m.note || '' }
      setHints(h)
    } catch (e: any) { setMsg({ tone: 'red', text: e.message }) }
    setBusy(false)
  }

  const list = txs || []
  const credits = list.filter(t => t.direction === 'credit')
  const debits = list.filter(t => t.direction === 'debit')
  const sum = (rows: Tx[]) => rows.reduce((s, t) => s + Number(t.amount), 0)
  const autoShare = useMemo(() => {
    const c = credits.filter(t => t.status === 'credited')
    return c.length ? Math.round(c.filter(t => t.match_note !== 'разобрано вручную').length / c.length * 100) : 0
  }, [txs])

  const txCols = (showTenant: boolean) => [
    { key: 'd', title: 'Дата', render: (t: Tx) => dateRu(t.date) },
    { key: 'c', title: 'Контрагент и назначение', render: (t: Tx) => <><div>{t.counterparty || '—'}{(t.payer_inn || t.counter_inn) && <span style={{ color: C.faint, fontSize: 12 }}> · ИНН {t.payer_inn || t.counter_inn}</span>}</div><div style={{ fontSize: 12, color: C.muted, maxWidth: 520 }}>{t.description}</div></> },
    ...(showTenant ? [{ key: 't', title: 'Арендатор', render: (t: Tx) => t.tenant_id ? <a href={'/settlements/' + t.tenant_id} style={{ color: C.accent, textDecoration: 'none' }}>{t.tenants?.full_name}</a> : '—' }] : []),
    { key: 'a', title: 'Сумма', align: 'right' as const, render: (t: Tx) => <span style={{ color: t.direction === 'credit' ? C.green : C.red }}>{t.direction === 'credit' ? '+' : '−'}{money(t.amount)}</span> },
    { key: 's', title: 'Статус', render: (t: Tx) => <><Badge tone={STATUS[t.status]?.tone}>{STATUS[t.status]?.label || t.status}</Badge>{t.match_note && t.status === 'credited' && <div style={{ fontSize: 12, color: C.faint, marginTop: 2 }}>{t.match_note}</div>}</> },
  ]

  return (
    <Page actions={<>
      <input ref={fileRef} type="file" accept=".txt" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && upload(e.target.files[0])} />
      <Button onClick={() => { go('/reconcile') }}>Сверка расходов</Button>
      <Button kind="primary" disabled={busy} onClick={() => fileRef.current?.click()}>{busy ? 'Загружаем…' : 'Загрузить выписку'}</Button>
    </>}>
      <Notice>Выписку берите в СберБизнес: «Выписка» → период → «Экспорт» → «в 1С» (файл kl_to_1c.txt). Поступления с ИНН арендатора зачисляются сами и гасят долги по очереди. Повторная загрузка того же дня ничего не задваивает.</Notice>
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      <div style={{ display: 'flex', gap: 8, alignItems: 'end', flexWrap: 'wrap' }}>
        <Field label="С"><input type="date" style={inputStyle} value={from} onChange={e => setFrom(e.target.value)} /></Field>
        <Field label="По"><input type="date" style={inputStyle} value={to} onChange={e => setTo(e.target.value)} /></Field>
      </div>
      <Stats>
        <Stat label="Поступило" value={money(sum(credits))} tone="green" />
        <Stat label="Списано" value={money(sum(debits))} />
        <Stat label="Зачислено автоматически" value={`${autoShare}%`} />
        <Stat label="Не распознано" value={unrec.length} tone={unrec.length ? 'amber' : undefined} />
      </Stats>
      <Tabs<Tab> value={tab} onChange={setTab} tabs={[['in', 'Поступления'], ['unrec', `Не распознано${unrec.length ? ' · ' + unrec.length : ''}`], ['out', 'Расходы'], ['files', 'Выписки']]} />

      {txs === null ? <Loading /> : <>
        {tab === 'in' && <Card pad={false}><Table rows={credits} rowKey={t => t.id} cols={txCols(true)} empty="Поступлений за период нет. Загрузите выписку." /></Card>}
        {tab === 'out' && <Card pad={false}><Table rows={debits} rowKey={t => t.id} cols={txCols(false)} empty="Списаний за период нет" /></Card>}
        {tab === 'unrec' && (
          <Card pad={false} title="Плательщик не определён" actions={unrec.length > 0 && <Button small disabled={busy} onClick={askAi}>Подсказать по названиям</Button>}>
            <Table rows={unrec} rowKey={t => t.id} empty="Все поступления разобраны" cols={[
              ...txCols(false).filter(c => c.key !== 's'),
              { key: 'x', title: '', render: (t: Tx) => {
                const h = hints[t.id]; const ht = h?.tenant_id ? tenants.find(x => x.id === h.tenant_id) : null
                return (
                  <div style={{ display: 'grid', gap: 4, justifyItems: 'end' }}>
                    {ht && <div style={{ fontSize: 12, color: C.muted, textAlign: 'right' }}>Похоже: <b>{ht.full_name}</b></div>}
                    <div style={{ display: 'flex', gap: 4 }}>
                      <Button small kind="primary" onClick={() => setAssign({ tx: t, tenant: ht?.id })}>Зачислить</Button>
                      <Button small kind="ghost" onClick={() => setAssign({ tx: t, note: '' })}>Не арендатор</Button>
                    </div>
                  </div>
                )
              } },
            ]} />
          </Card>
        )}
        {tab === 'files' && (
          <Card pad={false}>
            <Table rows={files} rowKey={f => f.id} empty="Выписки ещё не загружались" cols={[
              { key: 'd', title: 'Загружена', render: f => dateRu(f.created_at) },
              { key: 'p', title: 'Период', render: f => `${dateRu(f.date_from)} — ${dateRu(f.date_to)}` },
              { key: 'a', title: 'Счёт', render: f => '…' + f.account.slice(-4) },
              { key: 'o', title: 'Остаток на начало', align: 'right', render: f => f.opening == null ? '—' : money(f.opening) },
              { key: 'i', title: 'Поступило', align: 'right', render: f => f.total_in == null ? '—' : money(f.total_in) },
              { key: 'x', title: 'Списано', align: 'right', render: f => f.total_out == null ? '—' : money(f.total_out) },
              { key: 'c', title: 'Остаток на конец', align: 'right', render: f => f.closing == null ? '—' : money(f.closing) },
              { key: 'n', title: 'Операций', align: 'right', render: f => `${f.added}${f.skipped ? ` (+${f.skipped} повтор)` : ''}` },
              { key: 's', title: 'Сверка', render: f => f.check_status === 'ok' ? <Badge tone="green">сошлась</Badge> : <><Badge tone="red">расхождение</Badge><div style={{ fontSize: 12, color: C.red, marginTop: 2 }}>{f.check_note}</div></> },
            ]} />
          </Card>
        )}
      </>}

      {assign && assign.note === undefined && (
        <AssignDialog tx={assign.tx} tenants={tenants} initial={assign.tenant} onClose={() => setAssign(null)} onDone={() => { setAssign(null); load() }} />
      )}
      {assign && assign.note !== undefined && (
        <IgnoreDialog tx={assign.tx} onClose={() => setAssign(null)} onDone={() => { setAssign(null); load() }} />
      )}
    </Page>
  )
}

function AssignDialog({ tx, tenants, initial, onClose, onDone }: { tx: Tx; tenants: { id: string; full_name: string; inn: string | null }[]; initial?: string; onClose: () => void; onDone: () => void }) {
  const [tenant, setTenant] = useState(initial || '')
  const [q, setQ] = useState('')
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const shown = tenants.filter(t => !q || t.full_name.toLowerCase().includes(q.toLowerCase()) || (t.inn || '').includes(q))
  async function go() {
    setBusy(true); setError('')
    try { await rpc('bank_assign', { p_tx: tx.id, p_tenant: tenant, p_remember: remember }); onDone() } catch (e: any) { setError(e.message) }
    setBusy(false)
  }
  return (
    <Modal title={`Зачислить ${money(tx.amount)} от ${tx.counterparty || 'плательщика'}`} onClose={onClose}
      footer={<><Button onClick={onClose}>Отмена</Button><Button kind="primary" disabled={!tenant || busy} onClick={go}>Зачислить</Button></>}>
      <div style={{ fontSize: 13, color: C.muted }}>{tx.description}</div>
      <Field label="Арендатор">
        <input style={inputStyle} placeholder="Поиск по названию или ИНН" value={q} onChange={e => setQ(e.target.value)} />
        <select style={inputStyle} size={6} value={tenant} onChange={e => setTenant(e.target.value)}>
          {shown.map(t => <option key={t.id} value={t.id}>{t.full_name}{t.inn ? ` · ${t.inn}` : ''}</option>)}
        </select>
      </Field>
      <label style={{ display: 'flex', gap: 8, fontSize: 13 }}><input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} /> Запомнить плательщика: его следующие платежи зачислятся этому арендатору сами</label>
      <Notice>Деньги зачисляются целиком и сами гасят долги арендатора по очереди; остаток станет авансом.</Notice>
      {error && <Notice tone="red">{error}</Notice>}
    </Modal>
  )
}

function IgnoreDialog({ tx, onClose, onDone }: { tx: Tx; onClose: () => void; onDone: () => void }) {
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  async function go() {
    try { await rpc('bank_ignore', { p_tx: tx.id, p_note: note }); onDone() } catch (e: any) { setError(e.message) }
  }
  return (
    <Modal title="Поступление не от арендатора" onClose={onClose} footer={<><Button onClick={onClose}>Отмена</Button><Button kind="primary" onClick={go}>Отметить</Button></>}>
      <div style={{ fontSize: 13, color: C.muted }}>{money(tx.amount)} · {tx.counterparty} · {tx.description}</div>
      <Field label="Что это"><input style={inputStyle} value={note} onChange={e => setNote(e.target.value)} placeholder="Например: возврат от поставщика, проценты банка" autoFocus /></Field>
      {error && <Notice tone="red">{error}</Notice>}
    </Modal>
  )
}
