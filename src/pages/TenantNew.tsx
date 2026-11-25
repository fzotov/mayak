import { useEffect, useState } from 'react'
import { go } from '../lib/nav'
import { supabase } from '../lib/supabase'
import { Page, Card, Row, Button, Field, Input, Segmented, Notice, Badge, Search, C } from '../components/ui'

const TYPES = [
  { value: 'COMPANY', label: 'Юрлицо' },
  { value: 'IP', label: 'ИП' },
  { value: 'INDIVIDUAL', label: 'Физлицо' },
]

const busy = (u: { tenant_id: string | null; status: string | null }) => !!u.tenant_id || u.status === 'occupied'

type UnitRow = { id: string; number: string; floor: number | null; area: number | null; rent_rate: number | null; status: string | null; tenant_id: string | null }

// Мастер заселения. Открывается из сделки (?deal=<id>): контакты и помещения подставляются из неё,
// после сохранения сделка закрывается как «Заселён» и связывается с арендатором.
export function TenantNewPage({ onBack, onSaved }: { onBack: () => void; onSaved: () => void }) {
  const dealId = new URLSearchParams(window.location.search).get('deal')
  const [form, setForm] = useState({
    type: 'COMPANY', full_name: '', inn: '', kpp: '', ogrn: '',
    email: '', phone: '', legal_address: '', contact_name: '', contact_phone: '',
    bank_name: 'ПАО Сбербанк России', bank_account: '', bik: '', correspondent_account: '30101810400000000225'
  })
  const [units, setUnits] = useState<UnitRow[]>([])
  const [picked, setPicked] = useState<string[]>([])
  const [rent, setRent] = useState('')
  const [cleaning, setCleaning] = useState('2500')
  const [lease, setLease] = useState({ start_date: '', end_date: '', deposit: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [deal, setDeal] = useState<any>(null)

  useEffect(() => {
    supabase.from('units').select('id,number,floor,area,rent_rate,status,tenant_id').order('number').then(({ data, error }) => {
      if (error) setError('Не удалось загрузить помещения: ' + error.message)
      setUnits((data as UnitRow[]) || [])
    })
    if (!dealId) return
    supabase.from('deals').select('*, deal_units(unit_id)').eq('id', dealId).maybeSingle().then(({ data, error }) => {
      if (error || !data) { setError('Сделка не найдена'); return }
      if (data.stage === 'won') { setError('Сделка уже закрыта как «Заселён»'); return }
      setDeal(data)
      setForm(p => ({ ...p, full_name: data.company || data.name || '', email: data.email || '', phone: data.phone || '',
        contact_name: data.name || '', contact_phone: data.phone || '' }))
      setPicked((data.deal_units || []).map((x: any) => x.unit_id))
    })
  }, [dealId])

  const sel = units.filter(u => picked.includes(u.id))
  const area = sel.reduce((a, u) => a + Number(u.area || 0), 0)
  const suggested = sel.reduce((a, u) => a + Number(u.area || 0) * Number(u.rent_rate || 0), 0)
  useEffect(() => { if (suggested > 0) setRent(String(Math.round(suggested))) }, [suggested])
  const unit = { number: sel.map(u => u.number).join(', '), floor: String(sel[0]?.floor ?? ''), area: area ? String(Math.round(area * 100) / 100) : '', rent, cleaning }

  const f = (k: string) => (e: any) => setForm(p => ({ ...p, [k]: e.target.value }))
  const fl = (k: string) => (e: any) => setLease(p => ({ ...p, [k]: e.target.value }))
  const toggle = (id: string) => setPicked(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])

  const save = async () => {
    if (!form.full_name.trim()) { setError('Введите наименование'); return }
    if (sel.some(busy)) { setError('Среди выбранных есть занятое помещение: ' + sel.filter(busy).map(u => u.number).join(', ')); return }
    if (sel.length && !lease.start_date) { setError('Укажите дату начала договора'); return }
    setSaving(true); setError('')
    try {
      const monthly = parseFloat(rent) || 0
      const { data: tenant, error: err } = await supabase.from('tenants').insert({
        ...form, status: 'ACTIVE', monthly_rent: monthly || null, cleaning_fee: parseFloat(cleaning) || null,
        unit_number: unit.number || null, area_actual: area || null, rate_per_sqm: area && monthly ? Math.round(monthly / area * 100) / 100 : null,
        contract_start_date: lease.start_date || null, contract_end_date: lease.end_date || null,
      }).select('id').single()
      if (err) throw err
      if (sel.length) {
        const { error: ue } = await supabase.from('units').update({ tenant_id: tenant.id, status: 'occupied' }).in('id', picked).is('tenant_id', null)
        if (ue) throw ue
        // Договор со строками: по ним биллинг начисляет аренду и уборку каждый месяц. Аренда делится по площади помещений.
        const { data: l, error: le } = await supabase.from('leases').insert({ tenant_id: tenant.id, unit_id: sel[0].id, start_date: lease.start_date, end_date: lease.end_date || null,
          deposit_required: parseFloat(lease.deposit) || 0, status: 'active' }).select('id').single()
        if (le) throw le
        const lines = [
          ...sel.map(u => ({ lease_id: l.id, article_code: 'RENT', unit_id: u.id, unit_label: u.number, area: u.area,
            amount: area ? Math.round(monthly * Number(u.area || 0) / area * 100) / 100 : Math.round(monthly / sel.length * 100) / 100, valid_from: lease.start_date })),
          { lease_id: l.id, article_code: 'CLEAN', unit_id: sel[0].id, unit_label: unit.number, area: null, amount: parseFloat(cleaning) || 0, valid_from: lease.start_date },
        ].filter(x => x.amount > 0)
        if (lines.length) { const { error: lle } = await supabase.from('lease_lines').insert(lines); if (lle) throw lle }
      }
      if (deal) {
        const { error: de } = await supabase.from('deals').update({ stage: 'won', tenant_id: tenant.id }).eq('id', deal.id)
        if (de) throw new Error('Арендатор создан, но сделку закрыть не удалось: ' + de.message)
      }
      go('/tenants/' + tenant.id)
      return
    } catch (e: any) { setError(e.message) }
    setSaving(false)
  }
  void onSaved

  const printDoc = (type: 'contract' | 'act') => {
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;font-size:11pt;padding:20mm 20mm 20mm 30mm}h2{text-align:center;margin:20px 0 10px}p{margin:8px 0;line-height:1.6}table{width:100%;border-collapse:collapse;margin:20px 0}td{border:1px solid black;padding:6px 8px}.sigs{display:flex;justify-content:space-between;margin-top:40px}.sig{width:45%}.sig-line{border-bottom:1px solid black;margin:30px 0 4px}</style></head><body>
    <h2>${type === 'contract' ? 'ДОГОВОР АРЕНДЫ НЕЖИЛОГО ПОМЕЩЕНИЯ' : 'АКТ ПРИЁМА-ПЕРЕДАЧИ ПОМЕЩЕНИЯ'}</h2>
    <p style="text-align:center;margin-bottom:30px">г. Дмитров, Московская область &nbsp;&nbsp;&nbsp; «___» __________ 2026 г.</p>
    <p><b>Арендодатель:</b> ИП Зотова Екатерина Викторовна, ИНН 500705271772, ОГРНИП 315500700008401, 141801, МО, г. Дмитров, мкр. им. Владимира Махалина, д.20</p>
    <p><b>Арендатор:</b> ${form.full_name}${form.inn ? ', ИНН ' + form.inn : ''}${form.legal_address ? ', ' + form.legal_address : ''}</p>
    ${type === 'contract' ? `
    <p><b>1. ПРЕДМЕТ ДОГОВОРА</b></p>
    <p>Арендодатель передаёт Арендатору нежилое помещение № ${unit.number||'___'}, площадью ${unit.area||'___'} кв.м, этаж ${unit.floor}, адрес: 141801, МО, г. Дмитров, мкр. им. Владимира Махалина, д.20.</p>
    <p><b>2. АРЕНДНАЯ ПЛАТА</b></p>
    <p>Постоянная часть: ${unit.rent ? parseInt(unit.rent).toLocaleString('ru') : '___'} руб/мес. Переменная: электроэнергия × тариф × 1,0638; уборка ${unit.cleaning} руб/мес.</p>
    <p>Гарантийный платёж: ${lease.deposit ? parseInt(lease.deposit).toLocaleString('ru') : '___'} руб.</p>
    <p><b>3. СРОК:</b> с ${lease.start_date||'___'} по ${lease.end_date||'___'}.</p>
    <p><b>4. Пени:</b> 0,3% от суммы долга за каждый день просрочки.</p>
    ` : `
    <p>Арендодатель передал, Арендатор принял помещение № ${unit.number||'___'}, площадью ${unit.area||'___'} кв.м в удовлетворительном состоянии.</p>
    <table><tr><td>Электроэнергия № ___________</td><td>Показание: ___________ кВт·ч</td></tr></table>
    <p>Ключи переданы: _____ комплект(а). Претензий нет.</p>
    `}
    <table><tr><td><b>АРЕНДОДАТЕЛЬ</b><br>ИП Зотова Е.В., ИНН 500705271772<br>р/с 40802810340000024041, БИК 044525225<br>ПАО Сбербанк России</td>
    <td><b>АРЕНДАТОР</b><br>${form.full_name}<br>${form.inn ? 'ИНН ' + form.inn : ''}<br>${form.bank_account ? 'р/с ' + form.bank_account : ''}</td></tr></table>
    <div class="sigs"><div class="sig"><div class="sig-line"></div>Зотова Е.В.</div><div class="sig"><div class="sig-line"></div>_______________</div></div>
    <script>window.onload=function(){window.print()}<\/script></body></html>`
    const w = window.open('', '_blank')
    if (w) { w.document.write(html); w.document.close() }
  }

  const g = (cols: string): React.CSSProperties => ({ display: 'grid', gridTemplateColumns: cols, gap: 12 })

  return (
    <div style={{ maxWidth: 820 }}>
      <Page
        title={<Row gap={12} wrap={false}><Button onClick={onBack}>Назад</Button><span>{deal ? `Заселение по сделке № ${deal.number}` : 'Новый арендатор'}</span></Row>}
        actions={<>
          <Button onClick={() => printDoc('act')}>Акт приёма-передачи</Button>
          <Button onClick={() => printDoc('contract')}>Распечатать договор</Button>
        </>}>

        <Card title="Реквизиты арендатора">
          <div style={{ display: 'grid', gap: 12 }}>
            <div>
              <Segmented options={TYPES.map(t => [t.value, t.label] as [string, string])} value={form.type} onChange={v => setForm(p => ({ ...p, type: v }))} />
            </div>
            <Field label="Полное наименование *">
              <Input value={form.full_name} onChange={f('full_name')} placeholder={form.type === 'COMPANY' ? 'ООО Название' : form.type === 'IP' ? 'ИП Фамилия Имя Отчество' : 'Фамилия Имя Отчество'} />
            </Field>
            <div style={g('repeat(auto-fit, minmax(180px, 1fr))')}>
              <Field label="ИНН"><Input value={form.inn} onChange={f('inn')} placeholder="7700000000" /></Field>
              <Field label="КПП"><Input value={form.kpp} onChange={f('kpp')} placeholder="770001001" disabled={form.type !== 'COMPANY'} style={form.type !== 'COMPANY' ? { background: C.card2, color: C.faint } : undefined} /></Field>
              <Field label={form.type === 'IP' ? 'ОГРНИП' : 'ОГРН'}><Input value={form.ogrn} onChange={f('ogrn')} placeholder="1027700000000" /></Field>
            </div>
            <div style={g('repeat(auto-fit, minmax(180px, 1fr))')}>
              <Field label="Email"><Input type="email" value={form.email} onChange={f('email')} placeholder="email@company.ru" /></Field>
              <Field label="Телефон"><Input value={form.phone} onChange={f('phone')} placeholder="+7 916 000-00-00" /></Field>
            </div>
            <div style={g('repeat(auto-fit, minmax(180px, 1fr))')}>
              <Field label="Контактное лицо"><Input value={form.contact_name} onChange={f('contact_name')} placeholder="Имя Фамилия" /></Field>
              <Field label="Телефон контакта"><Input value={form.contact_phone} onChange={f('contact_phone')} placeholder="+7 916 000-00-00" /></Field>
            </div>
            <Field label="Юридический адрес">
              <Input value={form.legal_address} onChange={f('legal_address')} placeholder="г. Москва, ул. Пример, д. 1" />
            </Field>
          </div>
        </Card>

        <Card title="Банковские реквизиты">
          <div style={{ display: 'grid', gap: 12 }}>
            <Field label="Банк"><Input value={form.bank_name} onChange={f('bank_name')} placeholder="ПАО Сбербанк России" /></Field>
            <div style={g('repeat(auto-fit, minmax(180px, 1fr))')}>
              <Field label="Расчётный счёт"><Input value={form.bank_account} onChange={f('bank_account')} placeholder="40702810000000000000" /></Field>
              <Field label="БИК"><Input value={form.bik} onChange={f('bik')} placeholder="044525225" /></Field>
            </div>
            <Field label="Корреспондентский счёт"><Input value={form.correspondent_account} onChange={f('correspondent_account')} placeholder="30101810400000000225" /></Field>
          </div>
        </Card>

        <Card title="Помещение и договор">
          <div style={{ display: 'grid', gap: 12 }}>
            <UnitPicker units={units} picked={picked} onToggle={toggle} />
            <div style={g('repeat(auto-fit, minmax(160px, 1fr))')}>
              <Field label="Площадь, м²"><Input value={unit.area} disabled /></Field>
              <Field label="Аренда ₽/мес"><Input type="number" value={rent} onChange={e => setRent(e.target.value)} placeholder="20500" /></Field>
              <Field label="Уборка ₽/мес"><Input type="number" value={cleaning} onChange={e => setCleaning(e.target.value)} /></Field>
            </div>
            <div style={g('repeat(auto-fit, minmax(180px, 1fr))')}>
              <Field label="Дата начала"><Input type="date" value={lease.start_date} onChange={fl('start_date')} /></Field>
              <Field label="Дата окончания"><Input type="date" value={lease.end_date} onChange={fl('end_date')} /></Field>
              <Field label="Гарантийный платёж ₽"><Input type="number" value={lease.deposit} onChange={fl('deposit')} placeholder="20500" /></Field>
            </div>
          </div>
        </Card>

        {error && <Notice tone="red">{error}</Notice>}

        <Row justify="flex-end" gap={10}>
          <Button onClick={onBack}>Отмена</Button>
          <Button kind="primary" onClick={save} disabled={saving}>{saving ? 'Сохранение…' : 'Создать арендатора'}</Button>
        </Row>
      </Page>
    </div>
  )
}

function UnitPicker({ units, picked, onToggle }: { units: UnitRow[]; picked: string[]; onToggle: (id: string) => void }) {
  const [q, setQ] = useState('')
  const [all, setAll] = useState(false)
  const list = units.filter(u => (all || !busy(u) || picked.includes(u.id)) && (!q || String(u.number).toLowerCase().includes(q.toLowerCase())))
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <Row gap={10}>
        <Search value={q} onChange={setQ} placeholder="Номер помещения" width={200} />
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: C.muted }}>
          <input type="checkbox" checked={all} onChange={e => setAll(e.target.checked)} /> показать занятые
        </label>
      </Row>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 180, overflowY: 'auto' }}>
        {list.map(u => {
          const on = picked.includes(u.id)
          return (
            <button key={u.id} type="button" onClick={() => (!busy(u) || on) && onToggle(u.id)} disabled={busy(u) && !on}
              style={{ minHeight: 40, padding: '4px 10px', borderRadius: 8, border: `1px solid ${on ? C.accent : C.line}`, background: on ? C.accent : 'transparent',
                color: on ? C.onAccent : busy(u) ? C.faint : C.text, cursor: busy(u) && !on ? 'default' : 'pointer', fontSize: 13, textAlign: 'left' }}>
              № {u.number}{u.area ? ` · ${u.area} м²` : ''}{busy(u) ? ' · занято' : ''}
            </button>
          )
        })}
        {!list.length && <span style={{ fontSize: 13, color: C.muted }}>Свободных помещений не найдено</span>}
      </div>
      {picked.length > 0 && <div><Badge tone="blue">выбрано: {units.filter(u => picked.includes(u.id)).map(u => u.number).join(', ')}</Badge></div>}
    </div>
  )
}
