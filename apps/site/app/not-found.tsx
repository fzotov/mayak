import Link from 'next/link'
import { SITE } from '@/lib/site'
import PhoneLink from '@/components/PhoneLink'

export default function NotFound() {
  return (
    <section className="py-20">
      <div className="wrap max-w-2xl text-center">
        <div className="kicker">Страница не найдена</div>
        <h1 className="h1 mt-3">Такой страницы нет</h1>
        <p className="mt-4 text-[17px] text-ink-2">
          Возможно, помещение уже сдано или ссылка устарела. Посмотрите свободные офисы или позвоните — подскажем.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link href="/offices" className="btn btn-primary">Свободные офисы</Link>
          <PhoneLink place="404" className="btn btn-secondary" />
        </div>
      </div>
    </section>
  )
}
