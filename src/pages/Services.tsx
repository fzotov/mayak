import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

interface Service {
  id: string
  name: string
  category: string
  description: string
  price: number
  unit: string
  vat: number
}

const emptyService: Omit<Service, 'id'> = {
  name: '', category: '', description: '', price: 0, unit: 'шт', vat: 0
}



const inp: React.CSSProperties = { width: '100%', border: '1px solid #e5e7eb', borderRadius: 6, padding: '7px 10px', fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' as const }
const lbl: React.CSSProperties = { fontSize: 12, color: '#6b7280', marginBottom: 4, display: 'block', fontWeight: 500 }

function ServiceModal({ service, categories, onClose, onSaved }: { service: Service | null; categories: string[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<Omit<Service, 'id'>>(service ? { ...service } : { ...emptyService })
  const [saving, setSaving] = useState(false)
  const [units, setUnits] = useState<string[]>([])
  const [newUnit, setNewUnit] = useState('')
  const set = (k: string, v: string | number) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    supabase.from('service_units').select('name').order('name').then(({ data }) => {
      setUnits((data || []).map((u: any) => u.name))
    })
  }, [])

  async function addUnit() {
    if (!newUnit.trim()) return
    await supabase.from('service_units').insert({ name: newUnit.trim() })
    const { data } = await supabase.from('service_units').select('name').order('name')
    setUnits((data || []).map((u: any) => u.name))
    set('unit', newUnit.trim())
    setNewUnit('')
  }

  async function deleteUnit() {
    if (!form.unit || !confirm('Удалить единицу "' + form.unit + '"?')) return
    await supabase.from('service_units').delete().eq('name', form.unit)
    const { data } = await supabase.from('service_units').select('name').order('name')
    setUnits((data || []).map((u: any) => u.name))
    set('unit', '')
  }

  async function save() {
    if (!form.name.trim()) return alert('Введите название')
    setSaving(true)
    if (service?.id) await supabase.from('services').update(form).eq('id', service.id)
    else await supabase.from('services').insert(form)
    setSaving(false)
    onSaved()
  }

  async function remove() {
    if (!service?.id || !confirm('Удалить услугу?')) return
    await supabase.from('services').delete().eq('id', service.id)
    onSaved()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#00000040', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 480, boxShadow: '0 8px 32px #0002', border: '1px solid #e5e7eb' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#111' }}>{service ? 'Редактировать услугу' : 'Новая услуга'}</div>
          <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: 18, color: '#9ca3af', cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div><label style={lbl}>Название *</label><input style={inp} value={form.name} onChange={e => set('name', e.target.value)} placeholder="Аренда офиса" /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={lbl}>Категория</label>
              <select style={inp} value={form.category} onChange={e => set('category', e.target.value)}>
                <option value="">— Выбрать</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Единица измерения</label>
              <select style={inp} value={form.unit} onChange={e => set('unit', e.target.value)}>
                <option value="">— Выбрать</option>
                {units.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
              <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                <input style={{ ...inp, flex: 1 }} value={newUnit} onChange={e => setNewUnit(e.target.value)} placeholder="Новая единица..." onKeyDown={e => e.key === 'Enter' && addUnit()} />
                <button type="button" onClick={addUnit} style={{ padding: '7px 10px', borderRadius: 6, border: 'none', background: '#111', color: '#fff', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>+</button>
              </div>
              {form.unit && <button type="button" onClick={deleteUnit} style={{ marginTop: 4, padding: '3px 8px', borderRadius: 6, border: 'none', background: '#fee2e2', color: '#ef4444', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Удалить «{form.unit}»</button>}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div><label style={lbl}>Цена (₽)</label><input style={inp} type="number" value={form.price || ''} onChange={e => set('price', Number(e.target.value))} placeholder="0" /></div>
            <div><label style={lbl}>НДС (%)</label><input style={inp} type="number" value={form.vat || ''} onChange={e => set('vat', Number(e.target.value))} placeholder="0" /></div>
          </div>
          <div><label style={lbl}>Описание</label><textarea style={{ ...inp, height: 60, resize: 'none' }} value={form.description} onChange={e => set('description', e.target.value)} /></div>
        </div>
        <div style={{ display: 'flex', gap: 8, padding: '14px 20px', borderTop: '1px solid #e5e7eb' }}>
          <button onClick={save} disabled={saving} style={{ flex: 1, padding: '8px', borderRadius: 6, border: 'none', background: '#111', color: '#fff', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
          {service && <button onClick={remove} style={{ padding: '8px 14px', borderRadius: 6, border: 'none', background: '#fee2e2', color: '#ef4444', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>Удалить</button>}
          <button onClick={onClose} style={{ padding: '8px 14px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', color: '#6b7280', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>Отмена</button>
        </div>
      </div>
    </div>
  )
}

function CatModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([])
  const [newCat, setNewCat] = useState('')

  useEffect(() => { fetchCats() }, [])

  async function fetchCats() {
    const { data } = await supabase.from('service_categories').select('*').order('name')
    setCategories(data || [])
  }

  async function addCat() {
    if (!newCat.trim()) return
    await supabase.from('service_categories').insert({ name: newCat.trim() })
    setNewCat('')
    fetchCats()
    onSaved()
  }

  async function deleteCat(id: string) {
    if (!confirm('Удалить категорию?')) return
    await supabase.from('service_categories').delete().eq('id', id)
    fetchCats()
    onSaved()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#00000040', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 380, boxShadow: '0 8px 32px #0002', border: '1px solid #e5e7eb' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#111' }}>Категории услуг</div>
          <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: 18, color: '#9ca3af', cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ padding: 20 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <input style={{ ...inp, flex: 1 }} value={newCat} onChange={e => setNewCat(e.target.value)} placeholder="Новая категория..." onKeyDown={e => e.key === 'Enter' && addCat()} />
            <button onClick={addCat} style={{ padding: '7px 14px', borderRadius: 6, border: 'none', background: '#111', color: '#fff', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>+ Добавить</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {categories.map(c => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: '#f9fafb', borderRadius: 6, border: '1px solid #e5e7eb' }}>
                <span style={{ fontSize: 14, color: '#111' }}>{c.name}</span>
                <button onClick={() => deleteCat(c.id)} style={{ border: 'none', background: 'none', color: '#ef4444', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Удалить</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Service | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [showCatModal, setShowCatModal] = useState(false)
  const [catFilter, setCatFilter] = useState('')

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [{ data: sv }, { data: cats }] = await Promise.all([
      supabase.from('services').select('*').order('category').order('name'),
      supabase.from('service_categories').select('name').order('name')
    ])
    setServices(sv || [])
    setCategories((cats || []).map((c: any) => c.name))
    setLoading(false)
  }

  const filtered = catFilter ? services.filter(s => s.category === catFilter) : services

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <select style={{ border: '1px solid #e5e7eb', borderRadius: 6, padding: '7px 12px', fontSize: 14, fontFamily: 'inherit', outline: 'none', background: '#fff' }}
          value={catFilter} onChange={e => setCatFilter(e.target.value)}>
          <option value="">Все категории</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <button onClick={() => setShowCatModal(true)} style={{ padding: '7px 14px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', color: '#374151', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
          Категории
        </button>
        <div style={{ flex: 1 }} />
        <button onClick={() => { setSelected(null); setShowModal(true) }} style={{ padding: '7px 16px', border: 'none', borderRadius: 6, background: '#111', color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
          + Добавить услугу
        </button>
      </div>

      {loading ? <div style={{ color: '#9ca3af', fontSize: 14 }}>Загрузка...</div> : (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                {['Название', 'Категория', 'Цена', 'Единица', 'НДС', 'Описание'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 500, color: '#6b7280', fontSize: 12 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => (
                <tr key={s.id} onClick={() => { setSelected(s); setShowModal(true) }} style={{ borderBottom: '1px solid #f3f4f6', cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f9fafb')}
                  onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>
                  <td style={{ padding: '10px 14px', fontWeight: 500, color: '#111' }}>{s.name}</td>
                  <td style={{ padding: '10px 14px' }}>
                    {s.category && <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 10, background: '#f3f4f6', color: '#374151' }}>{s.category}</span>}
                  </td>
                  <td style={{ padding: '10px 14px', color: '#111', fontWeight: 500 }}>{s.price ? `${s.price.toLocaleString('ru')} ₽` : '—'}</td>
                  <td style={{ padding: '10px 14px', color: '#6b7280' }}>{s.unit}</td>
                  <td style={{ padding: '10px 14px', color: '#6b7280' }}>{s.vat ? `${s.vat}%` : '—'}</td>
                  <td style={{ padding: '10px 14px', color: '#9ca3af', fontSize: 13 }}>{s.description || '—'}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} style={{ padding: 20, textAlign: 'center', color: '#9ca3af' }}>Услуги не найдены</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showModal && <ServiceModal service={selected} categories={categories} onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); fetchAll() }} />}
      {showCatModal && <CatModal onClose={() => setShowCatModal(false)} onSaved={fetchAll} />}
    </div>
  )
}
