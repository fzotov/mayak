// Склад и инвентарь: товары, приход и расход накладными, выдача сотрудникам, история движений.
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Page, Card, Button, Badge, Table, Field, Input, Select, Textarea, Tabs, Modal, Notice, Loading, Empty, ErrorBox, Stat, Stats, Row, Muted, Sub, money, num, C, type Tone } from '../components/ui'

interface Item {
  id: string
  name: string
  category: string
  description: string
  quantity: number
  quantity_available: number
  location: string
  cost: number
  serial_number: string
  inventory_number: string
  responsible_id: string | null
  supplier: string
  received_at: string
  notes: string
  responsible?: { full_name: string }
}

interface Movement {
  id: string
  item_id: string
  action: string
  quantity: number
  note: string
  created_at: string
  staff_id?: string | null
  staff?: { full_name: string }
  item?: { name: string; inventory_number: string }
}

interface Staff { id: string; full_name: string }

interface InvoiceLine { item_id: string; quantity: number; price: number }

const emptyItem: Omit<Item, 'id' | 'responsible'> = {
  name: '', category: '', description: '', quantity: 1, quantity_available: 1,
  location: '', cost: 0, serial_number: '', inventory_number: '',
  responsible_id: null, supplier: '', received_at: '', notes: ''
}

const ACTION: Record<string, { label: string; tone: Tone; color: string }> = {
  issued: { label: 'Выдано', tone: 'amber', color: C.amber },
  received: { label: 'Приход', tone: 'blue', color: C.accent },
  returned: { label: 'Возврат', tone: 'green', color: C.green },
}
const CAT_TONES: Tone[] = ['blue', 'violet', 'amber', 'green', 'red', 'neutral']

const cols = (tpl: string): React.CSSProperties => ({ display: 'grid', gridTemplateColumns: tpl, gap: 10 })
const colHead: React.CSSProperties = { fontSize: 12, color: C.muted, fontWeight: 500 }
const removeBtn = (disabled: boolean): React.CSSProperties => ({ border: 0, background: 'none', color: C.red, fontSize: 18, cursor: disabled ? 'default' : 'pointer', lineHeight: 1, opacity: disabled ? 0.3 : 1 })

// ─── ItemModal ──────────────────────────────────────────────────────────────

type ItemTab = 'info' | 'movements'

function ItemModal({ item, staff, onClose, onSaved }: { item: Item | null; staff: Staff[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<Omit<Item, 'id' | 'responsible'>>(() => {
    if (!item) return { ...emptyItem }
    // id и вложенный responsible (из join) — не колонки для записи
    const { id: _id, responsible: _r, ...rest } = item
    return rest
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [tab, setTab] = useState<ItemTab>('info')
  const [movements, setMovements] = useState<Movement[] | null>(null)
  const [categories, setCategories] = useState<string[]>([])
  const [newCat, setNewCat] = useState('')
  const [issueQty, setIssueQty] = useState(1)
  const [issueStaff, setIssueStaff] = useState('')
  const [issueNote, setIssueNote] = useState('')

  useEffect(() => {
    supabase.from('inventory_categories').select('name').order('name').then(({ data }) => {
      const cats = (data || []).map((c: any) => c.name)
      setCategories(cats.length > 0 ? cats : ['Мебель', 'Техника', 'Инструменты', 'Канцелярия', 'Хозяйство', 'Другое'])
    })
  }, [])

  useEffect(() => {
    if (item?.id && tab === 'movements') fetchMovements()
  }, [tab])

  async function fetchMovements() {
    const { data, error } = await supabase.from('inventory_movements')
      .select('*, staff(full_name)')
      .eq('item_id', item!.id)
      .order('created_at', { ascending: false })
    if (error) setErr('Ошибка: ' + error.message)
    setMovements(data || [])
  }

  const set = (k: string, v: string | number | null) => setForm(f => ({ ...f, [k]: v }))

  async function addCategory() {
    if (!newCat.trim()) return
    const { error } = await supabase.from('inventory_categories').insert({ name: newCat.trim() })
    if (error) { setErr('Категория не добавлена: ' + error.message); return }
    const { data } = await supabase.from('inventory_categories').select('name').order('name')
    setCategories((data || []).map((c: any) => c.name))
    set('category', newCat.trim())
    setNewCat('')
  }

  async function deleteCategory() {
    if (!confirm('Удалить категорию «' + form.category + '»?')) return
    const { error } = await supabase.from('inventory_categories').delete().eq('name', form.category)
    if (error) { setErr('Категория не удалена: ' + error.message); return }
    const { data } = await supabase.from('inventory_categories').select('name').order('name')
    setCategories((data || []).map((c: any) => c.name))
    set('category', '')
  }

  async function save() {
    if (!form.name.trim()) { setErr('Введите название'); return }
    setErr('')
    setSaving(true)
    const cleanForm = { ...form, received_at: form.received_at || null }
    if (item?.id) {
      const { error } = await supabase.from('inventory').update(cleanForm).eq('id', item.id)
      if (error) { setErr('Ошибка: ' + error.message); setSaving(false); return }
    } else {
      const { error } = await supabase.from('inventory').insert(cleanForm)
      if (error) { setErr('Ошибка: ' + error.message); setSaving(false); return }
    }
    setSaving(false)
    onSaved()
  }

  async function remove() {
    if (!item?.id || !confirm('Удалить товар?')) return
    const { error } = await supabase.from('inventory').delete().eq('id', item.id)
    if (error) { setErr('Ошибка удаления: ' + error.message); return }
    onSaved()
  }

  async function issueItem() {
    if (!item?.id || !issueStaff) { setErr('Выберите сотрудника'); return }
    if (issueQty > (item.quantity_available || 0)) { setErr('Недостаточно доступного количества'); return }
    setErr('')
    const { error: mvErr } = await supabase.from('inventory_movements').insert({
      item_id: item.id, staff_id: issueStaff, action: 'issued', quantity: issueQty, note: issueNote
    })
    if (mvErr) { setErr('Ошибка: ' + mvErr.message); return }
    const { error: upErr } = await supabase.rpc('inventory_adjust', { p_item: item.id, p_available: -issueQty, p_total: 0 })
    if (upErr) { setErr('Движение записано, но остаток не обновлён: ' + upErr.message); return }
    setIssueStaff(''); setIssueNote(''); setIssueQty(1)
    fetchMovements()
    onSaved()
  }

  async function returnItem(qty: number) {
    if (!item?.id) return
    const { error: mvErr } = await supabase.from('inventory_movements').insert({
      item_id: item.id, action: 'returned', quantity: qty, note: 'Возврат'
    })
    if (mvErr) { setErr('Ошибка: ' + mvErr.message); return }
    const { error: upErr } = await supabase.rpc('inventory_adjust', { p_item: item.id, p_available: qty, p_total: 0 })
    if (upErr) { setErr('Движение записано, но остаток не обновлён: ' + upErr.message); return }
    fetchMovements()
    onSaved()
  }

  return (
    <Modal title={item ? item.name : 'Новый товар'} onClose={onClose} width={560} footer={<>
      {tab === 'info' && item && <Button kind="danger" onClick={remove} style={{ marginRight: 'auto' }}>Удалить</Button>}
      <Button onClick={onClose}>Закрыть</Button>
      {tab === 'info' && <Button kind="primary" onClick={save} disabled={saving}>{saving ? 'Сохранение…' : 'Сохранить'}</Button>}
    </>}>
      {item && <Tabs<ItemTab> value={tab} onChange={setTab} tabs={[['info', 'Карточка'], ['movements', 'История выдачи']]} />}

      {tab === 'info' && <>
        <Field label="Название *"><Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Офисное кресло" /></Field>
        <div style={cols('repeat(2, minmax(0, 1fr))')}>
          <div style={{ display: 'grid', gap: 6, alignContent: 'start' }}>
            <Field label="Категория">
              <Select value={form.category} onChange={e => set('category', e.target.value)}>
                <option value="">Не выбрана</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </Select>
            </Field>
            <div style={{ display: 'flex', gap: 6 }}>
              <Input style={{ flex: 1, minWidth: 0 }} value={newCat} onChange={e => setNewCat(e.target.value)} placeholder="Новая категория" onKeyDown={e => e.key === 'Enter' && addCategory()} />
              <Button onClick={addCategory}>Добавить</Button>
            </div>
            {form.category && (
              <Row gap={6}>
                <Muted small>Выбрана: <b>{form.category}</b></Muted>
                <Button small kind="danger" onClick={deleteCategory}>Удалить</Button>
              </Row>
            )}
          </div>
          <Field label="Инвентарный номер"><Input value={form.inventory_number} onChange={e => set('inventory_number', e.target.value)} placeholder="INV-001" /></Field>
        </div>
        <Field label="Описание"><Textarea style={{ minHeight: 60 }} value={form.description} onChange={e => set('description', e.target.value)} /></Field>
        <div style={cols('repeat(3, minmax(0, 1fr))')}>
          <Field label="Количество"><Input type="number" value={form.quantity} onChange={e => set('quantity', Number(e.target.value))} /></Field>
          <Field label="Доступно"><Input type="number" value={form.quantity_available} onChange={e => set('quantity_available', Number(e.target.value))} /></Field>
          <Field label="Стоимость, ₽"><Input type="number" value={form.cost || ''} onChange={e => set('cost', Number(e.target.value))} placeholder="0" /></Field>
        </div>
        <div style={cols('repeat(2, minmax(0, 1fr))')}>
          <Field label="Местонахождение"><Input value={form.location} onChange={e => set('location', e.target.value)} placeholder="Офис 201, склад…" /></Field>
          <Field label="Серийный номер"><Input value={form.serial_number} onChange={e => set('serial_number', e.target.value)} placeholder="SN-…" /></Field>
        </div>
        <div style={cols('repeat(2, minmax(0, 1fr))')}>
          <Field label="Поставщик"><Input value={form.supplier} onChange={e => set('supplier', e.target.value)} placeholder="ООО Поставщик" /></Field>
          <Field label="Дата получения"><Input type="date" value={form.received_at || ''} onChange={e => set('received_at', e.target.value)} /></Field>
        </div>
        <Field label="Ответственный">
          <Select value={form.responsible_id || ''} onChange={e => set('responsible_id', e.target.value || null)}>
            <option value="">Не назначен</option>
            {staff.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
          </Select>
        </Field>
        <Field label="Заметки"><Textarea style={{ minHeight: 60 }} value={form.notes} onChange={e => set('notes', e.target.value)} /></Field>
      </>}

      {tab === 'movements' && item && <>
        <div style={{ background: C.card2, border: `1px solid ${C.line}`, borderRadius: C.radius, padding: 14, display: 'grid', gap: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Выдать</div>
          <div style={cols('repeat(2, minmax(0, 1fr))')}>
            <Select value={issueStaff} onChange={e => setIssueStaff(e.target.value)}>
              <option value="">Сотрудник</option>
              {staff.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
            </Select>
            <Input type="number" min={1} value={issueQty} onChange={e => setIssueQty(Number(e.target.value))} placeholder="Кол-во" />
          </div>
          <Input value={issueNote} onChange={e => setIssueNote(e.target.value)} placeholder="Заметка (необязательно)" />
          <div><Button kind="primary" onClick={issueItem}>Выдать</Button></div>
        </div>
        <div style={{ fontSize: 13, fontWeight: 600 }}>История</div>
        {movements === null ? <Loading /> : movements.length === 0 ? <Empty>Движений нет</Empty> : (
          <div style={{ display: 'grid', gap: 6 }}>
            {movements.map(m => (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: C.card, border: `1px solid ${C.line}`, borderLeft: `3px solid ${ACTION[m.action]?.color || C.line}`, borderRadius: C.radiusSm }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{ACTION[m.action]?.label || m.action}: {m.quantity} шт.</div>
                  <Sub>{(m.staff as any)?.full_name || '—'} · {new Date(m.created_at).toLocaleDateString('ru')}{m.note && ` · ${m.note}`}</Sub>
                </div>
                {m.action === 'issued' && <Button small onClick={() => returnItem(m.quantity)}>Вернуть</Button>}
              </div>
            ))}
          </div>
        )}
      </>}

      {err && <Notice tone="red">{err}</Notice>}
    </Modal>
  )
}

// ─── ReceiveModal (Приходная накладная) ─────────────────────────────────────

function ReceiveModal({ items, onClose, onSaved }: { items: Item[]; onClose: () => void; onSaved: () => void }) {
  const today = new Date().toISOString().slice(0, 10)
  const [date, setDate] = useState(today)
  const [supplier, setSupplier] = useState('')
  const [docNumber, setDocNumber] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<InvoiceLine[]>([{ item_id: '', quantity: 1, price: 0 }])
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const total = lines.reduce((s, l) => s + l.quantity * l.price, 0)

  function setLine(idx: number, key: keyof InvoiceLine, val: string | number) {
    setLines(prev => prev.map((l, i) => i === idx ? { ...l, [key]: val } : l))
  }

  function addLine() { setLines(prev => [...prev, { item_id: '', quantity: 1, price: 0 }]) }
  function removeLine(idx: number) { setLines(prev => prev.filter((_, i) => i !== idx)) }

  async function save() {
    const valid = lines.filter(l => l.item_id && l.quantity > 0)
    if (!valid.length) { setErr('Добавьте хотя бы одну позицию'); return }
    setErr('')
    setSaving(true)

    for (const line of valid) {
      const item = items.find(i => i.id === line.item_id)
      if (!item) continue
      const { error: mvErr } = await supabase.from('inventory_movements').insert({
        item_id: line.item_id,
        action: 'received',
        quantity: line.quantity,
        note: [supplier, docNumber, notes].filter(Boolean).join(' / ') || null,
        created_at: date + 'T00:00:00',
      })
      if (mvErr) { setErr('Ошибка записи движения: ' + mvErr.message); setSaving(false); return }
      const { error: upErr } = await supabase.rpc('inventory_adjust', { p_item: line.item_id, p_available: line.quantity, p_total: line.quantity })
      if (upErr) { setErr('Ошибка обновления количества: ' + upErr.message); setSaving(false); return }
    }

    setSaving(false)
    onSaved()
  }

  const grid = '1fr 80px 100px 28px'
  return (
    <Modal title="Приходная накладная" onClose={onClose} width={640} footer={<>
      <Button onClick={onClose}>Отмена</Button>
      <Button kind="primary" onClick={save} disabled={saving}>{saving ? 'Сохранение…' : 'Провести приход'}</Button>
    </>}>
      <div style={cols('repeat(3, minmax(0, 1fr))')}>
        <Field label="Дата прихода"><Input type="date" value={date} onChange={e => setDate(e.target.value)} /></Field>
        <Field label="Поставщик"><Input value={supplier} onChange={e => setSupplier(e.target.value)} placeholder="ООО Поставщик" /></Field>
        <Field label="Номер накладной"><Input value={docNumber} onChange={e => setDocNumber(e.target.value)} placeholder="НКЛ-001" /></Field>
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        <Row justify="space-between">
          <span style={colHead}>Позиции</span>
          <Button small onClick={addLine}>Добавить позицию</Button>
        </Row>
        <div style={{ display: 'grid', gridTemplateColumns: grid, gap: 6 }}>
          <span style={colHead}>Товар</span>
          <span style={colHead}>Кол-во</span>
          <span style={colHead}>Цена за шт.</span>
          <span />
        </div>
        {lines.map((line, idx) => (
          <div key={idx} style={{ display: 'grid', gridTemplateColumns: grid, gap: 6, alignItems: 'center' }}>
            <Select value={line.item_id} onChange={e => setLine(idx, 'item_id', e.target.value)}>
              <option value="">Выбрать</option>
              {items.map(i => <option key={i.id} value={i.id}>{i.name}{i.inventory_number ? ` (${i.inventory_number})` : ''}</option>)}
            </Select>
            <Input type="number" min={1} value={line.quantity} onChange={e => setLine(idx, 'quantity', Number(e.target.value))} />
            <Input type="number" min={0} value={line.price || ''} placeholder="0" onChange={e => setLine(idx, 'price', Number(e.target.value))} />
            <button type="button" aria-label="Убрать позицию" title="Убрать позицию" onClick={() => removeLine(idx)} disabled={lines.length === 1} style={removeBtn(lines.length === 1)}>×</button>
          </div>
        ))}
      </div>

      {total > 0 && (
        <div style={{ background: C.card2, borderRadius: C.radiusSm, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Muted>Итого</Muted>
          <span style={{ fontSize: 16, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{money(total)}</span>
        </div>
      )}

      <Field label="Заметки"><Textarea style={{ minHeight: 60 }} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Дополнительная информация…" /></Field>
      {err && <Notice tone="red">{err}</Notice>}
    </Modal>
  )
}

// ─── IssueModal (Расходная накладная) ───────────────────────────────────────

function IssueModal({ items, staff, onClose, onSaved }: { items: Item[]; staff: Staff[]; onClose: () => void; onSaved: () => void }) {
  const today = new Date().toISOString().slice(0, 10)
  const [date, setDate] = useState(today)
  const [staffId, setStaffId] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<{ item_id: string; quantity: number }[]>([{ item_id: '', quantity: 1 }])
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  function setLine(idx: number, key: 'item_id' | 'quantity', val: string | number) {
    setLines(prev => prev.map((l, i) => i === idx ? { ...l, [key]: val } : l))
  }
  function addLine() { setLines(prev => [...prev, { item_id: '', quantity: 1 }]) }
  function removeLine(idx: number) { setLines(prev => prev.filter((_, i) => i !== idx)) }

  async function save() {
    if (!staffId) { setErr('Выберите сотрудника'); return }
    const valid = lines.filter(l => l.item_id && l.quantity > 0)
    if (!valid.length) { setErr('Добавьте хотя бы одну позицию'); return }
    // одна позиция может стоять в нескольких строках — проверяем сумму по товару
    const need = new Map<string, number>()
    for (const line of valid) need.set(line.item_id, (need.get(line.item_id) || 0) + line.quantity)
    for (const [id, q] of need) {
      const item = items.find(i => i.id === id)
      if (item && q > item.quantity_available) { setErr(`Недостаточно «${item.name}»: доступно ${item.quantity_available} шт.`); return }
    }
    setErr('')
    setSaving(true)
    for (const line of valid) {
      const item = items.find(i => i.id === line.item_id)
      if (!item) continue
      const { error: mvErr } = await supabase.from('inventory_movements').insert({
        item_id: line.item_id,
        staff_id: staffId,
        action: 'issued',
        quantity: line.quantity,
        note: notes || null,
        created_at: date + 'T00:00:00',
      })
      if (mvErr) { setErr('Ошибка записи: ' + mvErr.message); setSaving(false); return }
      const { error: upErr } = await supabase.rpc('inventory_adjust', { p_item: line.item_id, p_available: -line.quantity, p_total: 0 })
      if (upErr) { setErr('Ошибка обновления: ' + upErr.message); setSaving(false); return }
    }
    setSaving(false)
    onSaved()
  }

  const grid = '1fr 90px 28px'
  return (
    <Modal title="Расходная накладная" onClose={onClose} width={600} footer={<>
      <Button onClick={onClose}>Отмена</Button>
      <Button kind="primary" onClick={save} disabled={saving}>{saving ? 'Сохранение…' : 'Провести расход'}</Button>
    </>}>
      <div style={cols('repeat(2, minmax(0, 1fr))')}>
        <Field label="Дата выдачи"><Input type="date" value={date} onChange={e => setDate(e.target.value)} /></Field>
        <Field label="Кому (сотрудник) *">
          <Select value={staffId} onChange={e => setStaffId(e.target.value)}>
            <option value="">Выбрать</option>
            {staff.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
          </Select>
        </Field>
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        <Row justify="space-between">
          <span style={colHead}>Позиции</span>
          <Button small onClick={addLine}>Добавить позицию</Button>
        </Row>
        <div style={{ display: 'grid', gridTemplateColumns: grid, gap: 6 }}>
          <span style={colHead}>Товар</span>
          <span style={colHead}>Кол-во</span>
          <span />
        </div>
        {lines.map((line, idx) => {
          const item = items.find(i => i.id === line.item_id)
          const over = !!item && line.quantity > item.quantity_available
          return (
            <div key={idx} style={{ display: 'grid', gridTemplateColumns: grid, gap: 6, alignItems: 'center' }}>
              <Select value={line.item_id} onChange={e => setLine(idx, 'item_id', e.target.value)}>
                <option value="">Выбрать</option>
                {items.filter(i => i.quantity_available > 0).map(i => (
                  <option key={i.id} value={i.id}>{i.name} (доступно: {i.quantity_available})</option>
                ))}
              </Select>
              <Input style={{ borderColor: over ? C.red : C.line }} type="number" min={1} max={item?.quantity_available} value={line.quantity} onChange={e => setLine(idx, 'quantity', Number(e.target.value))} />
              <button type="button" aria-label="Убрать позицию" title="Убрать позицию" onClick={() => removeLine(idx)} disabled={lines.length === 1} style={removeBtn(lines.length === 1)}>×</button>
            </div>
          )
        })}
      </div>

      <Field label="Заметки"><Textarea style={{ minHeight: 60 }} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Назначение, проект…" /></Field>
      {err && <Notice tone="red">{err}</Notice>}
    </Modal>
  )
}

// ─── HistoryTab ──────────────────────────────────────────────────────────────

function HistoryTab({ staff }: { staff: Staff[] }) {
  const [movements, setMovements] = useState<Movement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [staffFilter, setStaffFilter] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    setError('')
    const { data, error } = await supabase.from('inventory_movements')
      .select('*, staff(full_name), item:inventory(name, inventory_number)')
      .order('created_at', { ascending: false })
      .limit(300)
    if (error) setError(error.message)
    setMovements(data || [])
    setLoading(false)
  }

  const filtered = movements.filter(m => {
    if (actionFilter && m.action !== actionFilter) return false
    if (staffFilter && m.staff_id !== staffFilter) return false
    return true
  })

  const grouped: { date: string; items: Movement[] }[] = []
  for (const m of filtered) {
    const date = new Date(m.created_at).toLocaleDateString('ru', { day: 'numeric', month: 'long', year: 'numeric' })
    const last = grouped[grouped.length - 1]
    if (last?.date === date) last.items.push(m)
    else grouped.push({ date, items: [m] })
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <Row>
        <Select value={actionFilter} onChange={e => setActionFilter(e.target.value)} style={{ width: 180 }}>
          <option value="">Все операции</option>
          <option value="received">Приход</option>
          <option value="issued">Выдача</option>
          <option value="returned">Возврат</option>
        </Select>
        <Select value={staffFilter} onChange={e => setStaffFilter(e.target.value)} style={{ width: 220 }}>
          <option value="">Все сотрудники</option>
          {staff.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
        </Select>
        <Button onClick={load}>Обновить</Button>
      </Row>

      {error && <ErrorBox error={error} onRetry={load} />}

      {loading ? <Loading /> : grouped.length === 0 ? (
        <Card><Empty>Движений не найдено</Empty></Card>
      ) : (
        <div style={{ display: 'grid', gap: 20 }}>
          {grouped.map(group => (
            <div key={group.date} style={{ display: 'grid', gap: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{group.date}</div>
              <div style={{ display: 'grid', gap: 6 }}>
                {group.items.map(m => {
                  const a = ACTION[m.action]
                  const it = m.item as any
                  const who = (m.staff as any)?.full_name
                  return (
                    <div key={m.id} style={{ background: C.card, border: `1px solid ${C.line}`, borderLeft: `3px solid ${a?.color || C.line}`, borderRadius: C.radiusSm, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                      <Badge tone={a?.tone || 'neutral'}>{a?.label || m.action}</Badge>
                      <div style={{ flex: 1, minWidth: 160 }}>
                        <div style={{ fontSize: 14, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {it?.name || '—'}
                          {it?.inventory_number && <span style={{ fontSize: 12, color: C.muted, marginLeft: 6, fontWeight: 400 }}>№ {it.inventory_number}</span>}
                        </div>
                        {(who || m.note) && <Sub>{who}{m.note ? `${who ? ' · ' : ''}${m.note}` : ''}</Sub>}
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{m.quantity} шт.</div>
                      <Muted small>{new Date(m.created_at).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}</Muted>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── InventoryPage ──────────────────────────────────────────────────────────

type PageTab = 'items' | 'history'

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} style={{
      padding: '5px 12px', borderRadius: 20, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
      border: `1px solid ${active ? C.accent : C.line}`, background: active ? C.accentBg : C.card, color: active ? C.accent : C.muted, fontWeight: active ? 600 : 400,
    }}>{children}</button>
  )
}

export default function InventoryPage() {
  const [items, setItems] = useState<Item[]>([])
  const [staff, setStaff] = useState<Staff[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<Item | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [showReceive, setShowReceive] = useState(false)
  const [showIssue, setShowIssue] = useState(false)
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [pageTab, setPageTab] = useState<PageTab>('items')

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    setError('')
    const [{ data: inv, error: e1 }, { data: st, error: e2 }, { data: cats, error: e3 }] = await Promise.all([
      supabase.from('inventory').select('*, responsible:staff(full_name)').order('name'),
      supabase.from('staff').select('id, full_name').eq('status', 'active').order('full_name'),
      supabase.from('inventory_categories').select('name').order('name')
    ])
    const e = e1 || e2 || e3
    if (e) setError(e.message)
    setItems(inv || [])
    setStaff(st || [])
    setCategories((cats || []).map((c: any) => c.name))
    setLoading(false)
  }

  const filtered = items.filter(i => {
    const matchSearch = !search || i.name.toLowerCase().includes(search.toLowerCase()) || i.inventory_number?.toLowerCase().includes(search.toLowerCase())
    const matchCat = !catFilter || i.category === catFilter
    return matchSearch && matchCat
  })

  // KPI
  const totalCost = items.reduce((s, i) => s + (i.cost || 0) * (i.quantity || 0), 0)
  const issuedNow = items.filter(i => (i.quantity - i.quantity_available) > 0).length
  const lowStock = items.filter(i => i.quantity_available <= 2).length

  // Category counts
  const catCounts = Object.fromEntries(categories.map(c => [c, items.filter(i => i.category === c).length]))
  const catTone = Object.fromEntries(categories.map((c, i) => [c, CAT_TONES[i % CAT_TONES.length]])) as Record<string, Tone>

  const open = (item: Item | null) => { setSelected(item); setShowModal(true) }

  return (
    <Page>
      <Tabs<PageTab> value={pageTab} onChange={setPageTab} tabs={[['items', 'Товары'], ['history', 'История движений']]} />

      {pageTab === 'history' && <HistoryTab staff={staff} />}

      {pageTab === 'items' && <>
        {error && <ErrorBox error={error} onRetry={fetchAll} />}

        <Stats>
          <Stat label="Всего позиций" value={num(items.length)} />
          <Stat label="Общая стоимость" value={money(totalCost)} tone="blue" />
          <Stat label="Выдано сейчас" value={num(issuedNow)} tone="amber" />
          <Stat label="Заканчивается (2 и меньше)" value={num(lowStock)} tone="red" />
        </Stats>

        {categories.length > 0 && (
          <Row gap={6}>
            <Chip active={!catFilter} onClick={() => setCatFilter('')}>Все <span style={{ opacity: 0.7 }}>{items.length}</span></Chip>
            {categories.map(c => (
              <Chip key={c} active={catFilter === c} onClick={() => setCatFilter(catFilter === c ? '' : c)}>
                {c} <span style={{ opacity: 0.7 }}>{catCounts[c] || 0}</span>
              </Chip>
            ))}
          </Row>
        )}

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <Input type="search" style={{ flex: 1, minWidth: 200, width: 'auto' }} placeholder="Поиск по названию или номеру" value={search} onChange={e => setSearch(e.target.value)} />
          <Button onClick={() => setShowReceive(true)}>Приход</Button>
          <Button onClick={() => setShowIssue(true)}>Расход</Button>
          <Button kind="primary" onClick={() => open(null)}>Добавить товар</Button>
        </div>

        <Card pad={false}>
          {loading ? <Loading /> : (
            <Table rows={filtered} rowKey={i => i.id} onRow={open} empty="Ничего не найдено" cols={[
              { key: 'n', title: 'Название', sort: i => i.name, render: i => <span style={{ fontWeight: 500 }}>{i.name}</span> },
              { key: 'c', title: 'Категория', sort: i => i.category || '', render: i => i.category ? <Badge tone={catTone[i.category] || 'neutral'}>{i.category}</Badge> : null },
              { key: 'inv', title: 'Инв. №', sort: i => i.inventory_number || '', render: i => <span style={{ fontFamily: 'monospace', color: C.muted }}>{i.inventory_number || '—'}</span> },
              { key: 'l', title: 'Местонахождение', sort: i => i.location || '', render: i => <Muted>{i.location || '—'}</Muted> },
              { key: 'q', title: 'Кол-во', align: 'right', sort: i => i.quantity, render: i => num(i.quantity) },
              { key: 'a', title: 'Доступно', align: 'right', sort: i => i.quantity_available, render: i => (
                <span style={{ fontWeight: 600, color: i.quantity_available === 0 ? C.red : i.quantity_available <= 2 ? C.amber : C.green }}>{num(i.quantity_available)}</span>
              ) },
              { key: 'cost', title: 'Стоимость', align: 'right', sort: i => i.cost || 0, render: i => money(i.cost, { zero: '—' }) },
              { key: 'r', title: 'Ответственный', sort: i => (i.responsible as any)?.full_name || '', render: i => <Muted>{(i.responsible as any)?.full_name || '—'}</Muted> },
            ]} />
          )}
        </Card>
      </>}

      {showModal && <ItemModal item={selected} staff={staff} onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); fetchAll() }} />}
      {showReceive && <ReceiveModal items={items} onClose={() => setShowReceive(false)} onSaved={() => { setShowReceive(false); fetchAll() }} />}
      {showIssue && <IssueModal items={items} staff={staff} onClose={() => setShowIssue(false)} onSaved={() => { setShowIssue(false); fetchAll() }} />}
    </Page>
  )
}
