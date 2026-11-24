// Расчёты с арендаторами по учётному ядру: оборотная ведомость, депозиты, статьи, самопроверка
// и карточка расчётов арендатора с операциями (оплата, начисление, сторно, депозит, возврат, акт сверки).
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  rpc, loadArticles, summarize, DOC_TYPE, PAY_STATUS, INVOICE_KIND,
  type Article, type ChargeState, type DepositRow, type DocRow, type Lease, type TurnoverRow, type InvoiceState,
} from '../lib/accounting'
import {
  Page, Card, Button, Badge, Stat, Stats, Table, Field, Modal, Notice, Tabs, Loading, inputStyle, money, dateRu, monthRu, today, monthStart, C, type Col,
} from '../components/ui'

const go = (page: string, id?: string) => { window.location.hash = '/' + page + (id ? '/' + id : '') }

export default function SettlementsPage({ tenantId }: { tenantId?: string | null }) {
  return tenantId ? <TenantSettlement key={tenantId} tenantId={tenantId} /> : <Overview />
}

// ── Обзор ────────────────────────────────────────────────────────────────────
type Tab = 'turnover' | 'deposits' | 'articles' | 'check'

function Overview() {
  const [tab, setTab] = useState<Tab>('turnover')
  return (
    <Page>
      <Tabs<Tab> value={tab} onChange={setTab} tabs={[['turnover', 'Оборотная ведомость'], ['deposits', 'Депозиты'], ['articles', 'Статьи учёта'], ['check', 'Самопроверка']]} />
      {tab === 'turnover' && <Turnover />}
      {tab === 'deposits' && <Deposits />}
      {tab === 'articles' && <Articles />}
      {tab === 'check' && <SelfCheck />}
    </Page>
  )
}

function PeriodPicker({ from, to, onChange }: { from: string; to: string; onChange: (f: string, t: string) => void }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'end', flexWrap: 'wrap' }}>
      <Field label="С"><input type="date" style={inputStyle} value={from} onChange={e => onChange(e.target.value, to)} /></Field>
      <Field label="По"><input type="date" style={inputStyle} value={to} onChange={e => onChange(from, e.target.value)} /></Field>
    </div>
  )
}

interface TenantTotals { tenant_id: string; tenant_name: string; opening: number; charged: number; paid: number; debt: number; advance: number; deposit: number; balance: number; rows: TurnoverRow[] }

function Turnover() {
  const [from, setFrom] = useState(monthStart())
  const [to, setTo] = useState(today())
  const [rows, setRows] = useState<TurnoverRow[] | null>(null)
  const [error, setError] = useState('')
  const [byArticle, setByArticle] = useState(false)
  const [q, setQ] = useState('')

  useEffect(() => {
    setRows(null); setError('')
    rpc<TurnoverRow[]>('ledger_turnover', { p_from: from, p_to: to, p_tenant: null }).then(setRows).catch(e => setError(e.message))
  }, [from, to])

  const tenants = useMemo<TenantTotals[]>(() => {
    const m = new Map<string, TurnoverRow[]>()
    for (const r of rows || []) m.set(r.tenant_id, [...(m.get(r.tenant_id) || []), r])
    return [...m.entries()].map(([id, rs]) => {
      const s = summarize(rs)
      return { tenant_id: id, tenant_name: rs[0].tenant_name, opening: s.opening, charged: s.charged, paid: s.paidOff, debt: s.debt, advance: s.advance, deposit: s.deposit, balance: s.balance, rows: rs }
    }).filter(t => !q || t.tenant_name.toLowerCase().includes(q.toLowerCase()))
      .sort((a, b) => b.balance - a.balance)
  }, [rows, q])

  const total = tenants.reduce((s, t) => ({ opening: s.opening + t.opening, charged: s.charged + t.charged, paid: s.paid + t.paid, debt: s.debt + t.debt, advance: s.advance + t.advance, deposit: s.deposit + t.deposit, balance: s.balance + t.balance }),
    { opening: 0, charged: 0, paid: 0, debt: 0, advance: 0, deposit: 0, balance: 0 })

  const cols: Col<TenantTotals>[] = [
    { key: 'n', title: 'Арендатор', render: t => (
      <div>
        <div style={{ fontWeight: 500 }}>{t.tenant_name}</div>
        {byArticle && t.rows.filter(r => r.register === 'receivable').map(r => (
          <div key={r.article_code} style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{r.article_name}</div>
        ))}
      </div>
    ) },
    ...(['opening', 'charged', 'paid', 'debt', 'advance', 'deposit'] as const).map(k => ({
      key: k, align: 'right' as const,
      title: { opening: 'Сальдо на начало', charged: 'Начислено', paid: 'Погашено', debt: 'Долг', advance: 'Аванс', deposit: 'Депозит' }[k],
      render: (t: TenantTotals) => (
        <div>
          <div style={{ color: k === 'debt' && t.debt > 0 ? C.red : k === 'advance' && t.advance > 0 ? C.green : undefined }}>{money(t[k], { zero: '—' })}</div>
          {byArticle && t.rows.filter(r => r.register === 'receivable').map(r => (
            <div key={r.article_code} style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
              {k === 'opening' ? money(r.opening, { zero: '—' }) : k === 'charged' ? money(r.debit, { zero: '—' }) : k === 'paid' ? money(r.credit, { zero: '—' }) : k === 'debt' ? money(r.closing, { zero: '—' }) : ''}
            </div>
          ))}
        </div>
      ),
    })),
  ]

  return (
    <>
      <div style={{ display: 'flex', gap: 12, alignItems: 'end', flexWrap: 'wrap' }}>
        <PeriodPicker from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t) }} />
        <Field label="Поиск"><input style={{ ...inputStyle, width: 240 }} value={q} onChange={e => setQ(e.target.value)} placeholder="Название арендатора" /></Field>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13, paddingBottom: 8 }}>
          <input type="checkbox" checked={byArticle} onChange={e => setByArticle(e.target.checked)} /> по статьям
        </label>
      </div>
      {error && <Notice tone="red">{error}</Notice>}
      <Stats>
        <Stat label="Долг арендаторов" value={money(total.debt)} tone={total.debt > 0 ? 'red' : undefined} />
        <Stat label="Авансы" value={money(total.advance)} tone="green" />
        <Stat label="Депозиты на хранении" value={money(total.deposit)} />
        <Stat label="Начислено за период" value={money(total.charged)} />
        <Stat label="Погашено за период" value={money(total.paid)} />
      </Stats>
      <Card pad={false}>
        {rows === null ? <Loading /> : (
          <Table cols={cols} rows={tenants} rowKey={t => t.tenant_id} onRow={t => go('settlements', t.tenant_id)}
            empty="Движений нет. Начисления появятся после проведения биллинга за месяц."
            foot={tenants.length > 0 && (
              <tr style={{ fontWeight: 600 }}>
                <td style={{ padding: '8px 12px' }}>Итого</td>
                {(['opening', 'charged', 'paid', 'debt', 'advance', 'deposit'] as const).map(k => (
                  <td key={k} style={{ padding: '8px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>{money(total[k])}</td>
                ))}
              </tr>
            )} />
        )}
      </Card>
    </>
  )
}

function Deposits() {
  const [rows, setRows] = useState<DepositRow[] | null>(null)
  useEffect(() => { supabase.from('v_deposits').select('*').order('tenant_name').then(({ data }) => setRows((data || []) as DepositRow[])) }, [])
  const list = (rows || []).filter(r => Number(r.deposit_required) > 0 || Number(r.requested) !== 0 || Number(r.held) !== 0)
  const sum = (k: keyof DepositRow) => list.reduce((s, r) => s + Number(r[k] || 0), 0)
  return (
    <>
      <Stats>
        <Stat label="Требуется по договорам" value={money(sum('deposit_required'))} />
        <Stat label="На хранении" value={money(sum('held'))} />
        <Stat label="Недовнесено" value={money(list.reduce((s, r) => s + Math.max(0, Number(r.shortfall)), 0))} tone="amber" />
      </Stats>
      <Card pad={false}>
        {rows === null ? <Loading /> : (
          <Table rows={list} rowKey={r => r.lease_id} onRow={r => go('settlements', r.tenant_id)} empty="Депозитов пока нет: требуемая сумма задаётся в договоре, внесение — требованием в расчётах арендатора" cols={[
            { key: 't', title: 'Арендатор', render: r => r.tenant_name },
            { key: 'n', title: 'Договор', render: r => r.number || '—' },
            { key: 'r', title: 'Требуется', align: 'right', render: r => money(r.deposit_required, { zero: '—' }) },
            { key: 'q', title: 'Выставлено', align: 'right', render: r => money(r.requested, { zero: '—' }) },
            { key: 'h', title: 'На хранении', align: 'right', render: r => money(r.held, { zero: '—' }) },
            { key: 's', title: 'Недовнесено', align: 'right', render: r => Number(r.shortfall) > 0 ? <span style={{ color: C.amber }}>{money(r.shortfall)}</span> : '—' },
          ]} />
        )}
      </Card>
    </>
  )
}

function Articles() {
  const [list, setList] = useState<Article[] | null>(null)
  const [edit, setEdit] = useState<(Partial<Article> & { isNew?: boolean }) | null>(null)
  const [error, setError] = useState('')
  const load = () => loadArticles().then(setList).catch(e => setError(e.message))
  useEffect(() => { load() }, [])

  async function save() {
    if (!edit) return
    setError('')
    const row = {
      code: (edit.code || '').trim().toUpperCase(), name: (edit.name || '').trim(), grp: (edit.grp || '').trim() || 'Прочее',
      register: edit.register || 'receivable', priority: Number(edit.priority || 100),
      keywords: typeof edit.keywords === 'string' ? String(edit.keywords).split(',').map(s => s.trim()).filter(Boolean) : edit.keywords || [],
      vat_rate: edit.vat_rate === null || edit.vat_rate === undefined || String(edit.vat_rate) === '' ? null : Number(edit.vat_rate),
      onec_account: edit.onec_account || null, onec_item: edit.onec_item || null, active: edit.active !== false,
    }
    if (!/^[A-Z0-9_]{2,20}$/.test(row.code) || !row.name) { setError('Нужны код (латиница, цифры, _) и название'); return }
    if (edit.isNew && (list || []).some(a => a.code === row.code)) { setError('Статья с таким кодом уже есть'); return }
    const { error } = await supabase.from('accounting_articles').upsert(row)
    if (error) { setError(error.message); return }
    setEdit(null); load()
  }

  return (
    <>
      <Notice>Статья — то, за что начисляем и что гасим оплатой. Очередь погашения: сначала более ранний срок оплаты, при равном сроке — меньший номер очереди. Ключевые слова помогают узнать статью в назначении платежа.</Notice>
      {error && <Notice tone="red">{error}</Notice>}
      <Card pad={false} title="Статьи учёта" actions={<Button kind="primary" small onClick={() => setEdit({ register: 'receivable', priority: 80, active: true, grp: 'Услуги', isNew: true })}>Новая статья</Button>}>
        {list === null ? <Loading /> : (
          <Table rows={list} rowKey={a => a.code} onRow={a => setEdit({ ...a, keywords: a.keywords.join(', ') as any })} cols={[
            { key: 'q', title: 'Очередь', align: 'right', width: 70, render: a => a.priority },
            { key: 'n', title: 'Статья', render: a => <span style={{ color: a.active ? undefined : C.faint }}>{a.name}</span> },
            { key: 'g', title: 'Группа', render: a => a.grp },
            { key: 'r', title: 'Регистр', render: a => a.register === 'deposit' ? <Badge tone="amber">Депозит</Badge> : <Badge>Расчёты</Badge> },
            { key: 'k', title: 'Ключевые слова', render: a => <span style={{ color: C.muted }}>{a.keywords.join(', ')}</span> },
            { key: 'c', title: 'Код', render: a => <code style={{ fontSize: 12, color: C.muted }}>{a.code}</code> },
          ]} />
        )}
      </Card>
      {edit && (
        <Modal title={edit.isNew ? 'Новая статья' : 'Статья'} onClose={() => setEdit(null)}
          footer={<><Button onClick={() => setEdit(null)}>Отмена</Button><Button kind="primary" onClick={save}>Сохранить</Button></>}>
          <Field label="Название"><input style={inputStyle} value={edit.name || ''} onChange={e => setEdit({ ...edit, name: e.target.value })} /></Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Код"><input style={inputStyle} value={edit.code || ''} disabled={!edit.isNew} onChange={e => setEdit({ ...edit, code: e.target.value })} /></Field>
            <Field label="Группа"><input style={inputStyle} value={edit.grp || ''} onChange={e => setEdit({ ...edit, grp: e.target.value })} /></Field>
            <Field label="Очередь погашения"><input type="number" style={inputStyle} value={edit.priority ?? ''} onChange={e => setEdit({ ...edit, priority: Number(e.target.value) })} /></Field>
            <Field label="Ставка НДС, %" hint="пусто — без НДС"><input type="number" style={inputStyle} value={edit.vat_rate ?? ''} onChange={e => setEdit({ ...edit, vat_rate: e.target.value === '' ? null : Number(e.target.value) })} /></Field>
            <Field label="Счёт в 1С"><input style={inputStyle} value={edit.onec_account || ''} onChange={e => setEdit({ ...edit, onec_account: e.target.value })} /></Field>
            <Field label="Номенклатура в 1С"><input style={inputStyle} value={edit.onec_item || ''} onChange={e => setEdit({ ...edit, onec_item: e.target.value })} /></Field>
          </div>
          <Field label="Ключевые слова" hint="через запятую, части слов из назначения платежа"><input style={inputStyle} value={(edit.keywords as any) || ''} onChange={e => setEdit({ ...edit, keywords: e.target.value as any })} /></Field>
          <label style={{ display: 'flex', gap: 8, fontSize: 13 }}><input type="checkbox" checked={edit.active !== false} onChange={e => setEdit({ ...edit, active: e.target.checked })} /> Статья используется</label>
        </Modal>
      )}
    </>
  )
}

function SelfCheck() {
  const [rows, setRows] = useState<any[] | null>(null)
  const [error, setError] = useState('')
  const run = () => { setRows(null); setError(''); rpc<any[]>('verify_ledger').then(setRows).catch(e => setError(e.message)) }
  useEffect(run, [])
  return (
    <>
      <Notice>Самопроверка пересчитывает все остатки из документов (начислений, оплат, разнесений) и сравнивает с регистром движений. Расхождений быть не должно.</Notice>
      {error && <Notice tone="red">{error}</Notice>}
      {rows === null ? <Loading /> : rows.length === 0
        ? <Notice tone="green">Расхождений нет: остатки по регистру совпадают с документами.</Notice>
        : <Card pad={false} title={`Расхождения: ${rows.length}`}>
            <Table rows={rows} rowKey={r => r.problem + r.tenant_id + r.register + r.key} cols={[
              { key: 'p', title: 'Что не так', render: r => r.problem },
              { key: 'r', title: 'Регистр', render: r => r.register },
              { key: 'd', title: 'По документам', align: 'right', render: r => money(r.from_documents) },
              { key: 'l', title: 'По регистру', align: 'right', render: r => money(r.from_postings) },
            ]} />
          </Card>}
      <div><Button onClick={run}>Проверить ещё раз</Button></div>
    </>
  )
}

// ── Карточка расчётов арендатора ─────────────────────────────────────────────
type Dialog = null | 'payment' | 'charge' | 'refund' | 'deposit_require' | 'deposit_offset' | { storno: ChargeState } | { storno_payment: DocRow }

function TenantSettlement({ tenantId }: { tenantId: string }) {
  const [tenant, setTenant] = useState<any>(null)
  const [from, setFrom] = useState(() => new Date().getFullYear() + '-01-01')
  const [to, setTo] = useState(today())
  const [turn, setTurn] = useState<TurnoverRow[]>([])
  const [open, setOpen] = useState<ChargeState[]>([])
  const [docs, setDocs] = useState<DocRow[]>([])
  const [leases, setLeases] = useState<Lease[]>([])
  const [deposits, setDeposits] = useState<DepositRow[]>([])
  const [invoices, setInvoices] = useState<InvoiceState[]>([])
  const [articles, setArticles] = useState<Article[]>([])
  const [articleFilter, setArticleFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [dialog, setDialog] = useState<Dialog>(null)

  async function load() {
    setLoading(true); setError('')
    try {
      const [t, tr, oc, dc, ls, dp, inv, arts] = await Promise.all([
        supabase.from('tenants').select('id, full_name, inn').eq('id', tenantId).single(),
        rpc<TurnoverRow[]>('ledger_turnover', { p_from: from, p_to: to, p_tenant: tenantId }),
        supabase.from('v_charge_state').select('*').eq('tenant_id', tenantId).gt('open_amount', 0).order('due_date'),
        supabase.from('v_tenant_documents').select('*').eq('tenant_id', tenantId).order('date', { ascending: false }).order('created_at', { ascending: false }).limit(500),
        supabase.from('leases').select('*').eq('tenant_id', tenantId).order('start_date', { ascending: false }),
        supabase.from('v_deposits').select('*').eq('tenant_id', tenantId),
        supabase.from('v_invoice_state').select('*').eq('tenant_id', tenantId).order('date', { ascending: false }).limit(24),
        loadArticles(),
      ])
      setTenant(t.data); setTurn(tr); setOpen((oc.data || []) as ChargeState[]); setDocs((dc.data || []) as DocRow[])
      setLeases((ls.data || []) as Lease[]); setDeposits((dp.data || []) as DepositRow[]); setInvoices((inv.data || []) as InvoiceState[]); setArticles(arts)
    } catch (e: any) { setError(e.message) }
    setLoading(false)
  }
  useEffect(() => { load() }, [tenantId, from, to])

  const s = summarize(turn)
  const depositHeld = deposits.reduce((x, d) => x + Number(d.held), 0)
  const depositRequired = deposits.reduce((x, d) => x + Number(d.deposit_required), 0)
  const docsShown = articleFilter ? docs.filter(d => d.article_code === articleFilter) : docs
  const done = () => { setDialog(null); load() }

  if (loading && !tenant) return <Loading />
  return (
    <Page title={tenant ? `Расчёты: ${tenant.full_name}` : 'Расчёты'} actions={<>
      <Button onClick={() => go('settlements')}>Все арендаторы</Button>
      <Button onClick={() => go('tenant-card', tenantId)}>Карточка арендатора</Button>
      <Button onClick={() => printAct(tenant, from, to, articleFilter, articles)}>Акт сверки</Button>
      <Button kind="primary" onClick={() => setDialog('payment')}>Внести оплату</Button>
    </>}>
      {error && <Notice tone="red">{error}</Notice>}
      <div style={{ display: 'flex', gap: 12, alignItems: 'end', flexWrap: 'wrap' }}>
        <PeriodPicker from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t) }} />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingBottom: 1 }}>
          <Button onClick={() => setDialog('charge')}>Начислить</Button>
          <Button onClick={() => setDialog('deposit_require')} disabled={!leases.length}>Требовать депозит</Button>
          <Button onClick={() => setDialog('deposit_offset')} disabled={!depositHeld || !open.length}>Зачесть депозит</Button>
          <Button onClick={() => setDialog('refund')}>Возврат</Button>
        </div>
      </div>
      <Stats>
        <Stat label={s.balance >= 0 ? 'Итого к оплате' : 'Переплата'} value={money(Math.abs(s.balance))} tone={s.balance > 0 ? 'red' : s.balance < 0 ? 'green' : undefined} />
        <Stat label="Долг по статьям" value={money(s.debt)} tone={s.debt > 0 ? 'red' : undefined} />
        <Stat label="Аванс" value={money(s.advance)} tone={s.advance > 0 ? 'green' : undefined} />
        <Stat label="Депозит: внесено / требуется" value={`${money(depositHeld)} / ${money(depositRequired)}`} tone={depositHeld < depositRequired ? 'amber' : undefined} />
      </Stats>
      {!leases.length && <Notice tone="amber">У арендатора нет договора в Маяке — ежемесячные начисления по нему не создаются. Заведите договор в разделе «Договоры».</Notice>}

      <Card pad={false} title="Сальдо по статьям за период">
        <Table rows={turn.filter(r => r.register === 'receivable')} rowKey={r => String(r.article_code)} empty="Движений за период нет" cols={[
          { key: 'a', title: 'Статья', render: r => r.article_name },
          { key: 'o', title: 'На начало', align: 'right', render: r => money(r.opening, { zero: '—' }) },
          { key: 'd', title: 'Начислено', align: 'right', render: r => money(r.debit, { zero: '—' }) },
          { key: 'c', title: 'Оплачено', align: 'right', render: r => money(r.credit, { zero: '—' }) },
          { key: 'z', title: 'Долг на конец', align: 'right', render: r => <span style={{ color: Number(r.closing) > 0 ? C.red : undefined }}>{money(r.closing, { zero: '—' })}</span> },
        ]} foot={turn.length > 0 && (
          <>
            <tr><td style={{ padding: '8px 12px', color: C.muted }}>Аванс (не разнесённые деньги)</td><td colSpan={3} /><td style={{ padding: '8px 12px', textAlign: 'right', color: C.green }}>−{money(s.advance)}</td></tr>
            <tr style={{ fontWeight: 600 }}><td style={{ padding: '8px 12px' }}>Общий баланс</td><td colSpan={3} /><td style={{ padding: '8px 12px', textAlign: 'right' }}>{money(s.balance)}</td></tr>
          </>
        )} />
      </Card>

      <Card pad={false} title={`Неоплаченные начисления: ${open.length}`}>
        <Table rows={open} rowKey={c => c.id} empty="Всё оплачено" cols={[
          { key: 'a', title: 'Статья', render: c => <><div>{c.article_name}</div><div style={{ fontSize: 12, color: C.muted }}>{c.description}</div></> },
          { key: 'p', title: 'Период', render: c => c.period ? monthRu(c.period) : '—' },
          { key: 's', title: 'Начислено', align: 'right', render: c => money(c.effective_amount) },
          { key: 'pd', title: 'Оплачено', align: 'right', render: c => money(c.paid, { zero: '—' }) },
          { key: 'o', title: 'Остаток', align: 'right', render: c => <b>{money(c.open_amount)}</b> },
          { key: 'd', title: 'Срок', render: c => <>{dateRu(c.due_date)}{c.days_overdue > 0 && <div><Badge tone="red">просрочка {c.days_overdue} дн.</Badge></div>}</> },
          { key: 'x', title: '', render: c => <Button small kind="danger" onClick={() => setDialog({ storno: c })}>Сторно</Button> },
        ]} />
      </Card>

      {deposits.length > 0 && (
        <Card pad={false} title="Депозит по договорам">
          <Table rows={deposits} rowKey={d => d.lease_id} cols={[
            { key: 'n', title: 'Договор', render: d => d.number || '—' },
            { key: 'r', title: 'Требуется', align: 'right', render: d => money(d.deposit_required, { zero: '—' }) },
            { key: 'q', title: 'Выставлено', align: 'right', render: d => money(d.requested, { zero: '—' }) },
            { key: 'h', title: 'На хранении', align: 'right', render: d => money(d.held, { zero: '—' }) },
            { key: 's', title: 'Недовнесено', align: 'right', render: d => Number(d.shortfall) > 0 ? <span style={{ color: C.amber }}>{money(d.shortfall)}</span> : '—' },
          ]} />
        </Card>
      )}

      {invoices.length > 0 && (
        <Card pad={false} title="Счета">
          <Table rows={invoices} rowKey={i => i.id} onRow={i => go('invoices', i.id)} cols={[
            { key: 'n', title: 'Счёт', render: i => <>№ {i.number}<div style={{ fontSize: 12, color: C.muted }}>{INVOICE_KIND[i.kind] || i.kind}</div></> },
            { key: 'p', title: 'Период', render: i => monthRu(i.period) },
            { key: 't', title: 'Сумма', align: 'right', render: i => money(i.total) },
            { key: 'o', title: 'Остаток', align: 'right', render: i => money(i.open_amount, { zero: '—' }) },
            { key: 's', title: 'Статус', render: i => { const p = PAY_STATUS[i.pay_status]; return <Badge tone={p?.tone}>{p?.label || i.pay_status}</Badge> } },
          ]} />
        </Card>
      )}

      <Card pad={false} title="Карточка расчётов" actions={
        <select style={{ ...inputStyle, width: 220 }} value={articleFilter} onChange={e => setArticleFilter(e.target.value)}>
          <option value="">Все статьи</option>
          {articles.map(a => <option key={a.code} value={a.code}>{a.name}</option>)}
        </select>
      }>
        <Table rows={docsShown} rowKey={d => d.doc_type + d.doc_id} empty="Документов нет" cols={[
          { key: 'd', title: 'Дата', render: d => dateRu(d.date) },
          { key: 't', title: 'Документ', render: d => <>{DOC_TYPE[d.doc_type] || d.doc_type}{d.article_name && <div style={{ fontSize: 12, color: C.muted }}>{d.article_name}</div>}</> },
          { key: 'x', title: 'Содержание', render: d => <span style={{ color: C.muted }}>{d.description}</span> },
          { key: 'c', title: 'Начислено', align: 'right', render: d => money(d.charged, { zero: '' }) },
          { key: 'p', title: 'Оплачено', align: 'right', render: d => money(d.paid, { zero: '' }) },
          { key: 'a', title: '', render: d => d.doc_type === 'payment' ? <Button small kind="ghost" onClick={() => setDialog({ storno_payment: d })}>Сторно</Button> : null },
        ]} />
      </Card>

      {dialog === 'payment' && <PaymentDialog tenantId={tenantId} onClose={() => setDialog(null)} onDone={done} />}
      {dialog === 'charge' && <ChargeDialog tenantId={tenantId} leases={leases} articles={articles} onClose={() => setDialog(null)} onDone={done} />}
      {dialog === 'refund' && <RefundDialog tenantId={tenantId} leases={leases} advance={s.advance} deposits={deposits} onClose={() => setDialog(null)} onDone={done} />}
      {dialog === 'deposit_require' && <DepositRequireDialog leases={leases} deposits={deposits} onClose={() => setDialog(null)} onDone={done} />}
      {dialog === 'deposit_offset' && <DepositOffsetDialog leases={leases} deposits={deposits} open={open.filter(c => c.register === 'receivable')} onClose={() => setDialog(null)} onDone={done} />}
      {dialog && typeof dialog === 'object' && 'storno' in dialog && (
        <ReasonDialog title={`Сторно: ${dialog.storno.article_name}, ${money(dialog.storno.effective_amount)}`}
          note="Начисление не удаляется: создаётся обратная запись, оплаты по нему вернутся в аванс и закроют другие долги."
          onClose={() => setDialog(null)} onSubmit={reason => rpc('storno_charge', { p_charge: dialog.storno.id, p_reason: reason }).then(done)} />
      )}
      {dialog && typeof dialog === 'object' && 'storno_payment' in dialog && (
        <ReasonDialog title={`Сторно оплаты от ${dateRu(dialog.storno_payment.date)} на ${money(dialog.storno_payment.paid)}`}
          note="Используйте, если оплата внесена ошибочно или дважды. Начисления, которые она закрывала, снова станут долгом."
          onClose={() => setDialog(null)} onSubmit={reason => rpc('storno_payment', { p_payment: dialog.storno_payment.doc_id, p_reason: reason }).then(done)} />
      )}
    </Page>
  )
}

// ── Диалоги ──────────────────────────────────────────────────────────────────
function useSubmit(onDone: () => void) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true); setError('')
    try { await fn(); onDone() } catch (e: any) { setError(e.message) }
    setBusy(false)
  }
  return { busy, error, run }
}
const num = (s: string) => Number(String(s).replace(/\s/g, '').replace(',', '.'))

function Footer({ busy, onClose, onSubmit, label }: { busy: boolean; onClose: () => void; onSubmit: () => void; label: string }) {
  return <><Button onClick={onClose}>Отмена</Button><Button kind="primary" disabled={busy} onClick={onSubmit}>{busy ? 'Проводим…' : label}</Button></>
}

function PaymentDialog({ tenantId, onClose, onDone }: { tenantId: string; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ date: today(), amount: '', source: 'manual', purpose: '' })
  const { busy, error, run } = useSubmit(onDone)
  return (
    <Modal title="Внести оплату" onClose={onClose} footer={<Footer busy={busy} onClose={onClose} label="Провести"
      onSubmit={() => run(() => rpc('post_payment', { p_tenant: tenantId, p_date: f.date, p_amount: num(f.amount), p_source: f.source, p_purpose: f.purpose || null }))} />}>
      <Notice>Деньги зачисляются арендатору целиком и сами закрывают долги по очереди: сначала с более ранним сроком. Остаток станет авансом.</Notice>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Дата поступления"><input type="date" style={inputStyle} value={f.date} onChange={e => setF({ ...f, date: e.target.value })} /></Field>
        <Field label="Сумма, ₽"><input inputMode="decimal" style={inputStyle} value={f.amount} onChange={e => setF({ ...f, amount: e.target.value })} autoFocus /></Field>
      </div>
      <Field label="Откуда"><select style={inputStyle} value={f.source} onChange={e => setF({ ...f, source: e.target.value })}>
        <option value="manual">Банк, внесено вручную</option><option value="cash">Касса</option>
      </select></Field>
      <Field label="Назначение платежа"><input style={inputStyle} value={f.purpose} onChange={e => setF({ ...f, purpose: e.target.value })} /></Field>
      {error && <Notice tone="red">{error}</Notice>}
    </Modal>
  )
}

function ChargeDialog({ tenantId, leases, articles, onClose, onDone }: { tenantId: string; leases: Lease[]; articles: Article[]; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ lease: leases[0]?.id || '', article: 'SERVICE', amount: '', due: today(), period: '', description: '' })
  const { busy, error, run } = useSubmit(onDone)
  return (
    <Modal title="Начислить" onClose={onClose} footer={<Footer busy={busy} onClose={onClose} label="Провести"
      onSubmit={() => run(() => rpc('post_charge', { p_tenant: tenantId, p_lease: f.lease || null, p_article: f.article, p_amount: num(f.amount), p_due: f.due,
        p_period: f.period ? f.period + '-01' : null, p_description: f.description || null }))} />}>
      <Field label="Статья"><select style={inputStyle} value={f.article} onChange={e => setF({ ...f, article: e.target.value })}>
        {articles.filter(a => a.active && a.register === 'receivable' && a.code !== 'OPENING').map(a => <option key={a.code} value={a.code}>{a.grp}: {a.name}</option>)}
      </select></Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Сумма, ₽"><input inputMode="decimal" style={inputStyle} value={f.amount} onChange={e => setF({ ...f, amount: e.target.value })} autoFocus /></Field>
        <Field label="Оплатить до"><input type="date" style={inputStyle} value={f.due} onChange={e => setF({ ...f, due: e.target.value })} /></Field>
        <Field label="За месяц" hint="необязательно"><input type="month" style={inputStyle} value={f.period} onChange={e => setF({ ...f, period: e.target.value })} /></Field>
        <Field label="Договор"><select style={inputStyle} value={f.lease} onChange={e => setF({ ...f, lease: e.target.value })}>
          <option value="">Без договора</option>
          {leases.map(l => <option key={l.id} value={l.id}>№ {l.number || 'без номера'}</option>)}
        </select></Field>
      </div>
      <Field label="Основание"><input style={inputStyle} value={f.description} onChange={e => setF({ ...f, description: e.target.value })} placeholder="Например: замена замка, акт от 12.11" /></Field>
      {error && <Notice tone="red">{error}</Notice>}
    </Modal>
  )
}

function DepositRequireDialog({ leases, deposits, onClose, onDone }: { leases: Lease[]; deposits: DepositRow[]; onClose: () => void; onDone: () => void }) {
  const first = leases[0]
  const short = (id: string) => Math.max(0, Number(deposits.find(d => d.lease_id === id)?.shortfall || 0))
  const [f, setF] = useState({ lease: first?.id || '', amount: first ? String(short(first.id) || '') : '', due: today(), reason: '' })
  const { busy, error, run } = useSubmit(onDone)
  return (
    <Modal title="Требование внести депозит" onClose={onClose} footer={<Footer busy={busy} onClose={onClose} label="Выставить"
      onSubmit={() => run(() => rpc('deposit_require', { p_lease: f.lease, p_amount: num(f.amount), p_due: f.due, p_reason: f.reason }))} />}>
      <Notice>Депозит — деньги арендатора на хранении. В долг по услугам он не входит; оплата сначала закрывает требования с более ранним сроком.</Notice>
      <Field label="Договор"><select style={inputStyle} value={f.lease} onChange={e => setF({ ...f, lease: e.target.value, amount: String(short(e.target.value) || '') })}>
        {leases.map(l => <option key={l.id} value={l.id}>№ {l.number || 'без номера'}</option>)}
      </select></Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Сумма, ₽"><input inputMode="decimal" style={inputStyle} value={f.amount} onChange={e => setF({ ...f, amount: e.target.value })} /></Field>
        <Field label="Внести до"><input type="date" style={inputStyle} value={f.due} onChange={e => setF({ ...f, due: e.target.value })} /></Field>
      </div>
      <Field label="Основание"><input style={inputStyle} value={f.reason} onChange={e => setF({ ...f, reason: e.target.value })} placeholder="Например: довнесение после индексации ставки" /></Field>
      {error && <Notice tone="red">{error}</Notice>}
    </Modal>
  )
}

function DepositOffsetDialog({ leases, deposits, open, onClose, onDone }: { leases: Lease[]; deposits: DepositRow[]; open: ChargeState[]; onClose: () => void; onDone: () => void }) {
  const withMoney = leases.filter(l => Number(deposits.find(d => d.lease_id === l.id)?.held || 0) > 0)
  const [f, setF] = useState({ lease: withMoney[0]?.id || '', charge: open[0]?.id || '', amount: open[0] ? String(open[0].open_amount) : '', reason: '' })
  const { busy, error, run } = useSubmit(onDone)
  const held = Number(deposits.find(d => d.lease_id === f.lease)?.held || 0)
  return (
    <Modal title="Зачесть депозит в счёт долга" onClose={onClose} footer={<Footer busy={busy} onClose={onClose} label="Зачесть"
      onSubmit={() => run(() => rpc('deposit_offset', { p_lease: f.lease, p_charge: f.charge, p_amount: num(f.amount), p_reason: f.reason }))} />}>
      <Field label="Договор" hint={`на депозите ${money(held)}`}><select style={inputStyle} value={f.lease} onChange={e => setF({ ...f, lease: e.target.value })}>
        {withMoney.map(l => <option key={l.id} value={l.id}>№ {l.number || 'без номера'}</option>)}
      </select></Field>
      <Field label="Какое начисление закрыть"><select style={inputStyle} value={f.charge} onChange={e => { const c = open.find(x => x.id === e.target.value); setF({ ...f, charge: e.target.value, amount: c ? String(Math.min(Number(c.open_amount), held)) : '' }) }}>
        {open.map(c => <option key={c.id} value={c.id}>{c.article_name}{c.period ? ', ' + monthRu(c.period) : ''} — остаток {money(c.open_amount)}</option>)}
      </select></Field>
      <Field label="Сумма, ₽"><input inputMode="decimal" style={inputStyle} value={f.amount} onChange={e => setF({ ...f, amount: e.target.value })} /></Field>
      <Field label="Основание зачёта"><input style={inputStyle} value={f.reason} onChange={e => setF({ ...f, reason: e.target.value })} placeholder="Например: письмо арендатора от 10.11, выезд" /></Field>
      {error && <Notice tone="red">{error}</Notice>}
    </Modal>
  )
}

function RefundDialog({ tenantId, leases, advance, deposits, onClose, onDone }: { tenantId: string; leases: Lease[]; advance: number; deposits: DepositRow[]; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ from: advance > 0 ? 'advance' : 'deposit', lease: leases[0]?.id || '', amount: advance > 0 ? String(advance) : '', date: today(), reason: '' })
  const { busy, error, run } = useSubmit(onDone)
  const held = Number(deposits.find(d => d.lease_id === f.lease)?.held || 0)
  return (
    <Modal title="Возврат арендатору" onClose={onClose} footer={<Footer busy={busy} onClose={onClose} label="Провести возврат"
      onSubmit={() => run(() => rpc('refund', { p_tenant: tenantId, p_from: f.from, p_amount: num(f.amount), p_date: f.date, p_reason: f.reason, p_lease: f.from === 'deposit' ? f.lease : null }))} />}>
      <Notice tone="amber">Проводите возврат после того, как деньги фактически ушли арендатору из банка.</Notice>
      <Field label="Что возвращаем"><select style={inputStyle} value={f.from} onChange={e => setF({ ...f, from: e.target.value })}>
        <option value="advance">Переплату (аванс: {money(advance)})</option>
        <option value="deposit" disabled={!leases.length}>Депозит по договору</option>
      </select></Field>
      {f.from === 'deposit' && (
        <Field label="Договор" hint={`на депозите ${money(held)}`}><select style={inputStyle} value={f.lease} onChange={e => setF({ ...f, lease: e.target.value })}>
          {leases.map(l => <option key={l.id} value={l.id}>№ {l.number || 'без номера'}</option>)}
        </select></Field>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Сумма, ₽"><input inputMode="decimal" style={inputStyle} value={f.amount} onChange={e => setF({ ...f, amount: e.target.value })} /></Field>
        <Field label="Дата возврата"><input type="date" style={inputStyle} value={f.date} onChange={e => setF({ ...f, date: e.target.value })} /></Field>
      </div>
      <Field label="Основание"><input style={inputStyle} value={f.reason} onChange={e => setF({ ...f, reason: e.target.value })} placeholder="Например: заявление арендатора от 20.11" /></Field>
      {error && <Notice tone="red">{error}</Notice>}
    </Modal>
  )
}

function ReasonDialog({ title, note, onClose, onSubmit }: { title: string; note: string; onClose: () => void; onSubmit: (reason: string) => Promise<unknown> }) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  return (
    <Modal title={title} onClose={onClose} footer={<><Button onClick={onClose}>Отмена</Button>
      <Button kind="danger" disabled={busy} onClick={async () => { setBusy(true); setError(''); try { await onSubmit(reason) } catch (e: any) { setError(e.message) } setBusy(false) }}>Сторнировать</Button></>}>
      <Notice>{note}</Notice>
      <Field label="Причина"><input style={inputStyle} value={reason} onChange={e => setReason(e.target.value)} autoFocus /></Field>
      {error && <Notice tone="red">{error}</Notice>}
    </Modal>
  )
}

// ── Акт сверки ───────────────────────────────────────────────────────────────
// Строится по движениям регистров «Расчёты» и «Авансы»: каждая строка — документ,
// изменивший баланс арендатора (долг минус аванс). Внутренние разнесения баланс не меняют и в акт не попадают.
async function printAct(tenant: any, from: string, to: string, article: string, articles: Article[]) {
  if (!tenant) return
  const w = window.open('', '_blank')
  if (!w) return
  w.document.write('<p style="font-family:sans-serif">Готовим акт…</p>')
  const [{ data: posts }, { data: landlord }] = await Promise.all([
    supabase.from('ledger_postings').select('*').eq('tenant_id', tenant.id).in('register', article ? ['receivable'] : ['receivable', 'advance']).lte('date', to).order('date').order('id'),
    supabase.from('landlords').select('*').order('is_default', { ascending: false }).limit(1).maybeSingle(),
  ])
  const rows = (posts || []).filter((p: any) => !article || p.article_code === article)
  const sign = (p: any) => (p.register === 'advance' ? -1 : 1) * (Number(p.debit) - Number(p.credit))
  const opening = rows.filter((p: any) => p.date < from).reduce((s: number, p: any) => s + sign(p), 0)
  const inPeriod = rows.filter((p: any) => p.date >= from)
  const byDoc = new Map<string, { date: string; type: string; id: string; net: number }>()
  for (const p of inPeriod) {
    const k = p.doc_type + p.doc_id
    const cur = byDoc.get(k) || { date: p.date, type: p.doc_type, id: p.doc_id, net: 0 }
    cur.net += sign(p); byDoc.set(k, cur)
  }
  const lines = [...byDoc.values()].filter(l => Math.abs(l.net) >= 0.005)
  const chargeIds = lines.filter(l => l.type === 'charge').map(l => l.id)
  const payIds = lines.filter(l => l.type.startsWith('payment')).map(l => l.id)
  const allocIds = lines.filter(l => l.type.startsWith('allocation')).map(l => l.id)
  const [ch, pays, allocs] = await Promise.all([
    chargeIds.length ? supabase.from('charges').select('id, description, article_code, storno_of').in('id', chargeIds) : Promise.resolve({ data: [] as any[] }),
    payIds.length ? supabase.from('payments').select('id, purpose, source, storno_of').in('id', payIds) : Promise.resolve({ data: [] as any[] }),
    allocIds.length ? supabase.from('allocations').select('id, source_lease_id, target_payment_id, target_charge_id').in('id', allocIds) : Promise.resolve({ data: [] as any[] }),
  ])
  const art = (c: string) => articles.find(a => a.code === c)?.name || c
  const describe = (l: { type: string; id: string }) => {
    if (l.type === 'charge') { const c = (ch.data || []).find((x: any) => x.id === l.id); return c ? (c.storno_of ? 'Сторно: ' : '') + (c.description || art(c.article_code)) : 'Начисление' }
    if (l.type === 'payment') { const p = (pays.data || []).find((x: any) => x.id === l.id); return p?.source === 'opening' ? 'Входящий остаток (переплата)' : 'Оплата' + (p?.purpose ? ': ' + p.purpose : '') }
    if (l.type === 'payment_storno') return 'Сторно ошибочной оплаты'
    const a = (allocs.data || []).find((x: any) => x.id === l.id)
    if (l.type === 'allocation_cancel') return 'Отмена разнесения'
    if (a?.source_lease_id) return 'Зачёт обеспечительного платежа'
    if (a?.target_payment_id) return 'Возврат переплаты'
    return 'Зачислено в обеспечительный платёж'
  }
  let bal = opening
  const body = lines.map(l => {
    bal += l.net
    return `<tr><td>${dateRu(l.date)}</td><td>${esc(describe(l))}</td><td class="r">${l.net > 0 ? fmt(l.net) : ''}</td><td class="r">${l.net < 0 ? fmt(-l.net) : ''}</td></tr>`
  }).join('')
  const debit = lines.filter(l => l.net > 0).reduce((s, l) => s + l.net, 0)
  const credit = lines.filter(l => l.net < 0).reduce((s, l) => s - l.net, 0)
  const ll = landlord as any
  const closingText = bal > 0.004 ? `Задолженность ${esc(tenant.full_name)} перед ${esc(ll?.name || 'арендодателем')} на ${dateRu(to)}: ${fmt(bal)} руб.`
    : bal < -0.004 ? `Переплата ${esc(tenant.full_name)} на ${dateRu(to)}: ${fmt(-bal)} руб.` : `На ${dateRu(to)} задолженности нет.`
  w.document.open()
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Акт сверки — ${esc(tenant.full_name)}</title><style>
    body{font-family:Arial,sans-serif;font-size:10pt;margin:15mm;color:#000} h1{font-size:13pt;text-align:center;margin:0 0 4mm}
    p{margin:2mm 0} table{width:100%;border-collapse:collapse;margin:4mm 0} td,th{border:1px solid #000;padding:2mm;vertical-align:top}
    th{background:#f2f2f2;font-weight:normal} .r{text-align:right;white-space:nowrap} .sign{display:flex;gap:20mm;margin-top:12mm} .sign div{flex:1}
    @media print{body{margin:12mm}}
  </style></head><body>
    <h1>Акт сверки взаиморасчётов</h1>
    <p style="text-align:center">за период с ${dateRu(from)} по ${dateRu(to)}${article ? ' по статье «' + esc(art(article)) + '»' : ''}</p>
    <p>между ${esc(ll?.name || 'Арендодатель')} (ИНН ${esc(ll?.inn || '')}) и ${esc(tenant.full_name)}${tenant.inn ? ' (ИНН ' + esc(tenant.inn) + ')' : ''}</p>
    <table><thead><tr><th style="width:22mm">Дата</th><th>Документ</th><th style="width:32mm">Начислено, руб.</th><th style="width:32mm">Оплачено, руб.</th></tr></thead><tbody>
      <tr><td colspan="2"><b>Сальдо на ${dateRu(from)}</b></td><td class="r">${opening > 0 ? fmt(opening) : ''}</td><td class="r">${opening < 0 ? fmt(-opening) : ''}</td></tr>
      ${body || '<tr><td colspan="4" style="text-align:center">Движений за период нет</td></tr>'}
      <tr><td colspan="2"><b>Обороты за период</b></td><td class="r"><b>${fmt(debit)}</b></td><td class="r"><b>${fmt(credit)}</b></td></tr>
      <tr><td colspan="2"><b>Сальдо на ${dateRu(to)}</b></td><td class="r"><b>${bal > 0 ? fmt(bal) : ''}</b></td><td class="r"><b>${bal < 0 ? fmt(-bal) : ''}</b></td></tr>
    </tbody></table>
    <p><b>${closingText}</b></p>
    <div class="sign"><div>От арендодателя<br><br>____________________</div><div>От арендатора<br><br>____________________</div></div>
    <script>window.onload=function(){window.print()}</script>
  </body></html>`)
  w.document.close()
}
const fmt = (n: number) => n.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const esc = (s: string) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))
