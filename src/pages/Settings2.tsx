import { useState, useEffect } from 'react'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

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

interface Setting {
  id: string
  key: string
  value: number
  description: string
  valid_from: string
  created_at: string
}

export function SettingsReferencePage() {
  const [settings, setSettings] = useState<Setting[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<string | null>(null)
  const [newValue, setNewValue] = useState('')
  const [validFrom, setValidFrom] = useState(new Date().toISOString().slice(0, 10))
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')

  const fetchSettings = async () => {
    const res = await fetch(SUPABASE_URL + '/rest/v1/settings?order=key,valid_from.desc', {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY }
    })
    const data = await res.json()
    setSettings(data)
    setLoading(false)
  }

  useEffect(() => { fetchSettings() }, [])

  const getCurrentValue = (key: string) => {
    const rows = settings.filter(s => s.key === key).sort((a, b) => b.valid_from.localeCompare(a.valid_from))
    return rows[0]
  }

  const getHistory = (key: string) => {
    return settings.filter(s => s.key === key).sort((a, b) => b.valid_from.localeCompare(a.valid_from))
  }

  const saveNewValue = async (key: string) => {
    if (!newValue) return
    setSaving(true)
    await fetch(SUPABASE_URL + '/rest/v1/settings', {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        key,
        value: parseFloat(newValue),
        description: KEY_LABELS[key],
        valid_from: validFrom,
        created_by: 'admin'
      })
    })
    await fetchSettings()
    setEditing(null)
    setNewValue('')
    setSaving(false)
    setSuccess('Значение сохранено. Старые счета не изменятся.')
    setTimeout(() => setSuccess(''), 4000)
  }

  const uniqueKeys = [...new Set(settings.map(s => s.key))]
  const s = {
    card: { background: '#fff', border: '1px solid #e8ebf3', borderRadius: 9, marginBottom: 12, overflow: 'hidden' } as React.CSSProperties,
    inp: { padding: '7px 10px', border: '1px solid #e8ebf3', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', outline: 'none' } as React.CSSProperties,
  }

  return (
    <div style={{ maxWidth: 800 }}>
, fontWeight: 600, color: '#1a2240', marginBottom: 6 }}>Справочники</div>
      <div style={{ fontSize: 12, color: '#8596b4', marginBottom: 20 }}>Тарифы и коэффициенты. История изменений сохраняется — старые счета пересчитываться не будут.</div>

      {success && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: '#16a34a', display: 'flex', gap: 8 }}>
          ✓ {success}
        </div>
      )}

      {loading && <div style={{ color: '#8596b4', fontSize: 13 }}>Загрузка...</div>}

      {uniqueKeys.map(key => {
        const current = getCurrentValue(key)
        const history = getHistory(key)
        const isEditing = editing === key

        return (
          <div key={key} style={s.card}>
            <div style={{ padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f0f2f8' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1a2240' }}>{KEY_LABELS[key] || key}</div>
                <div style={{ fontSize: 11, color: '#8596b4', marginTop: 2 }}>Действует с {current?.valid_from}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ fontSize: 20, fontWeight: 600, color: '#1a2240' }}>
                  {current?.value} <span style={{ fontSize: 12, color: '#8596b4', fontWeight: 400 }}>{KEY_UNITS[key]}</span>
                </div>
                {isEditing ? (
                  <button onClick={() => setEditing(null)}
                    style={{ padding: '5px 12px', border: '1px solid #e8ebf3', borderRadius: 6, background: '#fff', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', color: '#6b7280' }}>
                    Отмена
                  </button>
                ) : (
                  <button onClick={() => { setEditing(key); setNewValue(String(current?.value || '')) }}
                    style={{ padding: '5px 12px', border: 'none', borderRadius: 6, background: '#4f6ef7', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', color: '#fff', fontWeight: 500 }}>
                    Изменить
                  </button>
                )}
              </div>
            </div>

            {isEditing && (
              <div style={{ padding: '14px 16px', background: '#fffbeb', borderBottom: '1px solid #f0f2f8' }}>
                <div style={{ fontSize: 12, color: '#92400e', marginBottom: 12 }}>
                  ⚠️ Новое значение применится только к новым счетам. Старые счета останутся неизменными.
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
                  <div>
                    <div style={{ fontSize: 11, color: '#8596b4', marginBottom: 4, fontWeight: 500 }}>Новое значение ({KEY_UNITS[key]})</div>
                    <input style={{ ...s.inp, width: 140 }} type="number" step="0.01" value={newValue} onChange={e => setNewValue(e.target.value)} />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#8596b4', marginBottom: 4, fontWeight: 500 }}>Действует с</div>
                    <input style={{ ...s.inp, width: 150 }} type="date" value={validFrom} onChange={e => setValidFrom(e.target.value)} />
                  </div>
                  <button onClick={() => saveNewValue(key)} disabled={saving}
                    style={{ padding: '7px 16px', border: 'none', borderRadius: 6, background: '#16a34a', color: '#fff', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>
                    {saving ? 'Сохранение...' : 'Сохранить'}
                  </button>
                </div>
              </div>
            )}

            <div style={{ padding: '10px 16px' }}>
              <div style={{ fontSize: 11, color: '#8596b4', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.4px' }}>История изменений</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr>
                    {['Дата начала', 'Значение', 'Кто изменил', 'Дата записи'].map(h => (
                      <th key={h} style={{ padding: '4px 8px', textAlign: 'left', color: '#9ca3af', fontWeight: 500, fontSize: 11 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {history.map((h, i) => (
                    <tr key={h.id} style={{ borderTop: '1px solid #f0f2f8' }}>
                      <td style={{ padding: '6px 8px', color: i === 0 ? '#1a2240' : '#6b7280', fontWeight: i === 0 ? 600 : 400 }}>{h.valid_from}</td>
                      <td style={{ padding: '6px 8px', fontWeight: i === 0 ? 600 : 400, color: i === 0 ? '#4f6ef7' : '#6b7280' }}>{h.value} {KEY_UNITS[key]}</td>
                      <td style={{ padding: '6px 8px', color: '#6b7280' }}>{h.created_by || 'admin'}</td>
                      <td style={{ padding: '6px 8px', color: '#9ca3af' }}>{h.created_at?.slice(0, 10)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}
    </div>
  )
}
