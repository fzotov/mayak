// POST /api/send-tenant-invite — сотрудник приглашает арендатора в кабинет.
import { requireStaff, admin, APP_URL } from './_lib/auth.js'
import { issueToken, normEmail, validEmail } from './_lib/tokens.js'
import { sendMail, letter } from './_lib/mail.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  if (!(await requireStaff(req, res))) return

  const tenantId = req.body?.tenantId
  const email = normEmail(req.body?.email)
  if (!tenantId || !validEmail(email)) return res.status(400).json({ ok: false, error: 'Нужны арендатор и корректный email' })

  const { data: tenant } = await admin().from('tenants').select('id, full_name, unit_number').eq('id', tenantId).maybeSingle()
  if (!tenant) return res.status(404).json({ ok: false, error: 'Арендатор не найден' })

  try {
    const token = await issueToken({ kind: 'tenant_invite', email, tenantId, ttlHours: 7 * 24 })
    await sendMail({
      to: email,
      subject: 'Приглашение в кабинет арендатора БЦ «Маяк»',
      html: letter({
        title: 'Кабинет арендатора',
        paragraphs: [
          `Здравствуйте! Для ${tenant.full_name} открыт доступ в кабинет арендатора бизнес-центра «Маяк»${tenant.unit_number ? ` (помещение ${tenant.unit_number})` : ''}.`,
          'В кабинете — взаиморасчёты, счета, показания счётчиков и заявки на ремонт. Нажмите кнопку и задайте пароль. Ссылка действует 7 дней.',
        ],
        buttonText: 'Задать пароль и войти',
        buttonUrl: `${APP_URL}/tenant/activate?token=${token}`,
        note: 'Если вы не ждали этого письма — просто не открывайте ссылку.',
      }),
    })
    await admin().from('tenant_users').update({ invited_at: new Date().toISOString() }).eq('tenant_id', tenantId).eq('email', email)
    res.status(200).json({ ok: true })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
}
