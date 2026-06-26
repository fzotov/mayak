import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

interface Repair {
  id: string
  number: number
  tenant_id: string | null
  unit_id: string | null
  category: string
  priority: string
  status: string
  description: string
  photos: string[] | null
  assignee_id: string | null
  due_date: string | null
  completed_date: string | null
  cost: number
  comment: string | null
  created_at: string
  tenant?: { full_name: string }
  unit?: { number: string }
  assignee?: { full_name: string }
}

interface RepairHistory {
  id: string
  status: string
  comment: string | null
  created_at: string
}

interface Unit { id: string; number: string }
interface Staff { id: string; full_name: string }
interface Tenant { id: string; full_name: string }

const CATEGORIES = ['Электрика', 'Сантехника', 'Отопление', 'Интернет', 'Уборка', 'Другое']
const PRIORITIES: Record<string, { label: string; color: string; bg: string }> = {
  low:      { label: 'Низкий',    color: '#6b7280', bg: '#f3f4f6' },
  medium:   { label: 'Средний',   color: '#d97706', bg: '#fef3c7' },
  high:     { label: 'Высокий',   color: '#ea580c', bg: '#ffedd5' },
  emergency:{ label: 'Аварийный', color: '#ef4444', bg: '#fee2e2' },
}
const STATUSES: Record<string, { label: string; color: string; bg: string }> = {
  new:       { label: 'Новая',     color: '#6b7280', bg: '#f3f4f6' },
  accepted:  { label: 'Принята',   color: '#4f6ef7', bg: '#eff3ff' },
  in_progress:{ label: 'В работе', color: '#d97706', bg: '#fef3c7' },
  completed: { label: 'Выполнена', color: '#16a34a', bg: '#dcfce7' },
  rejected:  { label: 'Отклонена', color: '#ef4444', bg: '#fee2e2' },
}

const inp: React.CSSProperties = { width: '100%', border: '1px solid #e8ebf3', borderRadius: 7, padding: '8px 10px', fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }
const lbl: React.CSSProperties = { fontSize: 12, color: '#8596b4', marginBottom: 4, display: 'block', fontWeight: 500 }
const sec: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: '#8596b4', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10, borderBottom: '1px solid #f0f2f8', paddingBottom: 6 }

// ─── Badge ───────────────────────────────────────────────────────────────────

function PriorityBadge({ p }: { p: string }) {
  const d = PRIORITIES[p] || PRIORITIES.medium
  return <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 10, background: d.bg, color: d.color, fontWeight: 500 }}>{d.label}</span>
}

function StatusBadge({ s }: { s: string }) {
  const d = STATUSES[s] || STATUSES.new
  return <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 10, background: d.bg, color: d.color, fontWeight: 500 }}>{d.label}</span>
}

// ─── Modal ───────────────────────────────────────────────────────────────────

function RepairModal({ repair, units, staff, onClose, onSaved }: {
  repair: Repair | null
  units: Unit[]
  staff: Staff[]
  onClose: () => void
  onSaved: () => void
  initialPriority?: string
}) {
  const [tab, setTab] = useState<'info' | 'process' | 'history'>('info')
  const [form, setForm] = useState({
    unit_id: repair?.unit_id || '',
    category: repair?.category || 'Другое',
    priority: repair?.priority || 'medium',
    description: repair?.description || '',
    status: repair?.status || 'new',
    assignee_id: repair?.assignee_id || '',
    due_date: repair?.due_date || '',
    completed_date: repair?.completed_date || '',
    cost: repair?.cost || 0,
    comment: repair?.comment || '',
  })
  const [history, setHistory] = useState<RepairHistory[]>([])
  const [saving, setSaving] = useState(false)
  const set = (k: string, v: string | number) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    if (repair?.id && tab === 'history') loadHistory()
  }, [tab])

  async function loadHistory() {
    const { data } = await supabase.from('repair_history').select('*')
      .eq('repair_id', repair!.id).order('created_at', { ascending: false })
    setHistory(data || [])
  }

  async function save() {
    if (!form.description.trim()) return alert('Введите описание проблемы')
    setSaving(true)
    const payload = {
      ...form,
      unit_id: form.unit_id || null,
      assignee_id: form.assignee_id || null,
      due_date: form.due_date || null,
      completed_date: form.completed_date || null,
      cost: Number(form.cost),
    }
    if (repair?.id) {
      // Запись в историю если статус изменился
      if (form.status !== repair.status) {
        await supabase.from('repair_history').insert({
          repair_id: repair.id, status: form.status, comment: form.comment || null
        })
      }
      const { error } = await supabase.from('repairs').update(payload).eq('id', repair.id)
      if (error) { alert('Ошибка: ' + error.message); setSaving(false); return }
    } else {
      const { error } = await supabase.from('repairs').insert(payload)
      if (error) { alert('Ошибка: ' + error.message); setSaving(false); return }
    }
    setSaving(false)
    onSaved()
  }

  async function remove() {
    if (!repair?.id || !confirm('Удалить заявку?')) return
    const { error } = await supabase.from('repairs').delete().eq('id', repair.id)
    if (error) { alert('Ошибка: ' + error.message); return }
    onSaved()
  }

  const TABS = [
    { key: 'info', label: 'Заявка' },
    { key: 'process', label: 'Обработка' },
    { key: 'history', label: 'История' },
  ] as const

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#00000066', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 600, maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 20px 60px #0002' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #e8ebf3' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#1a2240' }}>
              {repair ? `Заявка №${repair.number}` : 'Новая заявка'}
              {form.priority === 'emergency' && <span style={{ marginLeft: 8, fontSize: 13, color: '#ef4444' }}>⚡ Аварийная</span>}
            </div>
            {repair && <div style={{ fontSize: 12, color: '#8596b4', marginTop: 2 }}>{new Date(repair.created_at).toLocaleDateString('ru')}</div>}
          </div>
          <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: 20, color: '#8596b4', cursor: 'pointer' }}>✕</button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #e8ebf3' }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{ flex: 1, padding: '10px', border: 'none', background: 'none', fontSize: 13, fontWeight: tab === t.key ? 600 : 400, color: tab === t.key ? '#4f6ef7' : '#8596b4', borderBottom: `2px solid ${tab === t.key ? '#4f6ef7' : 'transparent'}`, cursor: 'pointer', fontFamily: 'inherit' }}>
              {t.label}
            </button>
          ))}
        </div>

        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Заявка */}
          {tab === 'info' && <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={lbl}>Помещение</label>
                <select style={inp} value={form.unit_id} onChange={e => set('unit_id', e.target.value)}>
                  <option value="">— Не указано</option>
                  {units.map(u => <option key={u.id} value={u.id}>{u.number}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Категория</label>
                <select style={inp} value={form.category} onChange={e => set('category', e.target.value)}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label style={lbl}>Приоритет</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {Object.entries(PRIORITIES).map(([key, val]) => (
                  <button key={key} onClick={() => set('priority', key)} style={{ padding: '5px 12px', borderRadius: 8, border: `2px solid ${form.priority === key ? val.color : '#e8ebf3'}`, background: form.priority === key ? val.bg : '#fff', color: form.priority === key ? val.color : '#6b7280', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', fontWeight: form.priority === key ? 600 : 400 }}>
                    {key === 'emergency' && '⚡ '}{val.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={lbl}>Описание проблемы *</label>
              <textarea style={{ ...inp, height: 100, resize: 'none' }} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Подробно опишите проблему..." />
            </div>
          </>}

          {/* Обработка */}
          {tab === 'process' && <>
            <div style={sec}>Назначение</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={lbl}>Статус</label>
                <select style={inp} value={form.status} onChange={e => set('status', e.target.value)}>
                  {Object.entries(STATUSES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Исполнитель</label>
                <select style={inp} value={form.assignee_id} onChange={e => set('assignee_id', e.target.value)}>
                  <option value="">— Не назначен</option>
                  {staff.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={lbl}>Плановый срок</label>
                <input style={inp} type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)} />
              </div>
              <div>
                <label style={lbl}>Дата выполнения (факт)</label>
                <input style={inp} type="date" value={form.completed_date} onChange={e => set('completed_date', e.target.value)} />
              </div>
            </div>
            <div style={sec}>Результат</div>
            <div>
              <label style={lbl}>Стоимость работ (₽)</label>
              <input style={inp} type="number" min={0} value={form.cost || ''} placeholder="0" onChange={e => set('cost', Number(e.target.value))} />
            </div>
            <div>
              <label style={lbl}>Комментарий исполнителя</label>
              <textarea style={{ ...inp, height: 80, resize: 'none' }} value={form.comment || ''} onChange={e => set('comment', e.target.value)} placeholder="Что было сделано..." />
            </div>
          </>}

          {/* История */}
          {tab === 'history' && (
            <div>
              {history.length === 0 ? (
                <div style={{ color: '#8596b4', fontSize: 14, textAlign: 'center', padding: 20 }}>Изменений статуса нет</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {history.map(h => (
                    <div key={h.id} style={{ display: 'flex', gap: 12, padding: '10px 12px', background: '#f8f9fc', borderRadius: 8, borderLeft: `3px solid ${STATUSES[h.status]?.color || '#e8ebf3'}` }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <StatusBadge s={h.status} />
                          <span style={{ fontSize: 12, color: '#8596b4' }}>{new Date(h.created_at).toLocaleString('ru')}</span>
                        </div>
                        {h.comment && <div style={{ fontSize: 13, color: '#374151' }}>{h.comment}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', gap: 8, padding: '14px 20px', borderTop: '1px solid #e8ebf3' }}>
          {tab !== 'history' && (
            <button onClick={save} disabled={saving} style={{ flex: 1, padding: '9px', borderRadius: 8, border: 'none', background: '#4f6ef7', color: '#fff', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Сохранение...' : 'Сохранить'}
            </button>
          )}
          {repair && tab !== 'history' && (
            <button onClick={remove} style={{ padding: '9px 16px', borderRadius: 8, border: 'none', background: '#fee2e2', color: '#ef4444', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>Удалить</button>
          )}
          <button onClick={onClose} style={{ padding: '9px 16px', borderRadius: 8, border: '1px solid #e8ebf3', background: '#fff', color: '#6b7280', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>Закрыть</button>
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RepairsPage() {
  const [repairs, setRepairs] = useState<Repair[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [staff, setStaff] = useState<Staff[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Repair | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [initPriority, setInitPriority] = useState('medium')

  // Filters
  const [pageTab, setPageTab] = useState<'all' | 'emergency'>('all')
  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [unitFilter, setUnitFilter] = useState('')

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [{ data: rep }, { data: u }, { data: s }] = await Promise.all([
      supabase.from('repairs').select('*, tenant:tenants(full_name), unit:units(number), assignee:staff(full_name)')
        .order('created_at', { ascending: false }),
      supabase.from('units').select('id, number').order('number'),
      supabase.from('staff').select('id, full_name').eq('status', 'active').order('full_name'),
    ])
    setRepairs(rep || [])
    setUnits(u || [])
    setStaff(s || [])
    setLoading(false)
  }

  function openNew(priority = 'medium') {
    setSelected(null)
    setInitPriority(priority)
    setShowModal(true)
  }

  // KPI
  const total = repairs.length
  const newCount = repairs.filter(r => r.status === 'new').length
  const inProgress = repairs.filter(r => r.status === 'in_progress').length
  const completed = repairs.filter(r => r.status === 'completed').length
  const emergencyOpen = repairs.filter(r => r.priority === 'emergency' && r.status !== 'completed').length
  const avgDays = (() => {
    const done = repairs.filter(r => r.completed_date && r.created_at)
    if (!done.length) return '—'
    const avg = done.reduce((s, r) => {
      const d = (new Date(r.completed_date!).getTime() - new Date(r.created_at).getTime()) / 86400000
      return s + d
    }, 0) / done.length
    return avg.toFixed(1)
  })()

  // Filtered list
  const base = pageTab === 'emergency' ? repairs.filter(r => r.priority === 'emergency') : repairs
  const filtered = base.filter(r => {
    if (statusFilter && r.status !== statusFilter) return false
    if (priorityFilter && r.priority !== priorityFilter) return false
    if (catFilter && r.category !== catFilter) return false
    if (unitFilter && r.unit_id !== unitFilter) return false
    return true
  })

  const kpi: React.CSSProperties = { background: '#fff', border: '1px solid #e8ebf3', borderRadius: 10, padding: '12px 16px' }
  const filterSel: React.CSSProperties = { border: '1px solid #e8ebf3', borderRadius: 7, padding: '7px 10px', fontSize: 13, fontFamily: 'inherit', outline: 'none', background: '#fff' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10 }}>
        <div style={kpi}><div style={{ fontSize: 12, color: '#8596b4', marginBottom: 4 }}>Всего заявок</div><div style={{ fontSize: 22, fontWeight: 700, color: '#1a2240' }}>{total}</div></div>
        <div style={kpi}><div style={{ fontSize: 12, color: '#8596b4', marginBottom: 4 }}>Новые</div><div style={{ fontSize: 22, fontWeight: 700, color: '#6b7280' }}>{newCount}</div></div>
        <div style={kpi}><div style={{ fontSize: 12, color: '#8596b4', marginBottom: 4 }}>В работе</div><div style={{ fontSize: 22, fontWeight: 700, color: '#d97706' }}>{inProgress}</div></div>
        <div style={kpi}><div style={{ fontSize: 12, color: '#8596b4', marginBottom: 4 }}>Выполнено</div><div style={{ fontSize: 22, fontWeight: 700, color: '#16a34a' }}>{completed}</div></div>
        <div style={kpi}><div style={{ fontSize: 12, color: '#8596b4', marginBottom: 4 }}>Среднее время (дней)</div><div style={{ fontSize: 22, fontWeight: 700, color: '#4f6ef7' }}>{avgDays}</div></div>
      </div>

      {/* Tabs + Buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ display: 'flex', gap: 2, background: '#f0f2f8', borderRadius: 8, padding: 3 }}>
          <button onClick={() => setPageTab('all')} style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: pageTab === 'all' ? '#fff' : 'transparent', color: pageTab === 'all' ? '#1a2240' : '#8596b4', fontSize: 13, fontWeight: pageTab === 'all' ? 600 : 400, cursor: 'pointer', fontFamily: 'inherit', boxShadow: pageTab === 'all' ? '0 1px 4px #0001' : 'none' }}>
            Все заявки
          </button>
          <button onClick={() => setPageTab('emergency')} style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: pageTab === 'emergency' ? '#fff' : 'transparent', color: pageTab === 'emergency' ? '#ef4444' : '#8596b4', fontSize: 13, fontWeight: pageTab === 'emergency' ? 600 : 400, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6, boxShadow: pageTab === 'emergency' ? '0 1px 4px #0001' : 'none' }}>
            ⚡ Аварийные
            {emergencyOpen > 0 && <span style={{ background: '#ef4444', color: '#fff', fontSize: 11, fontWeight: 700, borderRadius: 10, padding: '1px 6px', minWidth: 18, textAlign: 'center' }}>{emergencyOpen}</span>}
          </button>
        </div>
        <div style={{ flex: 1 }} />
        <button onClick={() => openNew('emergency')} style={{ padding: '8px 14px', border: 'none', borderRadius: 8, background: '#fee2e2', color: '#ef4444', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
          ⚡ Аварийная
        </button>
        <button onClick={() => openNew()} style={{ padding: '8px 16px', border: 'none', borderRadius: 8, background: '#4f6ef7', color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
          + Новая заявка
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <select style={filterSel} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">Все статусы</option>
          {Object.entries(STATUSES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select style={filterSel} value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}>
          <option value="">Все приоритеты</option>
          {Object.entries(PRIORITIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select style={filterSel} value={catFilter} onChange={e => setCatFilter(e.target.value)}>
          <option value="">Все категории</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select style={filterSel} value={unitFilter} onChange={e => setUnitFilter(e.target.value)}>
          <option value="">Все помещения</option>
          {units.map(u => <option key={u.id} value={u.id}>{u.number}</option>)}
        </select>
        {(statusFilter || priorityFilter || catFilter || unitFilter) && (
          <button onClick={() => { setStatusFilter(''); setPriorityFilter(''); setCatFilter(''); setUnitFilter('') }} style={{ padding: '7px 12px', borderRadius: 7, border: '1px solid #e8ebf3', background: '#fff', color: '#6b7280', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>✕ Сбросить</button>
        )}
      </div>

      {/* Table */}
      {loading ? <div style={{ color: '#8596b4', fontSize: 14 }}>Загрузка...</div> : (
        <div style={{ background: '#fff', border: '1px solid #e8ebf3', borderRadius: 9, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: '#f8f9fc', borderBottom: '1px solid #e8ebf3' }}>
                {['№', 'Дата', 'Помещение', 'Категория', 'Описание', 'Приоритет', 'Статус', 'Исполнитель', 'Срок', ''].map(h => (
                  <th key={h} style={{ padding: '9px 10px', textAlign: 'left', fontWeight: 500, color: '#8596b4', fontSize: 12, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => {
                const isEmergency = r.priority === 'emergency'
                return (
                  <tr key={r.id}
                    onClick={() => { setSelected(r); setShowModal(true) }}
                    style={{ borderBottom: '1px solid #f0f2f8', cursor: 'pointer', borderLeft: isEmergency ? '3px solid #ef4444' : '3px solid transparent' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f8f9fc')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>
                    <td style={{ padding: '8px 10px', fontWeight: 600, color: '#1a2240' }}>#{r.number}</td>
                    <td style={{ padding: '8px 10px', color: '#8596b4', whiteSpace: 'nowrap' }}>{new Date(r.created_at).toLocaleDateString('ru')}</td>
                    <td style={{ padding: '8px 10px', color: '#374151' }}>{(r.unit as any)?.number || '—'}</td>
                    <td style={{ padding: '8px 10px', color: '#374151', whiteSpace: 'nowrap' }}>{r.category}</td>
                    <td style={{ padding: '8px 10px', color: '#6b7280', maxWidth: 200 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.description.slice(0, 50)}{r.description.length > 50 ? '…' : ''}</div>
                    </td>
                    <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}><PriorityBadge p={r.priority} /></td>
                    <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}><StatusBadge s={r.status} /></td>
                    <td style={{ padding: '8px 10px', color: '#6b7280', whiteSpace: 'nowrap' }}>{(r.assignee as any)?.full_name || '—'}</td>
                    <td style={{ padding: '8px 10px', color: r.due_date && new Date(r.due_date) < new Date() && r.status !== 'completed' ? '#ef4444' : '#6b7280', whiteSpace: 'nowrap' }}>
                      {r.due_date ? new Date(r.due_date).toLocaleDateString('ru') : '—'}
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      <button onClick={e => { e.stopPropagation(); setSelected(r); setShowModal(true) }} style={{ border: '1px solid #e8ebf3', background: '#fff', borderRadius: 6, padding: '3px 10px', fontSize: 12, color: '#374151', cursor: 'pointer' }}>✎</button>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={10} style={{ padding: 30, textAlign: 'center', color: '#8596b4', fontSize: 14 }}>
                  {loading ? 'Загрузка...' : 'Заявок не найдено'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <RepairModal
          repair={selected}
          units={units}
          staff={staff}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); fetchAll() }}
          initialPriority={initPriority}
        />
      )}
    </div>
  )
}

// ─── Экспорт хука для дашборда ───────────────────────────────────────────────

export async function fetchHotRepairs() {
  const { data } = await supabase.from('repairs')
    .select('id, number, priority, status, category, description, created_at, unit:units(number)')
    .in('priority', ['high', 'emergency'])
    .neq('status', 'completed')
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(5)
  return data || []
}
