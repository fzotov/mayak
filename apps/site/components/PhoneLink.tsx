'use client'

import { useState } from 'react'
import { SITE } from '@/lib/site'
import { track } from '@/lib/analytics'
import { useCoarsePointer } from '@/lib/useCoarsePointer'

/**
 * Телефон: на телефоне — звонок, на компьютере — копирование номера.
 * На десктопе ссылка tel: открывает диалог «Open FaceTime?», поэтому там её не используем.
 */
export default function PhoneLink({
  className = '', children, place = 'page',
}: {
  className?: string
  children?: React.ReactNode
  place?: string
}) {
  const canCall = useCoarsePointer()
  const [copied, setCopied] = useState(false)

  if (canCall) {
    return (
      <a href={`tel:${SITE.phoneHref}`} className={className} onClick={() => track('phone_click', { place })}>
        {children ?? SITE.phone}
      </a>
    )
  }

  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        track('phone_click', { place, action: 'copy' })
        try { await navigator.clipboard.writeText(SITE.phone) } catch { /* буфер недоступен */ }
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }}
      title="Нажмите, чтобы скопировать номер"
    >
      {copied ? 'Номер скопирован' : (children ?? SITE.phone)}
    </button>
  )
}
