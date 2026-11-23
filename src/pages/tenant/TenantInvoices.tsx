import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useTenant } from './useTenant'
import { OpRow } from './TenantDashboard'
import { T, Card, Title, Row, Badge, Loading, Empty, money, date, page } from './ui'

const INV_STATUS: Record<string, { t: string; tone: 'ok' | 'warn' | 'bad' | 'muted' }> = {
  sent: { t: 'выставлен', tone: 'warn' }, overdue: { t: 'просрочен', tone: 'bad' }, paid: { t: 'оплачен', tone: 'ok' },
}

/** Расчёты: сальдо, реквизиты для оплаты, счета и история операций из бухгалтерии. */
export default function TenantInvoices({ tenantId }: { tenantId: string }) {
  const { tenant, balance, loading } = useTenant(tenantId)
  const [ops, setOps] = useState<any[]>([])
  const [opening, setOpening] = useState<any[]>([])
  const [invoices, setInvoices] = useState<any[]>([])
  const [landlord, setLandlord] = useState<any>(null)
  const [shown, setShown] = useState(30)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    supabase.from('ledger_entries').select('id,date,doc_type,doc_number,charged,paid,note').eq('tenant_id', tenantId)
      .order('date', { ascending: false }).limit(1000).then(({ data }) => {
        const all = data || []
        setOps(all.filter(o => !String(o.id).startsWith('doc_')))
        setOpening(all.filter(o => String(o.id).startsWith('doc_')))
      })
    supabase.from('invoices').select('id,number,period,total_amount,status,due_date').eq('tenant_id', tenantId)
      .order('created_at', { ascending: false }).then(({ data }) => setInvoices(data || []))
    supabase.from('landlords').select('*').order('is_default', { ascending: false }).limit(1).then(({ data }) => setLandlord(data?.[0] || null))
  }, [tenantId])

  if (loading) return <Loading />
  const net = balance ? Math.round((balance.debt - balance.advance) * 100) / 100 : null
  const purpose = `Оплата по договору аренды${tenant?.contract_number ? ' № ' + tenant.contract_number : ''}${tenant?.unit_number ? ', помещение ' + tenant.unit_number : ''}`
  const requisites = landlord ? [
    ['Получатель', landlord.name], ['ИНН', landlord.inn], ['Банк', landlord.bank_name], ['БИК', landlord.bik],
    ['Расчётный счёт', landlord.account], ['Корр. счёт', landlord.corr_account], ['Назначение платежа', purpose],
  ].filter(r => r[1]) : []

  const copy = async () => {
    try { await navigator.clipboard.writeText(requisites.map(r => `${r[0]}: ${r[1]}`).join('\n')); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch { /* буфер недоступен */ }
  }

  return (
    <div style={page}>
      <Card pad={22}>
        <div style={{ fontSize: 13, color: T.muted, marginBottom: 8 }}>{net !== null && net > 0 ? 'К оплате' : net !== null && net < 0 ? 'Переплата' : 'Сальдо'}</div>
        <div style={{ fontSize: 34, fontWeight: 600, letterSpacing: '-1px', lineHeight: 1.1, color: net === null ? T.text : net > 0 ? T.bad : net < 0 ? T.ok : T.text }}>
          {net === null ? 'Нет данных' : net === 0 ? 'Задолженности нет' : money(Math.abs(net))}
        </div>
        <div style={{ fontSize: 13, color: T.muted, marginTop: 8 }}>
          {balance?.as_of ? `По данным бухгалтерии на ${date(balance.as_of)}. Оплата отражается после проведения банковской выписки.` : 'Сальдо появится после сверки с бухгалтерией.'}
        </div>
      </Card>

      {requisites.length > 0 && (
        <Card>
          <Title right={<button onClick={copy} style={{ background: 'none', border: `1px solid ${T.border}`, borderRadius: 7, color: T.text, fontSize: 13, padding: '6px 12px', cursor: 'pointer', fontFamily: T.font }}>{copied ? 'Скопировано' : 'Скопировать'}</button>}>Реквизиты для оплаты</Title>
          {requisites.map(r => <Row key={r[0]} label={r[0]} value={r[1]} />)}
        </Card>
      )}

      {invoices.length > 0 && (
        <Card>
          <Title>Счета</Title>
          {invoices.map(i => {
            const s = INV_STATUS[String(i.status).toLowerCase()] || { t: i.status, tone: 'muted' as const }
            return (
              <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '11px 0', borderTop: `1px solid ${T.border}` }}>
                <div>
                  <div style={{ fontSize: 14 }}>№ {i.number} · {i.period}</div>
                  <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>оплатить до {date(i.due_date)}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 14, fontVariantNumeric: 'tabular-nums', marginBottom: 4 }}>{money(i.total_amount)}</div>
                  <Badge tone={s.tone}>{s.t}</Badge>
                </div>
              </div>
            )
          })}
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
              <div><div>{o.doc_type}{o.doc_number ? ` № ${o.doc_number}` : ''}</div><div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>{date(o.date)}</div></div>
              <div style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: Number(o.charged) > 0 ? T.bad : T.ok }}>
                {Number(o.charged) > 0 ? `долг ${money(o.charged)}` : `аванс ${money(o.paid)}`}
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  )
}
