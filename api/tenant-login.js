import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
)

function verifyPassword(password, stored) {
  try {
    const [salt, hash] = stored.split(':')
    const testHash = crypto.scryptSync(password, salt, 64).toString('hex')
    return hash === testHash
  } catch {
    return false
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { email, password } = req.body
  if (!email || !password) return res.status(400).json({ ok: false, error: 'email and password required' })

  const { data, error } = await supabase
    .from('tenant_portal_access')
    .select('*')
    .eq('email', email)
    .single()

  if (error || !data) return res.status(401).json({ ok: false, error: 'Пользователь не найден' })
  if (data.status === 'blocked') return res.status(403).json({ ok: false, error: 'Аккаунт заблокирован' })
  if (!data.password_hash) return res.status(401).json({ ok: false, error: 'Пароль не установлен. Воспользуйтесь ссылкой из письма.' })

  if (!verifyPassword(password, data.password_hash)) {
    return res.status(401).json({ ok: false, error: 'Неверный пароль' })
  }

  const sessionToken = crypto.randomBytes(32).toString('hex')

  await supabase
    .from('tenant_portal_access')
    .update({ session_token: sessionToken, last_login_at: new Date().toISOString(), status: 'active' })
    .eq('id', data.id)

  res.status(200).json({
    ok: true,
    sessionToken,
    tenantId: data.tenant_id,
    email: data.email,
  })
}
