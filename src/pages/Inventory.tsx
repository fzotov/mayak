import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

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

const inp: React.CSSProperties = { width: '100%', border: '1px solid #e8ebf3', borderRadius: 7, padding: '8px 10px', fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' as const }
const lbl: React.CSSProperties = { fontSize: 12, color: '#8596b4', marginBottom: 4, display: 'block', fontWeight: 500 }

// ─── ItemModal ──────────────────────────────────────────────────────────────

function ItemModal({ item, staff, onClose, onSaved }: { item: Item | null; staff: Staff[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<Omit<Item, 'id' | 'responsible'>>(item ? { ...item } : { ...emptyItem })
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState<'info' | 'movements'>('info')
  const [movements, setMovements] = useState<Movement[]>([])
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
    const { data } = await supabase.from('inventory_movements')
      .select('*, staff(full_name)')
      .eq('item_id', item!.id)
      .order('created_at', { ascending: false })
    setMovements(data || [])
  }

  const set = (k: string, v: string | number | null) => setForm(f => ({ ...f, [k]: v }))

  async function addCategory() {
    if (!newCat.trim()) return
    await supabase.from('inventory_categories').insert({ name: newCat.trim() })
    const { data } = await supabase.from('inventory_categories').select('name').order('name')
    setCategories((data || []).map((c: any) => c.name))
    set('category', newCat.trim())
    setNewCat('')
  }

  async function save() {
    if (!form.name.trim()) return alert('Введите название')
    setSaving(true)
    const cleanForm = { ...form, received_at: form.received_at || null }
    if (item?.id) {
      const { error } = await supabase.from('inventory').update(cleanForm).eq('id', item.id)
      if (error) { alert('Ошибка: ' + error.message); setSaving(false); return }
    } else {
      const { error } = await supabase.from('inventory').insert(cleanForm)
      if (error) { alert('Ошибка: ' + error.message); setSaving(false); return }
    }
    setSaving(false)
    onSaved()
  }

  async function remove() {
    if (!item?.id || !confirm('Удалить товар?')) return
    const { error } = await supabase.from('inventory').delete().eq('id', item.id)
    if (error) { alert('Ошибка удаления: ' + error.message); return }
    onSaved()
  }

  async function issueItem() {
    if (!item?.id || !issueStaff) return alert('Выберите сотрудника')
    if (issueQty > (item.quantity_available || 0)) return alert('Недостаточно доступного количества')
    const { error: mvErr } = await supabase.from('inventory_movements').insert({
      item_id: item.id, staff_id: issueStaff, action: 'issued', quantity: issueQty, note: issueNote
    })
    if (mvErr) { alert('Ошибка: ' + mvErr.message); return }
    await supabase.from('inventory').update({ quantity_available: (item.quantity_available || 0) - issueQty }).eq('id', item.id)
    setIssueStaff(''); setIssueNote(''); setIssueQty(1)
    fetchMovements()
    onSaved()
  }

  async function returnItem(qty: number) {
    if (!item?.id) return
    const { error: mvErr } = await supabase.from('inventory_movements').insert({
      item_id: item.id, action: 'returned', quantity: qty, note: 'Возврат'
    })
    if (mvErr) { alert('Ошибка: ' + mvErr.message); return }
    await supabase.from('inventory').update({ quantity_available: (item.quantity_available || 0) + qty }).eq('id', item.id)
    fetchMovements()
    onSaved()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#00000066', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px #0002' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #e8ebf3' }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#1a2240' }}>{item ? item.name : 'Новый товар'}</div>
          <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: 20, color: '#8596b4', cursor: 'pointer' }}>✕</button>
        </div>

        {item && (
          <div style={{ display: 'flex', borderBottom: '1px solid #e8ebf3' }}>
            {(['info', 'movements'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} style={{ flex: 1, padding: '10px', border: 'none', background: 'none', fontSize: 13, fontWeight: tab === t ? 600 : 400, color: tab === t ? '#4f6ef7' : '#8596b4', borderBottom: `2px solid ${tab === t ? '#4f6ef7' : 'transparent'}`, cursor: 'pointer', fontFamily: 'inherit' }}>
                {{ info: 'Карточка', movements: 'История выдачи' }[t]}
              </button>
            ))}
          </div>
        )}

        {tab === 'info' && (
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div><label style={lbl}>Название *</label><input style={inp} value={form.name} onChange={e => set('name', e.target.value)} placeholder="Офисное кресло" /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={lbl}>Категория</label>
                <select style={inp} value={form.category} onChange={e => set('category', e.target.value)}>
                  <option value="">— Выбрать</option>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                  <input style={{ ...inp, flex: 1 }} value={newCat} onChange={e => setNewCat(e.target.value)} placeholder="Новая категория..." onKeyDown={e => e.key === 'Enter' && addCategory()} />
                  <button type="button" onClick={addCategory} style={{ padding: '8px 12px', borderRadius: 7, border: 'none', background: '#4f6ef7', color: '#fff', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>+ Добавить</button>
                </div>
                {form.category && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                    <span style={{ fontSize: 12, color: '#8596b4' }}>Выбрана: <b>{form.category}</b></span>
                    <button type="button" onClick={async () => {
                      if (!confirm('Удалить категорию "' + form.category + '"?')) return
                      await supabase.from('inventory_categories').delete().eq('name', form.category)
                      const { data } = await supabase.from('inventory_categories').select('name').order('name')
                      setCategories((data || []).map((c: any) => c.name))
                      set('category', '')
                    }} style={{ padding: '3px 8px', borderRadius: 6, border: 'none', background: '#fee2e2', color: '#ef4444', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Удалить</button>
                  </div>
                )}
              </div>
              <div><label style={lbl}>Инвентарный номер</label><input style={inp} value={form.inventory_number} onChange={e => set('inventory_number', e.target.value)} placeholder="INV-001" /></div>
            </div>
            <div><label style={lbl}>Описание</label><textarea style={{ ...inp, height: 60, resize: 'none' }} value={form.description} onChange={e => set('description', e.target.value)} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <div><label style={lbl}>Количество</label><input style={inp} type="number" value={form.quantity} onChange={e => set('quantity', Number(e.target.value))} /></div>
              <div><label style={lbl}>Доступно</label><input style={inp} type="number" value={form.quantity_available} onChange={e => set('quantity_available', Number(e.target.value))} /></div>
              <div><label style={lbl}>Стоимость (₽)</label><input style={inp} type="number" value={form.cost || ''} onChange={e => set('cost', Number(e.target.value))} placeholder="0" /></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div><label style={lbl}>Местонахождение</label><input style={inp} value={form.location} onChange={e => set('location', e.target.value)} placeholder="Офис 201, склад..." /></div>
              <div><label style={lbl}>Серийный номер</label><input style={inp} value={form.serial_number} onChange={e => set('serial_number', e.target.value)} placeholder="SN-..." /></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div><label style={lbl}>Поставщик</label><input style={inp} value={form.supplier} onChange={e => set('supplier', e.target.value)} placeholder="ООО Поставщик" /></div>
              <div><label style={lbl}>Дата получения</label><input style={inp} type="date" value={form.received_at} onChange={e => set('received_at', e.target.value)} /></div>
            </div>
            <div><label style={lbl}>Ответственный</label>
              <select style={inp} value={form.responsible_id || ''} onChange={e => set('responsible_id', e.target.value || null)}>
                <option value="">— Не назначен</option>
                {staff.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
              </select>
            </div>
            <div><label style={lbl}>Заметки</label><textarea style={{ ...inp, height: 60, resize: 'none' }} value={form.notes} onChange={e => set('notes', e.target.value)} /></div>
          </div>
        )}

        {tab === 'movements' && item && (
          <div style={{ padding: 20 }}>
            <div style={{ background: '#f8f9fc', borderRadius: 10, padding: 14, marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1a2240', marginBottom: 10 }}>Выдать</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                <select style={inp} value={issueStaff} onChange={e => setIssueStaff(e.target.value)}>
                  <option value="">— Сотрудник</option>
                  {staff.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                </select>
                <input style={inp} type="number" min={1} value={issueQty} onChange={e => setIssueQty(Number(e.target.value))} placeholder="Кол-во" />
              </div>
              <input style={{ ...inp, marginBottom: 8 }} value={issueNote} onChange={e => setIssueNote(e.target.value)} placeholder="Заметка (необязательно)" />
              <button onClick={issueItem} style={{ padding: '8px 16px', borderRadius: 7, border: 'none', background: '#4f6ef7', color: '#fff', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Выдать</button>
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#1a2240', marginBottom: 10 }}>История</div>
            {movements.length === 0 ? <div style={{ color: '#8596b4', fontSize: 13 }}>Движений нет</div> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {movements.map(m => (
                  <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#fff', border: '1px solid #e8ebf3', borderRadius: 8, borderLeft: `3px solid ${m.action === 'issued' ? '#f59e0b' : m.action === 'received' ? '#4f6ef7' : '#22c55e'}` }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: '#1a2240' }}>
                        {m.action === 'issued' ? '📤 Выдано' : m.action === 'received' ? '📥 Приход' : '↩️ Возврат'} — {m.quantity} шт.
                      </div>
                      <div style={{ fontSize: 12, color: '#8596b4' }}>{(m.staff as any)?.full_name || '—'} · {new Date(m.created_at).toLocaleDateString('ru')}{m.note && ` · ${m.note}`}</div>
                    </div>
                    {m.action === 'issued' && (
                      <button onClick={() => returnItem(m.quantity)} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #e8ebf3', background: '#f0fdf4', color: '#16a34a', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Вернуть</button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, padding: '14px 20px', borderTop: '1px solid #e8ebf3' }}>
          {tab === 'info' && <>
            <button onClick={save} disabled={saving} style={{ flex: 1, padding: '9px', borderRadius: 8, border: 'none', background: '#4f6ef7', color: '#fff', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Сохранение...' : 'Сохранить'}
            </button>
            {item && <button onClick={remove} style={{ padding: '9px 16px', borderRadius: 8, border: 'none', background: '#fee2e2', color: '#ef4444', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>Удалить</button>}
          </>}
          <button onClick={onClose} style={{ padding: '9px 16px', borderRadius: 8, border: '1px solid #e8ebf3', background: '#fff', color: '#6b7280', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>Закрыть</button>
        </div>
      </div>
    </div>
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

  const total = lines.reduce((s, l) => s + l.quantity * l.price, 0)

  function setLine(idx: number, key: keyof InvoiceLine, val: string | number) {
    setLines(prev => prev.map((l, i) => i === idx ? { ...l, [key]: val } : l))
  }

  function addLine() { setLines(prev => [...prev, { item_id: '', quantity: 1, price: 0 }]) }
  function removeLine(idx: number) { setLines(prev => prev.filter((_, i) => i !== idx)) }

  async function save() {
    const valid = lines.filter(l => l.item_id && l.quantity > 0)
    if (!valid.length) return alert('Добавьте хотя бы одну позицию')
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
      if (mvErr) { alert('Ошибка записи движения: ' + mvErr.message); setSaving(false); return }
      const { error: upErr } = await supabase.from('inventory').update({
        quantity: item.quantity + line.quantity,
        quantity_available: item.quantity_available + line.quantity,
      }).eq('id', line.item_id)
      if (upErr) { alert('Ошибка обновления количества: ' + upErr.message); setSaving(false); return }
    }

    setSaving(false)
    onSaved()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#00000066', zIndex: 110, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 640, maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 20px 60px #0002' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #e8ebf3' }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#1a2240' }}>📥 Приходная накладная</div>
          <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: 20, color: '#8596b4', cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <div><label style={lbl}>Дата прихода</label><input style={inp} type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
            <div><label style={lbl}>Поставщик</label><input style={inp} value={supplier} onChange={e => setSupplier(e.target.value)} placeholder="ООО Поставщик" /></div>
            <div><label style={lbl}>Номер накладной</label><input style={inp} value={docNumber} onChange={e => setDocNumber(e.target.value)} placeholder="НКЛ-001" /></div>
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <label style={{ ...lbl, margin: 0 }}>Позиции</label>
              <button onClick={addLine} style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid #4f6ef7', background: '#eff3ff', color: '#4f6ef7', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>+ Позиция</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 100px 28px', gap: 6 }}>
                <span style={{ fontSize: 12, color: '#8596b4', fontWeight: 500 }}>Товар</span>
                <span style={{ fontSize: 12, color: '#8596b4', fontWeight: 500 }}>Кол-во</span>
                <span style={{ fontSize: 12, color: '#8596b4', fontWeight: 500 }}>Цена за шт.</span>
                <span />
              </div>
              {lines.map((line, idx) => (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 100px 28px', gap: 6, alignItems: 'center' }}>
                  <select style={inp} value={line.item_id} onChange={e => setLine(idx, 'item_id', e.target.value)}>
                    <option value="">— Выбрать</option>
                    {items.map(i => <option key={i.id} value={i.id}>{i.name}{i.inventory_number ? ` (${i.inventory_number})` : ''}</option>)}
                  </select>
                  <input style={inp} type="number" min={1} value={line.quantity} onChange={e => setLine(idx, 'quantity', Number(e.target.value))} />
                  <input style={inp} type="number" min={0} value={line.price || ''} placeholder="0" onChange={e => setLine(idx, 'price', Number(e.target.value))} />
                  <button onClick={() => removeLine(idx)} disabled={lines.length === 1} style={{ border: 'none', background: 'none', color: '#ef4444', fontSize: 18, cursor: 'pointer', lineHeight: 1, opacity: lines.length === 1 ? 0.3 : 1 }}>×</button>
                </div>
              ))}
            </div>
          </div>

          {total > 0 && (
            <div style={{ background: '#f8f9fc', borderRadius: 8, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: '#6b7280' }}>Итого</span>
              <span style={{ fontSize: 16, fontWeight: 600, color: '#1a2240' }}>{total.toLocaleString('ru')} ₽</span>
            </div>
          )}

          <div><label style={lbl}>Заметки</label><textarea style={{ ...inp, height: 60, resize: 'none' }} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Дополнительная информация..." /></div>
        </div>

        <div style={{ display: 'flex', gap: 8, padding: '14px 20px', borderTop: '1px solid #e8ebf3' }}>
          <button onClick={save} disabled={saving} style={{ flex: 1, padding: '9px', borderRadius: 8, border: 'none', background: '#16a34a', color: '#fff', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Сохранение...' : '✓ Провести приход'}
          </button>
          <button onClick={onClose} style={{ padding: '9px 16px', borderRadius: 8, border: '1px solid #e8ebf3', background: '#fff', color: '#6b7280', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>Отмена</button>
        </div>
      </div>
    </div>
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

  function setLine(idx: number, key: 'item_id' | 'quantity', val: string | number) {
    setLines(prev => prev.map((l, i) => i === idx ? { ...l, [key]: val } : l))
  }
  function addLine() { setLines(prev => [...prev, { item_id: '', quantity: 1 }]) }
  function removeLine(idx: number) { setLines(prev => prev.filter((_, i) => i !== idx)) }

  async function save() {
    if (!staffId) return alert('Выберите сотрудника')
    const valid = lines.filter(l => l.item_id && l.quantity > 0)
    if (!valid.length) return alert('Добавьте хотя бы одну позицию')
    for (const line of valid) {
      const item = items.find(i => i.id === line.item_id)
      if (item && line.quantity > item.quantity_available) return alert(`Недостаточно "${item.name}": доступно ${item.quantity_available} шт.`)
    }
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
      if (mvErr) { alert('Ошибка записи: ' + mvErr.message); setSaving(false); return }
      const { error: upErr } = await supabase.from('inventory').update({
        quantity_available: item.quantity_available - line.quantity,
      }).eq('id', line.item_id)
      if (upErr) { alert('Ошибка обновления: ' + upErr.message); setSaving(false); return }
    }
    setSaving(false)
    onSaved()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#00000066', zIndex: 110, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 600, maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 20px 60px #0002' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #e8ebf3' }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#1a2240' }}>📤 Расходная накладная</div>
          <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: 20, color: '#8596b4', cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div><label style={lbl}>Дата выдачи</label><input style={inp} type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
            <div><label style={lbl}>Кому (сотрудник) *</label>
              <select style={inp} value={staffId} onChange={e => setStaffId(e.target.value)}>
                <option value="">— Выбрать</option>
                {staff.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
              </select>
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <label style={{ ...lbl, margin: 0 }}>Позиции</label>
              <button onClick={addLine} style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid #4f6ef7', background: '#eff3ff', color: '#4f6ef7', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>+ Позиция</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 28px', gap: 6 }}>
                <span style={{ fontSize: 12, color: '#8596b4', fontWeight: 500 }}>Товар</span>
                <span style={{ fontSize: 12, color: '#8596b4', fontWeight: 500 }}>Кол-во</span>
                <span />
              </div>
              {lines.map((line, idx) => {
                const item = items.find(i => i.id === line.item_id)
                return (
                  <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 90px 28px', gap: 6, alignItems: 'center' }}>
                    <div>
                      <select style={inp} value={line.item_id} onChange={e => setLine(idx, 'item_id', e.target.value)}>
                        <option value="">— Выбрать</option>
                        {items.filter(i => i.quantity_available > 0).map(i => (
                          <option key={i.id} value={i.id}>{i.name} (доступно: {i.quantity_available})</option>
                        ))}
                      </select>
                    </div>
                    <input style={{ ...inp, borderColor: item && line.quantity > item.quantity_available ? '#ef4444' : '#e8ebf3' }} type="number" min={1} max={item?.quantity_available} value={line.quantity} onChange={e => setLine(idx, 'quantity', Number(e.target.value))} />
                    <button onClick={() => removeLine(idx)} disabled={lines.length === 1} style={{ border: 'none', background: 'none', color: '#ef4444', fontSize: 18, cursor: 'pointer', lineHeight: 1, opacity: lines.length === 1 ? 0.3 : 1 }}>×</button>
                  </div>
                )
              })}
            </div>
          </div>

          <div><label style={lbl}>Заметки</label><textarea style={{ ...inp, height: 60, resize: 'none' }} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Назначение, проект..." /></div>
        </div>

        <div style={{ display: 'flex', gap: 8, padding: '14px 20px', borderTop: '1px solid #e8ebf3' }}>
          <button onClick={save} disabled={saving} style={{ flex: 1, padding: '9px', borderRadius: 8, border: 'none', background: '#d97706', color: '#fff', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Сохранение...' : '✓ Провести расход'}
          </button>
          <button onClick={onClose} style={{ padding: '9px 16px', borderRadius: 8, border: '1px solid #e8ebf3', background: '#fff', color: '#6b7280', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>Отмена</button>
        </div>
      </div>
    </div>
  )
}

// ─── HistoryTab ──────────────────────────────────────────────────────────────

function HistoryTab({ staff }: { staff: Staff[] }) {
  const [movements, setMovements] = useState<Movement[]>([])
  const [loading, setLoading] = useState(true)
  const [actionFilter, setActionFilter] = useState('')
  const [staffFilter, setStaffFilter] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('inventory_movements')
      .select('*, staff(full_name), item:inventory(name, inventory_number)')
      .order('created_at', { ascending: false })
      .limit(300)
    setMovements(data || [])
    setLoading(false)
  }

  const filtered = movements.filter(m => {
    if (actionFilter && m.action !== actionFilter) return false
    if (staffFilter && m.staff_id !== staffFilter) return false
    return true
  })

  const actionLabel: Record<string, string> = { issued: '📤 Выдано', received: '📥 Приход', returned: '↩️ Возврат' }
  const actionColor: Record<string, string> = { issued: '#f59e0b', received: '#4f6ef7', returned: '#22c55e' }
  const actionBg: Record<string, string> = { issued: '#fffbeb', received: '#eff3ff', returned: '#f0fdf4' }

  const grouped: { date: string; items: Movement[] }[] = []
  for (const m of filtered) {
    const date = new Date(m.created_at).toLocaleDateString('ru', { day: 'numeric', month: 'long', year: 'numeric' })
    const last = grouped[grouped.length - 1]
    if (last?.date === date) last.items.push(m)
    else grouped.push({ date, items: [m] })
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <select style={{ border: '1px solid #e8ebf3', borderRadius: 8, padding: '7px 12px', fontSize: 14, fontFamily: 'inherit', outline: 'none', background: '#fff' }} value={actionFilter} onChange={e => setActionFilter(e.target.value)}>
          <option value="">Все операции</option>
          <option value="received">📥 Приход</option>
          <option value="issued">📤 Выдача</option>
          <option value="returned">↩️ Возврат</option>
        </select>
        <select style={{ border: '1px solid #e8ebf3', borderRadius: 8, padding: '7px 12px', fontSize: 14, fontFamily: 'inherit', outline: 'none', background: '#fff' }} value={staffFilter} onChange={e => setStaffFilter(e.target.value)}>
          <option value="">Все сотрудники</option>
          {staff.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
        </select>
        <button onClick={load} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #e8ebf3', background: '#fff', color: '#6b7280', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>↻ Обновить</button>
      </div>

      {loading ? <div style={{ color: '#8596b4', fontSize: 14 }}>Загрузка...</div> : grouped.length === 0 ? (
        <div style={{ color: '#8596b4', fontSize: 14, textAlign: 'center', padding: 40 }}>Движений не найдено</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {grouped.map(group => (
            <div key={group.date}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#8596b4', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>{group.date}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {group.items.map(m => (
                  <div key={m.id} style={{ background: '#fff', border: '1px solid #e8ebf3', borderRadius: 9, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12, borderLeft: `3px solid ${actionColor[m.action] || '#e8ebf3'}` }}>
                    <div style={{ fontSize: 13, fontWeight: 500, padding: '3px 9px', borderRadius: 8, background: actionBg[m.action] || '#f8f9fc', color: actionColor[m.action] || '#6b7280', whiteSpace: 'nowrap' }}>
                      {actionLabel[m.action] || m.action}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 500, color: '#1a2240', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {(m.item as any)?.name || '—'}
                        {(m.item as any)?.inventory_number && <span style={{ fontSize: 12, color: '#8596b4', marginLeft: 6 }}>#{(m.item as any).inventory_number}</span>}
                      </div>
                      {((m.staff as any)?.full_name || m.note) && (
                        <div style={{ fontSize: 12, color: '#8596b4', marginTop: 2 }}>
                          {(m.staff as any)?.full_name}{m.note ? ` · ${m.note}` : ''}
                        </div>
                      )}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#374151', whiteSpace: 'nowrap' }}>{m.quantity} шт.</div>
                    <div style={{ fontSize: 12, color: '#8596b4', whiteSpace: 'nowrap' }}>{new Date(m.created_at).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── InventoryPage ──────────────────────────────────────────────────────────

export default function InventoryPage() {
  const [items, setItems] = useState<Item[]>([])
  const [staff, setStaff] = useState<Staff[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Item | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [showReceive, setShowReceive] = useState(false)
  const [showIssue, setShowIssue] = useState(false)
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [pageTab, setPageTab] = useState<'items' | 'history'>('items')

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [{ data: inv }, { data: st }, { data: cats }] = await Promise.all([
      supabase.from('inventory').select('*, responsible:staff(full_name)').order('name'),
      supabase.from('staff').select('id, full_name').eq('status', 'active').order('full_name'),
      supabase.from('inventory_categories').select('name').order('name')
    ])
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

  const catColors = ['#dbeafe', '#ede9fe', '#fef3c7', '#dcfce7', '#fee2e2', '#f0f2f8', '#fde68a', '#d1fae5']
  const catBadgeColor = Object.fromEntries(categories.map((c, i) => [c, catColors[i % catColors.length]]))

  return (
    <div>
      {/* Вкладки страницы */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid #e8ebf3', paddingBottom: 0 }}>
        {([['items', 'Товары'], ['history', 'История движений']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setPageTab(key)} style={{ padding: '8px 18px', border: 'none', background: 'none', fontSize: 14, fontWeight: pageTab === key ? 600 : 400, color: pageTab === key ? '#4f6ef7' : '#8596b4', borderBottom: `2px solid ${pageTab === key ? '#4f6ef7' : 'transparent'}`, cursor: 'pointer', fontFamily: 'inherit', marginBottom: -1 }}>
            {label}
          </button>
        ))}
      </div>

      {pageTab === 'history' && <HistoryTab staff={staff} />}

      {pageTab === 'items' && (
        <>
          {/* Мини-дашборд */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 14 }}>
            {[
              { label: 'Всего позиций', value: items.length, color: '#1a2240', bg: '#fff' },
              { label: 'Общая стоимость', value: totalCost.toLocaleString('ru') + ' ₽', color: '#4f6ef7', bg: '#eff3ff' },
              { label: 'Выдано сейчас', value: issuedNow, color: '#d97706', bg: '#fffbeb' },
              { label: 'Заканчивается (≤2)', value: lowStock, color: '#ef4444', bg: '#fff5f5' },
            ].map(kpi => (
              <div key={kpi.label} style={{ background: kpi.bg, border: '1px solid #e8ebf3', borderRadius: 10, padding: '12px 16px' }}>
                <div style={{ fontSize: 12, color: '#8596b4', marginBottom: 4 }}>{kpi.label}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: kpi.color }}>{kpi.value}</div>
              </div>
            ))}
          </div>

          {/* Быстрый фильтр по категориям */}
          {categories.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
              <button onClick={() => setCatFilter('')} style={{ padding: '5px 12px', borderRadius: 20, border: '1px solid', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', borderColor: !catFilter ? '#4f6ef7' : '#e8ebf3', background: !catFilter ? '#eff3ff' : '#fff', color: !catFilter ? '#4f6ef7' : '#6b7280', fontWeight: !catFilter ? 600 : 400 }}>
                Все <span style={{ opacity: 0.7 }}>({items.length})</span>
              </button>
              {categories.map(c => (
                <button key={c} onClick={() => setCatFilter(catFilter === c ? '' : c)} style={{ padding: '5px 12px', borderRadius: 20, border: '1px solid', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', borderColor: catFilter === c ? '#4f6ef7' : '#e8ebf3', background: catFilter === c ? catBadgeColor[c] : '#fff', color: catFilter === c ? '#374151' : '#6b7280', fontWeight: catFilter === c ? 600 : 400 }}>
                  {c} <span style={{ opacity: 0.7 }}>({catCounts[c] || 0})</span>
                </button>
              ))}
            </div>
          )}

          {/* Панель инструментов */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
            <input
              style={{ flex: 1, minWidth: 200, border: '1px solid #e8ebf3', borderRadius: 8, padding: '8px 12px', fontSize: 14, fontFamily: 'inherit', outline: 'none' }}
              placeholder="🔍 Поиск по названию или номеру..."
              value={search} onChange={e => setSearch(e.target.value)}
            />
            <button onClick={() => setShowReceive(true)} style={{ padding: '8px 14px', border: '1px solid #16a34a', borderRadius: 8, background: '#f0fdf4', color: '#16a34a', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
              📥 Приход
            </button>
            <button onClick={() => setShowIssue(true)} style={{ padding: '8px 14px', border: '1px solid #d97706', borderRadius: 8, background: '#fffbeb', color: '#d97706', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
              📤 Расход
            </button>
            <button onClick={() => { setSelected(null); setShowModal(true) }} style={{ padding: '8px 16px', border: 'none', borderRadius: 8, background: '#4f6ef7', color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
              + Добавить
            </button>
          </div>

          {loading ? <div style={{ color: '#8596b4', fontSize: 14 }}>Загрузка...</div> : (
            <div style={{ background: '#fff', border: '1px solid #e8ebf3', borderRadius: 9, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr style={{ background: '#f8f9fc', borderBottom: '1px solid #e8ebf3' }}>
                    {['Название', 'Категория', 'Инв. №', 'Местонахождение', 'Кол-во', 'Доступно', 'Стоимость', 'Ответственный'].map(h => (
                      <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 500, color: '#8596b4', fontSize: 13 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(item => (
                    <tr key={item.id} onClick={() => { setSelected(item); setShowModal(true) }} style={{ borderBottom: '1px solid #f0f2f8', cursor: 'pointer' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#f8f9fc')}
                      onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>
                      <td style={{ padding: '9px 12px', fontWeight: 500, color: '#1a2240' }}>{item.name}</td>
                      <td style={{ padding: '9px 12px' }}>
                        {item.category && <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 10, background: catBadgeColor[item.category] || '#f0f2f8', color: '#374151' }}>{item.category}</span>}
                      </td>
                      <td style={{ padding: '9px 12px', color: '#8596b4', fontFamily: 'monospace', fontSize: 13 }}>{item.inventory_number || '—'}</td>
                      <td style={{ padding: '9px 12px', color: '#6b7280' }}>{item.location || '—'}</td>
                      <td style={{ padding: '9px 12px', color: '#374151' }}>{item.quantity}</td>
                      <td style={{ padding: '9px 12px' }}>
                        <span style={{ fontWeight: 600, color: item.quantity_available === 0 ? '#ef4444' : item.quantity_available <= 2 ? '#d97706' : '#16a34a' }}>
                          {item.quantity_available}
                        </span>
                      </td>
                      <td style={{ padding: '9px 12px', color: '#374151' }}>{item.cost ? `${item.cost.toLocaleString('ru')} ₽` : '—'}</td>
                      <td style={{ padding: '9px 12px', color: '#6b7280' }}>{(item.responsible as any)?.full_name || '—'}</td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan={8} style={{ padding: '20px', textAlign: 'center', color: '#8596b4', fontSize: 14 }}>Ничего не найдено</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {showModal && <ItemModal item={selected} staff={staff} onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); fetchAll() }} />}
      {showReceive && <ReceiveModal items={items} onClose={() => setShowReceive(false)} onSaved={() => { setShowReceive(false); fetchAll() }} />}
      {showIssue && <IssueModal items={items} staff={staff} onClose={() => setShowIssue(false)} onSaved={() => { setShowIssue(false); fetchAll() }} />}
    </div>
  )
}
