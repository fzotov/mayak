import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const STATUS_COLOR: Record<string, string> = { OCCUPIED: '#4f6ef7', FREE: '#e8ebf3', DEBT: '#fee2e2' }
const STATUS_TEXT: Record<string, string> = { OCCUPIED: '#fff', FREE: '#8596b4', DEBT: '#ef4444' }
const STATUS_LABEL: Record<string, string> = { OCCUPIED: 'Занят', FREE: 'Свободен', DEBT: 'Долг' }

const MOCK_OFFICES: Record<number, any[]> = {
  2: [
    { id: 'u201', number: '201', area: 18, x: 10, y: 10, w: 80, h: 60, tenant: 'ООО Маяк-Сервис', status: 'OCCUPIED', rent: 36000 },
    { id: 'u202', number: '202', area: 12, x: 100, y: 10, w: 60, h: 60, status: 'FREE' },
    { id: 'u203', number: '203', area: 18, x: 170, y: 10, w: 80, h: 60, tenant: 'ИП Фролова Е.В.', status: 'DEBT', rent: 18000 },
    { id: 'u204', number: '204', area: 21, x: 260, y: 10, w: 90, h: 60, tenant: 'ООО Техцентр', status: 'OCCUPIED', rent: 20500 },
    { id: 'u205', number: '205', area: 15, x: 360, y: 10, w: 70, h: 60, status: 'FREE' },
    { id: 'u206', number: '206', area: 25, x: 440, y: 10, w: 100, h: 60, tenant: 'ИП Захаров', status: 'OCCUPIED', rent: 18700 },
    { id: 'u207', number: '207', area: 20, x: 10, y: 90, w: 85, h: 65, status: 'FREE' },
    { id: 'u208', number: '208', area: 35, x: 105, y: 90, w: 120, h: 65, tenant: 'ООО Консалт', status: 'OCCUPIED', rent: 41400 },
    { id: 'u209', number: '209', area: 18, x: 235, y: 90, w: 80, h: 65, status: 'FREE' },
    { id: 'u210', number: '210', area: 22, x: 325, y: 90, w: 90, h: 65, tenant: 'ООО Реклама', status: 'DEBT', rent: 22000 },
    { id: 'u211', number: '211', area: 30, x: 425, y: 90, w: 115, h: 65, status: 'FREE' },
  ],
  3: [
    { id: 'u301', number: '301', area: 40, x: 10, y: 10, w: 120, h: 70, tenant: 'ООО СтройПроект', status: 'OCCUPIED', rent: 45000 },
    { id: 'u302', number: '302', area: 25, x: 140, y: 10, w: 90, h: 70, status: 'FREE' },
    { id: 'u303', number: '303', area: 18, x: 240, y: 10, w: 80, h: 70, tenant: 'ИП Кузнецов', status: 'OCCUPIED', rent: 19000 },
    { id: 'u304', number: '304', area: 22, x: 330, y: 10, w: 90, h: 70, status: 'FREE' },
    { id: 'u305', number: '305', area: 35, x: 430, y: 10, w: 110, h: 70, tenant: 'ООО Медиа', status: 'OCCUPIED', rent: 38000 },
    { id: 'u306', number: '306', area: 28, x: 10, y: 100, w: 100, h: 65, status: 'FREE' },
    { id: 'u307', number: '307', area: 20, x: 120, y: 100, w: 85, h: 65, tenant: 'ИП Смирнова', status: 'OCCUPIED', rent: 21000 },
    { id: 'u308', number: '308', area: 45, x: 215, y: 100, w: 140, h: 65, tenant: 'ООО Логистик', status: 'OCCUPIED', rent: 52000 },
    { id: 'u309', number: '309', area: 18, x: 365, y: 100, w: 80, h: 65, status: 'FREE' },
    { id: 'u310', number: '310', area: 25, x: 455, y: 100, w: 85, h: 65, status: 'FREE' },
  ]
}

export function FloorPlanPage() {
  const [buildings, setBuildings] = useState<any[]>([])
  const [selectedBuilding, setSelectedBuilding] = useState<any>(null)
  const [floor, setFloor] = useState(2)
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    supabase.from('buildings').select('*').eq('active', true).then(({ data, error }) => {
      console.log('buildings:', data, error)
      if (data && data.length > 0) {
        setBuildings(data)
        setSelectedBuilding(data[0])
      }
    })
  }, [])

  const offices = MOCK_OFFICES[floor] || []
  const selectedOffice = offices.find(o => o.id === selected)
  const floors = selectedBuilding ? Array.from({ length: selectedBuilding.floors }, (_, i) => i + 1).filter(f => f >= 2) : [2, 3]

  const stats = {
    total: offices.length,
    occupied: offices.filter(o => o.status === 'OCCUPIED').length,
    free: offices.filter(o => o.status === 'FREE').length,
    debt: offices.filter(o => o.status === 'DEBT').length,
  }

  return (
    <div style={{ maxWidth: 920 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {buildings.map(b => (
            <button key={b.id} onClick={() => { setSelectedBuilding(b); setSelected(null); setFloor(2) }}
              style={{ padding: '6px 14px', border: `1px solid ${selectedBuilding?.id === b.id ? '#4f6ef7' : '#e8ebf3'}`, borderRadius: 8, background: selectedBuilding?.id === b.id ? '#eff3ff' : '#fff', color: selectedBuilding?.id === b.id ? '#4f6ef7' : '#6b7280', fontSize: 12, fontWeight: selectedBuilding?.id === b.id ? 600 : 400, cursor: 'pointer', fontFamily: 'inherit' }}>
              🏢 {b.name}
            </button>
          ))}
        </div>
        <div style={{ width: 1, height: 24, background: '#e8ebf3' }} />
        <div style={{ display: 'flex', gap: 4 }}>
          {floors.map(f => (
            <button key={f} onClick={() => { setFloor(f); setSelected(null) }}
              style={{ padding: '6px 14px', border: 'none', borderRadius: 8, background: floor === f ? '#4f6ef7' : '#e8ebf3', color: floor === f ? '#fff' : '#6b7280', fontSize: 12, fontWeight: floor === f ? 600 : 400, cursor: 'pointer', fontFamily: 'inherit' }}>
              {f} этаж
            </button>
          ))}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 14, fontSize: 11 }}>
          {[{ color: '#4f6ef7', label: `Занято: ${stats.occupied}` }, { color: '#d1fae5', label: `Свободно: ${stats.free}`, border: '1px solid #6ee7b7' }, { color: '#fee2e2', label: `Долг: ${stats.debt}`, border: '1px solid #fca5a5' }].map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: s.color, border: (s as any).border || 'none' }} />
              <span style={{ color: '#6b7280' }}>{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 260px' : '1fr', gap: 14 }}>
        <div style={{ background: '#fff', border: '1px solid #e8ebf3', borderRadius: 10, padding: 16, overflowX: 'auto' }}>
          <div style={{ fontSize: 11, color: '#8596b4', marginBottom: 10, fontWeight: 500 }}>
            {selectedBuilding?.name || 'БЦ Маяк'} · {floor} этаж · {stats.total} офисов
          </div>
          <svg width="560" height="185" viewBox="0 0 560 185" xmlns="http://www.w3.org/2000/svg">
            <rect width="560" height="185" fill="#f8f9fc" rx="4"/>
            {offices.map(o => (
              <g key={o.id} onClick={() => setSelected(o.id === selected ? null : o.id)} style={{ cursor: 'pointer' }}>
                <rect x={o.x} y={o.y} width={o.w} height={o.h} rx="4"
                  fill={o.id === selected ? '#1a2240' : STATUS_COLOR[o.status]}
                  stroke={o.id === selected ? '#4f6ef7' : o.status === 'FREE' ? '#d1d5db' : 'transparent'}
                  strokeWidth={o.id === selected ? 2 : 1} />
                <text x={o.x + o.w/2} y={o.y + o.h/2 - 8} textAnchor="middle" fontSize="11" fontWeight="600"
                  fill={o.id === selected ? '#fff' : STATUS_TEXT[o.status]}>№{o.number}</text>
                <text x={o.x + o.w/2} y={o.y + o.h/2 + 6} textAnchor="middle" fontSize="9"
                  fill={o.id === selected ? '#a5b4fc' : o.status === 'FREE' ? '#9ca3af' : o.status === 'DEBT' ? '#ef4444' : '#a5b4fc'}>
                  {o.area}м²
                </text>
                {o.status !== 'FREE' && (
                  <text x={o.x + o.w/2} y={o.y + o.h/2 + 18} textAnchor="middle" fontSize="8"
                    fill={o.id === selected ? '#c7d2fe' : o.status === 'DEBT' ? '#fca5a5' : '#c7d2fe'}>
                    {o.rent?.toLocaleString('ru')}₽
                  </text>
                )}
              </g>
            ))}
          </svg>
        </div>

        {selected && selectedOffice && (
          <div style={{ background: '#fff', border: '1px solid #e8ebf3', borderRadius: 10, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#1a2240' }}>Офис №{selectedOffice.number}</div>
              <button onClick={() => setSelected(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 16 }}>✕</button>
            </div>
            <div style={{ padding: '7px 10px', borderRadius: 7, background: selectedOffice.status === 'FREE' ? '#f0fdf4' : selectedOffice.status === 'DEBT' ? '#fef2f2' : '#eff3ff', marginBottom: 14 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: selectedOffice.status === 'FREE' ? '#16a34a' : selectedOffice.status === 'DEBT' ? '#ef4444' : '#4f6ef7' }}>
                {STATUS_LABEL[selectedOffice.status]}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
              <div><div style={{ fontSize: 11, color: '#8596b4', marginBottom: 2 }}>Площадь</div><div style={{ fontSize: 13, fontWeight: 500, color: '#1a2240' }}>{selectedOffice.area} м²</div></div>
              {selectedOffice.tenant && <div><div style={{ fontSize: 11, color: '#8596b4', marginBottom: 2 }}>Арендатор</div><div style={{ fontSize: 13, fontWeight: 500, color: '#1a2240' }}>{selectedOffice.tenant}</div></div>}
              {selectedOffice.rent && <div><div style={{ fontSize: 11, color: '#8596b4', marginBottom: 2 }}>Аренда</div><div style={{ fontSize: 13, fontWeight: 500, color: '#1a2240' }}>{selectedOffice.rent.toLocaleString('ru')} ₽/мес</div></div>}
              <div><div style={{ fontSize: 11, color: '#8596b4', marginBottom: 2 }}>Здание</div><div style={{ fontSize: 13, fontWeight: 500, color: '#1a2240' }}>{selectedBuilding?.name}</div></div>
              <div><div style={{ fontSize: 11, color: '#8596b4', marginBottom: 2 }}>Этаж</div><div style={{ fontSize: 13, fontWeight: 500, color: '#1a2240' }}>{floor}</div></div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {selectedOffice.status !== 'FREE' && (
                <button style={{ width: '100%', padding: '8px', border: 'none', borderRadius: 7, background: '#4f6ef7', color: '#fff', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>Открыть карточку</button>
              )}
              {selectedOffice.status === 'FREE' && (
                <button style={{ width: '100%', padding: '8px', border: 'none', borderRadius: 7, background: '#16a34a', color: '#fff', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>Заселить арендатора</button>
              )}
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginTop: 14 }}>
        {[
          { label: 'Всего офисов', value: stats.total, color: '#1a2240' },
          { label: 'Занято', value: stats.occupied, color: '#4f6ef7' },
          { label: 'Свободно', value: stats.free, color: '#16a34a' },
          { label: 'С задолженностью', value: stats.debt, color: '#ef4444' },
        ].map((s, i) => (
          <div key={i} style={{ background: '#fff', border: '1px solid #e8ebf3', borderRadius: 9, padding: '12px 14px' }}>
            <div style={{ fontSize: 11, color: '#8596b4', marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 600, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
