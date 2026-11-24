import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Page, Card, Row, Button, Badge, Stat, Stats, Table, Tabs, Loading, Empty, ErrorBox, Link, Muted, Sub, C, money, dateRu } from '../components/ui'

interface BankTx {
  id: string
  date: string
  amount: number
  direction: 'credit' | 'debit'
  counterparty: string | null
  description: string | null
  matched_type: string | null
  matched_id: string | null
}

interface IncomingInvoice {
  id: string
  supplier: string
  amount: number
  status: string
  description: string | null
  due_date: string | null
}

interface Tenant {
  id: string
  fullName: string
  inn: string | null
  monthlyRent: number | null
}

function normalize(s: string) {
  return s.toLowerCase().replace(/["«»""'',.\-]/g, '').replace(/\s+/g, ' ').trim()
}

function matchInvoiceScore(tx: BankTx, inv: IncomingInvoice): number {
  let score = 0
  if (Math.abs(tx.amount - inv.amount) < 0.01) score += 50
  else if (Math.abs(tx.amount - inv.amount) / inv.amount < 0.02) score += 20
  const txStr = normalize((tx.counterparty || '') + ' ' + (tx.description || ''))
  const invStr = normalize(inv.supplier + ' ' + (inv.description || ''))
  const words = invStr.split(' ').filter(w => w.length > 3)
  const hits = words.filter(w => txStr.includes(w)).length
  if (words.length > 0) score += Math.round((hits / words.length) * 40)
  return score
}

function matchTenantScore(tx: BankTx, tenant: Tenant): number {
  let score = 0
  const txStr = normalize((tx.counterparty || '') + ' ' + (tx.description || ''))
  const name = normalize(tenant.fullName)
  const nameWords = name.split(' ').filter(w => w.length > 2)
  const hits = nameWords.filter(w => txStr.includes(w)).length
  if (nameWords.length > 0) score += Math.round((hits / nameWords.length) * 50)
  if (tenant.inn && txStr.includes(tenant.inn)) score += 40
  if (tenant.monthlyRent && Math.abs(tx.amount - tenant.monthlyRent) < 0.01) score += 30
  if (txStr.includes('аренд')) score += 10
  return score
}

/** Одна пара «операция выписки — найденный кандидат» с кнопками. */
function SuggestionRow({ tx, right, busy, onConfirm, onSkip }: { tx: BankTx; right: React.ReactNode; busy: boolean; onConfirm: () => void; onSkip: () => void }) {
  const credit = tx.direction === 'credit'
  return (
    <div style={{ padding: '14px 16px', borderBottom: `1px solid ${C.line}`, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
      <div style={{ flex: '1 1 220px', minWidth: 0 }}>
        <Muted small>{dateRu(tx.date)} · Выписка</Muted>
        <div style={{ fontSize: 15, fontWeight: 600, color: credit ? C.green : C.red, margin: '2px 0', fontVariantNumeric: 'tabular-nums' }}>{credit ? '+' : '−'}{money(tx.amount)}</div>
        <div style={{ fontWeight: 500 }}>{tx.counterparty || '—'}</div>
        {tx.description && <Sub>{tx.description.slice(0, 90)}</Sub>}
      </div>
      <div style={{ flex: '1 1 220px', minWidth: 0, borderLeft: `2px solid ${C.line}`, paddingLeft: 16 }}>{right}</div>
      <div style={{ display: 'flex', gap: 6, flexDirection: 'column' }}>
        <Button small kind="primary" onClick={onConfirm} disabled={busy}>Подтвердить</Button>
        <Button small onClick={onSkip} disabled={busy}>Пропустить</Button>
      </div>
    </div>
  )
}

export default function ReconcilePage() {
  const [txs, setTxs] = useState<BankTx[]>([])
  const [invoices, setInvoices] = useState<IncomingInvoice[]>([])
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [tab, setTab] = useState<'debit' | 'credit'>('debit')
  const [error, setError] = useState('')
  const [loadError, setLoadError] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true); setLoadError('')
    const [{ data: txData, error: e1 }, { data: invData, error: e2 }, { data: tenantData, error: e3 }] = await Promise.all([
      supabase.from('bank_transactions').select('*').order('date', { ascending: false }),
      supabase.from('incoming_invoices').select('id,supplier,amount,status,description,due_date').in('status', ['APPROVED', 'NEW', 'PENDING_APPROVAL']),
      supabase.from('tenants').select('id,fullName:full_name,inn,monthlyRent:monthly_rent'),
    ])
    const err = e1 || e2 || e3
    if (err) setLoadError('Не удалось загрузить данные: ' + err.message)
    setTxs(txData || [])
    setInvoices(invData || [])
    setTenants((tenantData || []) as Tenant[])
    setLoading(false)
  }

  const debitTxs = txs.filter(t => t.direction === 'debit')
  const creditTxs = txs.filter(t => t.direction === 'credit')

  // Debit suggestions: tx → invoice
  interface DebitSug { tx: BankTx; inv: IncomingInvoice; score: number }
  const debitSuggestions: DebitSug[] = []
  for (const tx of debitTxs.filter(t => !t.matched_type)) {
    let best: { inv: IncomingInvoice; score: number } | null = null
    for (const inv of invoices) {
      const s = matchInvoiceScore(tx, inv)
      if (s >= 30 && (!best || s > best.score)) best = { inv, score: s }
    }
    if (best) debitSuggestions.push({ tx, inv: best.inv, score: best.score })
  }

  // Credit suggestions: tx → tenant
  interface CreditSug { tx: BankTx; tenant: Tenant; score: number }
  const creditSuggestions: CreditSug[] = []
  for (const tx of creditTxs.filter(t => !t.matched_type)) {
    let best: { tenant: Tenant; score: number } | null = null
    for (const tenant of tenants) {
      const s = matchTenantScore(tx, tenant)
      if (s >= 25 && (!best || s > best.score)) best = { tenant, score: s }
    }
    if (best) creditSuggestions.push({ tx, tenant: best.tenant, score: best.score })
  }

  // Операции банка меняются только функциями базы: зачисление идёт в расчёты арендатора, расход отмечается сверенным.
  async function run(txId: string, fn: () => PromiseLike<{ error: any }>) {
    setSaving(txId); setError('')
    const { error } = await fn()
    if (error) setError(error.message)
    await load()
    setSaving(null)
  }

  async function confirmDebitMatch(tx: BankTx, inv: IncomingInvoice) {
    await run(tx.id, async () => {
      const r = await supabase.rpc('bank_mark_expense', { p_tx: tx.id, p_invoice: inv.id })
      if (!r.error) await supabase.from('incoming_invoices').update({ status: 'PAID' }).eq('id', inv.id)
      return r
    })
  }

  async function confirmCreditMatch(tx: BankTx, tenant: Tenant) {
    // плательщик запоминается: следующие его платежи зачислятся этому арендатору сами
    await run(tx.id, () => supabase.rpc('bank_assign', { p_tx: tx.id, p_tenant: tenant.id, p_remember: true }))
  }

  async function ignore(txId: string) {
    const tx = txs.find(t => t.id === txId)
    await run(txId, () => tx?.direction === 'debit'
      ? supabase.rpc('bank_mark_expense', { p_tx: txId, p_invoice: null })
      : supabase.rpc('bank_ignore', { p_tx: txId, p_note: 'отмечено в сверке' }))
  }

  if (loading && txs.length === 0) return <Page><Loading /></Page>

  if (txs.length === 0) return (
    <Page>
      {loadError && <ErrorBox error={loadError} onRetry={load} />}
      <Card><Empty>Нет банковских операций. Сначала загрузите выписку в разделе <Link to="/bank">Поступления</Link>.</Empty></Card>
    </Page>
  )

  const unmatchedDebit = debitTxs.filter(t => !t.matched_type).length
  const unmatchedCredit = creditTxs.filter(t => !t.matched_type).length

  return (
    <Page>
      {loadError && <ErrorBox error={loadError} onRetry={load} />}
      {error && <ErrorBox error={error} />}
      <Stats>
        <Stat label="Расходы (выписка)" value={money(debitTxs.reduce((s, t) => s + t.amount, 0))} tone="red" />
        <Stat label="Поступления (выписка)" value={money(creditTxs.reduce((s, t) => s + t.amount, 0))} tone="green" />
        <Stat label="Несопоставлено расходов" value={unmatchedDebit} tone={unmatchedDebit > 0 ? 'amber' : 'green'} />
        <Stat label="Несопоставлено поступлений" value={unmatchedCredit} tone={unmatchedCredit > 0 ? 'amber' : 'green'} />
      </Stats>

      <Tabs<'debit' | 'credit'> value={tab} onChange={setTab} tabs={[
        ['debit', `Сверка расходов${debitSuggestions.length > 0 ? ` (${debitSuggestions.length})` : ''}`],
        ['credit', `Сверка поступлений${creditSuggestions.length > 0 ? ` (${creditSuggestions.length})` : ''}`],
      ]} />

      {tab === 'debit' && (
        <>
          {debitSuggestions.length > 0 && (
            <Card pad={false} title={<Row><span>Найдено совпадений: {debitSuggestions.length}</span><Badge tone="amber">расходы и входящие счета</Badge></Row>}>
              {debitSuggestions.map(({ tx, inv, score }) => (
                <SuggestionRow key={tx.id} tx={tx} busy={saving === tx.id}
                  onConfirm={() => confirmDebitMatch(tx, inv)} onSkip={() => ignore(tx.id)}
                  right={<>
                    <Muted small>Входящий счёт · совпадение {score}%</Muted>
                    <div style={{ fontSize: 15, fontWeight: 600, margin: '2px 0', fontVariantNumeric: 'tabular-nums' }}>{money(inv.amount)}</div>
                    <div style={{ fontWeight: 500 }}>{inv.supplier}</div>
                    {inv.description && <Sub>{inv.description.slice(0, 90)}</Sub>}
                  </>} />
              ))}
            </Card>
          )}
          <Card pad={false} title={`Все расходы (${debitTxs.length})`}>
            <TxTable rows={debitTxs} onIgnore={ignore} saving={saving} />
          </Card>
        </>
      )}

      {tab === 'credit' && (
        <>
          {creditSuggestions.length > 0 && (
            <Card pad={false} title={<Row><span>Найдено совпадений: {creditSuggestions.length}</span><Badge tone="green">поступления и арендаторы</Badge></Row>}>
              {creditSuggestions.map(({ tx, tenant, score }) => (
                <SuggestionRow key={tx.id} tx={tx} busy={saving === tx.id}
                  onConfirm={() => confirmCreditMatch(tx, tenant)} onSkip={() => ignore(tx.id)}
                  right={<>
                    <Muted small>Арендатор · совпадение {score}%</Muted>
                    <div style={{ fontSize: 14, fontWeight: 600, margin: '2px 0' }}>{tenant.fullName}</div>
                    {tenant.inn && <Sub>ИНН {tenant.inn}</Sub>}
                    {tenant.monthlyRent ? <Sub>Аренда: {money(tenant.monthlyRent)} в месяц</Sub> : null}
                  </>} />
              ))}
            </Card>
          )}
          <Card pad={false} title={`Все поступления (${creditTxs.length})`}>
            <TxTable rows={creditTxs} onIgnore={ignore} saving={saving} />
          </Card>
        </>
      )}
    </Page>
  )
}

function TxTable({ rows, onIgnore, saving }: { rows: BankTx[]; onIgnore: (id: string) => void; saving: string | null }) {
  const clip = (w: number): React.CSSProperties => ({ display: 'block', maxWidth: w, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' })
  return (
    <Table rows={rows} rowKey={t => t.id} empty="Операций нет" cols={[
      { key: 'd', title: 'Дата', sort: t => t.date, render: t => <span style={{ whiteSpace: 'nowrap' }}><Muted>{dateRu(t.date)}</Muted></span> },
      { key: 'c', title: 'Контрагент', sort: t => t.counterparty, render: t => <span title={t.counterparty || ''} style={{ ...clip(180), fontWeight: 500 }}>{t.counterparty || '—'}</span> },
      { key: 'p', title: 'Назначение', render: t => <span title={t.description || ''} style={clip(300)}>{t.description || '—'}</span> },
      { key: 'a', title: 'Сумма', align: 'right', sort: t => t.amount, render: t => (
        <span style={{ fontWeight: 600, color: t.direction === 'credit' ? C.green : C.red }}>{t.direction === 'credit' ? '+' : '−'}{money(t.amount)}</span>
      ) },
      { key: 's', title: 'Статус', sort: t => t.matched_type || '', render: t =>
        t.matched_type === 'invoice' ? <Badge tone="green">Счёт</Badge>
        : t.matched_type === 'tenant' ? <Badge tone="green">Аренда</Badge>
        : t.matched_type === 'ignored' ? <Badge>Пропущено</Badge>
        : <Badge tone="amber">Не сопоставлено</Badge> },
      { key: 'x', title: '', align: 'right', render: t => !t.matched_type
        ? <Button small onClick={() => onIgnore(t.id)} disabled={saving === t.id}>Пропустить</Button> : null },
    ]} />
  )
}
