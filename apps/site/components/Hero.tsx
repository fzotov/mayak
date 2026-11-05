import Image from 'next/image'
import OfficeQuiz from './OfficeQuiz'
import { IconArea, IconCar, IconClimate, IconPin, IconWifi } from './Icons'
import { SITE } from '@/lib/site'

const FEATURES = [
  { Icon: IconArea,    title: 'От 10 м²',  text: 'Площади под любые задачи' },
  { Icon: IconCar,     title: 'Парковка',  text: 'Удобная рядом со зданием' },
  { Icon: IconWifi,    title: 'Интернет',  text: 'Высокоскоростной' },
  { Icon: IconClimate, title: 'Комфорт',   text: 'Кондиционирование и вентиляция' },
]

export default function Hero() {
  return (
    <section className="relative isolate overflow-hidden bg-[#2b1c16] text-white">
      <div className="absolute inset-0">
        <Image
          src="/images/building/hero.jpg"
          alt="Бизнес-центр «Маяк» в Дмитрове"
          fill priority sizes="100vw"
          className="object-cover object-[70%_center]"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(90deg, rgba(43,28,22,.97) 0%, rgba(43,28,22,.94) 34%, rgba(43,28,22,.62) 56%, rgba(43,28,22,.18) 100%)',
          }}
        />
        <div className="absolute inset-0 bg-[#2b1c16]/45 lg:hidden" />
      </div>

      <div className="wrap relative grid gap-10 py-10 lg:grid-cols-[minmax(0,540px)_1fr] lg:gap-8 lg:py-12">
        <div>
          <p className="flex items-center gap-2 text-[15px] text-white/80">
            <IconPin className="h-5 w-5" />
            {SITE.address.replace('Московская область, ', '')}
          </p>

          <h1 className="mt-5 text-[clamp(2.25rem,3.4vw,3.25rem)] font-extrabold leading-[1.05] tracking-[-.03em] text-white">
            Офисы<br />в центре Дмитрова
          </h1>
          <p className="mt-4 max-w-md text-[17px] leading-relaxed text-white/85 sm:text-[19px]">
            Современные помещения для вашего бизнеса в Бизнес-центре «Маяк»
          </p>

          <div className="mt-7">
            <OfficeQuiz />
          </div>
        </div>

        <ul className="grid grid-cols-2 gap-x-6 gap-y-7 self-end lg:grid-cols-4 lg:gap-x-4 lg:pb-2">
          {FEATURES.map(({ Icon, title, text }) => (
            <li key={title}>
              <Icon className="h-7 w-7 text-white/90" />
              <div className="mt-3 text-[17px] font-bold">{title}</div>
              <div className="mt-0.5 text-[14px] leading-snug text-white/70">{text}</div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
