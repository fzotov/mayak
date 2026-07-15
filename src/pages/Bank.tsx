import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

interface BankTx {
  id: string
  date: string
  amount: number
  direction: 'credit' | 'debit'
  counterparty: string | null
  description: string | null
  reference: string | null
  matched_type: string | null
  matched_id: string | null
  import_id: string | null
  created_at: string
}

type Filter = 'all' | 'credit' | 'debit' | 'unmatched'

const FMT = (n: number) => Number(n).toLocaleString('ru-RU', { minimumFractionDigits: 2 })

export default function BankPage() {
  const [txs, setTxs] = useState<BankTx[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('all')
  const [uploading, setUploading] = useState(false)
  const [parseError, setParseError] = useState('')
  const [search, setSearch] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('bank_transactions').select('*').order('date', { ascending: false })
    setTxs(data || [])
    setLoading(false)
  }

  async function handleFile(file: File) {
    setUploading(true)
    setParseError('')
    try {
      const buf = await file.arrayBuffer()
      const bytes = new Uint8Array(buf)
      let binary = ''
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
      const b64 = btoa(binary)

      const resp = await fetch('/api/parse-bank-statement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdfBase64: b64, mimeType: file.type || 'application/pdf' }),
      })
      const data = await resp.json()
      if (!data.ok) {
        setParseError(data.error + (data.raw ? '\n' + data.raw : ''))
        return
      }

      const importId = crypto.randomUUID()
      const rows = (data.transactions as any[]).map(t => ({
        date: t.date,
        amount: Number(t.amount),
        direction: t.direction,
        counterparty: t.counterparty || null,
        description: t.description || null,
        reference: t.reference || null,
        import_id: importId,
      }))

      const { error } = await supabase.from('bank_transactions').insert(rows)
      if (error) { setParseError(error.message); return }
      await load()
    } catch (e) {
      setParseError(String(e))
    } finally {
      setUploading(false)
    }
  }

  const filtered = txs.filter(t => {
    if (filter === 'credit' && t.direction !== 'credit') return false
    if (filter === 'debit' && t.direction !== 'debit') return false
    if (filter === 'unmatched' && t.matched_type) return false
    if (search) {
      const q = search.toLowerCase()
      return (t.counterparty || '').toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q)
    }
    return true
  })

  const totalCredit = txs.filter(t => t.direction === 'credit').reduce((s, t) => s + t.amount, 0)
  const totalDebit = txs.filter(t => t.direction === 'debit').reduce((s, t) => s + t.amount, 0)
  const unmatched = txs.filter(t => !t.matched_type).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
        {[
          { label: 'Приход', value: FMT(totalCredit) + ' ₽', color: '#16a34a' },
          { label: 'Расход', value: FMT(totalDebit) + ' ₽', color: '#ef4444' },
          { label: 'Операций', value: txs.length, color: '#1a2240' },
          { label: 'Не сопоставлено', value: unmatched, color: unmatched > 0 ? '#d97706' : '#16a34a' },
        ].map(k => (
          <div key={k.label} style={{ background: '#fff', border: '1px solid #e8ebf3', borderRadius: 9, padding: '11px 14px' }}>
            <div style={{ fontSize: 12, color: '#8596b4', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 4 }}>{k.label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['all', 'credit', 'debit', 'unmatched'] as Filter[]).map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: '5px 12px', borderRadius: 6, border: '1px solid', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
              borderColor: filter === f ? '#4f6ef7' : '#e8ebf3',
              background: filter === f ? '#eff3ff' : '#fff',
              color: filter === f ? '#4f6ef7' : '#6b7280',
            }}>
              {{ all: 'Все', credit: '↓ Приход', debit: '↑ Расход', unmatched: '⚠ Не сопоставлено' }[f]}
            </button>
          ))}
        </div>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Поиск по контрагенту..."
          style={{ padding: '6px 12px', borderRadius: 7, border: '1px solid #e8ebf3', fontSize: 13, fontFamily: 'inherit', outline: 'none', width: 200 }}
        />
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <input ref={fileRef} type="file" accept=".pdf,image/*" style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }}
          />
          <button onClick={() => fileRef.current?.click()} disabled={uploading}
            style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: '#4f6ef7', color: '#fff', fontSize: 13, fontWeight: 600, cursor: uploading ? 'default' : 'pointer', opacity: uploading ? 0.7 : 1, fontFamily: 'inherit' }}>
            {uploading ? 'Загрузка...' : '+ Загрузить выписку'}
          </button>
        </div>
      </div>

      {parseError && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', color: '#ef4444', fontSize: 13, whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
          {parseError}
        </div>
      )}

      {/* Table */}
      <div style={{ background: '#fff', border: '1px solid #e8ebf3', borderRadius: 9, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 24, color: '#8596b4', fontSize: 14, textAlign: 'center' }}>Загрузка...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 40, color: '#8596b4', fontSize: 14, textAlign: 'center' }}>
            {txs.length === 0 ? 'Загрузите банковскую выписку (PDF)' : 'Нет транзакций'}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f8f9fb' }}>
                {['Дата', 'Тип', 'Контрагент', 'Назначение', 'Сумма', 'Статус'].map(h => (
                  <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 600, color: '#8596b4', borderBottom: '1px solid #e8ebf3', fontSize: 12 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(t => (
                <tr key={t.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '9px 12px', color: '#8596b4', whiteSpace: 'nowrap', fontSize: 12 }}>
                    {new Date(t.date).toLocaleDateString('ru-RU')}
                  </td>
                  <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 8,
                      background: t.direction === 'credit' ? '#dcfce7' : '#fee2e2',
                      color: t.direction === 'credit' ? '#16a34a' : '#ef4444',
                    }}>
                      {t.direction === 'credit' ? '↓ Приход' : '↑ Расход'}
                    </span>
                  </td>
                  <td style={{ padding: '9px 12px', fontWeight: 500, color: '#1a2240', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.counterparty || '—'}
                  </td>
                  <td style={{ padding: '9px 12px', color: '#374151', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.description || '—'}
                  </td>
                  <td style={{ padding: '9px 12px', fontWeight: 700, whiteSpace: 'nowrap', color: t.direction === 'credit' ? '#16a34a' : '#ef4444' }}>
                    {t.direction === 'credit' ? '+' : '−'}{FMT(t.amount)} ₽
                  </td>
                  <td style={{ padding: '9px 12px' }}>
                    {t.matched_type ? (
                      <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 8, background: '#eff3ff', color: '#4f6ef7', fontWeight: 600 }}>
                        ✓ {t.matched_type === 'invoice' ? 'Счёт' : t.matched_type === 'tenant' ? 'Аренда' : t.matched_type}
                      </span>
                    ) : (
                      <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 8, background: '#fffbeb', color: '#d97706', fontWeight: 600 }}>⚠ Не сопоставлено</span>
                    )}
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
