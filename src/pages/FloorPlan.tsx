import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const OCC = '#e8d5b0'
const FREE = '#c8e6c9'
const DEBT = '#ffcdd2'
const BRD = '#5d4037'

type Office = { id: string; number: string; area: number; x: number; y: number; w: number; h: number }

const FLOOR2: Office[] = [
  // Верхний ряд (y=15, h=80)
  { id:'201', number:'201, 202', area:38.30, x:15, y:15, w:105, h:80 },
  { id:'203', number:'203', area:24.10, x:122, y:15, w:78, h:80 },
  { id:'204', number:'204', area:21.60, x:202, y:15, w:70, h:80 },
  { id:'205', number:'205', area:19.70, x:274, y:15, w:64, h:80 },
  { id:'206', number:'206', area:24.10, x:340, y:15, w:78, h:80 },
  { id:'207', number:'207', area:26.20, x:420, y:15, w:82, h:80 },
  { id:'208', number:'208', area:21.82, x:504, y:15, w:70, h:80 },
  { id:'209', number:'209', area:25.15, x:576, y:15, w:80, h:80 },
  // Средний ряд левый (y=130)
  { id:'224', number:'224', area:21.20, x:15, y:130, w:78, h:62 },
  { id:'223', number:'223', area:23.10, x:15, y:196, w:78, h:72 },
  // Средний ряд центр верх (y=130, h=62)
  { id:'226', number:'226', area:14.40, x:140, y:130, w:58, h:62 },
  { id:'227', number:'227', area:10.20, x:200, y:130, w:44, h:62 },
  { id:'228', number:'228', area:10.10, x:246, y:130, w:44, h:62 },
  { id:'229', number:'229', area:21.30, x:292, y:130, w:70, h:62 },
  { id:'230', number:'230', area:44.85, x:364, y:130, w:160, h:62 },
  // Средний ряд центр низ (y=196, h=72)
  { id:'231', number:'231', area:12.50, x:140, y:196, w:58, h:72 },
  { id:'231a', number:'231А', area:10.20, x:200, y:196, w:44, h:72 },
  { id:'231b', number:'231Б', area:10.30, x:246, y:196, w:44, h:72 },
  { id:'232', number:'232', area:16.60, x:292, y:196, w:58, h:72 },
  { id:'232a', number:'232А', area:16.87, x:352, y:196, w:56, h:72 },
  { id:'233', number:'233', area:13.90, x:410, y:196, w:50, h:72 },
  { id:'234', number:'234', area:12.20, x:462, y:196, w:46, h:72 },
  // Правый торец
  { id:'213', number:'213', area:14.80, x:630, y:130, w:58, h:138 },
  // Нижний ряд (y=310, начинается после лестницы)
  { id:'221', number:'221', area:25.00, x:105, y:310, w:78, h:78 },
  { id:'220', number:'220', area:23.10, x:185, y:310, w:74, h:78 },
  { id:'219', number:'219', area:18.10, x:261, y:310, w:60, h:78 },
  { id:'218', number:'218', area:23.56, x:323, y:310, w:74, h:78 },
  { id:'217', number:'217', area:24.20, x:399, y:310, w:76, h:78 },
  { id:'216', number:'216', area:25.56, x:477, y:310, w:80, h:78 },
  { id:'215', number:'215', area:25.40, x:559, y:310, w:80, h:78 },
  { id:'214', number:'214', area:21.50, x:641, y:310, w:70, h:78 },
]

const FLOOR3: Office[] = [
  // Верхний ряд
  { id:'301', number:'301, 302', area:38.20, x:15, y:15, w:105, h:80 },
  { id:'303', number:'303', area:24.30, x:122, y:15, w:78, h:80 },
  { id:'304', number:'304', area:21.90, x:202, y:15, w:70, h:80 },
  { id:'305', number:'305', area:20.00, x:274, y:15, w:64, h:80 },
  { id:'306', number:'306', area:23.80, x:340, y:15, w:78, h:80 },
  { id:'307', number:'307', area:26.00, x:420, y:15, w:82, h:80 },
  { id:'308', number:'308', area:21.90, x:504, y:15, w:70, h:80 },
  { id:'309', number:'309', area:24.90, x:576, y:15, w:80, h:80 },
  // Средний ряд левый
  { id:'324', number:'324', area:21.20, x:15, y:130, w:78, h:62 },
  { id:'323', number:'323', area:23.00, x:15, y:196, w:78, h:72 },
  // 326А — большой офис слева в центре
  { id:'326a', number:'326А', area:40.40, x:140, y:130, w:90, h:138 },
  // Средний ряд центр верх
  { id:'326', number:'326', area:12.90, x:232, y:130, w:52, h:62 },
  { id:'327', number:'327', area:21.10, x:286, y:130, w:70, h:62 },
  { id:'328', number:'328', area:21.10, x:358, y:130, w:70, h:62 },
  { id:'329', number:'329', area:22.20, x:430, y:130, w:72, h:62 },
  // Средний ряд центр низ
  { id:'326b', number:'326Б', area:17.30, x:232, y:196, w:52, h:72 },
  { id:'330', number:'330', area:15.65, x:286, y:196, w:70, h:72 },
  { id:'330a', number:'330А', area:17.45, x:358, y:196, w:56, h:72 },
  { id:'331', number:'331', area:13.60, x:416, y:196, w:50, h:72 },
  { id:'332', number:'332', area:12.20, x:468, y:196, w:46, h:72 },
  // Правый торец
  { id:'313', number:'313', area:14.80, x:630, y:130, w:58, h:138 },
  // Нижний ряд
  { id:'321', number:'321', area:25.00, x:105, y:310, w:78, h:78 },
  { id:'320', number:'320', area:23.50, x:185, y:310, w:74, h:78 },
  { id:'319', number:'319', area:18.60, x:261, y:310, w:60, h:78 },
  { id:'318', number:'318', area:23.90, x:323, y:310, w:74, h:78 },
  { id:'317', number:'317', area:22.50, x:399, y:310, w:76, h:78 },
  { id:'316', number:'316', area:26.00, x:477, y:310, w:80, h:78 },
  { id:'315', number:'315', area:25.90, x:559, y:310, w:80, h:78 },
  { id:'314', number:'314', area:21.50, x:641, y:310, w:70, h:78 },
]

const MOCK_STATUS: Record<string, {status: string; tenant?: string}> = {
  '203': { status: 'OCCUPIED', tenant: 'ИП Фролова Е.В.' },
  '204': { status: 'OCCUPIED', tenant: 'ООО Техцентр' },
  '208': { status: 'OCCUPIED', tenant: 'ООО Консалт' },
  '231': { status: 'FREE' },
  '232': { status: 'FREE' },
  '215': { status: 'FREE' },
  '327': { status: 'FREE' },
  '330': { status: 'FREE' },
}

export function FloorPlanPage() {
  const [buildings, setBuildings] = useState<any[]>([])
  const [selectedBuilding, setSelectedBuilding] = useState<any>(null)
  const [floor, setFloor] = useState(2)
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    supabase.from('buildings').select('*').eq('active', true).then(({ data }) => {
      if (data && data.length > 0) { setBuildings(data); setSelectedBuilding(data[0]) }
    })
  }, [])

  const offices = floor === 2 ? FLOOR2 : FLOOR3
  const selectedOffice = offices.find(o => o.id === selected)
  const getStatus = (id: string) => MOCK_STATUS[id]?.status || 'OCCUPIED'
  const getTenant = (id: string) => MOCK_STATUS[id]?.tenant
  const getColor = (id: string, sel: boolean) => {
    if (sel) return '#1a2240'
    const s = getStatus(id)
    return s === 'FREE' ? FREE : s === 'DEBT' ? DEBT : OCC
  }
  const occupied = offices.filter(o => getStatus(o.id) === 'OCCUPIED').length
  const free = offices.filter(o => getStatus(o.id) === 'FREE').length
  const debt = offices.filter(o => getStatus(o.id) === 'DEBT').length

  return (
    <div style={{ maxWidth: 1000 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {buildings.map(b => (
          <button key={b.id} onClick={() => { setSelectedBuilding(b); setSelected(null) }}
            style={{ padding: '6px 14px', border: `1px solid ${selectedBuilding?.id === b.id ? '#4f6ef7' : '#e8ebf3'}`, borderRadius: 8, background: selectedBuilding?.id === b.id ? '#eff3ff' : '#fff', color: selectedBuilding?.id === b.id ? '#4f6ef7' : '#6b7280', fontSize: 12, fontWeight: selectedBuilding?.id === b.id ? 600 : 400, cursor: 'pointer', fontFamily: 'inherit' }}>
            🏢 {b.name}
          </button>
        ))}
        <div style={{ width: 1, height: 20, background: '#e8ebf3' }} />
        {[2, 3].map(f => (
          <button key={f} onClick={() => { setFloor(f); setSelected(null) }}
            style={{ padding: '6px 14px', border: 'none', borderRadius: 8, background: floor === f ? '#4f6ef7' : '#e8ebf3', color: floor === f ? '#fff' : '#6b7280', fontSize: 12, fontWeight: floor === f ? 600 : 400, cursor: 'pointer', fontFamily: 'inherit' }}>
            {f} этаж
          </button>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 12, fontSize: 11 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><div style={{ width: 12, height: 12, background: OCC, border: `1px solid ${BRD}` }} /><span style={{ color: '#6b7280' }}>Занято: {occupied}</span></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><div style={{ width: 12, height: 12, background: FREE, border: `1px solid ${BRD}` }} /><span style={{ color: '#6b7280' }}>Свободно: {free}</span></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><div style={{ width: 12, height: 12, background: DEBT, border: `1px solid ${BRD}` }} /><span style={{ color: '#6b7280' }}>Долг: {debt}</span></div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 240px' : '1fr', gap: 12 }}>
        <div style={{ background: '#fff', border: '1px solid #e8ebf3', borderRadius: 10, padding: 16, overflowX: 'auto' }}>
          <div style={{ fontSize: 11, color: '#8596b4', marginBottom: 8, fontWeight: 500 }}>{selectedBuilding?.name || 'БЦ Маяк'} · {floor} этаж</div>
          <svg width="730" height="410" viewBox="0 0 730 410" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block' }}>
            {/* Фон */}
            <rect width="730" height="410" fill="#f5f0eb"/>
            {/* Внешний контур */}
            <rect x="5" y="5" width="720" height="400" fill="none" stroke={BRD} strokeWidth="3"/>
            {/* Лестница слева снизу */}
            <rect x="5" y="280" width="95" height="125" fill="#d7ccc8" stroke={BRD} strokeWidth="1"/>
            <text x="52" y="345" textAnchor="middle" fontSize="9" fill="#5d4037">лестница</text>
            {/* Лестница справа верх */}
            <rect x="660" y="5" width="65" height="120" fill="#d7ccc8" stroke={BRD} strokeWidth="1"/>
            <text x="692" y="65" textAnchor="middle" fontSize="9" fill="#5d4037">лестн.</text>
            {/* Туалеты справа */}
            <rect x="660" y="128" width="65" height="65" fill="#b0bec5" stroke={BRD} strokeWidth="1"/>
            <text x="692" y="162" textAnchor="middle" fontSize="10" fill="#546e7a">WC ♀</text>
            <rect x="660" y="196" width="65" height="72" fill="#b0bec5" stroke={BRD} strokeWidth="1"/>
            <text x="692" y="233" textAnchor="middle" fontSize="10" fill="#546e7a">WC ♂</text>

            {offices.map(o => {
              const sel = selected === o.id
              const color = getColor(o.id, sel)
              const textColor = sel ? '#fff' : '#1a1a1a'
              const subColor = sel ? '#a5b4fc' : '#5d4037'
              return (
                <g key={o.id} onClick={() => setSelected(o.id === selected ? null : o.id)} style={{ cursor: 'pointer' }}>
                  <rect x={o.x} y={o.y} width={o.w} height={o.h} fill={color} stroke={sel ? '#4f6ef7' : BRD} strokeWidth={sel ? 2 : 1}/>
                  <text x={o.x + o.w/2} y={o.y + o.h/2 - 7} textAnchor="middle" fontSize="9" fontWeight="600" fill={textColor}>№ {o.number}</text>
                  <text x={o.x + o.w/2} y={o.y + o.h/2 + 7} textAnchor="middle" fontSize="8.5" fill={subColor}>{o.area} м²</text>
                </g>
              )
            })}
          </svg>
        </div>

        {selected && selectedOffice && (
          <div style={{ background: '#fff', border: '1px solid #e8ebf3', borderRadius: 10, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#1a2240' }}>Офис №{selectedOffice.number}</div>
              <button onClick={() => setSelected(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 16 }}>✕</button>
            </div>
            <div style={{ padding: '7px 10px', borderRadius: 7, marginBottom: 12, background: getStatus(selectedOffice.id) === 'FREE' ? '#f0fdf4' : getStatus(selectedOffice.id) === 'DEBT' ? '#fef2f2' : '#fffbeb' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: getStatus(selectedOffice.id) === 'FREE' ? '#16a34a' : getStatus(selectedOffice.id) === 'DEBT' ? '#ef4444' : '#d97706' }}>
                {getStatus(selectedOffice.id) === 'FREE' ? 'Свободен' : getStatus(selectedOffice.id) === 'DEBT' ? 'Долг' : 'Занят'}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
              <div><div style={{ fontSize: 11, color: '#8596b4', marginBottom: 2 }}>Площадь</div><div style={{ fontSize: 13, fontWeight: 500 }}>{selectedOffice.area} м²</div></div>
              {getTenant(selectedOffice.id) && <div><div style={{ fontSize: 11, color: '#8596b4', marginBottom: 2 }}>Арендатор</div><div style={{ fontSize: 13, fontWeight: 500 }}>{getTenant(selectedOffice.id)}</div></div>}
              <div><div style={{ fontSize: 11, color: '#8596b4', marginBottom: 2 }}>Этаж / Здание</div><div style={{ fontSize: 13, fontWeight: 500 }}>{floor} / {selectedBuilding?.name}</div></div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {getStatus(selectedOffice.id) !== 'FREE' && <button style={{ width: '100%', padding: '8px', border: 'none', borderRadius: 7, background: '#4f6ef7', color: '#fff', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>Открыть карточку</button>}
              {getStatus(selectedOffice.id) === 'FREE' && <button style={{ width: '100%', padding: '8px', border: 'none', borderRadius: 7, background: '#16a34a', color: '#fff', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>Заселить арендатора</button>}
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginTop: 12 }}>
        {[{ label: 'Всего офисов', value: offices.length, color: '#1a2240' }, { label: 'Занято', value: occupied, color: '#4f6ef7' }, { label: 'Свободно', value: free, color: '#16a34a' }, { label: 'С задолженностью', value: debt, color: '#ef4444' }].map((s, i) => (
          <div key={i} style={{ background: '#fff', border: '1px solid #e8ebf3', borderRadius: 9, padding: '12px 14px' }}>
            <div style={{ fontSize: 11, color: '#8596b4', marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 600, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
