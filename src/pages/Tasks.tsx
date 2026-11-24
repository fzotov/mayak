// Задачи: доска «К выполнению · В работе · Готово». «Мои задачи» — та же доска по задачам, созданным сотрудниками.
import { useState, useEffect } from 'react'
import { go } from '../lib/nav'
import { supabase } from '../lib/supabase'
import { Page, Row, Button, Badge, Field, Input, Select, Textarea, Modal, Notice, Loading, ErrorBox, Muted, dateRu, C } from '../components/ui'

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
  { key: 'todo', label: 'К выполнению', color: C.muted, bg: C.card2 },
  { key: 'in_progress', label: 'В работе', color: C.amber, bg: C.amberBg },
  { key: 'done', label: 'Готово', color: C.green, bg: C.greenBg },
]

const priorityColor: Record<string, string> = { high: C.red, normal: C.amber, low: C.lineStrong }

const emptyTask: Omit<Task, 'id'> = { title: '', description: '', assignee_id: null, status: 'todo', priority: 'normal', due_date: '', letter_id: null }

const two: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }

function TaskModal({ task, staff, onClose, onSaved }: { task: Task | null; staff: Staff[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<Omit<Task, 'id'>>(task ? { ...task } : { ...emptyTask })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (k: string, v: string | null) => setForm(f => ({ ...f, [k]: v }))
  const isEdit = !!task?.id

  async function save() {
    if (!form.title.trim()) { setError('Введите заголовок'); return }
    setError('')
    setSaving(true)
    // Без связанных полей из выборки (assignee, id) и с пустым сроком как null — иначе база отклоняет запись.
    const { assignee: _a, id: _id, ...rest } = form as Task
    const payload = { ...rest, due_date: rest.due_date || null }
    const { error } = task?.id
      ? await supabase.from('tasks').update(payload).eq('id', task.id)
      : await supabase.from('tasks').insert(payload)
    setSaving(false)
    if (error) { setError('Ошибка сохранения: ' + error.message); return }
    onSaved()
  }

  async function remove() {
    if (!task?.id || !confirm('Удалить задачу?')) return
    const { error } = await supabase.from('tasks').delete().eq('id', task.id)
    if (error) { setError('Ошибка удаления: ' + error.message); return }
    onSaved()
  }

  return (
    <Modal title={isEdit ? 'Редактировать задачу' : 'Новая задача'} onClose={onClose} width={460} footer={<>
      {isEdit && <Button kind="danger" onClick={remove} style={{ marginRight: 'auto' }}>Удалить</Button>}
      <Button onClick={onClose}>Отмена</Button>
      <Button kind="primary" onClick={save} disabled={saving}>{saving ? 'Сохранение…' : 'Сохранить'}</Button>
    </>}>
      {error && <Notice tone="red">{error}</Notice>}
      <Field label="Заголовок *"><Input value={form.title} onChange={e => set('title', e.target.value)} placeholder="Что нужно сделать?" autoFocus /></Field>
      <Field label="Описание"><Textarea style={{ height: 70, resize: 'none' }} value={form.description || ''} onChange={e => set('description', e.target.value)} /></Field>
      <div style={two}>
        <Field label="Исполнитель">
          <Select value={form.assignee_id || ''} onChange={e => set('assignee_id', e.target.value || null)}>
            <option value="">Не назначен</option>
            {staff.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
          </Select>
        </Field>
        <Field label="Приоритет">
          <Select value={form.priority} onChange={e => set('priority', e.target.value)}>
            <option value="low">Низкий</option>
            <option value="normal">Обычный</option>
            <option value="high">Высокий</option>
          </Select>
        </Field>
      </div>
      <div style={two}>
        <Field label="Статус">
          <Select value={form.status} onChange={e => set('status', e.target.value)}>
            <option value="todo">К выполнению</option>
            <option value="in_progress">В работе</option>
            <option value="done">Готово</option>
          </Select>
        </Field>
        <Field label="Срок"><Input type="date" value={form.due_date || ''} onChange={e => set('due_date', e.target.value)} /></Field>
      </div>
    </Modal>
  )
}

function TaskCard({ t, onOpen }: { t: Task; onOpen: () => void }) {
  const [hover, setHover] = useState(false)
  return (
    <div onClick={onOpen} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ background: C.card, border: `1px solid ${C.line}`, borderLeft: `3px solid ${priorityColor[t.priority] || C.lineStrong}`, borderRadius: C.radiusSm, padding: '10px 12px', cursor: 'pointer', boxShadow: hover ? C.shadow : 'none', display: 'grid', gap: 4 }}>
      <div style={{ fontSize: 13, fontWeight: 500 }}>{t.title}</div>
      {t.description && <div style={{ fontSize: 12, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.description}</div>}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12, color: C.muted, flexWrap: 'wrap' }}>
        <span>{t.assignee?.full_name || '—'}</span>
        {t.due_date && <span>{dateRu(t.due_date)}</span>}
        {t.letter_id && (
          <button type="button" onClick={e => { e.stopPropagation(); go('/letters') }}
            style={{ border: 0, background: 'none', padding: 0, font: 'inherit', fontSize: 11, color: C.violet, cursor: 'pointer' }}>письмо</button>
        )}
      </div>
    </div>
  )
}

function TasksBoard({ sourceFilter }: { sourceFilter?: string }) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [staff, setStaff] = useState<Staff[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<Task | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [newStatus, setNewStatus] = useState<Task['status']>('todo')

  useEffect(() => { fetchAll() }, [sourceFilter])

  async function fetchAll() {
    setLoading(true)
    setError('')
    let q = supabase.from('tasks').select('*, assignee:staff(full_name)').order('due_date', { ascending: true })
    if (sourceFilter) q = (q as any).eq('source', sourceFilter)
    const [t, s] = await Promise.all([
      q,
      supabase.from('staff').select('id, full_name').eq('status', 'active').order('full_name'),
    ])
    const err = t.error || s.error
    if (err) setError(err.message)
    setTasks(t.data || [])
    setStaff(s.data || [])
    setLoading(false)
  }

  function openNew(status: Task['status']) {
    setSelected(null)
    setNewStatus(status)
    setShowModal(true)
  }

  const defaultTask = { ...emptyTask, status: newStatus, ...(sourceFilter ? { source: sourceFilter } : {}) }

  return (
    <>
      <Row justify="flex-end">
        <Button kind="primary" onClick={() => openNew('todo')}>Новая задача</Button>
      </Row>

      {error && <ErrorBox error={error} onRetry={fetchAll} />}

      {loading ? <Loading /> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12, alignItems: 'start' }}>
          {statusCols.map(col => {
            const colTasks = tasks.filter(t => t.status === col.key)
            return (
              <section key={col.key} style={{ background: col.bg, border: `1px solid ${C.line}`, borderRadius: C.radius, padding: 12, display: 'grid', gap: 8 }}>
                <Row justify="space-between" wrap={false}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: col.color, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {col.label} <Badge>{colTasks.length}</Badge>
                  </div>
                  <Button small kind="ghost" onClick={() => openNew(col.key)} aria-label={'Новая задача: ' + col.label}>Добавить</Button>
                </Row>
                {colTasks.length === 0 && <div style={{ fontSize: 12, color: C.faint, padding: '4px 0' }}>Задач нет</div>}
                {colTasks.map(t => <TaskCard key={t.id} t={t} onOpen={() => { setSelected(t); setShowModal(true) }} />)}
              </section>
            )
          })}
        </div>
      )}

      {showModal && (
        <TaskModal
          task={selected || (defaultTask as any)}
          staff={staff}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); fetchAll() }}
        />
      )}
    </>
  )
}

export default function TasksPage() {
  return <Page><TasksBoard /></Page>
}

export function MyTasksPage() {
  return (
    <Page>
      <Muted>Личные задачи — созданы сотрудниками</Muted>
      <TasksBoard sourceFilter="EMPLOYEE" />
    </Page>
  )
}
