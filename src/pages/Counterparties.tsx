// Контрагенты: категории слева, список справа, карточка в окне с вкладками.
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Page, Card, Button, Badge, Table, Field, Input, Select, Textarea, Tabs, Modal, Notice, Loading, ErrorBox, Muted, Sub, C } from '../components/ui'
import { ask } from '../components/Dialogs'

interface Category { id: string; name: string }
interface Counterparty {
  id: string
  category_id: string | null
  type: string
  name: string
  short_name: string
  inn: string
  kpp: string
  ogrn: string
  legal_address: string
  actual_address: string
  phone: string
  email: string
  website: string
  contact_person: string
  contact_position: string
  contact_phone: string
  bank: string
  bik: string
  account: string
  corr_account: string
  status: string
  notes: string
}

const empty: Omit<Counterparty, 'id'> = {
  category_id: null, type: 'company', name: '', short_name: '',
  inn: '', kpp: '', ogrn: '', legal_address: '', actual_address: '',
  phone: '', email: '', website: '',
  contact_person: '', contact_position: '', contact_phone: '',
  bank: '', bik: '', account: '', corr_account: '',
  status: 'active', notes: '',
}

const TYPE_LABELS: Record<string, string> = { company: 'Юрлицо', ip: 'ИП', person: 'Физлицо' }
const STATUS_LABELS: Record<string, { label: string; tone: 'green' | 'neutral' }> = {
  active: { label: 'Активен', tone: 'green' },
  archive: { label: 'Архив', tone: 'neutral' },
}

const cols = (n: number): React.CSSProperties => ({ display: 'grid', gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`, gap: 10 })

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: 4 }}>{children}</div>
}

// ─── Окно контрагента ─────────────────────────────────────────────────────────

type CpTab = 'main' | 'contacts' | 'bank' | 'extra'

function CounterpartyModal({ cp, categories, onClose, onSaved }: {
  cp: Counterparty | null
  categories: Category[]
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState<Omit<Counterparty, 'id'>>(cp ? { ...cp } : { ...empty })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [tab, setTab] = useState<CpTab>('main')
  const set = (k: string, v: string | null) => setForm(f => ({ ...f, [k]: v }))

  async function save() {
    if (!form.name.trim()) { setTab('main'); setErr('Введите название'); return }
    setErr('')
    setSaving(true)
    const { error } = cp?.id
      ? await supabase.from('counterparties').update(form).eq('id', cp.id)
      : await supabase.from('counterparties').insert(form)
    setSaving(false)
    if (error) { setErr('Ошибка: ' + error.message); return }
    onSaved()
  }

  async function remove() {
    if (!cp?.id || !(await ask('Удалить контрагента?', { ok: 'Удалить', danger: true }))) return
    const { error } = await supabase.from('counterparties').delete().eq('id', cp.id)
    if (error) { setErr('Ошибка: ' + error.message); return }
    onSaved()
  }

  return (
    <Modal title={cp ? cp.name : 'Новый контрагент'} onClose={onClose} width={600} footer={<>
      {cp && <Button kind="danger" onClick={remove} style={{ marginRight: 'auto' }}>Удалить</Button>}
      <Button onClick={onClose}>Отмена</Button>
      <Button kind="primary" onClick={save} disabled={saving}>{saving ? 'Сохранение…' : 'Сохранить'}</Button>
    </>}>
      <Tabs<CpTab> value={tab} onChange={setTab} tabs={[['main', 'Основное'], ['contacts', 'Контакты'], ['bank', 'Банк'], ['extra', 'Доп.']]} />

      {tab === 'main' && <>
        <div style={cols(2)}>
          <Field label="Категория">
            <Select value={form.category_id || ''} onChange={e => set('category_id', e.target.value || null)}>
              <option value="">Без категории</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
          <Field label="Тип">
            <Select value={form.type} onChange={e => set('type', e.target.value)}>
              <option value="company">Юрлицо</option>
              <option value="ip">ИП</option>
              <option value="person">Физлицо</option>
            </Select>
          </Field>
        </div>
        <Field label="Название / ФИО *"><Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="ООО Пример или Иванов Иван Иванович" /></Field>
        <Field label="Краткое название"><Input value={form.short_name} onChange={e => set('short_name', e.target.value)} placeholder="Пример" /></Field>
        <SectionTitle>Реквизиты</SectionTitle>
        <div style={cols(3)}>
          <Field label="ИНН"><Input value={form.inn} onChange={e => set('inn', e.target.value)} placeholder="7700000000" /></Field>
          <Field label="КПП"><Input value={form.kpp} onChange={e => set('kpp', e.target.value)} placeholder="770001001" /></Field>
          <Field label="ОГРН / ОГРНИП"><Input value={form.ogrn} onChange={e => set('ogrn', e.target.value)} placeholder="1027700000000" /></Field>
        </div>
        <Field label="Юридический адрес"><Input value={form.legal_address} onChange={e => set('legal_address', e.target.value)} placeholder="123456, Москва, ул. Примерная, д. 1" /></Field>
        <Field label="Фактический адрес"><Input value={form.actual_address} onChange={e => set('actual_address', e.target.value)} placeholder="Тот же или другой" /></Field>
      </>}

      {tab === 'contacts' && <>
        <SectionTitle>Организация</SectionTitle>
        <div style={cols(2)}>
          <Field label="Телефон"><Input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+7 900 000-00-00" /></Field>
          <Field label="Email"><Input value={form.email} onChange={e => set('email', e.target.value)} placeholder="info@example.ru" /></Field>
        </div>
        <Field label="Сайт"><Input value={form.website} onChange={e => set('website', e.target.value)} placeholder="https://example.ru" /></Field>
        <SectionTitle>Контактное лицо</SectionTitle>
        <Field label="ФИО"><Input value={form.contact_person} onChange={e => set('contact_person', e.target.value)} placeholder="Иванов Иван Иванович" /></Field>
        <div style={cols(2)}>
          <Field label="Должность"><Input value={form.contact_position} onChange={e => set('contact_position', e.target.value)} placeholder="Менеджер" /></Field>
          <Field label="Телефон"><Input value={form.contact_phone} onChange={e => set('contact_phone', e.target.value)} placeholder="+7 900 000-00-00" /></Field>
        </div>
      </>}

      {tab === 'bank' && <>
        <SectionTitle>Банковские реквизиты</SectionTitle>
        <Field label="Банк"><Input value={form.bank} onChange={e => set('bank', e.target.value)} placeholder="ПАО Сбербанк" /></Field>
        <div style={cols(2)}>
          <Field label="БИК"><Input value={form.bik} onChange={e => set('bik', e.target.value)} placeholder="044525225" /></Field>
          <Field label="Корр. счёт"><Input value={form.corr_account} onChange={e => set('corr_account', e.target.value)} placeholder="30101810400000000225" /></Field>
        </div>
        <Field label="Расчётный счёт"><Input value={form.account} onChange={e => set('account', e.target.value)} placeholder="40702810000000000001" /></Field>
      </>}

      {tab === 'extra' && <>
        <Field label="Статус">
          <Select value={form.status} onChange={e => set('status', e.target.value)}>
            <option value="active">Активен</option>
            <option value="archive">Архив</option>
          </Select>
        </Field>
        <Field label="Заметки"><Textarea style={{ minHeight: 120 }} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Дополнительная информация…" /></Field>
      </>}

      {err && <Notice tone="red">{err}</Notice>}
    </Modal>
  )
}

// ─── Пункт списка категорий ───────────────────────────────────────────────────

function CatItem({ label, count, active, onClick, onDelete }: { label: string; count: number; active: boolean; onClick: () => void; onDelete?: () => void }) {
  return (
    <div onClick={onClick}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = C.hover }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 10px', borderRadius: C.radiusSm, cursor: 'pointer', background: active ? C.accentBg : 'transparent', marginBottom: 2 }}>
      <span style={{ flex: 1, minWidth: 0, fontSize: 14, color: active ? C.accent : C.text, fontWeight: active ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      <Badge tone={active ? 'blue' : 'neutral'}>{count}</Badge>
      {onDelete && (
        <button type="button" title="Удалить категорию" aria-label="Удалить категорию"
          onClick={e => { e.stopPropagation(); onDelete() }}
          style={{ border: 0, background: 'none', color: C.faint, fontSize: 16, cursor: 'pointer', lineHeight: 1, padding: '0 2px' }}>×</button>
      )}
    </div>
  )
}

// ─── Страница ─────────────────────────────────────────────────────────────────

export default function CounterpartiesPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [counterparties, setCounterparties] = useState<Counterparty[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedCat, setSelectedCat] = useState<string | null>(null) // null = все
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [selected, setSelected] = useState<Counterparty | null>(null)
  const [newCatName, setNewCatName] = useState('')
  const [addingCat, setAddingCat] = useState(false)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    setError('')
    const [{ data: cats, error: e1 }, { data: cps, error: e2 }] = await Promise.all([
      supabase.from('counterparty_categories').select('*').order('name'),
      supabase.from('counterparties').select('*').order('name'),
    ])
    if (e1 || e2) setError((e1 || e2)!.message)
    setCategories(cats || [])
    setCounterparties(cps || [])
    setLoading(false)
  }

  async function addCategory() {
    if (!newCatName.trim()) return
    const { error } = await supabase.from('counterparty_categories').insert({ name: newCatName.trim() })
    if (error) { setError('Ошибка: ' + error.message); return }
    setNewCatName('')
    setAddingCat(false)
    fetchAll()
  }

  async function deleteCategory(cat: Category) {
    const count = counterparties.filter(c => c.category_id === cat.id).length
    const msg = count > 0
      ? `Удалить категорию «${cat.name}»? ${count} контрагент(ов) перейдут в «Без категории».`
      : `Удалить категорию «${cat.name}»?`
    if (!(await ask(msg, { ok: 'Удалить', danger: true }))) return
    const { error } = await supabase.from('counterparty_categories').delete().eq('id', cat.id)
    if (error) { setError('Ошибка: ' + error.message); return }
    if (selectedCat === cat.id) setSelectedCat(null)
    fetchAll()
  }

  const catCount = (id: string | null) =>
    id === null
      ? counterparties.length
      : counterparties.filter(c => c.category_id === id).length

  const filtered = counterparties.filter(c => {
    const matchCat = selectedCat === null || c.category_id === selectedCat
    const q = search.toLowerCase()
    const matchSearch = !q || c.name.toLowerCase().includes(q) || c.inn?.toLowerCase().includes(q) || c.contact_person?.toLowerCase().includes(q) || c.short_name?.toLowerCase().includes(q)
    return matchCat && matchSearch
  })

  const open = (cp: Counterparty | null) => { setSelected(cp); setShowModal(true) }
  const ellipsis: React.CSSProperties = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }

  return (
    <Page>
      {error && <ErrorBox error={error} onRetry={fetchAll} />}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' }}>
        {/* Категории */}
        <div style={{ flex: '1 1 220px', maxWidth: 260, minWidth: 0 }}>
        <Card pad={false}>
          <div style={{ padding: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.5px', margin: '2px 4px 8px' }}>Категории</div>
            <CatItem label="Все" count={catCount(null)} active={selectedCat === null} onClick={() => setSelectedCat(null)} />
            {categories.map(cat => (
              <CatItem key={cat.id} label={cat.name} count={catCount(cat.id)} active={selectedCat === cat.id}
                onClick={() => setSelectedCat(cat.id)} onDelete={() => deleteCategory(cat)} />
            ))}
            {addingCat ? (
              <div style={{ display: 'grid', gap: 6, padding: '6px 2px 2px' }}>
                <Input autoFocus placeholder="Название категории" value={newCatName}
                  onChange={e => setNewCatName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addCategory(); if (e.key === 'Escape') { setAddingCat(false); setNewCatName('') } }} />
                <div style={{ display: 'flex', gap: 6 }}>
                  <Button small kind="primary" onClick={addCategory} style={{ flex: 1 }}>Добавить</Button>
                  <Button small onClick={() => { setAddingCat(false); setNewCatName('') }}>Отмена</Button>
                </div>
              </div>
            ) : (
              <Button small kind="ghost" onClick={() => setAddingCat(true)} style={{ marginTop: 4 }}>Добавить категорию</Button>
            )}
          </div>
        </Card>
        </div>

        {/* Список */}
        <div style={{ flex: '999 1 480px', display: 'grid', gap: 12, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <Input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск по названию, ИНН, контактному лицу" style={{ flex: 1, minWidth: 200, width: 'auto' }} />
            <Button kind="primary" onClick={() => open(null)}>Добавить контрагента</Button>
          </div>

          <Card pad={false} title={selectedCat !== null ? <>{categories.find(c => c.id === selectedCat)?.name} <Muted small>{filtered.length} контрагент(ов)</Muted></> : undefined}>
            {loading ? <Loading /> : (
              <Table rows={filtered} rowKey={cp => cp.id} onRow={open}
                empty={search ? 'Ничего не найдено' : 'Нет контрагентов в этой категории'}
                cols={[
                  { key: 'n', title: 'Название / ФИО', sort: cp => cp.name, render: cp => (
                    <div style={{ maxWidth: 240 }}>
                      <div style={{ fontWeight: 500, ...ellipsis }}>{cp.name}</div>
                      {cp.short_name && <Sub><span style={{ display: 'block', ...ellipsis }}>{cp.short_name}</span></Sub>}
                    </div>
                  ) },
                  { key: 't', title: 'Тип', sort: cp => TYPE_LABELS[cp.type] || cp.type, render: cp => <Muted>{TYPE_LABELS[cp.type] || cp.type}</Muted> },
                  { key: 'i', title: 'ИНН', sort: cp => cp.inn || '', render: cp => <span style={{ fontFamily: 'monospace', color: C.muted }}>{cp.inn || '—'}</span> },
                  { key: 'p', title: 'Телефон', render: cp => <span style={{ whiteSpace: 'nowrap', color: C.muted }}>{cp.phone || '—'}</span> },
                  { key: 'e', title: 'Email', render: cp => cp.email
                    ? <a href={`mailto:${cp.email}`} onClick={e => e.stopPropagation()} style={{ color: C.accent, textDecoration: 'none', display: 'block', maxWidth: 180, ...ellipsis }}>{cp.email}</a>
                    : <Muted>—</Muted> },
                  { key: 'c', title: 'Контакт', sort: cp => cp.contact_person || '', render: cp => <span style={{ display: 'block', maxWidth: 160, color: C.muted, ...ellipsis }}>{cp.contact_person || '—'}</span> },
                  { key: 's', title: 'Статус', sort: cp => cp.status, render: cp => { const st = STATUS_LABELS[cp.status] || STATUS_LABELS.active; return <Badge tone={st.tone}>{st.label}</Badge> } },
                  { key: 'a', title: '', align: 'right', render: cp => <Button small onClick={e => { e.stopPropagation(); open(cp) }}>Изменить</Button> },
                ]} />
            )}
          </Card>
        </div>
      </div>

      {showModal && (
        <CounterpartyModal
          cp={selected}
          categories={categories}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); fetchAll() }}
        />
      )}
    </Page>
  )
}
