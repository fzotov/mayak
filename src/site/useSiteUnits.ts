import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { ALL_ROOMS, unitKey, unitKeys, type Room } from '../lib/floorGeometry'
import { RATE_MAX, RATE_MIN } from './siteConfig'

export type UnitStatus = 'free' | 'occupied' | 'reserved'

export type PublicUnit = {
  key: string
  id: string | null
  number: string
  floor: number
  area: number
  status: UnitStatus
  /** Ставка ₽/м²/мес — только если выглядит правдоподобно, иначе null («по запросу»). */
  rate: number | null
  monthly: number | null
  photos: string[]
  video: string | null
  description: string | null
  room: Room | null
}

const sane = (r: unknown): number | null => {
  const n = Number(r)
  return Number.isFinite(n) && n >= RATE_MIN && n <= RATE_MAX ? n : null
}

const isVideo = (url: string) => /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url) || /youtu\.?be|vk\.com|rutube/i.test(url)

/**
 * Список помещений для сайта: план этажей — источник состава и площадей,
 * таблица units — источник статуса, цены, фото и описания.
 * Помещение показывается свободным, только если это явно указано в базе.
 */
export function useSiteUnits() {
  const [units, setUnits] = useState<PublicUnit[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    supabase.from('units').select('*').then(({ data }) => {
      if (!alive) return
      const byKey = new Map<string, any>()
      for (const u of data || []) for (const k of unitKeys(u.number)) if (!byKey.has(k)) byKey.set(k, u)

      const list: PublicUnit[] = ALL_ROOMS.map(({ floor, room }) => {
        const db = unitKeys(room.number).map(k => byKey.get(k)).find(Boolean)
        const photosRaw: string[] = Array.isArray(db?.photos) ? db.photos.filter(Boolean) : []
        const rate = sane(db?.rent_rate)
        const area = Number(db?.area) > 5 ? Number(db.area) : room.area
        const published = db?.is_published !== false
        const status: UnitStatus = db?.status === 'free' && published ? 'free'
          : db?.status === 'reserved' ? 'reserved'
          : 'occupied'
        return {
          key: unitKey(room.number),
          id: db?.id ?? null,
          number: room.number,
          floor,
          area,
          status,
          rate,
          monthly: rate ? rate * area : null,
          photos: photosRaw.filter(p => !isVideo(p)),
          video: db?.video_url || photosRaw.find(isVideo) || null,
          description: db?.description || null,
          room,
        }
      })
      setUnits(list)
      setLoading(false)
    }, () => { if (alive) { setUnits(fallback()); setLoading(false) } })
    return () => { alive = false }
  }, [])

  const free = units.filter(u => u.status === 'free')
  const rates = free.map(u => u.rate).filter((r): r is number => r !== null)

  return {
    units,
    free,
    loading,
    minRate: rates.length ? Math.min(...rates) : null,
    minArea: units.length ? Math.min(...units.map(u => u.area)) : null,
    maxArea: units.length ? Math.max(...units.map(u => u.area)) : null,
  }
}

/** Если база недоступна — показываем состав здания без статусов, но с телефоном и формой. */
function fallback(): PublicUnit[] {
  return ALL_ROOMS.map(({ floor, room }) => ({
    key: unitKey(room.number), id: null, number: room.number, floor, area: room.area,
    status: 'occupied' as UnitStatus, rate: null, monthly: null,
    photos: [], video: null, description: null, room,
  }))
}
