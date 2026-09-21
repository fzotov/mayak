import { useEffect, useState } from 'react'
import LeadForm from './LeadForm'
import { CONTACTS, fmtArea, fmtMoney, fmtNumber } from './siteConfig'
import type { PublicUnit } from './useSiteUnits'

/** YouTube/Rutube/VK → ссылка для встраивания, иначе null (покажем как обычное видео). */
function embedUrl(url: string): string | null {
  const yt = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{6,})/)
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`
  if (/rutube\.ru\/video\//.test(url)) return url.replace('/video/', '/play/embed/')
  if (/vk\.com\/video_ext/.test(url)) return url
  return null
}

const INCLUDED_SHORT = [
  'Коммунальные услуги в ставке',
  'Кондиционер и вентиляция',
  'Интернет бесплатно для новых арендаторов',
  'Юридический адрес и документы для регистрации',
  'Охрана, видеонаблюдение, парковка',
  'Свежий косметический ремонт',
]

export default function UnitModal({ unit, onClose }: { unit: PublicUnit; onClose: () => void }) {
  const media = [...unit.photos, ...(unit.video ? [unit.video] : [])]
  const [active, setActive] = useState(0)
  const current = media[active]
  const isVideo = !!current && (current === unit.video)

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', esc)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', esc); document.body.style.overflow = '' }
  }, [onClose])

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal__box" onClick={e => e.stopPropagation()}>
        <div className="modal__head">
          <div>
            <div className="modal__title">Офис №{fmtNumber(unit.number)}</div>
            <div className="muted" style={{ fontSize: 14 }}>{unit.floor} этаж · {fmtArea(unit.area)}</div>
          </div>
          <button className="modal__x" onClick={onClose} aria-label="Закрыть">✕</button>
        </div>

        <div className="modal__grid">
          <div className="gallery">
            <div className="gallery__main" style={current ? undefined : { aspectRatio: '16 / 6' }}>
              {!current ? (
                <div className="card__ph"><span>🏢</span>Фотографии этого офиса готовим.<br />Покажем помещение на просмотре — запишитесь.</div>
              ) : isVideo ? (
                embedUrl(current)
                  ? <iframe src={embedUrl(current)!} allow="autoplay; fullscreen" allowFullScreen title={`Видео офиса ${unit.number}`} />
                  : <video src={current} controls playsInline />
              ) : (
                <img src={current} alt={`Офис №${unit.number}, ${unit.area} м²`} loading="lazy" />
              )}
            </div>
            {media.length > 1 && (
              <div className="gallery__thumbs">
                {media.map((m, i) => (
                  <button key={m} className={i === active ? 'is-on' : ''} onClick={() => setActive(i)} aria-label={`Фото ${i + 1}`}>
                    {m === unit.video
                      ? <div style={{ display: 'grid', placeItems: 'center', height: '100%', fontSize: 18 }}>▶</div>
                      : <img src={m} alt="" loading="lazy" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="specs">
              <div className="spec"><div className="spec__l">Площадь</div><div className="spec__v">{fmtArea(unit.area)}</div></div>
              <div className="spec"><div className="spec__l">Этаж</div><div className="spec__v">{unit.floor}</div></div>
              <div className="spec">
                <div className="spec__l">Ставка</div>
                <div className="spec__v">{unit.rate ? `${fmtMoney(unit.rate)}/м²` : 'по запросу'}</div>
              </div>
              <div className="spec">
                <div className="spec__l">В месяц</div>
                <div className="spec__v">{unit.monthly ? fmtMoney(unit.monthly) : 'по запросу'}</div>
              </div>
            </div>

            {unit.description && <p style={{ fontSize: 15, color: 'var(--ink-2)', marginBottom: 14 }}>{unit.description}</p>}

            <ul className="checklist">
              {INCLUDED_SHORT.map(i => <li key={i}>{i}</li>)}
            </ul>

            <LeadForm
              source="unit"
              unitNumber={unit.number}
              areaWanted={unit.area}
              submitLabel="Записаться на просмотр"
              note={`Перезвоним и покажем офис №${fmtNumber(unit.number)} в удобное время, в том числе сегодня. Или сразу: ${CONTACTS.phone}`}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
