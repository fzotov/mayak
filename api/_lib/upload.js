// Сохранение фото, присланного арендатором (base64 JPEG), в закрытое хранилище.
import { admin } from './auth.js'

const URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL

/** Возвращает адрес вида …/storage/v1/object/public/<bucket>/<path> (открывается подписанной ссылкой). */
export async function savePhoto(bucket, path, base64) {
  const buf = Buffer.from(String(base64 || ''), 'base64')
  if (buf.length < 100 || buf.length > 3 * 1024 * 1024) throw new Error('Фото слишком большое или повреждено')
  if (!(buf[0] === 0xff && buf[1] === 0xd8)) throw new Error('Нужен снимок в формате JPEG')
  const { error } = await admin().storage.from(bucket).upload(path, buf, { contentType: 'image/jpeg', upsert: false })
  if (error) throw new Error('Не удалось сохранить фото: ' + error.message)
  return `${URL}/storage/v1/object/public/${bucket}/${path}`
}
