import { apiFetch, openStoredFile } from '../lib/api'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { Page, Card, Grid, Row, Button, Badge, Stat, Stats, Table, Field, Input, Select, Textarea, Modal, Notice, Loading, Empty, ErrorBox, Muted, Sub, C, money, num } from '../components/ui'
import { Icon } from '../components/icons'

export const TYPES: Record<string, {label:string;icon:string;unit:string}> = {
  electricity: {label:'Электричество',icon:'',unit:'кВт·ч'},
  cold_water: {label:'Холодная вода',icon:'',unit:'м³'},
  hot_water: {label:'Горячая вода',icon:'',unit:'м³'},
  heat: {label:'Тепло',icon:'',unit:'Гкал'},
  gas: {label:'Газ',icon:'',unit:'м³'},
  boiler: {label:'Бойлер',icon:'',unit:'м³'},
  common_electricity: {label:'Общий эл.',icon:'',unit:'кВт·ч'},
  common_water: {label:'Общий вода',icon:'',unit:'м³'},
  common_heat: {label:'Общее тепло',icon:'',unit:'Гкал'},
}

type Tone = 'green' | 'amber' | 'neutral' | 'red'

/** Кнопка «Назад» к списку счётчиков. */
function BackButton({ onClick }: { onClick: () => void }) {
  return <div><Button kind="ghost" small onClick={onClick} style={{ paddingLeft: 0 }}>Назад к счётчикам</Button></div>
}

/** Подтверждение удаления вместо confirm(). */
function ConfirmDelete({ title, text, busy, onCancel, onConfirm }: { title: string; text: string; busy?: boolean; onCancel: () => void; onConfirm: () => void }) {
  return (
    <Modal title={title} onClose={onCancel} width={420} footer={<>
      <Button onClick={onCancel}>Отмена</Button>
      <Button kind="danger" onClick={onConfirm} disabled={busy}>{busy ? 'Удаление…' : 'Удалить'}</Button>
    </>}>
      <div style={{ fontSize: 14 }}>{text}</div>
    </Modal>
  )
}

export default function MetersPage() {
  const [meters, setMeters] = useState<any[]>([])
  const [units, setUnits] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [selected, setSelected] = useState<any>(null)
  const [view, setView] = useState<'list'|'edit'|'readings'>('list')
  const [scanning, setScanning] = useState(false)
  const [scanResult, setScanResult] = useState<{ tone: Tone; text: string } | null>(null)
  const quickScanRef = useRef<HTMLInputElement>(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true); setLoadError('')
    const [{data:m, error:me},{data:u, error:ue}] = await Promise.all([
      supabase.from('meters').select('*'),
      supabase.from('units').select('id,number,tenant_premises(tenant_id,tenants(full_name))').order('number')
    ])
    const err = me || ue
    if (err) setLoadError('Не удалось загрузить счётчики: ' + err.message)
    setMeters(m||[])
    setUnits(u||[])
    setLoading(false)
  }

  async function quickScan(file: File) {
    setScanning(true)
    setScanResult({ tone: 'neutral', text: 'Распознаю счётчик…' })
    try {
      const imageBase64 = await fileToBase64(file)
      const meterSerials = meters.map((m: any) => m.serial).filter(Boolean)
      const res = await apiFetch('/api/recognize-meter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64, meterNumbers: meterSerials })
      })
      const data = await res.json()
      if (data.ok && data.meters?.length > 0) {
        const best = data.meters[0]
        const found = meters.find((m: any) => m.serial && best.serial && m.serial.toLowerCase().replace(/\s/g,'').includes(best.serial.toLowerCase().replace(/\s/g,'')))
        if (found) {
          setScanResult({ tone: 'green', text: `Счётчик ${found.serial || found.number} (${TYPES[found.type]?.label || found.type}) — показание ${best.reading}` })
          setSelected(found)
          setView('readings')
        } else {
          setScanResult({ tone: 'amber', text: `Серийный номер ${best.serial} не найден в базе. Показание: ${best.reading}` })
        }
      } else {
        setScanResult({ tone: 'neutral', text: 'Не удалось распознать счётчик. Попробуйте сделать фото чётче.' })
      }
    } catch { setScanResult({ tone: 'red', text: 'Ошибка распознавания' }) }
    setScanning(false)
  }

  if (loading) return <Page><Loading /></Page>

  if (view === 'edit') return <MeterForm meter={selected} units={units} onBack={() => { setView('list'); load() }} />
  if (view === 'readings' && selected) return <ReadingsView
    key={selected.id}
    meter={selected}
    allMeters={meters}
    onSwitchMeter={(m) => setSelected(m)}
    onBack={() => { setView('list'); load() }}
  />

  return (
    <Page>
      <Row gap={10} justify="space-between">
        <Row gap={10}>
          <input ref={quickScanRef} type="file" accept="image/*" style={{display:'none'}}
            onChange={e => { const f = e.target.files?.[0]; if (f) quickScan(f); e.target.value = '' }} />
          <Button onClick={() => quickScanRef.current?.click()} disabled={scanning}>
            {scanning ? 'Распознаю…' : 'Сканировать счётчик'}
          </Button>
          <Muted small>Фото счётчика: AI найдёт его по серийному номеру</Muted>
        </Row>
        <Button kind="primary" onClick={() => { setSelected(null); setView('edit') }}>Добавить счётчик</Button>
      </Row>
      {loadError && <ErrorBox error={loadError} onRetry={load} />}
      {scanResult && !scanning && (
        <Notice tone={scanResult.tone}>
          <Row justify="space-between" wrap={false}>
            <span>{scanResult.text}</span>
            <Button small kind="ghost" onClick={() => setScanResult(null)}>Скрыть</Button>
          </Row>
        </Notice>
      )}
      {meters.length === 0 ? <Card><Empty>Счётчики не добавлены</Empty></Card> : (
        <Grid min={260}>
          {meters.map(m => {
            const t = TYPES[m.type] || {label:m.type,icon:'',unit:''}
            return (
              <Card key={m.id}>
                <div style={{ display: 'grid', gap: 10 }}>
                  <Row justify="space-between" wrap={false} align="flex-start">
                    <Row gap={10} wrap={false}>
                      <span style={{ color: C.accent, background: C.accentBg, borderRadius: C.radiusSm, padding: 6, display: 'inline-flex' }}>
                        <Icon name={m.type?.includes('heat') ? 'heat' : 'meters'} size={18} />
                      </span>
                      <div>
                        <div style={{ fontWeight: 600 }}>{t.label}</div>
                        <Sub>№ {m.number||m.serial||'—'}</Sub>
                      </div>
                    </Row>
                    <Button small onClick={() => { setSelected(m); setView('edit') }}>Изменить</Button>
                  </Row>
                  {m.tariff > 0 && <Muted small>Тариф: {m.tariff} ₽/{t.unit}</Muted>}
                  <Button kind="primary" style={{ width: '100%' }} onClick={() => { setSelected(m); setView('readings') }}>Показания</Button>
                </div>
              </Card>
            )
          })}
        </Grid>
      )}
    </Page>
  )
}

function MeterForm({meter, units, onBack}: {meter:any; units:any[]; onBack:()=>void}) {
  const [form, setForm] = useState({
    number: meter?.number||meter?.serial||'',
    type: meter?.type||'electricity',
    unit_id: meter?.unit_id||'',
    location: meter?.location||'office',
    area: meter?.area||0,
    tariff: meter?.tariff||0,
    heat_tariff: meter?.heat_tariff||0,
    notes: meter?.notes||'',
  })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ tone: 'red' | 'amber'; text: string } | null>(null)
  const [askDelete, setAskDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const set = (k:string,v:any) => setForm(f=>({...f,[k]:v}))

  async function save() {
    setMsg(null)
    if (!form.number) { setMsg({ tone: 'amber', text: 'Введите номер счётчика' }); return }
    setSaving(true)
    const p = {...form, serial: form.number, unit_id: form.unit_id||null}
    const { error } = meter?.id
      ? await supabase.from('meters').update(p).eq('id', meter.id)
      : await supabase.from('meters').insert(p)
    setSaving(false)
    if (error) { setMsg({ tone: 'red', text: 'Ошибка сохранения: ' + error.message }); return }
    onBack()
  }

  async function remove() {
    if (!meter?.id) return
    setDeleting(true)
    const { error } = await supabase.from('meters').delete().eq('id', meter.id)
    setDeleting(false)
    if (error) { setAskDelete(false); setMsg({ tone: 'red', text: 'Ошибка удаления: ' + error.message }); return }
    onBack()
  }

  const isHeat = form.type === 'heat' || form.type === 'common_heat'

  return (
    <Page>
      <BackButton onClick={onBack} />
      <div style={{ maxWidth: 520, width: '100%' }}>
        <Card title={meter?.id ? 'Счётчик' : 'Новый счётчик'}>
          <div style={{ display: 'grid', gap: 14 }}>
            <Field label="Номер счётчика (обязательно)">
              <Input value={form.number} onChange={e=>set('number',e.target.value)} placeholder="12345678"/>
            </Field>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))',gap:10}}>
              <Field label="Тип">
                <Select value={form.type} onChange={e=>set('type',e.target.value)}>
                  {Object.entries(TYPES).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
                </Select>
              </Field>
              <Field label="Расположение">
                <Select value={form.location} onChange={e=>set('location',e.target.value)}>
                  <option value="office">Офис</option>
                  <option value="common">Общий</option>
                </Select>
              </Field>
            </div>
            <Field label="Офис">
              <Select value={form.unit_id} onChange={e=>set('unit_id',e.target.value)}>
                <option value="">Не привязан</option>
                {units.map(u=><option key={u.id} value={u.id}>Офис {u.number}</option>)}
              </Select>
            </Field>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))',gap:10}}>
              <Field label={`Тариф (₽/${TYPES[form.type]?.unit||'ед.'})`}>
                <Input type="number" value={form.tariff||''} onChange={e=>set('tariff',Number(e.target.value))}/>
              </Field>
              {isHeat && <Field label="Тариф тепла (₽/Гкал·м²)"><Input type="number" value={form.heat_tariff||''} onChange={e=>set('heat_tariff',Number(e.target.value))}/></Field>}
              {isHeat && <Field label="Площадь (м²)"><Input type="number" value={form.area||''} onChange={e=>set('area',Number(e.target.value))}/></Field>}
            </div>
            <Field label="Заметки">
              <Textarea style={{minHeight:60}} value={form.notes} onChange={e=>set('notes',e.target.value)}/>
            </Field>
            {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
            <Row>
              <Button kind="primary" onClick={save} disabled={saving}>{saving?'Сохранение…':'Сохранить'}</Button>
              <Button onClick={onBack}>Отмена</Button>
              {meter && <div style={{ marginLeft: 'auto' }}><Button kind="danger" onClick={() => setAskDelete(true)}>Удалить</Button></div>}
            </Row>
          </div>
        </Card>
      </div>
      {askDelete && <ConfirmDelete title="Удалить счётчик?" text={`Счётчик № ${form.number || '—'} будет удалён.`} busy={deleting}
        onCancel={() => setAskDelete(false)} onConfirm={remove} />}
    </Page>
  )
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function ReadingsView({meter, onBack, allMeters, onSwitchMeter}: {meter:any; onBack:()=>void; allMeters:any[]; onSwitchMeter:(m:any)=>void}) {
  const [readings, setReadings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({period: new Date().toISOString().slice(0,7)+'-01', prev_value:0, curr_value:0, notes:''})
  const [saving, setSaving] = useState(false)
  const [photoFile, setPhotoFile] = useState<File|null>(null)
  const [photoUploading, setPhotoUploading] = useState(false)
  const [recognizing, setRecognizing] = useState(false)
  const [recognizeResult, setRecognizeResult] = useState<{serial:string; reading:number; matched:boolean; wrongMeter?:any}|null>(null)
  const [recognizeFailed, setRecognizeFailed] = useState(false)
  const [msg, setMsg] = useState<{ tone: 'red' | 'amber'; text: string } | null>(null)
  const [toDelete, setToDelete] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const t = TYPES[meter.type] || {label:meter.type,icon:'',unit:''}

  useEffect(() => { loadReadings() }, [])

  async function loadReadings() {
    setLoading(true); setLoadError('')
    const {data, error} = await supabase.from('meter_readings').select('*').eq('meter_id',meter.id).order('period',{ascending:false})
    if (error) setLoadError('Не удалось загрузить показания: ' + error.message)
    setReadings(data||[])
    if (data && data.length > 0) setForm(f=>({...f, prev_value: data[0].curr_value}))
    setLoading(false)
  }

  const consumption = Math.max(0, form.curr_value - form.prev_value)
  const amount = meter.type === 'heat'
    ? consumption * (meter.heat_tariff||0) * (meter.area||1)
    : consumption * (meter.tariff||0)

  async function recognizePhoto(file: File) {
    setRecognizing(true)
    setRecognizeResult(null); setRecognizeFailed(false)
    try {
      const imageBase64 = await fileToBase64(file)
      const meterSerials = allMeters.map((m: any) => m.serial).filter(Boolean)
      const res = await apiFetch('/api/recognize-meter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64, meterNumbers: meterSerials })
      })
      const data = await res.json()
      if (data.ok && data.meters?.length > 0) {
        const best = data.meters[0]
        const matchedMeter = allMeters.find((m: any) => m.serial && best.serial && m.serial.toLowerCase().includes(best.serial.toLowerCase().replace(/\s/g, '')))
        const isCurrent = matchedMeter?.id === meter.id
        setRecognizeResult({
          serial: best.serial,
          reading: best.reading,
          matched: !!matchedMeter,
          wrongMeter: matchedMeter && !isCurrent ? matchedMeter : undefined,
        })
        if (typeof best.reading === 'number' && !isNaN(best.reading)) {
          setForm(f => ({ ...f, curr_value: best.reading }))
        }
      } else setRecognizeFailed(true)
    } catch { setRecognizeResult(null); setRecognizeFailed(true) }
    setRecognizing(false)
  }

  async function save() {
    setSaving(true); setMsg(null)
    let photo_url: string | null = null
    if (photoFile) {
      setPhotoUploading(true)
      const ext = photoFile.name.split('.').pop()
      const path = `${meter.id}/${form.period.slice(0,7)}-${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('meter-photos').upload(path, photoFile, { upsert: true })
      if (!upErr) {
        const { data: pub } = supabase.storage.from('meter-photos').getPublicUrl(path)
        photo_url = pub.publicUrl
      }
      setPhotoUploading(false)
    }
    const { error } = await supabase.from('meter_readings').insert({
      meter_id: meter.id,
      period: form.period,
      prev_value: form.prev_value,
      curr_value: form.curr_value,
      consumption,
      amount,
      notes: form.notes,
      reading: form.curr_value,
      previous_reading: form.prev_value,
      reading_date: new Date().toISOString().slice(0, 10),
      ...(photo_url ? { photo_url } : {}),
    })
    setSaving(false)
    if (error) { setMsg({ tone: 'red', text: 'Ошибка сохранения показания: ' + error.message }); return }
    setPhotoFile(null)
    setShowAdd(false)
    loadReadings()
  }

  async function del(id:string) {
    setDeleting(true)
    const { error } = await supabase.from('meter_readings').delete().eq('id',id)
    setDeleting(false); setToDelete(null)
    if (error) { setMsg({ tone: 'red', text: 'Ошибка удаления: ' + error.message }); return }
    loadReadings()
  }

  const recognizeTone: 'amber' | 'green' | 'neutral' = recognizeResult?.wrongMeter ? 'amber' : recognizeResult?.matched ? 'green' : 'neutral'

  return (
    <Page>
      <BackButton onClick={onBack} />
      <Row gap={10}>
        <span style={{ color: C.accent, background: C.accentBg, borderRadius: C.radiusSm, padding: 6, display: 'inline-flex' }}>
          <Icon name={meter.type?.includes('heat') ? 'heat' : 'meters'} size={18} />
        </span>
        <span style={{ fontSize: 16, fontWeight: 600 }}>{t.label} № {meter.number||meter.serial}</span>
        <Muted>Тариф: {meter.tariff} ₽/{t.unit}</Muted>
      </Row>

      {msg && !showAdd && <Notice tone={msg.tone}>{msg.text}</Notice>}

      {!showAdd ? (
        <div><Button kind="primary" onClick={()=>setShowAdd(true)}>Внести показания</Button></div>
      ) : (
        <Card title="Новые показания">
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))',gap:10}}>
              <Field label="Период"><Input type="month" value={form.period.slice(0,7)} onChange={e=>setForm(f=>({...f,period:e.target.value+'-01'}))}/></Field>
              <Field label="Предыдущее"><Input type="number" value={form.prev_value} onChange={e=>setForm(f=>({...f,prev_value:Number(e.target.value)}))}/></Field>
              <Field label="Текущее"><Input type="number" value={form.curr_value} onChange={e=>setForm(f=>({...f,curr_value:Number(e.target.value)}))}/></Field>
            </div>
            <Stats>
              <Stat label="Расход" value={`${consumption.toFixed(2)} ${t.unit}`} />
              <Stat label="К оплате" value={money(amount)} />
            </Stats>
            <Field label="Заметка"><Input value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))}/></Field>
            <div style={{ display: 'grid', gap: 8 }}>
              <input ref={fileRef} type="file" accept="image/*" style={{display:'none'}}
                onChange={e => {
                  const f = e.target.files?.[0]
                  if (f) { setPhotoFile(f); recognizePhoto(f) }
                  e.target.value = ''
                }} />
              <Row>
                <Button small onClick={()=>fileRef.current?.click()}>{photoFile ? 'Заменить фото' : 'Фото показаний'}</Button>
                {recognizing && <Badge tone="blue">Распознаю…</Badge>}
                {photoFile && !recognizing && (
                  <Row gap={4} wrap={false}>
                    <Muted small>{photoFile.name}</Muted>
                    <Button small kind="ghost" onClick={() => { setPhotoFile(null); setRecognizeResult(null); setRecognizeFailed(false) }}>Убрать</Button>
                  </Row>
                )}
              </Row>
              {recognizeResult && !recognizing && (
                <Notice tone={recognizeTone}>
                  {recognizeResult.wrongMeter
                    ? `Серийный номер ${recognizeResult.serial} — это счётчик ${recognizeResult.wrongMeter.serial || recognizeResult.wrongMeter.number}. `
                    : recognizeResult.matched
                      ? `Серийный номер ${recognizeResult.serial} совпадает. `
                      : `Серийный номер ${recognizeResult.serial} не найден в базе. `}
                  {typeof recognizeResult.reading === 'number' && `Показание: ${recognizeResult.reading}`}
                  {recognizeResult.wrongMeter && (
                    <> <Button small kind="ghost" onClick={() => onSwitchMeter(recognizeResult.wrongMeter)}>Перейти к нему</Button></>
                  )}
                </Notice>
              )}
              {recognizeFailed && !recognizing && <Notice tone="amber">Не удалось распознать показание по фото — введите его вручную. Фото всё равно сохранится.</Notice>}
            </div>
            {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
            <Row>
              <Button kind="primary" onClick={save} disabled={saving}>{saving ? (photoUploading ? 'Загрузка фото…' : 'Сохранение…') : 'Сохранить'}</Button>
              <Button onClick={()=>setShowAdd(false)}>Отмена</Button>
            </Row>
          </div>
        </Card>
      )}

      {loadError && <ErrorBox error={loadError} onRetry={loadReadings} />}
      <Card pad={false} title="Показания">
        {loading ? <Loading /> : (
          <Table rows={readings} rowKey={r => r.id} empty="Показаний нет" cols={[
            { key: 'p', title: 'Период', sort: r => r.period, render: r => new Date(r.period).toLocaleDateString('ru',{month:'long',year:'numeric'}) },
            { key: 'pv', title: 'Пред.', align: 'right', render: r => <Muted>{num(r.prev_value, 3)}</Muted> },
            { key: 'cv', title: 'Тек.', align: 'right', render: r => <Muted>{num(r.curr_value, 3)}</Muted> },
            { key: 'c', title: 'Расход', align: 'right', sort: r => Number(r.consumption), render: r => <span style={{ fontWeight: 500 }}>{r.consumption} {t.unit}</span> },
            { key: 'a', title: 'Сумма', align: 'right', sort: r => Number(r.amount), render: r => <span style={{ fontWeight: 600 }}>{money(r.amount)}</span> },
            { key: 'n', title: 'Заметка', render: r => <Muted small>{r.notes||'—'}</Muted> },
            { key: 'f', title: 'Фото', render: r => r.photo_url
              ? <Button small kind="ghost" style={{ padding: 0 }} onClick={() => openStoredFile(r.photo_url)}>Фото</Button>
              : <span style={{ color: C.faint }}>—</span> },
            { key: 'x', title: '', align: 'right', render: r => <Button small kind="danger" onClick={() => setToDelete(r.id)}>Удалить</Button> },
          ]} />
        )}
      </Card>

      {toDelete && <ConfirmDelete title="Удалить показание?" text="Показание будет удалено без возможности восстановления." busy={deleting}
        onCancel={() => setToDelete(null)} onConfirm={() => del(toDelete)} />}
    </Page>
  )
}
