import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

interface Invoice {
  id: string
  tenant_id: string
  number: string
  period: string
  rent_amount: number
  cleaning_amount: number
  utilities_amount: number
  services_amount: number
  total_amount: number
  status: string
  due_date: string
  created_at: string
}

type FilterTab = 'all' | 'pending' | 'paid' | 'overdue'

const statusConfig: Record<string, { bg: string; color: string; label: string }> = {
  paid:    { bg: '#dcfce7', color: '#16a34a', label: 'Оплачен' },
  PAID:    { bg: '#dcfce7', color: '#16a34a', label: 'Оплачен' },
  sent:    { bg: '#dbeafe', color: '#2563eb', label: 'Выставлен' },
  SENT:    { bg: '#dbeafe', color: '#2563eb', label: 'Выставлен' },
  overdue: { bg: '#fee2e2', color: '#ef4444', label: 'Просрочен' },
  OVERDUE: { bg: '#fee2e2', color: '#ef4444', label: 'Просрочен' },
  draft:   { bg: '#f3f4f6', color: '#6b7280', label: 'Черновик' },
  DRAFT:   { bg: '#f3f4f6', color: '#6b7280', label: 'Черновик' },
}
const getStatus = (s: string) => statusConfig[s] ?? { bg: '#f3f4f6', color: '#6b7280', label: s }

function fmt(n: number) {
  return n.toLocaleString('ru-RU') + ' ₽'
}

function composition(inv: Invoice): string {
  const parts: string[] = []
  if (inv.rent_amount > 0)       parts.push('Аренда ' + inv.rent_amount.toLocaleString('ru-RU') + ' ₽')
  if (inv.cleaning_amount > 0)   parts.push('Уборка ' + inv.cleaning_amount.toLocaleString('ru-RU') + ' ₽')
  if (inv.utilities_amount > 0)  parts.push('ЖКУ ' + inv.utilities_amount.toLocaleString('ru-RU') + ' ₽')
  if (inv.services_amount > 0)   parts.push('Услуги ' + inv.services_amount.toLocaleString('ru-RU') + ' ₽')
  return parts.join(', ')
}

function formatDate(s: string) {
  if (!s) return '—'
  const d = new Date(s)
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function TenantInvoices({ tenantId }: { tenantId: string }) {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<FilterTab>('all')
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  useEffect(() => {
    if (!tenantId) return
    setLoading(true)
    supabase
      .from('invoices')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setInvoices((data as Invoice[]) || [])
        setLoading(false)
      })
  }, [tenantId])

  const currentYear = new Date().getFullYear()

  const st = (i: Invoice) => i.status?.toLowerCase()

  const toPay = invoices
    .filter(i => st(i) === 'sent' || st(i) === 'overdue')
    .reduce((s, i) => s + (i.total_amount || 0), 0)

  const paidYear = invoices
    .filter(i => st(i) === 'paid' && new Date(i.created_at).getFullYear() === currentYear)
    .reduce((s, i) => s + (i.total_amount || 0), 0)

  const overdueCount = invoices.filter(i => st(i) === 'overdue').length

  const filtered = invoices.filter(i => {
    if (tab === 'all') return true
    if (tab === 'pending') return st(i) === 'sent' || st(i) === 'overdue'
    if (tab === 'paid') return st(i) === 'paid'
    if (tab === 'overdue') return st(i) === 'overdue'
    return true
  })

  async function markPaid(id: string) {
    setUpdatingId(id)
    const { error } = await supabase
      .from('invoices')
      .update({ status: 'PAID' })
      .eq('id', id)
    if (!error) {
      setInvoices(prev => prev.map(i => i.id === id ? { ...i, status: 'PAID' } : i))
    }
    setUpdatingId(null)
  }

  const card = (label: string, value: string, highlight?: boolean): JSX.Element => (
    <div style={{
      background: '#fff',
      border: '1px solid #e5e7eb',
      borderRadius: 10,
      padding: 16,
      flex: 1,
      minWidth: 140,
    }}>
      <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: highlight ? '#ef4444' : '#111827' }}>{value}</div>
    </div>
  )

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'Все' },
    { key: 'pending', label: 'К оплате' },
    { key: 'paid', label: 'Оплачен' },
    { key: 'overdue', label: 'Просрочен' },
  ]

  return (
    <div style={{ padding: 24 }}>
      {/* KPI row */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        {card('К оплате', fmt(toPay), toPay > 0)}
        {card('Оплачено за год', fmt(paidYear))}
        {card('Просрочено', String(overdueCount), overdueCount > 0)}
      </div>

      {/* Card wrapper */}
      <div style={{
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: 10,
        padding: 16,
      }}>
        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid #e5e7eb', paddingBottom: 0 }}>
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                background: 'none',
                border: 'none',
                padding: '8px 14px',
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: tab === t.key ? 600 : 400,
                color: tab === t.key ? '#2563eb' : '#6b7280',
                borderBottom: tab === t.key ? '2px solid #2563eb' : '2px solid transparent',
                marginBottom: -1,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ padding: 32, textAlign: 'center', color: '#9ca3af' }}>Загрузка...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: '#9ca3af' }}>Нет данных</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  {['Период', 'Номер', 'Состав', 'Сумма', 'Срок оплаты', 'Статус', 'Действия'].map(h => (
                    <th key={h} style={{
                      padding: '10px 12px',
                      textAlign: 'left',
                      fontWeight: 600,
                      color: '#374151',
                      borderBottom: '1px solid #e5e7eb',
                      whiteSpace: 'nowrap',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(inv => {
                  const st = getStatus(inv.status)
                  return (
                    <tr key={inv.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>{inv.period || '—'}</td>
                      <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', color: '#6b7280' }}>{inv.number || '—'}</td>
                      <td style={{ padding: '10px 12px', color: '#374151', maxWidth: 260 }}>{composition(inv) || '—'}</td>
                      <td style={{ padding: '10px 12px', fontWeight: 600, whiteSpace: 'nowrap' }}>{fmt(inv.total_amount || 0)}</td>
                      <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>{formatDate(inv.due_date)}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{
                          background: st.bg,
                          color: st.color,
                          padding: '3px 10px',
                          borderRadius: 20,
                          fontSize: 12,
                          fontWeight: 600,
                          whiteSpace: 'nowrap',
                        }}>{st.label}</span>
                      </td>
                      <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                        <button
                          disabled
                          style={{
                            background: '#f3f4f6',
                            color: '#9ca3af',
                            border: 'none',
                            borderRadius: 6,
                            padding: '5px 10px',
                            fontSize: 13,
                            cursor: 'not-allowed',
                            marginRight: 6,
                          }}
                        >
                          📥 Скачать
                        </button>
                        {inv.status?.toLowerCase() !== 'paid' && (
                          <button
                            onClick={() => markPaid(inv.id)}
                            disabled={updatingId === inv.id}
                            style={{
                              background: updatingId === inv.id ? '#f3f4f6' : '#dcfce7',
                              color: updatingId === inv.id ? '#9ca3af' : '#16a34a',
                              border: 'none',
                              borderRadius: 6,
                              padding: '5px 10px',
                              fontSize: 13,
                              cursor: updatingId === inv.id ? 'not-allowed' : 'pointer',
                              fontWeight: 500,
                            }}
                          >
                            ✓ Оплачен
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
