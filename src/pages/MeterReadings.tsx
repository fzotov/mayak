import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

const METER_LABELS: Record<string, string> = { electricity: 'Электричество', cold_water: 'Холодная вода', hot_water: 'Горячая вода' }
const METER_UNITS: Record<string, string> = { electricity: 'кВт·ч', cold_water: 'м³', hot_water: 'м³' }

export function MeterReadingsPage() {
  const [meters, setMeters] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [recognizing, setRecognizing] = useState<string | null>(null)
  const [readings, setReadings] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [activeMeterId, setActiveMeterId] = useState<string | null>(null)

  useEffect(() => {
    supabase.from('meters').select('*, tenants(*), units(*), meter_readings(reading, reading_date, recognized_by_ai)')
      .order('created_at').then(({ data }) => { setMeters(data || []); setLoading(false) })
  }, [])

  const handlePhoto = async (meterId: string, file: File) => {
    setRecognizing(meterId)
    try {
      const base64 = await new Promise<string>((res) => {
        const r = new FileReader()
        r.onload = () => res((r.result as string).split(',')[1])
        r.readAsDataURL(file)
      })
      const resp = await fetch('/api/recognize-meter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, meterNumbers: meters.map(m => m.serial) })
      })
      const data = await resp.json()
      if (data.ok && data.meters?.length > 0) {
        const match = data.meters.find((m: any) => m.matched) || data.meters[0]
        setReadings(prev => ({ ...prev, [meterId]: String(match.reading) }))
      }
    } catch (e) { console.error(e) }
    setRecognizing(null)
  }

  const saveReading = async (meter: any) => {
    const reading = parseFloat(readings[meter.id])
    if (!reading) return
    setSaving(meter.id)
    const lastReading = meter.meter_readings?.[0]?.reading || 0
    const consumption = reading - lastReading
    const amount = consumption * meter.tariff * 1.0638
    await supabase.from('meter_readings').insert({
      meter_id: meter.id,
      reading,
      previous_reading: lastReading,
      consumption,
      amount: Math.round(amount * 100) / 100,
      reading_date: new Date().toISOString().slice(0, 10),
    })
    setSuccess(meter.id)
    setTimeout(() => setSuccess(null), 3000)
    setSaving(null)
    setReadings(prev => ({ ...prev, [meter.id]: '' }))
    // Обновим данные
    const { data } = await supabase.from('meters').select('*, tenants(*), units(*), meter_readings(reading, reading_date)')
    setMeters(data || [])
  }

  const s = {
    card: { background: '#fff', border: '1px solid #e8ebf3', borderRadius: 9, padding: 16, marginBottom: 12 } as React.CSSProperties,
    inp: { padding: '8px 10px', border: '1px solid #e8ebf3', borderRadius: 6, fontSize: 14, fontFamily: 'inherit', outline: 'none', width: '140px' } as React.CSSProperties,
  }

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ fontSize: 12, color: '#8596b4', marginBottom: 20 }}>Ввод показаний приборов учёта. Загрузите фото — AI распознает показания автоматически.</div>

      {loading && <div style={{ color: '#8596b4', fontSize: 14 }}>Загрузка...</div>}

      {meters.map(meter => {
        const lastReading = meter.meter_readings?.[0]?.reading
        const lastDate = meter.meter_readings?.[0]?.reading_date
        const isRecognizing = recognizing === meter.id
        const isSaving = saving === meter.id
        const isSuccess = success === meter.id

        return (
          <div key={meter.id} style={s.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#1a2240' }}>
                  {METER_LABELS[meter.type]} — {meter.tenants?.full_name}
                </div>
                <div style={{ fontSize: 12, color: '#8596b4', marginTop: 2 }}>
                  Офис №{meter.units?.number} · Счётчик №{meter.serial} · {meter.tariff} ₽/{METER_UNITS[meter.type]}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                {lastReading ? (
                  <>
                    <div style={{ fontSize: 16, fontWeight: 600, color: '#1a2240' }}>{lastReading} {METER_UNITS[meter.type]}</div>
                    <div style={{ fontSize: 11, color: '#8596b4' }}>последнее показание {lastDate}</div>
                  </>
                ) : (
                  <div style={{ fontSize: 12, color: '#f59e0b' }}>Нет показаний</div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                type="number"
                placeholder="Новое показание"
                style={s.inp}
                value={readings[meter.id] || ''}
                onChange={e => setReadings(prev => ({ ...prev, [meter.id]: e.target.value }))}
              />

              <input
                ref={activeMeterId === meter.id ? fileRef : undefined}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={e => e.target.files?.[0] && handlePhoto(meter.id, e.target.files[0])}
              />

              <button
                onClick={() => { setActiveMeterId(meter.id); setTimeout(() => fileRef.current?.click(), 50) }}
                disabled={isRecognizing}
                style={{ padding: '8px 14px', border: '1px solid #4f6ef7', borderRadius: 6, background: '#eff3ff', color: '#4f6ef7', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>
                {isRecognizing ? 'Распознаю...' : '📷 Фото + AI'}
              </button>

              <button
                onClick={() => saveReading(meter)}
                disabled={!readings[meter.id] || isSaving}
                style={{ padding: '8px 14px', border: 'none', borderRadius: 6, background: readings[meter.id] ? '#4f6ef7' : '#e5e7eb', color: readings[meter.id] ? '#fff' : '#9ca3af', fontSize: 13, cursor: readings[meter.id] ? 'pointer' : 'default', fontFamily: 'inherit', fontWeight: 500 }}>
                {isSaving ? 'Сохраняю...' : 'Сохранить'}
              </button>

              {isSuccess && <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 500 }}>✓ Сохранено</span>}
            </div>

            {readings[meter.id] && lastReading && (
              <div style={{ marginTop: 10, padding: '8px 12px', background: '#f8f9fc', borderRadius: 6, fontSize: 12, color: '#6b7280' }}>
                Потребление: <b>{(parseFloat(readings[meter.id]) - lastReading).toFixed(1)} {METER_UNITS[meter.type]}</b> →
                Сумма: <b style={{ color: '#1a2240' }}>{Math.round((parseFloat(readings[meter.id]) - lastReading) * meter.tariff * 1.0638).toLocaleString('ru')} ₽</b>
              </div>
            )}
          </div>
        )
      })}

      {!loading && meters.length === 0 && (
        <div style={{ padding: 40, textAlign: 'center', color: '#8596b4', fontSize: 14 }}>
          Счётчики не найдены. Добавьте счётчики в карточке арендатора.
        </div>
      )}
    </div>
  )
}
