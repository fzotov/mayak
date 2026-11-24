// Общие элементы админки на токенах из src/index.css (светлая и тёмная тема).
// Экраны собираются из этих компонентов; цвета — только через C (var(--…)), без шестнадцатеричных значений.
import React from 'react'
import { Link as RouterLink } from 'react-router'

export const C = {
  text: 'var(--text)', muted: 'var(--text-2)', faint: 'var(--text-3)', line: 'var(--border)', lineStrong: 'var(--border-strong)',
  bg: 'var(--bg)', card: 'var(--surface)', card2: 'var(--surface-2)', hover: 'var(--hover)',
  accent: 'var(--accent)', accentBg: 'var(--accent-bg)', onAccent: 'var(--on-accent)',
  red: 'var(--red)', redBg: 'var(--red-bg)', redLine: 'var(--red-border)', green: 'var(--green)', greenBg: 'var(--green-bg)',
  amber: 'var(--amber)', amberBg: 'var(--amber-bg)', amberLine: 'var(--amber-border)', violet: 'var(--violet)', violetBg: 'var(--violet-bg)',
  overlay: 'var(--overlay)', shadow: 'var(--shadow)', radius: 'var(--radius)', radiusSm: 'var(--radius-sm)',
}

// ── Форматирование ──────────────────────────────────────────────────────────
export const money = (n: number | string | null | undefined, opts: { zero?: string } = {}) => {
  const v = Number(n || 0)
  if (v === 0 && opts.zero !== undefined) return opts.zero
  return v.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₽'
}
export const num = (n: number | string | null | undefined, digits = 0) => Number(n || 0).toLocaleString('ru-RU', { maximumFractionDigits: digits })
export const dateRu = (s?: string | null) => (s ? new Date(s.length === 10 ? s + 'T00:00:00' : s).toLocaleDateString('ru-RU') : '—')
export const dateTimeRu = (s?: string | null) => (s ? new Date(s).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—')
const MONTHS = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь']
export const monthRu = (s?: string | null) => {
  if (!s) return '—'
  const [y, m] = s.slice(0, 7).split('-')
  const name = MONTHS[Number(m) - 1] || ''
  return name.charAt(0).toUpperCase() + name.slice(1) + ' ' + y
}
export const today = () => new Date().toISOString().slice(0, 10)
export const monthStart = (d = new Date()) => new Date(Date.UTC(d.getFullYear(), d.getMonth(), 1)).toISOString().slice(0, 10)

// ── Раскладка ───────────────────────────────────────────────────────────────
export function Page({ title, actions, children }: { title?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gap: 16, color: C.text, minWidth: 0 }}>
      {(title || actions) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {title && <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, flex: 1, minWidth: 200, letterSpacing: '-.2px' }}>{title}</h2>}
          {actions && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginLeft: 'auto' }}>{actions}</div>}
        </div>
      )}
      {children}
    </div>
  )
}

export function Card({ title, actions, children, pad = true }: { title?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode; pad?: boolean }) {
  return (
    <section style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: C.radius, overflow: 'hidden', minWidth: 0 }}>
      {(title || actions) && (
        <header style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderBottom: `1px solid ${C.line}`, flexWrap: 'wrap' }}>
          <div style={{ fontWeight: 600, fontSize: 14, flex: 1 }}>{title}</div>
          {actions}
        </header>
      )}
      <div style={pad ? { padding: 16 } : undefined}>{children}</div>
    </section>
  )
}

export function Grid({ min = 180, gap = 12, children }: { min?: number; gap?: number; children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`, gap }}>{children}</div>
}

export function Row({ gap = 8, align = 'center', wrap = true, children, justify }: { gap?: number; align?: React.CSSProperties['alignItems']; wrap?: boolean; justify?: React.CSSProperties['justifyContent']; children: React.ReactNode }) {
  return <div style={{ display: 'flex', gap, alignItems: align, flexWrap: wrap ? 'wrap' : 'nowrap', justifyContent: justify }}>{children}</div>
}

export function Muted({ children, small }: { children: React.ReactNode; small?: boolean }) {
  return <span style={{ color: C.muted, fontSize: small ? 12 : undefined }}>{children}</span>
}

export function Sub({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{children}</div>
}

// ── Кнопки и ссылки ─────────────────────────────────────────────────────────
type BtnKind = 'primary' | 'secondary' | 'danger' | 'ghost'
export function Button({ kind = 'secondary', small, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { kind?: BtnKind; small?: boolean }) {
  const s: Record<BtnKind, React.CSSProperties> = {
    primary: { background: C.accent, color: C.onAccent, border: `1px solid ${C.accent}` },
    secondary: { background: C.card, color: C.text, border: `1px solid ${C.line}` },
    danger: { background: C.card, color: C.red, border: `1px solid ${C.redLine}` },
    ghost: { background: 'transparent', color: C.accent, border: '1px solid transparent' },
  }
  return (
    <button type="button" {...p} style={{
      ...s[kind], borderRadius: C.radiusSm, padding: small ? '4px 10px' : '7px 14px', fontSize: small ? 12 : 13, fontWeight: 500,
      fontFamily: 'inherit', cursor: p.disabled ? 'default' : 'pointer', opacity: p.disabled ? 0.55 : 1, whiteSpace: 'nowrap', ...p.style,
    }} />
  )
}

/** Внутренняя ссылка админки: работает «открыть в новой вкладке» и «Назад». */
export function Link({ to, children, muted }: { to: string; children: React.ReactNode; muted?: boolean }) {
  return <RouterLink to={to} style={{ color: muted ? C.text : C.accent, textDecoration: 'none' }}>{children}</RouterLink>
}

// ── Статусы и цифры ─────────────────────────────────────────────────────────
export type Tone = 'neutral' | 'green' | 'red' | 'amber' | 'blue' | 'violet'
export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: React.ReactNode }) {
  const t: Record<Tone, [string, string]> = {
    neutral: [C.hover, C.muted], green: [C.greenBg, C.green], red: [C.redBg, C.red], amber: [C.amberBg, C.amber],
    blue: [C.accentBg, C.accent], violet: [C.violetBg, C.violet],
  }
  return <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 10, fontSize: 12, fontWeight: 500, background: t[tone][0], color: t[tone][1], whiteSpace: 'nowrap' }}>{children}</span>
}

export function Stat({ label, value, sub, tone, onClick }: { label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: 'red' | 'green' | 'amber' | 'blue'; onClick?: () => void }) {
  const color = tone === 'red' ? C.red : tone === 'green' ? C.green : tone === 'amber' ? C.amber : tone === 'blue' ? C.accent : C.text
  return (
    <div onClick={onClick} style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: C.radius, padding: '12px 16px', cursor: onClick ? 'pointer' : undefined }}>
      <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 600, color, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: C.faint, marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

export function Stats({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>{children}</div>
}

// ── Таблица ─────────────────────────────────────────────────────────────────
export interface Col<T> { key: string; title: React.ReactNode; render: (row: T) => React.ReactNode; align?: 'right' | 'left' | 'center'; width?: number | string; sort?: (row: T) => string | number | null }
export function Table<T>({ cols, rows, rowKey, onRow, empty = 'Нет данных', foot, dense }: {
  cols: Col<T>[]; rows: T[]; rowKey: (r: T) => string; onRow?: (r: T) => void; empty?: React.ReactNode; foot?: React.ReactNode; dense?: boolean
}) {
  const [sort, setSort] = React.useState<{ key: string; dir: 1 | -1 } | null>(null)
  const sorted = React.useMemo(() => {
    const c = sort && cols.find(x => x.key === sort.key)
    if (!c?.sort) return rows
    return [...rows].sort((a, b) => {
      const x = c.sort!(a), y = c.sort!(b)
      if (x === y) return 0
      if (x === null || x === undefined) return 1
      if (y === null || y === undefined) return -1
      return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'ru')) * sort!.dir
    })
  }, [rows, sort, cols])
  const pad = dense ? '6px 10px' : '8px 12px'
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr>{cols.map(c => (
            <th key={c.key} onClick={c.sort ? () => setSort(s => s?.key === c.key ? { key: c.key, dir: s.dir === 1 ? -1 : 1 } : { key: c.key, dir: 1 }) : undefined}
              style={{ textAlign: c.align || 'left', padding: pad, fontSize: 12, fontWeight: 500, color: C.muted, borderBottom: `1px solid ${C.line}`, whiteSpace: 'nowrap', width: c.width, background: C.card2, cursor: c.sort ? 'pointer' : undefined, userSelect: 'none' }}>
              {c.title}{sort?.key === c.key ? (sort.dir === 1 ? ' ↑' : ' ↓') : ''}
            </th>
          ))}</tr>
        </thead>
        <tbody>
          {sorted.length === 0 && <tr><td colSpan={cols.length} style={{ padding: 24, textAlign: 'center', color: C.faint }}>{empty}</td></tr>}
          {sorted.map(r => (
            <tr key={rowKey(r)} onClick={onRow ? () => onRow(r) : undefined} style={{ cursor: onRow ? 'pointer' : undefined }}
              onMouseEnter={e => { if (onRow) e.currentTarget.style.background = 'var(--hover)' }} onMouseLeave={e => { e.currentTarget.style.background = '' }}>
              {cols.map(c => (
                <td key={c.key} style={{ textAlign: c.align || 'left', padding: pad, borderBottom: `1px solid ${C.line}`, verticalAlign: 'top', fontVariantNumeric: c.align === 'right' ? 'tabular-nums' : undefined, whiteSpace: c.align === 'right' ? 'nowrap' : undefined }}>{c.render(r)}</td>
              ))}
            </tr>
          ))}
        </tbody>
        {foot && <tfoot>{foot}</tfoot>}
      </table>
    </div>
  )
}

// ── Поля ────────────────────────────────────────────────────────────────────
export const inputStyle: React.CSSProperties = {
  width: '100%', border: `1px solid ${C.line}`, borderRadius: C.radiusSm, padding: '7px 10px', fontSize: 14, fontFamily: 'inherit',
  outline: 'none', boxSizing: 'border-box', background: C.card, color: C.text,
}
export function Field({ label, children, hint, wide }: { label: string; children: React.ReactNode; hint?: string; wide?: boolean }) {
  return (
    <label style={{ display: 'grid', gap: 4, fontSize: 12, color: C.muted, fontWeight: 500, gridColumn: wide ? '1 / -1' : undefined, alignContent: 'start' }}>
      {label}
      {children}
      {hint && <span style={{ fontWeight: 400, color: C.faint }}>{hint}</span>}
    </label>
  )
}
export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>((p, ref) =>
  <input ref={ref} {...p} style={{ ...inputStyle, ...p.style }} />)
export function Select(p: React.SelectHTMLAttributes<HTMLSelectElement>) { return <select {...p} style={{ ...inputStyle, ...p.style }} /> }
export function Textarea(p: React.TextareaHTMLAttributes<HTMLTextAreaElement>) { return <textarea {...p} style={{ ...inputStyle, minHeight: 80, resize: 'vertical', ...p.style }} /> }
export function Search({ value, onChange, placeholder = 'Поиск', width = 240 }: { value: string; onChange: (v: string) => void; placeholder?: string; width?: number }) {
  return <input type="search" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={{ ...inputStyle, width }} />
}

/** Переключатель фильтра: «Все · Помещения · Стойки». */
export function Segmented<K extends string>({ options, value, onChange }: { options: [K, React.ReactNode][]; value: K; onChange: (k: K) => void }) {
  return (
    <div style={{ display: 'inline-flex', gap: 2, padding: 2, borderRadius: C.radiusSm, background: C.hover, flexWrap: 'wrap' }}>
      {options.map(([k, label]) => (
        <button key={k} type="button" onClick={() => onChange(k)} style={{
          border: 0, borderRadius: 6, padding: '5px 12px', fontSize: 13, fontFamily: 'inherit', cursor: 'pointer',
          background: value === k ? C.card : 'transparent', color: value === k ? C.text : C.muted, fontWeight: value === k ? 500 : 400,
          boxShadow: value === k ? '0 1px 2px rgba(0,0,0,.08)' : 'none',
        }}>{label}</button>
      ))}
    </div>
  )
}

export function Tabs<K extends string>({ tabs, value, onChange }: { tabs: [K, string][]; value: K; onChange: (k: K) => void }) {
  return (
    <div style={{ display: 'flex', gap: 4, borderBottom: `1px solid ${C.line}`, overflowX: 'auto' }}>
      {tabs.map(([k, label]) => (
        <button key={k} type="button" onClick={() => onChange(k)} style={{
          border: 0, background: 'none', padding: '8px 12px', fontSize: 13, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap',
          color: value === k ? C.accent : C.muted, fontWeight: value === k ? 600 : 500, borderBottom: `2px solid ${value === k ? C.accent : 'transparent'}`, marginBottom: -1,
        }}>{label}</button>
      ))}
    </div>
  )
}

// ── Окна и сообщения ────────────────────────────────────────────────────────
export function Modal({ title, onClose, children, footer, width = 480 }: { title: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode; width?: number }) {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, background: C.overlay, display: 'grid', placeItems: 'center', zIndex: 1000, padding: 16 }}>
      <div role="dialog" aria-label={title} style={{ background: C.card, color: C.text, borderRadius: 12, width: '100%', maxWidth: width, maxHeight: 'calc(100vh - 32px)', overflow: 'auto', boxShadow: C.shadow }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '14px 18px', borderBottom: `1px solid ${C.line}` }}>
          <div style={{ flex: 1, fontWeight: 600 }}>{title}</div>
          <button type="button" onClick={onClose} aria-label="Закрыть" style={{ border: 0, background: 'none', fontSize: 20, lineHeight: 1, cursor: 'pointer', color: C.muted }}>×</button>
        </div>
        <div style={{ padding: 18, display: 'grid', gap: 12 }}>{children}</div>
        {footer && <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 18px', borderTop: `1px solid ${C.line}` }}>{footer}</div>}
      </div>
    </div>
  )
}

export function Notice({ tone = 'neutral', children }: { tone?: 'neutral' | 'red' | 'green' | 'amber'; children: React.ReactNode }) {
  const t = { neutral: [C.card2, C.muted], red: [C.redBg, C.red], green: [C.greenBg, C.green], amber: [C.amberBg, C.amber] }[tone]
  return <div style={{ background: t[0], color: t[1], borderRadius: 8, padding: '10px 14px', fontSize: 13, lineHeight: 1.5 }}>{children}</div>
}

/** Строка-призыв на «Сегодня»: что требует действия. */
export function Alert({ tone = 'amber', children, onClick }: { tone?: 'amber' | 'red' | 'blue'; children: React.ReactNode; onClick?: () => void }) {
  const t = { amber: [C.amberBg, C.amber, C.amberLine], red: [C.redBg, C.red, C.redLine], blue: [C.accentBg, C.accent, C.accentBg] }[tone]
  return (
    <button type="button" onClick={onClick} style={{ textAlign: 'left', border: `1px solid ${t[2]}`, background: t[0], color: t[1], borderRadius: 9, padding: '10px 15px', fontSize: 14, fontFamily: 'inherit', cursor: onClick ? 'pointer' : 'default', width: '100%' }}>
      {children}
    </button>
  )
}

export function Loading({ text = 'Загрузка…' }: { text?: string }) { return <div style={{ padding: 24, color: C.faint }}>{text}</div> }
export function Empty({ children }: { children: React.ReactNode }) { return <div style={{ padding: 24, textAlign: 'center', color: C.faint }}>{children}</div> }
export function ErrorBox({ error, onRetry }: { error: string; onRetry?: () => void }) {
  return <Notice tone="red">{error}{onRetry && <> <Button small kind="ghost" onClick={onRetry}>Повторить</Button></>}</Notice>
}
