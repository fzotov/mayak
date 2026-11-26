// Загрузка данных через react-query. Правила для всех экранов:
//  • ключ запроса начинается с имени таблицы, представления или функции базы: ['tenants'], ['tenants', id], ['rpc:tenant_saldo'];
//  • действие (useAction) после успеха обновляет перечисленные таблицы: invalidate: ['tenants', 'leases'] —
//    обновятся все запросы, чей ключ начинается с этих имён, на любом открытом экране;
//  • ошибка базы — исключение с понятным текстом (sb / sbRpc), экран показывает её через <QueryState> или action.error.
import { QueryClient, useMutation, useQuery, useQueryClient, type UseQueryOptions, type QueryKey } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { supabase } from './supabase'
import type { Database } from './database.types'
import { Loading, Empty, ErrorBox } from '../components/ui'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: true },
    mutations: { retry: 0 },
  },
})

type SbResult<T> = { data: T; error: { message: string } | null }

/** Результат запроса supabase или исключение с текстом ошибки базы. */
export async function sb<T>(q: PromiseLike<SbResult<T>>): Promise<NonNullable<T>> {
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return data as NonNullable<T>
}

type Fn = Database['public']['Functions']
/** Вызов функции базы с типами аргументов и результата; ошибка — исключение. */
export async function sbRpc<K extends keyof Fn>(fn: K, args?: Fn[K]['Args']): Promise<Fn[K]['Returns']> {
  // supabase-js типизирует rpc по имени; обобщённый K приходится провести через приведение один раз здесь
  const { data, error } = await (supabase.rpc.bind(supabase) as unknown as (f: string, a?: object) => PromiseLike<SbResult<Fn[K]['Returns']>>)(fn as string, args)
  if (error) throw new Error(error.message)
  return data
}

export function errText(e: unknown): string {
  return e instanceof Error ? e.message : typeof e === 'string' ? e : 'Неизвестная ошибка'
}

/** Запрос с кешем. key — см. правила вверху файла. */
export function useSb<T>(key: QueryKey, fn: () => Promise<T>, opts: Omit<UseQueryOptions<T, Error>, 'queryKey' | 'queryFn'> = {}) {
  return useQuery<T, Error>({ queryKey: key, queryFn: fn, ...opts })
}

/** Действие (запись в базу). После успеха обновляет запросы перечисленных таблиц. */
export function useAction<A, R = unknown>(fn: (a: A) => Promise<R>, opts: { invalidate?: string[]; onSuccess?: (r: R, a: A) => void } = {}) {
  const qc = useQueryClient()
  const m = useMutation<R, Error, A>({
    mutationFn: fn,
    onSuccess: async (r, a) => {
      if (opts.invalidate?.length) {
        await qc.invalidateQueries({ predicate: q => opts.invalidate!.includes(String(q.queryKey[0])) })
      }
      opts.onSuccess?.(r, a)
    },
  })
  return { ...m, error: m.error ? m.error.message : '' }
}

/** Обновить запросы таблиц вручную (например, после действия вне useAction). */
export function useInvalidate() {
  const qc = useQueryClient()
  return (...tables: string[]) => qc.invalidateQueries({ predicate: q => tables.includes(String(q.queryKey[0])) })
}

/** Три состояния запроса: загрузка, ошибка (с повтором), пусто; иначе — содержимое. */
export function QueryState<T>({ q, empty, isEmpty, children }: {
  q: { isPending: boolean; error: Error | null; data: T | undefined; refetch: () => unknown }
  empty?: ReactNode
  isEmpty?: (d: T) => boolean
  children: (d: T) => ReactNode
}) {
  if (q.isPending) return <Loading />
  if (q.error) return <ErrorBox error={q.error.message} onRetry={() => q.refetch()} />
  const d = q.data as T
  const none = isEmpty ? isEmpty(d) : Array.isArray(d) && d.length === 0
  if (none && empty !== undefined) return <Empty>{empty}</Empty>
  return <>{children(d)}</>
}
