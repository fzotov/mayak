import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

interface Slot {
  id: string
  slot_number: number
  side: 'parking' | 'roundabout'
  code_1c: string | null
  tenant_name: string | null
  tenant_id: string | null
  monthly_fee: number | null
  is_our_ad: boolean
  is_free: boolean
  contract_end_date: string | null
}

interface Tenant {
  id: string
  full_name: string
  type: string
}

const SIDE_LABEL: Record<string, string> = { parking: 'Со стороны парковки', roundabout: 'Со стороны кругового' }
const FMT = (n: number) => n.toLocaleString('ru-RU')

export default function AdvertisingStele() {
  const [slots, setSlots] = useState<Slot[]>([])
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Slot | null>(null)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)

  useEffect(() => {
    Promise.all([
      supabase.from('advertising_slots').select('*').order('slot_number', { ascending: false }),
      supabase.from('tenants').select('id, full_name, type').order('full_name'),
    ]).then(([{ data: s }, { data: t }]) => {
      setSlots(s || [])
      setTenants(t || [])
      setLoading(false)
    })
  }, [])

  const parking = slots.filter(s => s.side === 'parking').sort((a, b) => b.slot_number - a.slot_number)
  const roundabout = slots.filter(s => s.side === 'roundabout').sort((a, b) => b.slot_number - a.slot_number)

  const occupied = slots.filter(s => !s.is_free && !s.is_our_ad).length
  const free = slots.filter(s => s.is_free).length
  const our = slots.filter(s => s.is_our_ad).length
  const totalRevenue = slots.filter(s => !s.is_free && !s.is_our_ad && s.monthly_fee)
    .reduce((sum, s) => sum + (s.monthly_fee || 0), 0)

  async function save() {
    if (!editing) return
    setSaving(true)
    await supabase.from('advertising_slots').update({
      tenant_name: editing.tenant_name,
      tenant_id: editing.tenant_id || null,
      monthly_fee: editing.monthly_fee || null,
      is_free: editing.is_free,
      is_our_ad: editing.is_our_ad,
      contract_end_date: editing.contract_end_date || null,
    }).eq('id', editing.id)
    setSlots(s => s.map(x => x.id === editing.id ? editing : x))
    setEditing(null)
    setSaving(false)
  }

  function selectTenant(t: Tenant) {
    setEditing(e => e ? { ...e, tenant_id: t.id, tenant_name: t.full_name } : e)
    setSearch(t.full_name)
    setShowDropdown(false)
  }

  function openEdit(s: Slot) {
    const ten = tenants.find(t => t.id === s.tenant_id)
    setSearch(ten ? ten.full_name : s.tenant_name || '')
    setEditing({ ...s })
    setShowDropdown(false)
  }

  const filtered = tenants.filter(t =>
    !search || t.full_name.toLowerCase().includes(search.toLowerCase())
  )

  function slotBg(s: Slot) {
    if (s.is_our_ad) return '#eff3ff'
    if (s.is_free) return '#f0fdf4'
    return '#fff'
  }
  function slotBorder(s: Slot) {
    if (s.is_our_ad) return '#c7d2fe'
    if (s.is_free) return '#bbf7d0'
    return '#e8ebf3'
  }
  function slotLabel(s: Slot) {
    if (s.is_our_ad) return { text: 'НАША РЕКЛАМА', color: '#4f6ef7' }
    if (s.is_free) return { text: 'СВОБОДНО', color: '#16a34a' }
    const name = tenants.find(t => t.id === s.tenant_id)?.full_name || s.tenant_name || '—'
    return { text: name, color: '#1a2240' }
  }

  function SlotCard({ s }: { s: Slot }) {
    const lbl = slotLabel(s)
    return (
      <div onClick={() => openEdit(s)} style={{
        background: slotBg(s), border: `1px solid ${slotBorder(s)}`, borderRadius: 7,
        padding: '7px 10px', cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <div style={{ width: 24, height: 24, borderRadius: 5, background: '#f0f2f8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#8596b4', flexShrink: 0 }}>
          {s.slot_number}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: lbl.color, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lbl.text}</div>
          {(!s.is_our_ad && !s.is_free) && (
            <div style={{ display: 'flex', gap: 6, marginTop: 1, alignItems: 'center' }}>
              {s.monthly_fee && <span style={{ fontSize: 10, color: '#059669', fontWeight: 600 }}>{FMT(s.monthly_fee)} ₽/мес</span>}
              {s.contract_end_date && <span style={{ fontSize: 10, color: '#d97706' }}>до {new Date(s.contract_end_date).toLocaleDateString('ru-RU')}</span>}
            </div>
          )}
          {(s.is_our_ad || s.is_free) && s.code_1c && (
            <div style={{ fontSize: 10, color: '#8596b4', marginTop: 1 }}>{s.code_1c}</div>
          )}
        </div>
      </div>
    )
  }

  const inp: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', padding: '8px 10px',
    border: '1px solid #e8ebf3', borderRadius: 7, fontSize: 13,
    fontFamily: 'inherit', outline: 'none', color: '#1a2240',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: 18, fontWeight: 600, color: '#1a2240' }}>Рекламная стела</div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[
          { label: 'Занято арендаторами', value: occupied, color: '#4f6ef7', suffix: '' },
          { label: 'Свободно', value: free, color: '#16a34a', suffix: '' },
          { label: 'Наша реклама', value: our, color: '#8596b4', suffix: '' },
          { label: 'Выручка стелы/мес', value: totalRevenue, color: '#059669', suffix: ' ₽', fmt: true },
        ].map(k => (
          <div key={k.label} style={{ background: '#fff', border: '1px solid #e8ebf3', borderRadius: 9, padding: '14px 18px' }}>
            <div style={{ fontSize: k.fmt ? 20 : 28, fontWeight: 700, color: k.color }}>
              {k.fmt ? FMT(k.value) : k.value}{k.suffix}
            </div>
            <div style={{ fontSize: 13, color: '#8596b4', marginTop: 2 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div style={{ color: '#8596b4', fontSize: 14, padding: 24 }}>Загрузка...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {(['parking', 'roundabout'] as const).map(side => {
            const list = side === 'parking' ? parking : roundabout
            return (
              <div key={side}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
                  {SIDE_LABEL[side]}
                  <span style={{ fontSize: 11, color: '#8596b4', marginLeft: 6 }}>(сверху вниз)</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {list.map(s => <SlotCard key={s.id} s={s} />)}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Edit modal */}
      {editing && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
          onClick={e => { if (e.target === e.currentTarget) { setEditing(null); setShowDropdown(false) } }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 28, width: 460, boxShadow: '0 8px 32px rgba(0,0,0,0.15)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#1a2240', marginBottom: 4 }}>
              Короб #{editing.slot_number} · {SIDE_LABEL[editing.side]}
            </div>
            <div style={{ fontSize: 13, color: '#8596b4', marginBottom: 20 }}>{editing.code_1c}</div>

            {/* Status toggle */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              {[
                { label: 'Арендатор', free: false, our: false },
                { label: 'Свободно', free: true, our: false },
                { label: 'Наша реклама', free: false, our: true },
              ].map(opt => {
                const active = editing.is_free === opt.free && editing.is_our_ad === opt.our
                return (
                  <button key={opt.label} onClick={() => setEditing({ ...editing, is_free: opt.free, is_our_ad: opt.our })}
                    style={{
                      flex: 1, padding: '8px 4px', border: `1px solid ${active ? '#4f6ef7' : '#e8ebf3'}`,
                      borderRadius: 7, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
                      background: active ? '#eff3ff' : '#fff', color: active ? '#4f6ef7' : '#374151',
                    }}>
                    {opt.label}
                  </button>
                )
              })}
            </div>

            {!editing.is_free && !editing.is_our_ad && (
              <>
                {/* Tenant picker */}
                <div style={{ fontSize: 12, color: '#8596b4', marginBottom: 4 }}>Арендатор</div>
                <div style={{ position: 'relative', marginBottom: 12 }}>
                  <input
                    style={{ ...inp }}
                    placeholder="Начните вводить имя..."
                    value={search}
                    onChange={e => { setSearch(e.target.value); setShowDropdown(true); setEditing({ ...editing, tenant_id: null, tenant_name: e.target.value }) }}
                    onFocus={() => setShowDropdown(true)}
                    autoComplete="off"
                  />
                  {showDropdown && filtered.length > 0 && (
                    <div style={{
                      position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200,
                      background: '#fff', border: '1px solid #e8ebf3', borderRadius: 8,
                      boxShadow: '0 4px 16px rgba(0,0,0,0.1)', maxHeight: 220, overflowY: 'auto',
                    }}>
                      {filtered.slice(0, 30).map(t => (
                        <div key={t.id} onMouseDown={() => selectTenant(t)} style={{
                          padding: '9px 12px', cursor: 'pointer', fontSize: 13, color: '#1a2240',
                          borderBottom: '1px solid #f3f4f6',
                        }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#f8f9fc')}
                          onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>
                          {t.full_name}
                          <span style={{ fontSize: 11, color: '#8596b4', marginLeft: 6 }}>
                            {t.type === 'COMPANY' ? 'Юрлицо' : t.type === 'IP' ? 'ИП' : 'Физлицо'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Fee */}
                <div style={{ fontSize: 12, color: '#8596b4', marginBottom: 4 }}>Стоимость рекламы ₽/мес</div>
                <input
                  type="number"
                  style={{ ...inp, marginBottom: 12 }}
                  placeholder="0"
                  value={editing.monthly_fee ?? ''}
                  onChange={e => setEditing({ ...editing, monthly_fee: e.target.value ? parseFloat(e.target.value) : null })}
                />

                {/* Contract end */}
                <div style={{ fontSize: 12, color: '#8596b4', marginBottom: 4 }}>Договор действует до</div>
                <input type="date" style={{ ...inp, marginBottom: 4 }}
                  value={editing.contract_end_date || ''}
                  onChange={e => setEditing({ ...editing, contract_end_date: e.target.value })} />
              </>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
              <button onClick={() => { setEditing(null); setShowDropdown(false) }}
                style={{ flex: 1, padding: '9px', border: '1px solid #e8ebf3', borderRadius: 7, background: '#fff', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', color: '#6b7280' }}>
                Отмена
              </button>
              <button onClick={save} disabled={saving}
                style={{ flex: 1, padding: '9px', border: 'none', borderRadius: 7, background: '#4f6ef7', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', color: '#fff', opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
