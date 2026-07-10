import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

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
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  NEW:      { label: 'Новый',      bg: '#eff3ff', color: '#4f6ef7' },
  APPROVED: { label: 'Согласован', bg: '#f0fdf4', color: '#16a34a' },
  PAID:     { label: 'Оплачен',    bg: '#dcfce7', color: '#15803d' },
}

function fmt(n: number) {
  return n.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₽'
}

function fmtVat(vat: number | null) {
  if (vat == null) return 'без НДС'
  return 'НДС ' + vat.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₽'
}

function fmtDate(s: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const ACCENT = '#4f6ef7'
const TEXT = '#1a2240'
const GRAY = '#8596b4'
const BORDER = '#e8ebf3'

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${BORDER}`,
  fontSize: 14, color: TEXT, fontFamily: 'inherit', outline: 'none', background: '#fff',
  boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = { fontSize: 13, color: GRAY, fontWeight: 500, marginBottom: 4, display: 'block' }

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
  const [filterStatus, setFilterStatus] = useState<string>('ALL')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FormData>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [recognizing, setRecognizing] = useState(false)
  const [recognizeError, setRecognizeError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('incoming_invoices')
      .select('*')
      .order('created_at', { ascending: false })
    setInvoices((data as IncomingInvoice[]) || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

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

      const r = await fetch('/api/recognize-invoice', {
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
          amount: d.amount != null ? String(d.amount) : f.amount,
          vat: d.vat != null ? String(d.vat) : f.vat,
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

    if (!error && inv && form.due_date) {
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
    await supabase.from('incoming_invoices').update({ status }).eq('id', id)
    setInvoices(prev => prev.map(i => i.id === id ? { ...i, status } : i))
  }

  const filtered = filterStatus === 'ALL' ? invoices : invoices.filter(i => i.status === filterStatus)
  const total = filtered.reduce((s, i) => s + (i.amount || 0), 0)
  const pending = invoices.filter(i => i.status === 'NEW').reduce((s, i) => s + (i.amount || 0), 0)

  return (
    <div style={{ padding: 24, maxWidth: 1200 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: TEXT }}>Входящие счета</div>
          <div style={{ fontSize: 13, color: GRAY, marginTop: 2 }}>Счета от поставщиков и подрядчиков</div>
        </div>
        <button
          onClick={() => { setShowForm(true); setForm(emptyForm()) }}
          style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: ACCENT, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
        >
          + Добавить счёт
        </button>
      </div>

      {/* KPI */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'К оплате (новые)', value: fmt(pending), color: pending > 0 ? '#ef4444' : TEXT },
          { label: 'Всего в списке', value: fmt(total), color: TEXT },
          { label: 'Счетов', value: String(invoices.length), color: TEXT },
        ].map(k => (
          <div key={k.label} style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 10, padding: '14px 18px', flex: 1 }}>
            <div style={{ fontSize: 12, color: GRAY, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 6 }}>{k.label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        {[['ALL', 'Все'], ['NEW', 'Новые'], ['APPROVED', 'Согласованы'], ['PAID', 'Оплачены']].map(([k, l]) => (
          <button
            key={k}
            onClick={() => setFilterStatus(k)}
            style={{
              padding: '6px 14px', borderRadius: 20, border: `1px solid ${filterStatus === k ? ACCENT : BORDER}`,
              background: filterStatus === k ? ACCENT : '#fff', color: filterStatus === k ? '#fff' : GRAY,
              fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >{l}</button>
        ))}
      </div>

      {/* Table */}
      <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 10, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: GRAY }}>Загрузка...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: GRAY }}>Нет счетов</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: '#f8f9fb' }}>
                {['Поставщик', 'Сумма', 'Дата счёта', 'Срок оплаты', 'Назначение', 'Статус', 'Действия'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: TEXT, borderBottom: `1px solid ${BORDER}`, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(inv => {
                const sc = STATUS_CONFIG[inv.status] ?? { label: inv.status, bg: '#f3f4f6', color: GRAY }
                const isOverdue = inv.due_date && new Date(inv.due_date) < new Date() && inv.status !== 'PAID'
                return (
                  <tr key={inv.id} style={{ borderBottom: `1px solid #f3f4f6` }}>
                    <td style={{ padding: '10px 14px', fontWeight: 600, color: TEXT }}>{inv.supplier}</td>
                    <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                      <div style={{ fontWeight: 700, color: inv.status === 'NEW' ? '#ef4444' : TEXT }}>{fmt(inv.amount)}</div>
                      <div style={{ fontSize: 11, color: GRAY, marginTop: 1 }}>{fmtVat(inv.vat)}</div>
                    </td>
                    <td style={{ padding: '10px 14px', color: GRAY, whiteSpace: 'nowrap' }}>{fmtDate(inv.invoice_date)}</td>
                    <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', color: isOverdue ? '#ef4444' : GRAY, fontWeight: isOverdue ? 600 : 400 }}>{fmtDate(inv.due_date)}{isOverdue ? ' !' : ''}</td>
                    <td style={{ padding: '10px 14px', color: '#374151', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inv.description || '—'}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ background: sc.bg, color: sc.color, padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>{sc.label}</span>
                    </td>
                    <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                      {inv.status === 'NEW' && (
                        <button onClick={() => updateStatus(inv.id, 'APPROVED')} style={{ marginRight: 6, padding: '4px 10px', borderRadius: 6, border: `1px solid ${BORDER}`, background: '#fff', color: TEXT, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Согласовать</button>
                      )}
                      {inv.status === 'APPROVED' && (
                        <button onClick={() => updateStatus(inv.id, 'PAID')} style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: '#dcfce7', color: '#15803d', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>✓ Оплачен</button>
                      )}
                      {inv.file_url && (
                        <a href={inv.file_url} target="_blank" rel="noopener noreferrer" style={{ marginLeft: 6, color: ACCENT, fontSize: 12, textDecoration: 'none' }}>📎</a>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Add form modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 28, width: 540, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: TEXT, marginBottom: 20 }}>Новый входящий счёт</div>

            {/* File upload */}
            <div style={{ marginBottom: 18 }}>
              <label style={labelStyle}>Файл счёта (PDF, фото)</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input ref={fileRef} type="file" accept="image/*,application/pdf" onChange={handleFile} style={{ display: 'none' }} />
                <button
                  onClick={() => fileRef.current?.click()}
                  style={{ padding: '8px 14px', borderRadius: 8, border: `1px solid ${BORDER}`, background: '#f8f9fb', color: TEXT, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  📎 Выбрать файл
                </button>
                {form.fileName && <span style={{ fontSize: 13, color: GRAY }}>{form.fileName}</span>}
                {form.fileBase64 && (
                  <button
                    onClick={recognize}
                    disabled={recognizing}
                    style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: ACCENT, color: '#fff', fontSize: 13, cursor: recognizing ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontWeight: 600 }}
                  >
                    {recognizing ? '✦ Распознаю...' : '✦ AI-распознать'}
                  </button>
                )}
              </div>
              {recognizeError && (
                <div style={{ marginTop: 6, fontSize: 12, color: '#ef4444' }}>⚠ {recognizeError}</div>
              )}
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Поставщик *</label>
              <input style={inputStyle} value={form.supplier} onChange={e => setForm(f => ({ ...f, supplier: e.target.value }))} placeholder="ООО Ромашка" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <label style={labelStyle}>Сумма (₽) *</label>
                <input style={inputStyle} type="text" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="50000.00" />
              </div>
              <div>
                <label style={labelStyle}>НДС (₽)</label>
                <input style={inputStyle} type="text" value={form.vat} onChange={e => setForm(f => ({ ...f, vat: e.target.value }))} placeholder="без НДС" />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <label style={labelStyle}>Дата счёта</label>
                <input style={inputStyle} type="date" value={form.invoice_date} onChange={e => setForm(f => ({ ...f, invoice_date: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>Срок оплаты</label>
                <input style={inputStyle} type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Назначение платежа</label>
              <textarea
                style={{ ...inputStyle, resize: 'vertical', minHeight: 72 }}
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="За что оплачиваем..."
              />
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowForm(false)} style={{ padding: '9px 18px', borderRadius: 8, border: `1px solid ${BORDER}`, background: '#fff', color: GRAY, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>Отмена</button>
              <button
                onClick={save}
                disabled={saving || !form.supplier || !form.amount}
                style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: ACCENT, color: '#fff', fontSize: 14, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: saving || !form.supplier || !form.amount ? .6 : 1 }}
              >
                {saving ? 'Сохраняю...' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
