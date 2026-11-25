import { supabase } from './supabase'

/** Вызов серверной функции от имени вошедшего пользователя. */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  const headers = new Headers(init.headers)
  if (token) headers.set('Authorization', 'Bearer ' + token)
  return fetch(path, { ...init, headers })
}

/** Открыть файл из закрытого хранилища по временной ссылке. Принимает сохранённый адрес или путь «бакет/путь». */
export async function openStoredFile(urlOrPath: string) {
  const m = urlOrPath.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/([^?]+)/)
  if (!m) { window.open(urlOrPath, '_blank', 'noopener'); return }
  const [, bucket, path] = m
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(decodeURIComponent(path), 300)
  if (error || !data?.signedUrl) { alert('Не удалось открыть файл'); return }
  window.open(data.signedUrl, '_blank', 'noopener')
}

/** Временная ссылка на файл из закрытого хранилища (для <img>). Чужие адреса возвращает как есть. */
export async function storedFileUrl(urlOrPath: string, seconds = 3600): Promise<string> {
  const m = urlOrPath.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/([^?]+)/)
  if (!m) return urlOrPath
  const { data } = await supabase.storage.from(m[1]).createSignedUrl(decodeURIComponent(m[2]), seconds)
  return data?.signedUrl || ''
}
