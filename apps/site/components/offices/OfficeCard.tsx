'use client'

import Image from 'next/image'
import Link from 'next/link'
import type { Office } from '@/lib/offices'
import { STATUS_LABEL, STATUS_STYLE, formatArea, officeAlt, priceLabel } from '@/lib/offices'

/** Карточка помещения: фотография офиса, площадь, этаж и стоимость. */
export default function OfficeCard({ office, onShowOnPlan }: { office: Office; onShowOnPlan?: (office: Office) => void }) {
  const cover = office.photos[0]

  return (
    <article className="card flex h-full flex-col overflow-hidden transition-shadow duration-200 hover:shadow-soft">
      <Link href={`/offices/${office.id}`} className="relative block aspect-[4/3] bg-surface">
        {cover ? (
          <Image src={cover} alt={officeAlt(office)} fill loading="lazy"
            sizes="(max-width: 640px) 90vw, (max-width: 1280px) 45vw, 300px" className="object-cover" />
        ) : (
          <span className="absolute inset-0 grid place-items-center px-4 text-center text-sm text-muted">
            Фотографии готовятся
          </span>
        )}
        <span className={`absolute bottom-3 left-3 status-chip ${STATUS_STYLE[office.status].chip}`}>
          {STATUS_LABEL[office.status]}
        </span>
      </Link>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-[17px] font-bold">№ {office.number}</h3>
          <span className="text-sm text-muted">{office.floor} этаж</span>
        </div>

        <div className="mt-2 text-[28px] font-extrabold leading-none tracking-tight">{formatArea(office.area)}</div>
        <div className="mt-2 text-[15px] text-ink-2">{priceLabel(office)}</div>

        <div className="mt-5 flex gap-2">
          {onShowOnPlan && office.svgRoomIds.length > 0 && (
            <button type="button" onClick={() => onShowOnPlan(office)} className="btn btn-secondary btn-sm flex-1">
              На плане
            </button>
          )}
          <Link href={`/offices/${office.id}`} className="btn btn-secondary btn-sm flex-1">Подробнее</Link>
        </div>
      </div>
    </article>
  )
}
