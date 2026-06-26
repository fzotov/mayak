import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

interface Unit {
  id: string
  number: string
  floor: number
  area: number
  has_window: boolean
  rooms_count: number
  type: string
  status: string
  rent_rate: number
  panorama_url: string
  description: string
}

const TYPES: Record<string, { label: string; icon: string }> = {
  office: { label: 'Офис', icon: '🏢' },
  storage: { label: 'Склад', icon: '📦' },
  corridor: { label: 'Коридор', icon: '🚶' },
  common: { label: 'Общее', icon: '🏛' },
  other: { label: 'Другое', icon: '📋' },
}

const STATUS: Record<string, { label: string; bg: string; color: string }> = {
  free: { label: 'Свободно', bg: '#dcfce7', color: '#16a34a' },
  occupied: { label: 'Занято', bg: '#fee2e2', color: '#ef4444' },
  reserved: { label: 'Резерв', bg: '#fef3c7', color: '#d97706' },
}

const SI: React.CSSProperties = { width: '100%', border: '1px solid #e5e7eb', borderRadius: 6, padding: '7px 10px', fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' as const }
const SL: React.CSSProperties = { fontSize: 12, color: '#6b7280', marginBottom: 4, display: 'block', fontWeight: 500 }

function UnitForm({ unit, onBack }: { unit: any; onBack: () => void }) {
  const [form, setForm] = useState({
    number: unit?.number || '',
    floor: unit?.floor || 2,
    area: unit?.area || 0,
    has_window: unit?.has_window ?? true,
    rooms_count: unit?.rooms_count || 1,
    type: unit?.type || 'office',
    status: unit?.status || 'free',
    rent_rate: unit?.rent_rate || 0,
    panorama_url: unit?.panorama_url || '',
    description: unit?.description || '',
  })
  const [saving, setSaving] = useState(false)
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  async function save() {
    if (!form.number) return alert('Введите номер помещения')
    setSaving(true)
    const { error } = unit?.id
      ? await supabase.from('units').update(form).eq('id', unit.id)
      : await supabase.from('units').insert(form)
    setSaving(false)
    if (error) { alert('Ошибка сохранения: ' + error.message); return }
    onBack()
  }

  async function remove() {
    if (!unit?.id || !confirm('Удалить помещение?')) return
    const { error } = await supabase.from('units').delete().eq('id', unit.id)
    if (error) { alert('Ошибка удаления: ' + error.message); return }
    onBack()
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <button onClick={onBack} style={{ border: 'none', background: 'none', color: '#6b7280', fontSize: 14, cursor: 'pointer', marginBottom: 16, fontFamily: 'inherit' }}>← Назад</button>
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <div><label style={SL}>Номер *</label><input style={SI} value={form.number} onChange={e => set('number', e.target.value)} placeholder="201" /></div>
          <div><label style={SL}>Этаж</label><input style={SI} type="number" value={form.floor} onChange={e => set('floor', Number(e.target.value))} /></div>
          <div><label style={SL}>Площадь (м²)</label><input style={SI} type="number" value={form.area || ''} onChange={e => set('area', Number(e.target.value))} /></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div><label style={SL}>Тип</label>
            <select style={SI} value={form.type} onChange={e => set('type', e.target.value)}>
              {Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
            </select>
          </div>
          <div><label style={SL}>Статус</label>
            <select style={SI} value={form.status} onChange={e => set('status', e.target.value)}>
              {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div><label style={SL}>Кол-во комнат</label><input style={SI} type="number" value={form.rooms_count} onChange={e => set('rooms_count', Number(e.target.value))} /></div>
          <div><label style={SL}>Арендная ставка (₽/м²)</label><input style={SI} type="number" value={form.rent_rate || ''} onChange={e => set('rent_rate', Number(e.target.value))} /></div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input type="checkbox" id="window" checked={form.has_window} onChange={e => set('has_window', e.target.checked)} style={{ width: 16, height: 16, cursor: 'pointer' }} />
          <label htmlFor="window" style={{ fontSize: 14, color: '#374151', cursor: 'pointer' }}>Есть окно</label>
        </div>
        <div><label style={SL}>Ссылка на панораму 3D</label><input style={SI} value={form.panorama_url} onChange={e => set('panorama_url', e.target.value)} placeholder="https://..." /></div>
        <div><label style={SL}>Описание</label><textarea style={{ ...SI, height: 70, resize: 'none' }} value={form.description} onChange={e => set('description', e.target.value)} /></div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={save} disabled={saving} style={{ flex: 1, padding: '8px', borderRadius: 6, border: 'none', background: '#111', color: '#fff', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
          {unit && <button onClick={remove} style={{ padding: '8px 14px', borderRadius: 6, border: 'none', background: '#fee2e2', color: '#ef4444', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>Удалить</button>}
          <button onClick={onBack} style={{ padding: '8px 14px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', color: '#6b7280', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>Отмена</button>
        </div>
      </div>
    </div>
  )
}

export default function UnitsPage() {
  const [units, setUnits] = useState<Unit[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<any>(null)
  const [view, setView] = useState<'list' | 'edit'>('list')
  const [floorFilter, setFloorFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('units').select('*').order('floor').order('number')
    setUnits(data || [])
    setLoading(false)
  }

  if (view === 'edit') return <UnitForm unit={selected} onBack={() => { setView('list'); load() }} />

  const floors = [...new Set(units.map(u => u.floor).filter(Boolean))].sort()
  const filtered = units.filter(u => {
    if (floorFilter && String(u.floor) !== floorFilter) return false
    if (statusFilter && u.status !== statusFilter) return false
    if (typeFilter && u.type !== typeFilter) return false
    return true
  })

  const stats = {
    total: units.length,
    free: units.filter(u => u.status === 'free').length,
    occupied: units.filter(u => u.status === 'occupied').length,
    totalArea: units.reduce((s, u) => s + (u.area || 0), 0),
  }

  return (
    <div>
      {/* Статистика */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
        {[
          { label: 'Всего помещений', value: stats.total, color: '#111' },
          { label: 'Свободно', value: stats.free, color: '#16a34a' },
          { label: 'Занято', value: stats.occupied, color: '#ef4444' },
          { label: 'Общая площадь', value: `${stats.totalArea.toLocaleString('ru')} м²`, color: '#111' },
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '12px 16px' }}>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 20, fontWeight: 600, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Фильтры */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <select style={{ border: '1px solid #e5e7eb', borderRadius: 6, padding: '7px 12px', fontSize: 14, fontFamily: 'inherit', outline: 'none', background: '#fff' }}
          value={floorFilter} onChange={e => setFloorFilter(e.target.value)}>
          <option value="">Все этажи</option>
          {floors.map(f => <option key={f} value={String(f)}>{f} этаж</option>)}
        </select>
        <select style={{ border: '1px solid #e5e7eb', borderRadius: 6, padding: '7px 12px', fontSize: 14, fontFamily: 'inherit', outline: 'none', background: '#fff' }}
          value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">Все статусы</option>
          {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select style={{ border: '1px solid #e5e7eb', borderRadius: 6, padding: '7px 12px', fontSize: 14, fontFamily: 'inherit', outline: 'none', background: '#fff' }}
          value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="">Все типы</option>
          {Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
        </select>
        <div style={{ flex: 1 }} />
        <button onClick={() => { setSelected(null); setView('edit') }} style={{ padding: '7px 16px', border: 'none', borderRadius: 6, background: '#111', color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
          + Добавить помещение
        </button>
      </div>

      {loading ? <div style={{ color: '#9ca3af', fontSize: 14 }}>Загрузка...</div> : (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                {['№', 'Этаж', 'Тип', 'Площадь', 'Комнат', 'Окно', 'Ставка', 'Статус', ''].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 500, color: '#6b7280', fontSize: 12 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => {
                const t = TYPES[u.type] || TYPES.other
                const st = STATUS[u.status] || STATUS.free
                return (
                  <tr key={u.id} style={{ borderBottom: '1px solid #f3f4f6', cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f9fafb')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>
                    <td style={{ padding: '10px 14px', fontWeight: 600, color: '#111' }}>{u.number}</td>
                    <td style={{ padding: '10px 14px', color: '#6b7280' }}>{u.floor || '—'}</td>
                    <td style={{ padding: '10px 14px' }}>{t.icon} {t.label}</td>
                    <td style={{ padding: '10px 14px', color: '#374151' }}>{u.area ? `${u.area} м²` : '—'}</td>
                    <td style={{ padding: '10px 14px', color: '#374151' }}>{u.rooms_count || 1}</td>
                    <td style={{ padding: '10px 14px' }}>{u.has_window ? '✓' : '—'}</td>
                    <td style={{ padding: '10px 14px', color: '#374151' }}>{u.rent_rate ? `${u.rent_rate.toLocaleString('ru')} ₽` : '—'}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 10, background: st.bg, color: st.color }}>{st.label}</span>
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => { setSelected(u); setView('edit') }} style={{ border: '1px solid #e5e7eb', background: '#fff', borderRadius: 6, padding: '4px 10px', fontSize: 12, color: '#374151', cursor: 'pointer' }}>✎</button>
                        {u.panorama_url && <a href={u.panorama_url} target="_blank" rel="noopener noreferrer" style={{ border: '1px solid #e5e7eb', background: '#fff', borderRadius: 6, padding: '4px 10px', fontSize: 12, color: '#374151', cursor: 'pointer', textDecoration: 'none' }}>3D</a>}
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={9} style={{ padding: 20, textAlign: 'center', color: '#9ca3af' }}>Помещений не найдено</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
