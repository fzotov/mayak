// Биллинг: начисления за месяц по договорам, счётчикам и теплу — предпросмотр, затем проведение.
// Считает база (billing_lines / billing_post); повторное проведение ничего не дублирует.
import { useMemo, useState } from 'react'
import { go } from '../lib/nav'
import { rpc, LEDGER_KEYS, type BillingLine, INVOICE_KIND } from '../lib/accounting'
import { useSb, useAction } from '../lib/query'
import { Page, Card, Button, Badge, Stat, Stats, Table, Field, Notice, Loading, ErrorBox, Modal, inputStyle, money, dateRu, monthRu, C } from '../components/ui'

interface Missing { tenant_id: string; tenant_name: string; meter_id: string; meter_type: string; meter_label: string | null }
const METER: Record<string, string> = { electricity: 'электроэнергия', cold_water: 'холодная вода', hot_water: 'горячая вода' }
const ARTICLE: Record<string, string> = {
  RENT: 'Аренда', CLEAN: 'Уборка', ELEC: 'Электроэнергия', CWATER: 'Холодная вода', HWATER: 'Горячая вода', HEAT: 'Тепло',
  AD_STELE: 'Стела', AD_OTHER: 'Реклама', PENALTY: 'Пени', SERVICE: 'Услуги', UTIL_OTHER: 'Возмещение', OTHER: 'Прочее',
}

/** Ответ billing_post (jsonb): сколько начислений проведено и счетов выставлено. */
interface PostResult { charges: number; invoices: number }

interface TenantGroup { tenant_id: string; tenant_name: string; lines: BillingLine[]; fresh: number; done: number }

export function BillingPage() {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [result, setResult] = useState<{ month: string; r: PostResult } | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const [ask, setAsk] = useState(false)
  const period = month + '-01'

  const linesQ = useSb(['rpc:billing_lines', period], () => rpc<BillingLine[]>('billing_lines', { p_period: period }))
  const missingQ = useSb(['rpc:billing_missing_readings', period], () => rpc<Missing[]>('billing_missing_readings', { p_period: period }))
  const lines = linesQ.data ?? null
  const missing = missingQ.data || []
  const loadError = linesQ.error?.message || missingQ.error?.message || ''
  const postA = useAction((p: string) => rpc<PostResult>('billing_post', { p_period: p }), {
    invalidate: LEDGER_KEYS, onSuccess: r => setResult({ month, r }),
  })

  const groups = useMemo<TenantGroup[]>(() => {
    const m = new Map<string, TenantGroup>()
    for (const l of lines || []) {
      const g = m.get(l.tenant_id) || { tenant_id: l.tenant_id, tenant_name: l.tenant_name, lines: [], fresh: 0, done: 0 }
      g.lines.push(l)
      if (l.already) g.done += Number(l.amount); else g.fresh += Number(l.amount)
      m.set(l.tenant_id, g)
    }
    return [...m.values()]
  }, [lines])

  const fresh = (lines || []).filter(l => !l.already)
  const freshSum = fresh.reduce((s, l) => s + Number(l.amount), 0)
  const doneSum = (lines || []).filter(l => l.already).reduce((s, l) => s + Number(l.amount), 0)

  const posting = postA.isPending
  // итог проведения показываем только за тот месяц, за который проводили
  const shownResult = result && result.month === month ? result.r : null
  function post() { setAsk(false); postA.mutate(period) }

  return (
    <Page actions={<>
      <Button onClick={() => { go('/invoices') }}>Счета</Button>
      <Button kind="primary" disabled={!fresh.length || posting} onClick={() => setAsk(true)}>{posting ? 'Проводим…' : `Провести${fresh.length ? ' ' + fresh.length : ''}`}</Button>
    </>}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'end', flexWrap: 'wrap' }}>
        <Field label="Месяц"><input type="month" style={{ ...inputStyle, width: 180 }} value={month} onChange={e => e.target.value && setMonth(e.target.value)} /></Field>
        <div style={{ color: C.muted, fontSize: 13, paddingBottom: 8, maxWidth: 620 }}>
          Аренда, уборка и реклама — по строкам договоров, неполный месяц пропорционально дням. Электроэнергия и вода — по показаниям за месяц, тепло — по распределению счёта за тепло. Пени — там, где включены в договоре.
        </div>
      </div>
      {loadError && <ErrorBox error={loadError} onRetry={() => { linesQ.refetch(); missingQ.refetch() }} />}
      {postA.error && <Notice tone="red">{postA.error}</Notice>}
      {shownResult && <Notice tone="green">Проведено начислений: {shownResult.charges}, выставлено счетов: {shownResult.invoices}. Оплаты и авансы разнесены автоматически.</Notice>}
      <Stats>
        <Stat label="К проведению" value={money(freshSum)} />
        <Stat label="Уже проведено за месяц" value={money(doneSum)} />
        <Stat label="Арендаторов" value={groups.length} />
        <Stat label="Нет показаний" value={missing.length} tone={missing.length ? 'amber' : undefined} />
      </Stats>
      {missing.length > 0 && (
        <Notice tone="amber">
          Нет показаний за месяц — коммунальные по этим счётчикам не начисляются, пока показания не внесут:{' '}
          {missing.map(m => `${m.tenant_name} (${METER[m.meter_type] || m.meter_type}${m.meter_label ? ', № ' + m.meter_label : ''})`).join('; ')}
        </Notice>
      )}
      <Card pad={false} title={`Начисления за ${monthRu(period).toLowerCase()}`}>
        {linesQ.isPending ? <Loading /> : (
          <Table rows={groups} rowKey={g => g.tenant_id} onRow={g => setOpen(open === g.tenant_id ? null : g.tenant_id)}
            empty="Начислять нечего: нет действующих договоров со строками за этот месяц" cols={[
              { key: 't', title: 'Арендатор', render: g => (
                <div>
                  <div style={{ fontWeight: 500 }}>{g.tenant_name}</div>
                  {open === g.tenant_id && (
                    <div style={{ marginTop: 6, display: 'grid', gap: 4 }}>
                      {g.lines.map(l => (
                        <div key={l.billing_key} style={{ display: 'flex', gap: 8, fontSize: 12, color: C.muted }}>
                          <span style={{ flex: 1 }}>{l.description}</span>
                          <span>срок {dateRu(l.due_date)}</span>
                          <span style={{ minWidth: 110, textAlign: 'right', color: C.text }}>{money(l.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) },
              { key: 'a', title: 'Состав', render: g => (
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {[...new Set(g.lines.map(l => l.article_code))].map(a => <Badge key={a}>{ARTICLE[a] || a}</Badge>)}
                </div>
              ) },
              { key: 'k', title: 'Счета', render: g => [...new Set(g.lines.map(l => INVOICE_KIND[l.kind] || l.kind))].join(', ') },
              { key: 'f', title: 'К проведению', align: 'right', render: g => money(g.fresh, { zero: '—' }) },
              { key: 'd', title: 'Проведено', align: 'right', render: g => g.done ? <span style={{ color: C.green }}>{money(g.done)}</span> : '—' },
            ]} />
        )}
      </Card>
      {ask && (
        <Modal title="Провести начисления" onClose={() => setAsk(false)} footer={<><Button onClick={() => setAsk(false)}>Отмена</Button><Button kind="primary" onClick={post}>Провести</Button></>}>
          <div>Провести {fresh.length} начислений на {money(freshSum)} за {monthRu(period).toLowerCase()} и выставить счета? Проведённое начисление не удаляется — исправляется только сторно.</div>
        </Modal>
      )}
    </Page>
  )
}
