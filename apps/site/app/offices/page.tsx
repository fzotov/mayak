import type { Metadata } from 'next'
import OfficeSearch from '@/components/offices/OfficeSearch'
import { getOffices, getAvailableOffices, formatArea } from '@/lib/offices'

export const metadata: Metadata = {
  title: 'Свободные офисы — планы 2 и 3 этажей',
  description:
    'Каталог офисов бизнес-центра «Маяк» в Дмитрове: интерактивные планы 2 и 3 этажей, площади помещений, фотографии и заявка на просмотр.',
  alternates: { canonical: '/offices' },
}

export default function OfficesPage() {
  const offices = getOffices()
  const available = getAvailableOffices()
  const areas = offices.map(o => o.area)

  return (
    <section className="py-10 lg:py-14">
      <div className="wrap">
        <div className="max-w-3xl">
          <div className="kicker">Каталог помещений</div>
          <h1 className="h1 mt-3">Офисы в бизнес-центре «Маяк»</h1>
          <p className="mt-4 text-[17px] text-ink-2">
            {offices.length} помещений на 2 и 3 этажах, от {formatArea(Math.min(...areas))} до {formatArea(Math.max(...areas))}.
            Сейчас свободно — {available.length}. Выберите офис на плане этажа или в списке.
          </p>
        </div>

        <div className="mt-8">
          <OfficeSearch offices={offices} compact />
        </div>
      </div>
    </section>
  )
}
