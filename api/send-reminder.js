// POST /api/send-reminder — напоминание арендатору о задолженности: письмо и уведомление в кабинет.
import { requireStaff, admin, APP_URL } from './_lib/auth.js'
import { sendMail, letter } from './_lib/mail.js'
import { validEmail, normEmail } from './_lib/tokens.js'

const rub = n => Number(n).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₽'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  if (!(await requireStaff(req, res))) return
  const tenantId = req.body?.tenantId
  if (!tenantId) return res.status(400).json({ ok: false, error: 'Не указан арендатор' })

  const db = admin()
  const { data: saldo, error } = await db.rpc('tenant_saldo')
  if (error) return res.status(500).json({ ok: false, error: error.message })
  const s = (saldo || []).find(r => r.tenant_id === tenantId)
  if (!s || Number(s.balance) <= 0) return res.status(400).json({ ok: false, error: 'У арендатора нет задолженности' })
  const { data: tenant } = await db.from('tenants').select('full_name, email, contact_email').eq('id', tenantId).single()
  const to = [tenant?.email, tenant?.contact_email].map(normEmail).find(validEmail)
  if (!to) return res.status(400).json({ ok: false, error: 'У арендатора не указана почта' })

  const lines = (s.articles || []).filter(a => Number(a.debt) > 0).map(a => `${a.name}: ${rub(a.debt)}`)
  try {
    await sendMail({
      to,
      subject: `Задолженность по аренде ${rub(s.balance)} — БЦ «Маяк»`,
      html: letter({
        title: 'Напоминание об оплате',
        paragraphs: [
          `Здравствуйте! По данным бизнес-центра «Маяк» у ${tenant.full_name} задолженность ${rub(s.balance)}${Number(s.overdue) > 0 ? `, из них просрочено ${rub(s.overdue)}` : ''}.`,
          lines.length ? 'Состав: ' + lines.join('; ') + '.' : '',
          'Счета с реквизитами и QR-кодом для оплаты — в кабинете арендатора. Если вы уже оплатили, не обращайте внимания на это письмо: оплата отразится после поступления в банк.',
        ].filter(Boolean),
        buttonText: 'Открыть кабинет',
        buttonUrl: `${APP_URL}/tenant/invoices`,
      }),
    })
    await db.from('tenant_notifications').insert({
      tenant_id: tenantId, type: 'reminder', title: `Задолженность ${rub(s.balance)}`,
      body: lines.join('; ') || null, link: '/tenant/invoices',
    })
    await db.from('audit_log').insert({ action: 'debt.reminder', entity: 'tenants', entity_id: tenantId, data: { to, balance: s.balance } })
    res.status(200).json({ ok: true, to })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
}
