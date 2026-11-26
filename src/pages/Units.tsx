// Помещения: список с фильтрами по этажу, статусу и типу, поиск по номеру и арендатору (/units?q=201 из общего поиска),
// карточка помещения для добавления и правки.
import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router'
import { supabase } from '../lib/supabase'
import { useSb, useAction, sb } from '../lib/query'
import type { Tables } from '../lib/database.types'
import {
  Page, Card, Row, Button, Badge, Stat, Stats, Table, Field, Input, Select, Textarea, Search, Notice, Loading, ErrorBox, Sub, num, C, type Tone,
} from '../components/ui'

type Unit = Tables<'units'> & { tenants: { id: string; full_name: string } | null }

const TYPES: Record<string, { label: string }> = {
  office: { label: 'Офис' },
  storage: { label: 'Склад' },
  corridor: { label: 'Коридор' },
  common: { label: 'Общее' },
  other: { label: 'Другое' },
}

const STATUS: Record<string, { label: string; tone: Tone }> = {
  free: { label: 'Свободно', tone: 'green' },
  occupied: { label: 'Занято', tone: 'red' },
  reserved: { label: 'Резерв', tone: 'amber' },
}

const rentOf = (area: number | null, rate: number | null) => (area && rate ? num(Math.round(area * rate)) + ' ₽' : '—')

/** Подтверждение действия прямо на странице вместо системного confirm(). */
function ConfirmNotice({ text, yes, onYes, onNo, busy }: { text: string; yes: string; onYes: () => void; onNo: () => void; busy?: boolean }) {
  return (
    <Notice tone="amber">
      <Row gap={8} justify="space-between">
        <span>{text}</span>
        <Row gap={6}>
          <Button small kind="danger" onClick={onYes} disabled={busy}>{yes}</Button>
          <Button small onClick={onNo}>Отмена</Button>
        </Row>
      </Row>
    </Notice>
  )
}

function UnitForm({ unit, onBack }: { unit: Unit | null; onBack: () => void }) {
  const [form, setForm] = useState({
    number: unit?.number || '',
    floor: unit?.floor || 2,
    area: unit?.area || 0,
    has_window: unit?.has_window ?? true,
    rooms_count: unit?.rooms_count || 1,
    type: unit?.type || 'office',
    status: unit?.status || 'free',
    rent_rate: unit?.rent_rate || 0,
    panorama_url: unit?.panorama_url || '',
    description: unit?.description || '',
  })
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm(f => ({ ...f, [k]: v }))

  const write = useAction(() => sb(unit?.id
    ? supabase.from('units').update(form).eq('id', unit.id)
    : supabase.from('units').insert(form)), { invalidate: ['units', 'tenants'], onSuccess: onBack })
  const del = useAction(() => sb(supabase.from('units').delete().eq('id', unit?.id ?? '')), { invalidate: ['units', 'tenants'], onSuccess: onBack })
  const saving = write.isPending || del.isPending

  function save() {
    if (!form.number) { setError('Введите номер помещения'); return }
    setError('')
    write.mutate(undefined, { onError: e => setError('Ошибка сохранения: ' + e.message) })
  }

  function remove() {
    if (!unit?.id) return
    del.mutate(undefined, { onSettled: () => setConfirmDelete(false), onError: e => setError('Ошибка удаления: ' + e.message) })
  }

  const hasRent = !!(form.area && form.rent_rate)

  return (
    <Page actions={<Button kind="ghost" onClick={onBack}>Назад к списку</Button>}>
      <div style={{ maxWidth: 560, width: '100%' }}>
        <Card title={unit?.id ? `Помещение № ${unit.number}` : 'Новое помещение'}>
          <div style={{ display: 'grid', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
              <Field label="Номер *"><Input value={form.number} onChange={e => set('number', e.target.value)} placeholder="201" /></Field>
              <Field label="Этаж"><Input type="number" value={form.floor} onChange={e => set('floor', Number(e.target.value))} /></Field>
              <Field label="Площадь (м²)"><Input type="number" value={form.area || ''} onChange={e => set('area', Number(e.target.value))} /></Field>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
              <Field label="Тип">
                <Select value={form.type} onChange={e => set('type', e.target.value)}>
                  {Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </Select>
              </Field>
              <Field label="Статус">
                <Select value={form.status} onChange={e => set('status', e.target.value)}>
                  {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </Select>
              </Field>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
              <Field label="Кол-во комнат"><Input type="number" value={form.rooms_count} onChange={e => set('rooms_count', Number(e.target.value))} /></Field>
              <Field label="Ставка (₽/м²)"><Input type="number" value={form.rent_rate || ''} onChange={e => set('rent_rate', Number(e.target.value))} /></Field>
              <Field label="Аренда (₽/мес)">
                <div style={{
                  border: `1px solid ${C.line}`, borderRadius: C.radiusSm, padding: '7px 10px', fontSize: 14, background: C.card2,
                  color: hasRent ? C.text : C.faint, fontWeight: hasRent ? 600 : 400,
                }}>
                  {rentOf(form.area, form.rent_rate)}
                </div>
              </Field>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: C.text, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.has_window} onChange={e => set('has_window', e.target.checked)} style={{ width: 16, height: 16, cursor: 'pointer', accentColor: C.accent }} />
              Есть окно
            </label>
            <Field label="Ссылка на панораму 3D"><Input value={form.panorama_url} onChange={e => set('panorama_url', e.target.value)} placeholder="https://..." /></Field>
            <Field label="Описание"><Textarea value={form.description} onChange={e => set('description', e.target.value)} style={{ minHeight: 70 }} /></Field>
            {error && <Notice tone="red">{error}</Notice>}
            {confirmDelete && <ConfirmNotice text="Удалить помещение?" yes="Удалить" onYes={remove} onNo={() => setConfirmDelete(false)} busy={saving} />}
            <Row gap={8}>
              <Button kind="primary" onClick={save} disabled={saving} style={{ flex: 1 }}>{saving ? 'Сохранение…' : 'Сохранить'}</Button>
              {unit && <Button kind="danger" onClick={() => setConfirmDelete(true)} disabled={saving}>Удалить</Button>}
              <Button onClick={onBack}>Отмена</Button>
            </Row>
          </div>
        </Card>
      </div>
    </Page>
  )
}

export default function UnitsPage() {
  const [params] = useSearchParams()
  const qParam = params.get('q') || ''
  const unitsQ = useSb(['units', 'list'], () => sb(supabase.from('units').select('*, tenants(id, full_name)').order('floor').order('number')))
  const units: Unit[] = unitsQ.data ?? []
  const loading = unitsQ.isPending
  const [selected, setSelected] = useState<Unit | null>(null)
  const [view, setView] = useState<'list' | 'edit'>('list')
  const [q, setQ] = useState(qParam)
  const [floorFilter, setFloorFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')

  // Переход из общего поиска, когда страница уже открыта: подставить новый номер.
  useEffect(() => { setQ(qParam); if (qParam) setView('list') }, [qParam])

  if (view === 'edit') return <UnitForm unit={selected} onBack={() => setView('list')} />

  const floors = [...new Set(units.map(u => u.floor).filter((f): f is number => !!f))].sort((a, b) => a - b)
  const s = q.trim().toLowerCase()
  const filtered = units.filter(u => {
    if (floorFilter && String(u.floor) !== floorFilter) return false
    if (statusFilter && u.status !== statusFilter) return false
    if (typeFilter && u.type !== typeFilter) return false
    if (s && ![u.number, u.tenants?.full_name, u.description].some(v => (v || '').toLowerCase().includes(s))) return false
    return true
  })

  const stats = {
    total: units.length,
    free: units.filter(u => u.status === 'free').length,
    occupied: units.filter(u => u.status === 'occupied').length,
    totalArea: units.reduce((sum, u) => sum + (u.area || 0), 0),
  }

  return (
    <Page actions={<Button kind="primary" onClick={() => { setSelected(null); setView('edit') }}>Добавить помещение</Button>}>
      <Stats>
        <Stat label="Всего помещений" value={stats.total} />
        <Stat label="Свободно" value={stats.free} tone="green" />
        <Stat label="Занято" value={stats.occupied} tone="red" />
        <Stat label="Общая площадь" value={`${num(stats.totalArea, 2)} м²`} />
      </Stats>

      <Row gap={10}>
        <Search value={q} onChange={setQ} placeholder="Номер, арендатор" />
        <Select style={{ width: 150 }} value={floorFilter} onChange={e => setFloorFilter(e.target.value)}>
          <option value="">Все этажи</option>
          {floors.map(f => <option key={f} value={String(f)}>{f} этаж</option>)}
        </Select>
        <Select style={{ width: 160 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">Все статусы</option>
          {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </Select>
        <Select style={{ width: 150 }} value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="">Все типы</option>
          {Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </Select>
      </Row>

      {unitsQ.error && <ErrorBox error={unitsQ.error.message} onRetry={() => unitsQ.refetch()} />}

      <Card pad={false}>
        {loading ? <Loading /> : (
          <Table rows={filtered} rowKey={u => u.id} onRow={u => { setSelected(u); setView('edit') }} empty="Помещений не найдено" cols={[
            { key: 'n', title: '№', sort: u => u.number, render: u => <span style={{ fontWeight: 600 }}>{u.number}</span> },
            { key: 'f', title: 'Этаж', sort: u => u.floor ?? null, render: u => <span style={{ color: C.muted }}>{u.floor || '—'}</span> },
            { key: 't', title: 'Арендатор', sort: u => u.tenants?.full_name ?? null, render: u => u.tenants?.full_name
              ? <div style={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.tenants.full_name}</div>
              : <span style={{ color: C.faint }}>—</span> },
            { key: 'ty', title: 'Тип', render: u => ((u.type && TYPES[u.type]) || TYPES.other).label },
            { key: 'a', title: 'Площадь', align: 'right', sort: u => Number(u.area || 0), render: u => u.area ? `${u.area} м²` : '—' },
            { key: 'r', title: '₽/м²', align: 'right', sort: u => Number(u.rent_rate || 0), render: u => u.rent_rate ? num(u.rent_rate) + ' ₽' : '—' },
            { key: 'm', title: 'Сумма/мес', align: 'right', sort: u => (u.area || 0) * (u.rent_rate || 0), render: u => <span style={{ fontWeight: 500 }}>{rentOf(u.area, u.rent_rate)}</span> },
            { key: 's', title: 'Статус', sort: u => u.status, render: u => { const st = (u.status && STATUS[u.status]) || STATUS.free; return <Badge tone={st.tone}>{st.label}</Badge> } },
            { key: 'p', title: '', render: u => u.panorama_url
              ? <a href={u.panorama_url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ color: C.accent, textDecoration: 'none', fontSize: 12, fontWeight: 500 }}>Панорама 3D</a>
              : null },
          ]} />
        )}
      </Card>
      {!loading && filtered.length > 0 && s && <Sub>Найдено: {filtered.length}</Sub>}
    </Page>
  )
}
