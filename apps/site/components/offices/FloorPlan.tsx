'use client'

import Image from 'next/image'
import { useRef, useState } from 'react'
import RoomShape from './RoomShape'
import { FLOORS, type PlanRoom } from '@/data/floors'
import type { Office } from '@/lib/offices'
import { STATUS_LABEL, formatArea, priceLabel } from '@/lib/offices'
import { track } from '@/lib/analytics'
import { IconFit, IconMinus, IconPlus } from '@/components/Icons'

const MIN_SCALE = 1
const MAX_SCALE = 4

type Props = {
  floor: 2 | 3
  offices: Office[]
  selectedId: string | null
  onSelect: (office: Office) => void
}

/** Интерактивная схема этажа: подложка и контуры помещений — из исходных схем. */
export default function FloorPlan({ floor, offices, selectedId, onSelect }: Props) {
  const plan = FLOORS[floor]
  const officeByRoom = new Map<string, Office>()
  for (const office of offices) for (const id of office.svgRoomIds) officeByRoom.set(id, office)

  const [hover, setHover] = useState<{ room: PlanRoom; office?: Office } | null>(null)
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 })
  const box = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)
  const pinch = useRef<{ dist: number; scale: number } | null>(null)

  const clamp = (v: { scale: number; x: number; y: number }) => {
    const limit = (v.scale - 1) / (2 * v.scale)
    return { scale: v.scale, x: Math.max(-limit, Math.min(limit, v.x)), y: Math.max(-limit, Math.min(limit, v.y)) }
  }
  const zoomBy = (d: number) =>
    setView(v => clamp({ ...v, scale: Math.min(MAX_SCALE, Math.max(MIN_SCALE, +(v.scale + d).toFixed(2))) }))

  function onPointerDown(e: React.PointerEvent) {
    if (view.scale === 1) return
    drag.current = { x: e.clientX, y: e.clientY, ox: view.x, oy: view.y }
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current || !box.current) return
    const rect = box.current.getBoundingClientRect()
    setView(v => clamp({
      ...v,
      x: drag.current!.ox + (e.clientX - drag.current!.x) / rect.width / v.scale,
      y: drag.current!.oy + (e.clientY - drag.current!.y) / rect.height / v.scale,
    }))
  }
  function onTouchMove(e: React.TouchEvent) {
    if (e.touches.length !== 2) return
    const [a, b] = [e.touches[0], e.touches[1]]
    const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
    if (!pinch.current) { pinch.current = { dist, scale: view.scale }; return }
    const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, pinch.current.scale * (dist / pinch.current.dist)))
    setView(v => clamp({ ...v, scale: +next.toFixed(2) }))
  }

  const select = (office: Office) => { track('office_selected_on_map', { office: office.number, floor }); onSelect(office) }
  const available = offices.filter(o => o.status === 'available').length
  const reserved = offices.filter(o => o.status === 'reserved').length
  const occupied = offices.filter(o => o.status === 'occupied').length

  return (
    <div className="card overflow-hidden">
      <div className="relative">
        {/* Управление масштабом — поверх схемы, как в макете */}
        <div className="absolute left-3 top-3 z-20 grid overflow-hidden rounded-xl border border-line bg-paper shadow-soft">
          <button type="button" onClick={() => zoomBy(0.5)} disabled={view.scale >= MAX_SCALE}
            className="grid h-10 w-10 place-items-center transition-colors hover:bg-surface disabled:opacity-35" aria-label="Увеличить">
            <IconPlus className="h-5 w-5" />
          </button>
          <button type="button" onClick={() => zoomBy(-0.5)} disabled={view.scale <= MIN_SCALE}
            className="grid h-10 w-10 place-items-center border-t border-line transition-colors hover:bg-surface disabled:opacity-35" aria-label="Уменьшить">
            <IconMinus className="h-5 w-5" />
          </button>
          <button type="button" onClick={() => setView({ scale: 1, x: 0, y: 0 })}
            className="grid h-10 w-10 place-items-center border-t border-line transition-colors hover:bg-surface" aria-label="Показать этаж целиком">
            <IconFit className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-x-auto lg:overflow-visible">
          <div
            ref={box}
            className="relative min-w-[720px] overflow-hidden bg-white lg:min-w-0"
            style={{ aspectRatio: `${plan.cropViewBox.split(' ')[2]} / ${plan.cropViewBox.split(' ')[3]}`, touchAction: 'pan-y' }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={() => { drag.current = null }}
            onPointerCancel={() => { drag.current = null }}
            onTouchMove={onTouchMove}
            onTouchEnd={() => { pinch.current = null }}
          >
            <div className="absolute inset-0 origin-center transition-transform duration-200"
              style={{ transform: `scale(${view.scale}) translate(${view.x * 100}%, ${view.y * 100}%)` }}>
              <svg viewBox={plan.cropViewBox} className="absolute inset-0 h-full w-full"
                aria-label={`Интерактивная схема ${floor} этажа бизнес-центра «Маяк»`}>
                <image href={plan.image} x={0} y={0} width={plan.width} height={plan.height} />
                {plan.rooms.map(room => (
                  <RoomShape
                    key={room.id}
                    room={room}
                    office={officeByRoom.get(room.id)}
                    selected={!!selectedId && officeByRoom.get(room.id)?.id === selectedId}
                    onSelect={select}
                    onHover={(r, o) => setHover(r ? { room: r, office: o } : null)}
                  />
                ))}
              </svg>
            </div>

            {hover?.office && (() => {
              const [vx, vy, vw, vh] = plan.cropViewBox.split(' ').map(Number)
              const left = ((hover.room.bbox.x + hover.room.bbox.w / 2 - vx) / vw) * 100
              const top = ((hover.room.bbox.y - vy) / vh) * 100
              const bottom = ((hover.room.bbox.y + hover.room.bbox.h - vy) / vh) * 100
              // у помещений верхнего ряда подсказка не помещается сверху — показываем её снизу
              const above = top > 24
              return (
                <div
                  className={`pointer-events-none absolute z-10 hidden -translate-x-1/2 whitespace-nowrap rounded-xl bg-brand-2 px-3 py-2 text-white shadow-panel lg:block ${
                    above ? '-translate-y-[calc(100%+8px)]' : 'translate-y-2'
                  }`}
                  style={{ left: `${Math.min(88, Math.max(12, left))}%`, top: `${above ? top : bottom}%` }}
                >
                  <div className="text-sm font-bold">Офис №{hover.office.number}</div>
                  <div className="text-xs text-white/75">{formatArea(hover.office.area)} · {priceLabel(hover.office)}</div>
                  <div className="text-xs text-white/55">{STATUS_LABEL[hover.office.status]}</div>
                </div>
              )
            })()}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-7 gap-y-2 border-t border-line px-4 py-4 text-[15px]">
        <span className="flex items-center gap-2"><i className="h-3 w-3 rounded-full bg-free" aria-hidden />Свободно{available ? `: ${available}` : ''}</span>
        <span className="flex items-center gap-2"><i className="h-3 w-3 rounded-full border border-line bg-surface-2" aria-hidden />Занято: {occupied}</span>
        <span className="flex items-center gap-2"><i className="h-3 w-3 rounded-full bg-hold-bg" aria-hidden />Забронировано{reserved ? `: ${reserved}` : ''}</span>
        <span className="ml-auto hidden text-sm text-muted lg:block">Нажмите на помещение — покажем площадь, статус и фотографии</span>
      </div>
    </div>
  )
}
