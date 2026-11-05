'use client'

import { useState } from 'react'
import type { PlanRoom } from '@/data/floors'
import type { Office } from '@/lib/offices'
import { STATUS_STYLE, formatArea, officeAriaLabel } from '@/lib/offices'

/**
 * Одно помещение на схеме этажа. Контур берётся из схемы без изменений —
 * компонент отвечает только за статус, выделение, доступность и события.
 */
export default function RoomShape({
  room, office, selected, onSelect, onHover,
}: {
  room: PlanRoom
  office?: Office
  selected: boolean
  onSelect: (office: Office) => void
  onHover: (room: PlanRoom | null, office?: Office) => void
}) {
  const [hovered, setHovered] = useState(false)
  const status = office?.status ?? 'unavailable'
  const style = STATUS_STYLE[status]
  const interactive = !!office

  const activate = () => { if (office) onSelect(office) }
  const enter = () => { setHovered(true); onHover(room, office) }
  const leave = () => { setHovered(false); onHover(null) }

  const mark = office?.status === 'available' || office?.status === 'reserved'
  const cx = room.bbox.x + room.bbox.w / 2
  const cy = room.bbox.y + 26
  const badgeW = Math.max(96, Math.min(room.bbox.w * 0.8, 170))
  const fontSize = badgeW < 120 ? 17 : 20

  return (
    <g>
    <path
      d={room.path}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : -1}
      aria-label={office ? officeAriaLabel(office) : `${room.number}, ${room.area ? formatArea(room.area) : ''}`}
      onClick={activate}
      onKeyDown={e => { if (interactive && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); activate() } }}
      onMouseEnter={enter}
      onMouseLeave={leave}
      onFocus={enter}
      onBlur={leave}
      fill={selected ? 'rgb(18 57 95 / .34)' : hovered ? style.hover : style.fill}
      stroke={selected ? 'rgb(12 39 67)' : style.stroke}
      strokeWidth={selected ? 6 : hovered ? 5 : 2}
      className="transition-[fill,stroke-width] duration-200"
      style={{ cursor: interactive ? 'pointer' : 'default' }}
    />
      {mark && (
        <g pointerEvents="none">
          <rect x={cx - badgeW / 2} y={cy - 17} width={badgeW} height={34} rx={17}
            fill={office!.status === 'available' ? 'rgb(30 138 82)' : 'rgb(176 124 19)'} />
          <text x={cx} y={cy + 7} textAnchor="middle" fontSize={fontSize} fontWeight={700} fill="#fff">
            {office!.status === 'available' ? 'СВОБОДНО' : 'БРОНЬ'}
          </text>
        </g>
      )}
    </g>
  )
}
