// «Сегодня»: что требует действия. Сверху — тревоги, ниже — поступления (от кого и за что), должники,
// заявки сайта, аварийные ремонты, задачи, счета к оплате, истекающие договоры.
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { go } from '../lib/nav'
import { fetchSiteLeads, type SiteLead } from '../lib/siteLeads'
import { fetchHotRepairs } from './Repairs'
import type { SaldoRow } from './Debtors'
import { Page, Card, Button, Badge, Stat, Table, Alert, Link, Sub, Empty, money, dateRu, dateTimeRu, C } from '../components/ui'

const REPAIR: Record<string, [string, 'neutral' | 'blue' | 'amber' | 'green' | 'red']> = {
  new: ['Новая', 'neutral'], accepted: ['Принята', 'blue'], in_progress: ['В работе', 'amber'], completed: ['Готово', 'green'], rejected: ['Отклонена', 'red'],
}

export default function TodayPage() {
  const [problems, setProblems] = useState(0)
  const [unrec, setUnrec] = useState(0)
  const [receipts, setReceipts] = useState<any[]>([])
  const [saldo, setSaldo] = useState<SaldoRow[]>([])
  const [leads, setLeads] = useState<SiteLead[]>([])
  const [repairs, setRepairs] = useState<any[]>([])
  const [openRepairs, setOpenRepairs] = useState(0)
  const [tasks, setTasks] = useState<any[]>([])
  const [toPay, setToPay] = useState<any[]>([])
  const [expiring, setExpiring] = useState<any[]>([])
  const [occupancy, setOccupancy] = useState({ total: 0, busy: 0 })

  useEffect(() => {
    const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10)
    const d = new Date().toISOString().slice(0, 10)
    const in30 = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10)
    supabase.rpc('verify_ledger').then(({ data, error }) => setProblems(error ? -1 : (data || []).length))
    supabase.from('bank_transactions').select('id', { count: 'exact', head: true }).eq('status', 'unrecognized').then(({ count }) => setUnrec(count || 0))
    supabase.from('bank_transactions').select('id, date, amount, counterparty, description, tenant_id, tenants(full_name)')
      .eq('direction', 'credit').eq('status', 'credited').gte('date', weekAgo).order('date', { ascending: false }).limit(10)
      .then(({ data }) => setReceipts(data || []))
    supabase.rpc('tenant_saldo').then(({ data }) => setSaldo((data || []) as SaldoRow[]))
    fetchSiteLeads(50).then(({ leads }) => setLeads(leads))
    fetchHotRepairs().then(setRepairs)
    supabase.from('repairs').select('id', { count: 'exact', head: true }).in('status', ['new', 'accepted', 'in_progress']).then(({ count }) => setOpenRepairs(count || 0))
    supabase.from('tasks').select('id, title, status, priority').in('status', ['todo', 'open', 'in_progress']).order('created_at', { ascending: false }).limit(6).then(({ data }) => setTasks(data || []))
    supabase.from('incoming_invoices').select('id, supplier, amount, description, due_date').eq('status', 'APPROVED').order('due_date').then(({ data }) => setToPay(data || []))
    supabase.from('leases').select('id, number, end_date, tenants(full_name)').eq('status', 'active').gte('end_date', d).lte('end_date', in30).order('end_date').then(({ data }) => setExpiring(data || []))
    supabase.from('units').select('status').then(({ data }) => setOccupancy({ total: data?.length || 0, busy: (data || []).filter((u: any) => u.status === 'occupied').length }))
  }, [])

  const newLeads = leads.filter(l => l.status === 'new')
  const debtors = saldo.filter(s => Number(s.overdue) > 0)
  const debt = saldo.reduce((s, r) => s + Math.max(0, Number(r.balance)), 0)
  const overdue = saldo.reduce((s, r) => s + Number(r.overdue || 0), 0)
  const inWeek = receipts.reduce((s, r) => s + Number(r.amount), 0)
  const emergency = repairs.filter(r => r.priority === 'emergency')

  return (
    <Page>
      {problems !== 0 && <Alert tone="red" onClick={() => go('/settlements?tab=check')}>{problems > 0 ? `Самопроверка расчётов нашла расхождения: ${problems}. Откройте и разберите.` : 'Самопроверка расчётов не выполнилась — откройте «Самопроверку».'}</Alert>}
      {unrec > 0 && <Alert onClick={() => go('/bank?tab=unrec')}>Не опознан плательщик: {unrec}. Укажите арендатора — деньги сразу лягут на его баланс.</Alert>}
      {emergency.length > 0 && <Alert tone="red" onClick={() => go('/repairs')}>Аварийные заявки: {emergency.length}. {emergency.map(r => r.description).filter(Boolean).slice(0, 2).join('; ')}</Alert>}
      {newLeads.length > 0 && <Alert tone="blue" onClick={() => go('/site')}>Новые заявки с сайта: {newLeads.length} — ждут ответа.</Alert>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
        <Stat label="Поступило за 7 дней" value={money(inWeek)} sub={`${receipts.length} платежей`} tone="green" onClick={() => go('/bank')} />
        <Stat label="Долг арендаторов" value={money(debt)} sub={`просрочено ${money(overdue)}`} tone={overdue > 0 ? 'red' : undefined} onClick={() => go('/debtors')} />
        <Stat label="Заполняемость" value={occupancy.total ? `${Math.round(occupancy.busy / occupancy.total * 100)}%` : '—'} sub={`${occupancy.busy} из ${occupancy.total} помещений`} onClick={() => go('/floorplan')} />
        <Stat label="Открытые заявки" value={openRepairs} tone={openRepairs ? 'amber' : undefined} onClick={() => go('/repairs')} />
        <Stat label="Истекают договоры" value={expiring.length} sub="в ближайшие 30 дней" tone={expiring.length ? 'amber' : undefined} onClick={() => go('/contracts')} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 12 }}>
        <Card pad={false} title="Поступления за неделю" actions={<Button small kind="ghost" onClick={() => go('/bank')}>Банк</Button>}>
          <Table rows={receipts} rowKey={r => r.id} onRow={r => go('/settlements/' + r.tenant_id)} empty="За неделю поступлений нет" dense cols={[
            { key: 'd', title: 'Дата', render: r => dateRu(r.date) },
            { key: 't', title: 'От кого и за что', render: r => <><div>{r.tenants?.full_name || r.counterparty}</div><Sub>{r.description}</Sub></> },
            { key: 'a', title: 'Сумма', align: 'right', render: r => <span style={{ color: C.green }}>{money(r.amount)}</span> },
          ]} />
        </Card>
        <Card pad={false} title="Должники с просрочкой" actions={<Button small kind="ghost" onClick={() => go('/debtors')}>Все</Button>}>
          <Table rows={debtors.slice(0, 6)} rowKey={r => r.tenant_id} onRow={r => go('/settlements/' + r.tenant_id)} empty="Просроченных долгов нет" dense cols={[
            { key: 't', title: 'Арендатор', render: r => r.tenant_name },
            { key: 'o', title: 'Просрочено', align: 'right', render: r => <span style={{ color: C.red }}>{money(r.overdue)}</span> },
            { key: 'd', title: 'Дней', align: 'right', render: r => <Badge tone={r.max_days_overdue > 30 ? 'red' : 'amber'}>{r.max_days_overdue}</Badge> },
          ]} />
        </Card>
        <Card pad={false} title="Заявки с сайта" actions={<Button small kind="ghost" onClick={() => go('/site')}>Все</Button>}>
          {leads.length === 0 ? <Empty>Заявок нет</Empty> : (
            <Table rows={leads.slice(0, 5)} rowKey={l => l.id} dense cols={[
              { key: 'n', title: 'Кто', render: l => <><div>{l.name || '—'}{l.status === 'new' && <> <Badge tone="blue">новая</Badge></>}</div><Sub>{l.phone}</Sub></> },
              { key: 'c', title: 'Что нужно', render: l => <span style={{ color: C.muted }}>{l.message || (l.unit_number ? 'помещение ' + l.unit_number : '—')}</span> },
              { key: 'd', title: 'Когда', render: l => dateTimeRu(l.created_at) },
            ]} />
          )}
        </Card>
        <Card pad={false} title="Срочные ремонты" actions={<Button small kind="ghost" onClick={() => go('/repairs')}>Все</Button>}>
          <Table rows={repairs} rowKey={r => r.id} dense empty="Срочных заявок нет" cols={[
            { key: 'n', title: 'Заявка', render: r => <><div>{r.description || r.category}</div><Sub>№ {r.number}{r.unit?.number ? ` · пом. ${r.unit.number}` : ''}</Sub></> },
            { key: 's', title: 'Статус', render: r => <><Badge tone={REPAIR[r.status]?.[1]}>{REPAIR[r.status]?.[0] || r.status}</Badge>{r.priority === 'emergency' && <> <Badge tone="red">авария</Badge></>}</> },
          ]} />
        </Card>
        <Card pad={false} title="Задачи" actions={<Button small kind="ghost" onClick={() => go('/tasks')}>Все</Button>}>
          <Table rows={tasks} rowKey={t => t.id} dense empty="Открытых задач нет" cols={[
            { key: 't', title: 'Задача', render: t => t.title },
            { key: 'p', title: '', render: t => t.priority === 'CRITICAL' ? <Badge tone="red">срочно</Badge> : t.priority === 'HIGH' ? <Badge tone="amber">важно</Badge> : null },
          ]} />
        </Card>
        <Card pad={false} title={`Согласованные счета к оплате${toPay.length ? ' · ' + money(toPay.reduce((s, i) => s + Number(i.amount), 0)) : ''}`} actions={<Button small kind="ghost" onClick={() => go('/incoming-invoices')}>Реестр</Button>}>
          <Table rows={toPay} rowKey={i => i.id} dense empty="Нет согласованных счетов" cols={[
            { key: 's', title: 'Поставщик', render: i => <><div>{i.supplier}</div><Sub>{i.description}</Sub></> },
            { key: 'd', title: 'Оплатить до', render: i => dateRu(i.due_date) },
            { key: 'a', title: 'Сумма', align: 'right', render: i => money(i.amount) },
          ]} />
        </Card>
        <Card pad={false} title="Договоры заканчиваются (30 дней)" actions={<Button small kind="ghost" onClick={() => go('/contracts')}>Все</Button>}>
          <Table rows={expiring} rowKey={e => e.id} dense empty="В ближайшие 30 дней договоры не заканчиваются" cols={[
            { key: 't', title: 'Арендатор', render: e => <Link to={'/contracts/' + e.id}>{e.tenants?.full_name || '—'}</Link> },
            { key: 'n', title: 'Договор', render: e => e.number ? '№ ' + e.number : '—' },
            { key: 'd', title: 'До', render: e => dateRu(e.end_date) },
          ]} />
        </Card>
      </div>
    </Page>
  )
}
