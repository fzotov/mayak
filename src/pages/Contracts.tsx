// Договоры аренды (leases) со строками: помещения со ставкой, уборка, реклама и другие ежемесячные начисления.
// Изменение ставки — новая строка с датой начала; старая закрывается датой окончания, история сохраняется.
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { loadArticles, type Article, type Lease, type LeaseLine } from '../lib/accounting'
import { Page, Card, Button, Badge, Table, Field, Modal, Notice, Loading, Stats, Stat, inputStyle, money, dateRu, today, C } from '../components/ui'

const go = (id?: string) => { window.location.hash = '/contracts' + (id ? '/' + id : '') }
const STATUS: Record<string, { label: string; tone: 'green' | 'neutral' | 'amber' }> = {
  active: { label: 'Действует', tone: 'green' }, draft: { label: 'Черновик', tone: 'amber' }, closed: { label: 'Закрыт', tone: 'neutral' },
}
interface LeaseRow extends Lease { tenants: { full_name: string } | null; lease_lines: LeaseLine[] }
const activeOn = (l: LeaseLine, d: string) => l.valid_from <= d && (!l.valid_to || l.valid_to >= d)

export default function ContractsPage({ leaseId }: { leaseId?: string | null }) {
  return leaseId ? <LeaseView key={leaseId} id={leaseId} /> : <LeaseList />
}

function LeaseList() {
  const [rows, setRows] = useState<LeaseRow[] | null>(null)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('active')
  const [creating, setCreating] = useState(false)
  useEffect(() => {
    supabase.from('leases').select('*, tenants(full_name), lease_lines(*)').order('start_date', { ascending: false })
      .then(({ data }) => setRows((data || []) as LeaseRow[]))
  }, [])
  const d = today()
  const in60 = new Date(Date.now() + 60 * 864e5).toISOString().slice(0, 10)
  const shown = useMemo(() => (rows || []).filter(r => (!status || r.status === status) &&
    (!q || (r.tenants?.full_name || '').toLowerCase().includes(q.toLowerCase()) || (r.number || '').includes(q)))
    .sort((a, b) => (a.tenants?.full_name || '').localeCompare(b.tenants?.full_name || '', 'ru')), [rows, q, status])
  const monthly = (r: LeaseRow) => r.lease_lines.filter(l => activeOn(l, d)).reduce((s, l) => s + Number(l.amount), 0)

  return (
    <Page actions={<Button kind="primary" onClick={() => setCreating(true)}>Новый договор</Button>}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'end', flexWrap: 'wrap' }}>
        <Field label="Статус"><select style={{ ...inputStyle, width: 170 }} value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">Все</option>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select></Field>
        <Field label="Поиск"><input style={{ ...inputStyle, width: 240 }} value={q} onChange={e => setQ(e.target.value)} placeholder="Арендатор или номер" /></Field>
      </div>
      <Stats>
        <Stat label="Договоров" value={shown.length} />
        <Stat label="В месяц по действующим" value={money(shown.filter(r => r.status === 'active').reduce((s, r) => s + monthly(r), 0))} />
        <Stat label="Заканчиваются за 60 дней" value={shown.filter(r => r.end_date && r.end_date >= d && r.end_date <= in60).length} tone="amber" />
      </Stats>
      <Card pad={false}>
        {rows === null ? <Loading /> : (
          <Table rows={shown} rowKey={r => r.id} onRow={r => go(r.id)} empty="Договоров нет" cols={[
            { key: 't', title: 'Арендатор', render: r => r.tenants?.full_name || '—' },
            { key: 'n', title: 'Договор', render: r => <>№ {r.number || '—'}<div style={{ fontSize: 12, color: C.muted }}>с {dateRu(r.start_date)}{r.end_date ? ' по ' + dateRu(r.end_date) : ''}</div></> },
            { key: 'u', title: 'Помещения', render: r => [...new Set(r.lease_lines.filter(l => l.article_code === 'RENT' && activeOn(l, d)).map(l => l.unit_label).filter(Boolean))].join(', ') || '—' },
            { key: 'm', title: 'В месяц', align: 'right', render: r => money(monthly(r), { zero: '—' }) },
            { key: 'dp', title: 'Депозит', align: 'right', render: r => money(r.deposit_required, { zero: '—' }) },
            { key: 's', title: 'Статус', render: r => <><Badge tone={STATUS[r.status]?.tone}>{STATUS[r.status]?.label || r.status}</Badge>
              {r.end_date && r.end_date >= d && r.end_date <= in60 && <div style={{ marginTop: 2 }}><Badge tone="amber">заканчивается</Badge></div>}</> },
          ]} />
        )}
      </Card>
      {creating && <NewLease onClose={() => setCreating(false)} />}
    </Page>
  )
}

function NewLease({ onClose }: { onClose: () => void }) {
  const [tenants, setTenants] = useState<{ id: string; full_name: string }[]>([])
  const [f, setF] = useState({ tenant: '', number: '', start: today(), end: '' })
  const [error, setError] = useState('')
  useEffect(() => { supabase.from('tenants').select('id, full_name').order('full_name').then(({ data }) => setTenants(data || [])) }, [])
  async function create() {
    if (!f.tenant || !f.start) { setError('Выберите арендатора и дату начала'); return }
    const { data, error } = await supabase.from('leases').insert({ tenant_id: f.tenant, number: f.number || null, start_date: f.start, end_date: f.end || null, status: 'draft' }).select('id').single()
    if (error) { setError(error.message); return }
    go(data.id)
  }
  return (
    <Modal title="Новый договор" onClose={onClose} footer={<><Button onClick={onClose}>Отмена</Button><Button kind="primary" onClick={create}>Создать</Button></>}>
      <Field label="Арендатор"><select style={inputStyle} value={f.tenant} onChange={e => setF({ ...f, tenant: e.target.value })}>
        <option value="">Выберите…</option>{tenants.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
      </select></Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <Field label="Номер"><input style={inputStyle} value={f.number} onChange={e => setF({ ...f, number: e.target.value })} /></Field>
        <Field label="Начало"><input type="date" style={inputStyle} value={f.start} onChange={e => setF({ ...f, start: e.target.value })} /></Field>
        <Field label="Окончание"><input type="date" style={inputStyle} value={f.end} onChange={e => setF({ ...f, end: e.target.value })} /></Field>
      </div>
      <Notice>Договор создаётся черновиком: добавьте строки (помещения и ставки) и переведите в «Действует» — тогда он попадёт в биллинг.</Notice>
      {error && <Notice tone="red">{error}</Notice>}
    </Modal>
  )
}

function LeaseView({ id }: { id: string }) {
  const [lease, setLease] = useState<LeaseRow | null>(null)
  const [form, setForm] = useState<Partial<Lease>>({})
  const [articles, setArticles] = useState<Article[]>([])
  const [units, setUnits] = useState<{ id: string; number: string; area: number }[]>([])
  const [line, setLine] = useState<Partial<LeaseLine> | null>(null)
  const [rate, setRate] = useState<LeaseLine | null>(null)
  const [msg, setMsg] = useState<{ tone: 'green' | 'red'; text: string } | null>(null)

  async function load() {
    const { data } = await supabase.from('leases').select('*, tenants(full_name), lease_lines(*)').eq('id', id).single()
    const l = data as LeaseRow
    l.lease_lines.sort((a, b) => a.article_code.localeCompare(b.article_code) || b.valid_from.localeCompare(a.valid_from))
    setLease(l); setForm(l)
  }
  useEffect(() => {
    load(); loadArticles().then(setArticles)
    supabase.from('units').select('id, number, area').order('number').then(({ data }) => setUnits((data || []) as any))
  }, [id])

  async function save() {
    setMsg(null)
    const { error } = await supabase.from('leases').update({
      number: form.number || null, start_date: form.start_date || null, end_date: form.end_date || null, status: form.status,
      payment_day: Number(form.payment_day) || 5, deposit_required: Number(form.deposit_required) || 0, billing_mode: form.billing_mode,
      penalty_enabled: !!form.penalty_enabled, penalty_rate: Number(form.penalty_rate) || 0, notes: form.notes || null, updated_at: new Date().toISOString(),
    }).eq('id', id)
    setMsg(error ? { tone: 'red', text: error.message } : { tone: 'green', text: 'Сохранено' })
    if (!error) load()
  }

  async function saveLine() {
    if (!line) return
    const row = {
      lease_id: id, article_code: line.article_code || 'RENT', unit_id: line.unit_id || null, unit_label: line.unit_label || null,
      area: line.area ? Number(line.area) : null, rate_per_sqm: line.rate_per_sqm ? Number(line.rate_per_sqm) : null,
      amount: Number(line.amount) || 0, valid_from: line.valid_from || today(), valid_to: line.valid_to || null, note: line.note || null,
    }
    const { error } = line.id ? await supabase.from('lease_lines').update(row).eq('id', line.id) : await supabase.from('lease_lines').insert(row)
    if (error) { setMsg({ tone: 'red', text: error.message }); return }
    setLine(null); load()
  }

  async function deleteLine(l: LeaseLine) {
    const { count } = await supabase.from('charges').select('id', { count: 'exact', head: true }).like('billing_key', `L:${l.id}:%`)
    if ((count || 0) > 0) { setMsg({ tone: 'red', text: 'По строке уже есть начисления — её нельзя удалить, только закрыть датой окончания' }); return }
    const { error } = await supabase.from('lease_lines').delete().eq('id', l.id)
    if (error) setMsg({ tone: 'red', text: error.message }); else load()
  }

  if (!lease) return <Loading />
  const d = today()
  const monthly = lease.lease_lines.filter(l => activeOn(l, d)).reduce((s, l) => s + Number(l.amount), 0)
  const art = (c: string) => articles.find(a => a.code === c)?.name || c
  const set = (k: keyof Lease) => (e: any) => setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })

  return (
    <Page title={`Договор № ${lease.number || 'без номера'} — ${lease.tenants?.full_name || ''}`} actions={<>
      <Button onClick={() => go()}>Все договоры</Button>
      <Button onClick={() => { window.location.hash = '/settlements/' + lease.tenant_id }}>Расчёты</Button>
    </>}>
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      <Card title="Условия" actions={<Button kind="primary" small onClick={save}>Сохранить</Button>}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <Field label="Номер"><input style={inputStyle} value={form.number || ''} onChange={set('number')} /></Field>
          <Field label="Статус"><select style={inputStyle} value={form.status} onChange={set('status')}>
            {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select></Field>
          <Field label="Начало"><input type="date" style={inputStyle} value={form.start_date || ''} onChange={set('start_date')} /></Field>
          <Field label="Окончание" hint="пусто — бессрочный"><input type="date" style={inputStyle} value={form.end_date || ''} onChange={set('end_date')} /></Field>
          <Field label="Оплата аренды до (число месяца)"><input type="number" min={1} max={28} style={inputStyle} value={form.payment_day ?? 5} onChange={set('payment_day')} /></Field>
          <Field label="Счета"><select style={inputStyle} value={form.billing_mode} onChange={set('billing_mode')}>
            <option value="split">Раздельно: аренда авансом, коммунальные по факту</option><option value="single">Одним счётом</option>
          </select></Field>
          <Field label="Депозит по договору, ₽"><input inputMode="decimal" style={inputStyle} value={form.deposit_required ?? 0} onChange={set('deposit_required')} /></Field>
          <Field label="Пени, % в день" hint="начисляются, если включены"><input inputMode="decimal" style={inputStyle} value={form.penalty_rate ?? 0} onChange={set('penalty_rate')} /></Field>
        </div>
        <label style={{ display: 'flex', gap: 8, fontSize: 13, marginTop: 12 }}><input type="checkbox" checked={!!form.penalty_enabled} onChange={set('penalty_enabled')} /> Начислять пени за просрочку</label>
        <Field label="Примечание"><input style={inputStyle} value={form.notes || ''} onChange={set('notes')} /></Field>
      </Card>

      <Card pad={false} title={`Ежемесячные начисления · сейчас ${money(monthly)} в месяц`} actions={<Button small kind="primary" onClick={() => setLine({ article_code: 'RENT', valid_from: lease.start_date || today() })}>Добавить строку</Button>}>
        <Table rows={lease.lease_lines} rowKey={l => l.id} empty="Строк нет — по договору ничего не начисляется" cols={[
          { key: 'a', title: 'Что', render: l => <><div style={{ color: activeOn(l, d) ? undefined : C.faint }}>{art(l.article_code)}{l.unit_label ? `, пом. ${l.unit_label}` : ''}</div>{l.note && <div style={{ fontSize: 12, color: C.muted }}>{l.note}</div>}</> },
          { key: 'r', title: 'Площадь × ставка', render: l => l.area && l.rate_per_sqm ? `${l.area} м² × ${money(l.rate_per_sqm)}` : '—' },
          { key: 'm', title: 'В месяц', align: 'right', render: l => money(l.amount) },
          { key: 'p', title: 'Действует', render: l => <>с {dateRu(l.valid_from)}{l.valid_to ? ' по ' + dateRu(l.valid_to) : ''}{!activeOn(l, d) && <div><Badge>{l.valid_from > d ? 'с будущей даты' : 'в истории'}</Badge></div>}</> },
          { key: 'x', title: '', render: l => (
            <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
              {activeOn(l, d) && <Button small onClick={() => setRate(l)}>Новая ставка</Button>}
              <Button small kind="ghost" onClick={() => setLine(l)}>Изменить</Button>
              <Button small kind="ghost" onClick={() => deleteLine(l)}>Удалить</Button>
            </div>
          ) },
        ]} />
      </Card>
      <Notice>Неполный месяц при въезде и выезде биллинг считает пропорционально дням. Уже проведённые начисления правка строк не меняет — для них есть сторно в расчётах.</Notice>

      {line && (
        <Modal title={line.id ? 'Строка договора' : 'Новая строка'} onClose={() => setLine(null)} footer={<><Button onClick={() => setLine(null)}>Отмена</Button><Button kind="primary" onClick={saveLine}>Сохранить</Button></>}>
          <Field label="Статья"><select style={inputStyle} value={line.article_code} onChange={e => setLine({ ...line, article_code: e.target.value })}>
            {articles.filter(a => a.active && a.register === 'receivable' && !['OPENING', 'PENALTY'].includes(a.code)).map(a => <option key={a.code} value={a.code}>{a.grp}: {a.name}</option>)}
          </select></Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Помещение"><select style={inputStyle} value={line.unit_id || ''} onChange={e => { const u = units.find(x => x.id === e.target.value); setLine({ ...line, unit_id: e.target.value || null, unit_label: u?.number || line.unit_label, area: u?.area ?? line.area }) }}>
              <option value="">{line.unit_label ? `как в карточке: ${line.unit_label}` : 'Не выбрано'}</option>{units.map(u => <option key={u.id} value={u.id}>{u.number} · {u.area} м²</option>)}
            </select></Field>
            <Field label="Площадь, м²"><input inputMode="decimal" style={inputStyle} value={line.area ?? ''} onChange={e => { const area = e.target.value; setLine({ ...line, area: area as any, amount: line.rate_per_sqm && area ? Math.round(Number(area) * Number(line.rate_per_sqm) * 100) / 100 : line.amount }) }} /></Field>
            <Field label="Ставка, ₽ за м² в месяц"><input inputMode="decimal" style={inputStyle} value={line.rate_per_sqm ?? ''} onChange={e => { const r = e.target.value; setLine({ ...line, rate_per_sqm: r as any, amount: line.area && r ? Math.round(Number(line.area) * Number(r) * 100) / 100 : line.amount }) }} /></Field>
            <Field label="Сумма в месяц, ₽"><input inputMode="decimal" style={inputStyle} value={line.amount ?? ''} onChange={e => setLine({ ...line, amount: e.target.value as any })} /></Field>
            <Field label="Действует с"><input type="date" style={inputStyle} value={line.valid_from || ''} onChange={e => setLine({ ...line, valid_from: e.target.value })} /></Field>
            <Field label="по" hint="пусто — бессрочно"><input type="date" style={inputStyle} value={line.valid_to || ''} onChange={e => setLine({ ...line, valid_to: e.target.value || null })} /></Field>
          </div>
          <Field label="Примечание"><input style={inputStyle} value={line.note || ''} onChange={e => setLine({ ...line, note: e.target.value })} /></Field>
        </Modal>
      )}
      {rate && <NewRate line={rate} onClose={() => setRate(null)} onDone={() => { setRate(null); load() }} />}
    </Page>
  )
}

// Индексация или смена ставки: старая строка закрывается днём раньше, новая начинается с выбранной даты.
function NewRate({ line, onClose, onDone }: { line: LeaseLine; onClose: () => void; onDone: () => void }) {
  const nextMonth = (() => { const n = new Date(); return new Date(Date.UTC(n.getFullYear(), n.getMonth() + 1, 1)).toISOString().slice(0, 10) })()
  const [f, setF] = useState({ from: nextMonth, rate: String(line.rate_per_sqm ?? ''), amount: String(line.amount) })
  const [error, setError] = useState('')
  async function apply() {
    if (f.from <= line.valid_from) { setError('Новая ставка должна начинаться позже текущей'); return }
    const prevDay = new Date(new Date(f.from + 'T00:00:00Z').getTime() - 864e5).toISOString().slice(0, 10)
    const { error: e1 } = await supabase.from('lease_lines').update({ valid_to: prevDay }).eq('id', line.id)
    if (e1) { setError(e1.message); return }
    const { error: e2 } = await supabase.from('lease_lines').insert({
      lease_id: line.lease_id, article_code: line.article_code, unit_id: line.unit_id, unit_label: line.unit_label, area: line.area,
      rate_per_sqm: f.rate ? Number(f.rate) : null, amount: Number(f.amount), valid_from: f.from, valid_to: line.valid_to, note: line.note,
    })
    if (e2) { setError(e2.message); return }
    onDone()
  }
  return (
    <Modal title="Новая ставка" onClose={onClose} footer={<><Button onClick={onClose}>Отмена</Button><Button kind="primary" onClick={apply}>Применить</Button></>}>
      <Notice>Сейчас: {money(line.amount)} в месяц{line.rate_per_sqm ? ` (${line.area} м² × ${money(line.rate_per_sqm)})` : ''}. Прежняя ставка останется в истории.</Notice>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <Field label="С даты"><input type="date" style={inputStyle} value={f.from} onChange={e => setF({ ...f, from: e.target.value })} /></Field>
        <Field label="Ставка, ₽/м²"><input inputMode="decimal" style={inputStyle} value={f.rate} onChange={e => setF({ ...f, rate: e.target.value, amount: line.area && e.target.value ? String(Math.round(Number(line.area) * Number(e.target.value) * 100) / 100) : f.amount })} /></Field>
        <Field label="В месяц, ₽"><input inputMode="decimal" style={inputStyle} value={f.amount} onChange={e => setF({ ...f, amount: e.target.value })} /></Field>
      </div>
      {error && <Notice tone="red">{error}</Notice>}
    </Modal>
  )
}
