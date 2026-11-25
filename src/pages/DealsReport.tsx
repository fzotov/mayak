// Отчёт по сделкам: воронка по источникам за период (заявки → показы → договоры → заселения), срок сделки, простой помещений.
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { go } from '../lib/nav'
import { Page, Card, Row, Button, Stat, Stats, Table, Input, Select, Segmented, Loading, ErrorBox, Link, Sub, Muted, C, dateRu, num, monthRu } from '../components/ui'
import { sourceLabel, localDate } from '../components/crm'

interface FunnelRow { source: string; deals: number; viewings: number; contracts: number; won: number; lost: number; avg_days_to_won: number | null }
interface VacancyRow { unit_id: string; number: string; floor: number | null; area: number | null; free_since: string | null; days_free: number | null; open_deals: number }
type Period = 'month' | 'quarter' | 'year' | 'custom'

const pad = (n: number) => String(n).padStart(2, '0')
const lastDay = (y: number, m: number) => new Date(y, m, 0).getDate() // m — 1..12

function range(p: Period, month: string, year: number, quarter: number, from: string, to: string): [string, string] {
  if (p === 'month') { const [y, m] = month.split('-').map(Number); return [`${y}-${pad(m)}-01`, `${y}-${pad(m)}-${pad(lastDay(y, m))}`] }
  if (p === 'quarter') { const m1 = (quarter - 1) * 3 + 1, m3 = m1 + 2; return [`${year}-${pad(m1)}-01`, `${year}-${pad(m3)}-${pad(lastDay(year, m3))}`] }
  if (p === 'year') return [`${year}-01-01`, `${year}-12-31`]
  return [from, to]
}
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) + '%' : '—')

export default function DealsReportPage() {
  const now = new Date()
  const [period, setPeriod] = useState<Period>('month')
  const [month, setMonth] = useState(localDate().slice(0, 7))
  const [year, setYear] = useState(now.getFullYear())
  const [quarter, setQuarter] = useState(Math.floor(now.getMonth() / 3) + 1)
  const [from, setFrom] = useState(localDate().slice(0, 8) + '01')
  const [to, setTo] = useState(localDate())
  const [funnel, setFunnel] = useState<FunnelRow[] | null>(null)
  const [vacancy, setVacancy] = useState<VacancyRow[] | null>(null)
  const [error, setError] = useState('')
  const [p1, p2] = range(period, month, year, quarter, from, to)

  async function loadFunnel() {
    if (!p1 || !p2 || p1 > p2) { setFunnel([]); return }
    setFunnel(null); setError('')
    const { data, error } = await supabase.rpc('crm_funnel', { p_from: p1, p_to: p2 })
    if (error) { setError(error.message); setFunnel([]); return }
    setFunnel((data || []) as FunnelRow[])
  }
  async function loadVacancy() {
    const { data, error } = await supabase.rpc('crm_vacancy')
    if (error) { setError(error.message); setVacancy([]); return }
    setVacancy(((data || []) as VacancyRow[]).sort((a, b) => (b.days_free ?? -1) - (a.days_free ?? -1)))
  }
  useEffect(() => { loadFunnel() }, [p1, p2])
  useEffect(() => { loadVacancy() }, [])

  const tot = useMemo(() => {
    const r = funnel || []
    const sum = (k: keyof FunnelRow) => r.reduce((s, x) => s + Number(x[k] || 0), 0)
    const won = sum('won')
    const avg = won ? r.reduce((s, x) => s + Number(x.avg_days_to_won || 0) * Number(x.won || 0), 0) / won : null
    return { deals: sum('deals'), viewings: sum('viewings'), contracts: sum('contracts'), won, lost: sum('lost'), avg }
  }, [funnel])

  const freeArea = (vacancy || []).reduce((s, v) => s + Number(v.area || 0), 0)
  const known = (vacancy || []).filter(v => v.days_free != null)
  const avgFree = known.length ? known.reduce((s, v) => s + (v.days_free as number), 0) / known.length : 0
  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i)
  const label = period === 'month' ? monthRu(month) : period === 'quarter' ? `${quarter} квартал ${year}` : period === 'year' ? `${year} год` : `${dateRu(p1)} — ${dateRu(p2)}`

  return (
    <Page actions={<Button onClick={() => go('/deals')}>К сделкам</Button>}>
      <Row gap={8}>
        <Segmented<Period> value={period} onChange={setPeriod} options={[['month', 'Месяц'], ['quarter', 'Квартал'], ['year', 'Год'], ['custom', 'Период']]} />
        {period === 'month' && <Input type="month" value={month} onChange={e => e.target.value && setMonth(e.target.value)} style={{ width: 170 }} />}
        {period === 'quarter' && <>
          <Select value={quarter} onChange={e => setQuarter(Number(e.target.value))} style={{ width: 'auto' }}>
            {[1, 2, 3, 4].map(q => <option key={q} value={q}>{q} квартал</option>)}
          </Select>
          <Select value={year} onChange={e => setYear(Number(e.target.value))} style={{ width: 'auto' }}>{years.map(y => <option key={y} value={y}>{y}</option>)}</Select>
        </>}
        {period === 'year' && <Select value={year} onChange={e => setYear(Number(e.target.value))} style={{ width: 'auto' }}>{years.map(y => <option key={y} value={y}>{y}</option>)}</Select>}
        {period === 'custom' && <>
          <Input type="date" value={from} onChange={e => setFrom(e.target.value)} style={{ width: 160 }} />
          <Muted>—</Muted>
          <Input type="date" value={to} onChange={e => setTo(e.target.value)} style={{ width: 160 }} />
        </>}
      </Row>
      {error && <ErrorBox error={error} onRetry={() => { loadFunnel(); loadVacancy() }} />}

      <Stats>
        <Stat label="Новых сделок" value={funnel ? tot.deals : '…'} sub={label} />
        <Stat label="Дошли до показа" value={funnel ? tot.viewings : '…'} sub={pct(tot.viewings, tot.deals) + ' от сделок'} />
        <Stat label="Дошли до договора" value={funnel ? tot.contracts : '…'} sub={pct(tot.contracts, tot.deals) + ' от сделок'} />
        <Stat label="Заселились" value={funnel ? tot.won : '…'} tone="green" sub={pct(tot.won, tot.deals) + ' от сделок'} />
        <Stat label="Средний срок сделки" value={tot.avg != null ? `${num(tot.avg, 1)} дн.` : '—'} sub="от создания до заселения" />
      </Stats>

      <Card title="Воронка по источникам" pad={false}>
        {funnel === null ? <Loading /> : (
          <Table rows={funnel} rowKey={r => r.source} dense empty={p1 > p2 ? 'Начало периода позже конца' : 'За период новых сделок нет'}
            cols={[
              { key: 's', title: 'Источник', sort: r => sourceLabel(r.source), render: r => <span style={{ fontWeight: 500 }}>{sourceLabel(r.source)}</span> },
              { key: 'd', title: 'Сделок', align: 'right', sort: r => r.deals, render: r => r.deals },
              { key: 'v', title: 'Показ', align: 'right', sort: r => r.viewings, render: r => <>{r.viewings}<Sub>{pct(r.viewings, r.deals)}</Sub></> },
              { key: 'c', title: 'Договор', align: 'right', sort: r => r.contracts, render: r => <>{r.contracts}<Sub>{pct(r.contracts, r.deals)}</Sub></> },
              { key: 'w', title: 'Заселён', align: 'right', sort: r => r.won, render: r => <><span style={{ color: r.won ? C.green : undefined }}>{r.won}</span><Sub>{pct(r.won, r.deals)}</Sub></> },
              { key: 'l', title: 'Отказ', align: 'right', sort: r => r.lost, render: r => <>{r.lost}<Sub>{pct(r.lost, r.deals)}</Sub></> },
              { key: 'a', title: 'Дней до заселения', align: 'right', sort: r => r.avg_days_to_won, render: r => r.avg_days_to_won != null ? num(r.avg_days_to_won, 1) : '—' },
            ]}
            foot={funnel.length > 1 ? (
              <tr style={{ fontWeight: 600 }}>
                {['Итого', tot.deals, `${tot.viewings} · ${pct(tot.viewings, tot.deals)}`, `${tot.contracts} · ${pct(tot.contracts, tot.deals)}`, `${tot.won} · ${pct(tot.won, tot.deals)}`,
                  `${tot.lost} · ${pct(tot.lost, tot.deals)}`, tot.avg != null ? num(tot.avg, 1) : '—'].map((v, i) => (
                  <td key={i} style={{ padding: '6px 10px', textAlign: i ? 'right' : 'left', borderTop: `1px solid ${C.lineStrong}`, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{v}</td>
                ))}
              </tr>
            ) : undefined} />
        )}
        <div style={{ padding: '8px 12px', fontSize: 12, color: C.faint, borderTop: `1px solid ${C.line}` }}>
          Сделки новых клиентов, созданные в периоде. Показ и договор — дошла ли сделка до этого этапа хотя бы раз. Продления в воронку не входят.
        </div>
      </Card>

      <Stats>
        <Stat label="Свободных помещений" value={vacancy ? vacancy.length : '…'} />
        <Stat label="Свободная площадь" value={vacancy ? `${num(freeArea, 1)} м²` : '…'} />
        <Stat label="В среднем простаивает" value={known.length ? `${num(avgFree)} дн.` : 'нет данных'} tone={avgFree > 90 ? 'red' : avgFree > 30 ? 'amber' : undefined} />
        <Stat label="Свободных без сделок" value={vacancy ? vacancy.filter(v => !v.open_deals).length : '…'} tone="amber" />
      </Stats>

      <Card title="Простой помещений" pad={false}>
        {vacancy === null ? <Loading /> : (
          <Table rows={vacancy} rowKey={r => r.unit_id} dense empty="Свободных помещений нет" cols={[
            { key: 'n', title: 'Помещение', sort: r => r.number, render: r => <Link to={'/units?q=' + encodeURIComponent(r.number)}>{r.number}</Link> },
            { key: 'f', title: 'Этаж', align: 'right', sort: r => r.floor, render: r => r.floor ?? '—' },
            { key: 'a', title: 'Площадь, м²', align: 'right', sort: r => Number(r.area || 0), render: r => r.area ? num(r.area, 1) : '—' },
            { key: 's', title: 'Свободно с', sort: r => r.free_since, render: r => r.free_since ? dateRu(r.free_since) : <span style={{ color: C.faint }}>нет истории</span> },
            { key: 'd', title: 'Дней', align: 'right', sort: r => r.days_free ?? -1, render: r => r.days_free == null ? <span style={{ color: C.faint }}>—</span> : <span style={{ color: r.days_free > 90 ? C.red : r.days_free > 30 ? C.amber : undefined, fontWeight: 500 }}>{num(r.days_free)}</span> },
            { key: 'o', title: 'Открытых сделок', align: 'right', sort: r => r.open_deals, render: r => r.open_deals ? r.open_deals : <span style={{ color: C.faint }}>нет</span> },
          ]} />
        )}
      </Card>
    </Page>
  )
}
