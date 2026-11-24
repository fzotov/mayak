import { apiFetch } from '../lib/api'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { Page, Card, Row, Button, Badge, Stat, Stats, Table, Search, Notice, Loading, Empty, Sub, Muted, C, type Tone } from '../components/ui'

const FMT = (n: number) => Number(n).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const FMTD = (s: string) => s ? new Date(s).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'

// ── 1C data types ─────────────────────────────────────────────────────────────
interface Doc { id: string; type: string; number: string; date: string; debt: number; advance: number }
interface Contract1C { id: string; name: string; debt: number; advance: number; docs: Doc[] }
interface Op { id: string; kind: string; type: string; number: string; date: string; contractId: string; charged: number; paid: number }
interface Counterparty {
  id: string; name: string; inn: string; kpp: string
  debt: number; advance: number  // authoritative balance from 1C — never recompute from children
  netto: number                  // debt - advance: >0 = owed to us, <0 = overpaid
  contracts: Contract1C[]
  operations: Op[]
  tenantId?: string
}

// ── Ledger entry from DB ───────────────────────────────────────────────────────
interface LedgerEntry {
  id: string; tenant_id: string | null; counterparty_1c_id: string | null
  contract_1c_id: string | null; contract_name: string | null
  kind: string; doc_type: string | null; doc_number: string | null
  date: string; charged: number; paid: number; source: string; note: string | null
}

const KIND_TONE: Record<string, Tone> = { charge: 'red', payment: 'green', mixed: 'blue', adjustment: 'amber' }
const KIND_LABEL: Record<string, string> = {
  charge: 'Начисление', payment: 'Оплата', mixed: 'Начисление', adjustment: 'Корректировка'
}

type Msg = { tone: 'green' | 'red'; text: string }

export default function LedgerPage() {
  const [cps, setCps] = useState<Counterparty[]>([])
  const [ops, setOps] = useState<LedgerEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [importing1c, setImporting1c] = useState(false)
  const [importingBank, setImportingBank] = useState(false)
  const [importMsg, setImportMsg] = useState<Msg | null>(null)
  const [selected, setSelected] = useState<Counterparty | null>(null)
  const [search, setSearch] = useState('')
  const [lastUpdate, setLastUpdate] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      // 1C data = authoritative balances; Supabase tenants = for linking
      const [r1cRes, { data: tenantRows }] = await Promise.all([
        apiFetch('/api/debts-1c'),
        supabase.from('tenants').select('id,inn,id_1c'),
      ])
      const r1c = await r1cRes.json().catch(() => ({ ok: false, error: `1С не отвечает (ответ ${r1cRes.status})` }))
      if (!r1c.ok) { setImportMsg({ tone: 'red', text: r1c.error || '1С не отвечает' }); setLoading(false); return }

      // Build tenant lookup: id_1c → tenantId, inn → tenantId
      const byId1c: Record<string, string> = {}
      const byInn: Record<string, string> = {}
      for (const t of (tenantRows || [])) {
        if (t.id_1c) byId1c[t.id_1c] = t.id
        if (t.inn)   byInn[t.inn]   = t.id
      }

      const enriched: Counterparty[] = r1c.counterparties.map((cp: any) => ({
        ...cp,
        netto: cp.debt - cp.advance,          // >0 = должен нам, <0 = переплата
        tenantId: byId1c[cp.id] || byInn[cp.inn] || undefined,
      }))

      if (r1c.meta?.asOf) setLastUpdate(new Date(r1c.meta.asOf).toLocaleString('ru-RU') + (r1c.stale ? ' — 1С сейчас не отвечает, показаны сохранённые данные' : ''))
      setCps(enriched)

      // Load operations from DB for the period (history tab)
      const { data: opRows, error: opErr } = await supabase
        .from('ledger_entries')
        .select('*')
        .order('date', { ascending: false })
        .limit(5000)
      if (opErr) setImportMsg({ tone: 'red', text: 'Не удалось загрузить историю операций: ' + opErr.message })
      setOps(opRows || [])
    } catch (e: any) {
      setImportMsg({ tone: 'red', text: '1С не отвечает: ' + (e?.message || 'ошибка сети') })
    } finally {
      setLoading(false)
    }
  }

  async function import1C() {
    setImporting1c(true); setImportMsg(null)
    try {
      // First sync tenants so id_1c is populated
      await apiFetch('/api/sync-tenants-1c', { method: 'POST' })
      const r = await apiFetch('/api/import-1c-ledger', { method: 'POST' })
      const json = await r.json()
      if (json.ok) {
        setImportMsg({ tone: 'green', text: `1С: ${json.imported} операций импортировано (${json.matched} сопоставлено, ${json.unmatched} без арендатора)` })
        await load()
      } else setImportMsg({ tone: 'red', text: 'Ошибка: ' + json.error })
    } catch (e: any) { setImportMsg({ tone: 'red', text: 'Ошибка: ' + e.message }) }
    finally { setImporting1c(false) }
  }

  async function importBankFile(file: File) {
    setImportingBank(true); setImportMsg(null)
    try {
      const text = await file.text()
      const r = await apiFetch('/api/import-bank-csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv: text, filename: file.name }),
      })
      const json = await r.json()
      if (json.ok) {
        setImportMsg({ tone: 'green', text: `Банк «${file.name}»: ${json.total} платежей, ${json.matched} сопоставлено с арендаторами` })
        await load()
      } else setImportMsg({ tone: 'red', text: 'Ошибка: ' + json.error })
    } catch (e: any) { setImportMsg({ tone: 'red', text: 'Ошибка: ' + e.message }) }
    finally { setImportingBank(false) }
  }

  if (loading) return <Loading text="Загрузка из 1С…" />

  // ── Detail view ──────────────────────────────────────────────────────────────
  if (selected) {
    const cpOps = ops
      .filter(e => e.counterparty_1c_id === selected.id || e.tenant_id === selected.tenantId)
      .sort((a, b) => b.date.localeCompare(a.date))

    return (
      <Page
        title={<div>{selected.name}<Sub>ИНН: {selected.inn || '—'}{selected.kpp ? ' / КПП: ' + selected.kpp : ''}</Sub></div>}
        actions={<Button onClick={() => setSelected(null)}>Назад к списку</Button>}>
        {/* Balance from 1C — authoritative, not recomputed */}
        <Stats>
          {selected.netto > 0 && <Stat label="К оплате" value={FMT(selected.netto) + ' ₽'} tone="red" sub={'Данные 1С · ' + lastUpdate} />}
          {selected.netto < 0 && <Stat label="Переплата" value={FMT(-selected.netto) + ' ₽'} tone="green" sub={'Данные 1С · ' + lastUpdate} />}
          {selected.netto === 0 && <Stat label="Сальдо" value="Нет задолженности" sub={'Данные 1С · ' + lastUpdate} />}
        </Stats>

        {/* Contracts with outstanding docs */}
        {selected.contracts.map(ct => (
          <Card key={ct.id} pad={false} title={ct.name} actions={
            <span style={{ fontSize: 13, fontWeight: 600 }}>
              {ct.debt > 0 && ct.advance > 0
                ? <span style={{ color: C.amber }}>Долг {FMT(ct.debt)} / Аванс {FMT(ct.advance)} ₽</span>
                : ct.debt > 0
                  ? <span style={{ color: C.red }}>К оплате {FMT(ct.debt)} ₽</span>
                  : ct.advance > 0
                    ? <span style={{ color: C.green }}>Переплата {FMT(ct.advance)} ₽</span>
                    : <Badge tone="green">Закрыт</Badge>
              }
            </span>
          }>
            {ct.docs.length > 0 && (
              <Table dense rows={ct.docs} rowKey={d => d.id} cols={[
                { key: 'd', title: 'Дата', render: d => <Muted>{FMTD(d.date)}</Muted> },
                { key: 'n', title: 'Документ', render: d => `${d.type} №${d.number}` },
                { key: 's', title: 'Сумма', align: 'right', render: d => (
                  <span style={{ fontWeight: 600 }}>
                    {d.debt > 0 && <span style={{ color: C.red }}>{FMT(d.debt)} ₽ долг</span>}
                    {d.advance > 0 && <span style={{ color: C.green }}>{FMT(d.advance)} ₽ аванс</span>}
                  </span>
                ) },
              ]} />
            )}
          </Card>
        ))}

        {/* Operations history (from DB — period only) */}
        <Card pad={false} title={`История операций ${cpOps.length > 0 ? `(${cpOps.length})` : ''}`}>
          {cpOps.length === 0 ? <Empty>Нажмите «Импорт из 1С», чтобы загрузить</Empty> : (
            <Table dense rows={cpOps} rowKey={e => e.id} cols={[
              { key: 'd', title: 'Дата', sort: e => e.date, render: e => <span style={{ color: C.muted, whiteSpace: 'nowrap' }}>{FMTD(e.date)}</span> },
              { key: 't', title: 'Тип', sort: e => e.kind, render: e => <Badge tone={KIND_TONE[e.kind] || 'neutral'}>{KIND_LABEL[e.kind] || e.kind}</Badge> },
              { key: 'doc', title: 'Документ', render: e => (
                <div>
                  {(e.doc_type || '').replace('Реализация (акты, накладные, УПД)', 'Реализация').replace('Поступление на расчетный счет', 'Поступление')}
                  {e.doc_number && <span style={{ color: C.muted, marginLeft: 4 }}>№{e.doc_number}</span>}
                  {e.contract_name && <div style={{ fontSize: 11, color: C.faint, marginTop: 1, maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {e.contract_name.replace('Договор аренды нежилого помещения ', '').replace('Договор аренды ', '')}
                  </div>}
                  {e.note && e.note !== 'Входящий остаток' && <div style={{ fontSize: 11, color: C.faint, marginTop: 1 }}>{e.note.slice(0, 80)}</div>}
                </div>
              ) },
              { key: 'c', title: 'Начислено', align: 'right', sort: e => Number(e.charged), render: e => (
                <span style={{ color: C.red, fontWeight: 600 }}>{Number(e.charged) > 0 ? FMT(Number(e.charged)) + ' ₽' : ''}</span>
              ) },
              { key: 'p', title: 'Оплачено', align: 'right', sort: e => Number(e.paid), render: e => (
                <span style={{ color: C.green, fontWeight: 600 }}>{Number(e.paid) > 0 ? FMT(Number(e.paid)) + ' ₽' : ''}</span>
              ) },
            ]} />
          )}
        </Card>
      </Page>
    )
  }

  // ── Summary view ─────────────────────────────────────────────────────────────
  const totalDebt  = cps.filter(c => c.netto > 0).reduce((s, c) => s + c.netto, 0)
  const totalAdv   = cps.filter(c => c.netto < 0).reduce((s, c) => s + (-c.netto), 0)
  const debtors    = cps.filter(c => c.netto > 0.01).length
  const creditors  = cps.filter(c => c.netto < -0.01).length

  const filtered = cps
    .filter(c => !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.inn.includes(search))
    .sort((a, b) => b.netto - a.netto) // biggest debtors first

  return (
    <Page>
      {/* Import toolbar */}
      <Row gap={10}>
        <Button kind="primary" onClick={import1C} disabled={importing1c}>
          {importing1c ? 'Загрузка…' : 'Импорт из 1С'}
        </Button>
        <Button onClick={() => fileRef.current?.click()} disabled={importingBank}>
          {importingBank ? 'Обработка…' : 'Загрузить выписку (CSV)'}
        </Button>
        <input ref={fileRef} type="file" accept=".csv,.txt" style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) importBankFile(f); e.target.value = '' }} />
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {lastUpdate && <Muted small>1С: {lastUpdate}</Muted>}
          <Button small onClick={load}>Обновить</Button>
        </div>
      </Row>

      {importMsg && <Notice tone={importMsg.tone}>{importMsg.text}</Notice>}

      {/* KPI — balances from 1C counterparty level (authoritative) */}
      <Stats>
        <Stat label="Должников" value={debtors} sub={FMT(totalDebt) + ' ₽'} tone={debtors > 0 ? 'red' : undefined} />
        <Stat label="Общий долг" value={FMT(totalDebt) + ' ₽'} tone="red" />
        <Stat label="С переплатой" value={creditors} sub={FMT(totalAdv) + ' ₽'} tone="green" />
        <Stat label="Контрагентов" value={cps.length} />
      </Stats>

      <Search value={search} onChange={setSearch} placeholder="Поиск по названию или ИНН" width={300} />

      <Card pad={false}>
        <Table rows={filtered} rowKey={cp => cp.id} onRow={cp => setSelected(cp)}
          empty={cps.length === 0 ? 'Нет данных из 1С' : 'Ничего не найдено'} cols={[
            { key: 'n', title: 'Контрагент', sort: cp => cp.name, render: cp => (
              <div style={{ fontWeight: 600, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cp.name}</div>
            ) },
            { key: 'i', title: 'ИНН', render: cp => <span style={{ color: C.muted, fontFamily: 'monospace', fontSize: 12 }}>{cp.inn || '—'}</span> },
            { key: 'd', title: 'К оплате', align: 'right', sort: cp => cp.debt, render: cp => (
              <span style={{ fontWeight: 600, color: cp.debt > 0 ? C.red : C.faint }}>{cp.debt > 0 ? FMT(cp.debt) + ' ₽' : '—'}</span>
            ) },
            { key: 'a', title: 'Переплата', align: 'right', sort: cp => cp.advance, render: cp => (
              <span style={{ fontWeight: 600, color: cp.advance > 0 ? C.green : C.faint }}>{cp.advance > 0 ? FMT(cp.advance) + ' ₽' : '—'}</span>
            ) },
            { key: 's', title: 'Сальдо', align: 'right', sort: cp => cp.netto, render: cp => (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontWeight: 600, color: cp.netto > 0.01 ? C.red : cp.netto < -0.01 ? C.green : C.muted }}>
                  {cp.netto > 0.01 ? '+' + FMT(cp.netto) + ' ₽' : cp.netto < -0.01 ? '−' + FMT(-cp.netto) + ' ₽' : '0'}
                </span>
                <Badge tone={cp.netto > 0.01 ? 'red' : cp.netto < -0.01 ? 'green' : 'neutral'}>
                  {cp.netto > 0.01 ? 'Долг' : cp.netto < -0.01 ? 'Аванс' : 'Нет долга'}
                </Badge>
              </span>
            ) },
          ]} />
      </Card>
    </Page>
  )
}
