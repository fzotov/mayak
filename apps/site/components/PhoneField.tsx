'use client'

import { useState } from 'react'

/** Маска +7 (999) 123-45-67 — меньше ошибок при вводе и чище номера в заявках. */
export function formatPhone(raw: string): string {
  let d = raw.replace(/\D/g, '')
  if (d.startsWith('8')) d = '7' + d.slice(1)
  if (!d.startsWith('7')) d = '7' + d
  d = d.slice(0, 11)
  const [, a = '', b = '', c = '', e = ''] = /^7(\d{0,3})(\d{0,3})(\d{0,2})(\d{0,2})$/.exec(d) ?? []
  let out = '+7'
  if (a) out += ` (${a}`
  if (a.length === 3) out += ')'
  if (b) out += ` ${b}`
  if (c) out += `-${c}`
  if (e) out += `-${e}`
  return out
}

export const isValidPhone = (value: string) => value.replace(/\D/g, '').length === 11

export default function PhoneField({
  name = 'phone', id, required = true, className = 'field', placeholder = '+7 (___) ___-__-__',
}: {
  name?: string; id?: string; required?: boolean; className?: string; placeholder?: string
}) {
  const [value, setValue] = useState('')

  return (
    <input
      id={id}
      name={name}
      type="tel"
      inputMode="tel"
      autoComplete="tel"
      required={required}
      className={className}
      placeholder={placeholder}
      value={value}
      onChange={e => setValue(e.target.value.replace(/\D/g, '') ? formatPhone(e.target.value) : '')}
    />
  )
}
