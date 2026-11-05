'use client'

import { useState } from 'react'
import PhoneField, { isValidPhone } from './PhoneField'
import PhoneLink from './PhoneLink'
import { IconLock } from './Icons'
import { collectAttribution } from '@/lib/attribution'
import { track } from '@/lib/analytics'
import { SITE } from '@/lib/site'

const AREAS = ['до 15 м²', '15–20 м²', '20–30 м²', '30+ м²']

/** Форма на первом экране: площадь, число сотрудников и телефон. */
export default function QuickLeadForm({ source = 'hero' }: { source?: string }) {
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'failed'>('idle')
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    const phone = String(data.get('phone') || '')
    if (!isValidPhone(phone)) { setError('Укажите телефон полностью — 11 цифр'); return }

    setError(null); setState('sending')
    track('lead_form_submit', { source })
    const res = await fetch('/api/lead', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        phone,
        comment: [data.get('area'), data.get('people') && `сотрудников: ${data.get('people')}`].filter(Boolean).join(', '),
        company: data.get('company'),
        source,
      }),
    }).catch(() => null)

    if (!res?.ok) { setState('failed'); return }
    setState('done')
  }

  const mailFallback = SITE.mailto('Подбор офиса', 'Здравствуйте! Хочу подобрать офис в БЦ «Маяк».')

  return (
    <div className="w-full max-w-[480px] rounded-[14px] bg-paper p-6 text-ink shadow-soft sm:p-7">
      {state === 'failed' ? (
        <div role="alert">
          <div className="h3">Не удалось отправить</div>
          <p className="mt-2 text-[15px] text-ink-2">
            Похоже, пропала связь. Напишите в WhatsApp или позвоните — ответим сразу.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <PhoneLink className="btn btn-primary" place="quick_fallback">{SITE.phone}</PhoneLink>
            <a href={mailFallback} className="btn btn-secondary">Написать на почту</a>
          </div>
          <button type="button" onClick={() => setState('idle')} className="mt-3 text-sm text-muted underline underline-offset-4">
            Попробовать ещё раз
          </button>
        </div>
      ) : state === 'done' ? (
        <div role="status">
          <div className="h3 text-free">Спасибо! Заявка отправлена.</div>
          <p className="mt-2 text-[15px] text-ink-2">
            Мы свяжемся с вами в ближайшее время и предложим подходящие помещения.
          </p>
        </div>
      ) : (
        <>
          <div className="text-[21px] font-extrabold tracking-tight">Подберите офис за 1 минуту</div>
          <p className="mt-1.5 text-[15px] text-muted">Мы предложим лучшие варианты под ваши задачи</p>

          <form onSubmit={onSubmit} onFocus={() => track('lead_form_open', { source })} className="mt-5 grid gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="sr-only" htmlFor="hero-area">Площадь, м²</label>
              <select id="hero-area" name="area" className="field" defaultValue="">
                <option value="">Площадь, м²</option>
                {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>

              <label className="sr-only" htmlFor="hero-people">Количество сотрудников</label>
              <input id="hero-people" name="people" inputMode="numeric" className="field" placeholder="Количество сотрудников" />
            </div>

            <label className="sr-only" htmlFor="hero-phone">Ваш телефон</label>
            <div className="relative">
              <span aria-hidden className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg leading-none">🇷🇺</span>
              <PhoneField id="hero-phone" className="field pl-12" placeholder="Ваш телефон" />
            </div>

            <input name="company" tabIndex={-1} autoComplete="off" aria-hidden className="absolute left-[-9999px] h-0 w-0 opacity-0" />

            <button type="submit" className="btn btn-primary w-full py-4 text-base" disabled={state === 'sending'}>
              {state === 'sending' ? 'Отправляем…' : 'Подобрать офис'}
            </button>
          </form>

          {error && <p className="mt-2 text-sm text-[#b42318]" role="alert">{error}</p>}

          <p className="mt-3 flex items-center gap-2 text-[13px] text-muted">
            <IconLock className="h-4 w-4 shrink-0" />
            Мы не передаём ваши данные третьим лицам
          </p>
        </>
      )}
    </div>
  )
}
