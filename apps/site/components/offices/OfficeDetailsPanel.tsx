'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect } from 'react'
import LeadForm from '@/components/LeadForm'
import { IconChair, IconClimate, IconWifi } from '@/components/Icons'
import type { Office } from '@/lib/offices'
import { STATUS_LABEL, STATUS_STYLE, formatArea, formatMoney, officeAlt } from '@/lib/offices'
import { track } from '@/lib/analytics'

/** Карточка выбранного помещения: справа поверх схемы, на телефоне — нижняя шторка. */
export default function OfficeDetailsPanel({ office, onClose }: { office: Office; onClose: () => void }) {
  useEffect(() => {
    track('office_view', { office: office.number, place: 'panel' })
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', esc)
    return () => document.removeEventListener('keydown', esc)
  }, [office.number, onClose])

  const monthly = office.priceMonthly ?? (office.pricePerSqm ? office.pricePerSqm * office.area : null)
  const rate = office.pricePerSqm ?? (office.priceMonthly ? office.priceMonthly / office.area : null)

  const stats: [string, string][] = [
    [formatArea(office.area), 'Площадь'],
    [monthly ? formatMoney(monthly) : 'По запросу', 'В месяц'],
    [rate ? `${formatMoney(rate)}/м²` : 'По запросу', 'Ставка'],
  ]

  return (
    <>
      <div className="fixed inset-0 z-40 bg-ink/40 lg:hidden" onClick={onClose} aria-hidden />
      <aside
        role="dialog" aria-modal="true" aria-label={`Офис ${office.number}`}
        className="fixed inset-x-0 bottom-0 z-50 max-h-[88vh] overflow-y-auto rounded-t-2xl bg-paper pb-24 shadow-panel
                   lg:static lg:z-auto lg:max-h-none lg:overflow-visible lg:rounded-[14px] lg:border lg:border-line lg:pb-0"
      >
        <div className="relative">
          <div className="relative aspect-[16/10] overflow-hidden rounded-t-2xl bg-surface lg:rounded-t-[13px]">
            {office.photos[0] ? (
              <Image src={office.photos[0]} alt={officeAlt(office)} fill sizes="(max-width: 1024px) 100vw, 360px" className="object-cover" />
            ) : (
              <span className="absolute inset-0 grid place-items-center px-6 text-center text-sm text-muted">
                Фотографии этого помещения готовятся
              </span>
            )}
            <span className={`absolute bottom-3 left-3 status-chip ${STATUS_STYLE[office.status].chip}`}>
              {STATUS_LABEL[office.status]}
            </span>
          </div>
          <button type="button" onClick={onClose} aria-label="Закрыть"
            className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-paper/90 text-ink shadow-soft backdrop-blur">
            ✕
          </button>
        </div>

        <div className="p-5">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-[19px] font-extrabold tracking-tight">Офис № {office.number}</h3>
            <span className="text-sm text-muted">{office.floor} этаж</span>
          </div>

          <dl className="mt-4 grid grid-cols-3 gap-3">
            {stats.map(([value, label]) => (
              <div key={label}>
                <dd className="text-[19px] font-extrabold leading-tight tracking-tight">{value}</dd>
                <dt className="mt-0.5 text-[13px] text-muted">{label}</dt>
              </div>
            ))}
          </dl>

          <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-[14px] text-ink-2">
            <li className="flex items-center gap-2"><IconClimate className="h-5 w-5 text-brand" />Кондиционер</li>
            <li className="flex items-center gap-2"><IconWifi className="h-5 w-5 text-brand" />Интернет</li>
            <li className="flex items-center gap-2"><IconChair className="h-5 w-5 text-brand" />После ремонта</li>
          </ul>

          {office.status === 'available' ? (
            <>
              <a href="#contacts" className="btn btn-primary mt-5 w-full py-4">Записаться на просмотр</a>
              <Link href={`/offices/${office.id}`} className="btn btn-secondary mt-3 w-full py-4">Подробнее об офисе</Link>
            </>
          ) : (
            <>
              <div className="mt-5 rounded-[14px] border border-line bg-surface p-4">
                <div className="text-[15px] font-bold">Помещение занято</div>
                <p className="mt-1 text-[14px] leading-snug text-muted">
                  Оставьте телефон — сообщим первому, когда оно освободится, и предложим похожие варианты.
                </p>
                <div className="mt-3">
                  <LeadForm source="office_panel" variant="waitlist" officeNumber={office.number} compact />
                </div>
              </div>
              <Link href={`/offices/${office.id}`} className="btn btn-secondary mt-3 w-full py-4">Подробнее об офисе</Link>
            </>
          )}
        </div>
      </aside>
    </>
  )
}
