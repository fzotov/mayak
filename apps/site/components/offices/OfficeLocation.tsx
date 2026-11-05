'use client'

import { useRouter } from 'next/navigation'
import FloorPlan from './FloorPlan'
import { getOffices, type Office } from '@/lib/offices'

/**
 * Схема этажа на странице помещения: тот же интерактивный план, что и в каталоге.
 * Текущий офис выделен, клик по соседнему открывает его страницу.
 */
export default function OfficeLocation({ office }: { office: Office }) {
  const router = useRouter()
  const floorOffices = getOffices().filter(o => o.floor === office.floor)

  return (
    <FloorPlan
      floor={office.floor}
      offices={floorOffices}
      selectedId={office.id}
      onSelect={next => { if (next.id !== office.id) router.push(`/offices/${next.id}`) }}
    />
  )
}
