// Общие элементы кабинета арендатора: одна тёмная тема, крупные зоны нажатия для телефона.
import { type CSSProperties, type ReactNode } from 'react'
import { openStoredFile, storedFileUrl } from '../../lib/api'
import { useSb } from '../../lib/query'

export const T = {
  bg: 'var(--bg)', surface: 'var(--surface)', raised: 'var(--surface-2)', border: 'var(--border)', text: 'var(--text)', sub: 'var(--text-2)', muted: 'var(--text-3)',
  ok: 'var(--green)', warn: 'var(--amber)', bad: 'var(--red)', accent: 'var(--text)',
  font: 'var(--font)',
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
  const [c, bg] = { ok: [T.ok, 'var(--green-bg)'], warn: [T.warn, 'var(--amber-bg)'], bad: [T.bad, 'var(--red-bg)'], muted: [T.sub, 'var(--hover)'] }[tone]
  return <span style={{ display: 'inline-block', padding: '2px 9px', borderRadius: 20, fontSize: 12, fontWeight: 500, color: c, border: `1px solid ${bg}`, background: bg, whiteSpace: 'nowrap' }}>{children}</span>
}

export const input: CSSProperties = {
  width: '100%', padding: 12, background: 'var(--surface)', border: `1px solid ${T.border}`, borderRadius: 8,
  fontSize: 16, color: T.text, outline: 'none', fontFamily: 'var(--font)', boxSizing: 'border-box',
}
export const label: CSSProperties = { display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: T.sub }

export function Button({ children, onClick, disabled, kind = 'primary', type = 'button', full }: { children: ReactNode; onClick?: () => void; disabled?: boolean; kind?: 'primary' | 'ghost'; type?: 'button' | 'submit'; full?: boolean }) {
  const primary = kind === 'primary'
  return (
    <button type={type} onClick={onClick} disabled={disabled} style={{
      minHeight: 44, padding: '0 18px', borderRadius: 8, fontSize: 15, fontWeight: 500, fontFamily: 'var(--font)', cursor: disabled ? 'default' : 'pointer',
      width: full ? '100%' : undefined, opacity: disabled ? 0.5 : 1,
      background: primary ? T.accent : 'transparent', color: primary ? 'var(--bg)' : T.text, border: primary ? 'none' : `1px solid ${T.border}`,
    }}>{children}</button>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <div style={{ padding: '28px 12px', textAlign: 'center', color: T.muted, fontSize: 14, lineHeight: 1.6 }}>{children}</div>
}
export function Loading() { return <div style={{ padding: 40, textAlign: 'center', color: T.muted, fontSize: 14 }}>Загрузка…</div> }
export function Note({ children, tone = 'bad' }: { children: ReactNode; tone?: 'ok' | 'bad' }) {
  const c = tone === 'ok' ? T.ok : T.bad
  const bg = tone === 'ok' ? 'var(--green-bg)' : 'var(--red-bg)'
  return <div style={{ background: bg, border: `1px solid ${tone === 'ok' ? 'var(--green-bg)' : 'var(--red-border)'}`, borderRadius: 8, padding: '10px 12px', fontSize: 13, color: c, marginTop: 12 }}>{children}</div>
}
export const page: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 760, margin: '0 auto', fontFamily: 'var(--font)', color: T.text }

/** Миниатюры фото из закрытого хранилища: временные ссылки, нажатие открывает фото целиком. */
export function StoredPhotos({ urls, caption }: { urls?: string[] | null; caption: string }) {
  const key = (urls || []).join('|')
  // временные ссылки живут час — держим их в кеше не дольше получаса
  const q = useSb(['storage:signed', key], () => Promise.all((urls || []).map(u => storedFileUrl(u).catch(() => ''))), { enabled: !!urls?.length, staleTime: 30 * 60_000 })
  const signed = q.data ?? []
  if (!urls?.length) return null
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontSize: 12, color: T.muted, marginBottom: 6 }}>{caption}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {urls.map((u, i) => {
          const s = signed[i]
          const box: CSSProperties = { width: 72, height: 72, borderRadius: 8, border: `1px solid ${T.border}`, background: T.raised, overflow: 'hidden', display: 'block', flexShrink: 0 }
          return s
            ? <a key={u} href={s} target="_blank" rel="noopener" aria-label={`${caption}, фото ${i + 1}`} style={box}><img src={s} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} /></a>
            : <button key={u} type="button" onClick={() => openStoredFile(u)} aria-label={`${caption}, фото ${i + 1}`} style={{ ...box, padding: 0, cursor: 'pointer' }} />
        })}
      </div>
    </div>
  )
}

export function CameraIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M2 6a1.5 1.5 0 0 1 1.5-1.5h2l1.2-2h4.6l1.2 2h2A1.5 1.5 0 0 1 16 6v7.5A1.5 1.5 0 0 1 14.5 15h-11A1.5 1.5 0 0 1 2 13.5V6z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="9" cy="9.5" r="2.8" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}
