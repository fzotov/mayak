import { OFFICES, type Office, type OfficeStatus } from '@/data/offices'

/**
 * Единая точка доступа к помещениям. Сейчас читает статический каталог,
 * позже так же прозрачно заменяется на `fetch('/api/offices')` или Supabase —
 * компоненты об источнике данных не знают.
 */
export function getOffices(): Office[] {
  return OFFICES
}

export function getOffice(id: string): Office | undefined {
  return OFFICES.find(o => o.id === id)
}

export function getOfficesByFloor(floor: 2 | 3): Office[] {
  return OFFICES.filter(o => o.floor === floor)
}

export function getAvailableOffices(): Office[] {
  return OFFICES.filter(o => o.status === 'available').sort((a, b) => a.area - b.area)
}

export const STATUS_LABEL: Record<OfficeStatus, string> = {
  available: 'Свободен',
  occupied: 'Занят',
  reserved: 'Забронирован',
  unavailable: 'Недоступен',
}

/** Цвета статусов берём из дизайн-системы, а не расставляем по компонентам. */
export const STATUS_STYLE: Record<OfficeStatus, { chip: string; fill: string; stroke: string; hover: string }> = {
  available:   { chip: 'bg-free-bg text-free',    fill: 'rgb(30 138 82 / .36)',  stroke: 'rgb(21 105 61)',        hover: 'rgb(30 138 82 / .56)' },
  reserved:    { chip: 'bg-hold-bg text-hold',    fill: 'rgb(176 124 19 / .34)', stroke: 'rgb(140 97 12)',        hover: 'rgb(176 124 19 / .52)' },
  occupied:    { chip: 'bg-surface-2 text-ink-2', fill: 'rgb(16 26 38 / .12)',   stroke: 'rgb(16 26 38 / .38)',   hover: 'rgb(16 26 38 / .22)' },
  unavailable: { chip: 'bg-surface-2 text-muted', fill: 'rgb(16 26 38 / .06)',   stroke: 'rgb(16 26 38 / .18)',   hover: 'rgb(16 26 38 / .12)' },
}

const nf = new Intl.NumberFormat('ru-RU')

export const formatArea = (area: number) => `${nf.format(area).replace('.', ',')} м²`
export const formatMoney = (value: number) => `${nf.format(Math.round(value))} ₽`

/** Цена или честное «по запросу» — выдуманных цифр на сайте нет. */
export function priceLabel(office: Office): string {
  if (office.priceMonthly) return `${formatMoney(office.priceMonthly)} / мес.`
  if (office.pricePerSqm) return `${formatMoney(office.pricePerSqm * office.area)} / мес.`
  return 'Цена по запросу'
}

export function officeAlt(office: Office, index = 0): string {
  return `Офис №${office.number}, ${formatArea(office.area)}, ${office.floor} этаж — фотография ${index + 1}`
}

export function officeAriaLabel(office: Office): string {
  return `Офис ${office.number}, площадь ${formatArea(office.area)}, ${STATUS_LABEL[office.status].toLowerCase()}`
}

export type { Office, OfficeStatus }
