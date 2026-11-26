// Задачи: доска «К выполнению · В работе · Готово». «Мои задачи» — та же доска по задачам, созданным сотрудниками.
import { useState } from 'react'
import { go } from '../lib/nav'
import { supabase } from '../lib/supabase'
import { useSb, useAction, sb, QueryState } from '../lib/query'
import type { Tables, TablesInsert } from '../lib/database.types'
import { Page, Row, Button, Badge, Field, Input, Select, Textarea, Modal, Notice, ErrorBox, Muted, dateRu, C } from '../components/ui'
import { ask } from '../components/Dialogs'

type TaskStatus = 'todo' | 'in_progress' | 'done'

/** Строка задачи с исполнителем из выборки '*, assignee:staff(full_name)'. */
type Task = Tables<'tasks'> & { assignee: { full_name: string } | null }

/** Поля формы: пустые строки вместо null, чтобы поля ввода были управляемыми. */
interface TaskForm {
  title: string
  description: string
  assignee_id: string | null
  status: string
  priority: string
  due_date: string
  source: string | null
}

type Staff = Pick<Tables<'staff'>, 'id' | 'full_name'>

const statusCols: { key: TaskStatus; label: string; color: string; bg: string }[] = [
  { key: 'todo', label: 'К выполнению', color: C.muted, bg: C.card2 },
  { key: 'in_progress', label: 'В работе', color: C.amber, bg: C.amberBg },
  { key: 'done', label: 'Готово', color: C.green, bg: C.greenBg },
]

const priorityColor: Record<string, string> = { high: C.red, normal: C.amber, low: C.lineStrong }

const emptyTask: TaskForm = { title: '', description: '', assignee_id: null, status: 'todo', priority: 'normal', due_date: '', source: null }

const toForm = (t: Task): TaskForm => ({
  title: t.title, description: t.description ?? '', assignee_id: t.assignee_id, status: t.status ?? 'todo',
  priority: t.priority ?? 'normal', due_date: t.due_date ?? '', source: t.source,
})

const two: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }

function TaskModal({ task, initial, staff, onClose, onSaved }: { task: Task | null; initial: TaskForm; staff: Staff[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<TaskForm>(task ? toForm(task) : { ...initial })
  const [error, setError] = useState('')
  const set = <K extends keyof TaskForm>(k: K, v: TaskForm[K]) => setForm(f => ({ ...f, [k]: v }))
  const isEdit = !!task
  const saveAction = useAction(async (f: TaskForm) => {
    // Пустой срок и описание — null, иначе база отклоняет запись.
    // source пишется только если задан (у «Моих задач»), иначе остаётся значение по умолчанию базы.
    const { source, ...rest } = f
    const payload: TablesInsert<'tasks'> = { ...rest, description: rest.description || null, due_date: rest.due_date || null, ...(source ? { source } : {}) }
    if (task) await sb(supabase.from('tasks').update(payload).eq('id', task.id))
    else await sb(supabase.from('tasks').insert(payload))
  }, { invalidate: ['tasks'], onSuccess: onSaved })
  const removeAction = useAction(async (id: string) => { await sb(supabase.from('tasks').delete().eq('id', id)) }, { invalidate: ['tasks'], onSuccess: onSaved })
  const saving = saveAction.isPending

  function save() {
    if (!form.title.trim()) { setError('Введите заголовок'); return }
    setError('')
    saveAction.mutate(form)
  }

  async function remove() {
    if (!task || !(await ask('Удалить задачу?', { ok: 'Удалить', danger: true }))) return
    removeAction.mutate(task.id)
  }

  return (
    <Modal title={isEdit ? 'Редактировать задачу' : 'Новая задача'} onClose={onClose} width={460} footer={<>
      {isEdit && <Button kind="danger" onClick={remove} style={{ marginRight: 'auto' }}>Удалить</Button>}
      <Button onClick={onClose}>Отмена</Button>
      <Button kind="primary" onClick={save} disabled={saving}>{saving ? 'Сохранение…' : 'Сохранить'}</Button>
    </>}>
      {error && <Notice tone="red">{error}</Notice>}
      {saveAction.error && <Notice tone="red">Ошибка сохранения: {saveAction.error}</Notice>}
      {removeAction.error && <Notice tone="red">Ошибка удаления: {removeAction.error}</Notice>}
      <Field label="Заголовок *"><Input value={form.title} onChange={e => set('title', e.target.value)} placeholder="Что нужно сделать?" autoFocus /></Field>
      <Field label="Описание"><Textarea style={{ height: 70, resize: 'none' }} value={form.description} onChange={e => set('description', e.target.value)} /></Field>
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
        <Field label="Срок"><Input type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)} /></Field>
      </div>
    </Modal>
  )
}

function TaskCard({ t, onOpen }: { t: Task; onOpen: () => void }) {
  const [hover, setHover] = useState(false)
  return (
    <div onClick={onOpen} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ background: C.card, border: `1px solid ${C.line}`, borderLeft: `3px solid ${priorityColor[t.priority ?? ''] || C.lineStrong}`, borderRadius: C.radiusSm, padding: '10px 12px', cursor: 'pointer', boxShadow: hover ? C.shadow : 'none', display: 'grid', gap: 4 }}>
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
  const [selected, setSelected] = useState<Task | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [newStatus, setNewStatus] = useState<TaskStatus>('todo')

  const tasksQ = useSb(['tasks', sourceFilter ?? 'all'], () => {
    let q = supabase.from('tasks').select('*, assignee:staff(full_name)')
    if (sourceFilter) q = q.eq('source', sourceFilter)
    return sb(q.order('due_date', { ascending: true }))
  })
  const staffQ = useSb(['staff', 'active'], () => sb(supabase.from('staff').select('id, full_name').eq('status', 'active').order('full_name')))
  const staff: Staff[] = staffQ.data ?? []

  function openNew(status: TaskStatus) {
    setSelected(null)
    setNewStatus(status)
    setShowModal(true)
  }

  const defaultTask: TaskForm = { ...emptyTask, status: newStatus, source: sourceFilter ?? null }

  return (
    <>
      <Row justify="flex-end">
        <Button kind="primary" onClick={() => openNew('todo')}>Новая задача</Button>
      </Row>

      {staffQ.error && <ErrorBox error={staffQ.error.message} onRetry={() => staffQ.refetch()} />}

      <QueryState q={tasksQ}>{tasks => (
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
      )}</QueryState>

      {showModal && (
        <TaskModal
          task={selected}
          initial={defaultTask}
          staff={staff}
          onClose={() => setShowModal(false)}
          onSaved={() => setShowModal(false)}
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
