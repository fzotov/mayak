import { apiFetch } from '../lib/api'
import { go } from '../lib/nav'
import { useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useSb, useAction, sb } from '../lib/query'
import type { Tables, Json } from '../lib/database.types'
import { Page, Card, Row, Button, Badge, Stat, Stats, Table, Field, Input, Notice, Loading, ErrorBox, Muted, Sub, C, money, dateRu } from '../components/ui'

type Unit = Pick<Tables<'units'>, 'id' | 'number' | 'area' | 'status' | 'tenant_id'> & { tenant: { full_name: string } | null }
type HeatBill = Tables<'heat_bills'>
// type, а не interface: так строка распределения совместима с Json при записи в heat_bills.items.
type HeatItem = { unit_id: string; unit_number: string; tenant_name: string; tenant_id?: string | null; area: number; share: number; amount_base: number; amount_final: number }

/** Ответ /api/process-heat (поля могут отсутствовать). */
interface ProcessHeatResponse { ok?: boolean; period?: string; total_amount?: number | string | null; total_gcal?: number | string | null; supplier?: string; raw?: unknown }

const isObj = (v: Json | undefined): v is { [key: string]: Json | undefined } => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: Json | undefined) => (typeof v === 'string' ? v : v == null ? '' : String(v))
const nbr = (v: Json | undefined) => Number(v) || 0

/** Распределение из heat_bills.items (jsonb) — строки без unit_id отбрасываются. */
function parseItems(j: Json | null): HeatItem[] {
  if (!Array.isArray(j)) return []
  return j.filter(isObj).filter(o => typeof o.unit_id === 'string').map(o => ({
    unit_id: str(o.unit_id),
    unit_number: str(o.unit_number),
    tenant_name: str(o.tenant_name),
    tenant_id: typeof o.tenant_id === 'string' ? o.tenant_id : null,
    area: nbr(o.area),
    share: nbr(o.share),
    amount_base: nbr(o.amount_base),
    amount_final: nbr(o.amount_final),
  }))
}

const MONTHS = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']

const now = new Date()

const fmtAmt = (n: number) => money(n)
function fmtPeriod(s: string) { const d = new Date(s); return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}` }

type Msg = { tone: 'green' | 'red' | 'amber'; text: string }

// ── История ────────────────────────────────────────────────────────────────
function HistoryPanel({ bills, onSelect }: { bills: HeatBill[]; onSelect: (b: HeatBill) => void }) {
  if (!bills.length) return null
  return (
    <Card title="История расчётов" pad={false}>
      <Table rows={bills} rowKey={b => b.id} onRow={onSelect} cols={[
        { key: 'p', title: 'Период', sort: b => b.period, render: b => <span style={{ fontWeight: 500 }}>{fmtPeriod(b.period)}</span> },
        { key: 'g', title: 'Гкал', align: 'right', sort: b => Number(b.total_gcal), render: b => <Muted>{b.total_gcal ? Number(b.total_gcal).toFixed(4) + ' Гкал' : '—'}</Muted> },
        { key: 'a', title: 'Сумма', align: 'right', sort: b => Number(b.total_amount), render: b => <span style={{ fontWeight: 500 }}>{fmtAmt(Number(b.total_amount))}</span> },
        { key: 'k', title: 'Коэфф.', align: 'right', render: b => <Muted>×{b.coefficient}</Muted> },
        { key: 's', title: 'Источник', render: b => <Badge tone={b.ai_extracted ? 'blue' : 'neutral'}>{b.ai_extracted ? 'AI' : 'Вручную'}</Badge> },
        { key: 'x', title: '', align: 'right', render: b => <Button small onClick={e => { e.stopPropagation(); onSelect(b) }}>Открыть</Button> },
      ]} />
    </Card>
  )
}

// ── Таблица распределения ──────────────────────────────────────────────────
function DistTable({ items, coefficient }: { items: HeatItem[]; coefficient: number }) {
  if (!items.length) return null
  const totalArea = items.reduce((s, i) => s + i.area, 0)
  const totalBase = items.reduce((s, i) => s + i.amount_base, 0)
  const totalFinal = items.reduce((s, i) => s + i.amount_final, 0)
  const ft: React.CSSProperties = { padding: '9px 12px', fontWeight: 600, background: C.card2, borderTop: `1px solid ${C.lineStrong}`, textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }
  return (
    <Table rows={items} rowKey={i => i.unit_id} cols={[
      { key: 'u', title: 'Помещение', sort: i => i.unit_number, render: i => <span style={{ fontWeight: 600 }}>Офис {i.unit_number}</span> },
      { key: 't', title: 'Арендатор', sort: i => i.tenant_name, render: i => i.tenant_name },
      { key: 'a', title: 'Площадь, м²', align: 'right', sort: i => i.area, render: i => <Muted>{i.area.toFixed(1)}</Muted> },
      { key: 's', title: 'Доля, %', align: 'right', sort: i => i.share, render: i => <Muted>{(i.share * 100).toFixed(2)}%</Muted> },
      { key: 'b', title: 'Сумма без коэф.', align: 'right', sort: i => i.amount_base, render: i => <Muted>{fmtAmt(i.amount_base)}</Muted> },
      { key: 'k', title: 'Коэфф.', align: 'right', render: () => <Muted>×{coefficient}</Muted> },
      { key: 'f', title: 'Итоговая сумма', align: 'right', sort: i => i.amount_final, render: i => <span style={{ fontWeight: 600 }}>{fmtAmt(i.amount_final)}</span> },
    ]} foot={
      <tr>
        <td style={{ ...ft, textAlign: 'left' }}>Итого</td>
        <td style={ft} />
        <td style={ft}>{totalArea.toFixed(1)}</td>
        <td style={ft}>{(items.reduce((s, i) => s + i.share, 0) * 100).toFixed(2)}%</td>
        <td style={ft}>{fmtAmt(totalBase)}</td>
        <td style={{ ...ft, color: C.muted, fontWeight: 400 }}>×{coefficient}</td>
        <td style={{ ...ft, color: C.accent, fontWeight: 700, fontSize: 14 }}>{fmtAmt(totalFinal)}</td>
      </tr>
    } />
  )
}

// ── Главная страница ───────────────────────────────────────────────────────
export default function HeatPage() {
  const fileRef = useRef<HTMLInputElement>(null)

  // Данные счёта
  const [period, setPeriod] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
  const [totalAmount, setTotalAmount] = useState('')
  const [totalGcal, setTotalGcal] = useState('')
  const [coefficient, setCoefficient] = useState(1.2)
  const [totalBuildingArea, setTotalBuildingArea] = useState(0)
  const [settingsMsg, setSettingsMsg] = useState<Msg | null>(null)

  // Состояние
  const [items, setItems] = useState<HeatItem[]>([])
  const [selectedBill, setSelectedBill] = useState<HeatBill | null>(null)

  const unitsQ = useSb(['units', 'heat'], () => sb(supabase.from('units').select('id, number, area, status, tenant_id, tenant:tenants(full_name)').gt('area', 0)))
  const billsQ = useSb(['heat_bills'], () => sb(supabase.from('heat_bills').select('*').order('period', { ascending: false })))
  const settingsQ = useSb(['heat_settings'], () => sb(supabase.from('heat_settings').select('coefficient, valid_from, total_area').order('valid_from', { ascending: false }).limit(1)))
  const units: Unit[] = unitsQ.data ?? []
  const bills: HeatBill[] = billsQ.data ?? []
  const loaded = !unitsQ.isPending && !billsQ.isPending && !settingsQ.isPending
  const loadErr = unitsQ.error || billsQ.error || settingsQ.error
  const loadError = loadErr ? 'Не удалось загрузить данные: ' + loadErr.message : ''
  const loadAll = () => { unitsQ.refetch(); billsQ.refetch(); settingsQ.refetch() }

  // Параметры здания — редактируемые поля; из базы подставляются один раз, при первой загрузке.
  const [settingsApplied, setSettingsApplied] = useState(false)
  if (!settingsApplied && settingsQ.data) {
    setSettingsApplied(true)
    const s = settingsQ.data[0]
    if (s) {
      setCoefficient(Number(s.coefficient))
      setTotalBuildingArea(Number(s.total_area) || 0)
    }
  }

  const [aiLoading, setAiLoading] = useState(false)
  const [aiMsg, setAiMsg] = useState('')
  // Данные извлечены AI (раньше признак брался из «✓» в начале сообщения).
  const [aiOk, setAiOk] = useState(false)
  const [calculated, setCalculated] = useState(false)
  const [doneMsg, setDoneMsg] = useState('')
  const [formMsg, setFormMsg] = useState<Msg | null>(null)

  // Загрузка файла → AI
  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setAiLoading(true); setAiMsg(''); setAiOk(false); setCalculated(false); setDoneMsg(''); setFormMsg(null)
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const base64 = (ev.target?.result as string).split(',')[1]
      try {
        const res = await apiFetch('/api/process-heat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ base64, mediaType: file.type }),
        })
        const data = (await res.json()) as ProcessHeatResponse
        if (data.ok) {
          if (data.period) setPeriod(data.period)
          if (data.total_amount != null && Number(data.total_amount) !== 0) setTotalAmount(String(data.total_amount))
          if (data.total_gcal != null && Number(data.total_gcal) !== 0) setTotalGcal(String(data.total_gcal))
          const parts = [
            data.period && `период: ${data.period}`,
            data.total_amount != null && Number(data.total_amount) !== 0 && `сумма: ${Number(data.total_amount).toLocaleString('ru')} ₽`,
            data.total_gcal != null && Number(data.total_gcal) !== 0 && `объём: ${data.total_gcal} Гкал`,
            data.supplier,
          ].filter(Boolean).join(' · ')
          if (parts) {
            setAiOk(true)
            setAiMsg(`AI извлёк: ${parts}. Проверьте и нажмите «Рассчитать распределение».`)
          } else setAiMsg('AI не нашёл данных в файле — введите вручную.')
        } else {
          setAiMsg(`AI не смог разобрать файл — введите вручную.${data.raw ? ' (ответ: ' + String(data.raw).slice(0, 100) + ')' : ''}`)
        }
      } catch { setAiMsg('Ошибка обработки файла.') }
      setAiLoading(false)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const settingsAction = useAction(async (v: { coefficient: number; total_area: number }) => {
    const existing = await sb(supabase.from('heat_settings').select('id').order('valid_from', { ascending: false }).limit(1))
    if (existing[0]) await sb(supabase.from('heat_settings').update(v).eq('id', existing[0].id))
    else await sb(supabase.from('heat_settings').insert({ ...v, valid_from: new Date().toISOString().slice(0, 10) }))
  }, {
    invalidate: ['heat_settings'],
    onSuccess: () => setSettingsMsg({ tone: 'green', text: 'Параметры здания сохранены.' }),
  })
  const savingSettings = settingsAction.isPending

  function saveSettings() {
    setSettingsMsg(null)
    settingsAction.mutate({ coefficient, total_area: totalBuildingArea })
  }

  // Расчёт распределения
  function calculate() {
    setFormMsg(null)
    const amount = parseFloat(totalAmount)
    if (!amount || amount <= 0) { setFormMsg({ tone: 'amber', text: 'Введите общую сумму' }); return }
    if (!units.length) { setFormMsg({ tone: 'amber', text: 'Нет помещений с площадью больше нуля' }); return }
    if (!totalBuildingArea || totalBuildingArea <= 0) { setFormMsg({ tone: 'amber', text: 'Укажите общую площадь здания в параметрах выше' }); return }
    const result: HeatItem[] = units.map(u => {
      const area = Number(u.area)
      const share = area / totalBuildingArea   // доля от всего здания
      const base = amount * share
      const final = base * coefficient
      return {
        unit_id: u.id,
        unit_number: u.number,
        tenant_name: u.tenant?.full_name ?? '—',
        tenant_id: u.tenant_id,
        area,
        share,
        amount_base: Math.round(base * 100) / 100,
        amount_final: Math.round(final * 100) / 100,
      }
    })
    setItems(result)
    setCalculated(true)
    setSelectedBill(null)
    setDoneMsg('')
  }

  // Сохранить расчёт
  const saveAction = useAction(async (v: { amount: number; gcal: number; createInvoices: boolean }) => {
    await sb(supabase.from('heat_bills').insert({
      period: period + '-01',
      total_amount: v.amount,
      total_gcal: v.gcal,
      coefficient,
      ai_extracted: aiOk,
      items,
    }).select().single())
  }, {
    invalidate: ['heat_bills'],
    onSuccess: (_r, v) => {
      // Начисления за тепло создаёт биллинг по этому распределению (статья «Тепло»), отдельные счета здесь не заводятся.
      setDoneMsg('Расчёт сохранён. Тепло войдёт в счета арендаторов при проведении биллинга за этот месяц.')
      if (v.createInvoices) go('/billing')
    },
  })
  const saving = saveAction.isPending

  function saveCalculation(createInvoices = false) {
    const amount = parseFloat(totalAmount)
    const gcal = parseFloat(totalGcal) || 0
    if (!amount || !items.length) return
    setFormMsg(null)
    saveAction.mutate({ amount, gcal, createInvoices })
  }

  // Открыть сохранённый расчёт
  function openBill(b: HeatBill) {
    setSelectedBill(b)
    setPeriod(b.period.slice(0, 7))
    setTotalAmount(String(b.total_amount))
    setTotalGcal(b.total_gcal == null ? '' : String(b.total_gcal))
    setCoefficient(b.coefficient ?? 1)
    setItems(parseItems(b.items))
    setCalculated(true)
    setDoneMsg(''); setFormMsg(null)
    setAiOk(!!b.ai_extracted)
    setAiMsg(b.ai_extracted ? 'Данные были извлечены AI' : '')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function newCalculation() {
    setSelectedBill(null); setCalculated(false); setItems([]); setTotalAmount(''); setTotalGcal(''); setAiMsg(''); setAiOk(false); setDoneMsg(''); setFormMsg(null)
  }

  const [month, year] = (() => {
    const [y, m] = period.split('-')
    return [Number(m), Number(y)]
  })()

  if (!loaded) return <Page><Loading /></Page>

  const unitsArea = units.reduce((s, u) => s + Number(u.area), 0)

  return (
    <Page>
      <div style={{ display: 'grid', gap: 16, maxWidth: 1000, minWidth: 0 }}>
        {loadError && <ErrorBox error={loadError} onRetry={loadAll} />}

        {/* Настройки здания */}
        <Card title="Параметры здания" actions={
          <Button kind="primary" small onClick={saveSettings} disabled={savingSettings}>{savingSettings ? 'Сохранение…' : 'Сохранить'}</Button>
        }>
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div style={{ width: 200 }}>
                <Field label="Общая площадь здания, м² (обязательно)" hint="100% — база для распределения тепла">
                  <Input type="number" min="0" step="0.1" value={totalBuildingArea || ''} placeholder="Например: 1250.0"
                    onChange={e => { setTotalBuildingArea(Number(e.target.value)); setCalculated(false) }} />
                </Field>
              </div>
              <div style={{ width: 180 }}>
                <Field label="Коэффициент увеличения" hint="Множитель к базовой сумме">
                  <Input type="number" step="0.01" min="1" max="5" value={coefficient}
                    onChange={e => { setCoefficient(Number(e.target.value)); setCalculated(false) }} />
                </Field>
              </div>
              {units.length > 0 && totalBuildingArea > 0 && (
                <div style={{ background: C.accentBg, color: C.text, borderRadius: C.radiusSm, padding: '8px 12px', fontSize: 12, lineHeight: 1.6 }}>
                  <div>Помещений в базе: <b>{units.length}</b> · {unitsArea.toFixed(1)} м²</div>
                  <div>Доля помещений: <b>{(unitsArea / totalBuildingArea * 100).toFixed(1)}%</b> от здания</div>
                  <div style={{ color: C.muted }}>Остаток (коридоры, МОП): {(totalBuildingArea - unitsArea).toFixed(1)} м²</div>
                </div>
              )}
            </div>
            {settingsMsg && <Notice tone={settingsMsg.tone}>{settingsMsg.text}</Notice>}
            {settingsAction.error && <Notice tone="red">Не удалось сохранить: {settingsAction.error}</Notice>}
          </div>
        </Card>

        {/* Ввод данных счёта */}
        <Card title="Счёт от теплоснабжающей организации">
          <div style={{ display: 'grid', gap: 14 }}>
            <div style={{ display: 'grid', gap: 8 }}>
              <input ref={fileRef} type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={handleFile} />
              <Row gap={10}>
                <Button onClick={() => fileRef.current?.click()} disabled={aiLoading}>
                  {aiLoading ? 'AI обрабатывает…' : 'Загрузить фото или PDF счёта'}
                </Button>
                <Muted small>AI извлечёт сумму, период и объём Гкал</Muted>
              </Row>
              {aiMsg && <Notice tone={aiOk ? 'green' : 'amber'}>{aiMsg}</Notice>}
            </div>

            <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 14, display: 'grid', gap: 10 }}>
              <Muted small>Введите данные вручную или проверьте извлечённые AI</Muted>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                <Field label="Период">
                  <Input type="month" value={period} onChange={e => { setPeriod(e.target.value); setCalculated(false) }} />
                </Field>
                <Field label="Общая сумма, ₽">
                  <Input type="number" min="0" step="0.01" value={totalAmount} placeholder="0.00"
                    onChange={e => { setTotalAmount(e.target.value); setCalculated(false) }} />
                </Field>
                <Field label="Объём тепла, Гкал">
                  <Input type="number" min="0" step="0.0001" value={totalGcal} placeholder="0.0000"
                    onChange={e => setTotalGcal(e.target.value)} />
                </Field>
              </div>
            </div>

            {formMsg && <Notice tone={formMsg.tone}>{formMsg.text}</Notice>}
            {saveAction.error && <Notice tone="red">Ошибка сохранения: {saveAction.error}</Notice>}
            <Row><Button kind="primary" onClick={calculate}>Рассчитать распределение</Button></Row>
          </div>
        </Card>

        {/* Результат */}
        {calculated && items.length > 0 && (
          <Card pad={false} title={<>
            Распределение тепла — {MONTHS[month - 1]} {year}
            <Sub>{items.length} помещений · коэф. ×{coefficient}{totalGcal && ` · ${parseFloat(totalGcal).toFixed(4)} Гкал`}</Sub>
          </>} actions={
            <Row>
              {selectedBill ? (
                <Button onClick={newCalculation}>Новый расчёт</Button>
              ) : (
                <>
                  <Button onClick={() => saveCalculation(false)} disabled={saving}>{saving ? 'Сохранение…' : 'Сохранить расчёт'}</Button>
                  <Button kind="primary" onClick={() => saveCalculation(true)} disabled={saving}>Сохранить и открыть биллинг</Button>
                </>
              )}
            </Row>
          }>
            <div style={{ padding: 16, display: 'grid', gap: 12 }}>
              {selectedBill && (
                <Notice>Архивный расчёт от {dateRu(selectedBill.created_at)} — только просмотр. Нажмите «Новый расчёт», чтобы создать новый.</Notice>
              )}
              {doneMsg && <Notice tone="green">{doneMsg}</Notice>}
              <Stats>
                <Stat label="Исходная сумма" value={fmtAmt(parseFloat(totalAmount) || 0)} />
                <Stat label="Итого с коэффициентом" value={fmtAmt(items.reduce((s, i) => s + i.amount_final, 0))} tone="blue" />
                <Stat label="Площадь здания" value={totalBuildingArea.toFixed(1) + ' м² (100%)'} />
                <Stat label="Площадь помещений" value={items.reduce((s, i) => s + i.area, 0).toFixed(1) + ' м² · ' + (items.reduce((s, i) => s + i.share, 0) * 100).toFixed(1) + '%'} />
              </Stats>
            </div>
            <DistTable items={items} coefficient={coefficient} />
          </Card>
        )}

        {calculated && items.length === 0 && (
          <Card><Muted>Нет занятых помещений с площадью больше нуля</Muted></Card>
        )}

        {/* История */}
        <HistoryPanel bills={bills} onSelect={openBill} />
      </div>
    </Page>
  )
}
