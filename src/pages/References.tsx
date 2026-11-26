import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { sb, useSb, useAction } from '../lib/query'
import type { Tables } from '../lib/database.types'
import { C, Page, Card, Row, Button, Badge, Field, Input, Select, Textarea, Search, Tabs, Modal, Notice, Loading, Empty, ErrorBox, Muted, Table, dateRu } from '../components/ui'
import { Icon } from '../components/icons'


const groupHead: React.CSSProperties = { padding: '10px 16px', background: C.card2, borderBottom: `1px solid ${C.line}`, fontSize: 12, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '.5px' }

/** Подтверждение удаления вместо confirm(). */
function ConfirmModal({ text, onCancel, onConfirm, busy, error }: { text: string; onCancel: () => void; onConfirm: () => void; busy?: boolean; error?: string }) {
  return (
    <Modal title="Подтверждение" onClose={onCancel} width={420}
      footer={<><Button onClick={onCancel}>Отмена</Button><Button kind="danger" disabled={busy} onClick={onConfirm}>{busy ? 'Удаление…' : 'Удалить'}</Button></>}>
      <div>{text}</div>
      {error && <Notice tone="red">{error}</Notice>}
    </Modal>
  )
}

// ─── ТАРИФЫ ───────────────────────────────────────────────────────────────────

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
const KEY_ICONS: Record<string, string> = {
  electricity_markup: 'meters',
  electricity_tariff: 'meters',
  cold_water_tariff: 'heat',
  hot_water_tariff: 'heat',
  cleaning_price: 'repairs',
}

type Setting = Tables<'settings'>

function TariffsSection() {
  // тарифы читаются от имени вошедшего сотрудника (без входа таблица закрыта)
  const settingsQ = useSb(['settings'], () => sb(supabase.from('settings').select('*').order('key').order('valid_from', { ascending: false })))
  const settings: Setting[] = settingsQ.data ?? []
  const [editing, setEditing] = useState<string | null>(null)
  const [newValue, setNewValue] = useState('')
  const [validFrom, setValidFrom] = useState(new Date().toISOString().slice(0, 10))
  const [saveErr, setSaveErr] = useState('')
  const [success, setSuccess] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)

  const getCurrent = (key: string) =>
    settings.filter(s => s.key === key).sort((a, b) => b.valid_from.localeCompare(a.valid_from))[0]

  const getHistory = (key: string) =>
    settings.filter(s => s.key === key).sort((a, b) => b.valid_from.localeCompare(a.valid_from))

  const saveA = useAction(async (v: { key: string; value: number; validFrom: string }) => {
    const { data: u } = await supabase.auth.getUser()
    const prof = u.user ? await sb(supabase.from('profiles').select('full_name').eq('user_id', u.user.id).maybeSingle()).catch(() => null) : null
    await sb(supabase.from('settings').insert({
      key: v.key, value: v.value, description: KEY_LABELS[v.key], valid_from: v.validFrom,
      created_by: prof?.full_name || u.user?.email || null,
    }))
  }, {
    invalidate: ['settings'],
    onSuccess: () => {
      setEditing(null); setNewValue('')
      setSuccess('Сохранено. Новое значение применится к новым счетам.')
      setTimeout(() => setSuccess(''), 4000)
    },
  })
  const saving = saveA.isPending

  function save(key: string) {
    if (!newValue) return
    setSaveErr('')
    saveA.mutate({ key, value: parseFloat(newValue), validFrom }, { onError: e => setSaveErr('Не удалось сохранить: ' + e.message) })
  }

  const uniqueKeys = [...new Set(settings.map(s => s.key))]

  if (settingsQ.isPending) return <Loading />
  const error = settingsQ.error ? 'Не удалось загрузить тарифы: ' + settingsQ.error.message : ''

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <Muted>История изменений сохраняется — старые счета пересчитываться не будут.</Muted>

      {error && <ErrorBox error={error} onRetry={() => settingsQ.refetch()} />}
      {success && <Notice tone="green">{success}</Notice>}
      {!error && uniqueKeys.length === 0 && <Card><Empty>Тарифов нет</Empty></Card>}

      <div style={{ display: 'grid', gap: 8 }}>
        {uniqueKeys.map(key => {
          const current = getCurrent(key)
          const history = getHistory(key)
          const isEditing = editing === key
          const isExpanded = expanded === key

          return (
            <Card key={key} pad={false}>
              <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ width: 36, height: 36, background: C.hover, color: C.muted, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon name={KEY_ICONS[key] || 'reference'} size={18} />
                </div>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{KEY_LABELS[key] || key}</div>
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>с {dateRu(current?.valid_from)}</div>
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                  {current?.value} <span style={{ fontSize: 13, color: C.muted, fontWeight: 400 }}>{KEY_UNITS[key]}</span>
                </div>
                <Row gap={6}>
                  <Button small onClick={() => setExpanded(isExpanded ? null : key)}>{isExpanded ? 'Скрыть историю' : 'История'}</Button>
                  {isEditing
                    ? <Button small onClick={() => setEditing(null)}>Отмена</Button>
                    : <Button small kind="primary" onClick={() => { setEditing(key); setSaveErr(''); setNewValue(String(current?.value || '')) }}>Изменить</Button>}
                </Row>
              </div>

              {isEditing && (
                <div style={{ padding: '14px 18px', borderTop: `1px solid ${C.line}`, display: 'grid', gap: 12 }}>
                  <Notice tone="amber">Новое значение применится только к новым счетам. Старые счета останутся неизменными.</Notice>
                  <Row gap={10} align="flex-end">
                    <div style={{ width: 160 }}>
                      <Field label={`Новое значение (${KEY_UNITS[key] || ''})`}>
                        <Input type="number" step="0.01" value={newValue} onChange={e => setNewValue(e.target.value)} />
                      </Field>
                    </div>
                    <div style={{ width: 160 }}>
                      <Field label="Действует с">
                        <Input type="date" value={validFrom} onChange={e => setValidFrom(e.target.value)} />
                      </Field>
                    </div>
                    <Button kind="primary" onClick={() => save(key)} disabled={saving}>{saving ? 'Сохранение…' : 'Сохранить'}</Button>
                  </Row>
                  {saveErr && <Notice tone="red">{saveErr}</Notice>}
                </div>
              )}

              {isExpanded && (
                <div style={{ borderTop: `1px solid ${C.line}` }}>
                  <Table dense rows={history} rowKey={h => h.id} empty="Истории нет" cols={[
                    { key: 'from', title: 'Дата начала', render: h => <span style={{ fontWeight: h === history[0] ? 600 : 400 }}>{dateRu(h.valid_from)}</span> },
                    { key: 'value', title: 'Значение', render: h => <span style={{ fontWeight: h === history[0] ? 600 : 400, color: h === history[0] ? C.accent : C.muted }}>{h.value} {KEY_UNITS[key]}</span> },
                    { key: 'by', title: 'Кто изменил', render: h => <Muted>{h.created_by || '—'}</Muted> },
                    { key: 'at', title: 'Записано', render: h => <span style={{ color: C.faint }}>{h.created_at ? dateRu(h.created_at.slice(0, 10)) : '—'}</span> },
                  ]} />
                </div>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}

// ─── УСЛУГИ ───────────────────────────────────────────────────────────────────

type Service = Tables<'services'>
interface ServiceForm { name: string; category: string; description: string; price: number; unit: string; vat: number }
const emptyService: ServiceForm = { name: '', category: '', description: '', price: 0, unit: 'шт', vat: 0 }

function ServiceModal({ service, categories, onClose, onSaved }: { service: Service | null; categories: string[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<ServiceForm>(service ? {
    name: service.name, category: service.category ?? '', description: service.description ?? '',
    price: service.price ?? 0, unit: service.unit ?? '', vat: service.vat ?? 0,
  } : { ...emptyService })
  const [newUnit, setNewUnit] = useState('')
  const [err, setErr] = useState('')
  const [confirmDel, setConfirmDel] = useState(false)
  const set = <K extends keyof ServiceForm>(k: K, v: ServiceForm[K]) => setForm(f => ({ ...f, [k]: v }))

  const unitsQ = useSb(['service_units', 'names'], () => sb(supabase.from('service_units').select('name').order('name')))
  const units = (unitsQ.data ?? []).map(u => u.name)

  const addUnitA = useAction(async (name: string) => {
    await sb(supabase.from('service_units').insert({ name }))
  }, { invalidate: ['service_units'], onSuccess: (_r, name) => { set('unit', name); setNewUnit('') } })
  const saveA = useAction(async (f: ServiceForm) => {
    if (service?.id) await sb(supabase.from('services').update(f).eq('id', service.id))
    else await sb(supabase.from('services').insert(f))
  }, { invalidate: ['services'], onSuccess: onSaved })
  const removeA = useAction(async (id: string) => {
    await sb(supabase.from('services').delete().eq('id', id))
  }, { invalidate: ['services'], onSuccess: onSaved })
  const saving = saveA.isPending

  function addUnit() {
    if (!newUnit.trim()) return
    setErr('')
    addUnitA.mutate(newUnit.trim())
  }

  function save() {
    if (!form.name.trim()) { setErr('Введите название'); return }
    setErr('')
    saveA.mutate(form)
  }

  function remove() {
    if (!service?.id) return
    setErr('')
    removeA.mutate(service.id, { onError: () => setConfirmDel(false) })
  }

  const footer = confirmDel ? (
    <Row>
      <span style={{ color: C.muted, fontSize: 13 }}>Удалить услугу?</span>
      <Button onClick={() => setConfirmDel(false)}>Нет</Button>
      <Button kind="danger" onClick={remove}>Удалить</Button>
    </Row>
  ) : (
    <>
      {service && <Button kind="danger" onClick={() => setConfirmDel(true)} style={{ marginRight: 'auto' }}>Удалить</Button>}
      <Button onClick={onClose}>Отмена</Button>
      <Button kind="primary" onClick={save} disabled={saving}>{saving ? 'Сохранение…' : 'Сохранить'}</Button>
    </>
  )

  return (
    <Modal title={service ? 'Редактировать услугу' : 'Новая услуга'} onClose={onClose} footer={footer}>
      <Field label="Название *"><Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Аренда офиса" autoFocus /></Field>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
        <Field label="Категория">
          <Select value={form.category} onChange={e => set('category', e.target.value)}>
            <option value="">— Выбрать</option>
            {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
          </Select>
        </Field>
        <div style={{ display: 'grid', gap: 6, alignContent: 'start' }}>
          <Field label="Единица измерения">
            <Select value={form.unit} onChange={e => set('unit', e.target.value)}>
              <option value="">— Выбрать</option>
              {units.map(u => <option key={u} value={u}>{u}</option>)}
            </Select>
          </Field>
          <div style={{ display: 'flex', gap: 6 }}>
            <Input style={{ flex: 1 }} value={newUnit} onChange={e => setNewUnit(e.target.value)} placeholder="Добавить единицу..." onKeyDown={e => e.key === 'Enter' && addUnit()} />
            <Button small onClick={addUnit} aria-label="Добавить единицу">Добавить</Button>
          </div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Field label="Цена (₽)"><Input type="number" value={form.price || ''} onChange={e => set('price', Number(e.target.value))} placeholder="0" /></Field>
        <Field label="НДС (%)"><Input type="number" value={form.vat || ''} onChange={e => set('vat', Number(e.target.value))} placeholder="0" /></Field>
      </div>
      <Field label="Описание"><Textarea value={form.description} onChange={e => set('description', e.target.value)} style={{ minHeight: 60 }} /></Field>
      {err && <Notice tone="red">{err}</Notice>}
      {unitsQ.error && <Notice tone="red">Не удалось загрузить единицы измерения: {unitsQ.error.message}</Notice>}
      {addUnitA.error && <Notice tone="red">Не удалось добавить единицу: {addUnitA.error}</Notice>}
      {saveA.error && <Notice tone="red">Ошибка сохранения: {saveA.error}</Notice>}
      {removeA.error && <Notice tone="red">Не удалось удалить: {removeA.error}</Notice>}
    </Modal>
  )
}

function ServiceRow({ s, first, withVat, onClick }: { s: Service; first: boolean; withVat: boolean; onClick: () => void }) {
  const [hover, setHover] = useState(false)
  return (
    <div onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', borderTop: first ? 'none' : `1px solid ${C.line}`, background: hover ? C.hover : undefined, transition: 'background .1s' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500 }}>{s.name}</div>
        {s.description && <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{s.description}</div>}
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        {s.price ? <div style={{ fontSize: 14, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{s.price.toLocaleString('ru')} ₽</div> : null}
        <div style={{ fontSize: 12, color: C.muted }}>{s.unit}{withVat && s.vat ? ` · НДС ${s.vat}%` : ''}</div>
      </div>
      <span style={{ color: C.faint, display: 'inline-flex', transform: 'rotate(-90deg)' }}><Icon name="chevron" /></span>
    </div>
  )
}

function ServicesSection() {
  const servicesQ = useSb(['services'], () => sb(supabase.from('services').select('*').order('category').order('name')))
  const catsQ = useSb(['service_categories', 'names'], () => sb(supabase.from('service_categories').select('name').order('name')))
  const services = servicesQ.data ?? []
  const categories = (catsQ.data ?? []).map(c => c.name)
  const loadErr = servicesQ.error || catsQ.error
  const error = loadErr ? 'Не удалось загрузить услуги: ' + loadErr.message : ''
  const load = () => { servicesQ.refetch(); catsQ.refetch() }
  const [selected, setSelected] = useState<Service | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [catFilter, setCatFilter] = useState('')
  const [search, setSearch] = useState('')

  const filtered = services.filter(s => {
    if (catFilter && s.category !== catFilter) return false
    if (search && !s.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const grouped = categories.length > 0
    ? categories.reduce((acc, cat) => {
        const items = filtered.filter(s => s.category === cat)
        if (items.length > 0 || !catFilter) acc[cat] = items
        return acc
      }, {} as Record<string, Service[]>)
    : { '': filtered }

  // Без категории — пустая категория или категория, которой больше нет в справочнике.
  // Когда категорий нет совсем, все услуги уже показаны общим списком выше.
  const uncategorized = categories.length > 0 ? filtered.filter(s => !s.category || !categories.includes(s.category)) : []

  const open = (s: Service | null) => { setSelected(s); setShowModal(true) }

  if (servicesQ.isPending || catsQ.isPending) return <Loading />

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <Row gap={10}>
        <Search value={search} onChange={setSearch} placeholder="Поиск услуги..." width={200} />
        <Select value={catFilter} onChange={e => setCatFilter(e.target.value)} style={{ width: 200 }}>
          <option value="">Все категории</option>
          {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
        </Select>
        <div style={{ flex: 1 }} />
        <Muted>{filtered.length} услуг</Muted>
        <Button kind="primary" onClick={() => open(null)}>Добавить услугу</Button>
      </Row>

      {error && <ErrorBox error={error} onRetry={load} />}

      <div style={{ display: 'grid', gap: 8 }}>
        {Object.entries(grouped).map(([cat, items]) => items.length === 0 ? null : (
          <Card key={cat || '_all'} pad={false}>
            {cat && <div style={groupHead}>{cat}</div>}
            {items.map((s, i) => <ServiceRow key={s.id} s={s} first={i === 0} withVat onClick={() => open(s)} />)}
          </Card>
        ))}

        {uncategorized.length > 0 && (
          <Card pad={false}>
            <div style={groupHead}>Без категории</div>
            {uncategorized.map((s, i) => <ServiceRow key={s.id} s={s} first={i === 0} withVat={false} onClick={() => open(s)} />)}
          </Card>
        )}

        {filtered.length === 0 && !error && <Card><Empty>Услуги не найдены</Empty></Card>}
      </div>

      {showModal && <ServiceModal service={selected} categories={categories} onClose={() => setShowModal(false)} onSaved={() => setShowModal(false)} />}
    </div>
  )
}

// ─── ПРОСТОЙ СПИСОК (категории и единицы) ─────────────────────────────────────

interface NameItem { id: string; name: string }

function NameListSection({ table, placeholder, emptyText, kindLabel, mono }: { table: 'service_categories' | 'service_units'; placeholder: string; emptyText: string; kindLabel: string; mono?: boolean }) {
  const itemsQ = useSb([table], () => sb(supabase.from(table).select('id, name').order('name')))
  const items: NameItem[] = itemsQ.data ?? []
  const [newName, setNewName] = useState('')
  const [toDelete, setToDelete] = useState<NameItem | null>(null)

  const addA = useAction(async (name: string) => {
    await sb(supabase.from(table).insert({ name }))
  }, { invalidate: [table], onSuccess: () => setNewName('') })
  const removeA = useAction(async (id: string) => {
    await sb(supabase.from(table).delete().eq('id', id))
  }, { invalidate: [table], onSuccess: () => setToDelete(null) })
  const actionErr = addA.error ? 'Не удалось добавить: ' + addA.error : ''
  const deleteErr = removeA.error ? 'Не удалось удалить: ' + removeA.error : ''

  function add() {
    if (!newName.trim()) return
    addA.mutate(newName.trim())
  }

  function remove() {
    if (!toDelete) return
    removeA.mutate(toDelete.id)
  }

  if (itemsQ.isPending) return <Loading />
  const error = itemsQ.error ? 'Не удалось загрузить список: ' + itemsQ.error.message : ''

  return (
    <div style={{ maxWidth: 480, display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <Input style={{ flex: 1 }} value={newName} onChange={e => setNewName(e.target.value)}
          placeholder={placeholder} onKeyDown={e => e.key === 'Enter' && add()} autoFocus />
        <Button kind="primary" onClick={add} disabled={addA.isPending}>Добавить</Button>
      </div>
      {actionErr && <Notice tone="red">{actionErr}</Notice>}
      {error && <ErrorBox error={error} onRetry={() => itemsQ.refetch()} />}

      <Card pad={false}>
        {items.length === 0
          ? <Empty>{emptyText}</Empty>
          : items.map((it, i) => (
            <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderTop: i > 0 ? `1px solid ${C.line}` : 'none' }}>
              <div style={{ flex: 1, fontSize: 14, fontWeight: 500, fontFamily: mono ? 'monospace' : undefined }}>{it.name}</div>
              <Button small kind="danger" onClick={() => { removeA.reset(); setToDelete(it) }}>Удалить</Button>
            </div>
          ))
        }
      </Card>

      {toDelete && <ConfirmModal text={`Удалить ${kindLabel} «${toDelete.name}»?`} busy={removeA.isPending} error={deleteErr} onCancel={() => setToDelete(null)} onConfirm={remove} />}
    </div>
  )
}

function CategoriesSection() {
  return <NameListSection table="service_categories" placeholder="Название категории..." emptyText="Категорий нет — добавьте первую" kindLabel="категорию" />
}

function UnitsSection() {
  return <NameListSection table="service_units" placeholder="Например: шт, м², кВт·ч..." emptyText="Единиц измерения нет" kindLabel="единицу" mono />
}

// ─── ГЛАВНАЯ СТРАНИЦА ─────────────────────────────────────────────────────────

type SectionId = 'services' | 'tariffs' | 'categories' | 'units'
const SECTIONS: { id: SectionId; label: string; desc: string }[] = [
  { id: 'services', label: 'Услуги', desc: 'Прайс-лист услуг' },
  { id: 'tariffs', label: 'Тарифы и нормативы', desc: 'Тарифы с историей изменений' },
  { id: 'categories', label: 'Категории услуг', desc: 'Группировка услуг' },
  { id: 'units', label: 'Единицы измерения', desc: 'шт, м², кВт·ч...' },
]

export default function ReferencesPage() {
  const [active, setActive] = useState<SectionId>('services')
  const section = SECTIONS.find(s => s.id === active)!

  return (
    <Page>
      <Tabs<SectionId> tabs={SECTIONS.map(s => [s.id, s.label] as [SectionId, string])} value={active} onChange={setActive} />
      <Row gap={8}>
        <Badge tone="blue">{section.label}</Badge>
        <Muted small>{section.desc}</Muted>
      </Row>

      {active === 'services' && <ServicesSection />}
      {active === 'tariffs' && <TariffsSection />}
      {active === 'categories' && <CategoriesSection />}
      {active === 'units' && <UnitsSection />}
    </Page>
  )
}
