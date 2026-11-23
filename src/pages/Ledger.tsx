import { apiFetch } from '../lib/api'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

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

const KIND_COLOR: Record<string, { background: string; color: string }> = {
  charge:     { background: '#fee2e2', color: '#ef4444' },
  payment:    { background: '#dcfce7', color: '#16a34a' },
  mixed:      { background: '#eff3ff', color: '#4f6ef7' },
  adjustment: { background: '#fef9c3', color: '#ca8a04' },
}
const KIND_LABEL: Record<string, string> = {
  charge: 'Начисление', payment: 'Оплата', mixed: 'Начисление', adjustment: 'Корректировка'
}

export default function LedgerPage() {
  const [cps, setCps] = useState<Counterparty[]>([])
  const [ops, setOps] = useState<LedgerEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [importing1c, setImporting1c] = useState(false)
  const [importingBank, setImportingBank] = useState(false)
  const [importMsg, setImportMsg] = useState('')
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
      const r1c = await r1cRes.json()
      if (!r1c.ok) { setImportMsg(r1c.error || '1С не отвечает'); setLoading(false); return }

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
      const { data: opRows } = await supabase
        .from('ledger_entries')
        .select('*')
        .order('date', { ascending: false })
        .limit(5000)
      setOps(opRows || [])
    } finally {
      setLoading(false)
    }
  }

  async function import1C() {
    setImporting1c(true); setImportMsg('')
    try {
      // First sync tenants so id_1c is populated
      await apiFetch('/api/sync-tenants-1c', { method: 'POST' })
      const r = await apiFetch('/api/import-1c-ledger', { method: 'POST' })
      const json = await r.json()
      if (json.ok) {
        setImportMsg(`✓ 1С: ${json.imported} операций импортировано (${json.matched} сопоставлено, ${json.unmatched} без арендатора)`)
        await load()
      } else setImportMsg('Ошибка: ' + json.error)
    } catch (e: any) { setImportMsg('Ошибка: ' + e.message) }
    finally { setImporting1c(false) }
  }

  async function importBankFile(file: File) {
    setImportingBank(true); setImportMsg('')
    try {
      const text = await file.text()
      const r = await apiFetch('/api/import-bank-csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv: text, filename: file.name }),
      })
      const json = await r.json()
      if (json.ok) {
        setImportMsg(`✓ Банк «${file.name}»: ${json.total} платежей, ${json.matched} сопоставлено с арендаторами`)
        await load()
      } else setImportMsg('Ошибка: ' + json.error)
    } catch (e: any) { setImportMsg('Ошибка: ' + e.message) }
    finally { setImportingBank(false) }
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#8596b4' }}>Загрузка из 1С...</div>

  // ── Detail view ──────────────────────────────────────────────────────────────
  if (selected) {
    const cpOps = ops
      .filter(e => e.counterparty_1c_id === selected.id || e.tenant_id === selected.tenantId)
      .sort((a, b) => b.date.localeCompare(a.date))

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => setSelected(null)}
            style={{ padding: '6px 12px', borderRadius: 7, border: '1px solid #e8ebf3', background: '#fff', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', color: '#6b7280' }}>
            ← Назад
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#1a2240' }}>{selected.name}</div>
            <div style={{ fontSize: 11, color: '#8596b4' }}>
              ИНН: {selected.inn || '—'}{selected.kpp ? ' / КПП: ' + selected.kpp : ''}
            </div>
          </div>
          {/* Balance from 1C — authoritative, not recomputed */}
          <div style={{ textAlign: 'right' }}>
            {selected.netto > 0 && (
              <div style={{ fontSize: 22, fontWeight: 800, color: '#ef4444' }}>К оплате: {FMT(selected.netto)} ₽</div>
            )}
            {selected.netto < 0 && (
              <div style={{ fontSize: 22, fontWeight: 800, color: '#16a34a' }}>Переплата: {FMT(-selected.netto)} ₽</div>
            )}
            {selected.netto === 0 && (
              <div style={{ fontSize: 18, fontWeight: 700, color: '#8596b4' }}>✓ Нет задолженности</div>
            )}
            <div style={{ fontSize: 10, color: '#8596b4', marginTop: 2 }}>Данные 1С · {lastUpdate}</div>
          </div>
        </div>

        {/* Contracts with outstanding docs */}
        {selected.contracts.map(ct => (
          <div key={ct.id} style={{ background: '#fff', border: '1px solid #e8ebf3', borderRadius: 9, overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', background: '#f8f9fb', borderBottom: '1px solid #e8ebf3', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: '#1a2240' }}>{ct.name}</div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>
                {ct.debt > 0 && ct.advance > 0
                  ? <span style={{ color: '#ca8a04' }}>Долг {FMT(ct.debt)} / Аванс {FMT(ct.advance)} ₽</span>
                  : ct.debt > 0
                    ? <span style={{ color: '#ef4444' }}>К оплате {FMT(ct.debt)} ₽</span>
                    : ct.advance > 0
                      ? <span style={{ color: '#16a34a' }}>Переплата {FMT(ct.advance)} ₽</span>
                      : <span style={{ color: '#8596b4' }}>✓</span>
                }
              </div>
            </div>
            {ct.docs.length > 0 && (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <tbody>
                  {ct.docs.map(d => (
                    <tr key={d.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '7px 14px', color: '#8596b4', whiteSpace: 'nowrap' }}>{FMTD(d.date)}</td>
                      <td style={{ padding: '7px 14px', color: '#374151' }}>{d.type} №{d.number}</td>
                      <td style={{ padding: '7px 14px', textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap' }}>
                        {d.debt > 0 && <span style={{ color: '#ef4444' }}>{FMT(d.debt)} ₽ долг</span>}
                        {d.advance > 0 && <span style={{ color: '#16a34a' }}>{FMT(d.advance)} ₽ аванс</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ))}

        {/* Operations history (from DB — period only) */}
        <div style={{ background: '#fff', border: '1px solid #e8ebf3', borderRadius: 9, overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px', background: '#f8f9fb', borderBottom: '1px solid #e8ebf3', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 600, fontSize: 13, color: '#1a2240' }}>
              История операций {cpOps.length > 0 ? `(${cpOps.length})` : ''}
            </div>
            {cpOps.length === 0 && (
              <div style={{ fontSize: 12, color: '#8596b4' }}>Нажмите «Импорт из 1С» чтобы загрузить</div>
            )}
          </div>
          {cpOps.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#f8f9fb' }}>
                  {['Дата', 'Тип', 'Документ', 'Начислено', 'Оплачено'].map(h => (
                    <th key={h} style={{ padding: '7px 12px', textAlign: 'left', fontWeight: 600, color: '#8596b4', borderBottom: '1px solid #e8ebf3', fontSize: 11 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cpOps.map(e => (
                  <tr key={e.id} style={{ borderBottom: '1px solid #f3f4f6', background: e.kind === 'payment' ? '#f0fdf4' : '#fff' }}>
                    <td style={{ padding: '7px 12px', color: '#8596b4', whiteSpace: 'nowrap' }}>{FMTD(e.date)}</td>
                    <td style={{ padding: '7px 12px' }}>
                      <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 5, ...(KIND_COLOR[e.kind] || { background: '#f3f4f6', color: '#6b7280' }) }}>
                        {KIND_LABEL[e.kind] || e.kind}
                      </span>
                    </td>
                    <td style={{ padding: '7px 12px', color: '#374151' }}>
                      {(e.doc_type || '').replace('Реализация (акты, накладные, УПД)', 'Реализация').replace('Поступление на расчетный счет', 'Поступление')}
                      {e.doc_number && <span style={{ color: '#8596b4', marginLeft: 4 }}>№{e.doc_number}</span>}
                      {e.contract_name && <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 1, maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {e.contract_name.replace('Договор аренды нежилого помещения ', '').replace('Договор аренды ', '')}
                      </div>}
                      {e.note && e.note !== 'Входящий остаток' && <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 1 }}>{e.note.slice(0, 80)}</div>}
                    </td>
                    <td style={{ padding: '7px 12px', color: '#ef4444', fontWeight: 600, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {Number(e.charged) > 0 ? FMT(Number(e.charged)) + ' ₽' : ''}
                    </td>
                    <td style={{ padding: '7px 12px', color: '#16a34a', fontWeight: 600, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {Number(e.paid) > 0 ? FMT(Number(e.paid)) + ' ₽' : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Import toolbar */}
      <div style={{ background: '#fff', border: '1px solid #e8ebf3', borderRadius: 9, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, color: '#8596b4', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.4px' }}>Импорт</span>
        <button onClick={import1C} disabled={importing1c}
          style={{ padding: '7px 14px', borderRadius: 7, border: 'none', background: importing1c ? '#e8ebf3' : '#4f6ef7', color: importing1c ? '#8596b4' : '#fff', fontSize: 13, fontWeight: 600, cursor: importing1c ? 'default' : 'pointer', fontFamily: 'inherit' }}>
          {importing1c ? '⟳ Загрузка...' : '↓ Импорт из 1С'}
        </button>
        <button onClick={() => fileRef.current?.click()} disabled={importingBank}
          style={{ padding: '7px 14px', borderRadius: 7, border: '1px solid #e8ebf3', background: '#fff', color: importingBank ? '#8596b4' : '#1a2240', fontSize: 13, fontWeight: 600, cursor: importingBank ? 'default' : 'pointer', fontFamily: 'inherit' }}>
          {importingBank ? '⟳ Обработка...' : '↑ Загрузить выписку (CSV)'}
        </button>
        <input ref={fileRef} type="file" accept=".csv,.txt" style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) importBankFile(f); e.target.value = '' }} />
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          {lastUpdate && <div style={{ fontSize: 11, color: '#8596b4' }}>1С: {lastUpdate}</div>}
          <button onClick={load}
            style={{ padding: '5px 10px', borderRadius: 7, border: '1px solid #e8ebf3', background: '#fff', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', color: '#4f6ef7' }}>
            ↻
          </button>
        </div>
      </div>

      {importMsg && (
        <div style={{ padding: '10px 14px', borderRadius: 8, background: importMsg.startsWith('✓') ? '#f0fdf4' : '#fef2f2', color: importMsg.startsWith('✓') ? '#16a34a' : '#ef4444', fontSize: 13, border: '1px solid ' + (importMsg.startsWith('✓') ? '#bbf7d0' : '#fecaca') }}>
          {importMsg}
        </div>
      )}

      {/* KPI — balances from 1C counterparty level (authoritative) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
        {[
          { label: 'Должников', value: debtors, sub: FMT(totalDebt) + ' ₽', color: debtors > 0 ? '#ef4444' : '#8596b4' },
          { label: 'Общий долг', value: FMT(totalDebt) + ' ₽', color: '#ef4444', small: true },
          { label: 'С переплатой', value: creditors, sub: FMT(totalAdv) + ' ₽', color: '#16a34a' },
          { label: 'Контрагентов', value: cps.length, color: '#1a2240' },
        ].map(k => (
          <div key={k.label} style={{ background: '#fff', border: '1px solid #e8ebf3', borderRadius: 9, padding: '12px 16px' }}>
            <div style={{ fontSize: 11, color: '#8596b4', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 4 }}>{k.label}</div>
            <div style={{ fontSize: k.small ? 14 : 20, fontWeight: 800, color: k.color, lineHeight: 1.2 }}>{k.value}</div>
            {k.sub && <div style={{ fontSize: 11, color: '#8596b4', marginTop: 2 }}>{k.sub}</div>}
          </div>
        ))}
      </div>

      <input value={search} onChange={e => setSearch(e.target.value)}
        placeholder="Поиск по названию или ИНН..."
        style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #e8ebf3', fontSize: 13, fontFamily: 'inherit', outline: 'none', width: 300 }}
      />

      <div style={{ background: '#fff', border: '1px solid #e8ebf3', borderRadius: 9, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f8f9fb' }}>
              {['Контрагент', 'ИНН', 'К оплате', 'Переплата', 'Сальдо'].map(h => (
                <th key={h} style={{ padding: '9px 14px', textAlign: h === 'К оплате' || h === 'Переплата' || h === 'Сальдо' ? 'right' : 'left', fontWeight: 600, color: '#8596b4', borderBottom: '1px solid #e8ebf3', fontSize: 12 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(cp => (
              <tr key={cp.id}
                style={{ borderBottom: '1px solid #f3f4f6', cursor: 'pointer' }}
                onClick={() => setSelected(cp)}
                onMouseEnter={e => (e.currentTarget.style.background = '#f8f9fb')}
                onMouseLeave={e => (e.currentTarget.style.background = '')}>
                <td style={{ padding: '10px 14px', fontWeight: 600, color: '#1a2240', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {cp.name}
                </td>
                <td style={{ padding: '10px 14px', color: '#8596b4', fontFamily: 'monospace', fontSize: 12 }}>{cp.inn || '—'}</td>
                <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: cp.debt > 0 ? '#ef4444' : '#e5e7eb', whiteSpace: 'nowrap' }}>
                  {cp.debt > 0 ? FMT(cp.debt) + ' ₽' : '—'}
                </td>
                <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: cp.advance > 0 ? '#16a34a' : '#e5e7eb', whiteSpace: 'nowrap' }}>
                  {cp.advance > 0 ? FMT(cp.advance) + ' ₽' : '—'}
                </td>
                <td style={{ padding: '10px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <span style={{
                    fontWeight: 700, fontSize: 13,
                    color: cp.netto > 0.01 ? '#ef4444' : cp.netto < -0.01 ? '#16a34a' : '#8596b4'
                  }}>
                    {cp.netto > 0.01 ? '+' + FMT(cp.netto) + ' ₽'
                     : cp.netto < -0.01 ? '−' + FMT(-cp.netto) + ' ₽'
                     : '✓ 0'}
                  </span>
                  {' '}
                  <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 6, fontWeight: 600,
                    background: cp.netto > 0.01 ? '#fee2e2' : cp.netto < -0.01 ? '#dcfce7' : '#f3f4f6',
                    color: cp.netto > 0.01 ? '#ef4444' : cp.netto < -0.01 ? '#16a34a' : '#9ca3af' }}>
                    {cp.netto > 0.01 ? 'Долг' : cp.netto < -0.01 ? 'Аванс' : 'OK'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
