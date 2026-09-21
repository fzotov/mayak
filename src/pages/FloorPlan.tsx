import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// Exact room coordinates from rooms.json (original SVG viewBox 0 0 2048 1150)
// The overlay SVG uses the same viewBox — coordinates align 1:1 with the floor plan image
const ROOMS_F2 = [
  { id:'201-202', number:'201, 202', area_m2:38.30, x:64,   y:27,  w:196, h:216 },
  { id:'203',     number:'203',      area_m2:24.10, x:333,  y:29,  w:143, h:214 },
  { id:'204',     number:'204',      area_m2:21.60, x:476,  y:29,  w:149, h:214 },
  { id:'205',     number:'205',      area_m2:19.70, x:625,  y:29,  w:142, h:214 },
  { id:'206',     number:'206',      area_m2:24.10, x:767,  y:29,  w:147, h:214 },
  { id:'207',     number:'207',      area_m2:26.20, x:914,  y:29,  w:151, h:214 },
  { id:'208',     number:'208',      area_m2:21.82, x:1065, y:29,  w:145, h:214 },
  { id:'209',     number:'209',      area_m2:25.15, x:1210, y:29,  w:151, h:214 },
  { id:'224',     number:'224',      area_m2:21.20, x:128,  y:311, w:201, h:126 },
  { id:'223',     number:'223',      area_m2:23.10, x:128,  y:438, w:201, h:124 },
  { id:'226',     number:'226',      area_m2:14.40, x:407,  y:311, w:142, h:126 },
  { id:'227',     number:'227',      area_m2:10.20, x:549,  y:311, w:94,  h:126 },
  { id:'228',     number:'228',      area_m2:10.10, x:643,  y:311, w:96,  h:126 },
  { id:'229',     number:'229',      area_m2:21.30, x:739,  y:311, w:205, h:126 },
  { id:'230',     number:'230',      area_m2:44.85, x:944,  y:311, w:416, h:126 },
  { id:'231',     number:'231',      area_m2:12.50, x:407,  y:438, w:142, h:124 },
  { id:'231A',    number:'231A',     area_m2:10.20, x:549,  y:438, w:94,  h:124 },
  { id:'231B',    number:'231Б',     area_m2:10.30, x:643,  y:438, w:96,  h:124 },
  { id:'232',     number:'232',      area_m2:16.60, x:739,  y:438, w:149, h:124 },
  { id:'232A',    number:'232A',     area_m2:16.87, x:888,  y:438, w:151, h:124 },
  { id:'233',     number:'233',      area_m2:13.90, x:1039, y:438, w:129, h:124 },
  { id:'234',     number:'234',      area_m2:12.20, x:1168, y:438, w:99,  h:124 },
  { id:'213',     number:'213',      area_m2:14.80, x:1451, y:525, w:109, h:169 },
  { id:'221',     number:'221',      area_m2:25.00, x:329,  y:638, w:145, h:208 },
  { id:'220',     number:'220',      area_m2:23.10, x:474,  y:638, w:151, h:208 },
  { id:'219',     number:'219',      area_m2:18.10, x:625,  y:638, w:141, h:208 },
  { id:'218',     number:'218',      area_m2:23.56, x:766,  y:638, w:140, h:208 },
  { id:'217',     number:'217',      area_m2:24.20, x:906,  y:638, w:146, h:208 },
  { id:'216',     number:'216',      area_m2:25.56, x:1052, y:638, w:143, h:208 },
  { id:'215',     number:'215',      area_m2:25.40, x:1195, y:638, w:166, h:208 },
  { id:'214',     number:'214',      area_m2:21.50, x:1364, y:694, w:196, h:152 },
]

// Free rooms on floor 2 — only 231, 232, 217 (NOT 228)
const FREE_F2 = new Set(['231', '232', '217'])

type Room = typeof ROOMS_F2[number]

type TenantInfo = {
  id: string
  full_name: string
  unit_number: string
  monthly_rent: number | null
  monthly_total: number | null
  contract_number: string | null
  contract_start_date: string | null
  tenant_group: string
  inn: string | null
}

function fmt(n: number | null | undefined) {
  if (!n) return '—'
  return new Intl.NumberFormat('ru-RU').format(n) + ' ₽'
}

export function FloorPlanPage({ onOpenTenant }: { onOpenTenant?: (id: string) => void }) {
  const [floor, setFloor] = useState(2)
  const [hoverId, setHoverId] = useState<string | null>(null)
  const [selId, setSelId]   = useState<string | null>(null)
  const [byUnit, setByUnit] = useState<Record<string, TenantInfo>>({})

  useEffect(() => {
    supabase
      .from('tenants')
      .select('id,full_name,unit_number,monthly_rent,monthly_total,contract_number,contract_start_date,tenant_group,inn')
      .not('unit_number', 'is', null)
      .then(({ data }) => {
        if (!data) return
        const map: Record<string, TenantInfo> = {}
        for (const t of data) {
          const raw = t.unit_number as string
          for (const part of raw.split(/[,\s]+/)) {
            const p = part.trim()
            if (!p || /^ещё$/i.test(p) || /^и$/i.test(p)) continue
            for (const sub of p.includes('.') ? p.split('.') : [p]) {
              const c = sub.trim()
              if (c) map[c.toUpperCase()] = t as TenantInfo
            }
          }
        }
        setByUnit(map)
      })
  }, [])

  const getTenant = useCallback((room: Room): TenantInfo | null => {
    for (const part of room.number.split(/[,\s]+/)) {
      const t = byUnit[part.trim().toUpperCase()]
      if (t) return t
    }
    return null
  }, [byUnit])

  useEffect(() => { setSelId(null) }, [floor])

  const rooms = floor === 2 ? ROOMS_F2 : []
  const freeSet = floor === 2 ? FREE_F2 : new Set<string>()
  const selRoom = rooms.find(r => r.id === selId) ?? null
  const selTenant = selRoom ? getTenant(selRoom) : null
  const isFree = selId ? (freeSet.has(selId) || !selTenant) : false

  return (
    <div style={{ maxWidth: 1200 }}>
      {/* Tabs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        {[2, 3].map(f => (
          <button key={f} onClick={() => setFloor(f)}
            style={{
              padding: '6px 20px',
              border: floor === f ? '2px solid #4f6ef7' : '1px solid #d1d5db',
              borderRadius: 8, background: floor === f ? '#4f6ef7' : '#fff',
              color: floor === f ? '#fff' : '#374151',
              fontSize: 13, fontWeight: floor === f ? 600 : 400,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>
            {f} этаж
          </button>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 18, fontSize: 12, alignItems: 'center' }}>
          {[
            { bg: 'rgba(74,222,128,0.35)', br: 'rgba(22,163,74,0.9)', label: 'Свободно' },
            { bg: 'rgba(72,187,120,0.20)', br: 'rgba(34,120,70,0.8)', label: 'Наведение' },
          ].map(s => (
            <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 14, height: 14, background: s.bg, border: `1.5px solid ${s.br}`, borderRadius: 2 }} />
              <span style={{ color: '#6b7280', fontWeight: 500 }}>{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selId ? '1fr 280px' : '1fr', gap: 14, alignItems: 'start' }}>
        {/* Floor plan */}
        <div style={{ background: '#fff', border: '1px solid #e8ebf3', borderRadius: 10, padding: 10 }}>
          <div style={{ fontSize: 11, color: '#8596b4', marginBottom: 6, fontWeight: 600, letterSpacing: '0.03em' }}>
            БЦ Маяк · {floor} этаж — нажмите на кабинет
          </div>

          {floor === 2 ? (
            /* Wrapper: floor plan image + transparent interactive overlay */
            <div style={{ position: 'relative', width: '100%', lineHeight: 0 }}>
              {/* Original floor plan — rendered as image, visually 100% unchanged */}
              <img
                src="/floorplan_f2.svg"
                alt="План 2 этажа"
                style={{ width: '100%', display: 'block', borderRadius: 6 }}
                draggable={false}
              />

              {/* Transparent SVG overlay — same viewBox as original SVG */}
              {/* Hit areas, hover and selection highlights only — no redrawing of walls/rooms */}
              <svg
                viewBox="0 0 2048 1150"
                xmlns="http://www.w3.org/2000/svg"
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
              >
                {rooms.map(r => {
                  const isSel   = selId === r.id
                  const isHover = hoverId === r.id && !isSel
                  const isFreeRoom = freeSet.has(r.id)

                  let fill   = 'transparent'
                  let stroke = 'transparent'
                  let sw     = 0

                  if (isSel) {
                    fill   = 'rgba(79, 110, 247, 0.22)'
                    stroke = 'rgba(79, 110, 247, 0.90)'
                    sw     = 4
                  } else if (isFreeRoom) {
                    fill   = isHover ? 'rgba(74, 222, 128, 0.45)' : 'rgba(74, 222, 128, 0.35)'
                    stroke = 'rgba(22, 163, 74, 0.90)'
                    sw     = 3
                  } else if (isHover) {
                    fill   = 'rgba(72, 187, 120, 0.20)'
                    stroke = 'rgba(34, 120, 70, 0.80)'
                    sw     = 3
                  }

                  return (
                    <rect
                      key={r.id}
                      x={r.x} y={r.y} width={r.w} height={r.h}
                      fill={fill}
                      stroke={stroke}
                      strokeWidth={sw}
                      style={{ cursor: 'pointer' }}
                      onMouseEnter={() => setHoverId(r.id)}
                      onMouseLeave={() => setHoverId(null)}
                      onClick={() => setSelId(selId === r.id ? null : r.id)}
                    />
                  )
                })}
              </svg>
            </div>
          ) : (
            <div style={{ padding: 48, textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🏢</div>
              <div>План 3 этажа в разработке</div>
              <div style={{ fontSize: 12, marginTop: 6 }}>Поместите floorplan_f3.svg в папку public</div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        {selRoom && (
          <div style={{ background: '#fff', border: '1px solid #e8ebf3', borderRadius: 10, padding: 16, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#1a2240' }}>Кабинет №{selRoom.number}</div>
              <button onClick={() => setSelId(null)}
                style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 18, lineHeight: 1 }}>✕</button>
            </div>

            <div style={{ padding: '5px 10px', borderRadius: 7, marginBottom: 12, background: isFree ? '#f0fdf4' : '#eff6ff' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: isFree ? '#16a34a' : '#3b82f6' }}>
                {isFree ? 'Свободен' : 'Занято'}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
              <span style={{ fontSize: 11, color: '#8596b4' }}>Площадь</span>
              <span style={{ fontSize: 12, fontWeight: 500 }}>{selRoom.area_m2} м²</span>
            </div>

            {selTenant && (
              <>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1a2240', margin: '12px 0 8px', lineHeight: 1.4 }}>
                  {selTenant.full_name}
                </div>
                {[
                  { label: 'Аренда',       value: fmt(selTenant.monthly_rent) },
                  { label: 'Итого в мес.', value: fmt(selTenant.monthly_total) },
                  { label: 'Договор №',    value: selTenant.contract_number || '—' },
                  { label: 'Дата начала',  value: selTenant.contract_start_date ? new Date(selTenant.contract_start_date).toLocaleDateString('ru-RU') : '—' },
                  { label: 'ИНН',          value: selTenant.inn || '—' },
                ].map(({ label, value }) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '5px 0', borderBottom: '1px solid #f1f5f9' }}>
                    <span style={{ fontSize: 11, color: '#8596b4' }}>{label}</span>
                    <span style={{ fontSize: 12, fontWeight: 500, color: '#1a2240', textAlign: 'right', maxWidth: 160 }}>{value}</span>
                  </div>
                ))}
                <button onClick={() => onOpenTenant?.(selTenant.id)}
                  style={{ marginTop: 14, width: '100%', padding: '9px', border: 'none', borderRadius: 7, background: '#4f6ef7', color: '#fff', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
                  Открыть карточку →
                </button>
              </>
            )}

            {!selTenant && (
              <div style={{ marginTop: 8, fontSize: 12, color: '#6b7280' }}>Нет данных об арендаторе</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
