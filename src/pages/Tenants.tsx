// Список арендаторов: поиск, фильтр по группе и типу, сальдо по учёту Маяка. Строка ведёт в карточку.
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { go } from '../lib/nav'
import { Page, Card, Button, Badge, Table, Search, Select, Segmented, Loading, ErrorBox, Row, Sub, money, dateRu, C, type Tone } from '../components/ui'

interface TenantRow {
  id: string; full_name: string; type: string; tenant_group: string | null; unit_number: string | null; area_actual: number | null
  monthly_total: number | null; monthly_rent: number | null; contract_number: string | null; contract_start_date: string | null; activity_type: string | null; inn: string | null
}
const TYPE: Record<string, string> = { COMPANY: 'Юрлицо', IP: 'ИП', INDIVIDUAL: 'Физлицо', SELF_EMPLOYED: 'Самозанятый' }
const GROUP: Record<string, [string, Tone]> = { room: ['Помещение', 'neutral'], stand: ['Стойка', 'amber'], advertising: ['Реклама', 'violet'], agent: ['Агент', 'green'] }
type G = '' | 'room' | 'stand' | 'advertising' | 'agent'

export default function TenantsPage() {
  const [rows, setRows] = useState<TenantRow[] | null>(null)
  const [balances, setBalances] = useState<Record<string, number>>({})
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const [group, setGroup] = useState<G>('')
  const [type, setType] = useState('')

  async function load() {
    setError('')
    const { data, error } = await supabase.from('tenants')
      .select('id, full_name, type, tenant_group, unit_number, area_actual, monthly_total, monthly_rent, contract_number, contract_start_date, activity_type, inn')
      .order('full_name')
    if (error) { setError(error.message); setRows([]); return }
    setRows((data || []) as TenantRow[])
    // сальдо по учёту Маяка: долг минус аванс
    const { data: sal } = await supabase.rpc('tenant_saldo')
    const b: Record<string, number> = {}
    for (const r of (sal || []) as { tenant_id: string; balance: number }[]) b[r.tenant_id] = Number(r.balance)
    setBalances(b)
  }
  useEffect(() => { load() }, [])

  const count = (g: G) => (rows || []).filter(t => !g || (t.tenant_group || 'room') === g).length
  const shown = useMemo(() => (rows || []).filter(t => {
    if (group && (t.tenant_group || 'room') !== group) return false
    if (type && t.type !== type) return false
    if (!q) return true
    const s = q.toLowerCase()
    return [t.full_name, t.unit_number, t.activity_type, t.inn, t.contract_number].some(v => (v || '').toLowerCase().includes(s))
  }), [rows, q, group, type])

  return (
    <Page actions={<>
      <Button onClick={() => go('/tenants/import')}>Импорт из 1С</Button>
      <Button kind="primary" onClick={() => go('/tenants/new')}>Добавить арендатора</Button>
    </>}>
      <Row gap={12}>
        <Segmented<G> value={group} onChange={setGroup} options={[['', `Все ${count('')}`], ['room', `Помещения ${count('room')}`], ['stand', `Стойки ${count('stand')}`], ['advertising', `Реклама ${count('advertising')}`], ['agent', `Агенты ${count('agent')}`]]} />
        <Search value={q} onChange={setQ} placeholder="Название, офис, ИНН, договор" />
        <Select value={type} onChange={e => setType(e.target.value)} style={{ width: 160 }}>
          <option value="">Все типы</option>{Object.entries(TYPE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
      </Row>
      {error && <ErrorBox error={error} onRetry={load} />}
      <Card pad={false}>
        {rows === null ? <Loading /> : (
          <Table rows={shown} rowKey={t => t.id} onRow={t => go('/tenants/' + t.id)} empty="Арендаторы не найдены" cols={[
            { key: 'n', title: 'Арендатор', sort: t => t.full_name, render: t => <><div style={{ fontWeight: 500 }}>{t.full_name}</div>{t.activity_type && <Sub>{t.activity_type}</Sub>}</> },
            { key: 't', title: 'Тип', render: t => TYPE[t.type] || t.type },
            { key: 'g', title: 'Группа', render: t => { const g = GROUP[t.tenant_group || 'room']; return <Badge tone={g?.[1]}>{g?.[0] || t.tenant_group}</Badge> } },
            { key: 'u', title: 'Офис', sort: t => t.unit_number, render: t => t.unit_number || '—' },
            { key: 'a', title: 'Площадь', align: 'right', sort: t => Number(t.area_actual || 0), render: t => t.area_actual ? `${t.area_actual} м²` : '—' },
            { key: 'm', title: 'В месяц', align: 'right', sort: t => Number(t.monthly_total || t.monthly_rent || 0), render: t => money(t.monthly_total || t.monthly_rent, { zero: '—' }) },
            { key: 'c', title: 'Договор', render: t => t.contract_number ? <>№ {t.contract_number}<Sub>с {dateRu(t.contract_start_date)}</Sub></> : '—' },
            { key: 'b', title: 'Сальдо', align: 'right', sort: t => balances[t.id] ?? 0, render: t => {
              const b = balances[t.id] || 0
              return b > 0 ? <span style={{ color: C.red }}>{money(b)}</span> : b < 0 ? <span style={{ color: C.green }}>−{money(-b)}</span> : <span style={{ color: C.faint }}>—</span>
            } },
          ]} />
        )}
      </Card>
    </Page>
  )
}
