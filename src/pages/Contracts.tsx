import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

interface Contract {
  id: string
  number: string
  type: string
  status: string
  tenant_id: string | null
  unit_id: string | null
  start_date: string
  end_date: string
  rent_amount: number
  deposit: number
  notes: string
  tenant?: { full_name: string }
  unit?: { number: string }
}

interface Tenant { id: string; full_name: string }
interface Unit { id: string; number: string }

const TYPES: Record<string, string> = {
  rent: 'Аренда',
  subrent: 'Субаренда',
  service: 'Оказание услуг',
}

const STATUSES: Record<string, { label: string; bg: string; color: string }> = {
  draft:      { label: 'Черновик',   bg: '#f1f5f9', color: '#64748b' },
  active:     { label: 'Активен',    bg: '#f0fdf4', color: '#22c55e' },
  expiring:   { label: 'Истекает',   bg: '#fffbeb', color: '#d97706' },
  expired:    { label: 'Истёк',      bg: '#fef2f2', color: '#ef4444' },
  terminated: { label: 'Расторгнут', bg: '#f8f0ff', color: '#9333ea' },
}

const SI: React.CSSProperties = {
  width: '100%', border: '1px solid #e5e7eb', borderRadius: 6,
  padding: '7px 10px', fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
}
const SL: React.CSSProperties = {
  fontSize: 12, color: '#6b7280', marginBottom: 4, display: 'block', fontWeight: 500,
}

function Badge({ s }: { s: string }) {
  const b = STATUSES[s] ?? { label: s, bg: '#f1f5f9', color: '#64748b' }
  return (
    <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 12, fontWeight: 500, background: b.bg, color: b.color }}>
      {b.label}
    </span>
  )
}

function computeStatus(c: Contract): string {
  if (c.status === 'terminated' || c.status === 'draft') return c.status
  if (!c.end_date) return c.status
  const end = new Date(c.end_date)
  const now = new Date()
  const diff = (end.getTime() - now.getTime()) / 86400000
  if (diff < 0) return 'expired'
  if (diff < 30) return 'expiring'
  return 'active'
}

const EMPTY_FORM = {
  number: '', type: 'rent', status: 'active',
  tenant_id: '', unit_id: '',
  start_date: '', end_date: '',
  rent_amount: 0, deposit: 0, notes: '',
}

function ContractModal({
  contract, tenants, units, onClose, onSaved,
}: {
  contract: Contract | null
  tenants: Tenant[]
  units: Unit[]
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState(contract ? {
    number: contract.number,
    type: contract.type,
    status: contract.status,
    tenant_id: contract.tenant_id ?? '',
    unit_id: contract.unit_id ?? '',
    start_date: contract.start_date ?? '',
    end_date: contract.end_date ?? '',
    rent_amount: contract.rent_amount ?? 0,
    deposit: contract.deposit ?? 0,
    notes: contract.notes ?? '',
  } : { ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  async function save() {
    if (!form.number.trim()) { alert('Введите номер договора'); return }
    setSaving(true)
    const payload = {
      number: form.number.trim(),
      type: form.type,
      status: form.status,
      tenant_id: form.tenant_id || null,
      unit_id: form.unit_id || null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      rent_amount: Number(form.rent_amount) || 0,
      deposit: Number(form.deposit) || 0,
      notes: form.notes,
    }
    let error
    if (contract) {
      ;({ error } = await supabase.from('contracts').update(payload).eq('id', contract.id))
    } else {
      ;({ error } = await supabase.from('contracts').insert(payload))
    }
    setSaving(false)
    if (error) { alert('Ошибка сохранения: ' + error.message); return }
    onSaved()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#00000066', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 520, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e8ebf3', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#1a2240' }}>{contract ? 'Редактировать договор' : 'Новый договор'}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, color: '#9ca3af', cursor: 'pointer', lineHeight: 1 }}>✕</button>
        </div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={SL}>Номер договора</label>
              <input style={SI} value={form.number} onChange={e => set('number', e.target.value)} placeholder="№ 2024-01" />
            </div>
            <div>
              <label style={SL}>Тип</label>
              <select style={SI} value={form.type} onChange={e => set('type', e.target.value)}>
                {Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label style={SL}>Арендатор</label>
            <select style={SI} value={form.tenant_id} onChange={e => set('tenant_id', e.target.value)}>
              <option value="">— не выбран —</option>
              {tenants.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
            </select>
          </div>
          <div>
            <label style={SL}>Помещение</label>
            <select style={SI} value={form.unit_id} onChange={e => set('unit_id', e.target.value)}>
              <option value="">— не выбрано —</option>
              {units.map(u => <option key={u.id} value={u.id}>Офис {u.number}</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={SL}>Дата начала</label>
              <input style={SI} type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} />
            </div>
            <div>
              <label style={SL}>Дата окончания</label>
              <input style={SI} type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={SL}>Арендная плата, ₽/мес</label>
              <input style={SI} type="number" min="0" value={form.rent_amount} onChange={e => set('rent_amount', e.target.value)} />
            </div>
            <div>
              <label style={SL}>Залог, ₽</label>
              <input style={SI} type="number" min="0" value={form.deposit} onChange={e => set('deposit', e.target.value)} />
            </div>
          </div>
          <div>
            <label style={SL}>Статус</label>
            <select style={SI} value={form.status} onChange={e => set('status', e.target.value)}>
              {Object.entries(STATUSES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div>
            <label style={SL}>Примечания</label>
            <textarea style={{ ...SI, resize: 'vertical', minHeight: 72 }} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Дополнительные условия..." />
          </div>
        </div>
        <div style={{ padding: '14px 20px', borderTop: '1px solid #e8ebf3', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 16px', border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', color: '#374151', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>Отмена</button>
          <button onClick={save} disabled={saving}
            style={{ padding: '8px 20px', border: 'none', borderRadius: 8, background: '#4f6ef7', color: '#fff', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ContractsPage() {
  const [contracts, setContracts] = useState<Contract[]>([])
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [modal, setModal] = useState<'new' | Contract | null>(null)

  async function load() {
    const [{ data: c }, { data: t }, { data: u }] = await Promise.all([
      supabase.from('contracts').select('*, tenant:tenants(full_name), unit:units(number)').order('start_date', { ascending: false }),
      supabase.from('tenants').select('id, full_name').order('full_name'),
      supabase.from('units').select('id, number').order('number'),
    ])
    setContracts(c || [])
    setTenants(t || [])
    setUnits(u || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function remove(id: string) {
    if (!confirm('Удалить договор? Это действие необратимо.')) return
    const { error } = await supabase.from('contracts').delete().eq('id', id)
    if (error) { alert('Ошибка удаления: ' + error.message); return }
    setContracts(prev => prev.filter(c => c.id !== id))
  }

  const displayed = contracts.map(c => ({ ...c, _status: computeStatus(c) }))
  const filtered = filter ? displayed.filter(c => c._status === filter) : displayed

  const counts = {
    active: displayed.filter(c => c._status === 'active').length,
    expiring: displayed.filter(c => c._status === 'expiring').length,
    expired: displayed.filter(c => c._status === 'expired').length,
    total: displayed.length,
  }

  const fmtDate = (s: string) => s ? new Date(s).toLocaleDateString('ru') : '—'
  const fmtAmount = (n: number) => n != null ? n.toLocaleString('ru') + ' ₽' : '—'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
        {[
          { label: 'Всего договоров', value: counts.total, color: '#1a2240' },
          { label: 'Активных', value: counts.active, color: '#22c55e' },
          { label: 'Истекают (30 дней)', value: counts.expiring, color: '#d97706' },
          { label: 'Истёкших', value: counts.expired, color: '#ef4444' },
        ].map(k => (
          <div key={k.label} style={{ background: '#fff', border: '1px solid #e8ebf3', borderRadius: 9, padding: '11px 13px' }}>
            <div style={{ fontSize: 12, color: '#8596b4', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.4px' }}>{k.label}</div>
            <div style={{ fontSize: 22, fontWeight: 600, color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(['', 'active', 'expiring', 'expired', 'draft', 'terminated'] as const).map(s => (
            <button key={s} onClick={() => setFilter(s)}
              style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                borderColor: filter === s ? '#4f6ef7' : '#e8ebf3',
                background: filter === s ? '#eff3ff' : '#fff',
                color: filter === s ? '#4f6ef7' : '#6b7280' }}>
              {s ? (STATUSES[s]?.label ?? s) : 'Все'}
            </button>
          ))}
        </div>
        <button onClick={() => setModal('new')}
          style={{ padding: '8px 16px', border: 'none', borderRadius: 8, background: '#4f6ef7', color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
          + Новый договор
        </button>
      </div>

      <div style={{ background: '#fff', border: '1px solid #e8ebf3', borderRadius: 9, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#8596b4', fontSize: 14 }}>Загрузка...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#8596b4', fontSize: 14 }}>Договоры не найдены</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: '#f8f9fc', borderBottom: '1px solid #e8ebf3' }}>
                {['Номер', 'Тип', 'Арендатор', 'Помещение', 'Период', 'Сумма / мес', 'Залог', 'Статус', ''].map(h => (
                  <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 500, color: '#8596b4', fontSize: 13, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} style={{ borderBottom: '1px solid #f0f2f8' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f9fafb')}
                  onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>
                  <td style={{ padding: '9px 12px', fontWeight: 600, color: '#1a2240', whiteSpace: 'nowrap' }}>{c.number}</td>
                  <td style={{ padding: '9px 12px', color: '#6b7280' }}>{TYPES[c.type] ?? c.type}</td>
                  <td style={{ padding: '9px 12px', color: '#374151' }}>{c.tenant?.full_name ?? '—'}</td>
                  <td style={{ padding: '9px 12px', color: '#374151' }}>{c.unit ? `Офис ${c.unit.number}` : '—'}</td>
                  <td style={{ padding: '9px 12px', color: '#8596b4', whiteSpace: 'nowrap', fontSize: 13 }}>
                    {fmtDate(c.start_date)} — {fmtDate(c.end_date)}
                  </td>
                  <td style={{ padding: '9px 12px', fontWeight: 500, color: '#1a2240', whiteSpace: 'nowrap' }}>{fmtAmount(c.rent_amount)}</td>
                  <td style={{ padding: '9px 12px', color: '#6b7280', whiteSpace: 'nowrap' }}>{fmtAmount(c.deposit)}</td>
                  <td style={{ padding: '9px 12px' }}><Badge s={c._status} /></td>
                  <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>
                    <button onClick={() => setModal(c as Contract)}
                      style={{ padding: '3px 10px', fontSize: 13, borderRadius: 5, border: '1px solid #e8ebf3', color: '#374151', background: '#f9fafb', cursor: 'pointer', marginRight: 4 }}>
                      Изменить
                    </button>
                    <button onClick={() => remove(c.id)}
                      style={{ padding: '3px 10px', fontSize: 13, borderRadius: 5, border: '1px solid #fee2e2', color: '#ef4444', background: '#fef2f2', cursor: 'pointer' }}>
                      Удалить
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal !== null && (
        <ContractModal
          contract={modal === 'new' ? null : modal}
          tenants={tenants}
          units={units}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load() }}
        />
      )}
    </div>
  )
}
