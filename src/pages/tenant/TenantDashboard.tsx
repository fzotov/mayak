import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useTenant } from './useTenant'
import { T, Card, Title, Row, Badge, Button, Loading, Empty, money, date, page } from './ui'

export default function TenantDashboard({ tenantId, onNavigate }: { tenantId: string; onNavigate: (p: string) => void }) {
  const { tenant, balance, loading } = useTenant(tenantId)
  const [ops, setOps] = useState<any[]>([])
  const [repairs, setRepairs] = useState<any[]>([])

  useEffect(() => {
    supabase.from('ledger_entries').select('id,date,doc_type,doc_number,charged,paid').eq('tenant_id', tenantId).not('id', 'like', 'doc_%')
      .order('date', { ascending: false }).limit(5).then(({ data }) => setOps(data || []))
    supabase.from('repairs').select('id,number,category,status').eq('tenant_id', tenantId).in('status', ['new', 'accepted', 'in_progress'])
      .order('created_at', { ascending: false }).then(({ data }) => setRepairs(data || []))
  }, [tenantId])

  if (loading) return <Loading />
  const net = balance ? Math.round((balance.debt - balance.advance) * 100) / 100 : null
  const days = tenant?.contract_end_date ? Math.ceil((new Date(tenant.contract_end_date).getTime() - Date.now()) / 86400000) : null

  return (
    <div style={page}>
      <Card pad={22}>
        <div style={{ fontSize: 13, color: T.muted, marginBottom: 8 }}>{net === null ? 'Взаиморасчёты' : net > 0 ? 'К оплате' : net < 0 ? 'Переплата' : 'Взаиморасчёты'}</div>
        <div style={{ fontSize: 34, fontWeight: 600, letterSpacing: '-1px', color: net === null ? T.text : net > 0 ? T.bad : net < 0 ? T.ok : T.text, lineHeight: 1.1 }}>
          {net === null ? 'Нет данных' : net === 0 ? 'Задолженности нет' : money(Math.abs(net))}
        </div>
        <div style={{ fontSize: 13, color: T.muted, marginTop: 8, marginBottom: 18 }}>
          {balance?.as_of ? `По данным бухгалтерии на ${date(balance.as_of)}` : 'Сальдо появится после сверки с бухгалтерией'}
        </div>
        <Button onClick={() => onNavigate('invoices')} full>Расчёты и реквизиты</Button>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
        <Button kind="ghost" onClick={() => onNavigate('meters')}>Передать показания</Button>
        <Button kind="ghost" onClick={() => onNavigate('repairs')}>Заявка на ремонт</Button>
      </div>

      <Card>
        <Title right={days !== null && days <= 60 ? <Badge tone={days < 30 ? 'bad' : 'warn'}>{days > 0 ? `осталось ${days} дн.` : 'срок истёк'}</Badge> : undefined}>Аренда</Title>
        <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 4 }}>{tenant?.full_name}</div>
        <Row label="Помещение" value={tenant?.unit_number ? `№ ${tenant.unit_number}` : null} />
        <Row label="Площадь" value={tenant?.area_actual ? `${tenant.area_actual} м²` : null} />
        <Row label="Договор" value={tenant?.contract_number ? `№ ${tenant.contract_number}` : null} />
        <Row label="Действует до" value={tenant?.contract_end_date ? date(tenant.contract_end_date) : null} />
      </Card>

      <Card>
        <Title right={<button onClick={() => onNavigate('invoices')} style={{ background: 'none', border: 'none', color: T.sub, fontSize: 13, cursor: 'pointer', fontFamily: T.font }}>Все</button>}>Последние операции</Title>
        {ops.length === 0 ? <Empty>Операций пока нет</Empty> : ops.map(o => <OpRow key={o.id} o={o} />)}
      </Card>

      {repairs.length > 0 && (
        <Card>
          <Title>Заявки в работе</Title>
          {repairs.map(r => (
            <div key={r.id} onClick={() => onNavigate('repairs')} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '11px 0', borderTop: `1px solid ${T.border}`, fontSize: 14, cursor: 'pointer' }}>
              <span>№ {r.number} · {r.category}</span>
              <Badge tone="warn">{r.status === 'new' ? 'новая' : r.status === 'accepted' ? 'принята' : 'в работе'}</Badge>
            </div>
          ))}
        </Card>
      )}
    </div>
  )
}

export function OpRow({ o }: { o: any }) {
  const charged = Number(o.charged || 0), paid = Number(o.paid || 0)
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '11px 0', borderTop: `1px solid ${T.border}` }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.doc_type || 'Операция'}{o.doc_number ? ` № ${o.doc_number}` : ''}</div>
        <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>{date(o.date)}</div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0, fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>
        {charged > 0 && <div style={{ color: T.text }}>начислено {money(charged)}</div>}
        {paid > 0 && <div style={{ color: T.ok }}>оплачено {money(paid)}</div>}
      </div>
    </div>
  )
}
