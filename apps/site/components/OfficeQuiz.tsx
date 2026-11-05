'use client'

import { useState } from 'react'
import PhoneField, { isValidPhone } from './PhoneField'
import PhoneLink from './PhoneLink'
import { IconLock } from './Icons'
import { collectAttribution } from '@/lib/attribution'
import { SITE } from '@/lib/site'
import { track } from '@/lib/analytics'

const AREAS = ['до 15 м²', '15–20 м²', '20–30 м²', 'от 30 м²']
const TEAMS = ['1–3 человека', '4–8 человек', '9–15 человек', 'больше 15']
const TERMS = ['Готов заехать сейчас', 'В течение месяца', 'Присматриваюсь']

/** Группа вариантов ответа. */
function Chips({ items, value, onPick }: { items: string[]; value: string; onPick: (v: string) => void }) {
  return (
    <div className="mt-4 grid gap-2 sm:grid-cols-2">
      {items.map(item => (
        <button
          key={item}
          type="button"
          onClick={() => onPick(item)}
          className={`rounded-xl border px-4 py-3 text-left text-[15px] font-semibold transition-colors ${
            value === item ? 'border-brand bg-brand text-white' : 'border-line bg-paper hover:border-brand'
          }`}
        >
          {item}
        </button>
      ))}
    </div>
  )
}

/**
 * Подбор офиса в три шага. Короткие вопросы вместо длинной формы:
 * человек отвечает на два клика и оставляет телефон только в конце.
 */
export default function OfficeQuiz({ source = 'hero_quiz' }: { source?: string }) {
  const [step, setStep] = useState(0)
  const [area, setArea] = useState('')
  const [team, setTeam] = useState('')
  const [term, setTerm] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'failed'>('idle')
  const [error, setError] = useState<string | null>(null)

  const go = (next: number, answer?: string) => {
    track('quiz_step', { step: next, answer })
    setStep(next)
  }

  const mailBody = ['Здравствуйте! Хочу подобрать офис в БЦ «Маяк».', area && `Площадь: ${area}`, team && `Сотрудников: ${team}`]
    .filter(Boolean).join('\n')

  async function submit(e: React.FormEvent<HTMLFormElement>) {
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
        name: data.get('name'),
        phone,
        comment: [area && `площадь: ${area}`, team && `сотрудников: ${team}`, term && `срок: ${term}`]
          .filter(Boolean).join(', '),
        company: data.get('company'),
        pageUrl: window.location.href,
        attribution: collectAttribution(),
        source,
      }),
    }).catch(() => null)

    setState(res?.ok ? 'done' : 'failed')
  }


  return (
    <div className="w-full max-w-[480px] rounded-[14px] bg-paper p-6 text-ink shadow-soft sm:p-7">
      {state === 'done' ? (
        <div role="status">
          <div className="h3 text-free">Спасибо! Подбираем варианты.</div>
          <p className="mt-2 text-[15px] text-ink-2">
            Перезвоним в рабочее время и пришлём помещения под ваши задачи.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <PhoneLink className="btn btn-primary btn-sm" place="quiz_thanks">Позвонить: {SITE.phone}</PhoneLink>
            <a href={SITE.mailto('Подбор офиса', mailBody)} className="btn btn-secondary btn-sm">Написать на почту</a>
          </div>
        </div>
      ) : state === 'failed' ? (
        <div role="alert">
          <div className="h3">Не удалось отправить</div>
          <p className="mt-2 text-[15px] text-ink-2">
            Похоже, пропала связь. Отправьте ответы в WhatsApp — сообщение уже заполнено, или позвоните нам.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <PhoneLink className="btn btn-primary" place="quiz_fallback">{SITE.phone}</PhoneLink>
            <a href={SITE.mailto('Подбор офиса', mailBody)} className="btn btn-secondary">Написать на почту</a>
          </div>
          <button type="button" onClick={() => { setState('idle'); setStep(2) }}
            className="mt-3 text-sm text-muted underline underline-offset-4">Попробовать ещё раз</button>
        </div>
      ) : (
        <>
          <div className="flex items-baseline justify-between gap-3">
            <div className="text-[21px] font-extrabold tracking-tight">Подберите офис за 1 минуту</div>
            <span className="shrink-0 text-sm text-muted">{step + 1} из 3</span>
          </div>

          <div className="mt-3 h-1 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full bg-brand transition-all duration-200"
              style={{ width: `${((step + 1) / 3) * 100}%` }} />
          </div>

          {step === 0 && (
            <>
              <p className="mt-4 text-[15px] text-ink-2">Какая площадь нужна?</p>
              <Chips items={AREAS} value={area} onPick={v => { setArea(v); go(1, v) }} />
            </>
          )}

          {step === 1 && (
            <>
              <p className="mt-4 text-[15px] text-ink-2">Сколько человек будет работать?</p>
              <Chips items={TEAMS} value={team} onPick={v => { setTeam(v); go(2, v) }} />
              <button type="button" onClick={() => go(0)} className="mt-4 text-sm text-muted underline underline-offset-4">
                Назад
              </button>
            </>
          )}

          {step === 2 && (
            <form onSubmit={submit} className="mt-4 grid gap-3" noValidate>
              <p className="text-[15px] text-ink-2">Когда планируете заезд?</p>
              <div className="flex flex-wrap gap-2">
                {TERMS.map(item => (
                  <button key={item} type="button" onClick={() => setTerm(item)}
                    className={`rounded-full border px-3 py-1.5 text-[13px] font-semibold transition-colors ${
                      term === item ? 'border-brand bg-brand text-white' : 'border-line bg-paper hover:border-brand'
                    }`}>
                    {item}
                  </button>
                ))}
              </div>

              <label className="sr-only" htmlFor="quiz-name">Имя</label>
              <input id="quiz-name" name="name" className="field" placeholder="Как к вам обращаться" autoComplete="name" />

              <label className="sr-only" htmlFor="quiz-phone">Телефон</label>
              <PhoneField id="quiz-phone" />

              <input name="company" tabIndex={-1} autoComplete="off" aria-hidden
                className="absolute left-[-9999px] h-0 w-0 opacity-0" />

              {error && <p className="text-sm text-[#b42318]" role="alert" aria-live="polite">{error}</p>}

              <button type="submit" className="btn btn-primary w-full py-4" disabled={state === 'sending'}>
                {state === 'sending' ? 'Отправляем…' : 'Получить подборку'}
              </button>
              <button type="button" onClick={() => go(1)} className="text-sm text-muted underline underline-offset-4">
                Назад
              </button>
            </form>
          )}

          <p className="mt-4 flex items-center gap-2 text-[13px] text-muted">
            <IconLock className="h-4 w-4 shrink-0" />
            Мы не передаём ваши данные третьим лицам
          </p>
        </>
      )}
    </div>
  )
}
