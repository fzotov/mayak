import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { sb, useSb, errText } from '../../lib/query'
import type { Tables } from '../../lib/database.types'
import { useTenant } from './useTenant'
import { OpRow } from './TenantDashboard'
import { T, Card, Title, Row, Badge, Loading, Empty, Note, money, date, page } from './ui'
import { printInvoice } from '../../lib/invoicePrint'

const INV_STATUS: Record<string, { t: string; tone: 'ok' | 'warn' | 'bad' | 'muted' }> = {
  unpaid: { t: 'ожидает оплаты', tone: 'warn' }, partial: { t: 'оплачен частично', tone: 'warn' },
  overdue: { t: 'просрочен', tone: 'bad' }, partial_overdue: { t: 'частично, просрочен', tone: 'bad' }, paid: { t: 'оплачен', tone: 'ok' },
}

/** Печатная форма счёта с QR для оплаты — те же данные, что видит бухгалтер. */
type InvoiceRow = Pick<Tables<'v_invoice_state'>, 'id' | 'number' | 'date' | 'period' | 'due_date' | 'total' | 'paid' | 'open_amount' | 'pay_status'>

async function downloadInvoice(inv: InvoiceRow, tenant: Tables<'tenants'> | null, landlord: Tables<'landlords'>) {
  if (!inv.id) return
  const lines = await sb(supabase.from('v_charge_state').select('description, article_name, effective_amount, reversed').eq('invoice_id', inv.id))
  await printInvoice({
    number: inv.number || '', date: inv.date || '', tenantName: tenant?.full_name || '', tenantInn: tenant?.inn, basis: 'Договор аренды нежилого помещения',
    lines: lines.filter(l => !l.reversed).map(l => ({ name: l.description || l.article_name || '', amount: Number(l.effective_amount) })),
    balanceNote: Number(inv.paid) > 0 ? `Оплачено ранее: ${money(inv.paid)}.` : null, toPay: Number(inv.open_amount),
  }, landlord)
}

/** Расчёты: сальдо, реквизиты для оплаты, счета и история операций из бухгалтерии. */
export default function TenantInvoices({ tenantId }: { tenantId: string }) {
  const { tenant, balance, loading } = useTenant(tenantId)
  const [shown, setShown] = useState(30)
  const [copied, setCopied] = useState(false)
  const [printErr, setPrintErr] = useState('')

  const ledgerQ = useSb(['ledger_entries', tenantId, 'all'], () => sb(supabase.from('ledger_entries').select('id,date,doc_type,doc_number,charged,paid,note').eq('tenant_id', tenantId)
    .order('date', { ascending: false }).limit(1000)))
  const invoicesQ = useSb(['v_invoice_state', tenantId, 'cabinet'], () => sb(supabase.from('v_invoice_state').select('id,number,date,period,due_date,total,paid,open_amount,pay_status').eq('tenant_id', tenantId)
    .order('date', { ascending: false }).limit(24)))
  const landlordQ = useSb(['landlords', 'default', 'cabinet'], () => sb(supabase.from('landlords').select('*').order('is_default', { ascending: false }).limit(1)))
  const all = ledgerQ.data ?? []
  const ops = all.filter(o => !String(o.id).startsWith('doc_'))
  const opening = all.filter(o => String(o.id).startsWith('doc_'))
  const invoices = invoicesQ.data ?? []
  const landlord = landlordQ.data?.[0] ?? null

  if (loading || ledgerQ.isPending) return <Loading />
  const loadError = ledgerQ.error || invoicesQ.error || landlordQ.error
  const net = balance ? Math.round((balance.debt - balance.advance) * 100) / 100 : null
  const purpose = `Оплата по договору аренды${tenant?.contract_number ? ' № ' + tenant.contract_number : ''}${tenant?.unit_number ? ', помещение ' + tenant.unit_number : ''}`
  const requisites: [string, string][] = landlord ? ([
    ['Получатель', landlord.name], ['ИНН', landlord.inn], ['Банк', landlord.bank_name], ['БИК', landlord.bik],
    ['Расчётный счёт', landlord.account], ['Корр. счёт', landlord.corr_account], ['Назначение платежа', purpose],
  ] as [string, string | null][]).filter((r): r is [string, string] => !!r[1]) : []

  const copy = async () => {
    try { await navigator.clipboard.writeText(requisites.map(r => `${r[0]}: ${r[1]}`).join('\n')); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch { /* буфер недоступен */ }
  }

  return (
    <div style={page}>
      {loadError && <Note>Не всё удалось загрузить: {loadError.message}. Обновите страницу.</Note>}
      <Card pad={22}>
        <div style={{ fontSize: 13, color: T.muted, marginBottom: 8 }}>{net !== null && net > 0 ? 'К оплате' : net !== null && net < 0 ? 'Переплата' : 'Сальдо'}</div>
        <div style={{ fontSize: 'clamp(26px, 8.5vw, 34px)', fontWeight: 600, letterSpacing: '-1px', overflowWrap: 'anywhere', lineHeight: 1.1, color: net === null ? T.text : net > 0 ? T.bad : net < 0 ? T.ok : T.text }}>
          {net === null ? 'Нет данных' : net === 0 ? 'Задолженности нет' : money(Math.abs(net))}
        </div>
        <div style={{ fontSize: 13, color: T.muted, marginTop: 8 }}>
          {balance?.as_of ? `По данным бухгалтерии на ${date(balance.as_of)}. Оплата отражается после проведения банковской выписки.` : 'Сальдо появится после сверки с бухгалтерией.'}
        </div>
      </Card>

      {requisites.length > 0 && (
        <Card>
          <Title right={<button onClick={copy} style={{ background: 'none', border: `1px solid ${T.border}`, borderRadius: 7, color: T.text, fontSize: 13, minHeight: 44, margin: '-8px 0', padding: '6px 12px', cursor: 'pointer', fontFamily: T.font }}>{copied ? 'Скопировано' : 'Скопировать'}</button>}>Реквизиты для оплаты</Title>
          {requisites.map(r => <Row key={r[0]} label={r[0]} value={r[1]} />)}
        </Card>
      )}

      {invoices.length > 0 && (
        <Card>
          <Title>Счета</Title>
          {invoices.map(i => {
            const s = (i.pay_status && INV_STATUS[i.pay_status]) || { t: i.pay_status, tone: 'muted' as const }
            return (
              <div key={i.id ?? i.number} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '11px 0', borderTop: `1px solid ${T.border}` }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14 }}>№ {i.number} · {i.period}</div>
                  <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>оплатить до {date(i.due_date)}{Number(i.open_amount) > 0 && Number(i.open_amount) < Number(i.total) ? ` · осталось ${money(i.open_amount)}` : ''}</div>
                  {landlord && <button onClick={() => { setPrintErr(''); downloadInvoice(i, tenant, landlord).catch(e => setPrintErr(errText(e))) }} style={{ minHeight: 44, background: 'none', border: 0, padding: 0, textDecoration: 'underline', textUnderlineOffset: 3, color: T.accent, fontSize: 13, cursor: 'pointer', fontFamily: T.font }}>Счёт с QR для оплаты</button>}
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 14, fontVariantNumeric: 'tabular-nums', marginBottom: 4, whiteSpace: 'nowrap' }}>{money(i.total)}</div>
                  <Badge tone={s.tone}>{s.t}</Badge>
                </div>
              </div>
            )
          })}
          {printErr && <Note>Не удалось сформировать счёт: {printErr}</Note>}
        </Card>
      )}

      <Card>
        <Title>История операций</Title>
        {ops.length === 0 && opening.length === 0 && <Empty>Операций пока нет</Empty>}
        {ops.slice(0, shown).map(o => <OpRow key={o.id} o={o} />)}
        {ops.length > shown && (
          <button onClick={() => setShown(shown + 50)} style={{ width: '100%', minHeight: 44, marginTop: 8, background: 'none', border: `1px solid ${T.border}`, borderRadius: 8, color: T.text, fontSize: 14, cursor: 'pointer', fontFamily: T.font }}>
            Показать ещё ({ops.length - shown})
          </button>
        )}
      </Card>

      {opening.length > 0 && (
        <Card>
          <Title>Неоплаченные документы</Title>
          {opening.map(o => (
            <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '11px 0', borderTop: `1px solid ${T.border}`, fontSize: 14 }}>
              <div style={{ minWidth: 0, overflowWrap: 'anywhere' }}><div>{o.doc_type}{o.doc_number ? ` № ${o.doc_number}` : ''}</div><div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>{date(o.date)}</div></div>
              <div style={{ textAlign: 'right', flexShrink: 0, fontVariantNumeric: 'tabular-nums', color: Number(o.charged) > 0 ? T.bad : T.ok }}>
                {Number(o.charged) > 0 ? `долг ${money(o.charged)}` : `аванс ${money(o.paid)}`}
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  )
}
