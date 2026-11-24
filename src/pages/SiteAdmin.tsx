import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { ALL_ROOMS, unitKey, unitKeys, type Room } from '../lib/floorGeometry'
import { fetchSiteLeads, updateLeadStatus, type SiteLead } from '../lib/siteLeads'
import { Page, Card, Row, Button, Badge, Stat, Stats, Table, Field, Input, Select, Textarea, Segmented, Tabs, Notice, Loading, ErrorBox, Sub, Muted, C, type Tone } from '../components/ui'

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

const STATUS: Record<string, { label: string; tone: Tone; color: string; bg: string }> = {
  free:     { label: 'Свободно', tone: 'green', color: C.green, bg: C.greenBg },
  occupied: { label: 'Занято',   tone: 'red',   color: C.red,   bg: C.redBg },
  reserved: { label: 'Бронь',    tone: 'amber', color: C.amber, bg: C.amberBg },
}

const LEAD_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  new:     { label: 'Новая',    color: C.accent, bg: C.accentBg },
  in_work: { label: 'В работе', color: C.amber,  bg: C.amberBg },
  done:    { label: 'Закрыта',  color: C.green,  bg: C.greenBg },
  spam:    { label: 'Спам',     color: C.muted,  bg: C.hover },
}

const isVideoUrl = (u: string) => /\.(mp4|webm|mov|m4v)(\?|$)/i.test(u) || /youtu\.?be|vk\.com|rutube/i.test(u)

export default function SiteAdminPage() {
  const [tab, setTab] = useState<'units' | 'leads'>('units')
  return (
    <Page>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Tabs<'units' | 'leads'> value={tab} onChange={setTab} tabs={[['units', 'Помещения на сайте'], ['leads', 'Заявки с сайта']]} />
        </div>
        <a href="/" target="_blank" rel="noopener" style={{ color: C.accent, textDecoration: 'none', fontSize: 13, paddingBottom: 8 }}>
          Открыть сайт в новой вкладке
        </a>
      </div>
      {tab === 'units' ? <UnitsTab /> : <LeadsTab />}
    </Page>
  )
}

/* ─── Помещения ──────────────────────────────────────────────────────────── */

function UnitsTab() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [hasSiteCols, setHasSiteCols] = useState(true)
  const [floor, setFloor] = useState<'all' | 2 | 3>('all')
  const [onlyFree, setOnlyFree] = useState(false)
  const [sel, setSel] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)

  async function load() {
    setLoading(true)
    setError('')
    const probe = await supabase.from('units').select('id,video_url,is_published').limit(1)
    const siteCols = !probe.error
    setHasSiteCols(siteCols)

    const [{ data: units, error: uErr }, { data: tenants, error: tErr }] = await Promise.all([
      supabase.from('units').select('*'),
      supabase.from('tenants').select('full_name,unit_number').not('unit_number', 'is', null),
    ])
    if (uErr || tErr) setError('Не удалось загрузить данные: ' + (uErr || tErr)!.message)

    const byKey = new Map<string, any>()
    for (const u of units || []) for (const k of unitKeys(u.number)) if (!byKey.has(k)) byKey.set(k, u)

    const tenantByKey = new Map<string, string>()
    for (const t of tenants || []) {
      for (const part of String(t.unit_number).split(/[,\s]+/)) {
        for (const k of unitKeys(part)) tenantByKey.set(k, t.full_name)
      }
    }

    setRows(ALL_ROOMS.map(({ floor, room }) => {
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
    <div style={{ display: 'grid', gap: 14 }}>
      {!hasSiteCols && (
        <Notice tone="amber">
          В базе нет полей <b>video_url</b> и <b>is_published</b>. Видео и скрытие помещения с сайта будут доступны после
          выполнения миграции <code>supabase/migrations/20260920_site.sql</code> в SQL-редакторе Supabase.
        </Notice>
      )}
      {error && <ErrorBox error={error} onRetry={load} />}

      <Stats>
        <Stat label="Помещений на плане" value={rows.length} />
        <Stat label="Свободно на сайте" value={freeCount} tone="green" />
        <Stat label="С фотографиями" value={`${withPhotos} из ${rows.length}`} tone="blue" />
      </Stats>

      <Row gap={10}>
        <Segmented<'all' | '2' | '3'> value={String(floor) as 'all' | '2' | '3'} onChange={v => setFloor(v === 'all' ? 'all' : (Number(v) as 2 | 3))}
          options={[['all', 'Все этажи'], ['2', '2 этаж'], ['3', '3 этаж']]} />
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: C.text }}>
          <input type="checkbox" checked={onlyFree} onChange={e => setOnlyFree(e.target.checked)} />
          только свободные
        </label>
        <div style={{ marginLeft: 'auto' }}>
          <Button onClick={syncWithTenants} disabled={syncing || loading}>
            {syncing ? 'Обновляем…' : 'Сверить статусы с арендаторами'}
          </Button>
        </div>
      </Row>

      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 560px', minWidth: 0 }}>
          <Card pad={false}>
            {loading ? <Loading /> : (
              <Table rows={shown} rowKey={r => unitKey(r.room.number)} empty="Нет помещений по выбранному фильтру" cols={[
                { key: 'n', title: 'Помещение', sort: r => r.room.number, render: r => (
                  <div>
                    <span style={{ fontWeight: 600 }}>№{r.room.number}</span>
                    {r.tenantName && <Sub>{r.tenantName}</Sub>}
                  </div>
                ) },
                { key: 'f', title: 'Этаж', sort: r => r.floor, render: r => <Muted>{r.floor}</Muted> },
                { key: 'a', title: 'Площадь', align: 'right', sort: r => r.area, render: r => `${r.area} м²` },
                { key: 's', title: 'Статус', sort: r => r.status, render: r => {
                  const st = STATUS[r.status] || STATUS.occupied
                  return <Badge tone={st.tone}>{st.label}</Badge>
                } },
                { key: 'r', title: 'Ставка ₽/м²', align: 'right', sort: r => r.rate, render: r => r.rate ? Number(r.rate).toLocaleString('ru-RU') : '—' },
                { key: 'm', title: 'Медиа', render: r => (
                  <span style={{ color: r.photos.length ? C.text : C.faint }}>
                    {r.photos.length ? `${r.photos.length} фото` : 'нет фото'}{r.video ? ' · видео' : ''}
                  </span>
                ) },
                { key: 'p', title: 'На сайте', render: r => r.status === 'free' && r.published
                  ? <span style={{ color: C.green }}>показывается</span> : <span style={{ color: C.faint }}>—</span> },
                { key: 'x', title: '', align: 'right', render: r => {
                  const key = unitKey(r.room.number)
                  return <Button small kind={sel === key ? 'primary' : 'secondary'} onClick={() => setSel(sel === key ? null : key)}>{sel === key ? 'Закрыть' : 'Настроить'}</Button>
                } },
              ]} />
            )}
          </Card>
        </div>

        {selRow && (
          <div style={{ flex: '1 1 320px', maxWidth: 420, minWidth: 0, position: 'sticky', top: 0 }}>
            <UnitEditor row={selRow} hasSiteCols={hasSiteCols} onSaved={load} onClose={() => setSel(null)} />
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── Карточка помещения: фото, видео, статус, цена ──────────────────────── */

function UnitEditor({ row, hasSiteCols, onSaved, onClose }: { row: Row; hasSiteCols: boolean; onSaved: () => void; onClose: () => void }) {
  const [status, setStatus] = useState(row.status)
  const [rate, setRate] = useState<string | number>(row.rate ?? '')
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

  const overlayBtn: React.CSSProperties = { flex: 1, border: 0, background: 'transparent', color: C.onAccent, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', padding: '2px 0' }

  return (
    <Card
      title={<div>Офис №{row.room.number}<Sub>{row.floor} этаж · {row.area} м²{row.tenantName ? ` · ${row.tenantName}` : ''}</Sub></div>}
      actions={<Button small kind="ghost" onClick={onClose}>Закрыть</Button>}>
      <div style={{ display: 'grid', gap: 12 }}>
        <Field label="Статус на сайте">
          <div style={{ display: 'flex', gap: 6 }}>
            {Object.entries(STATUS).map(([k, s]) => (
              <button key={k} type="button" onClick={() => setStatus(k)}
                style={{ flex: 1, padding: '7px 4px', borderRadius: C.radiusSm, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                  border: `1px solid ${status === k ? s.color : C.line}`, background: status === k ? s.bg : C.card, color: status === k ? s.color : C.muted }}>
                {s.label}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Ставка, ₽ за м² в месяц"
          hint={rate ? `На сайте: ${(Number(rate) * row.area).toLocaleString('ru-RU')} ₽ в месяц за ${row.area} м²` : 'Пусто — на сайте будет «цена по запросу»'}>
          <Input value={rate} onChange={e => setRate(e.target.value)} placeholder="например 1800" inputMode="numeric" />
        </Field>

        <Field label="Описание для сайта">
          <Textarea style={{ minHeight: 70 }} value={description} onChange={e => setDescription(e.target.value)}
            placeholder="Светлый офис после ремонта, два окна, кондиционер" />
        </Field>

        <div style={{ display: 'grid', gap: 8 }}>
          <div style={{ fontSize: 12, color: C.muted, fontWeight: 500 }}>Фотографии ({photos.length})</div>
          {photos.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
              {photos.map((p, i) => (
                <div key={p} style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', border: i === 0 ? `2px solid ${C.accent}` : `1px solid ${C.line}`, aspectRatio: '4/3', background: C.card2 }}>
                  <img src={p} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <div style={{ position: 'absolute', inset: 'auto 0 0 0', display: 'flex', gap: 2, padding: 3, background: C.overlay }}>
                    {i !== 0 && <button type="button" onClick={() => makeCover(p)} title="Сделать обложкой" style={overlayBtn}>Обложка</button>}
                    <button type="button" onClick={() => removePhoto(p)} title="Удалить" style={overlayBtn}>Удалить</button>
                  </div>
                  {i === 0 && <div style={{ position: 'absolute', top: 4, left: 4, background: C.accent, color: C.onAccent, fontSize: 10, padding: '1px 6px', borderRadius: 4 }}>обложка</div>}
                </div>
              ))}
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*,video/mp4,video/webm,video/quicktime" multiple hidden
            onChange={e => e.target.files && upload(e.target.files)} />
          <Button onClick={() => fileRef.current?.click()} disabled={!!busy}
            style={{ width: '100%', borderStyle: 'dashed', borderColor: C.lineStrong, background: C.card2, color: C.accent }}>
            {busy || 'Загрузить фото или видео'}
          </Button>
        </div>

        <Field label="Видео: ссылка YouTube / Rutube / VK или загруженный файл">
          <Input value={video} onChange={e => setVideo(e.target.value)} placeholder="https://youtu.be/…" />
        </Field>

        {hasSiteCols && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: C.text }}>
            <input type="checkbox" checked={published} onChange={e => setPublished(e.target.checked)} />
            Показывать на сайте, когда помещение свободно
          </label>
        )}

        <Button kind="primary" onClick={save} disabled={!!busy} style={{ width: '100%', padding: '10px 14px' }}>
          Сохранить и показать на сайте
        </Button>
      </div>
    </Card>
  )
}

/* ─── Заявки с сайта ─────────────────────────────────────────────────────── */

function LeadsTab() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [missing, setMissing] = useState(false)
  const [filter, setFilter] = useState<'all' | 'new' | 'in_work' | 'done'>('all')
  const [saveError, setSaveError] = useState('')

  async function load() {
    setLoading(true)
    const { leads, fallback } = await fetchSiteLeads()
    setMissing(fallback)
    setLeads(leads)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function setStatus(id: string, status: string) {
    const prev = leads
    setSaveError('')
    setLeads(l => l.map(x => x.id === id ? { ...x, status } : x))
    try { await updateLeadStatus(id, status, missing) } catch (e: any) { setLeads(prev); setSaveError(e.message) }
  }

  const shown = useMemo(() => leads.filter(l => filter === 'all' || l.status === filter), [leads, filter])
  const newCount = leads.filter(l => l.status === 'new').length

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {saveError && <Notice tone="red">{saveError}</Notice>}
      {missing && (
        <Notice tone="amber">
          Таблица <b>site_leads</b> ещё не создана, поэтому заявки с сайта приходят задачами и показаны ниже.
          Выполните <code>supabase/migrations/20260920_site.sql</code> в SQL-редакторе Supabase — после этого они
          будут храниться как полноценные заявки со своими статусами.
        </Notice>
      )}
      <Row gap={10}>
        <Segmented<'all' | 'new' | 'in_work' | 'done'> value={filter} onChange={setFilter}
          options={[['all', 'Все'], ['new', `Новые${newCount ? ` (${newCount})` : ''}`], ['in_work', 'В работе'], ['done', 'Закрытые']]} />
        <div style={{ marginLeft: 'auto' }}><Button onClick={load} disabled={loading}>Обновить</Button></div>
      </Row>

      <Card pad={false}>
        {loading ? <Loading /> : (
          <Table rows={shown} rowKey={l => l.id} empty="Заявок пока нет" cols={[
            { key: 'd', title: 'Когда', sort: l => l.created_at, render: l => (
              <span style={{ color: C.muted, whiteSpace: 'nowrap' }}>
                {new Date(l.created_at).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
              </span>
            ) },
            { key: 'c', title: 'Контакт', sort: l => l.name || '', render: l => (
              <div>
                <div style={{ fontWeight: 600 }}>{l.name || 'Без имени'}</div>
                <a href={`tel:${l.phone}`} style={{ color: C.accent, textDecoration: 'none' }}>{l.phone}</a>
                {l.email && <Sub>{l.email}</Sub>}
              </div>
            ) },
            { key: 'q', title: 'Запрос', render: l => (
              <div style={{ maxWidth: 380 }}>
                {l.unit_number && <b>Офис №{l.unit_number}. </b>}
                {l.area_wanted ? `Площадь ~${l.area_wanted} м². ` : ''}
                {l.message}
              </div>
            ) },
            { key: 's', title: 'Источник', render: l => <Muted small>{l.source || '—'}</Muted> },
            { key: 'st', title: 'Статус', sort: l => l.status, render: l => {
              const st = LEAD_STATUS[l.status] || LEAD_STATUS.new
              return (
                <Select value={l.status} onChange={e => setStatus(l.id, e.target.value)}
                  style={{ width: 'auto', padding: '4px 8px', fontSize: 12, fontWeight: 600, cursor: 'pointer', background: st.bg, color: st.color }}>
                  {Object.entries(LEAD_STATUS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
                </Select>
              )
            } },
          ]} />
        )}
      </Card>
    </div>
  )
}
