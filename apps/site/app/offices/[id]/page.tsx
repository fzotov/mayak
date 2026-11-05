import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import LeadForm from '@/components/LeadForm'
import OfficeLocation from '@/components/offices/OfficeLocation'
import OfficeCard from '@/components/offices/OfficeCard'
import { getAvailableOffices, getOffice, getOffices, STATUS_LABEL, STATUS_STYLE, formatArea, officeAlt, priceLabel } from '@/lib/offices'
import { SITE } from '@/lib/site'
import PhoneLink from '@/components/PhoneLink'

export function generateStaticParams() {
  return getOffices().map(office => ({ id: office.id }))
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const office = getOffice(id)
  if (!office) return {}
  const title = `Офис №${office.number}, ${formatArea(office.area)}, ${office.floor} этаж`
  return {
    title,
    description: `Аренда офиса №${office.number} площадью ${formatArea(office.area)} на ${office.floor} этаже бизнес-центра «Маяк» в Дмитрове. ${STATUS_LABEL[office.status]}. Запись на просмотр: ${SITE.phone}.`,
    alternates: { canonical: `/offices/${office.id}` },
    openGraph: {
      title,
      description: `Аренда офиса в центре Дмитрова, ${formatArea(office.area)}, ${office.floor} этаж.`,
      images: office.photos[0] ? [{ url: office.photos[0] }] : undefined,
    },
  }
}

export default async function OfficePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const office = getOffice(id)
  if (!office) notFound()

  const isAvailable = office.status === 'available'
  const similar = getAvailableOffices()
    .filter(o => o.id !== office.id)
    .sort((a, b) => Math.abs(a.area - office.area) - Math.abs(b.area - office.area))
    .slice(0, 3)

  const specs: [string, string][] = [
    ['Площадь', formatArea(office.area)],
    ['Этаж', String(office.floor)],
    ['Помещение', `№ ${office.number}`],
    ['Статус', STATUS_LABEL[office.status]],
    ['Состояние', 'После ремонта'],
    ['Стоимость', priceLabel(office)],
    ['Кадастровый номер', office.cadastralNumber ?? '—'],
  ]

  const productLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: `Офис №${office.number} в БЦ «Маяк»`,
    description: `Аренда офиса ${formatArea(office.area)} на ${office.floor} этаже бизнес-центра «Маяк», Дмитров.`,
    image: office.photos.map(p => `${SITE.url}${p}`),
    offers: {
      '@type': 'Offer',
      availability: office.status === 'available' ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      ...(office.priceMonthly ? { price: office.priceMonthly, priceCurrency: 'RUB' } : {}),
    },
  }

  return (
    <article className="py-8 lg:py-12">
      <div className="wrap">
        <nav aria-label="Навигационная цепочка" className="text-sm text-muted">
          <Link href="/" className="hover:text-ink">Главная</Link>
          <span className="px-2">/</span>
          <Link href="/offices" className="hover:text-ink">Офисы</Link>
          <span className="px-2">/</span>
          <span className="text-ink">Офис №{office.number}</span>
        </nav>

        <header className="mt-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="h1">Офис №{office.number}</h1>
            <p className="mt-2 text-[17px] text-ink-2">{formatArea(office.area)} · {office.floor} этаж</p>
          </div>
          <span className={`status-chip ${STATUS_STYLE[office.status].chip} text-sm`}>{STATUS_LABEL[office.status]}</span>
        </header>

        <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="grid gap-6">
            {office.photos.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {office.photos.map((src, i) => (
                  <div key={src} className={`relative overflow-hidden rounded-[14px] bg-white ${i === 0 ? 'sm:col-span-2' : ''}`}>
                    <div className={`relative ${i === 0 ? 'aspect-[16/10]' : 'aspect-[4/3]'}`}>
                      <Image src={src} alt={officeAlt(office, i)} fill priority={i === 0} loading={i === 0 ? undefined : 'lazy'}
                        sizes="(max-width: 1024px) 100vw, 700px" className="object-cover" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="card p-8 text-center text-muted">
                Фотографии этого помещения готовятся. Покажем офис на просмотре — запишитесь по телефону {SITE.phone}.
              </div>
            )}

            <section className="card p-6">
              <h2 className="h3">Характеристики</h2>
              <dl className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2">
                {specs.map(([label, value]) => (
                  <div key={label} className="flex items-baseline justify-between gap-4 border-b border-line pb-2">
                    <dt className="text-sm text-muted">{label}</dt>
                    <dd className="text-right font-semibold">{value}</dd>
                  </div>
                ))}
              </dl>
              <ul className="mt-5 grid gap-2 text-[15px] text-ink-2 sm:grid-cols-2">
                {['Свежая отделка после ремонта', 'Кондиционирование и вентиляция', 'Высокоскоростной интернет', 'Охрана и видеонаблюдение', 'Парковка у здания', 'Юридический адрес для арендаторов'].map(f => (
                  <li key={f} className="flex gap-2"><span aria-hidden className="text-free">✓</span>{f}</li>
                ))}
              </ul>
            </section>

            <section className="card p-6">
              <h2 className="h3">Где расположен офис</h2>
              <p className="mt-2 text-[15px] text-ink-2">
                Помещение выделено на плане {office.floor} этажа. Нажмите на соседнее — откроется его страница.
              </p>
              <div className="mt-4">
                <OfficeLocation office={office} />
              </div>
            </section>
          </div>

          <aside className="card p-6 lg:sticky lg:top-28">
            <div className="text-2xl font-extrabold tracking-tight">{priceLabel(office)}</div>
            {isAvailable ? (
              <>
                <p className="mt-1 text-sm text-muted">Точные условия подтвердим по телефону.</p>
                <div className="mt-5">
                  <LeadForm source="office_page" officeNumber={office.number} submitLabel="Записаться на просмотр" />
                </div>
              </>
            ) : (
              <>
                <p className="mt-1 text-sm text-muted">
                  Помещение занято. Оставьте телефон — сообщим первому, когда оно освободится,
                  и предложим похожие свободные офисы.
                </p>
                <div className="mt-5">
                  <LeadForm source="office_page" variant="waitlist" officeNumber={office.number} />
                </div>
              </>
            )}
            <PhoneLink place="office_page" className="btn btn-secondary mt-3 w-full" />
          </aside>
        </div>
      </div>

      {!isAvailable && similar.length > 0 && (
        <section className="wrap mt-12">
          <div className="kicker">Свободно сейчас</div>
          <h2 className="h2 mt-2">Похожие помещения, которые можно занять</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {similar.map(item => <OfficeCard key={item.id} office={item} />)}
          </div>
        </section>
      )}

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productLd) }} />
    </article>
  )
}
