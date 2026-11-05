import type { MetadataRoute } from 'next'
import { getOffices } from '@/lib/offices'
import { SITE } from '@/lib/site'

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  const pages = ['', '/offices', '/services', '/contacts'].map(path => ({
    url: `${SITE.url}${path}`,
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: path === '' ? 1 : 0.8,
  }))
  const offices = getOffices().map(office => ({
    url: `${SITE.url}/offices/${office.id}`,
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: office.status === 'available' ? 0.9 : 0.5,
  }))
  return [...pages, ...offices]
}
