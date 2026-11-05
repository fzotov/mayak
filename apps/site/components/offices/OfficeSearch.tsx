'use client'

import { useMemo, useState } from 'react'
import FloorPlan from './FloorPlan'
import OfficeCard from './OfficeCard'
import OfficeDetailsPanel from './OfficeDetailsPanel'
import LeadForm from '@/components/LeadForm'
import OfficeFilters, { DEFAULT_FILTERS, applyFilters, type Filters } from './OfficeFilters'
import { FLOOR_LIST } from '@/data/floors'
import type { Office } from '@/lib/offices'
import { track } from '@/lib/analytics'

/** Раздел выбора офиса: этаж, режим просмотра, фильтры, схема или список, карточка помещения. */
export default function OfficeSearch({
  offices, initialMode = 'plan', showFilters = true, showModes = true, compact = false,
}: {
  offices: Office[]
  initialMode?: 'plan' | 'list'
  showFilters?: boolean
  /** На главной показываем только схему: переключатель «План / Список» не нужен */
  showModes?: boolean
  /** Компактный вид для главной: схема уже, карточка помещения — колонкой справа */
  compact?: boolean
}) {
  const [floor, setFloor] = useState<'all' | 2 | 3>(2)
  const [mode, setMode] = useState<'plan' | 'list'>(initialMode)
  const [filters, setFilters] = useState<Filters>({ ...DEFAULT_FILTERS, onlyAvailable: false })
  const [selected, setSelected] = useState<Office | null>(null)

  const filtered = useMemo(() => applyFilters(offices, filters), [offices, filters])
  const planFloor: 2 | 3 = floor === 'all' ? 2 : floor
  const planOffices = useMemo(() => filtered.filter(o => o.floor === planFloor), [filtered, planFloor])
  const listOffices = useMemo(
    () => (floor === 'all' ? filtered : filtered.filter(o => o.floor === floor)),
    [filtered, floor],
  )

  const selectFloor = (f: 'all' | 2 | 3) => { track('floor_selected', { floor: f }); setFloor(f); setSelected(null) }
  const showOnPlan = (office: Office) => {
    setMode('plan'); setFloor(office.floor); setSelected(office)
    document.getElementById('plan-view')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-xl border border-line bg-paper p-1" role="tablist" aria-label="Этаж">
          {(mode === 'list' ? (['all', ...FLOOR_LIST] as const) : FLOOR_LIST).map(f => (
            <button key={String(f)} type="button" role="tab" aria-selected={floor === f} onClick={() => selectFloor(f as 'all' | 2 | 3)}
              className={`rounded-lg px-5 py-2.5 text-[15px] font-bold transition-colors ${floor === f ? 'bg-brand-2 text-white' : 'text-ink-2 hover:bg-surface'}`}>
              {f === 'all' ? 'Все этажи' : `${f} этаж`}
            </button>
          ))}
        </div>

        {showModes && <div className="ml-auto flex gap-1 rounded-xl border border-line bg-white p-1">
          {([['plan', 'План этажа'], ['list', 'Список']] as const).map(([v, label]) => (
            <button key={v} type="button" onClick={() => setMode(v)} aria-pressed={mode === v}
              className={`rounded-lg px-4 py-2.5 text-[15px] font-bold transition-colors ${mode === v ? 'bg-brand-2 text-white' : 'text-ink-2 hover:bg-bg'}`}>
              {label}
            </button>
          ))}
        </div>}
      </div>

      {showFilters && <OfficeFilters value={filters} onChange={setFilters} total={mode === 'plan' ? planOffices.length : listOffices.length} />}

      <div
        id="plan-view"
        className={compact
          ? 'grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_360px]'
          : 'relative'}
      >
        {mode === 'plan' ? (
          <FloorPlan floor={planFloor} offices={planOffices} selectedId={selected?.id ?? null} onSelect={setSelected} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {listOffices.map(office => <OfficeCard key={office.id} office={office} onShowOnPlan={showOnPlan} />)}
            {listOffices.length === 0 && (
              <div className="col-span-full rounded-[14px] border border-dashed border-line bg-paper p-8 text-center">
                <h3 className="h3">Под эти условия свободных помещений нет</h3>
                <p className="mx-auto mt-2 max-w-md text-[15px] text-ink-2">
                  Помещения освобождаются регулярно. Оставьте телефон — сообщим первому, как только появится
                  подходящий вариант.
                </p>
                <div className="mx-auto mt-5 max-w-sm text-left">
                  <LeadForm source="catalog_empty" variant="waitlist" compact />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Карточка помещения: колонкой справа в компактном виде, иначе поверх схемы */}
        {selected && (
          <div className={compact
            ? ''
            : 'lg:absolute lg:right-4 lg:top-16 lg:z-30 lg:max-h-[calc(100%-5.5rem)] lg:w-[360px] lg:overflow-y-auto lg:rounded-[14px] lg:shadow-panel'}>
            <OfficeDetailsPanel office={selected} onClose={() => setSelected(null)} />
          </div>
        )}

        {compact && !selected && (
          <aside className="card hidden p-5 lg:block">
            <div className="kicker">Выбранное помещение</div>
            <h3 className="h3 mt-2">Выберите офис на схеме</h3>
            <p className="mt-2 text-[15px] text-ink-2">
              Нажмите на помещение — появятся площадь, статус, фотографии и запись на просмотр.
              Свободные офисы подсвечены зелёным.
            </p>
          </aside>
        )}
      </div>
    </div>
  )
}
