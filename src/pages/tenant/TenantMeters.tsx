import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { apiFetch } from '../../lib/api'
import { compressImage, blobToBase64 } from '../../lib/photo'
import { T, Card, Title, Button, Loading, Empty, Note, CameraIcon, input, label, date, page } from './ui'

const TYPES: Record<string, { name: string; unit: string }> = {
  electricity: { name: 'Электроэнергия', unit: 'кВт·ч' }, cold_water: { name: 'Холодная вода', unit: 'м³' },
  hot_water: { name: 'Горячая вода', unit: 'м³' }, heat: { name: 'Тепло', unit: 'Гкал' },
}

/** Фото счётчика: сжатый снимок, превью и что распознал сервер. */
type Shot = { base64: string; preview: string; recognized: number | null; busy: boolean; error: string }

export default function TenantMeters({ tenantId }: { tenantId: string }) {
  const [meters, setMeters] = useState<any[] | null>(null)
  const [values, setValues] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<Record<string, { ok: boolean; text: string }>>({})
  const [shots, setShots] = useState<Record<string, Shot | undefined>>({})
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const shotsRef = useRef(shots); shotsRef.current = shots
  useEffect(() => () => Object.values(shotsRef.current).forEach(x => x && URL.revokeObjectURL(x.preview)), [])

  const load = async () => {
    const { data } = await supabase.from('meters').select('id,type,number,serial,location,meter_readings(reading,reading_date,created_at)').eq('tenant_id', tenantId)
    setMeters((data || []).map((m: any) => ({ ...m, readings: (m.meter_readings || []).sort((a: any, b: any) => String(b.created_at).localeCompare(String(a.created_at))) })))
  }
  useEffect(() => { load() }, [tenantId])

  const patchShot = (id: string, p: Partial<Shot>) => setShots(prev => (prev[id] ? { ...prev, [id]: { ...prev[id]!, ...p } } : prev))
  const dropShot = (id: string) => setShots(prev => { if (prev[id]) URL.revokeObjectURL(prev[id]!.preview); return { ...prev, [id]: undefined } })

  const takePhoto = async (m: any, file: File | undefined) => {
    if (fileRefs.current[m.id]) fileRefs.current[m.id]!.value = ''
    if (!file) return
    setMsg(prev => { const n = { ...prev }; delete n[m.id]; return n })
    let blob: Blob, base64: string
    try { blob = await compressImage(file); base64 = await blobToBase64(blob) } catch {
      setMsg(prev => ({ ...prev, [m.id]: { ok: false, text: 'Не удалось прочитать фото, попробуйте ещё раз' } })); return
    }
    setShots(prev => { if (prev[m.id]) URL.revokeObjectURL(prev[m.id]!.preview); return { ...prev, [m.id]: { base64, preview: URL.createObjectURL(blob), recognized: null, busy: true, error: '' } } })
    let d: any
    try {
      const r = await apiFetch('/api/tenant-recognize-meter', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ meterId: m.id, imageBase64: base64 }) })
      d = await r.json().catch(() => ({ ok: false }))
    } catch { d = { ok: false } }
    if (d.ok && typeof d.reading === 'number') {
      patchShot(m.id, { busy: false, recognized: d.reading })
      setValues(prev => ({ ...prev, [m.id]: String(d.reading).replace('.', ',') }))
    } else {
      patchShot(m.id, { busy: false, error: d.ok ? 'Показание на фото не найдено, введите его вручную. Фото будет приложено.' : (d.error || 'Не удалось распознать, введите показание вручную. Фото будет приложено.') })
    }
  }

  const submit = async (m: any) => {
    const reading = parseFloat((values[m.id] || '').replace(/\s/g, '').replace(',', '.'))
    if (!Number.isFinite(reading)) { setMsg({ ...msg, [m.id]: { ok: false, text: 'Введите показание числом' } }); return }
    const shot = shots[m.id]
    setBusy(m.id)
    const body: Record<string, unknown> = { meterId: m.id, reading }
    if (shot) { body.photo = shot.base64; body.recognized = shot.recognized !== null && shot.recognized === reading }
    let d: any
    try {
      const r = await apiFetch('/api/tenant-meter-reading', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      d = await r.json().catch(() => ({ ok: false, error: 'Сервер не ответил' }))
    } catch { d = { ok: false, error: 'Нет связи с сервером, попробуйте ещё раз' } }
    setBusy(null)
    if (d.ok) { setMsg(prev => ({ ...prev, [m.id]: { ok: true, text: `Показание принято. Расход: ${d.consumption}` } })); setValues(prev => ({ ...prev, [m.id]: '' })); dropShot(m.id); load() }
    else setMsg(prev => ({ ...prev, [m.id]: { ok: false, text: d.error || 'Не удалось передать показание' } }))
  }

  if (!meters) return <Loading />
  if (!meters.length) return <div style={page}><Card><Empty>За вашим помещением счётчики не закреплены.<br />Если это ошибка, сообщите в администрацию.</Empty></Card></div>

  return (
    <div style={page}>
      {meters.map(m => {
        const t = TYPES[m.type] || { name: 'Счётчик', unit: '' }
        const last = m.readings[0]
        const shot = shots[m.id]
        return (
          <Card key={m.id}>
            <Title>{t.name}</Title>
            <div style={{ fontSize: 13, color: T.muted, marginBottom: 14, overflowWrap: 'anywhere' }}>№ {m.number || m.serial || '—'}{m.location ? ` · ${m.location}` : ''}</div>
            <div style={{ fontSize: 14, color: T.sub, marginBottom: 14 }}>
              Предыдущее: <span style={{ color: T.text, fontVariantNumeric: 'tabular-nums' }}>{last ? `${last.reading} ${t.unit}` : 'нет'}</span>{last ? ` от ${date(last.reading_date)}` : ''}
            </div>

            <input ref={el => { fileRefs.current[m.id] = el }} type="file" accept="image/*" capture="environment" onChange={e => takePhoto(m, e.target.files?.[0])} style={{ display: 'none' }} />
            {!shot ? (
              <button type="button" onClick={() => fileRefs.current[m.id]?.click()} style={{ width: '100%', minHeight: 44, marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 8, border: `1px dashed ${T.border}`, background: 'transparent', color: T.text, fontSize: 15, fontFamily: T.font, cursor: 'pointer' }}>
                <CameraIcon />Сфотографировать счётчик
              </button>
            ) : (
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 14 }}>
                <img src={shot.preview} alt="Фото счётчика" style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8, border: `1px solid ${T.border}`, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0, fontSize: 14, lineHeight: 1.45 }}>
                  {shot.busy ? <span style={{ color: T.muted }}>Распознаём показание…</span>
                    : shot.recognized !== null ? <span>Распознано: <b style={{ fontVariantNumeric: 'tabular-nums' }}>{String(shot.recognized).replace('.', ',')}</b> — проверьте</span>
                    : <span style={{ color: T.muted }}>Фото приложено</span>}
                  <div style={{ display: 'flex', flexWrap: 'wrap', columnGap: 16 }}>
                    <button type="button" onClick={() => fileRefs.current[m.id]?.click()} disabled={shot.busy} style={linkBtn}>Переснять</button>
                    <button type="button" onClick={() => dropShot(m.id)} disabled={shot.busy} style={linkBtn}>Убрать фото</button>
                  </div>
                </div>
              </div>
            )}
            {shot?.error && <Note>{shot.error}</Note>}

            <label style={{ ...label, marginTop: shot?.error ? 14 : 0 }}>Текущее показание{t.unit ? `, ${t.unit}` : ''}</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input style={{ ...input, minWidth: 0 }} inputMode="decimal" value={values[m.id] || ''} onChange={e => setValues({ ...values, [m.id]: e.target.value })} placeholder={last ? String(last.reading) : '0'} />
              <Button onClick={() => submit(m)} disabled={busy === m.id || !!shot?.busy}>{busy === m.id ? '…' : 'Передать'}</Button>
            </div>
            {msg[m.id] && <Note tone={msg[m.id].ok ? 'ok' : 'bad'}>{msg[m.id].text}</Note>}
          </Card>
        )
      })}
    </div>
  )
}

const linkBtn: React.CSSProperties = { minHeight: 44, padding: 0, background: 'none', border: 'none', color: T.sub, fontSize: 14, fontFamily: T.font, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3 }
