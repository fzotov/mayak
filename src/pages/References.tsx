import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

const c = {
  bg: '#f0f2f8',
  card: '#fff',
  accent: '#4f6ef7',
  text: '#1a2240',
  gray: '#8596b4',
  border: '#e8ebf3',
}

const inp: React.CSSProperties = {
  width: '100%', border: `1px solid ${c.border}`, borderRadius: 6,
  padding: '7px 10px', fontSize: 14, fontFamily: 'inherit',
  outline: 'none', boxSizing: 'border-box', color: c.text,
}
const lbl: React.CSSProperties = { fontSize: 12, color: c.gray, marginBottom: 4, display: 'block', fontWeight: 500 }

// ─── ТАРИФЫ ───────────────────────────────────────────────────────────────────

const KEY_LABELS: Record<string, string> = {
  electricity_markup: 'Надбавка к тарифу электроэнергии',
  electricity_tariff: 'Тариф электроэнергии',
  cold_water_tariff: 'Тариф холодной воды',
  hot_water_tariff: 'Тариф горячей воды',
  cleaning_price: 'Стоимость уборки',
}
const KEY_UNITS: Record<string, string> = {
  electricity_markup: '%',
  electricity_tariff: 'руб/кВт·ч',
  cold_water_tariff: 'руб/м³',
  hot_water_tariff: 'руб/м³',
  cleaning_price: 'руб/помещение',
}
const KEY_ICONS: Record<string, string> = {
  electricity_markup: '⚡',
  electricity_tariff: '⚡',
  cold_water_tariff: '💧',
  hot_water_tariff: '🔥',
  cleaning_price: '🧹',
}

interface Setting { id: string; key: string; value: number; description: string; valid_from: string; created_at: string; created_by?: string }

function TariffsSection() {
  const [settings, setSettings] = useState<Setting[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<string | null>(null)
  const [newValue, setNewValue] = useState('')
  const [validFrom, setValidFrom] = useState(new Date().toISOString().slice(0, 10))
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)

  async function fetch() {
    const res = await window.fetch(SUPABASE_URL + '/rest/v1/settings?order=key,valid_from.desc', {
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY }
    })
    setSettings(await res.json())
    setLoading(false)
  }

  useEffect(() => { fetch() }, [])

  const getCurrent = (key: string) =>
    settings.filter(s => s.key === key).sort((a, b) => b.valid_from.localeCompare(a.valid_from))[0]

  const getHistory = (key: string) =>
    settings.filter(s => s.key === key).sort((a, b) => b.valid_from.localeCompare(a.valid_from))

  async function save(key: string) {
    if (!newValue) return
    setSaving(true)
    await window.fetch(SUPABASE_URL + '/rest/v1/settings', {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify({ key, value: parseFloat(newValue), description: KEY_LABELS[key], valid_from: validFrom, created_by: 'admin' })
    })
    await fetch()
    setEditing(null); setNewValue(''); setSaving(false)
    setSuccess('Сохранено. Новые значение применится к новым счетам.')
    setTimeout(() => setSuccess(''), 4000)
  }

  const uniqueKeys = [...new Set(settings.map(s => s.key))]

  if (loading) return <div style={{ color: c.gray, fontSize: 14 }}>Загрузка...</div>

  return (
    <div>
      <div style={{ fontSize: 13, color: c.gray, marginBottom: 16 }}>
        История изменений сохраняется — старые счета пересчитываться не будут.
      </div>

      {success && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 14, color: '#16a34a' }}>
          ✓ {success}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {uniqueKeys.map(key => {
          const current = getCurrent(key)
          const history = getHistory(key)
          const isEditing = editing === key
          const isExpanded = expanded === key

          return (
            <div key={key} style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ fontSize: 20, width: 36, height: 36, background: '#f0f2f8', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {KEY_ICONS[key] || '📋'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: c.text }}>{KEY_LABELS[key] || key}</div>
                  <div style={{ fontSize: 12, color: c.gray, marginTop: 2 }}>с {current?.valid_from}</div>
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, color: c.text, marginRight: 8 }}>
                  {current?.value} <span style={{ fontSize: 13, color: c.gray, fontWeight: 400 }}>{KEY_UNITS[key]}</span>
                </div>
                <button onClick={() => setExpanded(isExpanded ? null : key)}
                  style={{ border: `1px solid ${c.border}`, background: '#fff', borderRadius: 6, padding: '5px 10px', fontSize: 12, color: c.gray, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {isExpanded ? '▲ Скрыть' : '▼ История'}
                </button>
                {isEditing
                  ? <button onClick={() => setEditing(null)} style={{ padding: '5px 12px', border: `1px solid ${c.border}`, borderRadius: 6, background: '#fff', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', color: c.gray }}>Отмена</button>
                  : <button onClick={() => { setEditing(key); setNewValue(String(current?.value || '')) }}
                      style={{ padding: '5px 14px', border: 'none', borderRadius: 6, background: c.accent, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', color: '#fff', fontWeight: 500 }}>
                      Изменить
                    </button>
                }
              </div>

              {isEditing && (
                <div style={{ padding: '14px 18px', background: '#fffbeb', borderTop: `1px solid ${c.border}` }}>
                  <div style={{ fontSize: 13, color: '#92400e', marginBottom: 12 }}>
                    ⚠️ Новое значение применится только к новым счетам. Старые счета останутся неизменными.
                  </div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    <div>
                      <div style={lbl}>Новое значение ({KEY_UNITS[key]})</div>
                      <input style={{ ...inp, width: 140 }} type="number" step="0.01" value={newValue} onChange={e => setNewValue(e.target.value)} />
                    </div>
                    <div>
                      <div style={lbl}>Действует с</div>
                      <input style={{ ...inp, width: 150 }} type="date" value={validFrom} onChange={e => setValidFrom(e.target.value)} />
                    </div>
                    <button onClick={() => save(key)} disabled={saving}
                      style={{ padding: '7px 18px', border: 'none', borderRadius: 6, background: '#16a34a', color: '#fff', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500, opacity: saving ? 0.6 : 1 }}>
                      {saving ? 'Сохранение...' : 'Сохранить'}
                    </button>
                  </div>
                </div>
              )}

              {isExpanded && (
                <div style={{ padding: '10px 18px', borderTop: `1px solid ${c.border}`, background: '#fafbff' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: c.gray, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>История изменений</div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr>{['Дата начала', 'Значение', 'Кто изменил', 'Записано'].map(h => (
                        <th key={h} style={{ padding: '4px 8px', textAlign: 'left', color: c.gray, fontWeight: 500, fontSize: 12 }}>{h}</th>
                      ))}</tr>
                    </thead>
                    <tbody>
                      {history.map((h, i) => (
                        <tr key={h.id} style={{ borderTop: `1px solid ${c.border}` }}>
                          <td style={{ padding: '6px 8px', color: i === 0 ? c.text : c.gray, fontWeight: i === 0 ? 600 : 400 }}>{h.valid_from}</td>
                          <td style={{ padding: '6px 8px', fontWeight: i === 0 ? 600 : 400, color: i === 0 ? c.accent : c.gray }}>{h.value} {KEY_UNITS[key]}</td>
                          <td style={{ padding: '6px 8px', color: c.gray }}>{h.created_by || 'admin'}</td>
                          <td style={{ padding: '6px 8px', color: '#9ca3af' }}>{h.created_at?.slice(0, 10)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── УСЛУГИ ───────────────────────────────────────────────────────────────────

interface Service { id: string; name: string; category: string; description: string; price: number; unit: string; vat: number }
const emptyService: Omit<Service, 'id'> = { name: '', category: '', description: '', price: 0, unit: 'шт', vat: 0 }

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
    set('unit', newUnit.trim()); setNewUnit('')
  }

  async function save() {
    if (!form.name.trim()) return alert('Введите название')
    setSaving(true)
    if (service?.id) await supabase.from('services').update(form).eq('id', service.id)
    else await supabase.from('services').insert(form)
    setSaving(false); onSaved()
  }

  async function remove() {
    if (!service?.id || !confirm('Удалить услугу?')) return
    await supabase.from('services').delete().eq('id', service.id)
    onSaved()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#00000050', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 480, boxShadow: '0 8px 32px #0003', border: `1px solid ${c.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: `1px solid ${c.border}` }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: c.text }}>{service ? 'Редактировать услугу' : 'Новая услуга'}</div>
          <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: 18, color: c.gray, cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div><label style={lbl}>Название *</label><input style={inp} value={form.name} onChange={e => set('name', e.target.value)} placeholder="Аренда офиса" autoFocus /></div>
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
                <input style={{ ...inp, flex: 1 }} value={newUnit} onChange={e => setNewUnit(e.target.value)} placeholder="Добавить единицу..." onKeyDown={e => e.key === 'Enter' && addUnit()} />
                <button type="button" onClick={addUnit} style={{ padding: '7px 10px', borderRadius: 6, border: 'none', background: '#111', color: '#fff', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>+</button>
              </div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div><label style={lbl}>Цена (₽)</label><input style={inp} type="number" value={form.price || ''} onChange={e => set('price', Number(e.target.value))} placeholder="0" /></div>
            <div><label style={lbl}>НДС (%)</label><input style={inp} type="number" value={form.vat || ''} onChange={e => set('vat', Number(e.target.value))} placeholder="0" /></div>
          </div>
          <div><label style={lbl}>Описание</label><textarea style={{ ...inp, height: 60, resize: 'none' } as any} value={form.description} onChange={e => set('description', e.target.value)} /></div>
        </div>
        <div style={{ display: 'flex', gap: 8, padding: '14px 20px', borderTop: `1px solid ${c.border}` }}>
          <button onClick={save} disabled={saving} style={{ flex: 1, padding: '8px', borderRadius: 6, border: 'none', background: '#111', color: '#fff', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
          {service && <button onClick={remove} style={{ padding: '8px 14px', borderRadius: 6, border: 'none', background: '#fee2e2', color: '#ef4444', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>Удалить</button>}
          <button onClick={onClose} style={{ padding: '8px 14px', borderRadius: 6, border: `1px solid ${c.border}`, background: '#fff', color: c.gray, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>Отмена</button>
        </div>
      </div>
    </div>
  )
}

function ServicesSection() {
  const [services, setServices] = useState<Service[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Service | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [catFilter, setCatFilter] = useState('')
  const [search, setSearch] = useState('')

  async function load() {
    setLoading(true)
    const [{ data: sv }, { data: cats }] = await Promise.all([
      supabase.from('services').select('*').order('category').order('name'),
      supabase.from('service_categories').select('name').order('name')
    ])
    setServices(sv || [])
    setCategories((cats || []).map((c: any) => c.name))
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = services.filter(s => {
    if (catFilter && s.category !== catFilter) return false
    if (search && !s.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const grouped = categories.length > 0
    ? categories.reduce((acc, cat) => {
        const items = filtered.filter(s => s.category === cat)
        if (items.length > 0 || !catFilter) acc[cat] = items
        return acc
      }, {} as Record<string, Service[]>)
    : { '': filtered }

  const uncategorized = filtered.filter(s => !s.category)

  if (loading) return <div style={{ color: c.gray, fontSize: 14 }}>Загрузка...</div>

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <input style={{ ...inp, width: 200 }} value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Поиск услуги..." />
        <select style={{ border: `1px solid ${c.border}`, borderRadius: 6, padding: '7px 12px', fontSize: 14, fontFamily: 'inherit', outline: 'none', background: '#fff', color: c.text }}
          value={catFilter} onChange={e => setCatFilter(e.target.value)}>
          <option value="">Все категории</option>
          {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
        </select>
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 13, color: c.gray }}>{filtered.length} услуг</div>
        <button onClick={() => { setSelected(null); setShowModal(true) }} style={{ padding: '7px 16px', border: 'none', borderRadius: 6, background: '#111', color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
          + Добавить услугу
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {Object.entries(grouped).map(([cat, items]) => items.length === 0 ? null : (
          <div key={cat} style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 10, overflow: 'hidden' }}>
            {cat && <div style={{ padding: '10px 16px', background: '#fafbff', borderBottom: `1px solid ${c.border}`, fontSize: 12, fontWeight: 600, color: c.gray, textTransform: 'uppercase', letterSpacing: '.5px' }}>{cat}</div>}
            {items.map((s, i) => (
              <div key={s.id} onClick={() => { setSelected(s); setShowModal(true) }}
                style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', borderTop: i > 0 ? `1px solid ${c.border}` : 'none', transition: 'background .1s' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#f8f9fc')}
                onMouseLeave={e => (e.currentTarget.style.background = '')}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: c.text }}>{s.name}</div>
                  {s.description && <div style={{ fontSize: 12, color: c.gray, marginTop: 2 }}>{s.description}</div>}
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  {s.price ? <div style={{ fontSize: 14, fontWeight: 600, color: c.text }}>{s.price.toLocaleString('ru')} ₽</div> : null}
                  <div style={{ fontSize: 12, color: c.gray }}>{s.unit}{s.vat ? ` · НДС ${s.vat}%` : ''}</div>
                </div>
                <div style={{ color: c.gray, fontSize: 16 }}>›</div>
              </div>
            ))}
          </div>
        ))}

        {uncategorized.length > 0 && (
          <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ padding: '10px 16px', background: '#fafbff', borderBottom: `1px solid ${c.border}`, fontSize: 12, fontWeight: 600, color: c.gray, textTransform: 'uppercase', letterSpacing: '.5px' }}>Без категории</div>
            {uncategorized.map((s, i) => (
              <div key={s.id} onClick={() => { setSelected(s); setShowModal(true) }}
                style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', borderTop: i > 0 ? `1px solid ${c.border}` : 'none' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#f8f9fc')}
                onMouseLeave={e => (e.currentTarget.style.background = '')}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: c.text }}>{s.name}</div>
                  {s.description && <div style={{ fontSize: 12, color: c.gray, marginTop: 2 }}>{s.description}</div>}
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  {s.price ? <div style={{ fontSize: 14, fontWeight: 600, color: c.text }}>{s.price.toLocaleString('ru')} ₽</div> : null}
                  <div style={{ fontSize: 12, color: c.gray }}>{s.unit}</div>
                </div>
                <div style={{ color: c.gray, fontSize: 16 }}>›</div>
              </div>
            ))}
          </div>
        )}

        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: c.gray, background: c.card, borderRadius: 10, border: `1px solid ${c.border}` }}>
            Услуги не найдены
          </div>
        )}
      </div>

      {showModal && <ServiceModal service={selected} categories={categories} onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); load() }} />}
    </div>
  )
}

// ─── КАТЕГОРИИ УСЛУГ ──────────────────────────────────────────────────────────

function CategoriesSection() {
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [newCat, setNewCat] = useState('')
  const [adding, setAdding] = useState(false)

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('service_categories').select('*').order('name')
    setCategories(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function add() {
    if (!newCat.trim()) return
    setAdding(true)
    await supabase.from('service_categories').insert({ name: newCat.trim() })
    setNewCat(''); setAdding(false); load()
  }

  async function remove(id: string, name: string) {
    if (!confirm(`Удалить категорию «${name}»?`)) return
    await supabase.from('service_categories').delete().eq('id', id)
    load()
  }

  if (loading) return <div style={{ color: c.gray, fontSize: 14 }}>Загрузка...</div>

  return (
    <div style={{ maxWidth: 480 }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input style={{ ...inp, flex: 1 }} value={newCat} onChange={e => setNewCat(e.target.value)}
          placeholder="Название категории..." onKeyDown={e => e.key === 'Enter' && add()} autoFocus />
        <button onClick={add} disabled={adding} style={{ padding: '7px 16px', borderRadius: 6, border: 'none', background: '#111', color: '#fff', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500, opacity: adding ? 0.6 : 1 }}>
          + Добавить
        </button>
      </div>

      <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 10, overflow: 'hidden' }}>
        {categories.length === 0
          ? <div style={{ padding: 24, textAlign: 'center', color: c.gray, fontSize: 14 }}>Категорий нет — добавьте первую</div>
          : categories.map((cat, i) => (
            <div key={cat.id} style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', borderTop: i > 0 ? `1px solid ${c.border}` : 'none' }}>
              <div style={{ width: 28, height: 28, borderRadius: 6, background: '#f0f2f8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, marginRight: 12, flexShrink: 0 }}>◈</div>
              <div style={{ flex: 1, fontSize: 14, color: c.text, fontWeight: 500 }}>{cat.name}</div>
              <button onClick={() => remove(cat.id, cat.name)} style={{ border: 'none', background: 'none', color: '#ef4444', fontSize: 13, cursor: 'pointer', padding: '4px 8px', borderRadius: 4, fontFamily: 'inherit' }}>
                Удалить
              </button>
            </div>
          ))
        }
      </div>
    </div>
  )
}

// ─── ЕДИНИЦЫ ИЗМЕРЕНИЯ ────────────────────────────────────────────────────────

function UnitsSection() {
  const [units, setUnits] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [newUnit, setNewUnit] = useState('')
  const [adding, setAdding] = useState(false)

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('service_units').select('*').order('name')
    setUnits(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function add() {
    if (!newUnit.trim()) return
    setAdding(true)
    await supabase.from('service_units').insert({ name: newUnit.trim() })
    setNewUnit(''); setAdding(false); load()
  }

  async function remove(id: string, name: string) {
    if (!confirm(`Удалить единицу «${name}»?`)) return
    await supabase.from('service_units').delete().eq('id', id)
    load()
  }

  if (loading) return <div style={{ color: c.gray, fontSize: 14 }}>Загрузка...</div>

  return (
    <div style={{ maxWidth: 480 }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input style={{ ...inp, flex: 1 }} value={newUnit} onChange={e => setNewUnit(e.target.value)}
          placeholder="Например: шт, м², кВт·ч..." onKeyDown={e => e.key === 'Enter' && add()} autoFocus />
        <button onClick={add} disabled={adding} style={{ padding: '7px 16px', borderRadius: 6, border: 'none', background: '#111', color: '#fff', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500, opacity: adding ? 0.6 : 1 }}>
          + Добавить
        </button>
      </div>

      <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 10, overflow: 'hidden' }}>
        {units.length === 0
          ? <div style={{ padding: 24, textAlign: 'center', color: c.gray, fontSize: 14 }}>Единиц измерения нет</div>
          : units.map((u, i) => (
            <div key={u.id} style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', borderTop: i > 0 ? `1px solid ${c.border}` : 'none' }}>
              <div style={{ flex: 1, fontSize: 14, color: c.text, fontWeight: 500, fontFamily: 'monospace' }}>{u.name}</div>
              <button onClick={() => remove(u.id, u.name)} style={{ border: 'none', background: 'none', color: '#ef4444', fontSize: 13, cursor: 'pointer', padding: '4px 8px', borderRadius: 4, fontFamily: 'inherit' }}>
                Удалить
              </button>
            </div>
          ))
        }
      </div>
    </div>
  )
}

// ─── ГЛАВНАЯ СТРАНИЦА ─────────────────────────────────────────────────────────

const SECTIONS = [
  { id: 'services', label: 'Услуги', icon: '◈', desc: 'Прайс-лист услуг' },
  { id: 'tariffs', label: 'Тарифы и нормативы', icon: '⚡', desc: 'Тарифы с историей изменений' },
  { id: 'categories', label: 'Категории услуг', icon: '📂', desc: 'Группировка услуг' },
  { id: 'units', label: 'Единицы измерения', icon: '📐', desc: 'шт, м², кВт·ч...' },
]

export default function ReferencesPage() {
  const [active, setActive] = useState('services')
  const section = SECTIONS.find(s => s.id === active)!

  return (
    <div style={{ display: 'flex', gap: 0, minHeight: 'calc(100vh - 80px)' }}>
      {/* Боковая навигация */}
      <div style={{ width: 220, flexShrink: 0, marginRight: 20 }}>
        <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 10, overflow: 'hidden' }}>
          {SECTIONS.map((s, i) => (
            <button key={s.id} onClick={() => setActive(s.id)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
                background: active === s.id ? '#f0f2f8' : 'transparent',
                border: 'none', borderTop: i > 0 ? `1px solid ${c.border}` : 'none',
                cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                borderLeft: active === s.id ? `3px solid ${c.accent}` : '3px solid transparent',
              }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>{s.icon}</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: active === s.id ? 600 : 500, color: active === s.id ? c.accent : c.text }}>{s.label}</div>
                <div style={{ fontSize: 11, color: c.gray, marginTop: 1 }}>{s.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Контент */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>{section.icon}</span>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, color: c.text }}>{section.label}</div>
            <div style={{ fontSize: 12, color: c.gray }}>{section.desc}</div>
          </div>
        </div>

        {active === 'services' && <ServicesSection />}
        {active === 'tariffs' && <TariffsSection />}
        {active === 'categories' && <CategoriesSection />}
        {active === 'units' && <UnitsSection />}
      </div>
    </div>
  )
}
