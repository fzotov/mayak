import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

interface Slot {
  id: string
  slot_number: number
  side: 'parking' | 'roundabout'
  code_1c: string | null
  tenant_name: string | null
  is_our_ad: boolean
  is_free: boolean
  contract_end_date: string | null
}

const SIDE_LABEL: Record<string, string> = { parking: 'Со стороны парковки', roundabout: 'Со стороны кругового' }

export default function AdvertisingStele() {
  const [slots, setSlots] = useState<Slot[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Slot | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.from('advertising_slots').select('*').order('slot_number', { ascending: false })
      .then(({ data }) => { setSlots(data || []); setLoading(false) })
  }, [])

  const parking = slots.filter(s => s.side === 'parking').sort((a, b) => b.slot_number - a.slot_number)
  const roundabout = slots.filter(s => s.side === 'roundabout').sort((a, b) => b.slot_number - a.slot_number)

  const occupied = slots.filter(s => !s.is_free && !s.is_our_ad).length
  const free = slots.filter(s => s.is_free).length
  const our = slots.filter(s => s.is_our_ad).length

  async function save() {
    if (!editing) return
    setSaving(true)
    await supabase.from('advertising_slots').update({
      tenant_name: editing.tenant_name,
      is_free: editing.is_free,
      is_our_ad: editing.is_our_ad,
      contract_end_date: editing.contract_end_date || null,
    }).eq('id', editing.id)
    setSlots(s => s.map(x => x.id === editing.id ? editing : x))
    setEditing(null)
    setSaving(false)
  }

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
    return { text: s.tenant_name || '—', color: '#1a2240' }
  }

  function SlotCard({ s }: { s: Slot }) {
    const lbl = slotLabel(s)
    return (
      <div onClick={() => setEditing({ ...s })} style={{
        background: slotBg(s), border: `1px solid ${slotBorder(s)}`, borderRadius: 8,
        padding: '10px 14px', cursor: 'pointer', transition: 'box-shadow .15s',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div style={{ width: 28, height: 28, borderRadius: 6, background: '#f0f2f8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#8596b4', flexShrink: 0 }}>
          {s.slot_number}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: lbl.color, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lbl.text}</div>
          {s.code_1c && <div style={{ fontSize: 11, color: '#8596b4', marginTop: 2 }}>{s.code_1c}</div>}
          {s.contract_end_date && !s.is_our_ad && !s.is_free && (
            <div style={{ fontSize: 11, color: '#d97706', marginTop: 1 }}>до {new Date(s.contract_end_date).toLocaleDateString('ru-RU')}</div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: 18, fontWeight: 600, color: '#1a2240' }}>Рекламная стела</div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {[
          { label: 'Занято арендаторами', value: occupied, color: '#4f6ef7' },
          { label: 'Свободно', value: free, color: '#16a34a' },
          { label: 'Наша реклама', value: our, color: '#8596b4' },
        ].map(k => (
          <div key={k.label} style={{ background: '#fff', border: '1px solid #e8ebf3', borderRadius: 9, padding: '14px 18px' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 13, color: '#8596b4', marginTop: 2 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div style={{ color: '#8596b4', fontSize: 14, padding: 24 }}>Загрузка...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {(['parking', 'roundabout'] as const).map(side => {
            const list = side === 'parking' ? parking : roundabout
            return (
              <div key={side}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 10 }}>
                  {SIDE_LABEL[side]}
                  <span style={{ fontSize: 12, color: '#8596b4', marginLeft: 8 }}>(коробы сверху вниз)</span>
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
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 28, width: 420, boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#1a2240', marginBottom: 4 }}>
              Короб #{editing.slot_number} · {SIDE_LABEL[editing.side]}
            </div>
            <div style={{ fontSize: 13, color: '#8596b4', marginBottom: 20 }}>{editing.code_1c}</div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {[
                { label: 'Арендатор', free: false, our: false },
                { label: 'Свободно', free: true, our: false },
                { label: 'Наша реклама', free: false, our: true },
              ].map(opt => (
                <button key={opt.label} onClick={() => setEditing({ ...editing, is_free: opt.free, is_our_ad: opt.our })}
                  style={{
                    flex: 1, padding: '8px 4px', border: '1px solid',
                    borderColor: editing.is_free === opt.free && editing.is_our_ad === opt.our ? '#4f6ef7' : '#e8ebf3',
                    borderRadius: 7, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
                    background: editing.is_free === opt.free && editing.is_our_ad === opt.our ? '#eff3ff' : '#fff',
                    color: editing.is_free === opt.free && editing.is_our_ad === opt.our ? '#4f6ef7' : '#374151',
                  }}>
                  {opt.label}
                </button>
              ))}
            </div>

            {!editing.is_free && !editing.is_our_ad && (
              <>
                <div style={{ fontSize: 12, color: '#8596b4', marginBottom: 4 }}>Наименование арендатора</div>
                <input style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1px solid #e8ebf3', borderRadius: 7, fontSize: 13, fontFamily: 'inherit', outline: 'none', color: '#1a2240', marginBottom: 12 }}
                  value={editing.tenant_name || ''} onChange={e => setEditing({ ...editing, tenant_name: e.target.value })} />
                <div style={{ fontSize: 12, color: '#8596b4', marginBottom: 4 }}>Договор действует до</div>
                <input type="date" style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1px solid #e8ebf3', borderRadius: 7, fontSize: 13, fontFamily: 'inherit', outline: 'none', color: '#1a2240', marginBottom: 16 }}
                  value={editing.contract_end_date || ''} onChange={e => setEditing({ ...editing, contract_end_date: e.target.value })} />
              </>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button onClick={() => setEditing(null)} style={{ flex: 1, padding: '9px', border: '1px solid #e8ebf3', borderRadius: 7, background: '#fff', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', color: '#6b7280' }}>Отмена</button>
              <button onClick={save} disabled={saving} style={{ flex: 1, padding: '9px', border: 'none', borderRadius: 7, background: '#4f6ef7', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', color: '#fff', opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
