'use client'

import { useState } from 'react'
import { SITE } from '@/lib/site'
import { track } from '@/lib/analytics'
import { useCoarsePointer } from '@/lib/useCoarsePointer'

/**
 * Быстрый контакт поверх страницы.
 * На телефоне кнопка звонит, на компьютере — копирует номер,
 * потому что ссылка tel: там открывает лишние приложения вроде FaceTime.
 */
export default function FloatingContacts() {
  const canCall = useCoarsePointer()
  const [copied, setCopied] = useState(false)

  const label = copied ? 'Номер скопирован' : SITE.phone

  return (
    <div className="fixed bottom-24 right-4 z-40 lg:bottom-6">
      {canCall ? (
        <a
          href={`tel:${SITE.phoneHref}`}
          aria-label={`Позвонить ${SITE.phone}`}
          onClick={() => track('phone_click', { place: 'float' })}
          className="grid h-14 w-14 place-items-center rounded-full bg-brand text-white shadow-panel transition-transform hover:scale-105"
        >
          <PhoneIcon />
        </a>
      ) : (
        <button
          type="button"
          onClick={async () => {
            track('phone_click', { place: 'float', action: 'copy' })
            try { await navigator.clipboard.writeText(SITE.phone) } catch { /* буфер недоступен */ }
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
          }}
          className="flex items-center gap-2.5 rounded-full bg-brand px-5 py-3.5 text-[15px] font-bold text-white shadow-panel transition-transform hover:scale-[1.03]"
          title="Нажмите, чтобы скопировать номер"
        >
          <PhoneIcon />
          {label}
        </button>
      )}
    </div>
  )
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M6.5 3h3l1.5 4-2 1.5a12 12 0 0 0 6.5 6.5L17 13l4 1.5v3a2 2 0 0 1-2.2 2A16.8 16.8 0 0 1 4 7.2 2 2 0 0 1 6 5V3Z" />
    </svg>
  )
}
