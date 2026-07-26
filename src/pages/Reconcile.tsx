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

interface Tenant {
  id: string
  fullName: string
  inn: string | null
  monthlyRent: number | null
}

const FMT = (n: number) => Number(n).toLocaleString('ru-RU', { minimumFractionDigits: 2 })

function normalize(s: string) {
  return s.toLowerCase().replace(/["«»""'',.\-]/g, '').replace(/\s+/g, ' ').trim()
}

function matchInvoiceScore(tx: BankTx, inv: IncomingInvoice): number {
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

function matchTenantScore(tx: BankTx, tenant: Tenant): number {
  let score = 0
  const txStr = normalize((tx.counterparty || '') + ' ' + (tx.description || ''))
  const name = normalize(tenant.fullName)
  const nameWords = name.split(' ').filter(w => w.length > 2)
  const hits = nameWords.filter(w => txStr.includes(w)).length
  if (nameWords.length > 0) score += Math.round((hits / nameWords.length) * 50)
  if (tenant.inn && txStr.includes(tenant.inn)) score += 40
  if (tenant.monthlyRent && Math.abs(tx.amount - tenant.monthlyRent) < 0.01) score += 30
  if (txStr.includes('аренд')) score += 10
  return score
}

export default function ReconcilePage() {
  const [txs, setTxs] = useState<BankTx[]>([])
  const [invoices, setInvoices] = useState<IncomingInvoice[]>([])
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [tab, setTab] = useState<'debit' | 'credit'>('debit')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data: txData }, { data: invData }, { data: tenantData }] = await Promise.all([
      supabase.from('bank_transactions').select('*').order('date', { ascending: false }),
      supabase.from('incoming_invoices').select('id,supplier,amount,status,description,due_date').in('status', ['APPROVED', 'NEW', 'PENDING_APPROVAL']),
      supabase.from('tenants').select('id,fullName:full_name,inn,monthlyRent:monthly_rent'),
    ])
    setTxs(txData || [])
    setInvoices(invData || [])
    setTenants((tenantData || []) as Tenant[])
    setLoading(false)
  }

  const debitTxs = txs.filter(t => t.direction === 'debit')
  const creditTxs = txs.filter(t => t.direction === 'credit')

  // Debit suggestions: tx → invoice
  interface DebitSug { tx: BankTx; inv: IncomingInvoice; score: number }
  const debitSuggestions: DebitSug[] = []
  for (const tx of debitTxs.filter(t => !t.matched_type)) {
    let best: { inv: IncomingInvoice; score: number } | null = null
    for (const inv of invoices) {
      const s = matchInvoiceScore(tx, inv)
      if (s >= 30 && (!best || s > best.score)) best = { inv, score: s }
    }
    if (best) debitSuggestions.push({ tx, inv: best.inv, score: best.score })
  }

  // Credit suggestions: tx → tenant
  interface CreditSug { tx: BankTx; tenant: Tenant; score: number }
  const creditSuggestions: CreditSug[] = []
  for (const tx of creditTxs.filter(t => !t.matched_type)) {
    let best: { tenant: Tenant; score: number } | null = null
    for (const tenant of tenants) {
      const s = matchTenantScore(tx, tenant)
      if (s >= 25 && (!best || s > best.score)) best = { tenant, score: s }
    }
    if (best) creditSuggestions.push({ tx, tenant: best.tenant, score: best.score })
  }

  async function confirmDebitMatch(tx: BankTx, inv: IncomingInvoice) {
    setSaving(tx.id)
    await supabase.from('bank_transactions').update({ matched_type: 'invoice', matched_id: inv.id }).eq('id', tx.id)
    await supabase.from('incoming_invoices').update({ status: 'PAID' }).eq('id', inv.id)
    await load()
    setSaving(null)
  }

  async function confirmCreditMatch(tx: BankTx, tenant: Tenant) {
    setSaving(tx.id)
    await supabase.from('bank_transactions').update({ matched_type: 'tenant', matched_id: tenant.id }).eq('id', tx.id)
    await load()
    setSaving(null)
  }

  async function ignore(txId: string) {
    setSaving(txId)
    await supabase.from('bank_transactions').update({ matched_type: 'ignored' }).eq('id', txId)
    await load()
    setSaving(null)
  }

  if (loading) return <div style={{ padding: 40, color: '#8596b4', fontSize: 14, textAlign: 'center' }}>Загрузка...</div>

  if (txs.length === 0) return (
    <div style={{ padding: 60, textAlign: 'center', color: '#8596b4', fontSize: 14 }}>
      Нет банковских транзакций. Сначала загрузите выписку в разделе <strong>Банк</strong>.
    </div>
  )

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
        {[
          { id: 'debit', label: `↑ Сверка расходов${debitSuggestions.length > 0 ? ` (${debitSuggestions.length})` : ''}` },
          { id: 'credit', label: `↓ Сверка поступлений${creditSuggestions.length > 0 ? ` (${creditSuggestions.length})` : ''}` },
        ].map(t => (
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
          {debitSuggestions.length > 0 && (
            <div style={{ background: '#fff', border: '1px solid #e8ebf3', borderRadius: 9, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #e8ebf3', background: '#fffbeb', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#92400e' }}>⚡ Найдено совпадений: {debitSuggestions.length}</span>
                <span style={{ fontSize: 12, color: '#8596b4' }}>расходы → входящие счета</span>
              </div>
              {debitSuggestions.map(({ tx, inv, score }) => (
                <div key={tx.id} style={{ padding: '14px 16px', borderBottom: '1px solid #f3f4f6', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: '#8596b4', marginBottom: 3 }}>{new Date(tx.date).toLocaleDateString('ru-RU')} · Выписка</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#ef4444', marginBottom: 2 }}>−{FMT(tx.amount)} ₽</div>
                    <div style={{ fontSize: 13, color: '#1a2240', fontWeight: 500 }}>{tx.counterparty || '—'}</div>
                    <div style={{ fontSize: 11, color: '#8596b4', marginTop: 2 }}>{(tx.description || '').slice(0, 90)}</div>
                  </div>
                  <div style={{ fontSize: 18, color: '#d1d5db', alignSelf: 'center' }}>↔</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: '#8596b4', marginBottom: 3 }}>Входящий счёт · {score}% совпадение</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#1a2240', marginBottom: 2 }}>{FMT(inv.amount)} ₽</div>
                    <div style={{ fontSize: 13, color: '#1a2240', fontWeight: 500 }}>{inv.supplier}</div>
                    <div style={{ fontSize: 11, color: '#8596b4', marginTop: 2 }}>{(inv.description || '').slice(0, 90)}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignSelf: 'center', flexDirection: 'column' }}>
                    <button onClick={() => confirmDebitMatch(tx, inv)} disabled={saving === tx.id}
                      style={{ padding: '6px 14px', borderRadius: 7, border: 'none', background: '#22c55e', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                      ✓ Подтвердить
                    </button>
                    <button onClick={() => ignore(tx.id)} disabled={saving === tx.id}
                      style={{ padding: '6px 14px', borderRadius: 7, border: '1px solid #e8ebf3', background: '#fff', color: '#8596b4', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                      Пропустить
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{ background: '#fff', border: '1px solid #e8ebf3', borderRadius: 9, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #e8ebf3', fontSize: 14, fontWeight: 600, color: '#1a2240' }}>
              Все расходы ({debitTxs.length})
            </div>
            <TxTable rows={debitTxs} onIgnore={ignore} saving={saving} />
          </div>
        </div>
      )}

      {tab === 'credit' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {creditSuggestions.length > 0 && (
            <div style={{ background: '#fff', border: '1px solid #e8ebf3', borderRadius: 9, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #e8ebf3', background: '#f0fdf4', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#15803d' }}>⚡ Найдено совпадений: {creditSuggestions.length}</span>
                <span style={{ fontSize: 12, color: '#8596b4' }}>поступления → арендаторы</span>
              </div>
              {creditSuggestions.map(({ tx, tenant, score }) => (
                <div key={tx.id} style={{ padding: '14px 16px', borderBottom: '1px solid #f3f4f6', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: '#8596b4', marginBottom: 3 }}>{new Date(tx.date).toLocaleDateString('ru-RU')} · Выписка</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#16a34a', marginBottom: 2 }}>+{FMT(tx.amount)} ₽</div>
                    <div style={{ fontSize: 13, color: '#1a2240', fontWeight: 500 }}>{tx.counterparty || '—'}</div>
                    <div style={{ fontSize: 11, color: '#8596b4', marginTop: 2 }}>{(tx.description || '').slice(0, 90)}</div>
                  </div>
                  <div style={{ fontSize: 18, color: '#d1d5db', alignSelf: 'center' }}>↔</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: '#8596b4', marginBottom: 3 }}>Арендатор · {score}% совпадение</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#1a2240', marginBottom: 2 }}>{tenant.fullName}</div>
                    {tenant.inn && <div style={{ fontSize: 12, color: '#8596b4' }}>ИНН {tenant.inn}</div>}
                    {tenant.monthlyRent && <div style={{ fontSize: 12, color: '#8596b4' }}>Аренда: {FMT(tenant.monthlyRent)} ₽/мес</div>}
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignSelf: 'center', flexDirection: 'column' }}>
                    <button onClick={() => confirmCreditMatch(tx, tenant)} disabled={saving === tx.id}
                      style={{ padding: '6px 14px', borderRadius: 7, border: 'none', background: '#22c55e', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                      ✓ Подтвердить
                    </button>
                    <button onClick={() => ignore(tx.id)} disabled={saving === tx.id}
                      style={{ padding: '6px 14px', borderRadius: 7, border: '1px solid #e8ebf3', background: '#fff', color: '#8596b4', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                      Пропустить
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{ background: '#fff', border: '1px solid #e8ebf3', borderRadius: 9, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #e8ebf3', fontSize: 14, fontWeight: 600, color: '#1a2240' }}>
              Все поступления ({creditTxs.length})
            </div>
            <TxTable rows={creditTxs} onIgnore={ignore} saving={saving} />
          </div>
        </div>
      )}
    </div>
  )
}

function TxTable({ rows, onIgnore, saving }: { rows: BankTx[]; onIgnore: (id: string) => void; saving: string | null }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
      <thead>
        <tr style={{ background: '#f8f9fb' }}>
          {['Дата', 'Контрагент', 'Назначение', 'Сумма', 'Статус', ''].map((h, i) => (
            <th key={i} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#8596b4', borderBottom: '1px solid #e8ebf3', fontSize: 12 }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map(t => (
          <tr key={t.id} style={{ borderBottom: '1px solid #f3f4f6', background: !t.matched_type ? '#fffdf5' : undefined }}>
            <td style={{ padding: '8px 12px', color: '#8596b4', whiteSpace: 'nowrap', fontSize: 12 }}>{new Date(t.date).toLocaleDateString('ru-RU')}</td>
            <td style={{ padding: '8px 12px', fontWeight: 500, color: '#1a2240', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.counterparty || '—'}</td>
            <td style={{ padding: '8px 12px', color: '#374151', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.description || '—'}</td>
            <td style={{ padding: '8px 12px', fontWeight: 700, whiteSpace: 'nowrap', color: t.direction === 'credit' ? '#16a34a' : '#ef4444' }}>
              {t.direction === 'credit' ? '+' : '−'}{FMT(t.amount)} ₽
            </td>
            <td style={{ padding: '8px 12px' }}>
              {t.matched_type === 'invoice' ? <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 8, background: '#dcfce7', color: '#16a34a', fontWeight: 600 }}>✓ Счёт</span>
              : t.matched_type === 'tenant' ? <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 8, background: '#dcfce7', color: '#16a34a', fontWeight: 600 }}>✓ Аренда</span>
              : t.matched_type === 'ignored' ? <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 8, background: '#f3f4f6', color: '#9ca3af', fontWeight: 600 }}>Пропущено</span>
              : <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 8, background: '#fffbeb', color: '#d97706', fontWeight: 600 }}>⚠ Не сопоставлено</span>}
            </td>
            <td style={{ padding: '8px 12px' }}>
              {!t.matched_type && (
                <button onClick={() => onIgnore(t.id)} disabled={saving === t.id}
                  style={{ padding: '3px 8px', borderRadius: 5, border: '1px solid #e8ebf3', background: '#fff', color: '#8596b4', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Пропустить
                </button>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
