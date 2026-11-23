// Общие элементы кабинета арендатора: одна тёмная тема, крупные зоны нажатия для телефона.
import type { CSSProperties, ReactNode } from 'react'

export const T = {
  bg: '#0a0a0a', surface: '#111', raised: '#161616', border: '#1f1f1f', text: '#ededed', sub: '#a1a1a1', muted: '#737373',
  ok: '#3ecf8e', warn: '#f5a524', bad: '#ff6166', accent: '#fff',
  font: '"Geist", system-ui, -apple-system, sans-serif',
}

export const money = (n: number | null | undefined) =>
  Number(n || 0).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₽'
export const date = (s?: string | null) => (s ? new Date(s).toLocaleDateString('ru-RU') : '—')

export function Card({ children, style, pad = 18 }: { children: ReactNode; style?: CSSProperties; pad?: number }) {
  return <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: pad, ...style }}>{children}</div>
}

export function Title({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
      <h2 style={{ margin: 0, fontSize: 13, fontWeight: 500, color: T.muted, letterSpacing: '.4px', textTransform: 'uppercase' }}>{children}</h2>
      {right}
    </div>
  )
}

export function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '11px 0', borderTop: `1px solid ${T.border}`, fontSize: 14 }}>
      <span style={{ color: T.muted, flexShrink: 0 }}>{label}</span>
      <span style={{ color: T.text, textAlign: 'right', wordBreak: 'break-word' }}>{value || '—'}</span>
    </div>
  )
}

export function Badge({ children, tone = 'muted' }: { children: ReactNode; tone?: 'ok' | 'warn' | 'bad' | 'muted' }) {
  const c = { ok: T.ok, warn: T.warn, bad: T.bad, muted: T.sub }[tone]
  return <span style={{ display: 'inline-block', padding: '2px 9px', borderRadius: 20, fontSize: 12, fontWeight: 500, color: c, border: `1px solid ${c}44`, background: `${c}14`, whiteSpace: 'nowrap' }}>{children}</span>
}

export const input: CSSProperties = {
  width: '100%', padding: 12, background: '#0f0f0f', border: `1px solid ${T.border}`, borderRadius: 8,
  fontSize: 16, color: T.text, outline: 'none', fontFamily: T.font, boxSizing: 'border-box',
}
export const label: CSSProperties = { display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: T.sub }

export function Button({ children, onClick, disabled, kind = 'primary', type = 'button', full }: { children: ReactNode; onClick?: () => void; disabled?: boolean; kind?: 'primary' | 'ghost'; type?: 'button' | 'submit'; full?: boolean }) {
  const primary = kind === 'primary'
  return (
    <button type={type} onClick={onClick} disabled={disabled} style={{
      minHeight: 44, padding: '0 18px', borderRadius: 8, fontSize: 15, fontWeight: 500, fontFamily: T.font, cursor: disabled ? 'default' : 'pointer',
      width: full ? '100%' : undefined, opacity: disabled ? 0.5 : 1,
      background: primary ? T.accent : 'transparent', color: primary ? '#000' : T.text, border: primary ? 'none' : `1px solid ${T.border}`,
    }}>{children}</button>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <div style={{ padding: '28px 12px', textAlign: 'center', color: T.muted, fontSize: 14, lineHeight: 1.6 }}>{children}</div>
}
export function Loading() { return <div style={{ padding: 40, textAlign: 'center', color: T.muted, fontSize: 14 }}>Загрузка…</div> }
export function Note({ children, tone = 'bad' }: { children: ReactNode; tone?: 'ok' | 'bad' }) {
  const c = tone === 'ok' ? T.ok : T.bad
  return <div style={{ background: `${c}14`, border: `1px solid ${c}33`, borderRadius: 8, padding: '10px 12px', fontSize: 13, color: c, marginTop: 12 }}>{children}</div>
}
export const page: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 760, margin: '0 auto', fontFamily: T.font, color: T.text }
