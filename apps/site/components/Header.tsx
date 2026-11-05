'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import PhoneLink from './PhoneLink'
import { NAV, SITE } from '@/lib/site'
import { track } from '@/lib/analytics'

export default function Header() {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-surface">
      <div className="wrap flex h-[76px] items-stretch gap-6 md:h-[92px] xl:gap-10">
        <Link href="/" className="flex shrink-0 items-center bg-brand px-6 md:px-8" aria-label={`${SITE.name} — на главную`}>
          <Image src="/logo-mayak-white.png" alt="" width={334} height={176} priority className="h-10 w-auto md:h-[52px]" />
        </Link>

        <nav className="hidden min-w-0 flex-1 items-center gap-7 text-[17px] xl:flex 2xl:gap-9" aria-label="Основное меню">
          {NAV.map(item => (
            <Link key={item.href} href={item.href} className="whitespace-nowrap text-ink transition-colors hover:text-brand">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <PhoneLink
            place="header"
            className="btn btn-primary hidden whitespace-nowrap px-5 py-3.5 text-[15px] sm:inline-flex lg:px-7 lg:py-4 lg:text-[17px]"
          />
          <button type="button" className="btn btn-secondary btn-sm xl:hidden" aria-expanded={open}
            aria-controls="mobile-menu" onClick={() => setOpen(v => !v)}>
            {open ? 'Закрыть' : 'Меню'}
          </button>
        </div>
      </div>

      {open && (
        <div id="mobile-menu" className="fixed inset-x-0 bottom-0 top-[76px] z-50 overflow-y-auto bg-bg px-5 pb-28 pt-2 md:top-[92px] xl:hidden">
          <nav className="flex flex-col" aria-label="Мобильное меню">
            {NAV.map(item => (
              <Link key={item.href} href={item.href} onClick={() => setOpen(false)}
                className="border-b border-line py-4 text-lg font-bold">{item.label}</Link>
            ))}
          </nav>
          <div className="mt-6 grid gap-3">
            <PhoneLink place="mobile_menu" className="btn btn-primary" />
            <Link href="/offices" className="btn btn-secondary" onClick={() => setOpen(false)}>Найти офис</Link>
          </div>
          <p className="mt-6 text-sm text-muted">{SITE.address}</p>
        </div>
      )}
    </header>
  )
}
