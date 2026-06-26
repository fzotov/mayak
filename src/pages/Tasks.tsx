import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

interface Task {
  id: string
  title: string
  description: string
  assignee_id: string | null
  status: 'todo' | 'in_progress' | 'done'
  priority: 'low' | 'normal' | 'high'
  due_date: string
  letter_id?: string | null
  assignee?: { full_name: string }
}

interface Staff { id: string; full_name: string }

const statusCols: { key: Task['status']; label: string; color: string; bg: string }[] = [
  { key: 'todo', label: 'К выполнению', color: '#8596b4', bg: '#f0f2f8' },
  { key: 'in_progress', label: 'В работе', color: '#d97706', bg: '#fffbeb' },
  { key: 'done', label: 'Готово', color: '#16a34a', bg: '#f0fdf4' },
]

const priorityIcon: Record<string, string> = { high: '🔴', normal: '🟡', low: '🔵' }

const emptyTask: Omit<Task, 'id'> = { title: '', description: '', assignee_id: null, status: 'todo', priority: 'normal', due_date: '', letter_id: null }

function TaskModal({ task, staff, onClose, onSaved }: { task: Task | null; staff: Staff[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<Omit<Task, 'id'>>(task ? { ...task } : { ...emptyTask })
  const [saving, setSaving] = useState(false)
  const set = (k: string, v: string | null) => setForm(f => ({ ...f, [k]: v }))

  async function save() {
    if (!form.title.trim()) return alert('Введите заголовок')
    setSaving(true)
    const { error } = task?.id
      ? await supabase.from('tasks').update(form).eq('id', task.id)
      : await supabase.from('tasks').insert(form)
    setSaving(false)
    if (error) { alert('Ошибка сохранения: ' + error.message); return }
    onSaved()
  }

  async function remove() {
    if (!task?.id || !confirm('Удалить задачу?')) return
    const { error } = await supabase.from('tasks').delete().eq('id', task.id)
    if (error) { alert('Ошибка удаления: ' + error.message); return }
    onSaved()
  }

  const inp: React.CSSProperties = { width: '100%', border: '1px solid #e8ebf3', borderRadius: 7, padding: '8px 10px', fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' as const }
  const lbl: React.CSSProperties = { fontSize: 12, color: '#8596b4', marginBottom: 4, display: 'block', fontWeight: 500 }

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#00000066', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 460, boxShadow: '0 20px 60px #0002' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #e8ebf3' }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#1a2240' }}>{task ? 'Редактировать задачу' : 'Новая задача'}</div>
          <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: 20, color: '#8596b4', cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div><label style={lbl}>Заголовок *</label><input style={inp} value={form.title} onChange={e => set('title', e.target.value)} placeholder="Что нужно сделать?" /></div>
          <div><label style={lbl}>Описание</label><textarea style={{ ...inp, height: 70, resize: 'none' }} value={form.description} onChange={e => set('description', e.target.value)} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div><label style={lbl}>Исполнитель</label>
              <select style={inp} value={form.assignee_id || ''} onChange={e => set('assignee_id', e.target.value || null)}>
                <option value="">— Не назначен</option>
                {staff.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
              </select>
            </div>
            <div><label style={lbl}>Приоритет</label>
              <select style={inp} value={form.priority} onChange={e => set('priority', e.target.value)}>
                <option value="low">🔵 Низкий</option>
                <option value="normal">🟡 Обычный</option>
                <option value="high">🔴 Высокий</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div><label style={lbl}>Статус</label>
              <select style={inp} value={form.status} onChange={e => set('status', e.target.value)}>
                <option value="todo">К выполнению</option>
                <option value="in_progress">В работе</option>
                <option value="done">Готово</option>
              </select>
            </div>
            <div><label style={lbl}>Срок</label><input style={inp} type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)} /></div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, padding: '14px 20px', borderTop: '1px solid #e8ebf3' }}>
          <button onClick={save} disabled={saving} style={{ flex: 1, padding: '9px', borderRadius: 8, border: 'none', background: '#4f6ef7', color: '#fff', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
          {task && <button onClick={remove} style={{ padding: '9px 16px', borderRadius: 8, border: 'none', background: '#fee2e2', color: '#ef4444', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>Удалить</button>}
          <button onClick={onClose} style={{ padding: '9px 16px', borderRadius: 8, border: '1px solid #e8ebf3', background: '#fff', color: '#6b7280', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>Отмена</button>
        </div>
      </div>
    </div>
  )
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [staff, setStaff] = useState<Staff[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Task | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [newStatus, setNewStatus] = useState<Task['status']>('todo')

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [{ data: t }, { data: s }] = await Promise.all([
      supabase.from('tasks').select('*, assignee:staff(full_name)').order('due_date', { ascending: true }),
      supabase.from('staff').select('id, full_name').eq('status', 'active').order('full_name')
    ])
    setTasks(t || [])
    setStaff(s || [])
    setLoading(false)
  }

  function openNew(status: Task['status']) {
    setSelected(null)
    setNewStatus(status)
    setShowModal(true)
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
        <button onClick={() => openNew('todo')} style={{ padding: '8px 16px', border: 'none', borderRadius: 8, background: '#4f6ef7', color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
          + Новая задача
        </button>
      </div>

      {loading ? <div style={{ color: '#8596b4', fontSize: 14 }}>Загрузка...</div> : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, alignItems: 'start' }}>
          {statusCols.map(col => {
            const colTasks = tasks.filter(t => t.status === col.key)
            return (
              <div key={col.key} style={{ background: col.bg, borderRadius: 10, padding: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: col.color }}>{col.label} <span style={{ fontWeight: 400, opacity: 0.7 }}>({colTasks.length})</span></div>
                  <button onClick={() => openNew(col.key)} style={{ border: 'none', background: 'none', color: col.color, fontSize: 18, cursor: 'pointer', lineHeight: 1 }}>+</button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {colTasks.map(t => (
                    <div key={t.id} onClick={() => { setSelected(t); setShowModal(true) }} style={{ background: '#fff', border: '1px solid #e8ebf3', borderRadius: 8, padding: '10px 12px', cursor: 'pointer', borderLeft: `3px solid ${t.priority === 'high' ? '#ef4444' : t.priority === 'normal' ? '#f59e0b' : '#94a3b8'}` }}
                      onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 2px 8px #0001')}
                      onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: '#1a2240', marginBottom: 4 }}>{priorityIcon[t.priority]} {t.title}</div>
                      {t.description && <div style={{ fontSize: 12, color: '#8596b4', marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.description}</div>}
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#8596b4' }}>
                        <span>{(t.assignee as any)?.full_name || '—'}</span>
                        {t.due_date && <span>{new Date(t.due_date).toLocaleDateString('ru')}</span>}
                        {t.letter_id && <span style={{ color: '#7c3aed', fontSize: 11, cursor: 'pointer' }} onClick={e => { e.stopPropagation(); window.dispatchEvent(new CustomEvent('navigate', { detail: 'letters' })) }}>✉ письмо</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showModal && (
        <TaskModal
          task={selected}
          staff={staff}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); fetchAll() }}
        />
      )}
    </div>
  )
}
