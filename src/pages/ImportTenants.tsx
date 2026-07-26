import { useState, useRef } from 'react'
import { supabase } from '../lib/supabase'

interface TenantRow {
  full_name: string
  type: 'COMPANY' | 'IP' | 'INDIVIDUAL'
  inn: string | null
  kpp: string | null
  ogrn: string | null
  email: string | null
  phone: string | null
  legal_address: string | null
  bank_name: string | null
  bank_account: string | null
  bik: string | null
  monthly_rent: number | null
  _selected: boolean
  _exists?: boolean
}

const TYPE_LABEL: Record<string, string> = { COMPANY: 'Юрлицо', IP: 'ИП', INDIVIDUAL: 'Физлицо' }
const FMT = (n: number) => Number(n).toLocaleString('ru-RU', { minimumFractionDigits: 0 })

export default function ImportTenantsPage({ onDone }: { onDone?: () => void }) {
  const [step, setStep] = useState<'upload' | 'preview' | 'done'>('upload')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [rows, setRows] = useState<TenantRow[]>([])
  const [savedCount, setSavedCount] = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)

  const inp: React.CSSProperties = {
    width: '100%', padding: '7px 10px', border: '1px solid #e8ebf3', borderRadius: 6,
    fontSize: 13, fontFamily: 'inherit', outline: 'none', color: '#1a2240', boxSizing: 'border-box' as any,
  }

  async function handleFile(file: File) {
    setUploading(true)
    setError('')
    try {
      const buf = await file.arrayBuffer()
      const bytes = new Uint8Array(buf)
      let binary = ''
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
      const b64 = btoa(binary)

      const resp = await fetch('/api/import-tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileBase64: b64, mimeType: file.type, fileName: file.name }),
      })
      const data = await resp.json()
      if (!data.ok) {
        setError(data.error + (data.raw ? '\n\n' + data.raw : ''))
        return
      }

      // Check which INNs already exist
      const inns = (data.tenants as TenantRow[]).map(t => t.inn).filter(Boolean)
      const { data: existing } = await supabase.from('tenants').select('inn').in('inn', inns as string[])
      const existingInns = new Set((existing || []).map((t: any) => t.inn))

      const parsed: TenantRow[] = (data.tenants as TenantRow[]).map(t => ({
        ...t,
        _selected: !existingInns.has(t.inn || ''),
        _exists: existingInns.has(t.inn || ''),
      }))

      setRows(parsed)
      setStep('preview')
    } catch (e) {
      setError(String(e))
    } finally {
      setUploading(false)
    }
  }

  function toggle(i: number) {
    setRows(r => r.map((row, idx) => idx === i ? { ...row, _selected: !row._selected } : row))
  }

  function toggleAll() {
    const allSelected = rows.filter(r => !r._exists).every(r => r._selected)
    setRows(r => r.map(row => row._exists ? row : { ...row, _selected: !allSelected }))
  }

  function edit(i: number, k: keyof TenantRow, v: string) {
    setRows(r => r.map((row, idx) => idx === i ? { ...row, [k]: v } : row))
  }

  async function save() {
    const toInsert = rows.filter(r => r._selected && !r._exists).map(({ _selected, _exists, ...r }) => ({
      ...r,
      status: 'ACTIVE',
      monthly_rent: r.monthly_rent ? Number(r.monthly_rent) : null,
    }))
    if (toInsert.length === 0) { setError('Нет выбранных записей'); return }

    setSaving(true)
    setError('')
    const { error: err } = await supabase.from('tenants').insert(toInsert)
    if (err) { setError(err.message); setSaving(false); return }

    setSavedCount(toInsert.length)
    setStep('done')
    setSaving(false)
  }

  // ─── Upload step ───────────────────────────────────────────────────────────
  if (step === 'upload') return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <div style={{ fontSize: 18, fontWeight: 600, color: '#1a2240', marginBottom: 6 }}>Импорт арендаторов из 1С</div>
      <div style={{ fontSize: 14, color: '#8596b4', marginBottom: 28 }}>
        Выгрузите список контрагентов из 1С в Excel или CSV и загрузите файл — AI автоматически распознает данные.
      </div>

      <div style={{ background: '#fff', border: '1px solid #e8ebf3', borderRadius: 12, padding: 32, marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 16 }}>Как выгрузить из 1С:</div>
        {[
          { n: '1', text: 'Откройте 1С → Справочники → Контрагенты' },
          { n: '2', text: 'Нажмите кнопку «Ещё» → «Вывести список»' },
          { n: '3', text: 'Выберите нужные колонки (ИНН, КПП, адрес, телефон и др.)' },
          { n: '4', text: 'Сохраните в Excel (.xlsx) или CSV' },
          { n: '5', text: 'Загрузите файл ниже' },
        ].map(s => (
          <div key={s.n} style={{ display: 'flex', gap: 12, marginBottom: 10, alignItems: 'flex-start' }}>
            <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#eff3ff', color: '#4f6ef7', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{s.n}</div>
            <div style={{ fontSize: 13, color: '#374151', paddingTop: 3 }}>{s.text}</div>
          </div>
        ))}
      </div>

      <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv,.pdf" style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }}
      />

      <div
        onClick={() => !uploading && fileRef.current?.click()}
        style={{
          border: '2px dashed #c7d2fe', borderRadius: 12, padding: '40px 24px', textAlign: 'center',
          cursor: uploading ? 'default' : 'pointer', background: '#fafbff', transition: 'border-color .15s',
        }}
      >
        {uploading ? (
          <>
            <div style={{ fontSize: 32, marginBottom: 10 }}>⏳</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#4f6ef7' }}>AI читает файл...</div>
            <div style={{ fontSize: 13, color: '#8596b4', marginTop: 4 }}>Это может занять 15–30 секунд</div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 40, marginBottom: 10 }}>📂</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#1a2240', marginBottom: 6 }}>Перетащите файл или нажмите для выбора</div>
            <div style={{ fontSize: 13, color: '#8596b4' }}>Excel (.xlsx, .xls), CSV, PDF</div>
          </>
        )}
      </div>

      {error && (
        <div style={{ marginTop: 16, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', color: '#ef4444', fontSize: 12, whiteSpace: 'pre-wrap', fontFamily: 'monospace', maxHeight: 160, overflowY: 'auto' }}>
          {error}
        </div>
      )}
    </div>
  )

  // ─── Done step ─────────────────────────────────────────────────────────────
  if (step === 'done') return (
    <div style={{ maxWidth: 480, margin: '60px auto', textAlign: 'center' }}>
      <div style={{ fontSize: 52, marginBottom: 16 }}>✅</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: '#1a2240', marginBottom: 8 }}>Импорт завершён</div>
      <div style={{ fontSize: 15, color: '#8596b4', marginBottom: 32 }}>Загружено {savedCount} арендаторов</div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
        <button onClick={() => { setStep('upload'); setRows([]) }}
          style={{ padding: '10px 22px', border: '1px solid #e8ebf3', borderRadius: 8, background: '#fff', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', color: '#6b7280' }}>
          Загрузить ещё
        </button>
        <button onClick={onDone}
          style={{ padding: '10px 22px', border: 'none', borderRadius: 8, background: '#4f6ef7', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', color: '#fff' }}>
          К арендаторам →
        </button>
      </div>
    </div>
  )

  // ─── Preview step ──────────────────────────────────────────────────────────
  const selected = rows.filter(r => r._selected && !r._exists).length
  const alreadyExists = rows.filter(r => r._exists).length
  const allNewSelected = rows.filter(r => !r._exists).every(r => r._selected)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => setStep('upload')}
          style={{ padding: '6px 12px', border: '1px solid #e8ebf3', borderRadius: 7, background: '#fff', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', color: '#6b7280' }}>
          ← Назад
        </button>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#1a2240' }}>Предпросмотр импорта</div>
          <div style={{ fontSize: 13, color: '#8596b4' }}>
            Найдено {rows.length} контрагентов · выбрано {selected} · уже в системе {alreadyExists}
          </div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button onClick={toggleAll}
            style={{ padding: '7px 14px', border: '1px solid #e8ebf3', borderRadius: 8, background: '#fff', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', color: '#374151' }}>
            {allNewSelected ? 'Снять всё' : 'Выбрать всё'}
          </button>
          <button onClick={save} disabled={saving || selected === 0}
            style={{ padding: '7px 20px', border: 'none', borderRadius: 8, background: '#4f6ef7', fontSize: 13, fontWeight: 600, cursor: selected === 0 ? 'default' : 'pointer', fontFamily: 'inherit', color: '#fff', opacity: selected === 0 ? 0.5 : 1 }}>
            {saving ? 'Сохранение...' : `✓ Загрузить ${selected} арендаторов`}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', color: '#ef4444', fontSize: 13 }}>
          {error}
        </div>
      )}

      <div style={{ background: '#fff', border: '1px solid #e8ebf3', borderRadius: 9, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f8f9fb' }}>
              <th style={{ padding: '9px 12px', width: 36, borderBottom: '1px solid #e8ebf3' }}>
                <input type="checkbox" checked={allNewSelected} onChange={toggleAll} />
              </th>
              {['Наименование', 'Тип', 'ИНН', 'Телефон', 'Email', 'Аренда ₽/мес', 'Статус'].map(h => (
                <th key={h} style={{ padding: '9px 10px', textAlign: 'left', fontWeight: 600, color: '#8596b4', borderBottom: '1px solid #e8ebf3', fontSize: 12, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} style={{
                borderBottom: '1px solid #f3f4f6',
                background: row._exists ? '#f9fafb' : row._selected ? '#fafbff' : '#fff',
                opacity: row._exists ? 0.6 : 1,
              }}>
                <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                  <input type="checkbox" checked={row._selected && !row._exists} disabled={row._exists}
                    onChange={() => !row._exists && toggle(i)} />
                </td>
                <td style={{ padding: '8px 10px', minWidth: 180 }}>
                  <input style={{ ...inp, fontWeight: 500 }} value={row.full_name}
                    onChange={e => edit(i, 'full_name', e.target.value)} disabled={row._exists} />
                </td>
                <td style={{ padding: '8px 10px' }}>
                  <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 6, background: '#eff3ff', color: '#4f6ef7', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {TYPE_LABEL[row.type] || row.type}
                  </span>
                </td>
                <td style={{ padding: '8px 10px', fontFamily: 'monospace', fontSize: 12, color: '#374151' }}>
                  {row.inn || '—'}
                </td>
                <td style={{ padding: '8px 10px', color: '#374151', fontSize: 12 }}>{row.phone || '—'}</td>
                <td style={{ padding: '8px 10px', color: '#374151', fontSize: 12 }}>{row.email || '—'}</td>
                <td style={{ padding: '8px 10px' }}>
                  <input style={{ ...inp, width: 110, textAlign: 'right' as any }}
                    type="number" value={row.monthly_rent ?? ''}
                    placeholder="—"
                    onChange={e => edit(i, 'monthly_rent', e.target.value)}
                    disabled={row._exists} />
                </td>
                <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>
                  {row._exists ? (
                    <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 6, background: '#f3f4f6', color: '#9ca3af', fontWeight: 600 }}>Уже есть</span>
                  ) : (
                    <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 6, background: '#dcfce7', color: '#16a34a', fontWeight: 600 }}>Новый</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
