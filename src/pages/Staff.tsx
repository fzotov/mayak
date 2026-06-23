import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

interface Staff {
  id: string
  full_name: string
  position: string
  phone: string
  email: string
  salary: number
  role: string
  status: string
  passport: string
  notes: string
}

const empty: Omit<Staff, 'id'> = {
  full_name: '', position: '', phone: '', email: '',
  salary: 0, role: 'staff', status: 'active', passport: '', notes: ''
}

const roleLabel: Record<string, string> = { admin: 'Администратор', manager: 'Менеджер', staff: 'Сотрудник' }
const roleColor: Record<string, { bg: string; color: string }> = {
  admin: { bg: '#ede9fe', color: '#7c3aed' },
  manager: { bg: '#eff3ff', color: '#4f6ef7' },
  staff: { bg: '#f0f2f8', color: '#8596b4' },
}

function Modal({ s, onClose, onSaved }: { s: Staff | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<Omit<Staff, 'id'>>(s ? { ...s } : { ...empty })
  const [saving, setSaving] = useState(false)
  const set = (k: string, v: string | number) => setForm(f => ({ ...f, [k]: v }))

  async function save() {
    if (!form.full_name.trim()) return alert('Введите ФИО')
    setSaving(true)
    if (s?.id) await supabase.from('staff').update(form).eq('id', s.id)
    else await supabase.from('staff').insert(form)
    setSaving(false)
    onSaved()
  }

  async function dismiss() {
    if (!s?.id) return
    await supabase.from('staff').update({ status: 'fired' }).eq('id', s.id)
    onSaved()
  }

  const inp: React.CSSProperties = { width: '100%', border: '1px solid #e8ebf3', borderRadius: 7, padding: '8px 10px', fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' as const }
  const lbl: React.CSSProperties = { fontSize: 12, color: '#8596b4', marginBottom: 4, display: 'block', fontWeight: 500 }

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#00000066', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px #0002' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #e8ebf3' }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#1a2240' }}>{s ? 'Редактировать' : 'Новый сотрудник'}</div>
          <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: 20, color: '#8596b4', cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div><label style={lbl}>ФИО *</label><input style={inp} value={form.full_name} onChange={e => set('full_name', e.target.value)} placeholder="Иванов Иван Иванович" /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div><label style={lbl}>Должность</label><input style={inp} value={form.position} onChange={e => set('position', e.target.value)} placeholder="Менеджер" /></div>
            <div><label style={lbl}>Роль в системе</label>
              <select style={inp} value={form.role} onChange={e => set('role', e.target.value)}>
                <option value="staff">Сотрудник</option>
                <option value="manager">Менеджер</option>
                <option value="admin">Администратор</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div><label style={lbl}>Телефон</label><input style={inp} value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+7 900 000 00 00" /></div>
            <div><label style={lbl}>Email</label><input style={inp} value={form.email} onChange={e => set('email', e.target.value)} placeholder="ivan@example.com" /></div>
          </div>
          <div><label style={lbl}>Зарплата / ставка (₽)</label><input style={inp} type="number" value={form.salary || ''} onChange={e => set('salary', Number(e.target.value))} placeholder="50000" /></div>
          <div><label style={lbl}>Паспорт (серия и номер)</label><input style={inp} value={form.passport} onChange={e => set('passport', e.target.value)} placeholder="4500 123456" /></div>
          <div><label style={lbl}>Заметки</label><textarea style={{ ...inp, height: 70, resize: 'none' }} value={form.notes} onChange={e => set('notes', e.target.value)} /></div>
        </div>
        <div style={{ display: 'flex', gap: 8, padding: '14px 20px', borderTop: '1px solid #e8ebf3' }}>
          <button onClick={save} disabled={saving} style={{ flex: 1, padding: '9px', borderRadius: 8, border: 'none', background: '#4f6ef7', color: '#fff', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
          {s && <button onClick={dismiss} style={{ padding: '9px 16px', borderRadius: 8, border: 'none', background: '#fee2e2', color: '#ef4444', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>Уволить</button>}
          <button onClick={onClose} style={{ padding: '9px 16px', borderRadius: 8, border: '1px solid #e8ebf3', background: '#fff', color: '#6b7280', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>Отмена</button>
        </div>
      </div>
    </div>
  )
}

export default function StaffPage() {
  const [staff, setStaff] = useState<Staff[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Staff | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [filter, setFilter] = useState<'active' | 'fired' | 'all'>('active')

  useEffect(() => { fetchStaff() }, [filter])

  async function fetchStaff() {
    setLoading(true)
    let q = supabase.from('staff').select('*').order('full_name')
    if (filter !== 'all') q = q.eq('status', filter)
    const { data } = await q
    setStaff(data || [])
    setLoading(false)
  }

  const filters: { key: 'active' | 'fired' | 'all'; label: string }[] = [
    { key: 'active', label: 'Активные' },
    { key: 'fired', label: 'Уволенные' },
    { key: 'all', label: 'Все' },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {filters.map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)} style={{ padding: '5px 14px', borderRadius: 20, border: '1px solid', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', borderColor: filter === f.key ? '#4f6ef7' : '#e8ebf3', background: filter === f.key ? '#eff3ff' : '#fff', color: filter === f.key ? '#4f6ef7' : '#6b7280' }}>
              {f.label}
            </button>
          ))}
        </div>
        <button onClick={() => { setSelected(null); setShowModal(true) }} style={{ padding: '8px 16px', border: 'none', borderRadius: 8, background: '#4f6ef7', color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
          + Добавить сотрудника
        </button>
      </div>

      {loading ? <div style={{ color: '#8596b4', fontSize: 14 }}>Загрузка...</div> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
          {staff.map(s => {
            const initials = s.full_name.split(' ').map(w => w[0]).slice(0, 2).join('')
            const rc = roleColor[s.role] || roleColor.staff
            return (
              <div key={s.id} onClick={() => { setSelected(s); setShowModal(true) }} style={{ background: '#fff', border: '1px solid #e8ebf3', borderRadius: 10, padding: '14px 16px', cursor: 'pointer', transition: 'box-shadow .15s' }}
                onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 16px #0001')}
                onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#eff3ff', color: '#4f6ef7', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>{initials}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#1a2240', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.full_name}</div>
                    <div style={{ fontSize: 12, color: '#8596b4' }}>{s.position || '—'}</div>
                  </div>
                  {s.status === 'fired' && <span style={{ fontSize: 11, background: '#fee2e2', color: '#ef4444', padding: '2px 7px', borderRadius: 10 }}>Уволен</span>}
                </div>
                <div style={{ fontSize: 13, color: '#6b7280', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {s.phone && <span>📞 {s.phone}</span>}
                  {s.email && <span>✉️ {s.email}</span>}
                  {s.salary > 0 && <span>💰 {s.salary.toLocaleString('ru')} ₽</span>}
                </div>
                <div style={{ marginTop: 10 }}>
                  <span style={{ fontSize: 12, padding: '3px 9px', borderRadius: 10, background: rc.bg, color: rc.color }}>{roleLabel[s.role] || s.role}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showModal && <Modal s={selected} onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); fetchStaff() }} />}
    </div>
  )
}
