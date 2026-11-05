import type { Metadata } from 'next'
import LeadForm from '@/components/LeadForm'
import { SITE } from '@/lib/site'
import PhoneLink from '@/components/PhoneLink'

export const metadata: Metadata = {
  title: 'Контакты',
  description:
    'Бизнес-центр «Маяк»: Дмитров, мкр. им. Владимира Махалина, д. 20. Телефон +7 (916) 763-02-07, почта info@mayak-d.ru.',
  alternates: { canonical: '/contacts' },
}

export default function ContactsPage() {
  return (
    <section className="py-10 lg:py-14">
      <div className="wrap">
        <div className="max-w-3xl">
          <div className="kicker">Контакты</div>
          <h1 className="h1 mt-3">Приезжайте посмотреть офис</h1>
        </div>

        <div className="mt-9 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_1.25fr]">
          <div className="grid gap-5">
            <div className="card p-6">
              <dl className="grid gap-5 text-[15px]">
                <div>
                  <dt className="text-muted">Телефон</dt>
                  <dd className="text-lg font-extrabold"><PhoneLink place="contacts" /></dd>
                </div>
                <div>
                  <dt className="text-muted">Почта</dt>
                  <dd className="font-semibold"><a href={`mailto:${SITE.email}`}>{SITE.email}</a></dd>
                </div>
                <div>
                  <dt className="text-muted">Адрес</dt>
                  <dd className="font-semibold">{SITE.address}</dd>
                  <dd className="text-muted">Отдел аренды — {SITE.office}. {SITE.hours}</dd>
                </div>
              </dl>
              <a href={SITE.routeUrl} target="_blank" rel="noopener" className="btn btn-primary mt-6 w-full">Построить маршрут</a>
              <a href="/tenant" className="btn btn-secondary mt-3 w-full">Личный кабинет арендатора</a>
            </div>

            <div className="card p-6">
              <h2 className="h3">Хотите посмотреть офис?</h2>
              <div className="mt-4">
                <LeadForm source="contacts" submitLabel="Записаться на просмотр" />
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-[14px] border border-line">
            <iframe src={SITE.mapEmbed} title="Карта проезда к бизнес-центру «Маяк»" loading="lazy"
              className="h-[560px] w-full border-0" />
          </div>
        </div>
      </div>
    </section>
  )
}
