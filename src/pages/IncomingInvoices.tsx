// Входящие счета от поставщиков и подрядчиков: добавление с распознаванием файла, согласование письмом, отметка оплаты.
import { apiFetch, openStoredFile } from '../lib/api'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  Page, Card, Row, Button, Badge, Stat, Stats, Table, Field, Input, Select, Textarea, Segmented, Modal, Notice, Loading, ErrorBox, Muted, Sub, money, num, dateRu, C, type Tone,
} from '../components/ui'

interface IncomingInvoice {
  id: string
  supplier: string
  amount: number
  vat: number | null
  invoice_date: string | null
  due_date: string | null
  description: string | null
  file_url: string | null
  status: string
  building_id: string | null
  created_at: string
  approval_requested_to: string | null
  approved_by: string | null
  approved_at: string | null
}

interface StaffMember {
  id: string
  full_name: string
  email: string
  position: string | null
}

const STATUS_CONFIG: Record<string, { label: string; tone: Tone }> = {
  NEW:              { label: 'Новый',           tone: 'blue' },
  PENDING_APPROVAL: { label: 'На согласовании', tone: 'amber' },
  APPROVED:         { label: 'Согласован',      tone: 'green' },
  PAID:             { label: 'Оплачен',         tone: 'neutral' },
}

type Filter = 'ALL' | 'NEW' | 'PENDING_APPROVAL' | 'APPROVED' | 'PAID'

function fmtVat(vat: number | null) {
  if (vat == null) return 'без НДС'
  return 'НДС ' + num(vat, 2) + ' ₽'
}

interface FormData {
  supplier: string
  amount: string
  vat: string
  invoice_date: string
  due_date: string
  description: string
  fileBase64: string
  fileMime: string
  fileName: string
}

const emptyForm = (): FormData => ({
  supplier: '', amount: '', vat: '', invoice_date: '', due_date: '', description: '',
  fileBase64: '', fileMime: '', fileName: '',
})

export default function IncomingInvoicesPage() {
  const [invoices, setInvoices] = useState<IncomingInvoice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filterStatus, setFilterStatus] = useState<Filter>('ALL')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FormData>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [recognizing, setRecognizing] = useState(false)
  const [recognizeError, setRecognizeError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  // Approval modal
  const [approvalInvoice, setApprovalInvoice] = useState<IncomingInvoice | null>(null)
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [approvalEmail, setApprovalEmail] = useState('')
  const [sendingApproval, setSendingApproval] = useState(false)
  const [approvalSent, setApprovalSent] = useState(false)
  const [approvalError, setApprovalError] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    const { data, error } = await supabase
      .from('incoming_invoices')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) setError(error.message)
    setInvoices((data as IncomingInvoice[]) || [])
    setLoading(false)
  }

  useEffect(() => {
    load()
    supabase.from('staff').select('id,full_name,email,position').eq('status','active').then(({ data }) => setStaff((data as StaffMember[]) || []))
  }, [])

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1]
      setForm(f => ({ ...f, fileBase64: base64, fileMime: file.type, fileName: file.name }))
    }
    reader.readAsDataURL(file)
  }

  async function recognize() {
    if (!form.fileBase64) {
      setRecognizeError('Файл не выбран или не загружен')
      return
    }
    setRecognizing(true)
    setRecognizeError(null)
    try {
      // Normalize mime type — HEIC and unknown fallback to jpeg
      const supportedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']
      const mimeType = supportedMimes.includes(form.fileMime) ? form.fileMime : 'image/jpeg'

      const r = await apiFetch('/api/recognize-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: form.fileBase64, mimeType }),
      })

      const text = await r.text()
      let d: any
      try { d = JSON.parse(text) } catch {
        setRecognizeError(`Ответ не JSON (${r.status}): ${text.slice(0, 120)}`)
        setRecognizing(false)
        return
      }

      if (d.ok) {
        setForm(f => ({
          ...f,
          supplier: d.supplier || f.supplier,
          amount: d.amount != null ? Number(d.amount).toFixed(2) : f.amount,
          vat: d.vat != null ? Number(d.vat).toFixed(2) : f.vat,
          invoice_date: d.invoice_date || f.invoice_date,
          due_date: d.due_date || f.due_date,
          description: d.description || f.description,
        }))
        setRecognizeError(null)
      } else {
        setRecognizeError(d.error || 'Не удалось распознать')
      }
    } catch (e: any) {
      setRecognizeError(e.message || 'Ошибка сети')
    }
    setRecognizing(false)
  }

  async function uploadFile(): Promise<string | null> {
    if (!form.fileBase64 || !form.fileName) return null
    const byteChars = atob(form.fileBase64)
    const bytes = new Uint8Array(byteChars.length)
    for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i)
    const blob = new Blob([bytes], { type: form.fileMime })
    const ext = form.fileName.split('.').pop() || 'pdf'
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const { error } = await supabase.storage.from('invoices').upload(path, blob, { contentType: form.fileMime })
    if (error) { console.error('Upload error:', error); return null }
    const { data } = supabase.storage.from('invoices').getPublicUrl(path)
    return data.publicUrl
  }

  async function save() {
    if (!form.supplier || !form.amount) return
    setSaving(true)
    setSaveError('')
    const amount = parseFloat(form.amount.replace(',', '.')) || 0
    const fileUrl = await uploadFile()
    const { data: inv, error } = await supabase
      .from('incoming_invoices')
      .insert({
        supplier: form.supplier,
        amount,
        invoice_date: form.invoice_date || null,
        due_date: form.due_date || null,
        description: form.description || null,
        file_url: fileUrl,
        vat: form.vat ? (parseFloat(form.vat.replace(',', '.')) || null) : null,
        status: 'NEW',
      })
      .select()
      .single()

    if (error) {
      setSaving(false)
      setSaveError('Счёт не сохранён: ' + error.message)
      return
    }

    if (inv && form.due_date) {
      await supabase.from('payment_calendar').insert({
        name: `Счёт: ${form.supplier}`,
        amount,
        due_date: form.due_date,
        type: 'INVOICE',
        status: 'PENDING',
        incoming_invoice_id: inv.id,
      })
    }

    setSaving(false)
    setShowForm(false)
    setForm(emptyForm())
    load()
  }

  async function updateStatus(id: string, status: string) {
    const { error } = await supabase.from('incoming_invoices').update({ status }).eq('id', id)
    if (error) { setError('Статус не изменён: ' + error.message); return }
    setInvoices(prev => prev.map(i => i.id === id ? { ...i, status } : i))
  }

  async function sendApproval() {
    if (!approvalInvoice || !approvalEmail) return
    setSendingApproval(true)
    setApprovalError('')
    const member = staff.find(s => s.email === approvalEmail)
    const r = await apiFetch('/api/request-invoice-approval', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        invoiceId: approvalInvoice.id,
        toEmail: approvalEmail,
        toName: member?.full_name || '',
        invoiceData: approvalInvoice,
      }),
    })
    const d = await r.json().catch(() => ({ ok: false, error: 'Ошибка' }))
    if (d.ok) {
      setApprovalSent(true)
      setInvoices(prev => prev.map(i => i.id === approvalInvoice.id
        ? { ...i, status: 'PENDING_APPROVAL', approval_requested_to: approvalEmail }
        : i
      ))
    } else {
      setApprovalError('Ошибка: ' + d.error)
    }
    setSendingApproval(false)
  }

  const filtered = filterStatus === 'ALL' ? invoices : invoices.filter(i => i.status === filterStatus)
  const total = filtered.reduce((s, i) => s + (i.amount || 0), 0)
  const pending = invoices.filter(i => i.status === 'NEW').reduce((s, i) => s + (i.amount || 0), 0)

  return (
    <Page actions={<Button kind="primary" onClick={() => { setShowForm(true); setForm(emptyForm()); setSaveError(''); setRecognizeError(null) }}>Добавить счёт</Button>}>
      <Muted>Счета от поставщиков и подрядчиков</Muted>

      <Stats>
        <Stat label="К оплате (новые)" value={money(pending)} tone={pending > 0 ? 'red' : undefined} />
        <Stat label="Всего в списке" value={money(total)} />
        <Stat label="Счетов" value={invoices.length} />
      </Stats>

      <Segmented<Filter> value={filterStatus} onChange={setFilterStatus}
        options={[['ALL', 'Все'], ['NEW', 'Новые'], ['PENDING_APPROVAL', 'На согласовании'], ['APPROVED', 'Согласованы'], ['PAID', 'Оплачены']]} />

      {error && <ErrorBox error={error} onRetry={load} />}

      <Card pad={false}>
        {loading ? <Loading /> : (
          <Table rows={filtered} rowKey={i => i.id} empty="Нет счетов" cols={[
            { key: 's', title: 'Поставщик', sort: i => i.supplier, render: i => <span style={{ fontWeight: 600 }}>{i.supplier}</span> },
            { key: 'a', title: 'Сумма', align: 'right', sort: i => Number(i.amount || 0), render: i => <>
              <div style={{ fontWeight: 600, color: i.status === 'NEW' ? C.red : C.text }}>{money(i.amount)}</div>
              <Sub>{fmtVat(i.vat)}</Sub>
            </> },
            { key: 'd', title: 'Дата счёта', sort: i => i.invoice_date, render: i => <span style={{ color: C.muted, whiteSpace: 'nowrap' }}>{dateRu(i.invoice_date)}</span> },
            { key: 'due', title: 'Срок оплаты', sort: i => i.due_date, render: i => {
              const isOverdue = !!i.due_date && new Date(i.due_date) < new Date() && i.status !== 'PAID'
              return <div style={{ whiteSpace: 'nowrap', color: isOverdue ? C.red : C.muted, fontWeight: isOverdue ? 600 : 400 }}>
                {dateRu(i.due_date)}{isOverdue && <Sub><span style={{ color: C.red }}>просрочен</span></Sub>}
              </div>
            } },
            { key: 'desc', title: 'Назначение', render: i => <div style={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.description || '—'}</div> },
            { key: 'st', title: 'Статус', sort: i => i.status, render: i => {
              const sc = STATUS_CONFIG[i.status] ?? { label: i.status, tone: 'neutral' as Tone }
              return <>
                <Badge tone={sc.tone}>{sc.label}</Badge>
                {i.status === 'PENDING_APPROVAL' && i.approval_requested_to && <Sub>кому: {i.approval_requested_to}</Sub>}
                {i.status === 'APPROVED' && i.approved_by && <Sub><span style={{ color: C.green }}>согласовал: {i.approved_by}</span></Sub>}
              </>
            } },
            { key: 'act', title: 'Действия', render: i => (
              <Row gap={5}>
                {(i.status === 'NEW' || i.status === 'PENDING_APPROVAL') && (
                  <Button small onClick={() => { setApprovalInvoice(i); setApprovalEmail(''); setApprovalSent(false); setApprovalError('') }}>Согласовать</Button>
                )}
                {i.status === 'NEW' && (
                  <Button small onClick={() => updateStatus(i.id, 'APPROVED')} style={{ color: C.green }}>Согласовать вручную</Button>
                )}
                {i.status === 'APPROVED' && (
                  <Button small kind="primary" onClick={() => updateStatus(i.id, 'PAID')}>Оплачен</Button>
                )}
                {i.status === 'PAID' && (
                  <Button small onClick={() => updateStatus(i.id, 'APPROVED')}>Снять оплату</Button>
                )}
                {i.file_url && (
                  <Button small kind="ghost" onClick={() => openStoredFile(i.file_url!)}>Файл</Button>
                )}
              </Row>
            ) },
          ]} />
        )}
      </Card>

      {/* Approval modal */}
      {approvalInvoice && (
        approvalSent ? (
          <Modal title="Запрос отправлен" onClose={() => setApprovalInvoice(null)} width={460}
            footer={<Button kind="primary" onClick={() => setApprovalInvoice(null)}>Закрыть</Button>}>
            <Notice tone="green">Письмо отправлено на {approvalEmail}</Notice>
          </Modal>
        ) : (
          <Modal title="Отправить на согласование" onClose={() => setApprovalInvoice(null)} width={460} footer={<>
            <Button onClick={() => setApprovalInvoice(null)}>Отмена</Button>
            <Button kind="primary" onClick={sendApproval} disabled={sendingApproval || !approvalEmail}>{sendingApproval ? 'Отправляю…' : 'Отправить'}</Button>
          </>}>
            <Muted>{approvalInvoice.supplier} — {money(approvalInvoice.amount)}</Muted>
            <Field label="Выбрать сотрудника">
              <Select value={approvalEmail} onChange={e => setApprovalEmail(e.target.value)}>
                <option value="">— выберите сотрудника —</option>
                {staff.filter(s => s.email).map(s => (
                  <option key={s.id} value={s.email}>{s.full_name}{s.position ? ` (${s.position})` : ''}</option>
                ))}
              </Select>
            </Field>
            <Field label="или введите email вручную">
              <Input type="email" value={approvalEmail} onChange={e => setApprovalEmail(e.target.value)} placeholder="employee@company.ru" />
            </Field>
            {approvalError && <Notice tone="red">{approvalError}</Notice>}
          </Modal>
        )
      )}

      {/* Add form modal */}
      {showForm && (
        <Modal title="Новый входящий счёт" onClose={() => setShowForm(false)} width={540} footer={<>
          <Button onClick={() => setShowForm(false)}>Отмена</Button>
          <Button kind="primary" onClick={save} disabled={saving || !form.supplier || !form.amount}>{saving ? 'Сохраняю…' : 'Сохранить'}</Button>
        </>}>
          <div style={{ display: 'grid', gap: 4 }}>
            <span style={{ fontSize: 12, color: C.muted, fontWeight: 500 }}>Файл счёта (PDF, фото)</span>
            <Row gap={8}>
              <input ref={fileRef} type="file" accept="image/*,application/pdf" onChange={handleFile} style={{ display: 'none' }} />
              <Button onClick={() => fileRef.current?.click()}>Выбрать файл</Button>
              {form.fileName && <span style={{ fontSize: 13, fontWeight: 400, color: C.muted }}>{form.fileName}</span>}
              {form.fileBase64 && (
                <Button kind="primary" onClick={recognize} disabled={recognizing}>
                  {recognizing ? 'Распознаю…' : 'Распознать (ИИ)'}
                </Button>
              )}
            </Row>
          </div>
          {recognizeError && <Notice tone="red">{recognizeError}</Notice>}

          <Field label="Поставщик *">
            <Input value={form.supplier} onChange={e => setForm(f => ({ ...f, supplier: e.target.value }))} placeholder="ООО Ромашка" />
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            <Field label="Сумма (₽) *">
              <Input type="text" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="50000.00" />
            </Field>
            <Field label="НДС (₽)">
              <Input type="text" value={form.vat} onChange={e => setForm(f => ({ ...f, vat: e.target.value }))} placeholder="без НДС" />
            </Field>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            <Field label="Дата счёта">
              <Input type="date" value={form.invoice_date} onChange={e => setForm(f => ({ ...f, invoice_date: e.target.value }))} />
            </Field>
            <Field label="Срок оплаты">
              <Input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
            </Field>
          </div>

          <Field label="Назначение платежа">
            <Textarea style={{ minHeight: 72 }} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="За что оплачиваем..." />
          </Field>

          {saveError && <Notice tone="red">{saveError}</Notice>}
        </Modal>
      )}
    </Page>
  )
}
