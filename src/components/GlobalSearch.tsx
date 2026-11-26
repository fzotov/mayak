// Общий поиск админки: арендаторы (название, ИНН, офис), помещения, счета, договоры. Ctrl/⌘+K — фокус.
import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { sb, useSb } from '../lib/query'
import { go } from '../lib/nav'
import { C, inputStyle } from './ui'

interface Hit { group: string; title: string; sub?: string; to: string }
const NO_HITS: Hit[] = []

/** Поиск по четырём разделам; s — уже очищенная строка (без символов фильтра PostgREST). */
async function search(s: string): Promise<Hit[]> {
  const like = `*${s}*`
  const [tn, un, inv, ls] = await Promise.all([
    sb(supabase.from('tenants').select('id, full_name, inn, unit_number').or(`full_name.ilike.${like},inn.ilike.${like},unit_number.ilike.${like}`).order('full_name').limit(6)),
    sb(supabase.from('units').select('id, number, floor, area, status').ilike('number', like).order('number').limit(4)),
    sb(supabase.from('v_invoice_state').select('id, number, tenant_name, total').ilike('number', like).limit(4)),
    sb(supabase.from('leases').select('id, number, tenants(full_name)').ilike('number', like).limit(4)),
  ])
  return [
    ...tn.map(t => ({ group: 'Арендаторы', title: t.full_name, sub: [t.inn && 'ИНН ' + t.inn, t.unit_number && 'офис ' + t.unit_number].filter(Boolean).join(' · '), to: '/tenants/' + t.id })),
    ...un.map(u => ({ group: 'Помещения', title: 'Помещение ' + u.number, sub: `${u.floor ?? '?'} этаж · ${u.area} м² · ${u.status === 'free' ? 'свободно' : 'занято'}`, to: '/units?q=' + encodeURIComponent(u.number) })),
    ...inv.map(i => ({ group: 'Счета', title: 'Счёт № ' + i.number, sub: i.tenant_name ?? undefined, to: '/invoices/' + i.id })),
    ...ls.map(l => ({ group: 'Договоры', title: 'Договор № ' + l.number, sub: l.tenants?.full_name, to: '/contracts/' + l.id })),
  ]
}

export default function GlobalSearch() {
  const [q, setQ] = useState('')
  const [term, setTerm] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); ref.current?.focus(); setOpen(true) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // запрос уходит через 200 мс после последнего нажатия
  useEffect(() => {
    const s = q.trim().replace(/[,()*%\\]/g, ' ').trim()
    const t = setTimeout(() => { setTerm(s); setActive(0) }, s.length < 2 ? 0 : 200)
    return () => clearTimeout(t)
  }, [q])
  const hitsQ = useSb(['global_search', term], () => search(term), { enabled: term.length >= 2, staleTime: 10_000 })
  const hits = term.length >= 2 ? hitsQ.data || NO_HITS : NO_HITS

  const pick = (h: Hit) => { go(h.to); setOpen(false); setQ(''); ref.current?.blur() }

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: 420 }}>
      <input ref={ref} type="search" value={q} placeholder="Поиск: арендатор, ИНН, офис, счёт…  Ctrl+K"
        onChange={e => { setQ(e.target.value); setOpen(true) }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={e => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, hits.length - 1)) }
          if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)) }
          if (e.key === 'Enter' && hits[active]) pick(hits[active])
          if (e.key === 'Escape') { setOpen(false); ref.current?.blur() }
        }}
        style={{ ...inputStyle, background: C.card2 }} />
      {open && q.trim().length >= 2 && (
        <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, boxShadow: C.shadow, zIndex: 100, maxHeight: 420, overflowY: 'auto', padding: 4 }}>
          {hitsQ.error && <div style={{ padding: 12, color: C.red, fontSize: 13 }}>Поиск не выполнился: {hitsQ.error.message}</div>}
          {!hitsQ.error && hits.length === 0 && <div style={{ padding: 12, color: C.faint, fontSize: 13 }}>{hitsQ.isFetching ? 'Ищем…' : 'Ничего не найдено'}</div>}
          {hits.map((h, i) => (
            <div key={h.to + i}>
              {(i === 0 || hits[i - 1].group !== h.group) && <div style={{ fontSize: 11, color: C.faint, padding: '8px 10px 4px', fontWeight: 600 }}>{h.group}</div>}
              <div onMouseDown={() => pick(h)} onMouseEnter={() => setActive(i)}
                style={{ padding: '7px 10px', borderRadius: 7, cursor: 'pointer', background: i === active ? C.hover : 'transparent' }}>
                <div style={{ fontSize: 14, color: C.text }}>{h.title}</div>
                {h.sub && <div style={{ fontSize: 12, color: C.muted }}>{h.sub}</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
