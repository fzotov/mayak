// Миниатюры фото из закрытого хранилища: временные ссылки, касание открывает фото целиком.
import { useEffect, useState } from 'react'
import { storedFileUrl, openStoredFile } from '../lib/api'
import { C } from './ui'

function Thumb({ url, size }: { url: string; size: number }) {
  const [src, setSrc] = useState('')
  useEffect(() => { let live = true; storedFileUrl(url).then(s => { if (live) setSrc(s) }).catch(() => {}); return () => { live = false } }, [url])
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
