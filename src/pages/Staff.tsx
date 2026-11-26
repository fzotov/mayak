import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { sb, useSb, useAction, QueryState } from '../lib/query'
import type { Tables } from '../lib/database.types'
import { C, Page, Row, Button, Badge, Field, Input, Select, Textarea, Segmented, Modal, Notice, money, type Tone } from '../components/ui'

type Staff = Tables<'staff'>

/** Поля формы: в базе они могут быть пустыми (null), в форме — пустая строка / 0. */
interface StaffForm {
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

const empty: StaffForm = {
  full_name: '', position: '', phone: '', email: '',
  salary: 0, role: 'staff', status: 'active', passport: '', notes: ''
}

const roleLabel: Record<string, string> = { admin: 'Администратор', manager: 'Менеджер', staff: 'Сотрудник' }
const roleTone: Record<string, Tone> = { admin: 'violet', manager: 'blue', staff: 'neutral' }

function StaffModal({ s, onClose, onSaved }: { s: Staff | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<StaffForm>(s ? {
    full_name: s.full_name, position: s.position ?? '', phone: s.phone ?? '', email: s.email ?? '',
    salary: s.salary ?? 0, role: s.role ?? 'staff', status: s.status ?? 'active', passport: s.passport ?? '', notes: s.notes ?? '',
  } : { ...empty })
  const [err, setErr] = useState('')
  const [confirmFire, setConfirmFire] = useState(false)
  const set = <K extends keyof StaffForm>(k: K, v: StaffForm[K]) => setForm(f => ({ ...f, [k]: v }))

  const saveA = useAction(async (f: StaffForm) => {
    if (s?.id) await sb(supabase.from('staff').update(f).eq('id', s.id))
    else await sb(supabase.from('staff').insert(f))
  }, { invalidate: ['staff'], onSuccess: onSaved })
  const fireA = useAction(async (id: string) => {
    await sb(supabase.from('staff').update({ status: 'fired' }).eq('id', id))
  }, { invalidate: ['staff'], onSuccess: onSaved })
  const saving = saveA.isPending

  function save() {
    if (!form.full_name.trim()) { setErr('Введите ФИО'); return }
    setErr('')
    saveA.mutate(form)
  }

  function dismiss() {
    if (!s?.id) return
    setErr('')
    fireA.mutate(s.id, { onError: () => setConfirmFire(false) })
  }

  const footer = confirmFire ? (
    <Row>
      <span style={{ color: C.muted, fontSize: 13 }}>Отметить сотрудника уволенным?</span>
      <Button onClick={() => setConfirmFire(false)}>Нет</Button>
      <Button kind="danger" onClick={dismiss}>Уволить</Button>
    </Row>
  ) : (
    <>
      {s && <Button kind="danger" onClick={() => setConfirmFire(true)} style={{ marginRight: 'auto' }}>Уволить</Button>}
      <Button onClick={onClose}>Отмена</Button>
      <Button kind="primary" onClick={save} disabled={saving}>{saving ? 'Сохранение…' : 'Сохранить'}</Button>
    </>
  )

  return (
    <Modal title={s ? 'Редактировать' : 'Новый сотрудник'} onClose={onClose} footer={footer}>
      <Field label="ФИО *"><Input value={form.full_name} onChange={e => set('full_name', e.target.value)} placeholder="Иванов Иван Иванович" /></Field>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
        <Field label="Должность"><Input value={form.position} onChange={e => set('position', e.target.value)} placeholder="Менеджер" /></Field>
        <Field label="Роль в системе">
          <Select value={form.role} onChange={e => set('role', e.target.value)}>
            <option value="staff">Сотрудник</option>
            <option value="manager">Менеджер</option>
            <option value="admin">Администратор</option>
          </Select>
        </Field>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
        <Field label="Телефон"><Input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+7 900 000 00 00" /></Field>
        <Field label="Email"><Input value={form.email} onChange={e => set('email', e.target.value)} placeholder="ivan@example.com" /></Field>
      </div>
      <Field label="Зарплата / ставка (₽)"><Input type="number" value={form.salary || ''} onChange={e => set('salary', Number(e.target.value))} placeholder="50000" /></Field>
      <Field label="Паспорт (серия и номер)"><Input value={form.passport} onChange={e => set('passport', e.target.value)} placeholder="4500 123456" /></Field>
      <Field label="Заметки"><Textarea value={form.notes} onChange={e => set('notes', e.target.value)} style={{ minHeight: 70 }} /></Field>
      {err && <Notice tone="red">{err}</Notice>}
      {saveA.error && <Notice tone="red">Ошибка сохранения: {saveA.error}</Notice>}
      {fireA.error && <Notice tone="red">Ошибка: {fireA.error}</Notice>}
    </Modal>
  )
}

function StaffCard({ s, onClick }: { s: Staff; onClick: () => void }) {
  const [hover, setHover] = useState(false)
  const initials = s.full_name.split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('')
  return (
    <div onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ background: C.card, border: `1px solid ${hover ? C.lineStrong : C.line}`, borderRadius: C.radius, padding: '14px 16px', cursor: 'pointer', boxShadow: hover ? C.shadow : 'none', transition: 'box-shadow .15s, border-color .15s' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div style={{ width: 38, height: 38, borderRadius: '50%', background: C.accentBg, color: C.accent, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>{initials}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.full_name}</div>
          <div style={{ fontSize: 12, color: C.muted }}>{s.position || '—'}</div>
        </div>
        {s.status === 'fired' && <Badge tone="red">Уволен</Badge>}
      </div>
      <div style={{ fontSize: 13, color: C.muted, display: 'flex', flexDirection: 'column', gap: 3 }}>
        {s.phone && <span>{s.phone}</span>}
        {s.email && <span>{s.email}</span>}
        {(s.salary ?? 0) > 0 && <span>{money(s.salary)}</span>}
      </div>
      <div style={{ marginTop: 10 }}>
        <Badge tone={roleTone[s.role ?? ''] || 'neutral'}>{roleLabel[s.role ?? ''] || s.role}</Badge>
      </div>
    </div>
  )
}

export default function StaffPage() {
  const [selected, setSelected] = useState<Staff | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [filter, setFilter] = useState<'active' | 'fired' | 'all'>('active')

  const staffQ = useSb(['staff', filter], () => {
    let q = supabase.from('staff').select('*').order('full_name')
    if (filter !== 'all') q = q.eq('status', filter)
    return sb(q)
  })

  return (
    <Page>
      <Row justify="space-between">
        <Segmented<'active' | 'fired' | 'all'> options={[['active', 'Активные'], ['fired', 'Уволенные'], ['all', 'Все']]} value={filter} onChange={setFilter} />
        <Button kind="primary" onClick={() => { setSelected(null); setShowModal(true) }}>Добавить сотрудника</Button>
      </Row>

      <QueryState q={staffQ} empty="Сотрудников нет">{staff => (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
          {staff.map(s => <StaffCard key={s.id} s={s} onClick={() => { setSelected(s); setShowModal(true) }} />)}
        </div>
      )}</QueryState>

      {showModal && <StaffModal s={selected} onClose={() => setShowModal(false)} onSaved={() => setShowModal(false)} />}
    </Page>
  )
}
