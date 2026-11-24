// Счета арендаторам. Счёт собирает начисления месяца; статус оплаты вычисляется из погашения начислений.
// Счета создаёт «Биллинг»; вручную счёт не заводится и не правится.
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { apiFetch } from '../lib/api'
import { PAY_STATUS, INVOICE_KIND, type InvoiceState, type ChargeState } from '../lib/accounting'
import { printInvoice } from '../lib/invoicePrint'
import { Page, Card, Button, Badge, Stat, Stats, Table, Field, Notice, Loading, inputStyle, money, dateRu, monthRu, C } from '../components/ui'

const go = (id?: string) => { window.location.hash = '/invoices' + (id ? '/' + id : '') }

export function InvoicesPage({ invoiceId }: { invoiceId?: string | null }) {
  return invoiceId ? <InvoiceView key={invoiceId} id={invoiceId} /> : <InvoiceList />
}

function InvoiceList() {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [status, setStatus] = useState('')
  const [q, setQ] = useState('')
  const [rows, setRows] = useState<InvoiceState[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    setRows(null)
    let req = supabase.from('v_invoice_state').select('*').order('number', { ascending: false })
    if (month) req = req.eq('period', month)
    req.then(({ data, error }) => { if (error) setError(error.message); setRows((data || []) as InvoiceState[]) })
  }, [month])

  const shown = useMemo(() => (rows || []).filter(r =>
    (!status || (status === 'debt' ? r.pay_status !== 'paid' : r.pay_status === status)) &&
    (!q || r.tenant_name.toLowerCase().includes(q.toLowerCase()) || r.number.includes(q))), [rows, status, q])
  const sum = (k: 'total' | 'paid' | 'open_amount') => shown.reduce((s, r) => s + Number(r[k]), 0)

  return (
    <Page actions={<Button kind="primary" onClick={() => { window.location.hash = '/billing' }}>Выставить за месяц</Button>}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'end', flexWrap: 'wrap' }}>
        <Field label="Месяц"><input type="month" style={{ ...inputStyle, width: 180 }} value={month} onChange={e => setMonth(e.target.value)} /></Field>
        <Field label="Статус"><select style={{ ...inputStyle, width: 200 }} value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">Все</option><option value="debt">Не оплачены полностью</option>
          {Object.entries(PAY_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select></Field>
        <Field label="Поиск"><input style={{ ...inputStyle, width: 220 }} value={q} onChange={e => setQ(e.target.value)} placeholder="Арендатор или номер" /></Field>
      </div>
      {error && <Notice tone="red">{error}</Notice>}
      <Stats>
        <Stat label="Выставлено" value={money(sum('total'))} />
        <Stat label="Оплачено" value={money(sum('paid'))} tone="green" />
        <Stat label="Не оплачено" value={money(sum('open_amount'))} tone={sum('open_amount') > 0 ? 'red' : undefined} />
        <Stat label="Счетов" value={shown.length} />
      </Stats>
      <Card pad={false}>
        {rows === null ? <Loading /> : (
          <Table rows={shown} rowKey={r => r.id} onRow={r => go(r.id)} empty="Счетов нет. Счета появляются после проведения биллинга за месяц." cols={[
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
  const [inv, setInv] = useState<InvoiceState | null>(null)
  const [lines, setLines] = useState<ChargeState[]>([])
  const [tenant, setTenant] = useState<any>(null)
  const [otherDebt, setOtherDebt] = useState(0)
  const [msg, setMsg] = useState<{ tone: 'green' | 'red'; text: string } | null>(null)
  const [sending, setSending] = useState(false)

  async function load() {
    const { data: i } = await supabase.from('v_invoice_state').select('*').eq('id', id).maybeSingle()
    setInv(i as InvoiceState)
    if (!i) return
    const [{ data: ch }, { data: t }, { data: all }] = await Promise.all([
      supabase.from('v_charge_state').select('*').eq('invoice_id', id).order('created_at'),
      supabase.from('tenants').select('id, full_name, inn, email, contact_email').eq('id', i.tenant_id).single(),
      supabase.from('v_charge_state').select('open_amount, invoice_id, register').eq('tenant_id', i.tenant_id).gt('open_amount', 0),
    ])
    setLines((ch || []) as ChargeState[]); setTenant(t)
    setOtherDebt((all || []).filter((c: any) => c.invoice_id !== id && c.register === 'receivable').reduce((s: number, c: any) => s + Number(c.open_amount), 0))
  }
  useEffect(() => { load() }, [id])

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
      setMsg({ tone: 'green', text: `Отправлено на ${j.to}. Счёт виден в кабинете арендатора.` }); load()
    } catch (e: any) { setMsg({ tone: 'red', text: e.message }) }
    setSending(false)
  }

  if (!inv) return <Loading />
  const ps = PAY_STATUS[inv.pay_status]
  return (
    <Page title={`Счёт № ${inv.number}`} actions={<>
      <Button onClick={() => go()}>Все счета</Button>
      <Button onClick={() => { window.location.hash = '/settlements/' + inv.tenant_id }}>Расчёты арендатора</Button>
      <Button onClick={print}>Печать / PDF</Button>
      <Button kind="primary" disabled={sending} onClick={send}>{sending ? 'Отправляем…' : inv.issue_status === 'SENT' ? 'Отправить ещё раз' : 'Отправить арендатору'}</Button>
    </>}>
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
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
