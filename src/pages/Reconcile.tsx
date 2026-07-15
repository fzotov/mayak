import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

interface BankTx {
  id: string
  date: string
  amount: number
  direction: 'credit' | 'debit'
  counterparty: string | null
  description: string | null
  matched_type: string | null
  matched_id: string | null
}

interface IncomingInvoice {
  id: string
  supplier: string
  amount: number
  status: string
  description: string | null
  due_date: string | null
}

const FMT = (n: number) => Number(n).toLocaleString('ru-RU', { minimumFractionDigits: 2 })

function normalize(s: string) {
  return s.toLowerCase().replace(/["«»""'',.\-]/g, '').replace(/\s+/g, ' ').trim()
}

function matchScore(tx: BankTx, inv: IncomingInvoice): number {
  let score = 0
  if (Math.abs(tx.amount - inv.amount) < 0.01) score += 50
  else if (Math.abs(tx.amount - inv.amount) / inv.amount < 0.02) score += 20
  const txStr = normalize((tx.counterparty || '') + ' ' + (tx.description || ''))
  const invStr = normalize(inv.supplier + ' ' + (inv.description || ''))
  const words = invStr.split(' ').filter(w => w.length > 3)
  const hits = words.filter(w => txStr.includes(w)).length
  if (words.length > 0) score += Math.round((hits / words.length) * 40)
  return score
}

export default function ReconcilePage() {
  const [txs, setTxs] = useState<BankTx[]>([])
  const [invoices, setInvoices] = useState<IncomingInvoice[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [tab, setTab] = useState<'debit' | 'credit'>('debit')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data: txData }, { data: invData }] = await Promise.all([
      supabase.from('bank_transactions').select('*').order('date', { ascending: false }),
      supabase.from('incoming_invoices').select('id,supplier,amount,status,description,due_date').in('status', ['APPROVED', 'NEW', 'PENDING_APPROVAL']),
    ])
    setTxs(txData || [])
    setInvoices(invData || [])
    setLoading(false)
  }

  // Auto-match debit txs to invoices
  const debitTxs = txs.filter(t => t.direction === 'debit')
  const creditTxs = txs.filter(t => t.direction === 'credit')

  interface Suggestion { tx: BankTx; inv: IncomingInvoice; score: number }
  const suggestions: Suggestion[] = []
  for (const tx of debitTxs.filter(t => !t.matched_type)) {
    let best: { inv: IncomingInvoice; score: number } | null = null
    for (const inv of invoices) {
      const s = matchScore(tx, inv)
      if (s >= 30 && (!best || s > best.score)) best = { inv, score: s }
    }
    if (best) suggestions.push({ tx, inv: best.inv, score: best.score })
  }

  async function confirmMatch(tx: BankTx, inv: IncomingInvoice) {
    setSaving(tx.id)
    await supabase.from('bank_transactions').update({ matched_type: 'invoice', matched_id: inv.id }).eq('id', tx.id)
    await supabase.from('incoming_invoices').update({ status: 'PAID' }).eq('id', inv.id)
    await load()
    setSaving(null)
  }

  async function ignoreMatch(txId: string) {
    setSaving(txId)
    await supabase.from('bank_transactions').update({ matched_type: 'ignored' }).eq('id', txId)
    await load()
    setSaving(null)
  }

  if (loading) return <div style={{ padding: 40, color: '#8596b4', fontSize: 14, textAlign: 'center' }}>Загрузка...</div>

  const unmatchedDebit = debitTxs.filter(t => !t.matched_type).length
  const unmatchedCredit = creditTxs.filter(t => !t.matched_type).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
        {[
          { label: 'Расходы (выписка)', value: FMT(debitTxs.reduce((s,t) => s+t.amount,0)) + ' ₽', color: '#ef4444' },
          { label: 'Поступления (выписка)', value: FMT(creditTxs.reduce((s,t) => s+t.amount,0)) + ' ₽', color: '#16a34a' },
          { label: 'Несопоставлено расходов', value: unmatchedDebit, color: unmatchedDebit > 0 ? '#d97706' : '#16a34a' },
          { label: 'Несопоставлено поступлений', value: unmatchedCredit, color: unmatchedCredit > 0 ? '#d97706' : '#16a34a' },
        ].map(k => (
          <div key={k.label} style={{ background: '#fff', border: '1px solid #e8ebf3', borderRadius: 9, padding: '11px 14px' }}>
            <div style={{ fontSize: 11, color: '#8596b4', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 4 }}>{k.label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6 }}>
        {[{ id: 'debit', label: '↑ Сверка расходов' }, { id: 'credit', label: '↓ Сверка поступлений' }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)} style={{
            padding: '6px 14px', borderRadius: 7, border: '1px solid', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
            borderColor: tab === t.id ? '#4f6ef7' : '#e8ebf3',
            background: tab === t.id ? '#eff3ff' : '#fff',
            color: tab === t.id ? '#4f6ef7' : '#6b7280', fontWeight: tab === t.id ? 600 : 400,
          }}>{t.label}</button>
        ))}
      </div>

      {tab === 'debit' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Suggested matches */}
          {suggestions.length > 0 && (
            <div style={{ background: '#fff', border: '1px solid #e8ebf3', borderRadius: 9, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #e8ebf3', background: '#fffbeb' }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#92400e' }}>⚡ Автоматически найдено совпадений: {suggestions.length}</span>
                <span style={{ fontSize: 12, color: '#8596b4', marginLeft: 8 }}>Подтвердите или пропустите каждое</span>
              </div>
              {suggestions.map(({ tx, inv, score }) => (
                <div key={tx.id} style={{ padding: '14px 16px', borderBottom: '1px solid #f3f4f6', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: '#8596b4', marginBottom: 4 }}>{new Date(tx.date).toLocaleDateString('ru-RU')} · Выписка</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#ef4444', marginBottom: 2 }}>−{FMT(tx.amount)} ₽</div>
                    <div style={{ fontSize: 13, color: '#374151' }}>{tx.counterparty || '—'}</div>
                    <div style={{ fontSize: 11, color: '#8596b4', marginTop: 2 }}>{(tx.description || '').slice(0, 80)}</div>
                  </div>
                  <div style={{ fontSize: 20, color: '#d1d5db', alignSelf: 'center' }}>↔</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: '#8596b4', marginBottom: 4 }}>Входящий счёт · совпадение {score}%</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#1a2240', marginBottom: 2 }}>{FMT(inv.amount)} ₽</div>
                    <div style={{ fontSize: 13, color: '#374151' }}>{inv.supplier}</div>
                    <div style={{ fontSize: 11, color: '#8596b4', marginTop: 2 }}>{(inv.description || '').slice(0, 80)}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignSelf: 'center' }}>
                    <button onClick={() => confirmMatch(tx, inv)} disabled={saving === tx.id} style={{ padding: '6px 12px', borderRadius: 7, border: 'none', background: '#22c55e', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                      ✓ Подтвердить
                    </button>
                    <button onClick={() => ignoreMatch(tx.id)} disabled={saving === tx.id} style={{ padding: '6px 12px', borderRadius: 7, border: '1px solid #e8ebf3', background: '#fff', color: '#8596b4', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                      Пропустить
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Unmatched debit list */}
          <div style={{ background: '#fff', border: '1px solid #e8ebf3', borderRadius: 9, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #e8ebf3', fontSize: 14, fontWeight: 600, color: '#1a2240' }}>
              Все расходы
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8f9fb' }}>
                  {['Дата', 'Контрагент', 'Назначение', 'Сумма', 'Статус'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#8596b4', borderBottom: '1px solid #e8ebf3', fontSize: 12 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {debitTxs.map(t => (
                  <tr key={t.id} style={{ borderBottom: '1px solid #f3f4f6', background: !t.matched_type ? '#fffdf5' : undefined }}>
                    <td style={{ padding: '8px 12px', color: '#8596b4', whiteSpace: 'nowrap' }}>{new Date(t.date).toLocaleDateString('ru-RU')}</td>
                    <td style={{ padding: '8px 12px', fontWeight: 500, color: '#1a2240', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.counterparty || '—'}</td>
                    <td style={{ padding: '8px 12px', color: '#374151', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.description || '—'}</td>
                    <td style={{ padding: '8px 12px', fontWeight: 700, color: '#ef4444', whiteSpace: 'nowrap' }}>−{FMT(t.amount)} ₽</td>
                    <td style={{ padding: '8px 12px' }}>
                      {t.matched_type === 'invoice' ? (
                        <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 8, background: '#dcfce7', color: '#16a34a', fontWeight: 600 }}>✓ Счёт</span>
                      ) : t.matched_type === 'ignored' ? (
                        <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 8, background: '#f3f4f6', color: '#9ca3af', fontWeight: 600 }}>Пропущено</span>
                      ) : (
                        <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 8, background: '#fffbeb', color: '#d97706', fontWeight: 600 }}>⚠ Не сопоставлено</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'credit' && (
        <div style={{ background: '#fff', border: '1px solid #e8ebf3', borderRadius: 9, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #e8ebf3', fontSize: 14, fontWeight: 600, color: '#1a2240' }}>
            Поступления на счёт
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f8f9fb' }}>
                {['Дата', 'Контрагент', 'Назначение', 'Сумма', 'Статус'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#8596b4', borderBottom: '1px solid #e8ebf3', fontSize: 12 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {creditTxs.map(t => (
                <tr key={t.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '8px 12px', color: '#8596b4', whiteSpace: 'nowrap' }}>{new Date(t.date).toLocaleDateString('ru-RU')}</td>
                  <td style={{ padding: '8px 12px', fontWeight: 500, color: '#1a2240', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.counterparty || '—'}</td>
                  <td style={{ padding: '8px 12px', color: '#374151', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.description || '—'}</td>
                  <td style={{ padding: '8px 12px', fontWeight: 700, color: '#16a34a', whiteSpace: 'nowrap' }}>+{FMT(t.amount)} ₽</td>
                  <td style={{ padding: '8px 12px' }}>
                    {t.matched_type ? (
                      <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 8, background: '#dcfce7', color: '#16a34a', fontWeight: 600 }}>✓ Сопоставлено</span>
                    ) : (
                      <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 8, background: '#fffbeb', color: '#d97706', fontWeight: 600 }}>⚠ Не сопоставлено</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
