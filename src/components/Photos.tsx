// Миниатюры фото из закрытого хранилища: временные ссылки, касание открывает фото целиком.
import { storedFileUrl, openStoredFile } from '../lib/api'
import { useSb } from '../lib/query'
import { C } from './ui'

function Thumb({ url, size }: { url: string; size: number }) {
  // временная ссылка живёт час — держим её в кеше 50 минут, ошибку не показываем (миниатюра просто пустая)
  const src = useSb(['storage:signed', url], () => storedFileUrl(url), { staleTime: 50 * 60_000, gcTime: 50 * 60_000, retry: 0 }).data || ''
  return (
    <button type="button" onClick={() => openStoredFile(url)} aria-label="Открыть фото"
      style={{ width: size, height: size, padding: 0, border: `1px solid ${C.line}`, borderRadius: C.radiusSm, overflow: 'hidden', background: C.hover, cursor: 'pointer', flexShrink: 0 }}>
      {src && <img src={src} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
    </button>
  )
}

export function PhotoThumbs({ urls, label, size = 64 }: { urls?: string[] | null; label?: string; size?: number }) {
  if (!urls?.length) return null
  return (
    <div style={{ display: 'grid', gap: 4 }}>
      {label && <div style={{ fontSize: 12, color: C.muted }}>{label} · {urls.length}</div>}
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
        {urls.map(u => <Thumb key={u} url={u} size={size} />)}
      </div>
    </div>
  )
}
