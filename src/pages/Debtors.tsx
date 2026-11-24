// Должники: сальдо с разворотом по статьям, просрочка, последнее поступление.
// Действия: напоминание (письмо и уведомление в кабинет), акт сверки, претензия.
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { apiFetch } from '../lib/api'
import { rpc, loadArticles, type Article } from '../lib/accounting'
import { printAct } from './Settlements'
import { Page, Card, Button, Badge, Stat, Stats, Table, Search, Segmented, Notice, Loading, ErrorBox, Link, Sub, Row, money, dateRu, C } from '../components/ui'

export interface SaldoRow {
  tenant_id: string; tenant_name: string; inn: string | null; email: string | null; debt: number; advance: number; deposit: number; balance: number
  overdue: number; max_days_overdue: number; oldest_due: string | null; last_payment_date: string | null; last_payment_amount: number | null
  articles: { code: string; name: string; debt: number }[]
}
type F = 'overdue' | 'all' | 'advance'

export default function DebtorsPage() {
  const [rows, setRows] = useState<SaldoRow[] | null>(null)
  const [articles, setArticles] = useState<Article[]>([])
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const [f, setF] = useState<F>('overdue')
  const [open, setOpen] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ tone: 'green' | 'red'; text: string } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  async function load() {
    setError('')
    try { setRows(await rpc<SaldoRow[]>('tenant_saldo')); setArticles(await loadArticles()) } catch (e: any) { setError(e.message); setRows([]) }
  }
  useEffect(() => { load() }, [])

  const shown = useMemo(() => (rows || []).filter(r =>
    (f === 'overdue' ? Number(r.overdue) > 0 : f === 'advance' ? Number(r.balance) < 0 : Number(r.balance) > 0) &&
    (!q || r.tenant_name.toLowerCase().includes(q.toLowerCase()) || (r.inn || '').includes(q))), [rows, f, q])
  const total = (k: keyof SaldoRow) => (rows || []).reduce((s, r) => s + Math.max(0, Number(r[k] || 0)), 0)

  async function remind(r: SaldoRow) {
    setBusy(r.tenant_id); setMsg(null)
    try {
      const res = await apiFetch('/api/send-reminder', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenantId: r.tenant_id }) })
      const j = await res.json()
      if (!res.ok || !j.ok) throw new Error(j.error || 'Напоминание не отправлено')
      setMsg({ tone: 'green', text: `Напоминание отправлено: ${r.tenant_name}, ${j.to}. Уведомление появилось в кабинете.` })
    } catch (e: any) { setMsg({ tone: 'red', text: e.message }) }
    setBusy(null)
  }

  async function claim(r: SaldoRow) {
    const { data: ll } = await supabase.from('landlords').select('*').order('is_default', { ascending: false }).limit(1).maybeSingle()
    const { data: t } = await supabase.from('tenants').select('full_name, inn, legal_address, director_name, director_position').eq('id', r.tenant_id).single()
    const { data: leases } = await supabase.from('leases').select('number, start_date').eq('tenant_id', r.tenant_id).eq('status', 'active').limit(1)
    printClaim(r, t, ll, leases?.[0])
  }

  return (
    <Page>
      <Row gap={12}>
        <Segmented<F> value={f} onChange={setF} options={[['overdue', 'С просрочкой'], ['all', 'Все с долгом'], ['advance', 'С переплатой']]} />
        <Search value={q} onChange={setQ} placeholder="Арендатор или ИНН" />
      </Row>
      {error && <ErrorBox error={error} onRetry={load} />}
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      <Stats>
        <Stat label="Долг арендаторов" value={money(total('balance'))} tone="red" />
        <Stat label="Из них просрочено" value={money(total('overdue'))} tone="red" />
        <Stat label="Должников с просрочкой" value={(rows || []).filter(r => Number(r.overdue) > 0).length} />
        <Stat label="Переплаты (авансы)" value={money((rows || []).reduce((s, r) => s + Math.max(0, -Number(r.balance)), 0))} tone="green" />
      </Stats>
      <Card pad={false}>
        {rows === null ? <Loading /> : (
          <Table rows={shown} rowKey={r => r.tenant_id} onRow={r => setOpen(open === r.tenant_id ? null : r.tenant_id)}
            empty={rows.length === 0 ? 'Начислений ещё нет: долги появятся после проведения биллинга и загрузки выписок' : 'Никого нет'} cols={[
              { key: 'n', title: 'Арендатор', sort: r => r.tenant_name, render: r => (
                <div>
                  <Link to={'/settlements/' + r.tenant_id}>{r.tenant_name}</Link>
                  {r.inn && <Sub>ИНН {r.inn}</Sub>}
                  {open === r.tenant_id && (
                    <div style={{ marginTop: 8, display: 'grid', gap: 3 }}>
                      {r.articles.map(a => (
                        <div key={a.code} style={{ display: 'flex', gap: 12, fontSize: 12, color: C.muted }}>
                          <span style={{ flex: 1 }}>{a.name}</span><span style={{ color: Number(a.debt) > 0 ? C.red : C.green }}>{money(a.debt)}</span>
                        </div>
                      ))}
                      {Number(r.advance) > 0 && <div style={{ display: 'flex', gap: 12, fontSize: 12, color: C.muted }}><span style={{ flex: 1 }}>Аванс</span><span style={{ color: C.green }}>−{money(r.advance)}</span></div>}
                    </div>
                  )}
                </div>
              ) },
              { key: 'b', title: 'Сальдо', align: 'right', sort: r => Number(r.balance), render: r => <span style={{ color: Number(r.balance) > 0 ? C.red : C.green, fontWeight: 500 }}>{money(r.balance)}</span> },
              { key: 'o', title: 'Просрочено', align: 'right', sort: r => Number(r.overdue), render: r => Number(r.overdue) > 0 ? money(r.overdue) : '—' },
              { key: 'd', title: 'Дней', align: 'right', sort: r => r.max_days_overdue, render: r => r.max_days_overdue > 0
                ? <Badge tone={r.max_days_overdue > 30 ? 'red' : 'amber'}>{r.max_days_overdue}</Badge> : '—' },
              { key: 'p', title: 'Последнее поступление', sort: r => r.last_payment_date, render: r => r.last_payment_date ? <>{dateRu(r.last_payment_date)}<Sub>{money(r.last_payment_amount)}</Sub></> : <span style={{ color: C.faint }}>не было</span> },
              { key: 'x', title: '', render: r => Number(r.balance) > 0 ? (
                <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }} onClick={e => e.stopPropagation()}>
                  <Button small disabled={busy === r.tenant_id || !r.email} title={r.email ? '' : 'У арендатора не указана почта'} onClick={() => remind(r)}>Напомнить</Button>
                  <Button small onClick={() => printAct({ id: r.tenant_id, full_name: r.tenant_name, inn: r.inn }, new Date().getFullYear() + '-01-01', new Date().toISOString().slice(0, 10), '', articles)}>Акт сверки</Button>
                  <Button small kind="danger" onClick={() => claim(r)}>Претензия</Button>
                </div>
              ) : null },
            ]} />
        )}
      </Card>
    </Page>
  )
}

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))
const rub = (n: number) => Number(n).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** Претензия о погашении задолженности: печатная форма по данным расчётов. */
function printClaim(r: SaldoRow, t: any, ll: any, lease: any) {
  const w = window.open('', '_blank')
  if (!w) return
  const d = new Date().toLocaleDateString('ru-RU')
  const rows = r.articles.filter(a => Number(a.debt) > 0).map(a => `<tr><td>${esc(a.name)}</td><td class="r">${rub(a.debt)}</td></tr>`).join('')
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Претензия — ${esc(r.tenant_name)}</title><style>
    body{font-family:Arial,sans-serif;font-size:11pt;margin:20mm;line-height:1.5} .to{margin-left:50%} h1{font-size:13pt;text-align:center;margin:10mm 0 6mm}
    table{border-collapse:collapse;width:100%;margin:4mm 0} td{border:1px solid #000;padding:2mm} .r{text-align:right;white-space:nowrap} p{margin:3mm 0;text-align:justify}
  </style></head><body>
    <div class="to">${esc(t?.director_position || 'Руководителю')} ${esc(t?.director_name || '')}<br>${esc(r.tenant_name)}${r.inn ? '<br>ИНН ' + esc(r.inn) : ''}${t?.legal_address ? '<br>' + esc(t.legal_address) : ''}</div>
    <div class="to" style="margin-top:6mm">от ${esc(ll?.name || 'Арендодателя')}<br>ИНН ${esc(ll?.inn || '')}<br>${esc(ll?.legal_address || '')}</div>
    <h1>ПРЕТЕНЗИЯ<br><span style="font-weight:normal;font-size:11pt">о погашении задолженности по договору аренды</span></h1>
    <p>Между ${esc(ll?.name || 'Арендодателем')} и ${esc(r.tenant_name)} заключён договор аренды нежилого помещения${lease?.number ? ' № ' + esc(lease.number) : ''}${lease?.start_date ? ' от ' + new Date(lease.start_date + 'T00:00:00').toLocaleDateString('ru-RU') : ''}.</p>
    <p>По состоянию на ${d} за Вами числится задолженность в размере <b>${rub(r.balance)} руб.</b>${Number(r.overdue) > 0 ? `, из них просрочено ${rub(r.overdue)} руб.${r.oldest_due ? ' (самый ранний срок оплаты — ' + new Date(r.oldest_due + 'T00:00:00').toLocaleDateString('ru-RU') + ')' : ''}` : ''}:</p>
    <table>${rows}${Number(r.advance) > 0 ? `<tr><td>Аванс (зачтён)</td><td class="r">−${rub(r.advance)}</td></tr>` : ''}<tr><td><b>Итого</b></td><td class="r"><b>${rub(r.balance)}</b></td></tr></table>
    <p>Просим погасить задолженность в течение 10 (десяти) календарных дней с даты получения настоящей претензии по реквизитам: ${esc(ll?.name || '')}, р/с ${esc(ll?.account || '')}, ${esc(ll?.bank_name || '')}, БИК ${esc(ll?.bik || '')}, к/с ${esc(ll?.corr_account || '')}.</p>
    <p>В случае неисполнения требования Арендодатель будет вынужден обратиться в суд с требованием о взыскании задолженности, неустойки и судебных расходов в соответствии с условиями договора и законодательством Российской Федерации.</p>
    <p style="margin-top:14mm">${d}</p><p>${esc(ll?.name || '')} _______________________</p>
    <script>window.onload=function(){window.print()}</script>
  </body></html>`)
  w.document.close()
}
