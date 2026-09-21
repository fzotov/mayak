import { useMemo, useState } from 'react'
import './site.css'
import LeadForm from './LeadForm'
import PublicFloorPlan from './PublicFloorPlan'
import UnitModal from './UnitModal'
import { useSiteUnits, type PublicUnit } from './useSiteUnits'
import {
  CONTACTS, ENGINEERING, FACTS, FAQ, INCLUDED, INFRA, SERVICES, STEPS, fmtArea, fmtMoney, fmtNumber,
} from './siteConfig'

const NAV = [
  { id: 'free',     label: 'Свободные офисы' },
  { id: 'plan',     label: 'План этажей' },
  { id: 'included', label: 'Что входит' },
  { id: 'services', label: 'Услуги' },
  { id: 'contacts', label: 'Контакты' },
]

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

export default function SiteApp() {
  const { units, free, loading, minRate, minArea, maxArea } = useSiteUnits()
  const [picked, setPicked] = useState<PublicUnit | null>(null)
  const [menu, setMenu] = useState(false)

  const go = (id: string) => { setMenu(false); scrollTo(id) }

  return (
    <div className="site">
      <Header onNav={go} onBurger={() => setMenu(true)} />
      {menu && <MobileNav onNav={go} onClose={() => setMenu(false)} />}

      <Hero freeCount={free.length} loading={loading} minRate={minRate} minArea={minArea} maxArea={maxArea} onNav={go} />

      <div className="wrap">
        <div className="facts">
          {FACTS.map(f => (
            <div className="facts__i" key={f.label}>
              <div className="facts__v">{f.value}</div>
              <div className="facts__l">{f.label}</div>
            </div>
          ))}
        </div>
      </div>

      <FreeUnits units={free} loading={loading} onPick={setPicked} />
      <PlanSection units={units} onPick={setPicked} />
      <Included />
      <Calculator minRate={minRate} freeUnits={free} />
      <Engineering />
      <Services />
      <Steps />
      <Faq />
      <CtaSection />
      <Contacts />
      <Footer onNav={go} />

      <div className="fab">
        <a className="fab__wa" href={CONTACTS.whatsapp} target="_blank" rel="noopener" aria-label="Написать в WhatsApp">✆</a>
      </div>
      <div className="mobile-cta">
        <a className="btn btn--dark" href={`tel:${CONTACTS.phoneHref}`}>Позвонить</a>
        <button className="btn btn--primary" onClick={() => go('cta')}>Подобрать офис</button>
      </div>

      {picked && <UnitModal unit={picked} onClose={() => setPicked(null)} />}
    </div>
  )
}

/* ─── Шапка ──────────────────────────────────────────────────────────────── */

function Header({ onNav, onBurger }: { onNav: (id: string) => void; onBurger: () => void }) {
  return (
    <header className="hdr">
      <div className="wrap hdr__in">
        <a className="hdr__logo" href="/">
          <img src="/logo.png" alt="Бизнес-центр «Маяк»" className="hdr__img" />
          <div className="hdr__sub">Аренда офисов<br />в Дмитрове</div>
        </a>
        <nav className="hdr__nav">
          {NAV.map(n => <button key={n.id} onClick={() => onNav(n.id)}>{n.label}</button>)}
        </nav>
        <div className="hdr__right">
          <a className="hdr__cab" href="/tenant">Личный кабинет</a>
          <a className="hdr__phone" href={`tel:${CONTACTS.phoneHref}`}>{CONTACTS.phone}</a>
          <button className="btn btn--primary btn--sm" onClick={() => onNav('cta')}>Оставить заявку</button>
          <button className="burger" onClick={onBurger} aria-label="Меню">☰</button>
        </div>
      </div>
    </header>
  )
}

function MobileNav({ onNav, onClose }: { onNav: (id: string) => void; onClose: () => void }) {
  return (
    <div className="mnav">
      <div className="mnav__top">
        <div className="hdr__name">БЦ «Маяк»</div>
        <button className="modal__x" style={{ marginLeft: 'auto' }} onClick={onClose} aria-label="Закрыть">✕</button>
      </div>
      {NAV.map(n => <button key={n.id} className="mnav__link" onClick={() => onNav(n.id)}>{n.label}</button>)}
      <a className="mnav__link" href="/tenant" style={{ padding: '14px 0', fontSize: 19, fontWeight: 700 }}>Личный кабинет арендатора</a>
      <a className="btn btn--primary btn--full" style={{ marginTop: 16 }} href={`tel:${CONTACTS.phoneHref}`}>{CONTACTS.phone}</a>
      <a className="btn btn--ghost btn--full" href={CONTACTS.whatsapp} target="_blank" rel="noopener">Написать в WhatsApp</a>
    </div>
  )
}

/* ─── Первый экран ───────────────────────────────────────────────────────── */

function Hero({ freeCount, loading, minRate, minArea, maxArea, onNav }: {
  freeCount: number; loading: boolean; minRate: number | null; minArea: number | null; maxArea: number | null
  onNav: (id: string) => void
}) {
  const areaRange = minArea && maxArea ? `${Math.round(minArea)}–${Math.round(maxArea)} м²` : '10–45 м²'
  return (
    <section className="hero">
      <div className="hero__bg" style={{ backgroundImage: 'url(/site/building.jpg)' }} />
      <div className="wrap hero__in">
        <div className="hero__badge">
          <span className="hero__dot" />
          {loading ? 'Проверяем свободные помещения…'
            : freeCount > 0 ? `Сейчас свободно ${freeCount} ${plural(freeCount, 'офис', 'офиса', 'офисов')} — статус обновляется онлайн`
            : 'Все офисы заняты — записываем в лист ожидания'}
        </div>
        <h1>Аренда офисов в центре Дмитрова</h1>
        <p className="hero__sub">
          Бизнес-центр «Маяк»: офисы {areaRange} с ремонтом, кондиционером и охраной.
          Коммунальные услуги — в ставке, интернет и юридический адрес — бесплатно.
          Прямая аренда от собственника, без комиссий.
        </p>
        <div className="hero__cta">
          <button className="btn btn--primary" onClick={() => onNav('free')}>Смотреть свободные офисы</button>
          <a className="btn btn--light" href={`tel:${CONTACTS.phoneHref}`}>{CONTACTS.phone}</a>
        </div>
        <div className="hero__chips">
          <span className="chip">🏛 МФЦ «Мои документы» в здании</span>
          <span className="chip">🅿️ Своя парковка</span>
          <span className="chip">📄 Юр. адрес бесплатно</span>
          <span className="chip">⚡️ Заезд за 1 день</span>
        </div>
        {minRate && <div className="hero__note">Ставки от {fmtMoney(minRate)} за м² в месяц, коммунальные услуги включены.</div>}
      </div>
    </section>
  )
}

const plural = (n: number, one: string, few: string, many: string) => {
  const m10 = n % 10, m100 = n % 100
  if (m10 === 1 && m100 !== 11) return one
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few
  return many
}

/* ─── Свободные офисы ────────────────────────────────────────────────────── */

function FreeUnits({ units, loading, onPick }: { units: PublicUnit[]; loading: boolean; onPick: (u: PublicUnit) => void }) {
  const [floor, setFloor] = useState<'all' | 2 | 3>('all')
  const [size, setSize] = useState<'all' | 's' | 'm' | 'l'>('all')

  const shown = units
    .filter(u => floor === 'all' || u.floor === floor)
    .filter(u => size === 'all' || (size === 's' && u.area < 15) || (size === 'm' && u.area >= 15 && u.area < 25) || (size === 'l' && u.area >= 25))
    .sort((a, b) => a.area - b.area)

  return (
    <section className="section" id="free">
      <div className="wrap">
        <div className="section__head">
          <div className="eyebrow">Свободно сейчас</div>
          <h2 className="h2">Офисы, которые можно занять на этой неделе</h2>
          <p className="lead">
            Статусы приходят напрямую из системы управления зданием — на сайте нет «уже сданных» вариантов.
            Нажмите на офис, чтобы посмотреть фото, видео и записаться на просмотр.
          </p>
        </div>

        <div className="filters">
          <div className="filters__group">
            {([['all', 'Все этажи'], [2, '2 этаж'], [3, '3 этаж']] as const).map(([v, l]) => (
              <button key={String(v)} className={floor === v ? 'is-on' : ''} onClick={() => setFloor(v as any)}>{l}</button>
            ))}
          </div>
          <div className="filters__group">
            {([['all', 'Любая площадь'], ['s', 'до 15 м²'], ['m', '15–25 м²'], ['l', 'от 25 м²']] as const).map(([v, l]) => (
              <button key={v} className={size === v ? 'is-on' : ''} onClick={() => setSize(v as any)}>{l}</button>
            ))}
          </div>
          <div className="filters__count">{loading ? 'Загружаем…' : `Найдено: ${shown.length}`}</div>
        </div>

        {!loading && shown.length === 0 ? (
          <div className="empty">
            <div style={{ fontSize: 30, marginBottom: 10 }}>📋</div>
            <h3 className="h3">Под этот фильтр сейчас нет свободных офисов</h3>
            <p className="muted" style={{ marginTop: 8, marginBottom: 18 }}>
              Помещения освобождаются регулярно. Оставьте номер — сообщим первому, как только появится подходящий вариант,
              и покажем то, что освобождается в ближайший месяц.
            </p>
            <div style={{ maxWidth: 380, margin: '0 auto' }}>
              <LeadForm source="free-empty" submitLabel="Сообщить о свободном офисе" />
            </div>
          </div>
        ) : (
          <div className="cards">
            {shown.map(u => <UnitCard key={u.key} unit={u} onPick={onPick} />)}
          </div>
        )}
      </div>
    </section>
  )
}

function UnitCard({ unit, onPick }: { unit: PublicUnit; onPick: (u: PublicUnit) => void }) {
  const cover = unit.photos[0]
  return (
    <article className="card">
      <div className="card__media" onClick={() => onPick(unit)} style={{ cursor: 'pointer' }}>
        {cover
          ? <img src={cover} alt={`Офис №${unit.number}, ${unit.area} м²`} loading="lazy" />
          : <div className="card__ph"><span>🏢</span>Фото по запросу</div>}
        <div className="card__tag">Свободен</div>
        {(unit.photos.length > 1 || unit.video) && (
          <div className="card__count">{unit.photos.length} фото{unit.video ? ' · видео' : ''}</div>
        )}
      </div>
      <div className="card__body">
        <div className="card__title">Офис №{fmtNumber(unit.number)}</div>
        <div className="card__meta">{unit.floor} этаж · {fmtArea(unit.area)}{unit.rate ? ` · ${fmtMoney(unit.rate)}/м²` : ''}</div>
        <div className="card__price">
          {unit.monthly
            ? <><b>{fmtMoney(unit.monthly)}</b> <span>/ мес. с КУ</span></>
            : <><b>Цена по запросу</b> <span>— назовём при звонке</span></>}
        </div>
        <div className="card__actions">
          <button className="btn btn--primary btn--sm" onClick={() => onPick(unit)}>Смотреть офис</button>
        </div>
      </div>
    </article>
  )
}

/* ─── План этажей ────────────────────────────────────────────────────────── */

function PlanSection({ units, onPick }: { units: PublicUnit[]; onPick: (u: PublicUnit) => void }) {
  return (
    <section className="section section--warm" id="plan">
      <div className="wrap">
        <div className="section__head">
          <div className="eyebrow">Интерактивный план</div>
          <h2 className="h2">Посмотрите здание изнутри — этаж за этажом</h2>
          <p className="lead">
            Реальная планировка 2 и 3 этажей с площадями помещений. Зелёным отмечено то, что свободно прямо сейчас.
          </p>
        </div>
        <PublicFloorPlan units={units} onPick={onPick} />
      </div>
    </section>
  )
}

/* ─── Что входит ─────────────────────────────────────────────────────────── */

function Included() {
  return (
    <section className="section" id="included">
      <div className="wrap">
        <div className="section__head">
          <div className="eyebrow">Прозрачные условия</div>
          <h2 className="h2">Что уже включено в ставку</h2>
          <p className="lead">Никаких скрытых платежей: отдельно оплачиваются только электроэнергия по счётчику и клининг помещения.</p>
        </div>
        <div className="grid-4">
          {INCLUDED.map(i => (
            <div className="tile" key={i.title}>
              <div className="tile__icon">{i.icon}</div>
              <h3 className="h3">{i.title}</h3>
              <p>{i.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─── Калькулятор ────────────────────────────────────────────────────────── */

function Calculator({ minRate, freeUnits }: { minRate: number | null; freeUnits: PublicUnit[] }) {
  const rates = freeUnits.map(u => u.rate).filter((r): r is number => r !== null)
  const avgRate = rates.length ? Math.round(rates.reduce((a, b) => a + b, 0) / rates.length) : minRate
  const [area, setArea] = useState(20)
  const rate = avgRate
  const rent = rate ? rate * area : null
  const closest = useMemo(
    () => [...freeUnits].sort((a, b) => Math.abs(a.area - area) - Math.abs(b.area - area))[0],
    [freeUnits, area],
  )

  return (
    <section className="section section--warm" id="calc">
      <div className="wrap">
        <div className="section__head">
          <div className="eyebrow">Расчёт за 10 секунд</div>
          <h2 className="h2">Сколько будет стоить ваш офис</h2>
          <p className="lead">Подвиньте ползунок — покажем ориентировочный платёж и ближайший свободный вариант.</p>
        </div>

        <div className="calc">
          <div>
            <div className="calc__row">
              <div className="calc__label"><span>Нужная площадь</span><b>{fmtArea(area)}</b></div>
              <input type="range" min={10} max={45} step={1} value={area} onChange={e => setArea(Number(e.target.value))} />
            </div>
            <div className="calc__row">
              <div className="calc__label"><span>Сотрудников в офисе</span><b>≈ {Math.max(1, Math.floor(area / 5))}</b></div>
              <div className="muted" style={{ fontSize: 14 }}>Из расчёта 5 м² рабочего пространства на человека.</div>
            </div>
            {closest && (
              <div className="tile tile--warm" style={{ marginTop: 18 }}>
                <div className="muted" style={{ fontSize: 13 }}>Ближайший свободный вариант</div>
                <div className="h3" style={{ marginTop: 4 }}>Офис №{fmtNumber(closest.number)} · {fmtArea(closest.area)} · {closest.floor} этаж</div>
              </div>
            )}
          </div>

          <div className="calc__out">
            <div>
              <div style={{ fontSize: 14, color: 'rgba(255,255,255,.7)' }}>Ориентировочно в месяц</div>
              <div className="calc__sum">{rent ? fmtMoney(rent) : 'Рассчитаем при звонке'}</div>
            </div>
            {rate && <div className="calc__line"><span>Ставка</span><span>{fmtMoney(rate)} / м²</span></div>}
            <div className="calc__line"><span>Коммунальные услуги</span><span>включены</span></div>
            <div className="calc__line"><span>Интернет</span><span>бесплатно</span></div>
            <div className="calc__line"><span>Электроэнергия</span><span>по счётчику</span></div>
            <a className="btn btn--primary btn--full" href="#cta" onClick={e => { e.preventDefault(); scrollTo('cta') }}>
              Зафиксировать условия
            </a>
            <div className="calc__note">
              Расчёт ориентировочный: точную ставку по конкретному помещению назовём при звонке — она зависит от площади, этажа и срока договора.
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ─── Инженерия и инфраструктура ─────────────────────────────────────────── */

function Engineering() {
  return (
    <section className="section" id="building">
      <div className="wrap">
        <div className="section__head">
          <div className="eyebrow">О бизнес-центре</div>
          <h2 className="h2">Здание, в которое не стыдно приглашать клиентов</h2>
          <p className="lead">
            Трёхэтажный бизнес-центр площадью 3 000 м² в центре Дмитрова. Современные инженерные системы,
            собственная парковка и постоянный поток посетителей.
          </p>
        </div>

        <div className="grid-3" style={{ marginBottom: 18 }}>
          {INFRA.map(i => (
            <div className="tile tile--warm" key={i.title}>
              <div className="tile__icon">{i.icon}</div>
              <h3 className="h3">{i.title}</h3>
              <p>{i.text}</p>
            </div>
          ))}
        </div>

        <div className="grid-3">
          {ENGINEERING.map(i => (
            <div className="tile" key={i.title}>
              <h3 className="h3">{i.title}</h3>
              <p>{i.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─── Услуги ─────────────────────────────────────────────────────────────── */

function Services() {
  return (
    <section className="section section--warm" id="services">
      <div className="wrap">
        <div className="section__head">
          <div className="eyebrow">Дополнительно</div>
          <h2 className="h2">Услуги для арендаторов</h2>
        </div>
        <div className="grid-4">
          {SERVICES.map(s => (
            <div className="tile" key={s.title}>
              <div className="tile__icon">{s.icon}</div>
              <h3 className="h3">{s.title}</h3>
              <p>{s.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─── Как заехать ────────────────────────────────────────────────────────── */

function Steps() {
  return (
    <section className="section">
      <div className="wrap">
        <div className="section__head">
          <div className="eyebrow">Как заехать</div>
          <h2 className="h2">От заявки до ключей — один-два дня</h2>
        </div>
        <div className="grid-4">
          {STEPS.map(s => (
            <div className="step" key={s.n}>
              <div className="step__n">{s.n}</div>
              <h3 className="h3">{s.title}</h3>
              <p style={{ color: 'var(--ink-2)', fontSize: 15, marginTop: 6 }}>{s.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─── FAQ ────────────────────────────────────────────────────────────────── */

function Faq() {
  const [open, setOpen] = useState<number | null>(0)
  return (
    <section className="section section--warm" id="faq">
      <div className="wrap">
        <div className="section__head">
          <div className="eyebrow">Вопросы</div>
          <h2 className="h2">Что обычно спрашивают</h2>
        </div>
        <div className="faq">
          {FAQ.map((f, i) => (
            <div className="faq__i" key={f.q}>
              <button className="faq__q" onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i}>
                {f.q}<i>{open === i ? '−' : '+'}</i>
              </button>
              {open === i && <div className="faq__a">{f.a}</div>}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─── Заявка ─────────────────────────────────────────────────────────────── */

function CtaSection() {
  return (
    <section className="section" id="cta">
      <div className="wrap">
        <div className="cta">
          <div>
            <h2>Подберём офис под вашу задачу</h2>
            <p>
              Оставьте номер — перезвоним в рабочее время, пришлём подборку свободных помещений с ценами и фотографиями
              и запишем на просмотр в удобное время. Прямая аренда от собственника, без комиссий и посредников.
            </p>
            <div className="hero__chips" style={{ marginTop: 22 }}>
              <span className="chip">Ответим в течение рабочего дня</span>
              <span className="chip">Покажем офис лично</span>
            </div>
          </div>
          <div>
            <LeadForm source="cta" withMessage submitLabel="Получить подборку и цены" />
          </div>
        </div>
      </div>
    </section>
  )
}

/* ─── Контакты ───────────────────────────────────────────────────────────── */

function Contacts() {
  return (
    <section className="section section--warm" id="contacts">
      <div className="wrap">
        <div className="section__head">
          <div className="eyebrow">Контакты</div>
          <h2 className="h2">Приезжайте посмотреть</h2>
        </div>
        <div className="contacts">
          <div className="contacts__card">
            <div className="contacts__row">
              <span className="muted">Телефоны</span>
              <b><a href={`tel:${CONTACTS.phoneHref}`}>{CONTACTS.phone}</a></b>
              <b><a href={`tel:${CONTACTS.phone2Href}`}>{CONTACTS.phone2}</a></b>
            </div>
            <div className="contacts__row">
              <span className="muted">Почта</span>
              <b><a href={`mailto:${CONTACTS.email}`}>{CONTACTS.email}</a></b>
            </div>
            <div className="contacts__row">
              <span className="muted">Адрес</span>
              <b>{CONTACTS.address}</b>
              <span className="muted">Отдел аренды — {CONTACTS.office}. {CONTACTS.hours}</span>
            </div>
            <a className="btn btn--primary btn--full" href={CONTACTS.whatsapp} target="_blank" rel="noopener">Написать в WhatsApp</a>
            <a className="btn btn--ghost btn--full" href="/tenant">Личный кабинет арендатора</a>
          </div>
          <div className="contacts__map">
            <iframe
              title="Карта проезда к БЦ «Маяк»"
              src={`https://yandex.ru/map-widget/v1/?mode=search&text=${encodeURIComponent(CONTACTS.mapQuery)}&z=16`}
              loading="lazy"
              allowFullScreen
            />
          </div>
        </div>
      </div>
    </section>
  )
}

function Footer({ onNav }: { onNav: (id: string) => void }) {
  return (
    <footer className="ftr">
      <div className="wrap ftr__in">
        <div>
          <div style={{ color: '#fff', fontWeight: 800, fontSize: 17 }}>Бизнес-центр «Маяк»</div>
          <div style={{ marginTop: 6 }}>{CONTACTS.address}</div>
          <div style={{ marginTop: 6 }}>
            <a href={`tel:${CONTACTS.phoneHref}`}>{CONTACTS.phone}</a> · <a href={`mailto:${CONTACTS.email}`}>{CONTACTS.email}</a>
          </div>
        </div>
        <div className="ftr__links">
          {NAV.map(n => <button key={n.id} onClick={() => onNav(n.id)} style={{ background: 'none', border: 0, color: 'inherit', padding: 0, textAlign: 'left' }}>{n.label}</button>)}
        </div>
        <div className="ftr__links">
          <a href="/tenant">Личный кабинет арендатора</a>
          <a href={CONTACTS.whatsapp} target="_blank" rel="noopener">WhatsApp</a>
          <span>© {new Date().getFullYear()} БЦ «Маяк», Дмитров</span>
        </div>
      </div>
    </footer>
  )
}
