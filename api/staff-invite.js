// POST /api/staff-invite — владелец выдаёт сотруднику доступ в систему.
// DELETE /api/staff-invite — владелец отзывает доступ.
import { requireStaff, admin, APP_URL } from './_lib/auth.js'
import { issueToken, normEmail, validEmail } from './_lib/tokens.js'
import { sendMail, letter } from './_lib/mail.js'

const ROLES = ['owner', 'manager']

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'DELETE') return res.status(405).end()
  const me = await requireStaff(req, res, ['owner'])
  if (!me) return

  if (req.method === 'DELETE') {
    const userId = req.body?.userId
    if (!userId) return res.status(400).json({ ok: false, error: 'userId обязателен' })
    if (userId === me.user.id) return res.status(400).json({ ok: false, error: 'Нельзя отозвать собственный доступ' })
    const { error } = await admin().from('profiles').delete().eq('user_id', userId)
    if (error) return res.status(500).json({ ok: false, error: error.message })
    await admin().auth.admin.signOut(userId).catch(() => {})
    return res.status(200).json({ ok: true })
  }

  const email = normEmail(req.body?.email)
  const fullName = String(req.body?.fullName || '').trim().slice(0, 120)
  const role = req.body?.role
  if (!validEmail(email) || !fullName || !ROLES.includes(role)) return res.status(400).json({ ok: false, error: 'Нужны имя, email и роль' })

  try {
    const token = await issueToken({ kind: 'staff_invite', email, payload: { full_name: fullName, role }, ttlHours: 72 })
    await sendMail({
      to: email,
      subject: 'Доступ в систему управления БЦ «Маяк»',
      html: letter({
        title: 'Доступ в систему «Маяк»',
        paragraphs: [`${fullName}, вам открыт доступ в систему управления бизнес-центром «Маяк».`, 'Нажмите кнопку и задайте пароль. Ссылка действует 3 дня.'],
        buttonText: 'Задать пароль и войти',
        buttonUrl: `${APP_URL}/tenant/activate?token=${token}`,
      }),
    })
    res.status(200).json({ ok: true })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
}
