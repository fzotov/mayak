'use client'

import { useEffect, useRef, useState } from 'react'
import PhoneField, { isValidPhone } from './PhoneField'
import PhoneLink from './PhoneLink'
import { collectAttribution } from '@/lib/attribution'
import { SITE } from '@/lib/site'
import { track } from '@/lib/analytics'

type Props = {
  /** Откуда пришла заявка: home | office_panel | office_page | contacts */
  source: string
  officeNumber?: string
  title?: string
  submitLabel?: string
  compact?: boolean
  /** waitlist — запись в лист ожидания по занятому помещению */
  variant?: 'viewing' | 'waitlist'
}

export default function LeadForm({
  source, officeNumber, title, submitLabel, compact, variant = 'viewing',
}: Props) {
  const isWaitlist = variant === 'waitlist'
  const label = submitLabel ?? (isWaitlist ? 'Сообщить, когда освободится' : 'Отправить заявку')

  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'failed'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [lastPhone, setLastPhone] = useState('')
  // время открытия формы — для отсечки ботов, фиксируем после монтирования
  const openedAt = useRef(0)
  useEffect(() => { openedAt.current = Date.now() }, [])

  const mailSubject = isWaitlist
    ? `Лист ожидания${officeNumber ? `: офис № ${officeNumber}` : ''}`
    : `Аренда офиса${officeNumber ? ` № ${officeNumber}` : ''}`
  const mailBody = (phone: string) =>
    [`Здравствуйте! Интересует аренда офиса${officeNumber ? ` № ${officeNumber}` : ''} в БЦ «Маяк».`,
     phone && `Мой телефон: ${phone}`].filter(Boolean).join('\n')

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const phone = String(form.get('phone') || '')
    const name = String(form.get('name') || '')

    if (!isValidPhone(phone)) { setError('Укажите телефон полностью — 11 цифр'); return }
    setLastPhone(phone)
    setError(null)
    setState('sending')
    track('lead_form_submit', { source, office: officeNumber, waitlist: isWaitlist })

    const res = await fetch('/api/lead', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name,
        phone,
        comment: [isWaitlist && 'ЛИСТ ОЖИДАНИЯ', form.get('comment')].filter(Boolean).join(': '),
        office: officeNumber ?? form.get('office'),
        company: form.get('company'),                 // honeypot
        elapsed: openedAt.current ? Date.now() - openedAt.current : null, // слишком быстрая отправка = бот
        pageUrl: window.location.href,
        attribution: collectAttribution(),
        source: isWaitlist ? `waitlist_${source}` : source,
      }),
    }).catch(() => null)

    if (!res?.ok) { setState('failed'); return }
    setState('done')
  }

  if (state === 'done') return (
    <div className="rounded-[14px] border border-free/30 bg-free-bg p-5" role="status">
      <div className="h3 text-free">{isWaitlist ? 'Вы в списке ожидания.' : 'Спасибо! Заявка отправлена.'}</div>
      <p className="mt-2 text-[15px] text-ink-2">
        {isWaitlist
          ? `Сообщим первому, как только помещение ${officeNumber ? `№ ${officeNumber} ` : ''}освободится.`
          : 'Перезвоним в рабочее время и предложим подходящие помещения.'}
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <PhoneLink className="btn btn-primary btn-sm" place="thanks">Позвонить: {SITE.phone}</PhoneLink>
        <a href={SITE.mailto(mailSubject, mailBody(lastPhone))} className="btn btn-secondary btn-sm">Написать на почту</a>
      </div>
    </div>
  )

  // Если заявку не удалось доставить — не теряем человека, а предлагаем прямой контакт
  if (state === 'failed') return (
    <div className="rounded-[14px] border border-line bg-surface p-5" role="alert">
      <div className="h3">Не удалось отправить заявку</div>
      <p className="mt-2 text-[15px] text-ink-2">
        Похоже, пропала связь. Позвоните нам или отправьте письмо — ответим сразу.
      </p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <PhoneLink className="btn btn-primary" place="form_fallback">{SITE.phone}</PhoneLink>
        <a href={SITE.mailto(mailSubject, mailBody(lastPhone))} className="btn btn-secondary">Написать на почту</a>
      </div>
      <button type="button" onClick={() => setState('idle')} className="mt-3 text-sm text-muted underline underline-offset-4">
        Попробовать отправить ещё раз
      </button>
    </div>
  )

  return (
    <form onSubmit={onSubmit} onFocus={() => track('lead_form_open', { source })} className="grid gap-3" noValidate>
      {title && <div className="h3">{title}</div>}

      <label className="grid gap-1.5">
        <span className="text-sm text-ink-2">Имя</span>
        <input name="name" className="field" autoComplete="name" placeholder="Как к вам обращаться" />
      </label>

      <label className="grid gap-1.5">
        <span className="text-sm text-ink-2">Телефон <span className="text-muted">— обязательно</span></span>
        <PhoneField />
      </label>

      {officeNumber ? (
        <input type="hidden" name="office" value={officeNumber} />
      ) : (
        <label className="grid gap-1.5">
          <span className="text-sm text-ink-2">{isWaitlist ? 'Какое помещение ждёте' : 'Интересующий офис'}</span>
          <input name="office" className="field" placeholder="Например, 330 или «до 20 м²»" />
        </label>
      )}

      {!compact && (
        <label className="grid gap-1.5">
          <span className="text-sm text-ink-2">Комментарий</span>
          <textarea name="comment" className="field min-h-24" placeholder="Площадь, срок аренды, пожелания" />
        </label>
      )}

      <input name="company" tabIndex={-1} autoComplete="off" aria-hidden className="absolute left-[-9999px] h-0 w-0 opacity-0" />

      {error && <p className="text-sm text-[#b42318]" role="alert" aria-live="polite">{error}</p>}

      <button type="submit" className="btn btn-primary w-full" disabled={state === 'sending'}>
        {state === 'sending' ? 'Отправляем…' : label}
      </button>
      <p className="text-xs text-muted">Нажимая кнопку, вы соглашаетесь на обработку персональных данных.</p>
    </form>
  )
}
