import type { Metadata } from 'next'
import LeadForm from '@/components/LeadForm'
import { SERVICES } from '@/lib/content'
import { SITE } from '@/lib/site'
import PhoneLink from '@/components/PhoneLink'

export const metadata: Metadata = {
  title: 'Услуги для арендаторов',
  description:
    'Офисы после ремонта, юридический адрес и размещение рекламы в бизнес-центре «Маяк» в Дмитрове. Условия и заявка по телефону +7 (916) 763-02-07.',
  alternates: { canonical: '/services' },
}

export default function ServicesPage() {
  return (
    <section className="py-10 lg:py-14">
      <div className="wrap">
        <div className="max-w-3xl">
          <div className="kicker">Дополнительно</div>
          <h1 className="h1 mt-3">Услуги для арендаторов</h1>
          <p className="mt-4 text-[17px] text-ink-2">
            Помимо аренды помещений бизнес-центр предлагает сервисы, которые упрощают ежедневную работу компании.
          </p>
        </div>

        <div className="mt-9 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {SERVICES.map(service => (
            <article key={service.slug} id={service.slug} className="card flex flex-col p-6">
              <h2 className="h3">{service.title}</h2>
              <p className="mt-1 text-sm text-accent">{service.short}</p>
              <p className="mt-4 flex-1 text-[15px] text-ink-2">{service.text}</p>
              <PhoneLink place="service_card" className="btn btn-secondary btn-sm mt-5 self-start">Узнать условия</PhoneLink>
            </article>
          ))}
        </div>

        <div className="mt-12 grid gap-8 rounded-[14px] bg-brand-2 p-7 text-white sm:p-10 lg:grid-cols-2">
          <div>
            <h2 className="h2">Нужна консультация?</h2>
            <p className="mt-3 text-[15px] text-white/75">
              Расскажите о задаче — подберём помещение и подходящий набор услуг.
            </p>
            <p className="mt-6 text-lg font-extrabold"><PhoneLink place="services" /></p>
          </div>
          <div className="rounded-[14px] bg-white p-5 text-ink sm:p-6">
            <LeadForm source="services" submitLabel="Отправить заявку" />
          </div>
        </div>
      </div>
    </section>
  )
}
