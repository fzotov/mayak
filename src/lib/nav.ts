// Переход по адресу админки из любого места (обработчики, диалоги). Ссылки в разметке — компонент Link из ui.tsx.
let navigateFn: ((to: string) => void) | null = null

export function setNavigator(fn: (to: string) => void) { navigateFn = fn }

export function go(to: string) {
  if (navigateFn) navigateFn(to)
  else window.location.assign(to)
}

/** Старые адреса вида /#/tenant-card/<id> (до 25.11.2026) переводятся на новые. */
export function legacyHashPath(hash: string): string | null {
  const m = hash.match(/^#\/([a-z-]+)(?:\/([^/?#]+))?/)
  if (!m) return null
  const [, page, id] = m
  const map: Record<string, string> = {
    dashboard: '/', 'tenant-card': '/tenants', 'tenant-new': '/tenants/new', 'import-tenants': '/tenants/import', 'invoice-detail': '/invoices',
  }
  const base = map[page] ?? '/' + page
  if (page === 'tenant-new' || page === 'import-tenants' || page === 'dashboard') return base
  return id ? `${base}/${id}` : base
}
