// Письма: входящие и исходящие, распознавание загруженного письма и генерация текста через AI, задача по входящему письму.
import { ask } from '../components/Dialogs'
import { apiFetch } from '../lib/api'
import { useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { sb, useSb, useAction, QueryState } from '../lib/query'
import type { Tables } from '../lib/database.types'
import {
  Page, Card, Row, Button, Badge, Table, Field, Input, Select, Textarea, Modal, Notice, Muted, dateRu, C, type Tone,
} from '../components/ui'

type Letter = Tables<'letters'>
/** Письмо, по которому создаётся задача (только что сохранённое). */
interface LetterForTask { id: string; subject: string; ai_action: string; ai_summary: string }
/** Ответ /api/process-letter: распознанные поля письма. */
interface ParsedLetter { subject?: string; sender?: string; recipient?: string; date?: string; body?: string; summary?: string; action?: string }

const statusLabel: Record<string, { label: string; tone: Tone }> = {
  draft: { label: 'Черновик', tone: 'neutral' },
  sent: { label: 'Отправлено', tone: 'blue' },
  received: { label: 'Получено', tone: 'green' },
  processed: { label: 'Обработано', tone: 'violet' },
}

const two: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }
const noop = () => {}

function TaskFromLetterModal({ letter, onClose, onSaved }: { letter: LetterForTask; onClose: () => void; onSaved: () => void }) {
  const staffQ = useSb(['staff', 'active-names'], () => sb(supabase.from('staff').select('id, full_name').eq('status', 'active').order('full_name')))
  const staff = staffQ.data ?? []
  const [title, setTitle] = useState('Ответить на письмо: ' + (letter.subject || ''))
  const [description, setDescription] = useState(letter.ai_action || letter.ai_summary || '')
  const [assigneeId, setAssigneeId] = useState('')
  const [priority, setPriority] = useState('normal')
  const [dueDate, setDueDate] = useState('')
  const [error, setError] = useState('')
  const createA = useAction(async () => {
    await sb(supabase.from('tasks').insert({ title, description, assignee_id: assigneeId || null, status: 'todo', priority, due_date: dueDate || null, letter_id: letter.id }))
  }, { invalidate: ['tasks'], onSuccess: onSaved })
  const saving = createA.isPending

  function save() {
    if (!title.trim()) { setError('Введите заголовок'); return }
    setError('')
    createA.mutate(undefined)
  }

  return (
    <Modal title="Создать задачу по письму" onClose={onClose} footer={<>
      <Button onClick={onClose}>Пропустить</Button>
      <Button kind="primary" onClick={save} disabled={saving}>{saving ? 'Создание…' : 'Создать задачу'}</Button>
    </>}>
      <Notice tone="green">Письмо зарегистрировано. Создайте задачу для ответа.</Notice>
      {error && <Notice tone="red">{error}</Notice>}
      {createA.error && <Notice tone="red">Задача не создана: {createA.error}</Notice>}
      <Field label="Задача"><Input value={title} onChange={e => setTitle(e.target.value)} /></Field>
      <Field label="Описание"><Textarea style={{ height: 70, resize: 'none' }} value={description} onChange={e => setDescription(e.target.value)} /></Field>
      <div style={two}>
        <Field label="Исполнитель">
          <Select value={assigneeId} onChange={e => setAssigneeId(e.target.value)}>
            <option value="">Не назначен</option>
            {staff.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
          </Select>
        </Field>
        <Field label="Приоритет">
          <Select value={priority} onChange={e => setPriority(e.target.value)}>
            <option value="low">Низкий</option>
            <option value="normal">Обычный</option>
            <option value="high">Высокий</option>
          </Select>
        </Field>
      </div>
      <Field label="Срок ответа"><Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} /></Field>
    </Modal>
  )
}

function PromptModal({ onClose, onGenerate }: { onClose: () => void; onGenerate: (prompt: string) => void }) {
  const [prompt, setPrompt] = useState('')
  return (
    <Modal title="Генерация письма AI" onClose={onClose} width={500} footer={<>
      <Button onClick={onClose}>Отмена</Button>
      <Button kind="primary" onClick={() => onGenerate(prompt)} disabled={!prompt.trim()}>Сгенерировать</Button>
    </>}>
      <Muted>Опишите подробно содержание письма — тон, ключевые моменты, требования, сроки.</Muted>
      <Textarea
        style={{ height: 140 }}
        placeholder="Например: письмо-напоминание об оплате аренды за июнь, срок оплаты был 5 числа, прошло уже 10 дней, попросить оплатить в течение 3 дней иначе будут начислены пени согласно договору"
        value={prompt}
        onChange={e => setPrompt(e.target.value)}
        autoFocus
      />
    </Modal>
  )
}

interface LetterForm { type: string; status: string; subject: string; body: string; sender: string; recipient: string; date: string; ai_summary: string; ai_action: string }

function LetterModal({ letter, onClose, onSaved }: { letter: Letter | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<LetterForm>({
    type: letter?.type || 'outgoing',
    status: letter?.status || 'draft',
    subject: letter?.subject || '',
    body: letter?.body || '',
    sender: letter?.sender || '',
    recipient: letter?.recipient || '',
    date: letter?.date || new Date().toISOString().slice(0, 10),
    ai_summary: letter?.ai_summary || '',
    ai_action: letter?.ai_action || '',
  })
  const [generating, setGenerating] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [showPrompt, setShowPrompt] = useState(false)
  const [savedLetter, setSavedLetter] = useState<LetterForTask | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const set = (k: keyof LetterForm, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function generateLetter(prompt: string) {
    setShowPrompt(false)
    setGenerating(true)
    setError('')
    try {
      const res = await apiFetch('/api/generate-letter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: form.subject, recipient: form.recipient, sender: form.sender, prompt }),
      })
      const data: { text?: string } = await res.json()
      const text = data.text || ''
      if (!text) throw new Error('empty')
      set('body', text)
    } catch {
      setError('Ошибка генерации')
    }
    setGenerating(false)
  }

  async function processFile() {
    if (!file) return
    setProcessing(true)
    setError('')
    try {
      const base64 = await new Promise<string>((res) => {
        const reader = new FileReader()
        reader.onload = () => res((reader.result as string).split(',')[1])
        reader.readAsDataURL(file)
      })
      const res = await apiFetch('/api/process-letter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64, mediaType: file.type }),
      })
      const parsed: ParsedLetter = await res.json()
      if (parsed.subject) set('subject', parsed.subject)
      if (parsed.sender) set('sender', parsed.sender)
      if (parsed.recipient) set('recipient', parsed.recipient)
      if (parsed.date) set('date', parsed.date)
      if (parsed.body) set('body', parsed.body)
      if (parsed.summary) set('ai_summary', parsed.summary)
      if (parsed.action) set('ai_action', parsed.action)
      set('type', 'incoming')
      set('status', 'received')
    } catch {
      setError('Ошибка обработки файла')
    }
    setProcessing(false)
  }

  const saveA = useAction(async (f: LetterForm): Promise<string | null> => {
    if (letter?.id) {
      await sb(supabase.from('letters').update(f).eq('id', letter.id))
      return null
    }
    const row = await sb(supabase.from('letters').insert({ ...f }).select('id').single())
    return row.id
  }, {
    invalidate: ['letters'],
    onSuccess: (newId, f) => {
      // Если входящее письмо — предлагаем создать задачу
      if (newId && f.type === 'incoming') setSavedLetter({ id: newId, subject: f.subject, ai_action: f.ai_action, ai_summary: f.ai_summary })
      else onSaved()
    },
  })
  const removeA = useAction(async (id: string) => {
    await sb(supabase.from('letters').delete().eq('id', id))
  }, { invalidate: ['letters'], onSuccess: onSaved })
  const saving = saveA.isPending

  function save() {
    if (!form.subject) { setError('Введите тему'); return }
    setError('')
    saveA.mutate(form)
  }

  async function remove() {
    if (!letter?.id || !(await ask('Удалить письмо?', { ok: 'Удалить', danger: true }))) return
    removeA.mutate(letter.id)
  }

  if (savedLetter) return <TaskFromLetterModal letter={savedLetter} onClose={onSaved} onSaved={onSaved} />

  const fileName = file ? (file.name.length > 30 ? file.name.slice(0, 30) + '…' : file.name) : ''

  return (
    <>
      {/* Пока открыто окно генерации, Esc закрывает только его. */}
      <Modal title={letter ? 'Письмо' : 'Новое письмо'} onClose={showPrompt ? noop : onClose} width={680} footer={<>
        {letter && <Button kind="danger" onClick={remove} style={{ marginRight: 'auto' }}>Удалить</Button>}
        <Button onClick={onClose}>Отмена</Button>
        <Button kind="primary" onClick={save} disabled={saving}>{saving ? 'Сохранение…' : 'Сохранить'}</Button>
      </>}>
        <div style={{ background: C.card2, border: `2px dashed ${C.line}`, borderRadius: C.radiusSm, padding: 16, textAlign: 'center', display: 'grid', gap: 8 }}>
          <Muted>Загрузить входящее письмо (PDF, фото)</Muted>
          <input ref={fileRef} type="file" accept=".pdf,image/*" style={{ display: 'none' }} onChange={e => setFile(e.target.files?.[0] || null)} />
          <Row gap={8} justify="center">
            <Button onClick={() => fileRef.current?.click()}>{file ? fileName : 'Выбрать файл'}</Button>
            {file && (
              <Button kind="primary" onClick={processFile} disabled={processing}>{processing ? 'Обработка…' : 'Обработать AI'}</Button>
            )}
          </Row>
        </div>

        {error && <Notice tone="red">{error}</Notice>}
        {saveA.error && <Notice tone="red">Ошибка: {saveA.error}</Notice>}
        {removeA.error && <Notice tone="red">Ошибка удаления: {removeA.error}</Notice>}

        <div style={two}>
          <Field label="Тип">
            <Select value={form.type} onChange={e => set('type', e.target.value)}>
              <option value="outgoing">Исходящее</option>
              <option value="incoming">Входящее</option>
            </Select>
          </Field>
          <Field label="Статус">
            <Select value={form.status} onChange={e => set('status', e.target.value)}>
              <option value="draft">Черновик</option>
              <option value="sent">Отправлено</option>
              <option value="received">Получено</option>
              <option value="processed">Обработано</option>
            </Select>
          </Field>
        </div>

        <Field label="Тема *"><Input value={form.subject} onChange={e => set('subject', e.target.value)} placeholder="Уведомление об изменении арендной ставки" /></Field>

        <div style={two}>
          <Field label="От кого"><Input value={form.sender} onChange={e => set('sender', e.target.value)} placeholder="Администрация БЦ Маяк" /></Field>
          <Field label="Кому"><Input value={form.recipient} onChange={e => set('recipient', e.target.value)} placeholder="ООО Техцентр" /></Field>
        </div>

        <Field label="Дата"><Input type="date" value={form.date} onChange={e => set('date', e.target.value)} /></Field>

        <div style={{ display: 'grid', gap: 4 }}>
          <Row justify="space-between">
            <span style={{ fontSize: 12, color: C.muted, fontWeight: 500 }}>Текст письма</span>
            {form.type === 'outgoing' && (
              <Button small onClick={() => setShowPrompt(true)} disabled={generating}>{generating ? 'Генерация…' : 'Сгенерировать AI'}</Button>
            )}
          </Row>
          <Textarea style={{ height: 180 }} value={form.body} onChange={e => set('body', e.target.value)} placeholder="Текст письма…" aria-label="Текст письма" />
        </div>

        {(form.ai_summary || form.ai_action) && (
          <div style={{ background: C.violetBg, borderRadius: C.radiusSm, padding: 12, display: 'grid', gap: 4, fontSize: 13 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.violet }}>AI анализ</div>
            {form.ai_summary && <div><b>Резюме:</b> {form.ai_summary}</div>}
            {form.ai_action && <div><b>Требуемое действие:</b> {form.ai_action}</div>}
          </div>
        )}
      </Modal>
      {showPrompt && <PromptModal onClose={() => setShowPrompt(false)} onGenerate={generateLetter} />}
    </>
  )
}

export default function LettersPage() {
  const [selected, setSelected] = useState<Letter | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const lettersQ = useSb(['letters'], () => sb(supabase.from('letters').select('*').order('date', { ascending: false })))
  const letters = lettersQ.data ?? []

  const filtered = letters.filter(l => {
    if (typeFilter && l.type !== typeFilter) return false
    if (statusFilter && l.status !== statusFilter) return false
    return true
  })

  return (
    <Page>
      <Row gap={8}>
        <Select style={{ width: 'auto' }} value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="">Все типы</option>
          <option value="incoming">Входящие</option>
          <option value="outgoing">Исходящие</option>
        </Select>
        <Select style={{ width: 'auto' }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">Все статусы</option>
          <option value="draft">Черновик</option>
          <option value="sent">Отправлено</option>
          <option value="received">Получено</option>
          <option value="processed">Обработано</option>
        </Select>
        <div style={{ flex: 1 }} />
        <Button kind="primary" onClick={() => { setSelected(null); setShowModal(true) }}>Новое письмо</Button>
      </Row>

      <Card pad={false}>
        <QueryState q={lettersQ}>{() => (
          <Table rows={filtered} rowKey={l => l.id} onRow={l => { setSelected(l); setShowModal(true) }} empty="Писем не найдено" cols={[
            { key: 't', title: 'Тип', sort: l => l.type, render: l => <Badge tone={l.type === 'incoming' ? 'green' : 'blue'}>{l.type === 'incoming' ? 'Входящее' : 'Исходящее'}</Badge> },
            { key: 'd', title: 'Дата', sort: l => l.date || null, render: l => <span style={{ color: C.muted, whiteSpace: 'nowrap' }}>{dateRu(l.date)}</span> },
            { key: 's', title: 'Тема', sort: l => l.subject || null, render: l => <span style={{ fontWeight: 500 }}>{l.subject || '—'}</span> },
            { key: 'w', title: 'От / кому', render: l => <span style={{ color: C.muted }}>{l.type === 'incoming' ? l.sender : l.recipient}</span> },
            { key: 'st', title: 'Статус', sort: l => l.status, render: l => { const s = statusLabel[l.status ?? ''] || statusLabel.draft; return <Badge tone={s.tone}>{s.label}</Badge> } },
            { key: 'ai', title: 'AI резюме', render: l => (
              <div style={{ color: C.faint, fontSize: 12, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.ai_summary || '—'}</div>
            ) },
          ]} />
        )}</QueryState>
      </Card>

      {showModal && <LetterModal letter={selected} onClose={() => setShowModal(false)} onSaved={() => setShowModal(false)} />}
    </Page>
  )
}
