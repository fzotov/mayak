// «Сегодня»: что требует действия. Сверху — тревоги, ниже — поступления (от кого и за что), должники,
// заявки сайта, аварийные ремонты, задачи, счета к оплате, истекающие договоры.
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { sb, useSb } from '../lib/query'
import { rpc } from '../lib/accounting'
import { go } from '../lib/nav'
import { fetchSiteLeads } from '../lib/siteLeads'
import { fetchHotRepairs } from './Repairs'
import type { SaldoRow } from './Debtors'
import { Page, Card, Button, Badge, Stat, Table, Alert, Link, Sub, Empty, ErrorBox, money, dateRu, dateTimeRu, C } from '../components/ui'

const REPAIR: Record<string, [string, 'neutral' | 'blue' | 'amber' | 'green' | 'red']> = {
  new: ['Новая', 'neutral'], accepted: ['Принята', 'blue'], in_progress: ['В работе', 'amber'], completed: ['Готово', 'green'], rejected: ['Отклонена', 'red'],
}

export default function TodayPage() {
  // даты фиксируются при открытии экрана (ключи запросов не меняются на каждом рендере)
  const [{ weekAgo, d, in30 }] = useState(() => {
    const now = Date.now()
    const day = (shift: number) => new Date(now + shift * 864e5).toISOString().slice(0, 10)
    return { weekAgo: day(-7), d: day(0), in30: day(30) }
  })
  /** Сколько строк подходит (без самих строк). */
  const count = async (q: PromiseLike<{ count: number | null; error: { message: string } | null }>) => {
    const { count: n, error } = await q
    if (error) throw new Error(error.message)
    return n || 0
  }

  const checkQ = useSb(['rpc:verify_ledger'], () => rpc('verify_ledger'))
  const unrecQ = useSb(['bank_transactions', 'unrecognized-count'], () => count(supabase.from('bank_transactions').select('id', { count: 'exact', head: true }).eq('status', 'unrecognized')))
  const receiptsQ = useSb(['bank_transactions', 'receipts', weekAgo], () => sb(supabase.from('bank_transactions').select('id, date, amount, counterparty, description, tenant_id, tenants(full_name)')
    .eq('direction', 'credit').eq('status', 'credited').gte('date', weekAgo).order('date', { ascending: false }).limit(10)))
  const saldoQ = useSb(['rpc:tenant_saldo'], () => rpc<SaldoRow[]>('tenant_saldo'))
  const leadsQ = useSb(['site_leads', 'today'], () => fetchSiteLeads(50))
  const repairsQ = useSb(['repairs', 'hot'], fetchHotRepairs)
  const openRepairsQ = useSb(['repairs', 'open-count'], () => count(supabase.from('repairs').select('id', { count: 'exact', head: true }).in('status', ['new', 'accepted', 'in_progress'])))
  const tasksQ = useSb(['tasks', 'today'], () => sb(supabase.from('tasks').select('id, title, status, priority').in('status', ['todo', 'open', 'in_progress']).order('created_at', { ascending: false }).limit(6)))
  const toPayQ = useSb(['incoming_invoices', 'approved'], () => sb(supabase.from('incoming_invoices').select('id, supplier, amount, description, due_date').eq('status', 'APPROVED').order('due_date')))
  const expiringQ = useSb(['leases', 'expiring', d, in30], () => sb(supabase.from('leases').select('id, number, end_date, tenants(full_name)').eq('status', 'active').gte('end_date', d).lte('end_date', in30).order('end_date')))
  const stepsQ = useSb(['deals', 'steps', d], () => sb(supabase.from('deals').select('id, number, kind, name, company, next_step, next_step_at').not('stage', 'in', '(won,lost)').lte('next_step_at', d).order('next_step_at').limit(8)))
  const unitsQ = useSb(['units', 'status'], () => sb(supabase.from('units').select('status')))

  // самопроверка: −1 — не выполнилась, 0 — пока считаем или расхождений нет
  const problems = checkQ.error ? -1 : checkQ.data?.length || 0
  const unrec = unrecQ.data || 0
  const receipts = receiptsQ.data || []
  const saldo = saldoQ.data || []
  const leads = leadsQ.data?.leads || []
  const repairs = repairsQ.data || []
  const openRepairs = openRepairsQ.data || 0
  const tasks = tasksQ.data || []
  const toPay = toPayQ.data || []
  const expiring = expiringQ.data || []
  const steps = stepsQ.data || []
  const units = unitsQ.data || []
  const occupancy = { total: units.length, busy: units.filter(u => u.status === 'occupied').length }
  const failed = [unrecQ, receiptsQ, saldoQ, leadsQ, repairsQ, openRepairsQ, tasksQ, toPayQ, expiringQ, stepsQ, unitsQ].find(q => q.error)?.error?.message

  const newLeads = leads.filter(l => l.status === 'new')
  const debtors = saldo.filter(s => Number(s.overdue) > 0)
  const debt = saldo.reduce((s, r) => s + Math.max(0, Number(r.balance)), 0)
  const overdue = saldo.reduce((s, r) => s + Number(r.overdue || 0), 0)
  const inWeek = receipts.reduce((s, r) => s + Number(r.amount), 0)
  const emergency = repairs.filter(r => r.priority === 'emergency')

  return (
    <Page>
      {failed && <ErrorBox error={'Часть сводки не загрузилась: ' + failed} />}
      {problems !== 0 && <Alert tone="red" onClick={() => go('/settlements?tab=check')}>{problems > 0 ? `Самопроверка расчётов нашла расхождения: ${problems}. Откройте и разберите.` : 'Самопроверка расчётов не выполнилась — откройте «Самопроверку».'}</Alert>}
      {unrec > 0 && <Alert onClick={() => go('/bank?tab=unrec')}>Не опознан плательщик: {unrec}. Укажите арендатора — деньги сразу лягут на его баланс.</Alert>}
      {emergency.length > 0 && <Alert tone="red" onClick={() => go('/repairs')}>Аварийные заявки: {emergency.length}. {emergency.map(r => r.description).filter(Boolean).slice(0, 2).join('; ')}</Alert>}
      {newLeads.length > 0 && <Alert tone="blue" onClick={() => go('/deals')}>Новые заявки с сайта: {newLeads.length} — ждут ответа.</Alert>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(150px, 100%), 1fr))', gap: 12 }}>
        <Stat label="Поступило за 7 дней" value={money(inWeek)} sub={`${receipts.length} платежей`} tone="green" onClick={() => go('/bank')} />
        <Stat label="Долг арендаторов" value={money(debt)} sub={`просрочено ${money(overdue)}`} tone={overdue > 0 ? 'red' : undefined} onClick={() => go('/debtors')} />
        <Stat label="Заполняемость" value={occupancy.total ? `${Math.round(occupancy.busy / occupancy.total * 100)}%` : '—'} sub={`${occupancy.busy} из ${occupancy.total} помещений`} onClick={() => go('/floorplan')} />
        <Stat label="Открытые заявки" value={openRepairs} tone={openRepairs ? 'amber' : undefined} onClick={() => go('/repairs')} />
        <Stat label="Истекают договоры" value={expiring.length} sub="в ближайшие 30 дней" tone={expiring.length ? 'amber' : undefined} onClick={() => go('/contracts')} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(380px, 100%), 1fr))', gap: 12 }}>
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
        <Card pad={false} title={`Сделки: шаги на сегодня${steps.length ? ' · ' + steps.length : ''}`} actions={<Button small kind="ghost" onClick={() => go('/deals')}>Сделки</Button>}>
          <Table rows={steps} rowKey={x => x.id} onRow={x => go('/deals/' + x.id)} dense empty="На сегодня шагов нет" cols={[
            { key: 'c', title: 'Клиент', render: x => <><div>{x.company || x.name || '№ ' + x.number}</div><Sub>{x.kind === 'renewal' ? 'продление' : 'новый клиент'}</Sub></> },
            { key: 's', title: 'Шаг', render: x => x.next_step },
            { key: 'd', title: 'Когда', render: x => <Badge tone={(x.next_step_at || '') < new Date().toISOString().slice(0, 10) ? 'red' : 'amber'}>{dateRu(x.next_step_at)}</Badge> },
          ]} />
        </Card>
        <Card pad={false} title="Заявки с сайта" actions={<Button small kind="ghost" onClick={() => go('/deals')}>Сделки</Button>}>
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
            { key: 's', title: 'Статус', render: r => <><Badge tone={REPAIR[r.status || '']?.[1]}>{REPAIR[r.status || '']?.[0] || r.status}</Badge>{r.priority === 'emergency' && <> <Badge tone="red">авария</Badge></>}</> },
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
