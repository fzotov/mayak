import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

interface Meter {
  id: string
  number: string
  type: string
  unit_id: string | null
  location: string
  area: number
  tariff: number
  heat_tariff: number
  notes: string
  serial: string
}

interface Reading {
  id: string
  meter_id: string
  period: string
  prev_value: number
  curr_value: number
  consumption: number
  amount: number
  photo_url: string
  notes: string
}

interface Unit { id: string; number: string }

const METER_TYPES: Record<string, { label: string; icon: string; unit: string }> = {
  electricity: { label: 'Электричество', icon: '⚡', unit: 'кВт·ч' },
  cold_water: { label: 'Холодная вода', icon: '💧', unit: 'м³' },
  hot_water: { label: 'Горячая вода', icon: '🔥', unit: 'м³' },
  heat: { label: 'Тепло', icon: '🌡', unit: 'Гкал' },
  gas: { label: 'Газ', icon: '🔆', unit: 'м³' },
  boiler: { label: 'Бойлер (вода+эл)', icon: '♨️', unit: 'м³/кВт·ч' },
  common_electricity: { label: 'Общий эл.', icon: '⚡', unit: 'кВт·ч' },
  common_water: { label: 'Общий вода', icon: '💧', unit: 'м³' },
  common_heat: { label: 'Общее тепло', icon: '🌡', unit: 'Гкал' },
}

const inp: React.CSSProperties = { width: '100%', border: '1px solid #e5e7eb', borderRadius: 6, padding: '7px 10px', fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' as const }
const lbl: React.CSSProperties = { fontSize: 12, color: '#6b7280', marginBottom: 4, display: 'block', fontWeight: 500 }

function ReadingModal({ meter, onClose, onSaved }: { meter: Meter; onClose: () => void; onSaved: () => void }) {
  const [readings, setReadings] = useState<Reading[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ period: new Date().toISOString().slice(0, 7) + '-01', prev_value: 0, curr_value: 0, notes: '' })
  const [saving, setSaving] = useState(false)
  const [photo, setPhoto] = useState<File | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const mt = METER_TYPES[meter.type] || { label: meter.type, icon: '📊', unit: '' }

  useEffect(() => { fetchReadings() }, [])

  async function fetchReadings() {
    const { data } = await supabase.from('meter_readings').select('*').eq('meter_id', meter.id).order('period', { ascending: false })
    setReadings(data || [])
    if (data && data.length > 0) {
      setForm(f => ({ ...f, prev_value: data[0].curr_value }))
    }
  }

  function calcAmount(consumption: number) {
    if (meter.type === 'heat') {
      return consumption * meter.heat_tariff * (meter.area || 1)
    }
    return consumption * meter.tariff
  }

  const consumption = Math.max(0, form.curr_value - form.prev_value)
  const amount = calcAmount(consumption)

  async function save() {
    setSaving(true)
    await supabase.from('meter_readings').insert({
      meter_id: meter.id,
      period: form.period,
      prev_value: form.prev_value,
      curr_value: form.curr_value,
      consumption,
      amount,
      notes: form.notes
    })
    setSaving(false)
    setShowAdd(false)
    fetchReadings()
    onSaved()
  }

  async function deleteReading(id: string) {
    if (!confirm('Удалить показание?')) return
    await supabase.from('meter_readings').delete().eq('id', id)
    fetchReadings()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#00000050', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 620, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 8px 32px #0003', border: '1px solid #e5e7eb' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #e5e7eb' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>{mt.icon} {mt.label} — №{meter.number || meter.serial}</div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>Тариф: {meter.tariff} ₽/{mt.unit} {meter.area ? `· Площадь: ${meter.area} м²` : ''}</div>
          </div>
          <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: 18, color: '#9ca3af', cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ padding: 20 }}>
          {!showAdd ? (
            <button onClick={() => setShowAdd(true)} style={{ padding: '7px 16px', borderRadius: 6, border: 'none', background: '#111', color: '#fff', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 16 }}>
              + Внести показания
            </button>
          ) : (
            <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Новые показания</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
                <div><label style={lbl}>Период</label><input style={inp} type="month" value={form.period.slice(0, 7)} onChange={e => setForm(f => ({ ...f, period: e.target.value + '-01' }))} /></div>
                <div><label style={lbl}>Предыдущее</label><input style={inp} type="number" value={form.prev_value} onChange={e => setForm(f => ({ ...f, prev_value: Number(e.target.value) }))} /></div>
                <div><label style={lbl}>Текущее</label><input style={inp} type="number" value={form.curr_value} onChange={e => setForm(f => ({ ...f, curr_value: Number(e.target.value) }))} /></div>
              </div>

              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, padding: 10, marginBottom: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 11, color: '#6b7280' }}>Расход</div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: '#111' }}>{consumption.toFixed(2)} {mt.unit}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#6b7280' }}>К оплате</div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: '#111' }}>{amount.toLocaleString('ru')} ₽</div>
                </div>
              </div>

              <div style={{ marginBottom: 10 }}>
                <label style={lbl}>Заметка</label>
                <input style={inp} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Необязательно" />
              </div>

              <div style={{ marginBottom: 10 }}>
                <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => setPhoto(e.target.files?.[0] || null)} />
                <button onClick={() => fileRef.current?.click()} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                  📷 {photo ? photo.name.slice(0, 20) + '...' : 'Фото показаний'}
                </button>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={save} disabled={saving} style={{ padding: '7px 16px', borderRadius: 6, border: 'none', background: '#111', color: '#fff', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', opacity: saving ? 0.6 : 1 }}>
                  {saving ? 'Сохранение...' : 'Сохранить'}
                </button>
                <button onClick={() => setShowAdd(false)} style={{ padding: '7px 14px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', color: '#6b7280', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Отмена</button>
              </div>
            </div>
          )}

          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                  {['Период', 'Пред.', 'Тек.', 'Расход', 'Сумма', 'Заметка', ''].map(h => (
                    <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 500, color: '#6b7280', fontSize: 12 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {readings.length === 0 ? (
                  <tr><td colSpan={7} style={{ padding: 16, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>Показаний нет</td></tr>
                ) : readings.map(r => (
                  <tr key={r.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '9px 12px', color: '#374151' }}>{new Date(r.period).toLocaleDateString('ru', { month: 'long', year: 'numeric' })}</td>
                    <td style={{ padding: '9px 12px', color: '#6b7280' }}>{r.prev_value}</td>
                    <td style={{ padding: '9px 12px', color: '#6b7280' }}>{r.curr_value}</td>
                    <td style={{ padding: '9px 12px', fontWeight: 500, color: '#111' }}>{r.consumption} {mt.unit}</td>
                    <td style={{ padding: '9px 12px', fontWeight: 600, color: '#111' }}>{Number(r.amount).toLocaleString('ru')} ₽</td>
                    <td style={{ padding: '9px 12px', color: '#9ca3af', fontSize: 12 }}>{r.notes || '—'}</td>
                    <td style={{ padding: '9px 12px' }}><button onClick={() => deleteReading(r.id)} style={{ border: 'none', background: 'none', color: '#ef4444', fontSize: 12, cursor: 'pointer' }}>Удалить</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

function MeterModal({ meter, units, onClose, onSaved }: { meter: Meter | null; units: Unit[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    number: meter?.number || meter?.serial || '',
    type: meter?.type || 'electricity',
    unit_id: meter?.unit_id || '',
    location: meter?.location || 'office',
    area: meter?.area || 0,
    tariff: meter?.tariff || 0,
    heat_tariff: meter?.heat_tariff || 0,
    notes: meter?.notes || '',
  })
  const [saving, setSaving] = useState(false)
  const set = (k: string, v: string | number) => setForm(f => ({ ...f, [k]: v }))

  async function save() {
    if (!form.number) return alert('Введите номер счётчика')
    setSaving(true)
    const payload = { ...form, unit_id: form.unit_id || null, serial: form.number }
    if (meter?.id) await supabase.from('meters').update(payload).eq('id', meter.id)
    else await supabase.from('meters').insert(payload)
    setSaving(false)
    onSaved()
  }

  async function remove() {
    if (!meter?.id || !confirm('Удалить счётчик?')) return
    await supabase.from('meters').delete().eq('id', meter.id)
    onSaved()
  }

  const isHeat = form.type === 'heat' || form.type === 'common_heat'

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#00000050', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 480, boxShadow: '0 8px 32px #0003', border: '1px solid #e5e7eb' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>{meter ? 'Редактировать счётчик' : 'Новый счётчик'}</div>
          <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: 18, color: '#9ca3af', cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div><label style={lbl}>Номер счётчика *</label><input style={inp} value={form.number} onChange={e => set('number', e.target.value)} placeholder="12345678" /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div><label style={lbl}>Тип</label>
              <select style={inp} value={form.type} onChange={e => set('type', e.target.value)}>
                {Object.entries(METER_TYPES).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
              </select>
            </div>
            <div><label style={lbl}>Расположение</label>
              <select style={inp} value={form.location} onChange={e => set('location', e.target.value)}>
                <option value="office">Офис</option>
                <option value="common">Общий</option>
              </select>
            </div>
          </div>
          <div><label style={lbl}>Офис</label>
            <select style={inp} value={form.unit_id} onChange={e => set('unit_id', e.target.value)}>
              <option value="">— Не привязан</option>
              {units.map(u => <option key={u.id} value={u.id}>Офис {u.number}</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div><label style={lbl}>Тариф (₽/{METER_TYPES[form.type]?.unit || 'ед.'})</label><input style={inp} type="number" value={form.tariff || ''} onChange={e => set('tariff', Number(e.target.value))} /></div>
            {isHeat && <div><label style={lbl}>Тариф тепла (₽/Гкал·м²)</label><input style={inp} type="number" value={form.heat_tariff || ''} onChange={e => set('heat_tariff', Number(e.target.value))} /></div>}
            {isHeat && <div><label style={lbl}>Площадь (м²)</label><input style={inp} type="number" value={form.area || ''} onChange={e => set('area', Number(e.target.value))} /></div>}
          </div>
          <div><label style={lbl}>Заметки</label><textarea style={{ ...inp, height: 60, resize: 'none' }} value={form.notes} onChange={e => set('notes', e.target.value)} /></div>
        </div>
        <div style={{ display: 'flex', gap: 8, padding: '14px 20px', borderTop: '1px solid #e5e7eb' }}>
          <button onClick={save} disabled={saving} style={{ flex: 1, padding: '8px', borderRadius: 6, border: 'none', background: '#111', color: '#fff', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
          {meter && <button onClick={remove} style={{ padding: '8px 14px', borderRadius: 6, border: 'none', background: '#fee2e2', color: '#ef4444', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>Удалить</button>}
          <button onClick={onClose} style={{ padding: '8px 14px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', color: '#6b7280', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>Отмена</button>
        </div>
      </div>
    </div>
  )
}

export default function MetersPage() {
  const [meters, setMeters] = useState<any[]>([])
  const [units, setUnits] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<any>(null)
  const [showMeterModal, setShowMeterModal] = useState(false)
  const [showReadingModal, setShowReadingModal] = useState(false)
  const [typeFilter, setTypeFilter] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      supabase.from('meters').select('*'),
      supabase.from('units').select('id, number').order('number')
    ]).then(([{ data: m, error: e1 }, { data: u, error: e2 }]) => {
      if (e1) setError('Meters error: ' + e1.message)
      if (e2) setError('Units error: ' + e2.message)
      setMeters(m || [])
      setUnits(u || [])
      setLoading(false)
    })
  }, [])

  if (error) return <div style={{ padding: 20, color: 'red' }}>{error}</div>
  if (loading) return <div style={{ padding: 20, color: '#9ca3af' }}>Загрузка...</div>

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>
        <div style={{ flex: 1 }} />
        <button onClick={() => { setSelected(null); setShowMeterModal(true) }} style={{ padding: '7px 16px', border: 'none', borderRadius: 6, background: '#111', color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
          + Добавить счётчик
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
        {meters.map(m => {
          const mt = METER_TYPES[m.type] || { label: m.type, icon: '📊', unit: '' }
          return (
            <div key={m.id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 20 }}>{mt.icon}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>{mt.label}</div>
                    <div style={{ fontSize: 12, color: '#6b7280' }}>№{m.number || m.serial}</div>
                  </div>
                </div>
                <button onClick={() => { setSelected(m); setShowMeterModal(true) }} style={{ border: 'none', background: '#f3f4f6', borderRadius: 6, padding: '4px 8px', fontSize: 12, color: '#6b7280', cursor: 'pointer' }}>✎</button>
              </div>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 10 }}>
                {m.tariff > 0 && <span>Тариф: {m.tariff} ₽/{mt.unit}</span>}
                {m.area > 0 && <span> · {m.area} м²</span>}
              </div>
              <button onClick={() => { setSelected(m); setShowReadingModal(true) }} style={{ width: '100%', padding: '7px', borderRadius: 6, border: 'none', background: '#111', color: '#fff', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                Показания
              </button>
            </div>
          )
        })}
        {meters.length === 0 && <div style={{ color: '#9ca3af', fontSize: 14 }}>Счётчики не найдены</div>}
      </div>
      {showMeterModal && <MeterModal meter={selected} units={units} onClose={() => setShowMeterModal(false)} onSaved={() => { setShowMeterModal(false); Promise.all([supabase.from('meters').select('*'), supabase.from('units').select('id, number').order('number')]).then(([{data:m},{data:u}]) => { setMeters(m||[]); setUnits(u||[]) }) }} />}
      {showReadingModal && selected && <ReadingModal meter={selected} onClose={() => setShowReadingModal(false)} onSaved={() => supabase.from('meters').select('*').then(({data:m}) => setMeters(m||[]))} />}
    </div>
  )
}