import { apiFetch } from '../lib/api'
import { useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAction, sb } from '../lib/query'
import type { TablesInsert } from '../lib/database.types'
import { Page, Card, Row, Button, Badge, Table, Input, Notice, Muted, C } from '../components/ui'

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

/** Ответ /api/import-tenants. */
interface ImportResponse { ok: boolean; error?: string; raw?: string; tenants?: TenantRow[] }

const TYPE_LABEL: Record<string, string> = { COMPANY: 'Юрлицо', IP: 'ИП', INDIVIDUAL: 'Физлицо' }

export default function ImportTenantsPage({ onDone }: { onDone?: () => void }) {
  const [step, setStep] = useState<'upload' | 'preview' | 'done'>('upload')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [rows, setRows] = useState<TenantRow[]>([])
  const [savedCount, setSavedCount] = useState(0)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    setUploading(true)
    setError('')
    try {
      const buf = await file.arrayBuffer()
      const bytes = new Uint8Array(buf)
      let binary = ''
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
      const b64 = btoa(binary)

      const resp = await apiFetch('/api/import-tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileBase64: b64, mimeType: file.type, fileName: file.name }),
      })
      const data: ImportResponse = await resp.json()
      if (!data.ok) {
        setError(data.error + (data.raw ? '\n\n' + data.raw : ''))
        return
      }
      const tenants = data.tenants || []

      // Check which INNs already exist (ошибка проверки — стоп, иначе все строки сочлись бы новыми и задвоились)
      const inns = tenants.map(t => t.inn).filter((v): v is string => !!v)
      const existing = await sb(supabase.from('tenants').select('inn').in('inn', inns))
      const existingInns = new Set(existing.map(t => t.inn))

      const parsed: TenantRow[] = tenants.map(t => ({
        ...t,
        _selected: !existingInns.has(t.inn || ''),
        _exists: existingInns.has(t.inn || ''),
      }))

      setRows(parsed)
      setStep('preview')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
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

  const insert = useAction((toInsert: TablesInsert<'tenants'>[]) => sb(supabase.from('tenants').insert(toInsert)),
    { invalidate: ['tenants', 'rpc:tenant_saldo'], onSuccess: (_r, toInsert) => { setSavedCount(toInsert.length); setStep('done') } })
  const saving = insert.isPending

  function save() {
    const toInsert = rows.filter(r => r._selected && !r._exists).map(({ _selected, _exists, ...r }) => ({
      ...r,
      status: 'ACTIVE',
      monthly_rent: r.monthly_rent ? Number(r.monthly_rent) : null,
    }))
    if (toInsert.length === 0) { setError('Нет выбранных записей'); return }
    setError('')
    insert.mutate(toInsert, { onError: e => setError(e.message) })
  }

  // ─── Upload step ───────────────────────────────────────────────────────────
  if (step === 'upload') return (
    <div style={{ maxWidth: 640, width: '100%', margin: '0 auto' }}>
      <Page title="Импорт арендаторов из 1С">
        <Muted>Выгрузите список контрагентов из 1С в Excel или CSV и загрузите файл — AI автоматически распознает данные.</Muted>

        <Card title="Как выгрузить из 1С">
          {[
            { n: '1', text: 'Откройте 1С → Справочники → Контрагенты' },
            { n: '2', text: 'Нажмите кнопку «Ещё» → «Вывести список»' },
            { n: '3', text: 'Выберите нужные колонки (ИНН, КПП, адрес, телефон и др.)' },
            { n: '4', text: 'Сохраните в Excel (.xlsx) или CSV' },
            { n: '5', text: 'Загрузите файл ниже' },
          ].map(s => (
            <div key={s.n} style={{ display: 'flex', gap: 12, marginBottom: 10, alignItems: 'flex-start' }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: C.accentBg, color: C.accent, fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{s.n}</div>
              <div style={{ fontSize: 13, color: C.text, paddingTop: 3 }}>{s.text}</div>
            </div>
          ))}
        </Card>

        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv,.pdf" style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }}
        />

        <div
          role="button" tabIndex={0}
          onClick={() => !uploading && fileRef.current?.click()}
          onKeyDown={e => { if ((e.key === 'Enter' || e.key === ' ') && !uploading) { e.preventDefault(); fileRef.current?.click() } }}
          onDragOver={e => { e.preventDefault(); if (!uploading) setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f && !uploading) handleFile(f) }}
          style={{
            border: `2px dashed ${dragOver ? C.accent : C.lineStrong}`, borderRadius: 12, padding: '40px 24px', textAlign: 'center',
            cursor: uploading ? 'default' : 'pointer', background: dragOver ? C.accentBg : C.card2, transition: 'border-color .15s',
          }}
        >
          {uploading ? (
            <>
              <div style={{ fontSize: 15, fontWeight: 600, color: C.accent }}>AI читает файл…</div>
              <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>Это может занять 15–30 секунд</div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 15, fontWeight: 600, color: C.text, marginBottom: 6 }}>Перетащите файл или нажмите для выбора</div>
              <div style={{ fontSize: 13, color: C.muted }}>Excel (.xlsx, .xls), CSV, PDF</div>
            </>
          )}
        </div>

        {error && (
          <Notice tone="red">
            <div style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: 12, maxHeight: 160, overflowY: 'auto' }}>{error}</div>
          </Notice>
        )}
      </Page>
    </div>
  )

  // ─── Done step ─────────────────────────────────────────────────────────────
  if (step === 'done') return (
    <div style={{ maxWidth: 480, width: '100%', margin: '40px auto' }}>
      <Card>
        <div style={{ textAlign: 'center', display: 'grid', gap: 8, padding: '16px 0' }}>
          <div><Badge tone="green">Готово</Badge></div>
          <div style={{ fontSize: 20, fontWeight: 600, color: C.text }}>Импорт завершён</div>
          <div style={{ fontSize: 14, color: C.muted, marginBottom: 16 }}>Загружено {savedCount} арендаторов</div>
          <Row gap={10} justify="center">
            <Button onClick={() => { setStep('upload'); setRows([]) }}>Загрузить ещё</Button>
            <Button kind="primary" onClick={onDone}>К арендаторам</Button>
          </Row>
        </div>
      </Card>
    </div>
  )

  // ─── Preview step ──────────────────────────────────────────────────────────
  const selected = rows.filter(r => r._selected && !r._exists).length
  const alreadyExists = rows.filter(r => r._exists).length
  const allNewSelected = rows.filter(r => !r._exists).every(r => r._selected)
  const indexed = rows.map((row, i) => ({ row, i }))

  return (
    <Page
      title={<div>Предпросмотр импорта<div style={{ fontSize: 13, fontWeight: 400, color: C.muted, marginTop: 2 }}>Найдено {rows.length} контрагентов · выбрано {selected} · уже в системе {alreadyExists}</div></div>}
      actions={<>
        <Button onClick={() => setStep('upload')}>Назад</Button>
        <Button onClick={toggleAll}>{allNewSelected ? 'Снять всё' : 'Выбрать всё'}</Button>
        <Button kind="primary" onClick={save} disabled={saving || selected === 0}>
          {saving ? 'Сохранение…' : `Загрузить ${selected} арендаторов`}
        </Button>
      </>}>
      {error && <Notice tone="red">{error}</Notice>}

      <Card pad={false}>
        <Table rows={indexed} rowKey={x => String(x.i)} empty="В файле не найдено контрагентов" cols={[
          { key: 'sel', width: 36, align: 'center', title: <input type="checkbox" checked={allNewSelected} onChange={toggleAll} />, render: ({ row, i }) => (
            <input type="checkbox" checked={row._selected && !row._exists} disabled={row._exists}
              onChange={() => !row._exists && toggle(i)} />
          ) },
          { key: 'n', title: 'Наименование', render: ({ row, i }) => (
            <div style={{ minWidth: 180, opacity: row._exists ? 0.6 : 1 }}>
              <Input style={{ fontWeight: 500, fontSize: 13 }} value={row.full_name}
                onChange={e => edit(i, 'full_name', e.target.value)} disabled={row._exists} />
            </div>
          ) },
          { key: 't', title: 'Тип', render: ({ row }) => <Badge tone="blue">{TYPE_LABEL[row.type] || row.type}</Badge> },
          { key: 'inn', title: 'ИНН', render: ({ row }) => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{row.inn || '—'}</span> },
          { key: 'ph', title: 'Телефон', render: ({ row }) => <span style={{ fontSize: 12 }}>{row.phone || '—'}</span> },
          { key: 'em', title: 'Email', render: ({ row }) => <span style={{ fontSize: 12 }}>{row.email || '—'}</span> },
          { key: 'rent', title: 'Аренда ₽/мес', render: ({ row, i }) => (
            <Input style={{ width: 110, textAlign: 'right', fontSize: 13, opacity: row._exists ? 0.6 : 1 }}
              type="number" value={row.monthly_rent ?? ''}
              placeholder="—"
              onChange={e => edit(i, 'monthly_rent', e.target.value)}
              disabled={row._exists} />
          ) },
          { key: 'st', title: 'Статус', render: ({ row }) => row._exists ? <Badge>Уже есть</Badge> : <Badge tone="green">Новый</Badge> },
        ]} />
      </Card>
    </Page>
  )
}
