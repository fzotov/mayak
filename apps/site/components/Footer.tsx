import Image from 'next/image'
import Link from 'next/link'
import { NAV, SITE } from '@/lib/site'
import PhoneLink from './PhoneLink'

export default function Footer() {
  return (
    <footer className="mt-20 bg-brand-2 pb-28 pt-12 text-[#d3dfec] lg:pb-12">
      <div className="wrap grid gap-10 md:grid-cols-[1.2fr_1fr_auto]">
        <div>
          <Image src="/logo-mayak-white.png" alt={SITE.name} width={334} height={176} className="h-11 w-auto" />
          <p className="mt-4 max-w-sm text-[15px] text-[#b9cade]">{SITE.address}</p>
          <p className="mt-1 text-[15px] text-[#b9cade]">Отдел аренды — {SITE.office}. {SITE.hours}</p>
        </div>

        <nav aria-label="Разделы сайта" className="grid content-start gap-2.5 text-[15px]">
          {NAV.map(item => (
            <Link key={item.href} href={item.href} className="transition-colors hover:text-white">{item.label}</Link>
          ))}
          <a href="/tenant" className="mt-1 transition-colors hover:text-white">Личный кабинет арендатора</a>
        </nav>

        <div className="grid content-start gap-2 text-lg font-extrabold text-white">
          <PhoneLink place="footer" />
          <a href={`mailto:${SITE.email}`} className="text-[15px] font-normal text-[#b9cade] transition-colors hover:text-white">{SITE.email}</a>
        </div>
      </div>

      <div className="wrap mt-10 border-t border-white/10 pt-6 text-sm text-[#8298b3]">
        © {new Date().getFullYear()} {SITE.name} · Дмитров
      </div>
    </footer>
  )
}
