// POST /api/send-invoice — отправить арендатору счёт письмом и уведомлением в кабинет.
import { requireStaff, admin, APP_URL } from './_lib/auth.js'
import { sendMail, letter } from './_lib/mail.js'
import { validEmail, normEmail } from './_lib/tokens.js'

const rub = n => Number(n).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₽'
const MONTHS = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь']

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  if (!(await requireStaff(req, res))) return
  const invoiceId = req.body?.invoiceId
  if (!invoiceId) return res.status(400).json({ ok: false, error: 'Не указан счёт' })

  const db = admin()
  const { data: inv } = await db.from('v_invoice_state').select('*').eq('id', invoiceId).maybeSingle()
  if (!inv) return res.status(404).json({ ok: false, error: 'Счёт не найден' })
  const { data: tenant } = await db.from('tenants').select('id, full_name, email, contact_email').eq('id', inv.tenant_id).single()
  const to = [tenant?.email, tenant?.contact_email].map(normEmail).find(validEmail)
  if (!to) return res.status(400).json({ ok: false, error: 'У арендатора не указана почта' })

  const [y, m] = String(inv.period).split('-')
  const period = `${MONTHS[Number(m) - 1]} ${y}`
  const due = new Date(inv.due_date + 'T00:00:00').toLocaleDateString('ru-RU')
  const title = `Счёт № ${inv.number} за ${period}`
  try {
    await sendMail({
      to,
      subject: `${title} — БЦ «Маяк»`,
      html: letter({
        title,
        paragraphs: [
          `Здравствуйте! Для ${tenant.full_name} выставлен счёт № ${inv.number} на ${rub(inv.total)}. Оплатить до ${due}.`,
          Number(inv.open_amount) < Number(inv.total)
            ? `С учётом уже поступивших денег к оплате осталось ${rub(inv.open_amount)}.`
            : 'Счёт с реквизитами и QR-кодом для оплаты — в кабинете арендатора, раздел «Расчёты».',
        ],
        buttonText: 'Открыть кабинет',
        buttonUrl: `${APP_URL}/tenant/invoices`,
      }),
    })
    await db.from('invoices').update({ status: 'SENT' }).eq('id', invoiceId)
    await db.from('tenant_notifications').insert({
      tenant_id: inv.tenant_id, type: 'invoice', title,
      body: `К оплате ${rub(inv.open_amount)} до ${due}.`, link: '/tenant/invoices',
    })
    await db.from('audit_log').insert({ action: 'invoice.send', entity: 'invoices', entity_id: invoiceId, data: { to } })
    res.status(200).json({ ok: true, to })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
}
