// Общие элементы админки: единые цвета, отступы и состояния вместо инлайновых стилей на каждом экране.
import React from 'react'

export const C = {
  text: '#1a2240', muted: '#6b7280', faint: '#9ca3af', line: '#e8ebf3', bg: '#f6f7fb', card: '#fff',
  accent: '#4f6ef7', accentBg: '#eff3ff', red: '#dc2626', redBg: '#fef2f2', green: '#16a34a', greenBg: '#f0fdf4',
  amber: '#b45309', amberBg: '#fffbeb',
}

export const money = (n: number | string | null | undefined, opts: { zero?: string } = {}) => {
  const v = Number(n || 0)
  if (v === 0 && opts.zero !== undefined) return opts.zero
  return v.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₽'
}
export const dateRu = (s?: string | null) => (s ? new Date(s.length === 10 ? s + 'T00:00:00' : s).toLocaleDateString('ru-RU') : '—')
const MONTHS = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь']
export const monthRu = (s?: string | null) => {
  if (!s) return '—'
  const [y, m] = s.slice(0, 7).split('-')
  const name = MONTHS[Number(m) - 1] || ''
  return name.charAt(0).toUpperCase() + name.slice(1) + ' ' + y
}
export const today = () => new Date().toISOString().slice(0, 10)
export const monthStart = (d = new Date()) => new Date(Date.UTC(d.getFullYear(), d.getMonth(), 1)).toISOString().slice(0, 10)

export function Page({ title, actions, children }: { title?: string; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gap: 16, color: C.text }}>
      {(title || actions) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {title && <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, flex: 1, minWidth: 200 }}>{title}</h2>}
          {actions && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginLeft: 'auto' }}>{actions}</div>}
        </div>
      )}
      {children}
    </div>
  )
}

export function Card({ title, actions, children, pad = true }: { title?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode; pad?: boolean }) {
  return (
    <section style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, overflow: 'hidden' }}>
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

type BtnKind = 'primary' | 'secondary' | 'danger' | 'ghost'
export function Button({ kind = 'secondary', small, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { kind?: BtnKind; small?: boolean }) {
  const s: Record<BtnKind, React.CSSProperties> = {
    primary: { background: C.accent, color: '#fff', border: `1px solid ${C.accent}` },
    secondary: { background: '#fff', color: C.text, border: `1px solid ${C.line}` },
    danger: { background: '#fff', color: C.red, border: `1px solid #fecaca` },
    ghost: { background: 'transparent', color: C.accent, border: '1px solid transparent' },
  }
  return (
    <button {...p} style={{
      ...s[kind], borderRadius: 7, padding: small ? '4px 10px' : '7px 14px', fontSize: small ? 12 : 13, fontWeight: 500,
      fontFamily: 'inherit', cursor: p.disabled ? 'default' : 'pointer', opacity: p.disabled ? 0.55 : 1, whiteSpace: 'nowrap', ...p.style,
    }} />
  )
}

type Tone = 'neutral' | 'green' | 'red' | 'amber' | 'blue'
export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: React.ReactNode }) {
  const t: Record<Tone, [string, string]> = {
    neutral: ['#f1f5f9', '#475569'], green: [C.greenBg, C.green], red: [C.redBg, C.red], amber: [C.amberBg, C.amber], blue: [C.accentBg, C.accent],
  }
  return <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 10, fontSize: 12, fontWeight: 500, background: t[tone][0], color: t[tone][1], whiteSpace: 'nowrap' }}>{children}</span>
}

export function Stat({ label, value, tone }: { label: string; value: React.ReactNode; tone?: 'red' | 'green' | 'amber' }) {
  const color = tone === 'red' ? C.red : tone === 'green' ? C.green : tone === 'amber' ? C.amber : C.text
  return (
    <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, padding: '12px 16px' }}>
      <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 600, color, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
  )
}

export function Stats({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>{children}</div>
}

export interface Col<T> { key: string; title: React.ReactNode; render: (row: T) => React.ReactNode; align?: 'right' | 'left' | 'center'; width?: number | string }
export function Table<T>({ cols, rows, rowKey, onRow, empty = 'Нет данных', foot }: {
  cols: Col<T>[]; rows: T[]; rowKey: (r: T) => string; onRow?: (r: T) => void; empty?: string; foot?: React.ReactNode
}) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr>{cols.map(c => (
            <th key={c.key} style={{ textAlign: c.align || 'left', padding: '8px 12px', fontSize: 12, fontWeight: 500, color: C.muted, borderBottom: `1px solid ${C.line}`, whiteSpace: 'nowrap', width: c.width, background: '#fafbfd' }}>{c.title}</th>
          ))}</tr>
        </thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={cols.length} style={{ padding: 24, textAlign: 'center', color: C.faint }}>{empty}</td></tr>}
          {rows.map(r => (
            <tr key={rowKey(r)} onClick={onRow ? () => onRow(r) : undefined} style={{ cursor: onRow ? 'pointer' : undefined }}
              onMouseEnter={e => { if (onRow) e.currentTarget.style.background = '#f8f9fd' }} onMouseLeave={e => { e.currentTarget.style.background = '' }}>
              {cols.map(c => (
                <td key={c.key} style={{ textAlign: c.align || 'left', padding: '8px 12px', borderBottom: `1px solid ${C.line}`, verticalAlign: 'top', fontVariantNumeric: c.align === 'right' ? 'tabular-nums' : undefined, whiteSpace: c.align === 'right' ? 'nowrap' : undefined }}>{c.render(r)}</td>
              ))}
            </tr>
          ))}
        </tbody>
        {foot && <tfoot>{foot}</tfoot>}
      </table>
    </div>
  )
}

export const inputStyle: React.CSSProperties = {
  width: '100%', border: `1px solid ${C.line}`, borderRadius: 7, padding: '7px 10px', fontSize: 14, fontFamily: 'inherit',
  outline: 'none', boxSizing: 'border-box', background: '#fff', color: C.text,
}
export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label style={{ display: 'grid', gap: 4, fontSize: 12, color: C.muted, fontWeight: 500 }}>
      {label}
      {children}
      {hint && <span style={{ fontWeight: 400, color: C.faint }}>{hint}</span>}
    </label>
  )
}

export function Modal({ title, onClose, children, footer, width = 480 }: { title: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode; width?: number }) {
  return (
    <div onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(26,34,64,.35)', display: 'grid', placeItems: 'center', zIndex: 1000, padding: 16 }}>
      <div role="dialog" aria-label={title} style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: width, maxHeight: 'calc(100vh - 32px)', overflow: 'auto', boxShadow: '0 20px 50px rgba(0,0,0,.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '14px 18px', borderBottom: `1px solid ${C.line}` }}>
          <div style={{ flex: 1, fontWeight: 600 }}>{title}</div>
          <button onClick={onClose} aria-label="Закрыть" style={{ border: 0, background: 'none', fontSize: 20, lineHeight: 1, cursor: 'pointer', color: C.muted }}>×</button>
        </div>
        <div style={{ padding: 18, display: 'grid', gap: 12 }}>{children}</div>
        {footer && <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 18px', borderTop: `1px solid ${C.line}` }}>{footer}</div>}
      </div>
    </div>
  )
}

export function Notice({ tone = 'neutral', children }: { tone?: 'neutral' | 'red' | 'green' | 'amber'; children: React.ReactNode }) {
  const t = { neutral: ['#f8fafc', C.muted], red: [C.redBg, C.red], green: [C.greenBg, C.green], amber: [C.amberBg, C.amber] }[tone]
  return <div style={{ background: t[0], color: t[1], borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>{children}</div>
}

export function Tabs<K extends string>({ tabs, value, onChange }: { tabs: [K, string][]; value: K; onChange: (k: K) => void }) {
  return (
    <div style={{ display: 'flex', gap: 4, borderBottom: `1px solid ${C.line}`, overflowX: 'auto' }}>
      {tabs.map(([k, label]) => (
        <button key={k} onClick={() => onChange(k)} style={{
          border: 0, background: 'none', padding: '8px 12px', fontSize: 13, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap',
          color: value === k ? C.accent : C.muted, fontWeight: value === k ? 600 : 500, borderBottom: `2px solid ${value === k ? C.accent : 'transparent'}`, marginBottom: -1,
        }}>{label}</button>
      ))}
    </div>
  )
}

export function Loading() { return <div style={{ padding: 24, color: C.faint }}>Загрузка…</div> }
