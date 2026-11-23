import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { apiFetch } from '../../lib/api'
import { T, Card, Title, Button, Loading, Empty, Note, input, label, date, page } from './ui'

const TYPES: Record<string, { name: string; unit: string }> = {
  electricity: { name: 'Электроэнергия', unit: 'кВт·ч' }, cold_water: { name: 'Холодная вода', unit: 'м³' },
  hot_water: { name: 'Горячая вода', unit: 'м³' }, heat: { name: 'Тепло', unit: 'Гкал' },
}

export default function TenantMeters({ tenantId }: { tenantId: string }) {
  const [meters, setMeters] = useState<any[] | null>(null)
  const [values, setValues] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<Record<string, { ok: boolean; text: string }>>({})

  const load = async () => {
    const { data } = await supabase.from('meters').select('id,type,number,serial,location,meter_readings(reading,reading_date,created_at)').eq('tenant_id', tenantId)
    setMeters((data || []).map((m: any) => ({ ...m, readings: (m.meter_readings || []).sort((a: any, b: any) => String(b.created_at).localeCompare(String(a.created_at))) })))
  }
  useEffect(() => { load() }, [tenantId])

  const submit = async (m: any) => {
    const reading = parseFloat((values[m.id] || '').replace(',', '.'))
    if (!Number.isFinite(reading)) { setMsg({ ...msg, [m.id]: { ok: false, text: 'Введите показание числом' } }); return }
    setBusy(m.id)
    const r = await apiFetch('/api/tenant-meter-reading', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ meterId: m.id, reading }) })
    const d = await r.json().catch(() => ({ ok: false, error: 'Сервер не ответил' }))
    setBusy(null)
    if (d.ok) { setMsg({ ...msg, [m.id]: { ok: true, text: `Показание принято. Расход: ${d.consumption}` } }); setValues({ ...values, [m.id]: '' }); load() }
    else setMsg({ ...msg, [m.id]: { ok: false, text: d.error || 'Не удалось передать показание' } })
  }

  if (!meters) return <Loading />
  if (!meters.length) return <div style={page}><Card><Empty>За вашим помещением счётчики не закреплены.<br />Если это ошибка, сообщите в администрацию.</Empty></Card></div>

  return (
    <div style={page}>
      {meters.map(m => {
        const t = TYPES[m.type] || { name: 'Счётчик', unit: '' }
        const last = m.readings[0]
        return (
          <Card key={m.id}>
            <Title>{t.name}</Title>
            <div style={{ fontSize: 13, color: T.muted, marginBottom: 14 }}>№ {m.number || m.serial || '—'}{m.location ? ` · ${m.location}` : ''}</div>
            <div style={{ fontSize: 14, color: T.sub, marginBottom: 14 }}>
              Предыдущее: <span style={{ color: T.text, fontVariantNumeric: 'tabular-nums' }}>{last ? `${last.reading} ${t.unit}` : 'нет'}</span>{last ? ` от ${date(last.reading_date)}` : ''}
            </div>
            <label style={label}>Текущее показание{t.unit ? `, ${t.unit}` : ''}</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input style={input} inputMode="decimal" value={values[m.id] || ''} onChange={e => setValues({ ...values, [m.id]: e.target.value })} placeholder={last ? String(last.reading) : '0'} />
              <Button onClick={() => submit(m)} disabled={busy === m.id}>{busy === m.id ? '…' : 'Передать'}</Button>
            </div>
            {msg[m.id] && <Note tone={msg[m.id].ok ? 'ok' : 'bad'}>{msg[m.id].text}</Note>}
          </Card>
        )
      })}
    </div>
  )
}
