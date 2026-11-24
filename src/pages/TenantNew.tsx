import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Page, Card, Row, Button, Field, Input, Segmented, Notice, C } from '../components/ui'

const TYPES = [
  { value: 'COMPANY', label: 'Юрлицо' },
  { value: 'IP', label: 'ИП' },
  { value: 'INDIVIDUAL', label: 'Физлицо' },
]

export function TenantNewPage({ onBack, onSaved }: { onBack: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    type: 'COMPANY', full_name: '', inn: '', kpp: '', ogrn: '',
    email: '', phone: '', legal_address: '',
    bank_name: 'ПАО Сбербанк России', bank_account: '', bik: '', corr_account: '30101810400000000225'
  })
  const [unit, setUnit] = useState({ number: '', floor: '2', area: '', rent: '', cleaning: '2500' })
  const [lease, setLease] = useState({ start_date: '', end_date: '', deposit: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const f = (k: string) => (e: any) => setForm(p => ({ ...p, [k]: e.target.value }))
  const fu = (k: string) => (e: any) => setUnit(p => ({ ...p, [k]: e.target.value }))
  const fl = (k: string) => (e: any) => setLease(p => ({ ...p, [k]: e.target.value }))

  const save = async () => {
    if (!form.full_name) { setError('Введите наименование'); return }
    setSaving(true); setError('')
    try {
      const { data: tenant, error: err } = await supabase.from('tenants').insert({ ...form, status: 'ACTIVE', monthly_rent: parseFloat(unit.rent) || null }).select().single()
      if (err) throw err
      if (unit.number && tenant) {
        const { data: u, error: ue } = await supabase.from('units').insert({ tenant_id: tenant.id, number: unit.number, floor: parseInt(unit.floor), area: parseFloat(unit.area)||0, rent: parseFloat(unit.rent)||0, cleaning: parseFloat(unit.cleaning)||2500 }).select().single()
        if (ue) throw ue
        if (lease.start_date && u) {
          // Договор со строками: по ним биллинг начисляет аренду и уборку каждый месяц.
          const { data: l, error: le } = await supabase.from('leases').insert({ tenant_id: tenant.id, unit_id: u.id, start_date: lease.start_date, end_date: lease.end_date || null,
            deposit_required: parseFloat(lease.deposit) || 0, status: 'active' }).select('id').single()
          if (le) throw le
          const lines = [
            { lease_id: l.id, article_code: 'RENT', unit_id: u.id, unit_label: unit.number, area: parseFloat(unit.area) || null, amount: parseFloat(unit.rent) || 0, valid_from: lease.start_date },
            { lease_id: l.id, article_code: 'CLEAN', unit_id: u.id, unit_label: unit.number, amount: parseFloat(unit.cleaning) || 0, valid_from: lease.start_date },
          ].filter(x => x.amount > 0)
          if (lines.length) { const { error: lle } = await supabase.from('lease_lines').insert(lines); if (lle) throw lle }
        }
      }
      onSaved()
    } catch (e: any) { setError(e.message) }
    setSaving(false)
  }

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
        title={<Row gap={12} wrap={false}><Button onClick={onBack}>Назад</Button><span>Новый арендатор</span></Row>}
        actions={<>
          <Button onClick={() => printDoc('act')}>Акт приёма-передачи</Button>
          <Button>План этажа</Button>
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
              <Field label="Доп. контакт"><Input placeholder="+7 916 000-00-00" /></Field>
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
            <Field label="Корреспондентский счёт"><Input value={form.corr_account} onChange={f('corr_account')} placeholder="30101810400000000225" /></Field>
          </div>
        </Card>

        <Card title="Помещение и договор">
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={g('repeat(auto-fit, minmax(140px, 1fr))')}>
              <Field label="Номер офиса"><Input value={unit.number} onChange={fu('number')} placeholder="204" /></Field>
              <Field label="Этаж"><Input type="number" value={unit.floor} onChange={fu('floor')} /></Field>
              <Field label="Площадь м²"><Input type="number" value={unit.area} onChange={fu('area')} placeholder="21.6" /></Field>
              <Field label="Аренда ₽/мес"><Input type="number" value={unit.rent} onChange={fu('rent')} placeholder="20500" /></Field>
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
