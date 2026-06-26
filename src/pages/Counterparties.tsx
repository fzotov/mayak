import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

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
const STATUS_LABELS: Record<string, { label: string; bg: string; color: string }> = {
  active: { label: 'Активен', bg: '#dcfce7', color: '#16a34a' },
  archive: { label: 'Архив', bg: '#f3f4f6', color: '#9ca3af' },
}

const inp: React.CSSProperties = { width: '100%', border: '1px solid #e8ebf3', borderRadius: 7, padding: '8px 10px', fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }
const lbl: React.CSSProperties = { fontSize: 12, color: '#8596b4', marginBottom: 4, display: 'block', fontWeight: 500 }
const section: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: '#8596b4', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10, marginTop: 4 }

// ─── Modal ───────────────────────────────────────────────────────────────────

function CounterpartyModal({ cp, categories, onClose, onSaved }: {
  cp: Counterparty | null
  categories: Category[]
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState<Omit<Counterparty, 'id'>>(cp ? { ...cp } : { ...empty })
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState<'main' | 'contacts' | 'bank' | 'extra'>('main')
  const set = (k: string, v: string | null) => setForm(f => ({ ...f, [k]: v }))

  async function save() {
    if (!form.name.trim()) return alert('Введите название')
    setSaving(true)
    const { error } = cp?.id
      ? await supabase.from('counterparties').update(form).eq('id', cp.id)
      : await supabase.from('counterparties').insert(form)
    setSaving(false)
    if (error) { alert('Ошибка: ' + error.message); return }
    onSaved()
  }

  async function remove() {
    if (!cp?.id || !confirm('Удалить контрагента?')) return
    const { error } = await supabase.from('counterparties').delete().eq('id', cp.id)
    if (error) { alert('Ошибка: ' + error.message); return }
    onSaved()
  }

  const TABS = [
    { key: 'main', label: 'Основное' },
    { key: 'contacts', label: 'Контакты' },
    { key: 'bank', label: 'Банк' },
    { key: 'extra', label: 'Доп.' },
  ] as const

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#00000066', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 600, maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 20px 60px #0002' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #e8ebf3' }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#1a2240' }}>{cp ? cp.name : 'Новый контрагент'}</div>
          <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: 20, color: '#8596b4', cursor: 'pointer' }}>✕</button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #e8ebf3' }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{ flex: 1, padding: '10px 6px', border: 'none', background: 'none', fontSize: 13, fontWeight: tab === t.key ? 600 : 400, color: tab === t.key ? '#4f6ef7' : '#8596b4', borderBottom: `2px solid ${tab === t.key ? '#4f6ef7' : 'transparent'}`, cursor: 'pointer', fontFamily: 'inherit' }}>
              {t.label}
            </button>
          ))}
        </div>

        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Основное */}
          {tab === 'main' && <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={lbl}>Категория</label>
                <select style={inp} value={form.category_id || ''} onChange={e => set('category_id', e.target.value || null)}>
                  <option value="">— Без категории</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Тип</label>
                <select style={inp} value={form.type} onChange={e => set('type', e.target.value)}>
                  <option value="company">Юрлицо</option>
                  <option value="ip">ИП</option>
                  <option value="person">Физлицо</option>
                </select>
              </div>
            </div>
            <div><label style={lbl}>Название / ФИО *</label><input style={inp} value={form.name} onChange={e => set('name', e.target.value)} placeholder="ООО Пример или Иванов Иван Иванович" /></div>
            <div><label style={lbl}>Краткое название</label><input style={inp} value={form.short_name} onChange={e => set('short_name', e.target.value)} placeholder="Пример" /></div>
            <div style={{ ...section as React.CSSProperties }}>Реквизиты</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <div><label style={lbl}>ИНН</label><input style={inp} value={form.inn} onChange={e => set('inn', e.target.value)} placeholder="7700000000" /></div>
              <div><label style={lbl}>КПП</label><input style={inp} value={form.kpp} onChange={e => set('kpp', e.target.value)} placeholder="770001001" /></div>
              <div><label style={lbl}>ОГРН / ОГРНИП</label><input style={inp} value={form.ogrn} onChange={e => set('ogrn', e.target.value)} placeholder="1027700000000" /></div>
            </div>
            <div><label style={lbl}>Юридический адрес</label><input style={inp} value={form.legal_address} onChange={e => set('legal_address', e.target.value)} placeholder="123456, Москва, ул. Примерная, д. 1" /></div>
            <div><label style={lbl}>Фактический адрес</label><input style={inp} value={form.actual_address} onChange={e => set('actual_address', e.target.value)} placeholder="Тот же или другой" /></div>
          </>}

          {/* Контакты */}
          {tab === 'contacts' && <>
            <div style={section}>Организация</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div><label style={lbl}>Телефон</label><input style={inp} value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+7 900 000-00-00" /></div>
              <div><label style={lbl}>Email</label><input style={inp} value={form.email} onChange={e => set('email', e.target.value)} placeholder="info@example.ru" /></div>
            </div>
            <div><label style={lbl}>Сайт</label><input style={inp} value={form.website} onChange={e => set('website', e.target.value)} placeholder="https://example.ru" /></div>
            <div style={section}>Контактное лицо</div>
            <div><label style={lbl}>ФИО</label><input style={inp} value={form.contact_person} onChange={e => set('contact_person', e.target.value)} placeholder="Иванов Иван Иванович" /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div><label style={lbl}>Должность</label><input style={inp} value={form.contact_position} onChange={e => set('contact_position', e.target.value)} placeholder="Менеджер" /></div>
              <div><label style={lbl}>Телефон</label><input style={inp} value={form.contact_phone} onChange={e => set('contact_phone', e.target.value)} placeholder="+7 900 000-00-00" /></div>
            </div>
          </>}

          {/* Банк */}
          {tab === 'bank' && <>
            <div style={section}>Банковские реквизиты</div>
            <div><label style={lbl}>Банк</label><input style={inp} value={form.bank} onChange={e => set('bank', e.target.value)} placeholder="ПАО Сбербанк" /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div><label style={lbl}>БИК</label><input style={inp} value={form.bik} onChange={e => set('bik', e.target.value)} placeholder="044525225" /></div>
              <div><label style={lbl}>Корр. счёт</label><input style={inp} value={form.corr_account} onChange={e => set('corr_account', e.target.value)} placeholder="30101810400000000225" /></div>
            </div>
            <div><label style={lbl}>Расчётный счёт</label><input style={inp} value={form.account} onChange={e => set('account', e.target.value)} placeholder="40702810000000000001" /></div>
          </>}

          {/* Доп. */}
          {tab === 'extra' && <>
            <div>
              <label style={lbl}>Статус</label>
              <select style={inp} value={form.status} onChange={e => set('status', e.target.value)}>
                <option value="active">Активен</option>
                <option value="archive">Архив</option>
              </select>
            </div>
            <div><label style={lbl}>Заметки</label><textarea style={{ ...inp, height: 120, resize: 'none' }} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Дополнительная информация..." /></div>
          </>}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', gap: 8, padding: '14px 20px', borderTop: '1px solid #e8ebf3' }}>
          <button onClick={save} disabled={saving} style={{ flex: 1, padding: '9px', borderRadius: 8, border: 'none', background: '#4f6ef7', color: '#fff', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
          {cp && <button onClick={remove} style={{ padding: '9px 16px', borderRadius: 8, border: 'none', background: '#fee2e2', color: '#ef4444', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>Удалить</button>}
          <button onClick={onClose} style={{ padding: '9px 16px', borderRadius: 8, border: '1px solid #e8ebf3', background: '#fff', color: '#6b7280', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>Отмена</button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CounterpartiesPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [counterparties, setCounterparties] = useState<Counterparty[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCat, setSelectedCat] = useState<string | null>(null) // null = все
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [selected, setSelected] = useState<Counterparty | null>(null)
  const [newCatName, setNewCatName] = useState('')
  const [addingCat, setAddingCat] = useState(false)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [{ data: cats }, { data: cps }] = await Promise.all([
      supabase.from('counterparty_categories').select('*').order('name'),
      supabase.from('counterparties').select('*').order('name'),
    ])
    setCategories(cats || [])
    setCounterparties(cps || [])
    setLoading(false)
  }

  async function addCategory() {
    if (!newCatName.trim()) return
    const { error } = await supabase.from('counterparty_categories').insert({ name: newCatName.trim() })
    if (error) { alert('Ошибка: ' + error.message); return }
    setNewCatName('')
    setAddingCat(false)
    fetchAll()
  }

  async function deleteCategory(cat: Category) {
    const count = counterparties.filter(c => c.category_id === cat.id).length
    const msg = count > 0
      ? `Удалить категорию "${cat.name}"? ${count} контрагент(ов) перейдут в "Без категории".`
      : `Удалить категорию "${cat.name}"?`
    if (!confirm(msg)) return
    const { error } = await supabase.from('counterparty_categories').delete().eq('id', cat.id)
    if (error) { alert('Ошибка: ' + error.message); return }
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

  return (
    <div style={{ display: 'flex', gap: 0, minHeight: 0 }}>
      {/* Левая панель — категории */}
      <div style={{ width: 220, flexShrink: 0, borderRight: '1px solid #e8ebf3', paddingRight: 0, marginRight: 0 }}>
        <div style={{ padding: '0 0 12px 0' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#8596b4', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8, padding: '0 4px' }}>Категории</div>

          {/* Все */}
          <div
            onClick={() => setSelectedCat(null)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px', borderRadius: 8, cursor: 'pointer', background: selectedCat === null ? '#eff3ff' : 'transparent', color: selectedCat === null ? '#4f6ef7' : '#374151', fontWeight: selectedCat === null ? 600 : 400, fontSize: 14, marginBottom: 2 }}
          >
            <span>Все</span>
            <span style={{ fontSize: 12, fontWeight: 500, color: selectedCat === null ? '#4f6ef7' : '#8596b4', background: selectedCat === null ? '#dbe4ff' : '#f0f2f8', borderRadius: 10, padding: '1px 7px' }}>{catCount(null)}</span>
          </div>

          {/* Категории */}
          {categories.map(cat => (
            <div
              key={cat.id}
              onClick={() => setSelectedCat(cat.id)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px', borderRadius: 8, cursor: 'pointer', background: selectedCat === cat.id ? '#eff3ff' : 'transparent', marginBottom: 2 }}
              onMouseEnter={e => { if (selectedCat !== cat.id) e.currentTarget.style.background = '#f8f9fc' }}
              onMouseLeave={e => { if (selectedCat !== cat.id) e.currentTarget.style.background = 'transparent' }}
            >
              <span style={{ fontSize: 14, color: selectedCat === cat.id ? '#4f6ef7' : '#374151', fontWeight: selectedCat === cat.id ? 600 : 400, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cat.name}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                <span style={{ fontSize: 12, fontWeight: 500, color: selectedCat === cat.id ? '#4f6ef7' : '#8596b4', background: selectedCat === cat.id ? '#dbe4ff' : '#f0f2f8', borderRadius: 10, padding: '1px 7px' }}>{catCount(cat.id)}</span>
                <button
                  onClick={e => { e.stopPropagation(); deleteCategory(cat) }}
                  style={{ border: 'none', background: 'none', color: '#d1d5db', fontSize: 14, cursor: 'pointer', lineHeight: 1, padding: '0 2px', display: 'flex', alignItems: 'center' }}
                  title="Удалить категорию"
                >×</button>
              </div>
            </div>
          ))}

          {/* Добавить категорию */}
          {addingCat ? (
            <div style={{ padding: '6px 4px' }}>
              <input
                autoFocus
                style={{ width: '100%', border: '1px solid #4f6ef7', borderRadius: 6, padding: '6px 8px', fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
                placeholder="Название..."
                value={newCatName}
                onChange={e => setNewCatName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addCategory(); if (e.key === 'Escape') { setAddingCat(false); setNewCatName('') } }}
              />
              <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                <button onClick={addCategory} style={{ flex: 1, padding: '4px', borderRadius: 6, border: 'none', background: '#4f6ef7', color: '#fff', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Добавить</button>
                <button onClick={() => { setAddingCat(false); setNewCatName('') }} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #e8ebf3', background: '#fff', color: '#6b7280', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>✕</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setAddingCat(true)} style={{ width: '100%', marginTop: 4, padding: '6px 10px', border: '1px dashed #d1d5db', borderRadius: 8, background: 'none', color: '#8596b4', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
              + Категория
            </button>
          )}
        </div>
      </div>

      {/* Правая часть */}
      <div style={{ flex: 1, minWidth: 0, paddingLeft: 20 }}>
        {/* Поиск + кнопка */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center' }}>
          <input
            style={{ flex: 1, border: '1px solid #e8ebf3', borderRadius: 8, padding: '8px 12px', fontSize: 14, fontFamily: 'inherit', outline: 'none' }}
            placeholder="🔍 Поиск по названию, ИНН, контактному лицу..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <button onClick={() => { setSelected(null); setShowModal(true) }} style={{ padding: '8px 16px', border: 'none', borderRadius: 8, background: '#4f6ef7', color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
            + Добавить
          </button>
        </div>

        {/* Категория заголовок */}
        {selectedCat !== null && (
          <div style={{ fontSize: 15, fontWeight: 600, color: '#1a2240', marginBottom: 12 }}>
            {categories.find(c => c.id === selectedCat)?.name}
            <span style={{ fontSize: 13, fontWeight: 400, color: '#8596b4', marginLeft: 8 }}>{filtered.length} контрагент(ов)</span>
          </div>
        )}

        {/* Таблица */}
        {loading ? <div style={{ color: '#8596b4', fontSize: 14 }}>Загрузка...</div> : (
          <div style={{ background: '#fff', border: '1px solid #e8ebf3', borderRadius: 9, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ background: '#f8f9fc', borderBottom: '1px solid #e8ebf3' }}>
                  {['Название / ФИО', 'Тип', 'ИНН', 'Телефон', 'Email', 'Контакт', 'Статус', ''].map(h => (
                    <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 500, color: '#8596b4', fontSize: 12, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(cp => {
                  const st = STATUS_LABELS[cp.status] || STATUS_LABELS.active
                  return (
                    <tr key={cp.id} style={{ borderBottom: '1px solid #f0f2f8', cursor: 'pointer' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#f8f9fc')}
                      onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
                      onClick={() => { setSelected(cp); setShowModal(true) }}>
                      <td style={{ padding: '9px 12px', maxWidth: 200 }}>
                        <div style={{ fontWeight: 500, color: '#1a2240', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cp.name}</div>
                        {cp.short_name && <div style={{ fontSize: 12, color: '#8596b4', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cp.short_name}</div>}
                      </td>
                      <td style={{ padding: '9px 12px', color: '#6b7280', whiteSpace: 'nowrap' }}>{TYPE_LABELS[cp.type] || cp.type}</td>
                      <td style={{ padding: '9px 12px', color: '#6b7280', fontFamily: 'monospace', fontSize: 13 }}>{cp.inn || '—'}</td>
                      <td style={{ padding: '9px 12px', color: '#6b7280', whiteSpace: 'nowrap' }}>{cp.phone || '—'}</td>
                      <td style={{ padding: '9px 12px', color: '#4f6ef7', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {cp.email ? <a href={`mailto:${cp.email}`} onClick={e => e.stopPropagation()} style={{ color: '#4f6ef7', textDecoration: 'none' }}>{cp.email}</a> : '—'}
                      </td>
                      <td style={{ padding: '9px 12px', color: '#6b7280', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cp.contact_person || '—'}</td>
                      <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>
                        <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 10, background: st.bg, color: st.color }}>{st.label}</span>
                      </td>
                      <td style={{ padding: '9px 12px' }}>
                        <button
                          onClick={e => { e.stopPropagation(); setSelected(cp); setShowModal(true) }}
                          style={{ border: '1px solid #e8ebf3', background: '#fff', borderRadius: 6, padding: '3px 10px', fontSize: 12, color: '#374151', cursor: 'pointer' }}>
                          ✎
                        </button>
                      </td>
                    </tr>
                  )
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={8} style={{ padding: 30, textAlign: 'center', color: '#8596b4', fontSize: 14 }}>
                    {search ? 'Ничего не найдено' : 'Нет контрагентов в этой категории'}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <CounterpartyModal
          cp={selected}
          categories={categories}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); fetchAll() }}
        />
      )}
    </div>
  )
}
