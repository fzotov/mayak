// Рекламная стела: короба с двух сторон (сверху вниз), кто занимает, сколько платит, до какого числа договор.
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Page, Card, Grid, Button, Stat, Stats, Field, Input, Segmented, Modal, Notice, Loading, ErrorBox, Empty, Muted, num, dateRu, C } from '../components/ui'

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

type Kind = 'tenant' | 'free' | 'our'

const SIDE_LABEL: Record<string, string> = { parking: 'Со стороны парковки', roundabout: 'Со стороны кругового' }
const kindOf = (s: Slot): Kind => s.is_our_ad ? 'our' : s.is_free ? 'free' : 'tenant'

export default function AdvertisingStele() {
  const [slots, setSlots] = useState<Slot[]>([])
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<Slot | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [search, setSearch] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)

  function load() {
    setLoading(true)
    setError('')
    Promise.all([
      supabase.from('advertising_slots').select('*').order('slot_number', { ascending: false }),
      supabase.from('tenants').select('id, full_name, type').order('full_name'),
    ]).then(([{ data: s, error: e1 }, { data: t, error: e2 }]) => {
      if (e1 || e2) setError((e1 || e2)!.message)
      setSlots(s || [])
      setTenants(t || [])
      setLoading(false)
    })
  }
  useEffect(() => { load() }, [])

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
    setSaveError('')
    const { error } = await supabase.from('advertising_slots').update({
      tenant_name: editing.tenant_name,
      tenant_id: editing.tenant_id || null,
      monthly_fee: editing.monthly_fee || null,
      is_free: editing.is_free,
      is_our_ad: editing.is_our_ad,
      contract_end_date: editing.contract_end_date || null,
    }).eq('id', editing.id)
    setSaving(false)
    if (error) { setSaveError('Ошибка сохранения: ' + error.message); return }
    setSlots(s => s.map(x => x.id === editing.id ? editing : x))
    setEditing(null)
  }

  function close() { setEditing(null); setShowDropdown(false); setSaveError('') }

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
    setSaveError('')
  }

  const filtered = tenants.filter(t =>
    !search || t.full_name.toLowerCase().includes(search.toLowerCase())
  )

  const SLOT_STYLE: Record<Kind, { bg: string; border: string }> = {
    our: { bg: C.accentBg, border: C.accent },
    free: { bg: C.greenBg, border: C.green },
    tenant: { bg: C.card, border: C.line },
  }

  function slotLabel(s: Slot) {
    if (s.is_our_ad) return { text: 'Наша реклама', color: C.accent }
    if (s.is_free) return { text: 'Свободно', color: C.green }
    const name = tenants.find(t => t.id === s.tenant_id)?.full_name || s.tenant_name || '—'
    return { text: name, color: C.text }
  }

  function slotCard(s: Slot) {
    const lbl = slotLabel(s)
    const st = SLOT_STYLE[kindOf(s)]
    return (
      <div key={s.id} onClick={() => openEdit(s)} style={{
        background: st.bg, border: `1px solid ${st.border}`, borderRadius: C.radiusSm,
        padding: '7px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <div style={{ width: 24, height: 24, borderRadius: 5, background: C.hover, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: C.muted, flexShrink: 0 }}>
          {s.slot_number}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: lbl.color, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lbl.text}</div>
          {(!s.is_our_ad && !s.is_free) && (
            <div style={{ display: 'flex', gap: 8, marginTop: 1, alignItems: 'center', flexWrap: 'wrap' }}>
              {!!s.monthly_fee && <span style={{ fontSize: 11, color: C.green, fontWeight: 600 }}>{num(s.monthly_fee, 2)} ₽/мес</span>}
              {s.contract_end_date && <span style={{ fontSize: 11, color: C.amber }}>до {dateRu(s.contract_end_date)}</span>}
            </div>
          )}
          {(s.is_our_ad || s.is_free) && s.code_1c && (
            <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>{s.code_1c}</div>
          )}
        </div>
      </div>
    )
  }

  return (
    <Page>
      <Stats>
        <Stat label="Занято арендаторами" value={occupied} tone="blue" />
        <Stat label="Свободно" value={free} tone="green" />
        <Stat label="Наша реклама" value={our} />
        <Stat label="Выручка стелы/мес" value={`${num(totalRevenue, 2)} ₽`} tone="green" />
      </Stats>

      {error && <ErrorBox error={error} onRetry={load} />}

      {loading ? <Loading /> : (
        <Grid min={300} gap={16}>
          {(['parking', 'roundabout'] as const).map(side => {
            const list = side === 'parking' ? parking : roundabout
            return (
              <Card key={side} title={<>{SIDE_LABEL[side]} <Muted small>(сверху вниз)</Muted></>}>
                {list.length === 0 ? <Empty>Коробов нет</Empty> : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {list.map(slotCard)}
                  </div>
                )}
              </Card>
            )
          })}
        </Grid>
      )}

      {editing && (
        <Modal title={`Короб № ${editing.slot_number} · ${SIDE_LABEL[editing.side]}`} onClose={close} width={460} footer={<>
          <Button onClick={close}>Отмена</Button>
          <Button kind="primary" onClick={save} disabled={saving}>{saving ? 'Сохранение…' : 'Сохранить'}</Button>
        </>}>
          {editing.code_1c && <Muted>{editing.code_1c}</Muted>}

          <Segmented<Kind> value={kindOf(editing)} onChange={k => setEditing({ ...editing, is_free: k === 'free', is_our_ad: k === 'our' })}
            options={[['tenant', 'Арендатор'], ['free', 'Свободно'], ['our', 'Наша реклама']]} />

          {!editing.is_free && !editing.is_our_ad && (
            <>
              <div style={{ position: 'relative' }}>
                <Field label="Арендатор">
                  <Input
                    placeholder="Начните вводить имя…"
                    value={search}
                    onChange={e => { setSearch(e.target.value); setShowDropdown(true); setEditing({ ...editing, tenant_id: null, tenant_name: e.target.value }) }}
                    onFocus={() => setShowDropdown(true)}
                    onBlur={() => setShowDropdown(false)}
                    autoComplete="off"
                  />
                </Field>
                  {showDropdown && filtered.length > 0 && (
                    <div style={{
                      position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, marginTop: 2,
                      background: C.card, border: `1px solid ${C.line}`, borderRadius: C.radiusSm,
                      boxShadow: C.shadow, maxHeight: 220, overflowY: 'auto',
                    }}>
                      {filtered.slice(0, 30).map(t => (
                        <div key={t.id} onMouseDown={e => { e.preventDefault(); selectTenant(t) }} style={{
                          padding: '8px 12px', cursor: 'pointer', fontSize: 13, color: C.text, fontWeight: 400, borderBottom: `1px solid ${C.line}`,
                        }}
                          onMouseEnter={e => (e.currentTarget.style.background = C.hover)}
                          onMouseLeave={e => (e.currentTarget.style.background = '')}>
                          {t.full_name}
                          <span style={{ fontSize: 11, color: C.muted, marginLeft: 6 }}>
                            {t.type === 'COMPANY' ? 'Юрлицо' : t.type === 'IP' ? 'ИП' : 'Физлицо'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
              </div>

              <Field label="Стоимость рекламы, ₽/мес">
                <Input
                  type="number"
                  placeholder="0"
                  value={editing.monthly_fee ?? ''}
                  onChange={e => setEditing({ ...editing, monthly_fee: e.target.value ? parseFloat(e.target.value) : null })}
                />
              </Field>

              <Field label="Договор действует до">
                <Input type="date" value={editing.contract_end_date || ''} onChange={e => setEditing({ ...editing, contract_end_date: e.target.value })} />
              </Field>
            </>
          )}

          {saveError && <Notice tone="red">{saveError}</Notice>}
        </Modal>
      )}
    </Page>
  )
}
