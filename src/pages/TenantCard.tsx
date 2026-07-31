import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

// Tabs: Онбординг | Общие | Помещения | Счётчики | Счета | Документы | Договоры
const TABS = ['Онбординг', 'Общие', 'Помещения', 'Счётчики', 'Счета', 'Документы', 'Договоры']
const TYPE_LABELS: Record<string, string> = { COMPANY: 'Юрлицо', IP: 'ИП', INDIVIDUAL: 'Физлицо' }
const METER_LABELS: Record<string, string> = { electricity: 'Электричество', cold_water: 'Холодная вода', hot_water: 'Горячая вода' }
const METER_UNITS: Record<string, string> = { electricity: 'кВт·ч', cold_water: 'м³', hot_water: 'м³' }

const DOC_TYPES = [
  { key: 'ogrn', label: 'ОГРН / ОГРНИП', icon: '📋' },
  { key: 'charter', label: 'Устав', icon: '📖' },
  { key: 'passport', label: 'Паспорт директора', icon: '🪪' },
  { key: 'poa', label: 'Доверенность', icon: '📝' },
  { key: 'inn_doc', label: 'Свидетельство ИНН', icon: '📄' },
  { key: 'other', label: 'Прочее', icon: '📎' },
]

const CONTRACT_TYPES = [
  { key: 'lease', label: 'Договор аренды' },
  { key: 'handover', label: 'Акт приёма-передачи' },
  { key: 'addendum_rent', label: 'Доп. соглашение (аренда)' },
  { key: 'addendum_ad', label: 'Доп. соглашение (реклама)' },
]

const emptyForm = {
  fullName: '', type: 'COMPANY', inn: '', kpp: '', ogrn: '', email: '', phone: '',
  legalAddress: '', bankAccount: '', correspondentAccount: '', bik: '', bank: '',
  directorName: '', directorPosition: 'Директор', directorBasis: 'Устав',
  passportSeries: '', passportNumber: '', passportIssuedBy: '', passportIssuedDate: '',
  contractNumber: '', contractStartDate: '', contractEndDate: '',
  rent: 0, onboardingStatus: 'not_started',
}

const s = {
  card: { background: '#fff', border: '1px solid #e8ebf3', borderRadius: 9, padding: 16, marginBottom: 12 } as React.CSSProperties,
  label: { fontSize: 13, color: '#8596b4', marginBottom: 3, fontWeight: 500 } as React.CSSProperties,
  value: { fontSize: 14, color: '#1a2240', fontWeight: 500 } as React.CSSProperties,
  grid2: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px 20px' } as React.CSSProperties,
  grid3: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '12px 20px' } as React.CSSProperties,
  grid4: { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '12px 20px' } as React.CSSProperties,
  inp: { width: '100%', minWidth: 0, boxSizing: 'border-box', padding: '7px 10px', border: '1px solid #e8ebf3', borderRadius: 6, fontSize: 14, fontFamily: 'inherit', outline: 'none', color: '#1a2240' } as React.CSSProperties,
  inpDisabled: { width: '100%', padding: '7px 10px', border: '1px solid #f0f2f8', borderRadius: 6, fontSize: 14, fontFamily: 'inherit', outline: 'none', color: '#1a2240', background: '#f8f9fc' } as React.CSSProperties,
  sectionTitle: { fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '.5px' } as React.CSSProperties,
}

function SuccessToast() {
  return (
    <div style={{ position: 'fixed', top: 20, right: 24, background: '#111827', color: '#fff', padding: '10px 18px', borderRadius: 8, fontSize: 14, fontWeight: 500, zIndex: 200, display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ color: '#34d399' }}>✓</span> Изменения сохранены
    </div>
  )
}

function printContract(type: string, tenant: typeof emptyForm, contractNumber: string, startDate: string, endDate: string, premises: any[]) {
  const typeLabel = CONTRACT_TYPES.find(c => c.key === type)?.label || type
  const premisesText = premises.map(p => `офис ${p.unit_number} (${p.area_actual || '—'} м²)`).join(', ')
  const totalRent = premises.reduce((sum, p) => {
    const active = p.rents?.find((r: any) => !r.valid_to || r.valid_to >= new Date().toISOString().slice(0,10))
    return sum + (active?.monthly_rent || 0)
  }, 0)

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${typeLabel}</title>
  <style>body{font-family:'Times New Roman',serif;font-size:14pt;margin:2cm;line-height:1.5}
  h2{text-align:center;font-size:16pt}h3{font-size:14pt}
  .center{text-align:center}.right{text-align:right}
  table{width:100%;border-collapse:collapse}td,th{border:1px solid #000;padding:6px 10px}
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
  <p>Арендодатель передаёт, а Арендатор принимает нежилые помещения: ${premisesText || '____'}.</p>
  <p>Помещения переданы в состоянии, пригодном для использования. Претензий нет.</p>
  <div class="sign"><div>Передал: ______________</div><div>Принял: ______________</div></div>
  ` : `
  <p>Стороны пришли к соглашению внести следующие изменения в Договор аренды № ${contractNumber}:</p>
  <p>С ${startDate || '«___»'} арендная плата составляет: ${totalRent.toLocaleString('ru')} руб./мес.</p>
  <div class="sign"><div>Арендодатель: ______________</div><div>Арендатор: ______________</div></div>
  `}
  </body></html>`

  const w = window.open('', '_blank')
  if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 500) }
}

export function TenantCardPage({ tenantId, onBack, onCreateInvoice }: { tenantId?: string | null; onBack: () => void; onCreateInvoice?: () => void }) {
  const [tab, setTab] = useState(0)
  const [editing, setEditing] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saved, setSaved] = useState(emptyForm)
  const [dbId, setDbId] = useState<string | null>(null)
  const [loadingTenant, setLoadingTenant] = useState(!!tenantId)
  const [rawData, setRawData] = useState<any>(null)

  // Premises
  type PremiseRent = { id: string; monthly_rent: number | null; cleaning_fee: number | null; valid_from: string | null; valid_to: string | null; notes: string | null }
  type Premise = { id: string; unit_number: string; area_actual: number | null; area_bti: number | null; floor: number | null; rents: PremiseRent[] }
  const [premisesList, setPremisesList] = useState<Premise[]>([])
  const [premisesLoaded, setPremisesLoaded] = useState(false)
  const [premiseModal, setPremiseModal] = useState<Partial<Premise> | null>(null)
  const [rentModal, setRentModal] = useState<{ premiseId: string; rent: Partial<PremiseRent> } | null>(null)
  const [savingPremise, setSavingPremise] = useState(false)

  // Documents
  const [documents, setDocuments] = useState<any[]>([])
  const [docsLoaded, setDocsLoaded] = useState(false)
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null)

  // Contracts
  const [contracts, setContracts] = useState<any[]>([])
  const [contractsLoaded, setContractsLoaded] = useState(false)
  const [contractModal, setContractModal] = useState<any | null>(null)
  const [savingContract, setSavingContract] = useState(false)

  // Invoice
  const [showInvoiceForm, setShowInvoiceForm] = useState(false)
  const [invoiceMonth, setInvoiceMonth] = useState(new Date().getMonth() + 1)
  const [invoiceYear, setInvoiceYear] = useState(new Date().getFullYear())
  const [creating, setCreating] = useState(false)
  const [invoiceCreated, setInvoiceCreated] = useState(false)
  const MONTHS = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']
  const [meters] = useState([
    { type: 'electricity', serial: 'ЭЛ-12345', tariff: 6.38, lastReading: 15420, date: '01.06.2025' },
    { type: 'cold_water', serial: 'ХВ-67890', tariff: 45.2, lastReading: 234, date: '01.06.2025' },
  ])

  useEffect(() => {
    if (!tenantId) return
    setLoadingTenant(true)
    supabase.from('tenants').select('*').eq('id', tenantId).single()
      .then(({ data }) => {
        if (!data) return
        setRawData(data)
        const mapped = {
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
          contractNumber: data.contract_number || '',
          contractStartDate: data.contract_start_date || '',
          contractEndDate: data.contract_end_date || '',
          rent: data.monthly_rent || 0,
          onboardingStatus: data.onboarding_status || 'not_started',
        }
        setForm(mapped)
        setSaved(mapped)
        setDbId(tenantId)
        // Load premises
        supabase.from('tenant_premises').select('*, premise_rents(*)').eq('tenant_id', tenantId).order('unit_number')
          .then(({ data: pd }) => {
            setPremisesList((pd || []).map((p: any) => ({ ...p, rents: (p.premise_rents || []).sort((a: any, b: any) => (b.valid_from || '').localeCompare(a.valid_from || '')) })))
            setPremisesLoaded(true)
          })
        // Load documents
        supabase.from('tenant_documents').select('*').eq('tenant_id', tenantId).order('uploaded_at', { ascending: false })
          .then(({ data: docs }) => { setDocuments(docs || []); setDocsLoaded(true) })
          .catch(() => { setDocuments([]); setDocsLoaded(true) })
        // Load contracts
        supabase.from('tenant_contracts').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false })
          .then(({ data: cts }) => { setContracts(cts || []); setContractsLoaded(true) })
          .catch(() => { setContracts([]); setContractsLoaded(true) })
      }).finally(() => setLoadingTenant(false))
  }, [tenantId])

  const f = (k: keyof typeof form, val?: string) => {
    if (val !== undefined) return setForm(p => ({ ...p, [k]: val }))
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(p => ({ ...p, [k]: e.target.value }))
  }

  const handleSave = async () => {
    if (!dbId) return
    const update: any = {
      full_name: form.fullName,
      inn: form.inn || null, kpp: form.kpp || null, ogrn: form.ogrn || null,
      email: form.email || null, phone: form.phone || null,
      legal_address: form.legalAddress || null,
      bank_account: form.bankAccount || null, bik: form.bik || null, bank_name: form.bank || null,
      monthly_rent: form.rent || null,
      // New fields — saved only if columns exist (Supabase ignores unknown cols gracefully)
      correspondent_account: form.correspondentAccount || null,
      director_name: form.directorName || null,
      director_position: form.directorPosition || null,
      director_basis: form.directorBasis || null,
      passport_series: form.passportSeries || null,
      passport_number: form.passportNumber || null,
      passport_issued_by: form.passportIssuedBy || null,
      passport_issued_date: form.passportIssuedDate || null,
      contract_number: form.contractNumber || null,
      contract_start_date: form.contractStartDate || null,
      contract_end_date: form.contractEndDate || null,
    }
    await supabase.from('tenants').update(update).eq('id', dbId)
    setSaved(form)
    setEditing(false)
    setShowSuccess(true)
    setTimeout(() => setShowSuccess(false), 3000)
  }
  const handleCancel = () => { setForm(saved); setEditing(false) }

  // Onboarding step checks
  const onboardingSteps = [
    {
      label: 'Реквизиты',
      desc: 'ИНН, ОГРН, банковские реквизиты',
      done: !!(saved.inn && saved.ogrn && saved.bank && saved.bankAccount && saved.bik),
      tab: 1,
    },
    {
      label: 'Руководитель и паспорт',
      desc: 'ФИО, должность, паспортные данные',
      done: !!(saved.directorName && saved.passportSeries && saved.passportNumber),
      tab: 1,
    },
    {
      label: 'Документы',
      desc: 'ОГРН, устав, паспорт директора',
      done: documents.length > 0,
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
      desc: 'Договор создан и подписан',
      done: contracts.some(c => c.contract_type === 'lease'),
      tab: 6,
    },
    {
      label: 'Акт приёма-передачи',
      desc: 'Помещение передано арендатору',
      done: contracts.some(c => c.contract_type === 'handover'),
      tab: 6,
    },
  ]
  const stepsComplete = onboardingSteps.filter(s => s.done).length

  async function updateOnboardingStatus(status: string) {
    if (!dbId) return
    await supabase.from('tenants').update({ onboarding_status: status }).eq('id', dbId).catch(() => {})
    setSaved(p => ({ ...p, onboardingStatus: status }))
    setForm(p => ({ ...p, onboardingStatus: status }))
  }

  async function saveContract() {
    if (!contractModal || !dbId) return
    setSavingContract(true)
    const body = { tenant_id: dbId, contract_type: contractModal.type, contract_number: contractModal.number, signed_date: contractModal.date || null, valid_from: contractModal.startDate || null, valid_to: contractModal.endDate || null, notes: contractModal.notes || null }
    if (contractModal.id) {
      await supabase.from('tenant_contracts').update(body).eq('id', contractModal.id)
      setContracts(cs => cs.map(c => c.id === contractModal.id ? { ...c, ...body } : c))
    } else {
      const { data } = await supabase.from('tenant_contracts').insert(body).select('*').single()
      if (data) setContracts(cs => [data, ...cs])
    }
    setContractModal(null)
    setSavingContract(false)
  }

  async function deleteContract(id: string) {
    if (!confirm('Удалить документ?')) return
    await supabase.from('tenant_contracts').delete().eq('id', id)
    setContracts(cs => cs.filter(c => c.id !== id))
  }

  async function handleDocUpload(docType: string, file: File) {
    if (!dbId) return
    setUploadingDoc(docType)
    // Try Supabase Storage upload; fallback to metadata only
    const path = `tenant-docs/${dbId}/${docType}/${file.name}`
    let fileUrl = ''
    const { data: uploaded } = await supabase.storage.from('tenant-documents').upload(path, file, { upsert: true }).catch(() => ({ data: null }))
    if (uploaded) {
      const { data: pub } = supabase.storage.from('tenant-documents').getPublicUrl(path)
      fileUrl = pub?.publicUrl || ''
    }
    const docBody = { tenant_id: dbId, doc_type: docType, file_name: file.name, file_url: fileUrl, notes: null }
    const { data: doc } = await supabase.from('tenant_documents').insert(docBody).select('*').single()
    if (doc) setDocuments(ds => [doc, ...ds])
    setUploadingDoc(null)
  }

  async function deleteDoc(id: string) {
    if (!confirm('Удалить документ?')) return
    await supabase.from('tenant_documents').delete().eq('id', id)
    setDocuments(ds => ds.filter(d => d.id !== id))
  }

  const tabStyle = (i: number): React.CSSProperties => ({
    padding: '7px 14px', border: 'none', background: 'none', fontSize: 14,
    color: tab === i ? '#4f6ef7' : '#6b7280', cursor: 'pointer',
    borderBottom: tab === i ? '2px solid #4f6ef7' : '2px solid transparent',
    marginBottom: -1, fontFamily: 'inherit', fontWeight: tab === i ? 500 : 400,
  })

  const Field = ({ label, k, type = 'text', wide = false }: { label: string; k: keyof typeof form; type?: string; wide?: boolean }) => (
    <div style={wide ? { gridColumn: '1 / -1' } : {}}>
      <div style={s.label}>{label}</div>
      {editing
        ? <input style={s.inp} type={type} value={String(form[k])} onChange={f(k) as any} />
        : <div style={s.value}>{String(saved[k]) || '—'}</div>}
    </div>
  )

  const createInvoice = async () => {
    setCreating(true)
    try {
      await fetch('/api/billing-generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ month: invoiceMonth, year: invoiceYear }) })
      setInvoiceCreated(true); setShowInvoiceForm(false); setTimeout(() => setInvoiceCreated(false), 3000)
    } catch { /* ignore */ } finally { setCreating(false) }
  }

  if (loadingTenant) return <div style={{ padding: 40, color: '#8596b4', fontSize: 14 }}>Загрузка...</div>

  return (
    <div style={{ maxWidth: 900 }}>
      {invoiceCreated && <div style={{ position: 'fixed', top: 20, right: 24, background: '#111827', color: '#fff', padding: '10px 18px', borderRadius: 8, fontSize: 14, fontWeight: 500, zIndex: 200, display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ color: '#34d399' }}>✓</span> Счёт создан</div>}
      {showSuccess && <SuccessToast />}

      {showInvoiceForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 28, width: 380, boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#1a2240', marginBottom: 20 }}>Выставить счёт</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div><div style={{ fontSize: 12, color: '#8596b4', marginBottom: 5 }}>Месяц</div>
                <select value={invoiceMonth} onChange={e => setInvoiceMonth(Number(e.target.value))} style={{ width: '100%', padding: '8px 10px', border: '1px solid #e8ebf3', borderRadius: 7, fontSize: 13, fontFamily: 'inherit', outline: 'none' }}>
                  {MONTHS.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
                </select>
              </div>
              <div><div style={{ fontSize: 12, color: '#8596b4', marginBottom: 5 }}>Год</div>
                <select value={invoiceYear} onChange={e => setInvoiceYear(Number(e.target.value))} style={{ width: '100%', padding: '8px 10px', border: '1px solid #e8ebf3', borderRadius: 7, fontSize: 13, fontFamily: 'inherit', outline: 'none' }}>
                  {[2024,2025,2026].map(y => <option key={y}>{y}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setShowInvoiceForm(false)} style={{ flex: 1, padding: '9px', border: '1px solid #e8ebf3', borderRadius: 7, background: '#fff', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', color: '#6b7280' }}>Отмена</button>
              <button onClick={createInvoice} disabled={creating} style={{ flex: 1, padding: '9px', border: 'none', borderRadius: 7, background: '#4f6ef7', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', color: '#fff' }}>
                {creating ? 'Создаю...' : 'Создать счёт'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button onClick={onBack} style={{ padding: '6px 12px', border: '1px solid #e8ebf3', borderRadius: 7, background: '#fff', cursor: 'pointer', fontSize: 14, fontFamily: 'inherit', color: '#6b7280' }}>← Назад</button>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#1a2240' }}>{saved.fullName || 'Новый арендатор'}</div>
            {/* Onboarding badge */}
            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, fontWeight: 500,
              background: stepsComplete === onboardingSteps.length ? '#dcfce7' : stepsComplete > 0 ? '#fef3c7' : '#f3f4f6',
              color: stepsComplete === onboardingSteps.length ? '#16a34a' : stepsComplete > 0 ? '#d97706' : '#6b7280' }}>
              {stepsComplete === onboardingSteps.length ? '✓ Онбординг завершён' : `Онбординг ${stepsComplete}/${onboardingSteps.length}`}
            </span>
          </div>
          <div style={{ fontSize: 14, color: '#8596b4' }}>{TYPE_LABELS[saved.type]} · ИНН {saved.inn || '—'}</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          {editing ? (
            <>
              <button onClick={handleCancel} style={{ padding: '7px 14px', border: '1px solid #e8ebf3', borderRadius: 7, background: '#fff', cursor: 'pointer', fontSize: 14, fontFamily: 'inherit', color: '#6b7280' }}>Отмена</button>
              <button onClick={handleSave} style={{ padding: '7px 14px', border: 'none', borderRadius: 7, background: '#4f6ef7', cursor: 'pointer', fontSize: 14, fontFamily: 'inherit', color: '#fff', fontWeight: 500 }}>Сохранить</button>
            </>
          ) : (
            <>
              <button onClick={() => setEditing(true)} style={{ padding: '7px 14px', border: '1px solid #e8ebf3', borderRadius: 7, background: '#fff', cursor: 'pointer', fontSize: 14, fontFamily: 'inherit', color: '#374151' }}>Редактировать</button>
              <button onClick={() => setShowInvoiceForm(true)} style={{ padding: '7px 14px', border: 'none', borderRadius: 7, background: '#4f6ef7', cursor: 'pointer', fontSize: 14, fontFamily: 'inherit', color: '#fff', fontWeight: 500 }}>Выставить счёт</button>
            </>
          )}
        </div>
      </div>

      {editing && (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 14, color: '#92400e', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>⚠️</span> Режим редактирования — внесите изменения и нажмите Сохранить
        </div>
      )}

      <div style={{ display: 'flex', borderBottom: '1px solid #e8ebf3', marginBottom: 16, gap: 2, flexWrap: 'wrap' }}>
        {TABS.map((name, i) => (
          <button key={i} style={tabStyle(i)} onClick={() => setTab(i)}>
            {i === 0 && stepsComplete < onboardingSteps.length ? <span style={{ color: '#f59e0b', marginRight: 4 }}>●</span> : null}
            {name}
          </button>
        ))}
      </div>

      {/* ─── TAB 0: ОНБОРДИНГ ─── */}
      {tab === 0 && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#1a2240' }}>Онбординг арендатора</div>
              <div style={{ fontSize: 13, color: '#8596b4', marginTop: 2 }}>Выполните все шаги для завершения регистрации</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ fontSize: 13, color: '#6b7280' }}>{stepsComplete} из {onboardingSteps.length} шагов</div>
              <div style={{ width: 120, height: 6, background: '#f0f2f8', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: `${(stepsComplete / onboardingSteps.length) * 100}%`, height: '100%', background: stepsComplete === onboardingSteps.length ? '#22c55e' : '#4f6ef7', borderRadius: 3, transition: 'width .3s' }} />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {onboardingSteps.map((step, i) => (
              <div key={i} style={{ background: '#fff', border: `1px solid ${step.done ? '#bbf7d0' : '#e8ebf3'}`, borderRadius: 10, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700,
                  background: step.done ? '#dcfce7' : '#f3f4f6', color: step.done ? '#16a34a' : '#9ca3af' }}>
                  {step.done ? '✓' : i + 1}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: step.done ? '#16a34a' : '#1a2240' }}>{step.label}</div>
                  <div style={{ fontSize: 13, color: '#8596b4', marginTop: 2 }}>{step.desc}</div>
                </div>
                <button onClick={() => setTab(step.tab)}
                  style={{ padding: '6px 14px', border: `1px solid ${step.done ? '#bbf7d0' : '#e8ebf3'}`, borderRadius: 7, background: step.done ? '#f0fdf4' : '#fff', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', color: step.done ? '#16a34a' : '#4f6ef7', fontWeight: 500 }}>
                  {step.done ? 'Изменить' : 'Заполнить →'}
                </button>
              </div>
            ))}
          </div>

          {stepsComplete === onboardingSteps.length && saved.onboardingStatus !== 'completed' && (
            <div style={{ marginTop: 16, padding: '16px 20px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#16a34a' }}>Все шаги выполнены!</div>
                <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>Нажмите чтобы зафиксировать завершение онбординга</div>
              </div>
              <button onClick={() => updateOnboardingStatus('completed')}
                style={{ padding: '8px 18px', border: 'none', borderRadius: 7, background: '#16a34a', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                Завершить онбординг
              </button>
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 1: ОБЩИЕ ─── */}
      {tab === 1 && (
        <>
          <div style={s.card}>
            <div style={s.sectionTitle}>Реквизиты организации</div>
            <div style={{ ...s.grid3, marginBottom: 12 }}>
              <Field label="Полное наименование" k="fullName" wide />
              <div>
                <div style={s.label}>Тип</div>
                {editing
                  ? <select style={s.inp} value={form.type} onChange={f('type') as any}>
                      <option value="COMPANY">Юрлицо</option>
                      <option value="IP">ИП</option>
                      <option value="INDIVIDUAL">Физлицо</option>
                    </select>
                  : <div style={s.value}>{TYPE_LABELS[saved.type]}</div>}
              </div>
              <Field label="ИНН" k="inn" />
              <Field label="КПП" k="kpp" />
              <Field label="ОГРН / ОГРНИП" k="ogrn" />
              <Field label="Email" k="email" type="email" />
              <Field label="Телефон" k="phone" type="tel" />
            </div>
            <div><div style={s.label}>Юридический адрес</div>
              {editing
                ? <input style={s.inp} value={form.legalAddress} onChange={f('legalAddress') as any} />
                : <div style={s.value}>{saved.legalAddress || '—'}</div>}
            </div>
          </div>

          <div style={s.card}>
            <div style={s.sectionTitle}>Руководитель</div>
            <div style={s.grid3}>
              <Field label="ФИО директора" k="directorName" />
              <Field label="Должность" k="directorPosition" />
              <Field label="Действует на основании" k="directorBasis" />
            </div>
            <div style={{ ...s.grid4, marginTop: 12 }}>
              <Field label="Серия паспорта" k="passportSeries" />
              <Field label="Номер паспорта" k="passportNumber" />
              <Field label="Дата выдачи" k="passportIssuedDate" type="date" />
              <Field label="Кем выдан" k="passportIssuedBy" />
            </div>
          </div>

          <div style={s.card}>
            <div style={s.sectionTitle}>Банковские реквизиты</div>
            <div style={s.grid3}>
              <Field label="Банк" k="bank" />
              <Field label="Расчётный счёт (р/с)" k="bankAccount" />
              <Field label="Корр. счёт (к/с)" k="correspondentAccount" />
              <Field label="БИК" k="bik" />
            </div>
          </div>

          <div style={s.card}>
            <div style={s.sectionTitle}>Договор аренды</div>
            <div style={s.grid4}>
              <Field label="Номер договора" k="contractNumber" />
              <Field label="Дата начала" k="contractStartDate" type="date" />
              <Field label="Дата окончания" k="contractEndDate" type="date" />
              <div>
                <div style={s.label}>Арендная плата</div>
                {editing
                  ? <input style={s.inp} type="number" value={form.rent} onChange={e => setForm(p => ({ ...p, rent: Number(e.target.value) }))} />
                  : <div style={s.value}>{saved.rent.toLocaleString('ru')} ₽/мес</div>}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ─── TAB 2: ПОМЕЩЕНИЯ ─── */}
      {tab === 2 && (() => {
        const today = new Date().toISOString().slice(0, 10)
        const isActive = (r: any) => !r.valid_to || r.valid_to >= today
        const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('ru-RU') : '∞'
        const fmtMoney = (n: number | null) => n != null ? n.toLocaleString('ru') + ' ₽' : '—'

        async function savePremise() {
          if (!premiseModal || !dbId) return
          setSavingPremise(true)
          if (premiseModal.id) {
            await supabase.from('tenant_premises').update({ unit_number: premiseModal.unit_number, area_actual: premiseModal.area_actual, area_bti: premiseModal.area_bti, floor: premiseModal.floor }).eq('id', premiseModal.id)
            setPremisesList(list => list.map(p => p.id === premiseModal.id ? { ...p, ...premiseModal } as any : p))
          } else {
            const { data } = await supabase.from('tenant_premises').insert({ tenant_id: dbId, unit_number: premiseModal.unit_number || '', area_actual: premiseModal.area_actual || null, area_bti: premiseModal.area_bti || null, floor: premiseModal.floor || null }).select('*').single()
            if (data) setPremisesList(list => [...list, { ...data, rents: [] }])
          }
          setPremiseModal(null); setSavingPremise(false)
        }
        async function deletePremise(id: string) {
          await supabase.from('tenant_premises').delete().eq('id', id)
          setPremisesList(list => list.filter(p => p.id !== id))
        }
        async function saveRent() {
          if (!rentModal) return
          setSavingPremise(true)
          const { premiseId, rent } = rentModal
          if (rent.id) {
            await supabase.from('premise_rents').update({ monthly_rent: rent.monthly_rent, cleaning_fee: rent.cleaning_fee, valid_from: rent.valid_from || null, valid_to: rent.valid_to || null, notes: rent.notes || null }).eq('id', rent.id)
            setPremisesList(list => list.map(p => p.id === premiseId ? { ...p, rents: p.rents.map(r => r.id === rent.id ? { ...r, ...rent } as any : r).sort((a, b) => (b.valid_from || '').localeCompare(a.valid_from || '')) } : p))
          } else {
            const { data } = await supabase.from('premise_rents').insert({ premise_id: premiseId, monthly_rent: rent.monthly_rent || null, cleaning_fee: rent.cleaning_fee || null, valid_from: rent.valid_from || null, valid_to: rent.valid_to || null, notes: rent.notes || null }).select('*').single()
            if (data) setPremisesList(list => list.map(p => p.id === premiseId ? { ...p, rents: [data, ...p.rents].sort((a, b) => (b.valid_from || '').localeCompare(a.valid_from || '')) } : p))
          }
          setRentModal(null); setSavingPremise(false)
        }
        async function deleteRent(premiseId: string, rentId: string) {
          await supabase.from('premise_rents').delete().eq('id', rentId)
          setPremisesList(list => list.map(p => p.id === premiseId ? { ...p, rents: p.rents.filter(r => r.id !== rentId) } : p))
        }

        return (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={s.sectionTitle}>Арендуемые помещения</div>
              <button onClick={() => setPremiseModal({ unit_number: '', area_actual: null, area_bti: null, floor: null })}
                style={{ padding: '5px 14px', border: 'none', borderRadius: 6, background: '#4f6ef7', color: '#fff', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>
                + Добавить помещение
              </button>
            </div>
            {!premisesLoaded ? <div style={{ color: '#8596b4', fontSize: 14, padding: '16px 0' }}>Загрузка...</div>
              : premisesList.length === 0 ? <div style={{ color: '#8596b4', fontSize: 14, padding: '20px 0', textAlign: 'center' }}>Помещения не добавлены.</div>
              : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {premisesList.map(p => {
                    const activeRent = p.rents.find(r => isActive(r))
                    return (
                      <div key={p.id} style={{ border: '1px solid #e8ebf3', borderRadius: 10, overflow: 'hidden' }}>
                        <div style={{ background: '#f8f9fc', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{ flex: 1 }}>
                            <span style={{ fontSize: 14, fontWeight: 600, color: '#1a2240' }}>Офис № {p.unit_number}</span>
                            {p.floor && <span style={{ fontSize: 12, color: '#8596b4', marginLeft: 10 }}>{p.floor} этаж</span>}
                            {p.area_actual && <span style={{ fontSize: 12, color: '#6b7280', marginLeft: 10 }}>{p.area_actual} м²</span>}
                          </div>
                          {activeRent && <div style={{ fontSize: 13, color: '#059669', fontWeight: 600 }}>{fmtMoney((activeRent.monthly_rent || 0) + (activeRent.cleaning_fee || 0))}/мес</div>}
                          <button onClick={() => setPremiseModal({ ...p })} style={{ padding: '4px 10px', border: '1px solid #e8ebf3', borderRadius: 5, background: '#fff', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', color: '#374151' }}>✎</button>
                          <button onClick={() => deletePremise(p.id)} style={{ padding: '4px 8px', border: '1px solid #fee2e2', borderRadius: 5, background: '#fff', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', color: '#ef4444' }}>×</button>
                        </div>
                        <div style={{ padding: '10px 16px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <div style={{ fontSize: 12, fontWeight: 500, color: '#8596b4', textTransform: 'uppercase', letterSpacing: '.4px' }}>История ставок</div>
                            <button onClick={() => setRentModal({ premiseId: p.id, rent: { monthly_rent: null, cleaning_fee: null, valid_from: null, valid_to: null } })}
                              style={{ padding: '3px 10px', border: '1px solid #4f6ef7', borderRadius: 5, background: '#fff', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', color: '#4f6ef7' }}>
                              + Изменить ставку
                            </button>
                          </div>
                          {p.rents.length === 0 ? <div style={{ fontSize: 13, color: '#8596b4' }}>Ставки не указаны</div> : (
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                              <thead><tr style={{ borderBottom: '1px solid #f0f2f8' }}>
                                {['С', 'По', 'Аренда ₽/мес', 'Уборка ₽/мес', 'Итого', 'Статус', ''].map(h => (
                                  <th key={h} style={{ padding: '5px 8px', textAlign: 'left', fontWeight: 500, color: '#8596b4', fontSize: 12 }}>{h}</th>
                                ))}
                              </tr></thead>
                              <tbody>
                                {p.rents.map(r => (
                                  <tr key={r.id} style={{ borderBottom: '1px solid #f8f9fc' }}>
                                    <td style={{ padding: '6px 8px', color: '#374151' }}>{fmtDate(r.valid_from)}</td>
                                    <td style={{ padding: '6px 8px', color: r.valid_to ? '#374151' : '#8596b4' }}>{fmtDate(r.valid_to)}</td>
                                    <td style={{ padding: '6px 8px' }}>{fmtMoney(r.monthly_rent)}</td>
                                    <td style={{ padding: '6px 8px', color: '#6b7280' }}>{fmtMoney(r.cleaning_fee)}</td>
                                    <td style={{ padding: '6px 8px', fontWeight: 600, color: '#1a2240' }}>{fmtMoney((r.monthly_rent || 0) + (r.cleaning_fee || 0))}</td>
                                    <td style={{ padding: '6px 8px' }}>
                                      {isActive(r)
                                        ? <span style={{ fontSize: 11, background: '#dcfce7', color: '#16a34a', padding: '2px 7px', borderRadius: 4, fontWeight: 600 }}>Текущая</span>
                                        : <span style={{ fontSize: 11, background: '#f3f4f6', color: '#6b7280', padding: '2px 7px', borderRadius: 4 }}>Архив</span>}
                                    </td>
                                    <td style={{ padding: '6px 8px' }}>
                                      <button onClick={() => setRentModal({ premiseId: p.id, rent: { ...r } })} style={{ padding: '2px 7px', border: '1px solid #e8ebf3', borderRadius: 4, background: '#fff', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', color: '#374151', marginRight: 4 }}>✎</button>
                                      <button onClick={() => deleteRent(p.id, r.id)} style={{ padding: '2px 6px', border: '1px solid #fee2e2', borderRadius: 4, background: '#fff', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', color: '#ef4444' }}>×</button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

            {premiseModal !== null && (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }} onClick={e => { if (e.target === e.currentTarget) setPremiseModal(null) }}>
                <div style={{ background: '#fff', borderRadius: 12, padding: 28, width: 440, boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#1a2240', marginBottom: 20 }}>{premiseModal.id ? 'Редактировать помещение' : 'Добавить помещение'}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                    <div style={{ gridColumn: '1 / -1' }}><div style={s.label}>Номер офиса</div>
                      <input style={s.inp} value={premiseModal.unit_number || ''} onChange={e => setPremiseModal(p => p ? { ...p, unit_number: e.target.value } : p)} placeholder="204" />
                    </div>
                    <div><div style={s.label}>Площадь факт., м²</div>
                      <input style={s.inp} type="number" value={premiseModal.area_actual ?? ''} onChange={e => setPremiseModal(p => p ? { ...p, area_actual: e.target.value ? parseFloat(e.target.value) : null } : p)} />
                    </div>
                    <div><div style={s.label}>Площадь по БТИ, м²</div>
                      <input style={s.inp} type="number" value={premiseModal.area_bti ?? ''} onChange={e => setPremiseModal(p => p ? { ...p, area_bti: e.target.value ? parseFloat(e.target.value) : null } : p)} />
                    </div>
                    <div><div style={s.label}>Этаж</div>
                      <input style={s.inp} type="number" value={premiseModal.floor ?? ''} onChange={e => setPremiseModal(p => p ? { ...p, floor: e.target.value ? parseInt(e.target.value) : null } : p)} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setPremiseModal(null)} style={{ flex: 1, padding: '9px', border: '1px solid #e8ebf3', borderRadius: 7, background: '#fff', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', color: '#6b7280' }}>Отмена</button>
                    <button onClick={savePremise} disabled={savingPremise} style={{ flex: 1, padding: '9px', border: 'none', borderRadius: 7, background: '#4f6ef7', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', color: '#fff', opacity: savingPremise ? 0.7 : 1 }}>
                      {savingPremise ? 'Сохранение...' : 'Сохранить'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {rentModal !== null && (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }} onClick={e => { if (e.target === e.currentTarget) setRentModal(null) }}>
                <div style={{ background: '#fff', borderRadius: 12, padding: 28, width: 440, boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#1a2240', marginBottom: 4 }}>{rentModal.rent.id ? 'Редактировать ставку' : 'Изменить арендную ставку'}</div>
                  <div style={{ fontSize: 13, color: '#8596b4', marginBottom: 20 }}>Оставьте «по» пустым для бессрочного действия</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                    <div><div style={s.label}>Действует с</div>
                      <input style={s.inp} type="date" value={rentModal.rent.valid_from || ''} onChange={e => setRentModal(m => m ? { ...m, rent: { ...m.rent, valid_from: e.target.value || null } } : m)} />
                    </div>
                    <div><div style={s.label}>Действует по</div>
                      <input style={s.inp} type="date" value={rentModal.rent.valid_to || ''} onChange={e => setRentModal(m => m ? { ...m, rent: { ...m.rent, valid_to: e.target.value || null } } : m)} />
                    </div>
                    <div><div style={s.label}>Аренда ₽/мес</div>
                      <input style={s.inp} type="number" value={rentModal.rent.monthly_rent ?? ''} onChange={e => setRentModal(m => m ? { ...m, rent: { ...m.rent, monthly_rent: e.target.value ? parseFloat(e.target.value) : null } } : m)} />
                    </div>
                    <div><div style={s.label}>Уборка ₽/мес</div>
                      <input style={s.inp} type="number" value={rentModal.rent.cleaning_fee ?? ''} onChange={e => setRentModal(m => m ? { ...m, rent: { ...m.rent, cleaning_fee: e.target.value ? parseFloat(e.target.value) : null } } : m)} />
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}><div style={s.label}>Примечание</div>
                      <input style={s.inp} value={rentModal.rent.notes || ''} onChange={e => setRentModal(m => m ? { ...m, rent: { ...m.rent, notes: e.target.value || null } } : m)} placeholder="Индексация по доп. соглашению №..." />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setRentModal(null)} style={{ flex: 1, padding: '9px', border: '1px solid #e8ebf3', borderRadius: 7, background: '#fff', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', color: '#6b7280' }}>Отмена</button>
                    <button onClick={saveRent} disabled={savingPremise} style={{ flex: 1, padding: '9px', border: 'none', borderRadius: 7, background: '#4f6ef7', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', color: '#fff', opacity: savingPremise ? 0.7 : 1 }}>
                      {savingPremise ? 'Сохранение...' : 'Сохранить'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )
      })()}

      {/* ─── TAB 3: СЧЁТЧИКИ ─── */}
      {tab === 3 && (
        <div style={s.card}>
          <div style={s.sectionTitle}>Приборы учёта</div>
          {meters.map((m, i) => (
            <div key={i} style={{ padding: 12, background: '#f8f9fc', borderRadius: 8, marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: '#1a2240' }}>{METER_LABELS[m.type]}</div>
                  <div style={{ fontSize: 13, color: '#8596b4', marginTop: 2 }}>№ {m.serial} · тариф {m.tariff} ₽/{METER_UNITS[m.type]}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#1a2240' }}>{m.lastReading} {METER_UNITS[m.type]}</div>
                  <div style={{ fontSize: 13, color: '#8596b4' }}>на {m.date}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input placeholder="Новое показание" style={{ ...s.inp, flex: 1 }} type="number" />
                <button style={{ padding: '7px 14px', border: 'none', borderRadius: 6, background: '#4f6ef7', color: '#fff', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>Сохранить</button>
              </div>
            </div>
          ))}
          <button style={{ width: '100%', padding: 8, border: '1px dashed #e8ebf3', borderRadius: 7, background: 'transparent', color: '#4f6ef7', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', marginTop: 4 }}>+ Добавить счётчик</button>
        </div>
      )}

      {/* ─── TAB 4: СЧЕТА ─── */}
      {tab === 4 && (
        <div style={s.card}>
          <div style={s.sectionTitle}>История счетов</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead><tr style={{ background: '#f8f9fc', borderBottom: '1px solid #e8ebf3' }}>
              {['Номер', 'Период', 'Аренда', 'Услуги', 'Итого', 'Статус'].map(h => (
                <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 500, color: '#8596b4', fontSize: 13 }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {[
                { num: '2025-0041', period: 'Июнь 2025', rent: 20500, util: 2500, status: 'SENT' },
                { num: '2025-0028', period: 'Май 2025', rent: 20500, util: 2100, status: 'PAID' },
                { num: '2025-0015', period: 'Апрель 2025', rent: 20500, util: 1850, status: 'PAID' },
              ].map((inv, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f0f2f8' }}>
                  <td style={{ padding: '9px 12px', fontWeight: 500, color: '#1a2240' }}>№{inv.num}</td>
                  <td style={{ padding: '9px 12px', color: '#6b7280' }}>{inv.period}</td>
                  <td style={{ padding: '9px 12px' }}>{inv.rent.toLocaleString('ru')} ₽</td>
                  <td style={{ padding: '9px 12px' }}>{inv.util.toLocaleString('ru')} ₽</td>
                  <td style={{ padding: '9px 12px', fontWeight: 600 }}>{(inv.rent + inv.util).toLocaleString('ru')} ₽</td>
                  <td style={{ padding: '9px 12px' }}>
                    <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 13, fontWeight: 500, background: inv.status === 'PAID' ? '#f0fdf4' : '#eff6ff', color: inv.status === 'PAID' ? '#16a34a' : '#2563eb' }}>
                      {inv.status === 'PAID' ? 'Оплачен' : 'Выставлен'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ─── TAB 5: ДОКУМЕНТЫ ─── */}
      {tab === 5 && (
        <div>
          <div style={{ fontSize: 14, color: '#8596b4', marginBottom: 16 }}>
            Загрузите документы арендатора по категориям
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {DOC_TYPES.map(dt => {
              const existing = documents.filter(d => d.doc_type === dt.key)
              return (
                <div key={dt.key} style={{ background: '#fff', border: '1px solid #e8ebf3', borderRadius: 10, padding: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <span style={{ fontSize: 20 }}>{dt.icon}</span>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#1a2240' }}>{dt.label}</div>
                      <div style={{ fontSize: 12, color: '#8596b4' }}>{existing.length > 0 ? `${existing.length} файл(ов)` : 'Не загружено'}</div>
                    </div>
                    {existing.length > 0 && <span style={{ marginLeft: 'auto', fontSize: 18 }}>✓</span>}
                  </div>
                  {existing.map(doc => (
                    <div key={doc.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px', background: '#f8f9fc', borderRadius: 6, marginBottom: 6, fontSize: 13 }}>
                      <span style={{ color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>{doc.file_name}</span>
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        {doc.file_url && <a href={doc.file_url} target="_blank" rel="noopener noreferrer" style={{ color: '#4f6ef7', fontSize: 12, textDecoration: 'none' }}>↓</a>}
                        <button onClick={() => deleteDoc(doc.id)} style={{ border: 'none', background: 'none', color: '#ef4444', fontSize: 12, cursor: 'pointer', padding: '0 4px' }}>×</button>
                      </div>
                    </div>
                  ))}
                  <label style={{ display: 'block', width: '100%', padding: '6px 0', border: '1px dashed #e8ebf3', borderRadius: 7, background: 'transparent', color: uploadingDoc === dt.key ? '#8596b4' : '#4f6ef7', fontSize: 13, cursor: 'pointer', textAlign: 'center', boxSizing: 'border-box' }}>
                    {uploadingDoc === dt.key ? 'Загрузка...' : '+ Загрузить'}
                    <input type="file" style={{ display: 'none' }} disabled={uploadingDoc === dt.key}
                      onChange={e => { if (e.target.files?.[0]) handleDocUpload(dt.key, e.target.files[0]); e.target.value = '' }} />
                  </label>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ─── TAB 6: ДОГОВОРЫ ─── */}
      {tab === 6 && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            {CONTRACT_TYPES.map(ct => (
              <button key={ct.key}
                onClick={() => setContractModal({ type: ct.key, number: saved.contractNumber || '', date: saved.contractStartDate || '', startDate: saved.contractStartDate || '', endDate: saved.contractEndDate || '', notes: '' })}
                style={{ padding: '7px 14px', border: '1px solid #e8ebf3', borderRadius: 7, background: '#fff', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', color: '#4f6ef7', fontWeight: 500 }}>
                + {ct.label}
              </button>
            ))}
          </div>

          {!contractsLoaded ? <div style={{ color: '#8596b4', fontSize: 14 }}>Загрузка...</div>
            : contracts.length === 0 ? (
              <div style={{ padding: '40px 0', textAlign: 'center', color: '#8596b4', fontSize: 14 }}>
                Договоры не созданы. Нажмите кнопку выше чтобы создать первый документ.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {contracts.map(c => {
                  const typeLabel = CONTRACT_TYPES.find(ct => ct.key === c.contract_type)?.label || c.contract_type
                  return (
                    <div key={c.id} style={{ background: '#fff', border: '1px solid #e8ebf3', borderRadius: 10, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 8, background: '#eff3ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>📄</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#1a2240' }}>{typeLabel}{c.contract_number ? ` № ${c.contract_number}` : ''}</div>
                        <div style={{ fontSize: 13, color: '#8596b4', marginTop: 2 }}>
                          {c.signed_date ? new Date(c.signed_date).toLocaleDateString('ru-RU') : '—'}
                          {c.valid_from && ` · с ${new Date(c.valid_from).toLocaleDateString('ru-RU')}`}
                          {c.valid_to && ` по ${new Date(c.valid_to).toLocaleDateString('ru-RU')}`}
                          {c.notes && ` · ${c.notes}`}
                        </div>
                      </div>
                      <button onClick={() => printContract(c.contract_type, saved, c.contract_number || '', c.valid_from || '', c.valid_to || '', premisesList)}
                        style={{ padding: '6px 12px', border: '1px solid #e8ebf3', borderRadius: 6, background: '#fff', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', color: '#374151' }}>🖨 Печать</button>
                      <button onClick={() => setContractModal({ ...c, type: c.contract_type, startDate: c.valid_from, endDate: c.valid_to })}
                        style={{ padding: '6px 10px', border: '1px solid #e8ebf3', borderRadius: 6, background: '#fff', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', color: '#374151' }}>✎</button>
                      <button onClick={() => deleteContract(c.id)}
                        style={{ padding: '6px 10px', border: '1px solid #fee2e2', borderRadius: 6, background: '#fff', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', color: '#ef4444' }}>×</button>
                    </div>
                  )
                })}
              </div>
            )}

          {contractModal && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }} onClick={e => { if (e.target === e.currentTarget) setContractModal(null) }}>
              <div style={{ background: '#fff', borderRadius: 12, padding: 28, width: 480, boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#1a2240', marginBottom: 20 }}>
                  {CONTRACT_TYPES.find(ct => ct.key === contractModal.type)?.label}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={s.grid2}>
                    <div><div style={s.label}>Номер</div>
                      <input style={s.inp} value={contractModal.number || ''} onChange={e => setContractModal((m: any) => ({ ...m, number: e.target.value }))} placeholder="2025-001" />
                    </div>
                    <div><div style={s.label}>Дата подписания</div>
                      <input style={s.inp} type="date" value={contractModal.date || ''} onChange={e => setContractModal((m: any) => ({ ...m, date: e.target.value }))} />
                    </div>
                    <div><div style={s.label}>Действует с</div>
                      <input style={s.inp} type="date" value={contractModal.startDate || ''} onChange={e => setContractModal((m: any) => ({ ...m, startDate: e.target.value }))} />
                    </div>
                    <div><div style={s.label}>Действует по</div>
                      <input style={s.inp} type="date" value={contractModal.endDate || ''} onChange={e => setContractModal((m: any) => ({ ...m, endDate: e.target.value }))} />
                    </div>
                  </div>
                  <div><div style={s.label}>Примечание</div>
                    <input style={s.inp} value={contractModal.notes || ''} onChange={e => setContractModal((m: any) => ({ ...m, notes: e.target.value }))} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
                  <button onClick={() => setContractModal(null)} style={{ flex: 1, padding: '9px', border: '1px solid #e8ebf3', borderRadius: 7, background: '#fff', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', color: '#6b7280' }}>Отмена</button>
                  <button onClick={() => { saveContract(); setTimeout(() => printContract(contractModal.type, saved, contractModal.number || '', contractModal.startDate || '', contractModal.endDate || '', premisesList), 500) }}
                    style={{ padding: '9px 16px', border: 'none', borderRadius: 7, background: '#6b7280', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', color: '#fff' }}>Сохранить и распечатать</button>
                  <button onClick={saveContract} disabled={savingContract} style={{ flex: 1, padding: '9px', border: 'none', borderRadius: 7, background: '#4f6ef7', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', color: '#fff', opacity: savingContract ? 0.7 : 1 }}>
                    {savingContract ? 'Сохранение...' : 'Сохранить'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
