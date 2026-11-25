import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { apiFetch } from '../../lib/api'
import { compressImage, blobToBase64 } from '../../lib/photo'
import { T, Card, Title, Badge, Button, Loading, Empty, Note, StoredPhotos, CameraIcon, input, label, date, page } from './ui'

const MAX_PHOTOS = 3
type Shot = { blob: Blob; preview: string }

const CATEGORIES = ['Электрика', 'Сантехника', 'Отопление', 'Интернет', 'Уборка', 'Другое']
const STATUS: Record<string, { t: string; tone: 'ok' | 'warn' | 'bad' | 'muted' }> = {
  new: { t: 'новая', tone: 'muted' }, accepted: { t: 'принята', tone: 'warn' }, in_progress: { t: 'в работе', tone: 'warn' },
  completed: { t: 'выполнена', tone: 'ok' }, rejected: { t: 'отклонена', tone: 'bad' },
}

export default function TenantRepairs({ tenantId }: { tenantId: string }) {
  const [items, setItems] = useState<any[] | null>(null)
  const [open, setOpen] = useState(false)
  const [category, setCategory] = useState(CATEGORIES[0])
  const [text, setText] = useState('')
  const [urgent, setUrgent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [shots, setShots] = useState<Shot[]>([])
  const [adding, setAdding] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // освобождаем превью при уходе со страницы
  const shotsRef = useRef(shots); shotsRef.current = shots
  useEffect(() => () => shotsRef.current.forEach(x => URL.revokeObjectURL(x.preview)), [])

  const addPhotos = async (files: FileList | null) => {
    if (!files?.length) return
    setAdding(true); setErr('')
    const room = MAX_PHOTOS - shots.length
    const picked = Array.from(files).slice(0, room)
    const next: Shot[] = []
    for (const f of picked) {
      try { const blob = await compressImage(f); next.push({ blob, preview: URL.createObjectURL(blob) }) } catch { /* пропускаем нечитаемый файл */ }
    }
    setShots(prev => [...prev, ...next].slice(0, MAX_PHOTOS))
    if (files.length > room) setErr(`Можно приложить не больше ${MAX_PHOTOS} фото`)
    else if (next.length < picked.length) setErr('Одно из фото не удалось прочитать')
    setAdding(false)
    if (fileRef.current) fileRef.current.value = ''
  }
  const removeShot = (i: number) => setShots(prev => { URL.revokeObjectURL(prev[i].preview); return prev.filter((_, j) => j !== i) })
  const resetForm = () => { shots.forEach(x => URL.revokeObjectURL(x.preview)); setShots([]); setText(''); setUrgent(false); setErr(''); setOpen(false) }

  const load = () => supabase.from('repairs').select('id,number,category,priority,status,description,comment,created_at,completed_date,photos,photos_after').eq('tenant_id', tenantId)
    .order('created_at', { ascending: false }).then(({ data }) => setItems(data || []))
  useEffect(() => { load() }, [tenantId])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (text.trim().length < 5) { setErr('Опишите проблему подробнее'); return }
    setBusy(true); setErr('')
    let d: any = { ok: false }
    try {
      const photos = await Promise.all(shots.map(x => blobToBase64(x.blob)))
      const r = await apiFetch('/api/tenant-repair', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ category, description: text, urgent, photos }) })
      d = await r.json().catch(() => ({ ok: false }))
    } catch { /* сеть недоступна */ }
    setBusy(false)
    if (!d.ok) { setErr(d.error || 'Не удалось отправить заявку. Попробуйте ещё раз или позвоните: +7 (916) 763-02-07'); return }
    resetForm(); load()
  }

  if (!items) return <Loading />
  return (
    <div style={page}>
      {!open && <Button onClick={() => setOpen(true)} full>Новая заявка</Button>}
      {open && (
        <Card>
          <Title>Новая заявка</Title>
          <form onSubmit={submit}>
            <label style={label}>Что случилось</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
              {CATEGORIES.map(c => (
                <button type="button" key={c} onClick={() => setCategory(c)} style={{ minHeight: 40, padding: '0 14px', borderRadius: 20, fontSize: 14, fontFamily: T.font, cursor: 'pointer', border: `1px solid ${category === c ? T.accent : T.border}`, background: category === c ? T.accent : 'transparent', color: category === c ? 'var(--bg)' : T.text }}>{c}</button>
              ))}
            </div>
            <label style={label}>Описание</label>
            <textarea style={{ ...input, minHeight: 110, resize: 'vertical' }} value={text} onChange={e => setText(e.target.value)} placeholder="Например: не работает розетка у окна" />
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '14px 0', fontSize: 14, color: T.text, cursor: 'pointer' }}>
              <input type="checkbox" checked={urgent} onChange={e => setUrgent(e.target.checked)} style={{ width: 20, height: 20 }} />
              Авария: течёт вода, нет света, запах гари
            </label>
            <label style={label}>Фото {shots.length > 0 ? `(${shots.length} из ${MAX_PHOTOS})` : '(необязательно)'}</label>
            {shots.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                {shots.map((x, i) => (
                  <div key={x.preview} style={{ position: 'relative', width: 88, height: 88, borderRadius: 8, overflow: 'hidden', border: `1px solid ${T.border}`, flexShrink: 0 }}>
                    <img src={x.preview} alt={`Фото ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    <button type="button" onClick={() => removeShot(i)} aria-label={`Убрать фото ${i + 1}`} style={{ position: 'absolute', top: 0, right: 0, width: 44, height: 44, padding: 0, border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end' }}>
                      <span style={{ margin: 4, width: 24, height: 24, borderRadius: 12, background: 'var(--overlay)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 2.5l7 7M9.5 2.5l-7 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
                      </span>
                    </button>
                  </div>
                ))}
              </div>
            )}
            {shots.length < MAX_PHOTOS && (
              <>
                <input ref={fileRef} type="file" accept="image/*" capture="environment" multiple onChange={e => addPhotos(e.target.files)} style={{ display: 'none' }} />
                <button type="button" onClick={() => fileRef.current?.click()} disabled={adding} style={{ width: '100%', minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 8, border: `1px dashed ${T.border}`, background: 'transparent', color: T.text, fontSize: 15, fontFamily: T.font, cursor: 'pointer', opacity: adding ? 0.5 : 1 }}>
                  <CameraIcon />{adding ? 'Обрабатываем фото…' : 'Добавить фото'}
                </button>
              </>
            )}
            <div style={{ height: 14 }} />
            {err && <Note>{err}</Note>}
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <Button kind="ghost" onClick={resetForm}>Отмена</Button>
              <div style={{ flex: 1 }}><Button type="submit" disabled={busy} full>{busy ? 'Отправляем…' : 'Отправить'}</Button></div>
            </div>
          </form>
        </Card>
      )}
      <Card>
        <Title>Мои заявки</Title>
        {items.length === 0 ? <Empty>Заявок пока нет</Empty> : items.map(r => {
          const s = STATUS[r.status] || { t: r.status, tone: 'muted' as const }
          return (
            <div key={r.id} style={{ padding: '13px 0', borderTop: `1px solid ${T.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
                <span style={{ fontSize: 14, fontWeight: 500, minWidth: 0, overflowWrap: 'anywhere' }}>№ {r.number} · {r.category}</span>
                <Badge tone={s.tone}>{s.t}</Badge>
              </div>
              <div style={{ fontSize: 14, color: T.sub, lineHeight: 1.5, overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>{r.description}</div>
              <StoredPhotos urls={r.photos} caption="Фото" />
              <StoredPhotos urls={r.photos_after} caption="После ремонта" />
              {r.comment && <div style={{ fontSize: 13, color: T.text, marginTop: 8, padding: '8px 10px', background: T.raised, borderRadius: 8 }}>Ответ: {r.comment}</div>}
              <div style={{ fontSize: 12, color: T.muted, marginTop: 6 }}>{date(r.created_at)}{r.completed_date ? ` · выполнена ${date(r.completed_date)}` : ''}</div>
            </div>
          )
        })}
      </Card>
    </div>
  )
}
