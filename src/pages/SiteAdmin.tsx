import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { ALL_ROOMS, unitKey, unitKeys, type Room } from '../lib/floorGeometry'
import { fetchSiteLeads, updateLeadStatus, type SiteLead } from '../lib/siteLeads'

// ─── Управление публичным сайтом: витрина помещений и заявки ────────────────
// Состав помещений берём из плана этажей, а статус, цену, фото и видео —
// из таблицы units. Строка в units создаётся автоматически при первом
// редактировании помещения.

const BUCKET = 'unit-media'

type Row = {
  floor: number
  room: Room
  id: string | null
  status: string
  rate: number | null
  area: number
  photos: string[]
  video: string | null
  description: string
  published: boolean
  tenantName: string | null
}

type Lead = SiteLead

const STATUS: Record<string, { label: string; bg: string; color: string }> = {
  free:     { label: 'Свободно', bg: '#dcfce7', color: '#16a34a' },
  occupied: { label: 'Занято',   bg: '#fee2e2', color: '#ef4444' },
  reserved: { label: 'Бронь',    bg: '#fef3c7', color: '#d97706' },
}

const LEAD_STATUS: Record<string, { label: string; bg: string; color: string }> = {
  new:     { label: 'Новая',    bg: '#eff3ff', color: '#4f6ef7' },
  in_work: { label: 'В работе', bg: '#fef3c7', color: '#d97706' },
  done:    { label: 'Закрыта',  bg: '#dcfce7', color: '#16a34a' },
  spam:    { label: 'Спам',     bg: '#f3f4f6', color: '#6b7280' },
}

const SI: React.CSSProperties = { width: '100%', border: '1px solid #e5e7eb', borderRadius: 6, padding: '7px 10px', fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }
const SL: React.CSSProperties = { fontSize: 12, color: '#6b7280', marginBottom: 4, display: 'block', fontWeight: 500 }
const CARD: React.CSSProperties = { background: '#fff', border: '1px solid #e8ebf3', borderRadius: 10, padding: 16 }

const isVideoUrl = (u: string) => /\.(mp4|webm|mov|m4v)(\?|$)/i.test(u) || /youtu\.?be|vk\.com|rutube/i.test(u)

export default function SiteAdminPage() {
  const [tab, setTab] = useState<'units' | 'leads'>('units')
  return (
    <div style={{ maxWidth: 1180 }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {([['units', 'Помещения на сайте'], ['leads', 'Заявки с сайта']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            style={{ padding: '7px 18px', borderRadius: 8, fontSize: 14, fontWeight: tab === k ? 600 : 400, cursor: 'pointer', fontFamily: 'inherit',
              border: tab === k ? '2px solid #4f6ef7' : '1px solid #d1d5db', background: tab === k ? '#4f6ef7' : '#fff', color: tab === k ? '#fff' : '#374151' }}>
            {l}
          </button>
        ))}
        <a href="/" target="_blank" rel="noopener"
          style={{ marginLeft: 'auto', padding: '7px 16px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', color: '#374151', fontSize: 14, textDecoration: 'none' }}>
          Открыть сайт ↗
        </a>
      </div>
      {tab === 'units' ? <UnitsTab /> : <LeadsTab />}
    </div>
  )
}

/* ─── Помещения ──────────────────────────────────────────────────────────── */

function UnitsTab() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [hasSiteCols, setHasSiteCols] = useState(true)
  const [floor, setFloor] = useState<'all' | 2 | 3>('all')
  const [onlyFree, setOnlyFree] = useState(false)
  const [sel, setSel] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)

  async function load() {
    setLoading(true)
    const probe = await supabase.from('units').select('id,video_url,is_published').limit(1)
    const siteCols = !probe.error
    setHasSiteCols(siteCols)

    const [{ data: units }, { data: tenants }] = await Promise.all([
      supabase.from('units').select('*'),
      supabase.from('tenants').select('full_name,unit_number').not('unit_number', 'is', null),
    ])

    const byKey = new Map<string, any>()
    for (const u of units || []) for (const k of unitKeys(u.number)) if (!byKey.has(k)) byKey.set(k, u)

    const tenantByKey = new Map<string, string>()
    for (const t of tenants || []) {
      for (const part of String(t.unit_number).split(/[,\s]+/)) {
        for (const k of unitKeys(part)) tenantByKey.set(k, t.full_name)
      }
    }

    setRows(ALL_ROOMS.map(({ floor, room }) => {
      const k = unitKey(room.number)
      const db = unitKeys(room.number).map(x => byKey.get(x)).find(Boolean)
      const photosRaw: string[] = Array.isArray(db?.photos) ? db.photos.filter(Boolean) : []
      return {
        floor, room,
        id: db?.id ?? null,
        status: db?.status || 'occupied',
        rate: db?.rent_rate ?? null,
        area: Number(db?.area) > 5 ? Number(db.area) : room.area,
        photos: photosRaw.filter(p => !isVideoUrl(p)),
        video: siteCols ? (db?.video_url || photosRaw.find(isVideoUrl) || null) : (photosRaw.find(isVideoUrl) || null),
        description: db?.description || '',
        published: db?.is_published !== false,
        tenantName: unitKeys(room.number).map(x => tenantByKey.get(x)).find(Boolean) || null,
      }
    }))
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const shown = rows
    .filter(r => floor === 'all' || r.floor === floor)
    .filter(r => !onlyFree || r.status === 'free')

  const freeCount = rows.filter(r => r.status === 'free').length
  const withPhotos = rows.filter(r => r.photos.length > 0).length
  const selRow = rows.find(r => unitKey(r.room.number) === sel) || null

  /** Проставляет «занято» там, где есть арендатор, и «свободно» — где его нет. */
  async function syncWithTenants() {
    const diff = rows.filter(r => (r.tenantName ? 'occupied' : 'free') !== r.status)
    if (!diff.length) return alert('Статусы уже совпадают с карточками арендаторов')
    if (!confirm(`Обновить статус у ${diff.length} помещений по данным арендаторов?\n\nЭто изменит то, что видно на сайте.`)) return
    setSyncing(true)
    for (const r of diff) {
      const status = r.tenantName ? 'occupied' : 'free'
      if (r.id) await supabase.from('units').update({ status }).eq('id', r.id)
      else await supabase.from('units').insert({ number: r.room.number, floor: r.floor, area: r.room.area, type: 'office', status })
    }
    setSyncing(false)
    load()
  }

  return (
    <div>
      {!hasSiteCols && (
        <div style={{ ...CARD, background: '#fffbeb', borderColor: '#fcd34d', marginBottom: 14, fontSize: 13, color: '#92400e' }}>
          В базе нет полей <b>video_url</b> и <b>is_published</b>. Видео и скрытие помещения с сайта будут доступны после
          выполнения миграции <code>supabase/migrations/20260920_site.sql</code> в SQL-редакторе Supabase.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 14 }}>
        {[
          { l: 'Помещений на плане', v: rows.length, c: '#1a2240' },
          { l: 'Свободно на сайте', v: freeCount, c: '#16a34a' },
          { l: 'С фотографиями', v: `${withPhotos} из ${rows.length}`, c: '#4f6ef7' },
        ].map(s => (
          <div key={s.l} style={{ ...CARD, padding: '12px 14px' }}>
            <div style={{ fontSize: 11, color: '#8596b4', marginBottom: 4 }}>{s.l}</div>
            <div style={{ fontSize: 22, fontWeight: 600, color: s.c }}>{s.v}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        {([['all', 'Все этажи'], [2, '2 этаж'], [3, '3 этаж']] as const).map(([v, l]) => (
          <button key={String(v)} onClick={() => setFloor(v as any)}
            style={{ padding: '6px 14px', borderRadius: 7, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
              border: floor === v ? '2px solid #4f6ef7' : '1px solid #d1d5db', background: floor === v ? '#eff3ff' : '#fff', color: '#374151' }}>
            {l}
          </button>
        ))}
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#374151', marginLeft: 6 }}>
          <input type="checkbox" checked={onlyFree} onChange={e => setOnlyFree(e.target.checked)} />
          только свободные
        </label>
        <button onClick={syncWithTenants} disabled={syncing || loading}
          style={{ marginLeft: 'auto', padding: '7px 14px', borderRadius: 7, border: '1px solid #d1d5db', background: '#fff', color: '#374151', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
          {syncing ? 'Обновляем…' : '↻ Сверить статусы с арендаторами'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selRow ? '1fr 380px' : '1fr', gap: 14, alignItems: 'start' }}>
        <div style={{ ...CARD, padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e8ebf3', textAlign: 'left', color: '#8596b4' }}>
                {['Помещение', 'Этаж', 'Площадь', 'Статус', 'Ставка ₽/м²', 'Медиа', 'На сайте', ''].map(h => (
                  <th key={h} style={{ padding: '9px 12px', fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={8} style={{ padding: 20, textAlign: 'center', color: '#8596b4' }}>Загрузка…</td></tr>}
              {!loading && shown.map(r => {
                const st = STATUS[r.status] || STATUS.occupied
                const key = unitKey(r.room.number)
                return (
                  <tr key={key} style={{ borderBottom: '1px solid #f0f2f8', background: sel === key ? '#f8faff' : undefined }}>
                    <td style={{ padding: '8px 12px', fontWeight: 600, color: '#1a2240' }}>
                      №{r.room.number}
                      {r.tenantName && <div style={{ fontSize: 11, color: '#8596b4', fontWeight: 400 }}>{r.tenantName}</div>}
                    </td>
                    <td style={{ padding: '8px 12px', color: '#6b7280' }}>{r.floor}</td>
                    <td style={{ padding: '8px 12px', color: '#374151' }}>{r.area} м²</td>
                    <td style={{ padding: '8px 12px' }}>
                      <span style={{ padding: '2px 8px', borderRadius: 5, background: st.bg, color: st.color, fontSize: 12, fontWeight: 500 }}>{st.label}</span>
                    </td>
                    <td style={{ padding: '8px 12px', color: '#374151' }}>{r.rate ? Number(r.rate).toLocaleString('ru-RU') : '—'}</td>
                    <td style={{ padding: '8px 12px', color: r.photos.length ? '#374151' : '#c3cad8' }}>
                      {r.photos.length ? `${r.photos.length} фото` : 'нет фото'}{r.video ? ' · видео' : ''}
                    </td>
                    <td style={{ padding: '8px 12px', color: r.status === 'free' && r.published ? '#16a34a' : '#c3cad8' }}>
                      {r.status === 'free' && r.published ? 'показывается' : '—'}
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      <button onClick={() => setSel(sel === key ? null : key)}
                        style={{ padding: '3px 10px', fontSize: 13, borderRadius: 5, border: '1px solid #e8ebf3', color: '#374151', background: '#f9fafb', cursor: 'pointer', fontFamily: 'inherit' }}>
                        {sel === key ? 'Закрыть' : 'Настроить'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {selRow && <UnitEditor row={selRow} hasSiteCols={hasSiteCols} onSaved={load} onClose={() => setSel(null)} />}
      </div>
    </div>
  )
}

/* ─── Карточка помещения: фото, видео, статус, цена ──────────────────────── */

function UnitEditor({ row, hasSiteCols, onSaved, onClose }: { row: Row; hasSiteCols: boolean; onSaved: () => void; onClose: () => void }) {
  const [status, setStatus] = useState(row.status)
  const [rate, setRate] = useState(row.rate ?? '')
  const [description, setDescription] = useState(row.description)
  const [video, setVideo] = useState(row.video || '')
  const [published, setPublished] = useState(row.published)
  const [photos, setPhotos] = useState<string[]>(row.photos)
  const [busy, setBusy] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const key = unitKey(row.room.number)

  useEffect(() => {
    setStatus(row.status); setRate(row.rate ?? ''); setDescription(row.description)
    setVideo(row.video || ''); setPublished(row.published); setPhotos(row.photos)
  }, [key])

  /** Возвращает id строки units, создавая её при необходимости. */
  async function ensureUnitId(): Promise<string | null> {
    if (row.id) return row.id
    const { data, error } = await supabase.from('units')
      .insert({ number: row.room.number, floor: row.floor, area: row.room.area, type: 'office', status })
      .select('id').single()
    if (error) { alert('Не удалось создать помещение: ' + error.message); return null }
    return data.id
  }

  async function upload(files: FileList) {
    const id = await ensureUnitId()
    if (!id) return
    const added: string[] = []
    let newVideo = video
    for (const file of Array.from(files)) {
      setBusy(`Загружаем ${file.name}…`)
      const path = `${id}/${Date.now()}-${file.name.replace(/[^\w.\-]/g, '_')}`
      const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true, contentType: file.type })
      if (error) {
        setBusy('')
        alert(`Не удалось загрузить ${file.name}: ${error.message}\n\nЕсли ошибка про бакет или доступ — выполните миграцию supabase/migrations/20260920_site.sql.`)
        return
      }
      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path)
      if (file.type.startsWith('video/')) newVideo = pub.publicUrl
      else added.push(pub.publicUrl)
    }
    setBusy('')
    setPhotos(p => [...p, ...added])
    if (newVideo !== video) setVideo(newVideo)
  }

  function removePhoto(url: string) {
    setPhotos(p => p.filter(x => x !== url))
  }

  function makeCover(url: string) {
    setPhotos(p => [url, ...p.filter(x => x !== url)])
  }

  async function save() {
    const id = await ensureUnitId()
    if (!id) return
    setBusy('Сохраняем…')
    const payload: Record<string, any> = {
      status,
      rent_rate: rate === '' ? null : Number(rate),
      description: description || null,
      photos: hasSiteCols ? photos : [...photos, ...(video ? [video] : [])],
    }
    if (hasSiteCols) { payload.video_url = video || null; payload.is_published = published }
    const { error } = await supabase.from('units').update(payload).eq('id', id)
    setBusy('')
    if (error) { alert('Ошибка сохранения: ' + error.message); return }
    onSaved()
  }

  return (
    <div style={{ ...CARD, position: 'sticky', top: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#1a2240' }}>Офис №{row.room.number}</div>
          <div style={{ fontSize: 12, color: '#8596b4' }}>{row.floor} этаж · {row.area} м²{row.tenantName ? ` · ${row.tenantName}` : ''}</div>
        </div>
        <button onClick={onClose} style={{ marginLeft: 'auto', border: 'none', background: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 18 }}>✕</button>
      </div>

      <label style={SL}>Статус на сайте</label>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {Object.entries(STATUS).map(([k, s]) => (
          <button key={k} onClick={() => setStatus(k)}
            style={{ flex: 1, padding: '7px 4px', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              border: status === k ? `2px solid ${s.color}` : '1px solid #e5e7eb', background: status === k ? s.bg : '#fff', color: status === k ? s.color : '#6b7280' }}>
            {s.label}
          </button>
        ))}
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={SL}>Ставка, ₽ за м² в месяц</label>
        <input style={SI} value={rate} onChange={e => setRate(e.target.value)} placeholder="например 1800" inputMode="numeric" />
        <div style={{ fontSize: 11, color: '#8596b4', marginTop: 4 }}>
          {rate ? `На сайте: ${(Number(rate) * row.area).toLocaleString('ru-RU')} ₽ в месяц за ${row.area} м²` : 'Пусто — на сайте будет «цена по запросу»'}
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={SL}>Описание для сайта</label>
        <textarea style={{ ...SI, minHeight: 70, resize: 'vertical' }} value={description} onChange={e => setDescription(e.target.value)}
          placeholder="Светлый офис после ремонта, два окна, кондиционер" />
      </div>

      <label style={SL}>Фотографии ({photos.length})</label>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 8 }}>
        {photos.map((p, i) => (
          <div key={p} style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', border: i === 0 ? '2px solid #4f6ef7' : '1px solid #e5e7eb', aspectRatio: '4/3', background: '#f3f4f6' }}>
            <img src={p} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <div style={{ position: 'absolute', inset: 'auto 0 0 0', display: 'flex', gap: 2, padding: 3, background: 'rgba(0,0,0,.45)' }}>
              {i !== 0 && <button onClick={() => makeCover(p)} title="Сделать обложкой" style={{ flex: 1, border: 0, background: 'transparent', color: '#fff', fontSize: 11, cursor: 'pointer' }}></button>}
              <button onClick={() => removePhoto(p)} title="Удалить" style={{ flex: 1, border: 0, background: 'transparent', color: '#fff', fontSize: 11, cursor: 'pointer' }}>✕</button>
            </div>
            {i === 0 && <div style={{ position: 'absolute', top: 4, left: 4, background: '#4f6ef7', color: '#fff', fontSize: 10, padding: '1px 6px', borderRadius: 4 }}>обложка</div>}
          </div>
        ))}
      </div>
      <input ref={fileRef} type="file" accept="image/*,video/mp4,video/webm,video/quicktime" multiple hidden
        onChange={e => e.target.files && upload(e.target.files)} />
      <button onClick={() => fileRef.current?.click()} disabled={!!busy}
        style={{ width: '100%', padding: '9px', borderRadius: 7, border: '1px dashed #c3cad8', background: '#f9fafb', color: '#4f6ef7', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 12 }}>
        {busy || '+ Загрузить фото или видео'}
      </button>

      <div style={{ marginBottom: 12 }}>
        <label style={SL}>Видео: ссылка YouTube / Rutube / VK или загруженный файл</label>
        <input style={SI} value={video} onChange={e => setVideo(e.target.value)} placeholder="https://youtu.be/…" />
      </div>

      {hasSiteCols && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#374151', marginBottom: 14 }}>
          <input type="checkbox" checked={published} onChange={e => setPublished(e.target.checked)} />
          Показывать на сайте, когда помещение свободно
        </label>
      )}

      <button onClick={save} disabled={!!busy}
        style={{ width: '100%', padding: '10px', border: 'none', borderRadius: 7, background: '#4f6ef7', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
        Сохранить и показать на сайте
      </button>
    </div>
  )
}

/* ─── Заявки с сайта ─────────────────────────────────────────────────────── */

function LeadsTab() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [missing, setMissing] = useState(false)
  const [filter, setFilter] = useState<'all' | 'new' | 'in_work' | 'done'>('all')

  async function load() {
    setLoading(true)
    const { leads, fallback } = await fetchSiteLeads()
    setMissing(fallback)
    setLeads(leads)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function setStatus(id: string, status: string) {
    setLeads(l => l.map(x => x.id === id ? { ...x, status } : x))
    await updateLeadStatus(id, status, missing)
  }

  const shown = useMemo(() => leads.filter(l => filter === 'all' || l.status === filter), [leads, filter])
  const newCount = leads.filter(l => l.status === 'new').length

  return (
    <div>
      {missing && (
        <div style={{ ...CARD, background: '#fffbeb', borderColor: '#fcd34d', fontSize: 13, color: '#92400e', marginBottom: 12 }}>
          Таблица <b>site_leads</b> ещё не создана, поэтому заявки с сайта приходят задачами и показаны ниже.
          Выполните <code>supabase/migrations/20260920_site.sql</code> в SQL-редакторе Supabase — после этого они
          будут храниться как полноценные заявки со своими статусами.
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
        {([['all', 'Все'], ['new', `Новые${newCount ? ` (${newCount})` : ''}`], ['in_work', 'В работе'], ['done', 'Закрытые']] as const).map(([v, l]) => (
          <button key={v} onClick={() => setFilter(v as any)}
            style={{ padding: '6px 14px', borderRadius: 7, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
              border: filter === v ? '2px solid #4f6ef7' : '1px solid #d1d5db', background: filter === v ? '#eff3ff' : '#fff', color: '#374151' }}>
            {l}
          </button>
        ))}
        <button onClick={load} style={{ marginLeft: 'auto', padding: '6px 14px', borderRadius: 7, border: '1px solid #d1d5db', background: '#fff', color: '#374151', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>↻ Обновить</button>
      </div>

      <div style={{ ...CARD, padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e8ebf3', textAlign: 'left', color: '#8596b4' }}>
              {['Когда', 'Контакт', 'Запрос', 'Источник', 'Статус'].map(h => <th key={h} style={{ padding: '9px 12px', fontWeight: 500 }}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={5} style={{ padding: 20, textAlign: 'center', color: '#8596b4' }}>Загрузка…</td></tr>}
            {!loading && shown.length === 0 && <tr><td colSpan={5} style={{ padding: 20, textAlign: 'center', color: '#8596b4' }}>Заявок пока нет</td></tr>}
            {shown.map(l => {
              const st = LEAD_STATUS[l.status] || LEAD_STATUS.new
              return (
                <tr key={l.id} style={{ borderBottom: '1px solid #f0f2f8' }}>
                  <td style={{ padding: '9px 12px', color: '#6b7280', whiteSpace: 'nowrap' }}>
                    {new Date(l.created_at).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td style={{ padding: '9px 12px' }}>
                    <div style={{ fontWeight: 600, color: '#1a2240' }}>{l.name || 'Без имени'}</div>
                    <a href={`tel:${l.phone}`} style={{ color: '#4f6ef7' }}>{l.phone}</a>
                    {l.email && <div style={{ fontSize: 12, color: '#8596b4' }}>{l.email}</div>}
                  </td>
                  <td style={{ padding: '9px 12px', color: '#374151', maxWidth: 380 }}>
                    {l.unit_number && <b>Офис №{l.unit_number}. </b>}
                    {l.area_wanted ? `Площадь ~${l.area_wanted} м². ` : ''}
                    {l.message}
                  </td>
                  <td style={{ padding: '9px 12px', color: '#8596b4', fontSize: 12 }}>{l.source || '—'}</td>
                  <td style={{ padding: '9px 12px' }}>
                    <select value={l.status} onChange={e => setStatus(l.id, e.target.value)}
                      style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #e5e7eb', background: st.bg, color: st.color, fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>
                      {Object.entries(LEAD_STATUS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
                    </select>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
