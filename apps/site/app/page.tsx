import Image from 'next/image'
import Link from 'next/link'
import Hero from '@/components/Hero'
import LeadForm from '@/components/LeadForm'
import {
  IconArrow, IconCar, IconClimate, IconDoc, IconLift, IconPin, IconRuble, IconShield, IconWifi,
} from '@/components/Icons'
import OfficeCard from '@/components/offices/OfficeCard'
import OfficeSearch from '@/components/offices/OfficeSearch'
import { ADVANTAGES, FAQ, SERVICES, TRUST, type AdvantageIcon } from '@/lib/content'
import { getAvailableOffices, getOffices } from '@/lib/offices'
import { SITE } from '@/lib/site'
import PhoneLink from '@/components/PhoneLink'

const ADVANTAGE_ICON: Record<AdvantageIcon, (p: { className?: string }) => React.ReactElement> = {
  pin: IconPin, car: IconCar, wifi: IconWifi, climate: IconClimate,
  lift: IconLift, shield: IconShield, doc: IconDoc, ruble: IconRuble,
}

export default function HomePage() {
  const offices = getOffices()
  const availableAll = getAvailableOffices()
  const available = availableAll.slice(0, 4)
  const occupied = offices.length - availableAll.length

  return (
    <>
      <Hero />

      {/* ─── Полоса доверия ───────────────────────────────────────────── */}
      <div className="border-b border-line bg-surface">
        <div className="wrap grid divide-y divide-line sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x">
          {TRUST.map((item, i) => (
            <div key={item.title} className={`py-5 lg:px-8 ${i === 0 ? 'lg:pl-0' : ''}`}>
              <strong className="block text-[16px]">{item.title}</strong>
              <span className="text-[15px] text-muted">{item.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Заполняемость: честные цифры из каталога ─────────────────── */}
      <section className="border-b border-line bg-paper py-10">
        <div className="wrap grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
          <dl className="grid grid-cols-2 gap-6 sm:grid-cols-4">
            {[
              [`${offices.length}`, 'помещений на 2 и 3 этажах'],
              [`${occupied}`, 'уже арендованы'],
              [`${availableAll.length}`, availableAll.length === 1 ? 'свободно сейчас' : 'свободны сейчас'],
              ['3 000 м²', 'площадь бизнес-центра'],
            ].map(([value, label]) => (
              <div key={label}>
                <dd className="text-[30px] font-extrabold leading-none tracking-tight">{value}</dd>
                <dt className="mt-1.5 text-[14px] leading-snug text-muted">{label}</dt>
              </div>
            ))}
          </dl>
          <p className="max-w-sm text-[15px] text-ink-2 lg:border-l lg:border-line lg:pl-8">
            В здании работают центр госуслуг «Мои документы», кафе и банкоматы — поток посетителей
            идёт каждый день. Свободные помещения появляются нечасто.
          </p>
        </div>
      </section>

      {/* ─── Свободные офисы ──────────────────────────────────────────── */}
      <section id="offices" className="py-14 lg:py-16">
        <div className="wrap">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="kicker">Свободные офисы</div>
              <h2 className="h2 mt-2">Актуальные предложения</h2>
            </div>
            <Link href="/offices" className="flex items-center gap-2 text-[15px] font-bold underline-offset-4 hover:underline">
              Смотреть все офисы <IconArrow className="h-5 w-5" />
            </Link>
          </div>

          {available.length > 0 ? (
            <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {available.map(office => <OfficeCard key={office.id} office={office} />)}
            </div>
          ) : (
            <div className="card mt-7 p-8 text-center">
              <h3 className="h3">Сейчас все помещения заняты</h3>
              <p className="mx-auto mt-2 max-w-md text-[15px] text-ink-2">
                Офисы освобождаются регулярно. Оставьте телефон — сообщим первому, как только появится
                подходящий вариант.
              </p>
              <div className="mx-auto mt-5 max-w-sm text-left">
                <LeadForm source="home_empty" variant="waitlist" compact />
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ─── План помещений ───────────────────────────────────────────── */}
      <section id="plans" className="border-y border-line bg-surface py-14 lg:py-16">
        <div className="wrap">
          <div className="kicker">Выберите этаж</div>
          <h2 className="h2 mt-2">План помещений</h2>
          <div className="mt-7">
            <OfficeSearch offices={offices} showFilters={false} showModes={false} compact />
          </div>
        </div>
      </section>

      {/* ─── Почему выбирают «Маяк» ───────────────────────────────────── */}
      <section id="advantages" className="py-14 lg:py-16">
        <div className="wrap">
          <div className="kicker">Почему выбирают «Маяк»</div>
          <div className="mt-7 grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
            {ADVANTAGES.map(item => {
              const Icon = ADVANTAGE_ICON[item.icon]
              return (
                <div key={item.title} className="flex gap-3">
                  <Icon className="h-7 w-7 shrink-0 text-brand" />
                  <div>
                    <div className="text-[16px] font-bold">{item.title}</div>
                    <div className="mt-1 text-[14px] leading-snug text-muted">{item.text}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ─── Баннер о бизнес-центре ───────────────────────────────────── */}
      <section id="about" className="pb-14 lg:pb-16">
        <div className="wrap grid overflow-hidden rounded-[14px] lg:grid-cols-2">
          <div className="relative min-h-[260px] lg:min-h-[340px]">
            <Image src="/images/building/facade.webp" alt="Фасад бизнес-центра «Маяк»" fill loading="lazy"
              sizes="(max-width: 1024px) 100vw, 620px" className="object-cover" />
          </div>
          <div className="flex flex-col justify-center bg-brand-2 p-8 text-white sm:p-10">
            <h2 className="h2">Бизнес-центр «Маяк»</h2>
            <p className="mt-3 text-[17px] text-white/80">Современное пространство для развития вашего бизнеса</p>
            <p className="mt-5 text-[15px] leading-relaxed text-white/70">
              Трёхэтажное здание площадью около 3 000 м² в центре Дмитрова. Офисы расположены на 2 и 3 этажах,
              все помещения сданы после ремонта и оборудованы кондиционерами. На первом этаже — центр госуслуг
              «Мои документы», кафе и банкоматы.
            </p>
            <Link href="/offices" className="btn btn-primary mt-7 self-start">Выбрать офис</Link>
          </div>
        </div>
      </section>

      {/* ─── Услуги ───────────────────────────────────────────────────── */}
      <section id="services" className="border-t border-line bg-surface py-14 lg:py-16">
        <div className="wrap">
          <div className="kicker">Дополнительно</div>
          <h2 className="h2 mt-2">Услуги для арендаторов</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {SERVICES.map(service => (
              <article key={service.slug} className="card flex h-full flex-col p-6">
                <h3 className="h3">{service.title}</h3>
                <p className="mt-1 text-sm text-brand">{service.short}</p>
                <p className="mt-3 flex-1 text-[15px] text-ink-2">{service.text}</p>
                <Link href="/services" className="btn btn-secondary btn-sm mt-5 self-start">Подробнее</Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Вопросы ──────────────────────────────────────────────────── */}
      <section id="faq" className="py-14 lg:py-16">
        <div className="wrap grid gap-8 lg:grid-cols-[minmax(0,380px)_1fr]">
          <div>
            <div className="kicker">Вопросы</div>
            <h2 className="h2 mt-2">Коротко о главном</h2>
            <p className="mt-3 text-[15px] text-ink-2">
              Не нашли ответ — позвоните, подскажем за минуту.
            </p>
            <PhoneLink place="faq" className="btn btn-secondary mt-5" />
          </div>
          <div className="grid gap-3">
            {FAQ.map(item => (
              <details key={item.q} className="card group p-5 open:bg-surface">
                <summary className="flex cursor-pointer items-center justify-between gap-4 text-[17px] font-bold">
                  {item.q}
                  <span aria-hidden className="text-brand transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 text-[15px] leading-relaxed text-ink-2">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: FAQ.map(item => ({
              '@type': 'Question',
              name: item.q,
              acceptedAnswer: { '@type': 'Answer', text: item.a },
            })),
          }) }}
        />
      </section>

      {/* ─── Расположение ─────────────────────────────────────────────── */}
      <section id="location" className="py-14 lg:py-16">
        <div className="wrap grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_1.3fr]">
          <div>
            <div className="kicker">Расположение</div>
            <h2 className="h2 mt-2">В центре Дмитрова</h2>
            <p className="mt-3 text-[15px] text-ink-2">{SITE.address}</p>
            <p className="mt-2 text-[15px] text-ink-2">
              Рядом — магазины, банки, кафе и транспортные остановки. На первом этаже здания
              работает центр госуслуг «Мои документы».
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a href={SITE.routeUrl} target="_blank" rel="noopener" className="btn btn-primary">Построить маршрут</a>
              <PhoneLink place="location" className="btn btn-secondary">Позвонить</PhoneLink>
            </div>
          </div>
          <div className="overflow-hidden rounded-[14px] border border-line">
            <iframe src={SITE.mapEmbed} title="Карта проезда к бизнес-центру «Маяк»" loading="lazy"
              className="h-[380px] w-full border-0" />
          </div>
        </div>
      </section>

      {/* ─── Заявка ───────────────────────────────────────────────────── */}
      <section id="contacts" className="pb-14 lg:pb-16">
        <div className="wrap">
          <div className="grid gap-8 rounded-[14px] bg-brand-2 p-7 text-white sm:p-10 lg:grid-cols-2">
            <div>
              <div className="kicker text-white/60">Подбор помещения</div>
              <h2 className="h2 mt-2">Хотите посмотреть офис?</h2>
              <p className="mt-3 max-w-md text-[15px] text-white/75">
                Назовите нужную площадь — уточним доступность помещений и согласуем удобное время просмотра.
              </p>
              <dl className="mt-7 grid gap-4 text-[15px]">
                <div>
                  <dt className="text-white/60">Телефон</dt>
                  <dd className="text-lg font-extrabold"><PhoneLink place="home_cta" /></dd>
                </div>
                <div>
                  <dt className="text-white/60">Адрес</dt>
                  <dd className="font-semibold">{SITE.address}</dd>
                </div>
              </dl>
            </div>
            <div className="rounded-[14px] bg-paper p-5 text-ink sm:p-6">
              <LeadForm source="home" submitLabel="Записаться на просмотр" />
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
