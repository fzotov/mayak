import type { NextConfig } from 'next'
import { OLD_OFFICE_REDIRECTS, OLD_PAGE_REDIRECTS } from './data/redirects'

const nextConfig: NextConfig = {
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  async redirects() {
    return [
      ...OLD_PAGE_REDIRECTS.map(r => ({ ...r, permanent: true })),
      // office.html?id=13 → /offices/217 и так далее — старые ссылки не теряются
      ...OLD_OFFICE_REDIRECTS.map(r => ({
        source: '/office.html',
        has: [{ type: 'query' as const, key: 'id', value: r.id }],
        destination: r.destination,
        permanent: true,
      })),
      { source: '/office.html', destination: '/offices', permanent: true },
    ]
  },
}

export default nextConfig
