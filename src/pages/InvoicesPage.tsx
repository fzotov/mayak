// Счета арендаторам. Счёт собирает начисления месяца; статус оплаты вычисляется из погашения начислений.
// Счета создаёт «Биллинг»; вручную счёт не заводится и не правится.
import { useMemo, useState } from 'react'
import { go } from '../lib/nav'
import { supabase } from '../lib/supabase'
import { sb, useSb, useInvalidate, errText } from '../lib/query'
import { apiFetch } from '../lib/api'
import { PAY_STATUS, INVOICE_KIND, viewRows, type InvoiceState, type ChargeState } from '../lib/accounting'
import { printInvoice } from '../lib/invoicePrint'
import { Page, Card, Button, Badge, Stat, Stats, Table, Field, Notice, Loading, ErrorBox, inputStyle, money, dateRu, monthRu, C } from '../components/ui'

const goTo = (id?: string) => go('/invoices' + (id ? '/' + id : ''))

export function InvoicesPage({ invoiceId }: { invoiceId?: string | null }) {
  return invoiceId ? <InvoiceView key={invoiceId} id={invoiceId} /> : <InvoiceList />
}

function InvoiceList() {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [status, setStatus] = useState('')
  const [q, setQ] = useState('')
  const listQ = useSb(['v_invoice_state', 'list', month], async () => {
    let req = supabase.from('v_invoice_state').select('*').order('number', { ascending: false })
    if (month) req = req.eq('period', month)
    return viewRows<InvoiceState>(await sb(req))
  })
  const rows = listQ.data ?? null

  const shown = useMemo(() => (rows || []).filter(r =>
    (!status || (status === 'debt' ? r.pay_status !== 'paid' : r.pay_status === status)) &&
    (!q || r.tenant_name.toLowerCase().includes(q.toLowerCase()) || r.number.includes(q))), [rows, status, q])
  const sum = (k: 'total' | 'paid' | 'open_amount') => shown.reduce((s, r) => s + Number(r[k]), 0)

  return (
    <Page actions={<Button kind="primary" onClick={() => { go('/billing') }}>Выставить за месяц</Button>}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'end', flexWrap: 'wrap' }}>
        <Field label="Месяц"><input type="month" style={{ ...inputStyle, width: 180 }} value={month} onChange={e => setMonth(e.target.value)} /></Field>
        <Field label="Статус"><select style={{ ...inputStyle, width: 200 }} value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">Все</option><option value="debt">Не оплачены полностью</option>
          {Object.entries(PAY_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select></Field>
        <Field label="Поиск"><input style={{ ...inputStyle, width: 220 }} value={q} onChange={e => setQ(e.target.value)} placeholder="Арендатор или номер" /></Field>
      </div>
      {listQ.error && <ErrorBox error={listQ.error.message} onRetry={() => listQ.refetch()} />}
      <Stats>
        <Stat label="Выставлено" value={money(sum('total'))} />
        <Stat label="Оплачено" value={money(sum('paid'))} tone="green" />
        <Stat label="Не оплачено" value={money(sum('open_amount'))} tone={sum('open_amount') > 0 ? 'red' : undefined} />
        <Stat label="Счетов" value={shown.length} />
      </Stats>
      <Card pad={false}>
        {listQ.isPending ? <Loading /> : (
          <Table rows={shown} rowKey={r => r.id} onRow={r => goTo(r.id)} empty="Счетов нет. Счета появляются после проведения биллинга за месяц." cols={[
            { key: 'n', title: 'Счёт', render: r => <>№ {r.number}<div style={{ fontSize: 12, color: C.muted }}>{dateRu(r.date)}</div></> },
            { key: 't', title: 'Арендатор', render: r => r.tenant_name },
            { key: 'k', title: 'Вид', render: r => INVOICE_KIND[r.kind] || r.kind },
            { key: 's', title: 'Сумма', align: 'right', render: r => money(r.total) },
            { key: 'o', title: 'Остаток', align: 'right', render: r => money(r.open_amount, { zero: '—' }) },
            { key: 'd', title: 'Срок', render: r => dateRu(r.due_date) },
            { key: 'st', title: 'Статус', render: r => <><Badge tone={PAY_STATUS[r.pay_status]?.tone}>{PAY_STATUS[r.pay_status]?.label || r.pay_status}</Badge>{r.issue_status === 'SENT' && <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>отправлен</div>}</> },
          ]} />
        )}
      </Card>
    </Page>
  )
}

function InvoiceView({ id }: { id: string }) {
  const [msg, setMsg] = useState<{ tone: 'green' | 'red'; text: string } | null>(null)
  const [sending, setSending] = useState(false)
  const invalidate = useInvalidate()

  const invQ = useSb(['v_invoice_state', 'one', id], async () => {
    const i = await sb(supabase.from('v_invoice_state').select('*').eq('id', id).maybeSingle())
    return i ? viewRows<InvoiceState>([i])[0] : null
  })
  const inv = invQ.data ?? null
  const tenantId = inv?.tenant_id
  const linesQ = useSb(['v_charge_state', 'invoice', id], async () => viewRows<ChargeState>(await sb(
    supabase.from('v_charge_state').select('*').eq('invoice_id', id).order('created_at'))))
  const tenantQ = useSb(['tenants', tenantId, 'invoice'], () => sb(supabase.from('tenants').select('id, full_name, inn, email, contact_email').eq('id', tenantId!).single()), { enabled: !!tenantId })
  const openQ = useSb(['v_charge_state', tenantId, 'open-short'], () => sb(
    supabase.from('v_charge_state').select('open_amount, invoice_id, register').eq('tenant_id', tenantId!).gt('open_amount', 0)), { enabled: !!tenantId })
  const lines = linesQ.data || []
  const tenant = tenantQ.data ?? null
  const otherDebt = (openQ.data || []).filter(c => c.invoice_id !== id && c.register === 'receivable').reduce((s, c) => s + Number(c.open_amount), 0)
  const loadError = [invQ, linesQ, tenantQ, openQ].find(q => q.error)?.error?.message || ''

  async function print() {
    if (!inv || !tenant) return
    const { data: ll } = await supabase.from('landlords').select('*').order('is_default', { ascending: false }).limit(1).maybeSingle()
    if (!ll) { setMsg({ tone: 'red', text: 'Нет реквизитов арендодателя (таблица landlords)' }); return }
    const notes = [Number(inv.paid) > 0 && `Оплачено ранее: ${money(inv.paid)}.`, otherDebt > 0 && `Кроме того, долг по другим начислениям: ${money(otherDebt)}.`].filter(Boolean).join(' ')
    await printInvoice({
      number: inv.number, date: inv.date, tenantName: tenant.full_name, tenantInn: tenant.inn, basis: 'Договор аренды нежилого помещения',
      lines: lines.filter(l => !l.reversed).map(l => ({ name: l.description || l.article_name, amount: Number(l.effective_amount) })),
      balanceNote: notes || null, toPay: Number(inv.open_amount),
    }, ll)
  }

  async function send() {
    setSending(true); setMsg(null)
    try {
      const r = await apiFetch('/api/send-invoice', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ invoiceId: id }) })
      const j = await r.json()
      if (!r.ok || !j.ok) throw new Error(j.error || 'Не отправилось')
      setMsg({ tone: 'green', text: `Отправлено на ${j.to}. Счёт виден в кабинете арендатора.` }); invalidate('v_invoice_state', 'invoices')
    } catch (e) { setMsg({ tone: 'red', text: errText(e) }) }
    setSending(false)
  }

  if (invQ.isPending) return <Loading />
  if (!inv) return <Page>{invQ.error ? <ErrorBox error={invQ.error.message} onRetry={() => invQ.refetch()} /> : <Notice>Счёт не найден</Notice>}</Page>
  const ps = PAY_STATUS[inv.pay_status]
  return (
    <Page title={`Счёт № ${inv.number}`} actions={<>
      <Button onClick={() => goTo()}>Все счета</Button>
      <Button onClick={() => { go('/settlements/' + inv.tenant_id )}}>Расчёты арендатора</Button>
      <Button onClick={print}>Печать / PDF</Button>
      <Button kind="primary" disabled={sending} onClick={send}>{sending ? 'Отправляем…' : inv.issue_status === 'SENT' ? 'Отправить ещё раз' : 'Отправить арендатору'}</Button>
    </>}>
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      {loadError && <ErrorBox error={loadError} onRetry={() => { invQ.refetch(); linesQ.refetch(); tenantQ.refetch(); openQ.refetch() }} />}
      <Stats>
        <Stat label="Арендатор" value={<span style={{ fontSize: 15 }}>{inv.tenant_name}</span>} />
        <Stat label="Сумма" value={money(inv.total)} />
        <Stat label="Оплачено" value={money(inv.paid)} tone="green" />
        <Stat label="Осталось" value={money(inv.open_amount)} tone={Number(inv.open_amount) > 0 ? 'red' : undefined} />
      </Stats>
      <Card title={<>{INVOICE_KIND[inv.kind] || inv.kind} за {monthRu(inv.period).toLowerCase()} · срок {dateRu(inv.due_date)} · <Badge tone={ps?.tone}>{ps?.label || inv.pay_status}</Badge></>} pad={false}>
        <Table rows={lines} rowKey={l => l.id} cols={[
          { key: 'a', title: 'Начисление', render: l => <>{l.description || l.article_name}{l.reversed && <> <Badge tone="neutral">сторнировано</Badge></>}</> },
          { key: 's', title: 'Сумма', align: 'right', render: l => money(l.effective_amount) },
          { key: 'p', title: 'Оплачено', align: 'right', render: l => money(l.paid, { zero: '—' }) },
          { key: 'o', title: 'Остаток', align: 'right', render: l => money(l.open_amount, { zero: '—' }) },
        ]} />
      </Card>
      {otherDebt > 0 && <Notice tone="amber">Кроме этого счёта у арендатора долг по другим начислениям: {money(otherDebt)}.</Notice>}
      {!tenant?.email && !tenant?.contact_email && <Notice tone="amber">У арендатора не указана почта — отправить счёт письмом нельзя. Добавьте почту в карточке арендатора.</Notice>}
    </Page>
  )
}
