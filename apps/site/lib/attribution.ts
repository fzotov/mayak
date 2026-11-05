/** Откуда пришёл посетитель — пригодится, когда появится реклама. */
export function collectAttribution(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  const params = new URLSearchParams(window.location.search)
  const utm: Record<string, string> = {}
  for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']) {
    const value = params.get(key)
    if (value) utm[key] = value.slice(0, 80)
  }
  if (document.referrer && !document.referrer.includes(window.location.host)) {
    utm.referrer = document.referrer.slice(0, 120)
  }
  return utm
}
