import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const OCC = '#e8d5b0'
const FREE = '#c8e6c9'
const DEBT = '#ffcdd2'
const BRD = '#5d4037'
const W = 820
const H = 460

type Office = { id: string; number: string; area: number; x: number; y: number; w: number; h: number }

// 2 этаж — точно по плану
// Здание: 3 коридора, верхний/средний/нижний ряд
// Верхний ряд: 201-209 слева направо
// Средний: 223/224 слева, 226-234 центр, 213 справа
// Нижний: лестница слева, 221-214 справо
const F2: Office[] = [
  // ===== ВЕРХНИЙ РЯД =====
  { id:'201', number:'201,202', area:38.30, x:15,  y:12, w:112, h:85 },
  { id:'203', number:'203',     area:24.10, x:129, y:12, w:80,  h:85 },
  { id:'204', number:'204',     area:21.60, x:211, y:12, w:72,  h:85 },
  { id:'205', number:'205',     area:19.70, x:285, y:12, w:66,  h:85 },
  { id:'206', number:'206',     area:24.10, x:353, y:12, w:80,  h:85 },
  { id:'207', number:'207',     area:26.20, x:435, y:12, w:84,  h:85 },
  { id:'208', number:'208',     area:21.82, x:521, y:12, w:72,  h:85 },
  { id:'209', number:'209',     area:25.15, x:595, y:12, w:82,  h:85 },
  // ===== СРЕДНИЙ РЯД ЛЕВЫЙ =====
  { id:'224', number:'224', area:21.20, x:15, y:138, w:80, h:64 },
  { id:'223', number:'223', area:23.10, x:15, y:205, w:80, h:75 },
  // ===== СРЕДНИЙ РЯД ЦЕНТР =====
  { id:'226',  number:'226',  area:14.40, x:145, y:138, w:58, h:64 },
  { id:'227',  number:'227',  area:10.20, x:205, y:138, w:46, h:64 },
  { id:'228',  number:'228',  area:10.10, x:253, y:138, w:46, h:64 },
  { id:'229',  number:'229',  area:21.30, x:301, y:138, w:72, h:64 },
  { id:'230',  number:'230',  area:44.85, x:375, y:138, w:168,h:64 },
  { id:'231',  number:'231',  area:12.50, x:145, y:205, w:58, h:75 },
  { id:'231a', number:'231А', area:10.20, x:205, y:205, w:46, h:75 },
  { id:'231b', number:'231Б', area:10.30, x:253, y:205, w:46, h:75 },
  { id:'232',  number:'232',  area:16.60, x:301, y:205, w:58, h:75 },
  { id:'232a', number:'232А', area:16.87, x:361, y:205, w:58, h:75 },
  { id:'233',  number:'233',  area:13.90, x:421, y:205, w:52, h:75 },
  { id:'234',  number:'234',  area:12.20, x:475, y:205, w:48, h:75 },
  // ===== ПРАВЫЙ ТОРЕЦ =====
  { id:'213', number:'213', area:14.80, x:683, y:138, w:60, h:142 },
  // ===== НИЖНИЙ РЯД (после лестницы) =====
  { id:'221', number:'221', area:25.00, x:112, y:332, w:80, h:80 },
  { id:'220', number:'220', area:23.10, x:194, y:332, w:76, h:80 },
  { id:'219', number:'219', area:18.10, x:272, y:332, w:62, h:80 },
  { id:'218', number:'218', area:23.56, x:336, y:332, w:76, h:80 },
  { id:'217', number:'217', area:24.20, x:414, y:332, w:78, h:80 },
  { id:'216', number:'216', area:25.56, x:494, y:332, w:82, h:80 },
  { id:'215', number:'215', area:25.40, x:578, y:332, w:82, h:80 },
  { id:'214', number:'214', area:21.50, x:662, y:332, w:70, h:80 },
]

const F3: Office[] = [
  // ===== ВЕРХНИЙ РЯД =====
  { id:'301', number:'301,302', area:38.20, x:15,  y:12, w:112, h:85 },
  { id:'303', number:'303',     area:24.30, x:129, y:12, w:80,  h:85 },
  { id:'304', number:'304',     area:21.90, x:211, y:12, w:72,  h:85 },
  { id:'305', number:'305',     area:20.00, x:285, y:12, w:66,  h:85 },
  { id:'306', number:'306',     area:23.80, x:353, y:12, w:80,  h:85 },
  { id:'307', number:'307',     area:26.00, x:435, y:12, w:84,  h:85 },
  { id:'308', number:'308',     area:21.90, x:521, y:12, w:72,  h:85 },
  { id:'309', number:'309',     area:24.90, x:595, y:12, w:82,  h:85 },
  // ===== СРЕДНИЙ РЯД ЛЕВЫЙ =====
  { id:'324', number:'324', area:21.20, x:15, y:138, w:80, h:64 },
  { id:'323', number:'323', area:23.00, x:15, y:205, w:80, h:75 },
  // ===== СРЕДНИЙ РЯД ЦЕНТР =====
  { id:'326a', number:'326А', area:40.40, x:145, y:138, w:92, h:142 },
  { id:'326',  number:'326',  area:12.90, x:239, y:138, w:52, h:64 },
  { id:'327',  number:'327',  area:21.10, x:293, y:138, w:72, h:64 },
  { id:'328',  number:'328',  area:21.10, x:367, y:138, w:72, h:64 },
  { id:'329',  number:'329',  area:22.20, x:441, y:138, w:74, h:64 },
  { id:'326b', number:'326Б', area:17.30, x:239, y:205, w:52, h:75 },
  { id:'330',  number:'330',  area:15.65, x:293, y:205, w:72, h:75 },
  { id:'330a', number:'330А', area:17.45, x:367, y:205, w:56, h:75 },
  { id:'331',  number:'331',  area:13.60, x:425, y:205, w:52, h:75 },
  { id:'332',  number:'332',  area:12.20, x:479, y:205, w:48, h:75 },
  // ===== ПРАВЫЙ ТОРЕЦ =====
  { id:'313', number:'313', area:14.80, x:683, y:138, w:60, h:142 },
  // ===== НИЖНИЙ РЯД =====
  { id:'321', number:'321', area:25.00, x:112, y:332, w:80, h:80 },
  { id:'320', number:'320', area:23.50, x:194, y:332, w:76, h:80 },
  { id:'319', number:'319', area:18.60, x:272, y:332, w:62, h:80 },
  { id:'318', number:'318', area:23.90, x:336, y:332, w:76, h:80 },
  { id:'317', number:'317', area:22.50, x:414, y:332, w:78, h:80 },
  { id:'316', number:'316', area:26.00, x:494, y:332, w:82, h:80 },
  { id:'315', number:'315', area:25.90, x:578, y:332, w:82, h:80 },
  { id:'314', number:'314', area:21.50, x:662, y:332, w:70, h:80 },
]

const MOCK: Record<string, {status: string; tenant?: string}> = {
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
  const [selBuilding, setSelBuilding] = useState<any>(null)
  const [floor, setFloor] = useState(2)
  const [sel, setSel] = useState<string|null>(null)

  useEffect(() => {
    supabase.from('buildings').select('*').eq('active', true).then(({ data }) => {
      if (data?.length) { setBuildings(data); setSelBuilding(data[0]) }
    })
  }, [])

  const offices = floor === 2 ? F2 : F3
  const selOffice = offices.find(o => o.id === sel)
  const getS = (id: string) => MOCK[id]?.status || 'OCCUPIED'
  const getT = (id: string) => MOCK[id]?.tenant
  const getC = (id: string, s: boolean) => s ? '#1a2240' : getS(id) === 'FREE' ? FREE : getS(id) === 'DEBT' ? DEBT : OCC
  const occ = offices.filter(o => getS(o.id) === 'OCCUPIED').length
  const free = offices.filter(o => getS(o.id) === 'FREE').length
  const debt = offices.filter(o => getS(o.id) === 'DEBT').length

  return (
    <div style={{ maxWidth: 1000 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {buildings.map(b => (
          <button key={b.id} onClick={() => { setSelBuilding(b); setSel(null) }}
            style={{ padding: '6px 14px', border: `1px solid ${selBuilding?.id === b.id ? '#4f6ef7' : '#e8ebf3'}`, borderRadius: 8, background: selBuilding?.id === b.id ? '#eff3ff' : '#fff', color: selBuilding?.id === b.id ? '#4f6ef7' : '#6b7280', fontSize: 12, fontWeight: selBuilding?.id === b.id ? 600 : 400, cursor: 'pointer', fontFamily: 'inherit' }}>
            🏢 {b.name}
          </button>
        ))}
        <div style={{ width: 1, height: 20, background: '#e8ebf3' }} />
        {[2,3].map(f => (
          <button key={f} onClick={() => { setFloor(f); setSel(null) }}
            style={{ padding: '6px 14px', border: 'none', borderRadius: 8, background: floor === f ? '#4f6ef7' : '#e8ebf3', color: floor === f ? '#fff' : '#6b7280', fontSize: 12, fontWeight: floor === f ? 600 : 400, cursor: 'pointer', fontFamily: 'inherit' }}>
            {f} этаж
          </button>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 12, fontSize: 11 }}>
          {[{c:OCC,l:`Занято: ${occ}`},{c:FREE,l:`Свободно: ${free}`},{c:DEBT,l:`Долг: ${debt}`}].map((s,i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 12, height: 12, background: s.c, border: `1px solid ${BRD}` }} />
              <span style={{ color: '#6b7280' }}>{s.l}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: sel ? '1fr 240px' : '1fr', gap: 12 }}>
        <div style={{ background: '#fff', border: '1px solid #e8ebf3', borderRadius: 10, padding: 12, overflowX: 'auto' }}>
          <div style={{ fontSize: 11, color: '#8596b4', marginBottom: 8, fontWeight: 500 }}>{selBuilding?.name || 'БЦ Маяк'} · {floor} этаж</div>
          <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg" style={{ display: 'block' }}>
            <rect width={W} height={H} fill="#f0ebe3"/>
            {/* Внешние стены */}
            <rect x="5" y="5" width={W-10} height={H-10} fill="none" stroke={BRD} strokeWidth="4"/>
            {/* Лестница лево-низ */}
            <rect x="5" y="300" width="105" height="155" fill="#c8b89a" stroke={BRD} strokeWidth="2"/>
            <text x="57" y="378" textAnchor="middle" fontSize="9" fill={BRD}>лестница</text>
            {/* Лестница право-верх */}
            <rect x="680" y="5" width="135" height="130" fill="#c8b89a" stroke={BRD} strokeWidth="2"/>
            <text x="747" y="70" textAnchor="middle" fontSize="9" fill={BRD}>лестница</text>
            {/* WC */}
            <rect x="680" y="138" width="65" height="100" fill="#b0c4de" stroke={BRD} strokeWidth="1"/>
            <text x="712" y="185" textAnchor="middle" fontSize="10" fill="#1a3a5c">WC</text>
            <rect x="680" y="241" width="65" height="40" fill="#b0c4de" stroke={BRD} strokeWidth="1"/>

            {offices.map(o => {
              const s = sel === o.id
              return (
                <g key={o.id} onClick={() => setSel(o.id === sel ? null : o.id)} style={{ cursor: 'pointer' }}>
                  <rect x={o.x} y={o.y} width={o.w} height={o.h}
                    fill={getC(o.id, s)} stroke={s ? '#4f6ef7' : BRD} strokeWidth={s ? 2 : 1}/>
                  <text x={o.x+o.w/2} y={o.y+o.h/2-8} textAnchor="middle" fontSize="9" fontWeight="600" fill={s ? '#fff' : '#1a1a1a'}>
                    №{o.number}
                  </text>
                  <text x={o.x+o.w/2} y={o.y+o.h/2+7} textAnchor="middle" fontSize="8.5" fill={s ? '#a5b4fc' : BRD}>
                    {o.area} м²
                  </text>
                </g>
              )
            })}
          </svg>
        </div>

        {sel && selOffice && (
          <div style={{ background: '#fff', border: '1px solid #e8ebf3', borderRadius: 10, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#1a2240' }}>Офис №{selOffice.number}</div>
              <button onClick={() => setSel(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 16 }}>✕</button>
            </div>
            <div style={{ padding: '7px 10px', borderRadius: 7, marginBottom: 12, background: getS(selOffice.id) === 'FREE' ? '#f0fdf4' : '#fffbeb' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: getS(selOffice.id) === 'FREE' ? '#16a34a' : '#d97706' }}>
                {getS(selOffice.id) === 'FREE' ? 'Свободен' : 'Занят'}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
              <div><div style={{ fontSize: 11, color: '#8596b4', marginBottom: 2 }}>Площадь</div><div style={{ fontSize: 13, fontWeight: 500 }}>{selOffice.area} м²</div></div>
              {getT(selOffice.id) && <div><div style={{ fontSize: 11, color: '#8596b4', marginBottom: 2 }}>Арендатор</div><div style={{ fontSize: 13, fontWeight: 500 }}>{getT(selOffice.id)}</div></div>}
              <div><div style={{ fontSize: 11, color: '#8596b4', marginBottom: 2 }}>Этаж</div><div style={{ fontSize: 13, fontWeight: 500 }}>{floor} / {selBuilding?.name}</div></div>
            </div>
            {getS(selOffice.id) !== 'FREE'
              ? <button style={{ width: '100%', padding: '8px', border: 'none', borderRadius: 7, background: '#4f6ef7', color: '#fff', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>Открыть карточку</button>
              : <button style={{ width: '100%', padding: '8px', border: 'none', borderRadius: 7, background: '#16a34a', color: '#fff', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>Заселить арендатора</button>
            }
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginTop: 12 }}>
        {[{l:'Всего офисов',v:offices.length,c:'#1a2240'},{l:'Занято',v:occ,c:'#4f6ef7'},{l:'Свободно',v:free,c:'#16a34a'},{l:'С задолженностью',v:debt,c:'#ef4444'}].map((s,i) => (
          <div key={i} style={{ background: '#fff', border: '1px solid #e8ebf3', borderRadius: 9, padding: '12px 14px' }}>
            <div style={{ fontSize: 11, color: '#8596b4', marginBottom: 4 }}>{s.l}</div>
            <div style={{ fontSize: 22, fontWeight: 600, color: s.c }}>{s.v}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
