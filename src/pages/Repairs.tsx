// Заявки на ремонт: список с фильтрами, аварийные, карточка заявки с обработкой и историей статусов.
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import {
  Page, Card, Row, Button, Badge, Stat, Stats, Table, Field, Input, Select, Textarea, Segmented, Tabs, Modal, Notice,
  Loading, ErrorBox, Empty, Sub, dateRu, dateTimeRu, C, type Tone,
} from '../components/ui'

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

const CATEGORIES = ['Электрика', 'Сантехника', 'Отопление', 'Интернет', 'Уборка', 'Другое']
const PRIORITIES: Record<string, { label: string; tone: Tone }> = {
  low:       { label: 'Низкий',    tone: 'neutral' },
  medium:    { label: 'Средний',   tone: 'amber' },
  high:      { label: 'Высокий',   tone: 'violet' },
  emergency: { label: 'Аварийный', tone: 'red' },
}
const STATUSES: Record<string, { label: string; tone: Tone }> = {
  new:         { label: 'Новая',     tone: 'neutral' },
  accepted:    { label: 'Принята',   tone: 'blue' },
  in_progress: { label: 'В работе',  tone: 'amber' },
  completed:   { label: 'Выполнена', tone: 'green' },
  rejected:    { label: 'Отклонена', tone: 'red' },
}
const TONE_COLOR: Record<Tone, string> = { neutral: C.lineStrong, green: C.green, red: C.red, amber: C.amber, blue: C.accent, violet: C.violet }

function PriorityBadge({ p }: { p: string }) {
  const d = PRIORITIES[p] || PRIORITIES.medium
  return <Badge tone={d.tone}>{d.label}</Badge>
}

function StatusBadge({ s }: { s: string }) {
  const d = STATUSES[s] || STATUSES.new
  return <Badge tone={d.tone}>{d.label}</Badge>
}

/** Подзаголовок раздела внутри окна. */
function Section({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: `1px solid ${C.line}`, paddingBottom: 6 }}>{children}</div>
}

const two: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }

// ─── Карточка заявки ─────────────────────────────────────────────────────────

function RepairModal({ repair, units, staff, onClose, onSaved, initialPriority }: {
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
    priority: repair?.priority || initialPriority || 'medium',
    description: repair?.description || '',
    status: repair?.status || 'new',
    assignee_id: repair?.assignee_id || '',
    due_date: repair?.due_date || '',
    completed_date: repair?.completed_date || '',
    cost: repair?.cost || 0,
    comment: repair?.comment || '',
  })
  const [history, setHistory] = useState<RepairHistory[] | null>(null)
  const [historyError, setHistoryError] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const set = (k: string, v: string | number) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    if (repair?.id && tab === 'history') loadHistory()
  }, [tab])

  async function loadHistory() {
    setHistoryError('')
    const { data, error } = await supabase.from('repair_history').select('*')
      .eq('repair_id', repair!.id).order('created_at', { ascending: false })
    if (error) setHistoryError(error.message)
    setHistory(data || [])
  }

  async function save() {
    if (!form.description.trim()) { setTab('info'); setError('Введите описание проблемы'); return }
    setError('')
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
      // Запись в историю, если статус изменился
      if (form.status !== repair.status) {
        await supabase.from('repair_history').insert({
          repair_id: repair.id, status: form.status, comment: form.comment || null,
        })
      }
      const { error } = await supabase.from('repairs').update(payload).eq('id', repair.id)
      if (error) { setError('Ошибка: ' + error.message); setSaving(false); return }
    } else {
      const { error } = await supabase.from('repairs').insert(payload)
      if (error) { setError('Ошибка: ' + error.message); setSaving(false); return }
    }
    setSaving(false)
    onSaved()
  }

  async function remove() {
    if (!repair?.id || !confirm('Удалить заявку?')) return
    const { error } = await supabase.from('repairs').delete().eq('id', repair.id)
    if (error) { setError('Ошибка: ' + error.message); return }
    onSaved()
  }

  const title = repair ? `Заявка №${repair.number} от ${dateRu(repair.created_at)}` : 'Новая заявка'

  return (
    <Modal title={title} onClose={onClose} width={600} footer={<>
      {repair && tab !== 'history' && <Button kind="danger" onClick={remove} style={{ marginRight: 'auto' }}>Удалить</Button>}
      <Button onClick={onClose}>Закрыть</Button>
      {tab !== 'history' && <Button kind="primary" onClick={save} disabled={saving}>{saving ? 'Сохранение…' : 'Сохранить'}</Button>}
    </>}>
      {form.priority === 'emergency' && <div><Badge tone="red">Аварийная</Badge></div>}
      <Tabs<'info' | 'process' | 'history'> value={tab} onChange={setTab} tabs={[['info', 'Заявка'], ['process', 'Обработка'], ['history', 'История']]} />
      {error && <Notice tone="red">{error}</Notice>}

      {tab === 'info' && <>
        <div style={two}>
          <Field label="Помещение">
            <Select value={form.unit_id} onChange={e => set('unit_id', e.target.value)}>
              <option value="">Не указано</option>
              {units.map(u => <option key={u.id} value={u.id}>{u.number}</option>)}
            </Select>
          </Field>
          <Field label="Категория">
            <Select value={form.category} onChange={e => set('category', e.target.value)}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </Select>
          </Field>
        </div>
        <div style={{ display: 'grid', gap: 4 }}>
          <div style={{ fontSize: 12, color: C.muted, fontWeight: 500 }}>Приоритет</div>
          <div><Segmented<string> value={form.priority} onChange={k => set('priority', k)} options={Object.entries(PRIORITIES).map(([k, v]) => [k, v.label])} /></div>
        </div>
        <Field label="Описание проблемы *">
          <Textarea style={{ height: 100, resize: 'none' }} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Подробно опишите проблему…" />
        </Field>
      </>}

      {tab === 'process' && <>
        <Section>Назначение</Section>
        <div style={two}>
          <Field label="Статус">
            <Select value={form.status} onChange={e => set('status', e.target.value)}>
              {Object.entries(STATUSES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </Select>
          </Field>
          <Field label="Исполнитель">
            <Select value={form.assignee_id} onChange={e => set('assignee_id', e.target.value)}>
              <option value="">Не назначен</option>
              {staff.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
            </Select>
          </Field>
        </div>
        <div style={two}>
          <Field label="Плановый срок">
            <Input type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)} />
          </Field>
          <Field label="Дата выполнения (факт)">
            <Input type="date" value={form.completed_date} onChange={e => set('completed_date', e.target.value)} />
          </Field>
        </div>
        <Section>Результат</Section>
        <Field label="Стоимость работ, ₽">
          <Input type="number" min={0} value={form.cost || ''} placeholder="0" onChange={e => set('cost', Number(e.target.value))} />
        </Field>
        <Field label="Комментарий исполнителя">
          <Textarea style={{ height: 80, resize: 'none' }} value={form.comment || ''} onChange={e => set('comment', e.target.value)} placeholder="Что было сделано…" />
        </Field>
      </>}

      {tab === 'history' && (
        !repair?.id ? <Empty>Изменений статуса нет</Empty>
          : historyError ? <ErrorBox error={historyError} onRetry={loadHistory} />
          : history === null ? <Loading />
          : history.length === 0 ? <Empty>Изменений статуса нет</Empty>
          : (
            <div style={{ display: 'grid', gap: 8 }}>
              {history.map(h => (
                <div key={h.id} style={{ padding: '10px 12px', background: C.card2, borderRadius: C.radiusSm, borderLeft: `3px solid ${TONE_COLOR[(STATUSES[h.status] || STATUSES.new).tone]}` }}>
                  <Row gap={8}>
                    <StatusBadge s={h.status} />
                    <span style={{ fontSize: 12, color: C.muted }}>{dateTimeRu(h.created_at)}</span>
                  </Row>
                  {h.comment && <div style={{ fontSize: 13, marginTop: 4 }}>{h.comment}</div>}
                </div>
              ))}
            </div>
          )
      )}
    </Modal>
  )
}

// ─── Страница ────────────────────────────────────────────────────────────────

export default function RepairsPage() {
  const [repairs, setRepairs] = useState<Repair[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [staff, setStaff] = useState<Staff[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<Repair | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [initPriority, setInitPriority] = useState('medium')

  // Фильтры
  const [pageTab, setPageTab] = useState<'all' | 'emergency'>('all')
  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [unitFilter, setUnitFilter] = useState('')

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    setError('')
    const [rep, u, s] = await Promise.all([
      supabase.from('repairs').select('*, tenant:tenants(full_name), unit:units(number), assignee:staff(full_name)')
        .order('created_at', { ascending: false }),
      supabase.from('units').select('id, number').order('number'),
      supabase.from('staff').select('id, full_name').eq('status', 'active').order('full_name'),
    ])
    const err = rep.error || u.error || s.error
    if (err) setError(err.message)
    setRepairs(rep.data || [])
    setUnits(u.data || [])
    setStaff(s.data || [])
    setLoading(false)
  }

  function openNew(priority = 'medium') {
    setSelected(null)
    setInitPriority(priority)
    setShowModal(true)
  }

  function openRepair(r: Repair) {
    setSelected(r)
    setShowModal(true)
  }

  // Показатели
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

  // Отфильтрованный список
  const base = pageTab === 'emergency' ? repairs.filter(r => r.priority === 'emergency') : repairs
  const filtered = base.filter(r => {
    if (statusFilter && r.status !== statusFilter) return false
    if (priorityFilter && r.priority !== priorityFilter) return false
    if (catFilter && r.category !== catFilter) return false
    if (unitFilter && r.unit_id !== unitFilter) return false
    return true
  })
  const anyFilter = statusFilter || priorityFilter || catFilter || unitFilter
  const isOverdue = (r: Repair) => !!r.due_date && new Date(r.due_date) < new Date() && r.status !== 'completed'

  return (
    <Page>
      <Stats>
        <Stat label="Всего заявок" value={total} />
        <Stat label="Новые" value={newCount} />
        <Stat label="В работе" value={inProgress} tone="amber" />
        <Stat label="Выполнено" value={completed} tone="green" />
        <Stat label="Среднее время, дней" value={avgDays} tone="blue" />
      </Stats>

      <Row gap={8}>
        <Segmented<'all' | 'emergency'> value={pageTab} onChange={setPageTab} options={[
          ['all', 'Все заявки'],
          ['emergency', <span key="e" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>Аварийные{emergencyOpen > 0 && <Badge tone="red">{emergencyOpen}</Badge>}</span>],
        ]} />
        <div style={{ flex: 1 }} />
        <Button kind="danger" onClick={() => openNew('emergency')}>Аварийная заявка</Button>
        <Button kind="primary" onClick={() => openNew()}>Новая заявка</Button>
      </Row>

      <Row gap={8}>
        <Select style={{ width: 'auto' }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">Все статусы</option>
          {Object.entries(STATUSES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </Select>
        <Select style={{ width: 'auto' }} value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}>
          <option value="">Все приоритеты</option>
          {Object.entries(PRIORITIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </Select>
        <Select style={{ width: 'auto' }} value={catFilter} onChange={e => setCatFilter(e.target.value)}>
          <option value="">Все категории</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </Select>
        <Select style={{ width: 'auto' }} value={unitFilter} onChange={e => setUnitFilter(e.target.value)}>
          <option value="">Все помещения</option>
          {units.map(u => <option key={u.id} value={u.id}>{u.number}</option>)}
        </Select>
        {anyFilter && (
          <Button kind="ghost" onClick={() => { setStatusFilter(''); setPriorityFilter(''); setCatFilter(''); setUnitFilter('') }}>Сбросить</Button>
        )}
      </Row>

      {error && <ErrorBox error={error} onRetry={fetchAll} />}

      <Card pad={false}>
        {loading ? <Loading /> : (
          <Table rows={filtered} rowKey={r => r.id} onRow={openRepair} empty="Заявок не найдено" cols={[
            { key: 'n', title: '№', sort: r => r.number, render: r => (
              <span style={{ fontWeight: 600, paddingLeft: 6, borderLeft: `3px solid ${r.priority === 'emergency' ? C.red : 'transparent'}` }}>{r.number}</span>
            ) },
            { key: 'd', title: 'Дата', sort: r => r.created_at, render: r => <span style={{ color: C.muted, whiteSpace: 'nowrap' }}>{dateRu(r.created_at)}</span> },
            { key: 'u', title: 'Помещение', sort: r => r.unit?.number || null, render: r => r.unit?.number || '—' },
            { key: 'c', title: 'Категория', sort: r => r.category, render: r => <span style={{ whiteSpace: 'nowrap' }}>{r.category}</span> },
            { key: 'desc', title: 'Описание', render: r => (
              <div style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: C.muted }}>
                {r.description.slice(0, 50)}{r.description.length > 50 ? '…' : ''}
              </div>
            ) },
            { key: 'p', title: 'Приоритет', sort: r => ['low', 'medium', 'high', 'emergency'].indexOf(r.priority), render: r => <PriorityBadge p={r.priority} /> },
            { key: 's', title: 'Статус', sort: r => r.status, render: r => <StatusBadge s={r.status} /> },
            { key: 'a', title: 'Исполнитель', sort: r => r.assignee?.full_name || null, render: r => <span style={{ whiteSpace: 'nowrap', color: C.muted }}>{r.assignee?.full_name || '—'}</span> },
            { key: 'due', title: 'Срок', sort: r => r.due_date, render: r => (
              <span style={{ whiteSpace: 'nowrap', color: isOverdue(r) ? C.red : C.muted }}>
                {dateRu(r.due_date)}{isOverdue(r) && <Sub>просрочено</Sub>}
              </span>
            ) },
            { key: 'x', title: '', render: r => (
              <Button small onClick={e => { e.stopPropagation(); openRepair(r) }}>Открыть</Button>
            ) },
          ]} />
        )}
      </Card>

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
    </Page>
  )
}

// ─── Горячие заявки для «Сегодня» ────────────────────────────────────────────

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
