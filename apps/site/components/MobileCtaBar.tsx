'use client'

import Link from 'next/link'
import PhoneLink from './PhoneLink'
import { track } from '@/lib/analytics'

/** Фиксированная нижняя панель на телефоне: позвонить или выбрать офис. */
export default function MobileCtaBar() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-2 gap-2 border-t border-line bg-white/96 p-2.5 backdrop-blur lg:hidden">
      <PhoneLink place="mobile_bar" className="btn btn-secondary">Позвонить</PhoneLink>
      <Link href="/offices" className="btn btn-primary">Подобрать офис</Link>
    </div>
  )
}
