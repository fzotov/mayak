'use client'

import { track } from '@/lib/analytics'

export type Filters = {
  areaFrom: string
  areaTo: string
  onlyAvailable: boolean
}

export const DEFAULT_FILTERS: Filters = { areaFrom: '', areaTo: '', onlyAvailable: true }

export default function OfficeFilters({ value, onChange, total }: { value: Filters; onChange: (f: Filters) => void; total: number }) {
  const set = (patch: Partial<Filters>) => {
    track('office_filter_used', patch as Record<string, unknown>)
    onChange({ ...value, ...patch })
  }

  return (
    <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
      <div>
        <div className="mb-2 text-sm text-ink-2">Площадь, м²</div>
        <div className="flex items-center gap-2">
          <input inputMode="numeric" className="field w-24 py-2" placeholder="от" value={value.areaFrom}
            onChange={e => set({ areaFrom: e.target.value.replace(/[^\d]/g, '') })} aria-label="Площадь от" />
          <span className="text-ink-3">—</span>
          <input inputMode="numeric" className="field w-24 py-2" placeholder="до" value={value.areaTo}
            onChange={e => set({ areaTo: e.target.value.replace(/[^\d]/g, '') })} aria-label="Площадь до" />
        </div>
      </div>

      <label className="flex items-center gap-2.5 pb-2.5 text-sm">
        <input type="checkbox" checked={value.onlyAvailable} onChange={e => set({ onlyAvailable: e.target.checked })}
          className="h-4 w-4 accent-[var(--color-brand)]" />
        Только свободные
      </label>

      <div className="ml-auto pb-2.5 text-sm text-ink-3">Найдено: {total}</div>
    </div>
  )
}

export function applyFilters<T extends { area: number; status: string }>(items: T[], f: Filters): T[] {
  const from = f.areaFrom ? Number(f.areaFrom) : null
  const to = f.areaTo ? Number(f.areaTo) : null
  return items.filter(o =>
    (from === null || o.area >= from) &&
    (to === null || o.area <= to) &&
    (!f.onlyAvailable || o.status === 'available'),
  )
}
