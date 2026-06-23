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
  action: string
  quantity: number
  note: string
  created_at: string
  staff?: { full_name: string }
}

interface Staff { id: string; full_name: string }

const emptyItem: Omit<Item, 'id' | 'responsible'> = {
  name: '', category: '', description: '', quantity: 1, quantity_available: 1,
  location: '', cost: 0, serial_number: '', inventory_number: '',
  responsible_id: null, supplier: '', received_at: '', notes: ''
}

const inp: React.CSSProperties = { width: '100%', border: '1px solid #e8ebf3', borderRadius: 7, padding: '8px 10px', fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' as const }
const lbl: React.CSSProperties = { fontSize: 12, color: '#8596b4', marginBottom: 4, display: 'block', fontWeight: 500 }

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
      const r = await supabase.from('inventory').update(cleanForm).eq('id', item.id)
      if (r.error) { alert('Ошибка: ' + r.error.message); setSaving(false); return }
    } else {
      const r = await supabase.from('inventory').insert(cleanForm)
      if (r.error) { alert('Ошибка: ' + r.error.message); setSaving(false); return }
    }
    setSaving(false)
    onSaved()
  }

  async function remove() {
    if (!item?.id || !confirm('Удалить товар?')) return
    await supabase.from('inventory').delete().eq('id', item.id)
    onSaved()
  }

  async function issueItem() {
    if (!item?.id || !issueStaff) return alert('Выберите сотрудника')
    await supabase.from('inventory_movements').insert({
      item_id: item.id, staff_id: issueStaff, action: 'issued', quantity: issueQty, note: issueNote
    })
    await supabase.from('inventory').update({ quantity_available: (item.quantity_available || 0) - issueQty }).eq('id', item.id)
    setIssueStaff(''); setIssueNote(''); setIssueQty(1)
    fetchMovements()
    onSaved()
  }

  async function returnItem(qty: number) {
    if (!item?.id) return
    await supabase.from('inventory_movements').insert({
      item_id: item.id, action: 'returned', quantity: qty, note: 'Возврат'
    })
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
                  <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#fff', border: '1px solid #e8ebf3', borderRadius: 8, borderLeft: `3px solid ${m.action === 'issued' ? '#f59e0b' : '#22c55e'}` }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: '#1a2240' }}>{m.action === 'issued' ? '📤 Выдано' : '📥 Возврат'} — {m.quantity} шт.</div>
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

export default function InventoryPage() {
  const [items, setItems] = useState<Item[]>([])
  const [staff, setStaff] = useState<Staff[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Item | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('')

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

  const catColors = ['#dbeafe','#ede9fe','#fef3c7','#dcfce7','#fee2e2','#f0f2f8','#fde68a','#d1fae5']
  const catBadgeColor = Object.fromEntries(categories.map((c, i) => [c, catColors[i % catColors.length]]))

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
        <input
          style={{ flex: 1, minWidth: 200, border: '1px solid #e8ebf3', borderRadius: 8, padding: '8px 12px', fontSize: 14, fontFamily: 'inherit', outline: 'none' }}
          placeholder="🔍 Поиск по названию или номеру..."
          value={search} onChange={e => setSearch(e.target.value)}
        />
        <select
          style={{ border: '1px solid #e8ebf3', borderRadius: 8, padding: '8px 12px', fontSize: 14, fontFamily: 'inherit', outline: 'none', background: '#fff' }}
          value={catFilter} onChange={e => setCatFilter(e.target.value)}
        >
          <option value="">Все категории</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
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
                    <span style={{ fontWeight: 600, color: item.quantity_available === 0 ? '#ef4444' : item.quantity_available < item.quantity ? '#d97706' : '#16a34a' }}>
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

      {showModal && <ItemModal item={selected} staff={staff} onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); fetchAll() }} />}
    </div>
  )
}
