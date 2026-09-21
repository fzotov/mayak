import { useState } from 'react'
import { BRD, FREE, FloorChrome, H, OCC, W } from '../lib/floorGeometry'
import type { PublicUnit } from './useSiteUnits'

const RESERVED = '#f3d9a4'

/**
 * Публичный план этажа: показываем только площадь и статус.
 * Имена арендаторов на сайт не выводим.
 */
export default function PublicFloorPlan({ units, onPick }: { units: PublicUnit[]; onPick: (u: PublicUnit) => void }) {
  const [floor, setFloor] = useState(2)
  const rooms = units.filter(u => u.floor === floor && u.room)
  const free = rooms.filter(u => u.status === 'free').length

  return (
    <div className="plan">
      <div className="plan__bar">
        <div className="plan__tabs">
          {[2, 3].map(f => (
            <button key={f} className={floor === f ? 'is-on' : ''} onClick={() => setFloor(f)}>{f} этаж</button>
          ))}
        </div>
        <div className="plan__legend">
          <span><i style={{ background: FREE }} />Свободно: {free}</span>
          <span><i style={{ background: OCC }} />Занято</span>
        </div>
      </div>

      <div className="plan__scroll">
        <svg className="plan__svg" viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg" role="img"
          aria-label={`План ${floor} этажа бизнес-центра Маяк`}>
          <FloorChrome />
          {rooms.map(u => {
            const r = u.room!
            const fill = u.status === 'free' ? FREE : u.status === 'reserved' ? RESERVED : OCC
            const clickable = u.status !== 'occupied'
            return (
              <g key={u.key}
                className={`plan__room${clickable ? ' plan__room--free' : ''}`}
                onClick={() => clickable && onPick(u)}
                style={{ cursor: clickable ? 'pointer' : 'default' }}>
                <title>
                  {`№${u.number} · ${u.area} м² · ${u.status === 'free' ? 'свободно' : u.status === 'reserved' ? 'бронь' : 'занято'}`}
                </title>
                <rect x={r.x} y={r.y} width={r.w} height={r.h} fill={fill} stroke={BRD} strokeWidth={1.2} />
                <text x={r.x + r.w / 2} y={r.y + r.h * 0.4}  textAnchor="middle" fontSize="8.5" fontWeight="700" fill="#1a1a1a">№{u.number}</text>
                <text x={r.x + r.w / 2} y={r.y + r.h * 0.63} textAnchor="middle" fontSize="7.5" fontWeight="600" fill="#1a1a1a">{u.area} м²</text>
                {u.status === 'free' && r.h >= 70 && (
                  <text x={r.x + r.w / 2} y={r.y + r.h * 0.84} textAnchor="middle" fontSize="7" fontWeight="700" fill="#17924b">смотреть →</text>
                )}
              </g>
            )
          })}
        </svg>
      </div>
      <div className="plan__hint">Нажмите на свободное помещение — покажем фото, видео, площадь и цену. План кликабелен, статусы обновляются из системы управления зданием.</div>
    </div>
  )
}
