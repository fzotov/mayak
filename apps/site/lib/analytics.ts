/**
 * События для последующего подключения Яндекс.Метрики и GA.
 * Сейчас пишем в dataLayer и ym, если они есть; иначе тихо ничего не делаем.
 */
export type AnalyticsEvent =
  | 'quiz_step'
  | 'office_view'
  | 'floor_selected'
  | 'office_selected_on_map'
  | 'office_filter_used'
  | 'lead_form_open'
  | 'lead_form_submit'
  | 'phone_click'
  | 'route_click'

declare global {
  interface Window {
    dataLayer?: unknown[]
    ym?: (id: number, action: string, target: string, params?: Record<string, unknown>) => void
  }
}

export const YM_COUNTER = 31410123 // счётчик, который стоял на старом mayak-d.ru

export function track(event: AnalyticsEvent, params: Record<string, unknown> = {}) {
  if (typeof window === 'undefined') return
  try {
    window.dataLayer?.push({ event, ...params })
    window.ym?.(YM_COUNTER, 'reachGoal', event, params)
  } catch {
    // аналитика не должна ломать интерфейс
  }
}
