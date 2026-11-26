import { openStoredFile } from '../lib/api'
import { go } from '../lib/nav'
import { PAY_STATUS } from '../lib/accounting'
import { TenantJournal } from '../components/TenantJournal'
import { Page, Card, Row, Button, Badge, Field, Input, Select, Tabs, Table, Modal, Notice, Loading, Empty, ErrorBox, Muted, Sub, money, dateRu, telHref, useNarrow, C } from '../components/ui'
import { Icon } from '../components/icons'
import { TenantPortalAccess } from '../components/TenantPortalAccess'
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useSb, useAction, sb } from '../lib/query'
import type { Tables, TablesUpdate } from '../lib/database.types'
import { ask } from '../components/Dialogs'

// Tabs: Онбординг | Общие | Помещения | Счётчики | Счета | Документы | Договоры
const TABS = ['Онбординг', 'Общие', 'Помещения', 'Счётчики', 'Счета', 'Документы', 'Договоры', 'Обращения']
const TYPE_LABELS: Record<string, string> = { COMPANY: 'Юрлицо', IP: 'ИП', INDIVIDUAL: 'Физлицо', SELF_EMPLOYED: 'Самозанятый' }
const METER_LABELS: Record<string, string> = { electricity: 'Электричество', cold_water: 'Холодная вода', hot_water: 'Горячая вода' }
const METER_UNITS: Record<string, string> = { electricity: 'кВт·ч', cold_water: 'м³', hot_water: 'м³' }

// Перечень документов по типу — точно по внутреннему перечню БЦ «Маяк»
const DOC_TYPES_COMPANY = [
  { key: 'card', label: 'Карточка предприятия (реквизиты)', icon: '', required: true },
  { key: 'charter', label: 'Устав (заверен подписью и печатью)', icon: '', required: true },
  { key: 'egrul', label: 'Выписка из ЕГРЮЛ (не старше 1 нед.)', icon: '', required: true },
  { key: 'inn_doc', label: 'Копия ИНН (заверен)', icon: '', required: true },
  { key: 'director_order', label: 'Приказ о назначении руководителя', icon: '', required: true },
  { key: 'passport', label: 'Паспорт руководителя (фото + прописка)', icon: '', required: true },
  { key: 'poa', label: 'Доверенность (если подписывает не директор)', icon: '', required: false },
  { key: 'license', label: 'Лицензии/разрешения (если лицензируется)', icon: '', required: false },
  { key: 'brand_doc', label: 'Права на товарный знак / бренд', icon: '', required: false },
  { key: 'opd_consent', label: 'Согласие на обработку ПД', icon: '', required: true },
]
const DOC_TYPES_IP = [
  { key: 'passport', label: 'Паспорт ИП (фото + прописка)', icon: '', required: true },
  { key: 'inn_doc', label: 'Копия ИНН', icon: '', required: true },
  { key: 'ogrn', label: 'Свидетельство ОГРНИП', icon: '', required: true },
  { key: 'poa', label: 'Доверенность (если подписывает не ИП)', icon: '', required: false },
  { key: 'license', label: 'Лицензии/разрешения (галерея)', icon: '', required: false },
  { key: 'brand_doc', label: 'Права на товарный знак / бренд', icon: '', required: false },
  { key: 'opd_consent', label: 'Согласие на обработку ПД', icon: '', required: true },
]
const DOC_TYPES_INDIVIDUAL = [
  { key: 'passport', label: 'Паспорт (фото + прописка, или ВНЖ)', icon: '', required: true },
  { key: 'inn_doc', label: 'ИНН (при наличии)', icon: '', required: false },
  { key: 'opd_consent', label: 'Согласие на обработку ПД', icon: '', required: true },
]
const DOC_TYPES_SELF_EMPLOYED = [
  { key: 'passport', label: 'Паспорт (фото + прописка, или ВНЖ)', icon: '', required: true },
  { key: 'self_employed_cert', label: 'Справка о постановке на учёт (Мой налог / ФНС)', icon: '', required: true },
  { key: 'utility_bill', label: 'Квитанция ЖКХ по месту регистрации (посл. мес.)', icon: '', required: true },
  { key: 'bank_details', label: 'Банковские реквизиты', icon: '', required: true },
  { key: 'opd_consent', label: 'Согласие на обработку ПД', icon: '', required: true },
]
function getDocTypes(tenantType: string) {
  if (tenantType === 'IP') return DOC_TYPES_IP
  if (tenantType === 'INDIVIDUAL') return DOC_TYPES_INDIVIDUAL
  if (tenantType === 'SELF_EMPLOYED') return DOC_TYPES_SELF_EMPLOYED
  return DOC_TYPES_COMPANY
}

const CONTRACT_TYPES = [
  { key: 'lease', label: 'Договор аренды' },
  { key: 'handover', label: 'Акт приёма-передачи' },
  { key: 'addendum_rent', label: 'Доп. соглашение (аренда)' },
  { key: 'addendum_ad', label: 'Доп. соглашение (реклама)' },
  { key: 'elevator_letter', label: 'Письмо о пользовании лифтом' },
]

const emptyForm = {
  fullName: '', type: 'COMPANY', inn: '', kpp: '', ogrn: '', email: '', phone: '',
  legalAddress: '', bankAccount: '', correspondentAccount: '', bik: '', bank: '',
  directorName: '', directorPosition: 'Директор', directorBasis: 'Устав',
  passportSeries: '', passportNumber: '', passportIssuedBy: '', passportIssuedDate: '',
  contactName: '', contactPhone: '', contactEmail: '',
  contractNumber: '', contractStartDate: '', contractEndDate: '',
  rent: 0, onboardingStatus: 'not_started',
}

type PremiseRent = Tables<'premise_rents'>
type Premise = Tables<'tenant_premises'> & { rents: PremiseRent[] }
/** Документ из вкладки «Договоры» в окне правки. */
type ContractDraft = { id?: string; type: string; number: string; date: string; startDate: string; endDate: string; notes: string }
const byValidFromDesc = (a: PremiseRent, b: PremiseRent) => (b.valid_from || '').localeCompare(a.valid_from || '')

function toForm(data: Tables<'tenants'>): typeof emptyForm {
  return {
    fullName: data.full_name || '',
    type: data.type || 'COMPANY',
    inn: data.inn || '',
    kpp: data.kpp || '',
    ogrn: data.ogrn || '',
    email: data.email || '',
    phone: data.phone || '',
    legalAddress: data.legal_address || '',
    bankAccount: data.bank_account || '',
    correspondentAccount: data.correspondent_account || '',
    bik: data.bik || '',
    bank: data.bank_name || '',
    directorName: data.director_name || '',
    directorPosition: data.director_position || 'Директор',
    directorBasis: data.director_basis || 'Устав',
    passportSeries: data.passport_series || '',
    passportNumber: data.passport_number || '',
    passportIssuedBy: data.passport_issued_by || '',
    passportIssuedDate: data.passport_issued_date || '',
    contactName: data.contact_name || '',
    contactPhone: data.contact_phone || '',
    contactEmail: data.contact_email || '',
    contractNumber: data.contract_number || '',
    contractStartDate: data.contract_start_date || '',
    contractEndDate: data.contract_end_date || '',
    rent: data.monthly_rent || 0,
    onboardingStatus: data.onboarding_status || 'not_started',
  }
}

function Value({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 14, color: C.text, fontWeight: 500, minHeight: 20, wordBreak: 'break-word' }}>{children}</div>
}

function Toast({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', top: 20, right: 24, zIndex: 1100, boxShadow: C.shadow, borderRadius: 8 }}>
      <Notice tone="green">{children}</Notice>
    </div>
  )
}

function SuccessToast() {
  return <Toast>Изменения сохранены</Toast>
}

function Progress({ value, total, width }: { value: number; total: number; width: number }) {
  const pct = total > 0 ? (value / total) * 100 : 0
  return (
    <div style={{ width, height: 6, background: C.hover, borderRadius: 3, overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: value === total ? C.green : C.accent, borderRadius: 3, transition: 'width .3s' }} />
    </div>
  )
}

function printOPD(tenant: typeof emptyForm) {
  // Оператор — ИП Зотова Екатерина Викторовна, согласно реальному бланку
  const subject = tenant.type === 'COMPANY' ? tenant.directorName : tenant.fullName
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Согласие на обработку ПД</title>
  <style>body{font-family:'Times New Roman',serif;font-size:13pt;margin:2cm;line-height:1.6}
  h2{text-align:center;font-size:14pt}
  .blank{border-bottom:1px solid black;display:inline-block;min-width:200px;text-align:center}
  .sign-row{display:flex;gap:40px;margin-top:30px}
  .sign-block{flex:1;border-top:1px solid black;padding-top:4px;font-size:11pt;text-align:center}
  @media print{body{margin:1.5cm}}</style></head><body>
  <h2>СОГЛАСИЕ<br>на обработку персональных данных</h2>
  <p>Я (далее — Субъект), <span class="blank"><b>${subject || '___________________________'}</b></span>,<br>
  <small>(фамилия, имя, отчество субъекта персональных данных)</small></p>
  <p>Паспорт РФ <span class="blank">${tenant.passportSeries || '______'}</span> № <span class="blank">${tenant.passportNumber || '____________'}</span>,
  выдан <span class="blank">${tenant.passportIssuedBy || '___________________________'}</span>
  «___» _____________ года,</p>
  <p>зарегистрирован(а) по адресу: <span class="blank" style="min-width:350px">${tenant.legalAddress || '___________________________________'}</span>,</p>
  <p>даю своё согласие <b>Индивидуальному предпринимателю Зотовой Екатерине Викторовне</b>,
  находящейся по адресу: Московская область, г. Дмитров, мкр. Владимира Махалина, д. 20
  (далее — Оператор), на обработку своих персональных данных на следующих условиях:</p>
  <p><b>1. Перечень персональных данных, передаваемых Оператору на обработку:</b></p>
  <ul>
    <li>фамилия, имя, отчество;</li>
    <li>паспортные данные (копия паспорта РФ);</li>
    <li>адрес постоянного места жительства и/или преимущественного пребывания.</li>
  </ul>
  <p><b>2.</b> Субъект даёт согласие на обработку Оператором своих персональных данных, то есть совершение,
  в том числе, следующих действий: сбор, систематизация, накопление, хранение, уточнение, использование,
  распространение, обезличивание, блокирование, уничтожение персональных данных, а также иных действий,
  необходимых для обработки персональных данных в соответствии с законодательством Российской Федерации,
  в том числе в автоматизированном режиме.</p>
  <p><b>3.</b> Настоящее согласие действует бессрочно.</p>
  <p><b>4.</b> Настоящее согласие может быть отозвано Субъектом в любой момент по соглашению сторон.
  В случае неправомерного использования предоставленных данных соглашение отзывается письменным заявлением субъекта персональных данных.</p>
  <p><b>5.</b> Субъект по письменному запросу имеет право на получение информации, касающейся обработки его персональных данных
  (в соответствии со ст. 9, п. 4 ст. 14 Федерального закона от 27.07.2006 № 152-ФЗ).</p>
  <div class="sign-row">
    <div class="sign-block">подпись</div>
    <div class="sign-block">ФИО</div>
    <div class="sign-block">дата</div>
  </div>
  <p style="margin-top:24px">Подтверждаю, что ознакомлен(а) с положениями Федерального закона от 27.07.2006 № 152-ФЗ
  «О персональных данных», права и обязанности в области защиты персональных данных мне разъяснены.</p>
  <div class="sign-row">
    <div class="sign-block">подпись</div>
    <div class="sign-block">ФИО</div>
    <div class="sign-block">дата</div>
  </div>
  </body></html>`
  const w = window.open('', '_blank')
  if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 400) }
}

function printContract(type: string, tenant: typeof emptyForm, contractNumber: string, startDate: string, endDate: string, premises: Premise[]) {
  const typeLabel = CONTRACT_TYPES.find(c => c.key === type)?.label || type
  const premisesText = premises.map(p => `офис ${p.unit_number} (${p.area_actual || '—'} м²)`).join(', ')
  const totalRent = premises.reduce((sum, p) => {
    const active = p.rents.find(r => !r.valid_to || r.valid_to >= new Date().toISOString().slice(0,10))
    return sum + (active?.monthly_rent || 0)
  }, 0)

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${typeLabel}</title>
  <style>body{font-family:'Times New Roman',serif;font-size:14pt;margin:2cm;line-height:1.5}
  h2{text-align:center;font-size:16pt}h3{font-size:14pt}
  .center{text-align:center}.right{text-align:right}
  table{width:100%;border-collapse:collapse}td,th{border:1px solid black;padding:6px 10px}
  .sign{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:40px}
  @media print{body{margin:1.5cm}}</style></head><body>
  <p class="right">г. Москва</p>
  <p class="right">${startDate || '«___» _________ 2025 г.'}</p>
  <h2>${typeLabel.toUpperCase()} № ${contractNumber || '____/____'}</h2>
  ${type === 'lease' ? `
  <p><b>Арендодатель:</b> ООО «Маяк», именуемое в дальнейшем «Арендодатель»</p>
  <p><b>Арендатор:</b> ${tenant.fullName}, в лице ${tenant.directorPosition} ${tenant.directorName || '___'}, действующего на основании ${tenant.directorBasis}, именуемое в дальнейшем «Арендатор»</p>
  <p>заключили настоящий Договор о нижеследующем:</p>
  <h3>1. ПРЕДМЕТ ДОГОВОРА</h3>
  <p>1.1. Арендодатель передаёт Арендатору во временное пользование нежилые помещения: ${premisesText || '____'}, расположенные по адресу: г. Москва, Дмитровское ш., д. 107.</p>
  <p>1.2. Площадь арендуемых помещений: ${premises.reduce((s,p) => s + (p.area_actual||0), 0)} м².</p>
  <h3>2. АРЕНДНАЯ ПЛАТА</h3>
  <p>2.1. Арендная плата составляет ${totalRent.toLocaleString('ru')} руб. в месяц, в том числе НДС.</p>
  <p>2.2. Арендная плата вносится ежемесячно, не позднее 10-го числа оплачиваемого месяца.</p>
  <h3>3. СРОК АРЕНДЫ</h3>
  <p>3.1. Договор заключён на срок с ${startDate || '«___» ___ 2025 г.'} по ${endDate || '«___» ___ 2026 г.'}.</p>
  <h3>4. РЕКВИЗИТЫ СТОРОН</h3>
  <table><tr><th>Арендодатель</th><th>Арендатор</th></tr>
  <tr><td>ООО «Маяк»<br>ИНН: ____________<br>р/с: ____________<br>Банк: ____________<br>БИК: ____________</td>
  <td>${tenant.fullName}<br>ИНН: ${tenant.inn}<br>КПП: ${tenant.kpp}<br>р/с: ${tenant.bankAccount}<br>Банк: ${tenant.bank}<br>БИК: ${tenant.bik}</td></tr></table>
  <div class="sign"><div>Арендодатель: ______________</div><div>Арендатор: ______________</div></div>
  ` : type === 'handover' ? `
  <p>Арендодатель передаёт, а Арендатор принимает нежилые помещения: <b>${premisesText || '____'}</b>, расположенные по адресу: г. Москва, Дмитровское ш., д. 107.</p>
  <p>Помещения переданы в технически исправном состоянии, пригодном для использования.</p>
  <h3>Имущество, передаваемое вместе с помещением:</h3>
  <table>
    <tr><th>Наименование</th><th>Кол-во</th><th>Стоимость при утере/порче</th></tr>
    <tr><td>Жалюзи (цвет: ____)</td><td>____</td><td>3 000 ₽ за шт.</td></tr>
    <tr><td>Пульт от кондиционера</td><td>____</td><td>3 000 ₽ за шт.</td></tr>
    <tr><td>Ключи от офиса</td><td>____</td><td>1 000 ₽ за шт.</td></tr>
    <tr><td>Брелок (Галерея)</td><td>____</td><td>1 000 ₽ за шт.</td></tr>
    <tr><td>Рулонная штора (Галерея)</td><td>____</td><td>5 000 ₽ за шт.</td></tr>
    <tr><td><b>ИТОГО</b></td><td></td><td><b>______ ₽</b></td></tr>
  </table>
  <p>Возможные дефекты/повреждения в помещении на момент передачи: ____________________________________________</p>
  <p>Стороны претензий друг к другу не имеют.</p>
  <div class="sign"><div>Передал (Арендодатель): ______________<br><small>_________________ / _____________</small></div><div>Принял (Арендатор): ______________<br><small>_________________ / _____________</small></div></div>
  ` : type === 'elevator_letter' ? `
  <h2>УВЕДОМЛЕНИЕ О ПРАВИЛАХ ПОЛЬЗОВАНИЯ ЛИФТОМ</h2>
  <p>Уважаемый Арендатор!</p>
  <p>В целях обеспечения безопасности и надлежащей эксплуатации лифтового оборудования Бизнес-центра «МАЯК» просим Вас ознакомиться с правилами пользования лифтом.</p>
  <p>Настоящим подтверждаем, что лифтовое оборудование предназначено для перевозки пассажиров. Перевозка крупногабаритных грузов возможна только через пожарный выход с предварительным согласованием с администрацией.</p>
  <p>Нарушение правил эксплуатации лифта влечёт материальную ответственность виновной стороны.</p>
  <br>
  <p>Арендатор: <b>${tenant.fullName}</b></p>
  <p>Помещение: ${premisesText || '____'}</p>
  <br>
  <table style="width:100%"><tr>
    <td>Ознакомлен: ______________<br><small>подпись / дата</small></td>
    <td>Арендодатель: ______________<br><small>подпись / дата</small></td>
  </tr></table>
  ` : `
  <p>Стороны пришли к соглашению внести следующие изменения в Договор аренды № ${contractNumber}:</p>
  <p>С ${startDate || '«___»'} арендная плата составляет: ${totalRent.toLocaleString('ru')} руб./мес.</p>
  <div class="sign"><div>Арендодатель: ______________</div><div>Арендатор: ______________</div></div>
  `}
  </body></html>`

  const w = window.open('', '_blank')
  if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 500) }
}

export function TenantCardPage({ tenantId, onBack }: { tenantId?: string | null; onBack: () => void; onCreateInvoice?: () => void }) {
  const [tab, setTab] = useState(0)
  const narrow = useNarrow()
  const [editing, setEditing] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saveError, setSaveError] = useState('')
  const [actionError, setActionError] = useState('')
  const [meterError, setMeterError] = useState('')

  // Premises
  const [premiseModal, setPremiseModal] = useState<Partial<Premise> | null>(null)
  const [rentModal, setRentModal] = useState<{ premiseId: string; rent: Partial<PremiseRent> } | null>(null)

  // Contracts
  const [contractModal, setContractModal] = useState<ContractDraft | null>(null)

  const [meterReadings, setMeterReadings] = useState<Record<string, string>>({})

  // ─── Загрузка ───
  const id = tenantId ?? ''
  const on = { enabled: !!tenantId }
  const tenantQ = useSb(['tenants', id], () => sb(supabase.from('tenants').select('*').eq('id', id).single()), on)
  const premisesQ = useSb(['tenant_premises', id], async (): Promise<Premise[]> => {
    const rows = await sb(supabase.from('tenant_premises').select('*, premise_rents(*)').eq('tenant_id', id).order('unit_number'))
    return rows.map(({ premise_rents, ...p }) => ({ ...p, rents: [...premise_rents].sort(byValidFromDesc) }))
  }, on)
  const docsQ = useSb(['tenant_documents', id], () => sb(supabase.from('tenant_documents').select('*').eq('tenant_id', id).order('uploaded_at', { ascending: false })), on)
  const contractsQ = useSb(['tenant_contracts', id], () => sb(supabase.from('tenant_contracts').select('*').eq('tenant_id', id).order('created_at', { ascending: false })), on)
  const invoicesQ = useSb(['v_invoice_state', id], () => sb(supabase.from('v_invoice_state').select('id,number,period,total,open_amount,pay_status').eq('tenant_id', id).order('date', { ascending: false })), on)
  // Счётчики — через помещения арендатора: номера офисов → помещения → приборы с показаниями.
  const metersQ = useSb(['meters', id], async () => {
    const prems = await sb(supabase.from('tenant_premises').select('unit_number').eq('tenant_id', id))
    const unitNums = prems.map(p => p.unit_number).filter(Boolean)
    if (!unitNums.length) return []
    const units = await sb(supabase.from('units').select('id').in('number', unitNums))
    const unitIds = units.map(u => u.id)
    if (!unitIds.length) return []
    return sb(supabase.from('meters').select('id,number,serial,type,tariff,heat_tariff,location,meter_readings(period,curr_value,created_at)').in('unit_id', unitIds))
  }, on)

  const premisesList = premisesQ.data ?? []
  const documents = docsQ.data ?? []
  const contracts = contractsQ.data ?? []
  const dbId = tenantQ.data ? id : null
  const saved = useMemo(() => tenantQ.data ? toForm(tenantQ.data) : emptyForm, [tenantQ.data])
  // Вне редактирования форма повторяет сохранённые данные; во время правки — своя.
  useEffect(() => { if (!editing) setForm(saved) }, [saved]) // eslint-disable-line react-hooks/exhaustive-deps

  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(p => ({ ...p, [k]: e.target.value }))

  // ─── Запись ───
  const saveTenant = useAction((fm: typeof emptyForm) => {
    const update: TablesUpdate<'tenants'> = {
      full_name: fm.fullName,
      type: fm.type,
      inn: fm.inn || null, kpp: fm.kpp || null, ogrn: fm.ogrn || null,
      email: fm.email || null, phone: fm.phone || null,
      legal_address: fm.legalAddress || null,
      bank_account: fm.bankAccount || null, bik: fm.bik || null, bank_name: fm.bank || null,
      monthly_rent: fm.rent || null,
      correspondent_account: fm.correspondentAccount || null,
      director_name: fm.directorName || null,
      director_position: fm.directorPosition || null,
      director_basis: fm.directorBasis || null,
      passport_series: fm.passportSeries || null,
      passport_number: fm.passportNumber || null,
      passport_issued_by: fm.passportIssuedBy || null,
      passport_issued_date: fm.passportIssuedDate || null,
      contact_name: fm.contactName || null,
      contact_phone: fm.contactPhone || null,
      contact_email: fm.contactEmail || null,
      contract_number: fm.contractNumber || null,
      contract_start_date: fm.contractStartDate || null,
      contract_end_date: fm.contractEndDate || null,
    }
    return sb(supabase.from('tenants').update(update).eq('id', id))
  }, { invalidate: ['tenants', 'rpc:tenant_saldo', 'v_invoice_state'] })
  const handleSave = () => {
    if (!dbId) return
    setSaveError('')
    saveTenant.mutate(form, {
      onSuccess: () => {
        setEditing(false)
        setShowSuccess(true)
        setTimeout(() => setShowSuccess(false), 3000)
      },
      onError: e => setSaveError('Не удалось сохранить: ' + e.message),
    })
  }
  const handleCancel = () => { setForm(saved); setEditing(false); setSaveError('') }

  // Onboarding step checks — зависят от типа арендатора
  const docTypes = getDocTypes(saved.type)
  const requiredDocKeys = docTypes.filter(d => d.required).map(d => d.key)
  const uploadedDocKeys = new Set(documents.map(d => d.doc_type))
  const allRequiredDocsUploaded = requiredDocKeys.every(k => uploadedDocKeys.has(k))
  const uploadedRequiredCount = requiredDocKeys.filter(k => uploadedDocKeys.has(k)).length

  const needsDirector = saved.type !== 'INDIVIDUAL'
  const onboardingSteps = [
    {
      label: 'Реквизиты',
      desc: saved.type === 'INDIVIDUAL'
        ? 'ФИО, email, телефон'
        : 'ИНН, ОГРН, банковские реквизиты',
      done: saved.type === 'INDIVIDUAL'
        ? !!(saved.fullName && saved.phone)
        : !!(saved.inn && saved.ogrn && saved.bank && saved.bankAccount && saved.bik),
      tab: 1,
    },
    ...(needsDirector ? [{
      label: 'Руководитель и паспорт',
      desc: 'ФИО, должность, паспортные данные',
      done: !!(saved.directorName && saved.passportSeries && saved.passportNumber),
      tab: 1,
    }] : [{
      label: 'Паспортные данные',
      desc: 'Серия, номер, кем выдан',
      done: !!(saved.passportSeries && saved.passportNumber),
      tab: 1,
    }]),
    {
      label: 'Документы',
      desc: `Обязательные: ${uploadedRequiredCount}/${requiredDocKeys.length} загружено`,
      done: allRequiredDocsUploaded && documents.length > 0,
      tab: 5,
    },
    {
      label: 'Согласие на обработку ПД',
      desc: 'Подписанное согласие на ОПД получено',
      done: uploadedDocKeys.has('opd_consent'),
      tab: 5,
    },
    {
      label: 'Помещение назначено',
      desc: 'Офис выбран и ставка установлена',
      done: premisesList.length > 0 && premisesList.some(p => p.rents.length > 0),
      tab: 2,
    },
    {
      label: 'Договор аренды',
      desc: 'Договор подписан сторонами',
      done: contracts.some(c => c.contract_type === 'lease'),
      tab: 6,
    },
    {
      label: 'Акт приёма-передачи',
      desc: 'Ключи переданы арендатору',
      done: contracts.some(c => c.contract_type === 'handover'),
      tab: 6,
    },
  ]
  const stepsComplete = onboardingSteps.filter(s => s.done).length

  const fail = (e: Error) => setActionError(e.message)

  const onboarding = useAction((status: string) => sb(supabase.from('tenants').update({ onboarding_status: status }).eq('id', id)), { invalidate: ['tenants'] })
  function updateOnboardingStatus(status: string) {
    if (!dbId) return
    onboarding.mutate(status, { onError: fail })
  }

  const writeContract = useAction(async (m: ContractDraft) => {
    const body = { tenant_id: id, contract_type: m.type, contract_number: m.number, signed_date: m.date || null, valid_from: m.startDate || null, valid_to: m.endDate || null, notes: m.notes || null }
    if (m.id) await sb(supabase.from('tenant_contracts').update(body).eq('id', m.id))
    else await sb(supabase.from('tenant_contracts').insert(body))
  }, { invalidate: ['tenant_contracts'] })
  const savingContract = writeContract.isPending
  function saveContract() {
    if (!contractModal || !dbId) return
    setActionError('')
    writeContract.mutate(contractModal, { onSuccess: () => setContractModal(null), onError: fail })
  }

  const removeContract = useAction((cid: string) => sb(supabase.from('tenant_contracts').delete().eq('id', cid)), { invalidate: ['tenant_contracts'] })
  async function deleteContract(cid: string) {
    if (!(await ask('Удалить документ?', { ok: 'Удалить', danger: true }))) return
    removeContract.mutate(cid, { onError: fail })
  }

  const uploadDoc = useAction(async ({ docType, file }: { docType: string; file: File }) => {
    // Try Supabase Storage upload; fallback to metadata only
    const path = `tenant-docs/${id}/${docType}/${file.name}`
    let fileUrl = ''
    const { data: uploaded } = await supabase.storage.from('tenant-documents').upload(path, file, { upsert: true }).catch(() => ({ data: null }))
    if (uploaded) {
      const { data: pub } = supabase.storage.from('tenant-documents').getPublicUrl(path)
      fileUrl = pub?.publicUrl || ''
    }
    const { error } = await supabase.from('tenant_documents').insert({ tenant_id: id, doc_type: docType, file_name: file.name, file_url: fileUrl, notes: null })
    if (error) throw new Error('Не удалось сохранить документ: ' + error.message)
  }, { invalidate: ['tenant_documents'] })
  const uploadingDoc = uploadDoc.isPending ? uploadDoc.variables?.docType ?? null : null
  function handleDocUpload(docType: string, file: File) {
    if (!dbId) return
    setActionError('')
    uploadDoc.mutate({ docType, file }, { onError: fail })
  }

  const removeDoc = useAction((did: string) => sb(supabase.from('tenant_documents').delete().eq('id', did)), { invalidate: ['tenant_documents'] })
  async function deleteDoc(did: string) {
    if (!(await ask('Удалить документ?', { ok: 'Удалить', danger: true }))) return
    removeDoc.mutate(did, { onError: fail })
  }

  // Помещения и ставки: от них зависят и счётчики (приборы ищутся по номерам офисов).
  const PREMISE_TABLES = ['tenant_premises', 'premise_rents', 'meters']
  const writePremise = useAction(async (pm: Partial<Premise>) => {
    if (pm.id) await sb(supabase.from('tenant_premises').update({ unit_number: pm.unit_number, area_actual: pm.area_actual, area_bti: pm.area_bti, floor: pm.floor }).eq('id', pm.id))
    else await sb(supabase.from('tenant_premises').insert({ tenant_id: id, unit_number: pm.unit_number || '', area_actual: pm.area_actual || null, area_bti: pm.area_bti || null, floor: pm.floor || null }))
  }, { invalidate: PREMISE_TABLES })
  const removePremise = useAction((pid: string) => sb(supabase.from('tenant_premises').delete().eq('id', pid)), { invalidate: PREMISE_TABLES })
  const writeRent = useAction(async ({ premiseId, rent }: { premiseId: string; rent: Partial<PremiseRent> }) => {
    if (rent.id) await sb(supabase.from('premise_rents').update({ monthly_rent: rent.monthly_rent, cleaning_fee: rent.cleaning_fee, valid_from: rent.valid_from || null, valid_to: rent.valid_to || null, notes: rent.notes || null }).eq('id', rent.id))
    else await sb(supabase.from('premise_rents').insert({ premise_id: premiseId, monthly_rent: rent.monthly_rent || null, cleaning_fee: rent.cleaning_fee || null, valid_from: rent.valid_from || null, valid_to: rent.valid_to || null, notes: rent.notes || null }))
  }, { invalidate: PREMISE_TABLES })
  const removeRent = useAction((rid: string) => sb(supabase.from('premise_rents').delete().eq('id', rid)), { invalidate: PREMISE_TABLES })
  const savingPremise = writePremise.isPending || writeRent.isPending

  function savePremise() {
    if (!premiseModal || !dbId) return
    setActionError('')
    writePremise.mutate(premiseModal, { onSuccess: () => setPremiseModal(null), onError: fail })
  }
  function deletePremise(pid: string) { removePremise.mutate(pid, { onError: fail }) }
  function saveRent() {
    if (!rentModal) return
    setActionError('')
    writeRent.mutate(rentModal, { onSuccess: () => setRentModal(null), onError: fail })
  }
  function deleteRent(rid: string) { removeRent.mutate(rid, { onError: fail }) }

  const addReading = useAction(async ({ meterId, curr, prev, amount }: { meterId: string; curr: number; prev: number; amount: number }) => {
    const period = new Date().toISOString().slice(0, 7)
    const consumption = Math.max(0, curr - prev)
    await sb(supabase.from('meter_readings').insert({ meter_id: meterId, period, prev_value: prev, curr_value: curr, consumption, amount, reading: curr, previous_reading: prev, reading_date: new Date().toISOString().slice(0, 10) }))
  }, { invalidate: ['meters', 'meter_readings'] })
  const savingMeter = addReading.isPending ? addReading.variables?.meterId ?? null : null

  const g3: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px 20px' }
  const g4: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px 20px' }
  const g2: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }

  // Поле реквизита: в режиме редактирования — ввод, иначе — значение.
  // Обычная функция, а не компонент: иначе поле пересоздаётся на каждый ввод и теряет фокус.
  const field = (label: string, k: keyof typeof form, type = 'text', wide = false) => (
    <Field key={k} label={label} wide={wide}>
      {editing
        ? <Input type={type} value={String(form[k])} onChange={f(k)} />
        : <Value>{type === 'tel' && telHref(String(saved[k]))
            ? <a href={telHref(String(saved[k]))} style={{ color: C.accent, textDecoration: 'none' }}>{String(saved[k])}</a>
            : type === 'email' && saved[k]
              ? <a href={'mailto:' + String(saved[k])} style={{ color: C.accent, textDecoration: 'none' }}>{String(saved[k])}</a>
              : String(saved[k]) || '—'}</Value>}
    </Field>
  )

  if (tenantId && tenantQ.isPending) return <Loading />
  if (tenantQ.error) return <Page><ErrorBox error={'Не удалось загрузить арендатора: ' + tenantQ.error.message} onRetry={() => tenantQ.refetch()} /><div><Button onClick={onBack}>Назад</Button></div></Page>

  const allDone = stepsComplete === onboardingSteps.length
  const callTo = telHref(saved.contactPhone) || telHref(saved.phone)
  const mailTo = saved.contactEmail || saved.email
  const quick: React.CSSProperties = {
    flex: 1, minWidth: 0, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: C.radiusSm,
    fontSize: 14, fontWeight: 600, textDecoration: 'none', border: `1px solid ${C.line}`, background: C.card, color: C.text, fontFamily: 'inherit', cursor: 'pointer',
  }
  const off: React.CSSProperties = { ...quick, color: C.faint, pointerEvents: 'none' }

  return (
    <div style={{ maxWidth: 900 }}>
      {showSuccess && <SuccessToast />}

      {narrow && !editing && (
        <div style={{ position: 'sticky', top: 'calc(58px + env(safe-area-inset-top, 0px))', zIndex: 30, display: 'flex', gap: 8, padding: '8px 0', margin: '-8px 0 8px', background: C.bg }}>
          {callTo ? <a href={callTo} style={{ ...quick, background: C.accent, color: C.onAccent, borderColor: C.accent }}>Позвонить</a> : <span style={off}>Нет телефона</span>}
          {mailTo ? <a href={'mailto:' + mailTo} style={quick}>Написать</a> : <span style={off}>Нет почты</span>}
          <button type="button" style={quick} onClick={() => go('/settlements/' + tenantId)}>Расчёты</button>
        </div>
      )}

      <Page
        title={
          <Row gap={12} wrap={false} align="center">
            <Button onClick={onBack}>Назад</Button>
            <div style={{ minWidth: 0 }}>
              <Row gap={8}>
                <span>{saved.fullName || 'Новый арендатор'}</span>
                <Badge tone={allDone ? 'green' : stepsComplete > 0 ? 'amber' : 'neutral'}>
                  {allDone ? 'Онбординг завершён' : `Онбординг ${stepsComplete}/${onboardingSteps.length}`}
                </Badge>
              </Row>
              <div style={{ fontSize: 13, fontWeight: 400, color: C.muted, marginTop: 2 }}>{TYPE_LABELS[saved.type]} · ИНН {saved.inn || '—'}</div>
            </div>
          </Row>
        }
        actions={editing ? (
          <>
            <Button onClick={handleCancel}>Отмена</Button>
            <Button kind="primary" onClick={handleSave} disabled={saveTenant.isPending}>Сохранить</Button>
          </>
        ) : (
          <>
            <Button onClick={() => { setForm(saved); setEditing(true) }}>Редактировать</Button>
            {!narrow && <Button kind="primary" onClick={() => { go('/settlements/' + tenantId) }}>Расчёты</Button>}
          </>
        )}>

        {editing && <Notice tone="amber">Режим редактирования — внесите изменения и нажмите «Сохранить»</Notice>}
        {saveError && <Notice tone="red">{saveError}</Notice>}

        <Tabs<string>
          value={String(tab)}
          onChange={k => setTab(Number(k))}
          tabs={TABS.map((name, i) => [String(i), i === 0 && !allDone ? `${name} · ${stepsComplete}/${onboardingSteps.length}` : name] as [string, string])}
        />

        {/* ─── Онбординг ─── */}
        {tab === 0 && (
          <Card
            title={<>Онбординг арендатора<Sub>Выполните все шаги для завершения регистрации</Sub></>}
            actions={<Row gap={12}><Muted small>{stepsComplete} из {onboardingSteps.length} шагов</Muted><Progress value={stepsComplete} total={onboardingSteps.length} width={120} /></Row>}>
            <div style={{ display: 'grid', gap: 10 }}>
              {onboardingSteps.map((step, i) => (
                <div key={i} style={{ border: `1px solid ${step.done ? C.green : C.line}`, borderRadius: C.radius, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700,
                    background: step.done ? C.greenBg : C.hover, color: step.done ? C.green : C.faint }}>
                    {i + 1}
                  </div>
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <Row gap={8}>
                      <span style={{ fontSize: 14, fontWeight: 600 }}>{step.label}</span>
                      {step.done && <Badge tone="green">готово</Badge>}
                    </Row>
                    <Sub>{step.desc}</Sub>
                  </div>
                  <Button small kind={step.done ? 'secondary' : 'ghost'} onClick={() => setTab(step.tab)}>
                    {step.done ? 'Изменить' : 'Заполнить'}
                  </Button>
                </div>
              ))}
            </div>

            {allDone && saved.onboardingStatus !== 'completed' && (
              <div style={{ marginTop: 16 }}>
                <Notice tone="green">
                  <Row justify="space-between" gap={12}>
                    <div>
                      <div style={{ fontWeight: 600 }}>Все шаги выполнены</div>
                      <div>Нажмите, чтобы зафиксировать завершение онбординга</div>
                    </div>
                    <Button kind="primary" onClick={() => updateOnboardingStatus('completed')}>Завершить онбординг</Button>
                  </Row>
                </Notice>
              </div>
            )}
          </Card>
        )}

        {/* ─── Общие ─── */}
        {tab === 1 && dbId && <TenantPortalAccess tenantId={dbId} defaultEmail={saved.email || saved.contactEmail || ''} />}
        {tab === 1 && (
          <>
            <Card title="Реквизиты организации">
              <div style={{ ...g3, marginBottom: 12 }}>
                {field('Полное наименование', 'fullName', 'text', true)}
                <Field label="Тип">
                  {editing
                    ? <Select value={form.type} onChange={f('type')}>
                        <option value="COMPANY">Юрлицо (ООО, АО)</option>
                        <option value="IP">ИП</option>
                        <option value="INDIVIDUAL">Физлицо</option>
                        <option value="SELF_EMPLOYED">Самозанятый</option>
                      </Select>
                    : <Value>{TYPE_LABELS[saved.type]}</Value>}
                </Field>
                {field('ИНН', 'inn')}
                {field('КПП', 'kpp')}
                {field('ОГРН / ОГРНИП', 'ogrn')}
                {field('Email', 'email', 'email')}
                {field('Телефон', 'phone', 'tel')}
              </div>
              {field('Юридический адрес', 'legalAddress')}
            </Card>

            {(form.type === 'COMPANY') && (
              <Card title="Руководитель">
                <div style={g3}>
                  {field('ФИО директора', 'directorName')}
                  {field('Должность', 'directorPosition')}
                  {field('Действует на основании', 'directorBasis')}
                </div>
                <div style={{ ...g4, marginTop: 12 }}>
                  {field('Серия паспорта', 'passportSeries')}
                  {field('Номер паспорта', 'passportNumber')}
                  {field('Дата выдачи', 'passportIssuedDate', 'date')}
                  {field('Кем выдан', 'passportIssuedBy')}
                </div>
              </Card>
            )}

            {(form.type === 'IP' || form.type === 'INDIVIDUAL' || form.type === 'SELF_EMPLOYED') && (
              <Card title="Паспортные данные">
                <div style={g4}>
                  {field('Серия паспорта', 'passportSeries')}
                  {field('Номер паспорта', 'passportNumber')}
                  {field('Дата выдачи', 'passportIssuedDate', 'date')}
                  {field('Кем выдан', 'passportIssuedBy')}
                </div>
              </Card>
            )}

            <Card title="Контактное лицо">
              <div style={g3}>
                {field('ФИО контактного лица', 'contactName')}
                {field('Телефон', 'contactPhone', 'tel')}
                {field('Email', 'contactEmail', 'email')}
              </div>
            </Card>

            <Card title="Банковские реквизиты">
              <div style={g3}>
                {field('Банк', 'bank')}
                {field('Расчётный счёт (р/с)', 'bankAccount')}
                {field('Корр. счёт (к/с)', 'correspondentAccount')}
                {field('БИК', 'bik')}
              </div>
            </Card>

            <Card title="Договор аренды">
              <div style={g4}>
                {field('Номер договора', 'contractNumber')}
                {field('Дата начала', 'contractStartDate', 'date')}
                {field('Дата окончания', 'contractEndDate', 'date')}
                <Field label="Арендная плата">
                  {editing
                    ? <Input type="number" value={form.rent} onChange={e => setForm(p => ({ ...p, rent: Number(e.target.value) }))} />
                    : <Value>{saved.rent.toLocaleString('ru')} ₽/мес</Value>}
                </Field>
              </div>
            </Card>
          </>
        )}

        {/* ─── Помещения ─── */}
        {tab === 2 && (() => {
          const today = new Date().toISOString().slice(0, 10)
          const isActive = (r: PremiseRent) => !r.valid_to || r.valid_to >= today
          const fmtDate = (d: string | null) => d ? dateRu(d) : 'бессрочно'
          const fmtMoney = (n: number | null) => n != null ? n.toLocaleString('ru') + ' ₽' : '—'

          return (
            <>
              <Row justify="space-between">
                <div style={{ fontSize: 14, fontWeight: 600 }}>Арендуемые помещения</div>
                <Button kind="primary" small onClick={() => setPremiseModal({ unit_number: '', area_actual: null, area_bti: null, floor: null })}>Добавить помещение</Button>
              </Row>
              {actionError && !premiseModal && !rentModal && <Notice tone="red">{actionError}</Notice>}
              {premisesQ.error ? <ErrorBox error={premisesQ.error.message} onRetry={() => premisesQ.refetch()} />
                : premisesQ.isPending ? <Loading />
                : premisesList.length === 0 ? <Card><Empty>Помещения не добавлены.</Empty></Card>
                : (
                  <div style={{ display: 'grid', gap: 12 }}>
                    {premisesList.map(p => {
                      const activeRent = p.rents.find(r => isActive(r))
                      return (
                        <Card key={p.id} pad={false}
                          title={<Row gap={10}>
                            <span>Офис № {p.unit_number}</span>
                            {p.floor && <Muted small>{p.floor} этаж</Muted>}
                            {p.area_actual && <Muted small>{p.area_actual} м²</Muted>}
                          </Row>}
                          actions={<Row gap={8}>
                            {activeRent && <span style={{ fontSize: 13, color: C.green, fontWeight: 600 }}>{fmtMoney((activeRent.monthly_rent || 0) + (activeRent.cleaning_fee || 0))}/мес</span>}
                            <Button small onClick={() => setPremiseModal({ ...p })}>Изменить</Button>
                            <Button small kind="danger" onClick={() => deletePremise(p.id)}>Удалить</Button>
                          </Row>}>
                          <div style={{ padding: '10px 16px 0' }}>
                            <Row justify="space-between">
                              <Muted small>История ставок</Muted>
                              <Button small kind="ghost" onClick={() => setRentModal({ premiseId: p.id, rent: { monthly_rent: null, cleaning_fee: null, valid_from: null, valid_to: null } })}>Изменить ставку</Button>
                            </Row>
                          </div>
                          {p.rents.length === 0 ? <div style={{ padding: '4px 16px 14px' }}><Muted small>Ставки не указаны</Muted></div> : (
                            <Table<PremiseRent> dense rows={p.rents} rowKey={r => r.id} cols={[
                              { key: 'from', title: 'С', render: r => fmtDate(r.valid_from), sort: r => r.valid_from },
                              { key: 'to', title: 'По', render: r => r.valid_to ? fmtDate(r.valid_to) : <Muted>{fmtDate(r.valid_to)}</Muted>, sort: r => r.valid_to },
                              { key: 'rent', title: 'Аренда ₽/мес', align: 'right', render: r => fmtMoney(r.monthly_rent), sort: r => r.monthly_rent },
                              { key: 'clean', title: 'Уборка ₽/мес', align: 'right', render: r => <Muted>{fmtMoney(r.cleaning_fee)}</Muted>, sort: r => r.cleaning_fee },
                              { key: 'sum', title: 'Итого', align: 'right', render: r => <b>{fmtMoney((r.monthly_rent || 0) + (r.cleaning_fee || 0))}</b>, sort: r => (r.monthly_rent || 0) + (r.cleaning_fee || 0) },
                              { key: 'st', title: 'Статус', render: r => isActive(r) ? <Badge tone="green">Текущая</Badge> : <Badge>Архив</Badge> },
                              { key: 'act', title: '', align: 'right', render: r => <Row gap={4} wrap={false} justify="flex-end">
                                <Button small onClick={() => setRentModal({ premiseId: p.id, rent: { ...r } })}>Изменить</Button>
                                <Button small kind="danger" onClick={() => deleteRent(r.id)}>Удалить</Button>
                              </Row> },
                            ]} />
                          )}
                        </Card>
                      )
                    })}
                  </div>
                )}

              {premiseModal !== null && (
                <Modal title={premiseModal.id ? 'Редактировать помещение' : 'Добавить помещение'} onClose={() => setPremiseModal(null)} width={440}
                  footer={<>
                    <Button onClick={() => setPremiseModal(null)}>Отмена</Button>
                    <Button kind="primary" onClick={savePremise} disabled={savingPremise}>{savingPremise ? 'Сохранение…' : 'Сохранить'}</Button>
                  </>}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
                    <Field label="Номер офиса" wide>
                      <Input value={premiseModal.unit_number || ''} onChange={e => setPremiseModal(p => p ? { ...p, unit_number: e.target.value } : p)} placeholder="204" />
                    </Field>
                    <Field label="Площадь факт., м²">
                      <Input type="number" value={premiseModal.area_actual ?? ''} onChange={e => setPremiseModal(p => p ? { ...p, area_actual: e.target.value ? parseFloat(e.target.value) : null } : p)} />
                    </Field>
                    <Field label="Площадь по БТИ, м²">
                      <Input type="number" value={premiseModal.area_bti ?? ''} onChange={e => setPremiseModal(p => p ? { ...p, area_bti: e.target.value ? parseFloat(e.target.value) : null } : p)} />
                    </Field>
                    <Field label="Этаж">
                      <Input type="number" value={premiseModal.floor ?? ''} onChange={e => setPremiseModal(p => p ? { ...p, floor: e.target.value ? parseInt(e.target.value) : null } : p)} />
                    </Field>
                  </div>
                  {actionError && <Notice tone="red">{actionError}</Notice>}
                </Modal>
              )}

              {rentModal !== null && (
                <Modal title={rentModal.rent.id ? 'Редактировать ставку' : 'Изменить арендную ставку'} onClose={() => setRentModal(null)} width={440}
                  footer={<>
                    <Button onClick={() => setRentModal(null)}>Отмена</Button>
                    <Button kind="primary" onClick={saveRent} disabled={savingPremise}>{savingPremise ? 'Сохранение…' : 'Сохранить'}</Button>
                  </>}>
                  <Muted>Оставьте «по» пустым для бессрочного действия</Muted>
                  <div style={g2}>
                    <Field label="Действует с">
                      <Input type="date" value={rentModal.rent.valid_from || ''} onChange={e => setRentModal(m => m ? { ...m, rent: { ...m.rent, valid_from: e.target.value || null } } : m)} />
                    </Field>
                    <Field label="Действует по">
                      <Input type="date" value={rentModal.rent.valid_to || ''} onChange={e => setRentModal(m => m ? { ...m, rent: { ...m.rent, valid_to: e.target.value || null } } : m)} />
                    </Field>
                    <Field label="Аренда ₽/мес">
                      <Input type="number" value={rentModal.rent.monthly_rent ?? ''} onChange={e => setRentModal(m => m ? { ...m, rent: { ...m.rent, monthly_rent: e.target.value ? parseFloat(e.target.value) : null } } : m)} />
                    </Field>
                    <Field label="Уборка ₽/мес">
                      <Input type="number" value={rentModal.rent.cleaning_fee ?? ''} onChange={e => setRentModal(m => m ? { ...m, rent: { ...m.rent, cleaning_fee: e.target.value ? parseFloat(e.target.value) : null } } : m)} />
                    </Field>
                    <Field label="Примечание" wide>
                      <Input value={rentModal.rent.notes || ''} onChange={e => setRentModal(m => m ? { ...m, rent: { ...m.rent, notes: e.target.value || null } } : m)} placeholder="Индексация по доп. соглашению №..." />
                    </Field>
                  </div>
                  {actionError && <Notice tone="red">{actionError}</Notice>}
                </Modal>
              )}
            </>
          )
        })()}

        {/* ─── Счётчики ─── */}
        {tab === 3 && (
          <Card title="Приборы учёта">
            {meterError && <div style={{ marginBottom: 10 }}><Notice tone="red">{meterError}</Notice></div>}
            {metersQ.error ? (
              <ErrorBox error={metersQ.error.message} onRetry={() => metersQ.refetch()} />
            ) : metersQ.isPending ? (
              <Loading />
            ) : metersQ.data.length === 0 ? (
              <Empty>Счётчики не найдены для помещений арендатора</Empty>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {metersQ.data.map(m => {
                  const readings = [...m.meter_readings].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
                  const last = readings[0]
                  const tariff = m.heat_tariff || m.tariff
                  return (
                    <div key={m.id} style={{ padding: 12, background: C.card2, border: `1px solid ${C.line}`, borderRadius: C.radiusSm }}>
                      <Row justify="space-between" align="flex-start">
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 500 }}>{METER_LABELS[m.type] || m.type}{m.number ? ` · № ${m.number}` : ''}</div>
                          <Sub>Заводской № {m.serial || '—'}{tariff ? ` · тариф ${tariff} ₽/${METER_UNITS[m.type] || 'ед.'}` : ''}{m.location ? ` · ${m.location}` : ''}</Sub>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          {last ? (
                            <>
                              <div style={{ fontSize: 14, fontWeight: 600 }}>{last.curr_value} {METER_UNITS[m.type] || 'ед.'}</div>
                              <Sub>за {last.period || dateRu(last.created_at)}</Sub>
                            </>
                          ) : <Muted small>Нет показаний</Muted>}
                        </div>
                      </Row>
                      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                        <Input
                          placeholder="Новое показание"
                          style={{ flex: 1, width: 'auto', minWidth: 0 }}
                          type="number"
                          value={meterReadings[m.id] || ''}
                          onChange={e => setMeterReadings(r => ({ ...r, [m.id]: e.target.value }))}
                        />
                        <Button
                          kind="primary"
                          disabled={!meterReadings[m.id] || savingMeter === m.id}
                          onClick={() => {
                            const curr = parseFloat(meterReadings[m.id])
                            if (isNaN(curr)) return
                            setMeterError('')
                            const prev = last?.curr_value ?? 0
                            const amount = tariff ? Math.max(0, curr - prev) * tariff : 0
                            addReading.mutate({ meterId: m.id, curr, prev, amount }, {
                              onSuccess: () => setMeterReadings(r => ({ ...r, [m.id]: '' })),
                              onError: e => setMeterError(e.message),
                            })
                          }}>
                          {savingMeter === m.id ? 'Сохранение…' : 'Сохранить'}
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>
        )}

        {/* ─── Счета ─── */}
        {tab === 4 && (
          <Card title="История счетов" pad={false}>
            {invoicesQ.error ? <ErrorBox error={invoicesQ.error.message} onRetry={() => invoicesQ.refetch()} /> : invoicesQ.isPending ? <Loading /> : (
              <Table rows={invoicesQ.data} rowKey={inv => inv.id ?? ''} onRow={inv => go('/invoices/' + inv.id)} empty="Счетов не найдено" cols={[
                { key: 'n', title: 'Номер', render: inv => <b>№ {inv.number}</b>, sort: inv => inv.number },
                { key: 'p', title: 'Период', render: inv => <Muted>{inv.period || '—'}</Muted>, sort: inv => inv.period },
                { key: 't', title: 'Итого', align: 'right', render: inv => <b>{money(inv.total)}</b>, sort: inv => Number(inv.total || 0) },
                { key: 'o', title: 'Остаток', align: 'right', render: inv => <span style={{ color: Number(inv.open_amount) > 0 ? C.red : C.muted }}>{money(inv.open_amount)}</span>, sort: inv => Number(inv.open_amount || 0) },
                { key: 's', title: 'Статус', render: inv => { const st = inv.pay_status ? PAY_STATUS[inv.pay_status] : undefined; return <Badge tone={st?.tone}>{st?.label || inv.pay_status}</Badge> } },
              ]} />
            )}
          </Card>
        )}

        {/* ─── Документы ─── */}
        {tab === 5 && (() => {
          const currentDocTypes = getDocTypes(saved.type)
          const requiredCount = currentDocTypes.filter(d => d.required).length
          const uploadedReqCount = currentDocTypes.filter(d => d.required && uploadedDocKeys.has(d.key)).length
          return (
            <>
              <Row justify="space-between">
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>Перечень документов — {TYPE_LABELS[saved.type]}</div>
                  <Sub>Обязательных: {uploadedReqCount}/{requiredCount} загружено</Sub>
                </div>
                <Progress value={uploadedReqCount} total={requiredCount} width={100} />
              </Row>
              {actionError && <Notice tone="red">{actionError}</Notice>}
              {docsQ.error ? <ErrorBox error={docsQ.error.message} onRetry={() => docsQ.refetch()} /> : docsQ.isPending ? <Loading /> : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
                  {currentDocTypes.map(dt => {
                    const existing = documents.filter(d => d.doc_type === dt.key)
                    const isDone = existing.length > 0
                    return (
                      <div key={dt.key} style={{ background: C.card, border: `1px solid ${isDone ? C.green : dt.required ? C.amberLine : C.line}`, borderRadius: C.radius, padding: 14, display: 'grid', gap: 10, alignContent: 'start' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 600 }}>{dt.label}</div>
                            <div style={{ fontSize: 12, color: isDone ? C.green : C.muted, marginTop: 2 }}>
                              {isDone ? `${existing.length} файл(ов) загружено` : 'Не загружено'}
                            </div>
                          </div>
                          {isDone ? <Badge tone="green">есть</Badge> : dt.required ? <Badge tone="amber">обязательно</Badge> : null}
                        </div>
                        {existing.map(doc => (
                          <div key={doc.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, padding: '4px 8px', background: C.card2, borderRadius: C.radiusSm, fontSize: 13 }}>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{doc.file_name}</span>
                            <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                              {doc.file_url && <Button small kind="ghost" onClick={() => doc.file_url && openStoredFile(doc.file_url)}>Открыть</Button>}
                              <Button small kind="ghost" style={{ color: C.red }} onClick={() => deleteDoc(doc.id)}>Удалить</Button>
                            </div>
                          </div>
                        ))}
                        <div style={{ display: 'flex', gap: 6 }}>
                          {dt.key === 'opd_consent' && (
                            <Button small style={{ flex: 1 }} onClick={() => printOPD(saved)}>Распечатать бланк</Button>
                          )}
                          <label style={{ flex: 1, display: 'block', padding: '4px 0', border: `1px dashed ${isDone ? C.green : C.lineStrong}`, borderRadius: C.radiusSm, color: uploadingDoc === dt.key ? C.faint : C.accent, fontSize: 12, fontWeight: 500, cursor: 'pointer', textAlign: 'center', boxSizing: 'border-box' }}>
                            {uploadingDoc === dt.key ? 'Загрузка…' : isDone ? 'Загрузить ещё' : 'Загрузить'}
                            <input type="file" style={{ display: 'none' }} disabled={uploadingDoc === dt.key}
                              onChange={e => { if (e.target.files?.[0]) handleDocUpload(dt.key, e.target.files[0]); e.target.value = '' }} />
                          </label>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )
        })()}

        {/* ─── Договоры ─── */}
        {tab === 6 && (
          <>
            <Row gap={8}>
              {CONTRACT_TYPES.map(ct => (
                <Button key={ct.key}
                  onClick={() => setContractModal({ type: ct.key, number: saved.contractNumber || '', date: saved.contractStartDate || '', startDate: saved.contractStartDate || '', endDate: saved.contractEndDate || '', notes: '' })}>
                  Добавить: {ct.label}
                </Button>
              ))}
            </Row>
            {actionError && !contractModal && <Notice tone="red">{actionError}</Notice>}

            {contractsQ.error ? <ErrorBox error={contractsQ.error.message} onRetry={() => contractsQ.refetch()} />
              : contractsQ.isPending ? <Loading />
              : contracts.length === 0 ? (
                <Card><Empty>Договоры не созданы. Нажмите кнопку выше, чтобы создать первый документ.</Empty></Card>
              ) : (
                <div style={{ display: 'grid', gap: 10 }}>
                  {contracts.map(c => {
                    const typeLabel = CONTRACT_TYPES.find(ct => ct.key === c.contract_type)?.label || c.contract_type
                    return (
                      <div key={c.id} style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: C.radius, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                        <div style={{ width: 36, height: 36, borderRadius: 8, background: C.accentBg, color: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Icon name="contracts" size={18} />
                        </div>
                        <div style={{ flex: 1, minWidth: 180 }}>
                          <div style={{ fontSize: 14, fontWeight: 600 }}>{typeLabel}{c.contract_number ? ` № ${c.contract_number}` : ''}</div>
                          <Sub>
                            {c.signed_date ? dateRu(c.signed_date) : '—'}
                            {c.valid_from && ` · с ${dateRu(c.valid_from)}`}
                            {c.valid_to && ` по ${dateRu(c.valid_to)}`}
                            {c.notes && ` · ${c.notes}`}
                          </Sub>
                        </div>
                        <Row gap={6} wrap={false}>
                          <Button small onClick={() => printContract(c.contract_type, saved, c.contract_number || '', c.valid_from || '', c.valid_to || '', premisesList)}>Печать</Button>
                          <Button small onClick={() => setContractModal({ id: c.id, type: c.contract_type, number: c.contract_number || '', date: c.signed_date || '', startDate: c.valid_from || '', endDate: c.valid_to || '', notes: c.notes || '' })}>Изменить</Button>
                          <Button small kind="danger" onClick={() => deleteContract(c.id)}>Удалить</Button>
                        </Row>
                      </div>
                    )
                  })}
                </div>
              )}

            {contractModal && (
              <Modal title={CONTRACT_TYPES.find(ct => ct.key === contractModal.type)?.label || 'Документ'} onClose={() => setContractModal(null)} width={480}
                footer={<>
                  <Button onClick={() => setContractModal(null)}>Отмена</Button>
                  <Button onClick={() => { saveContract(); setTimeout(() => printContract(contractModal.type, saved, contractModal.number || '', contractModal.startDate || '', contractModal.endDate || '', premisesList), 500) }}>Сохранить и распечатать</Button>
                  <Button kind="primary" onClick={saveContract} disabled={savingContract}>{savingContract ? 'Сохранение…' : 'Сохранить'}</Button>
                </>}>
                <div style={g2}>
                  <Field label="Номер">
                    <Input value={contractModal.number || ''} onChange={e => setContractModal(m => m && ({ ...m, number: e.target.value }))} placeholder="2025-001" />
                  </Field>
                  <Field label="Дата подписания">
                    <Input type="date" value={contractModal.date || ''} onChange={e => setContractModal(m => m && ({ ...m, date: e.target.value }))} />
                  </Field>
                  <Field label="Действует с">
                    <Input type="date" value={contractModal.startDate || ''} onChange={e => setContractModal(m => m && ({ ...m, startDate: e.target.value }))} />
                  </Field>
                  <Field label="Действует по">
                    <Input type="date" value={contractModal.endDate || ''} onChange={e => setContractModal(m => m && ({ ...m, endDate: e.target.value }))} />
                  </Field>
                  <Field label="Примечание" wide>
                    <Input value={contractModal.notes || ''} onChange={e => setContractModal(m => m && ({ ...m, notes: e.target.value }))} />
                  </Field>
                </div>
                {actionError && <Notice tone="red">{actionError}</Notice>}
              </Modal>
            )}
          </>
        )}

        {tab === 7 && dbId && <TenantJournal tenantId={dbId} />}
      </Page>
    </div>
  )
}
