import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { CONTACTS } from './siteConfig'

type Props = {
  /** Откуда пришла заявка: hero | unit | calc | contacts */
  source: string
  unitNumber?: string
  areaWanted?: number | null
  submitLabel?: string
  note?: string
  withMessage?: boolean
}

const digits = (s: string) => s.replace(/\D/g, '')

export default function LeadForm({ source, unitNumber, areaWanted, submitLabel = 'Получить подборку и цены', note, withMessage }: Props) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  const [error, setError] = useState('')

  const waText = encodeURIComponent(
    `Здравствуйте! Интересует аренда офиса в БЦ «Маяк»${unitNumber ? `, помещение №${unitNumber}` : ''}.`
  )

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (digits(phone).length < 10) { setError('Укажите номер телефона — перезвоним на него'); return }
    setError(''); setState('sending')

    const { error: err } = await supabase.from('site_leads').insert({
      name: name.trim() || null,
      phone: phone.trim(),
      message: message.trim() || null,
      unit_number: unitNumber || null,
      area_wanted: areaWanted ?? null,
      source,
      page_url: typeof window !== 'undefined' ? window.location.href : null,
    })

    if (err) { setState('error'); return }
    setState('done')
  }

  if (state === 'done') return (
    <div className="form__ok">
      <b>Заявка принята.</b> Перезвоним на {phone} в рабочее время ({CONTACTS.hours}) и пришлём подборку свободных
      помещений с ценами. Если нужно срочно — {' '}
      <a href={`tel:${CONTACTS.phoneHref}`} style={{ textDecoration: 'underline' }}>{CONTACTS.phone}</a>.
    </div>
  )

  if (state === 'error') return (
    <div className="form">
      <div className="form__err">Не удалось отправить заявку. Напишите или позвоните — ответим сразу.</div>
      <a className="btn btn--primary btn--full" href={`${CONTACTS.whatsapp}?text=${waText}`} target="_blank" rel="noopener">
        Написать в WhatsApp
      </a>
      <a className="btn btn--ghost btn--full" href={`tel:${CONTACTS.phoneHref}`}>{CONTACTS.phone}</a>
    </div>
  )

  return (
    <form className="form" onSubmit={submit}>
      <input
        placeholder="Как к вам обращаться"
        value={name}
        onChange={e => setName(e.target.value)}
        autoComplete="name"
      />
      <input
        placeholder="Телефон *"
        value={phone}
        onChange={e => setPhone(e.target.value)}
        inputMode="tel"
        autoComplete="tel"
        required
      />
      {withMessage && (
        <textarea
          placeholder="Какой офис нужен: площадь, срок, пожелания"
          value={message}
          onChange={e => setMessage(e.target.value)}
        />
      )}
      {error && <div className="form__err">{error}</div>}
      <button className="btn btn--primary btn--full" type="submit" disabled={state === 'sending'}>
        {state === 'sending' ? 'Отправляем…' : submitLabel}
      </button>
      <div className="form__policy">
        {note || 'Перезвоним в рабочее время и пришлём подборку с ценами. Нажимая кнопку, вы соглашаетесь на обработку персональных данных.'}
      </div>
    </form>
  )
}
