import { useState } from 'react'
import { supabase } from '../lib/supabase'

const TYPES = [
  { value: 'COMPANY', label: 'Юридическое лицо' },
  { value: 'IP', label: 'ИП' },
  { value: 'INDIVIDUAL', label: 'Физическое лицо' },
]

export function TenantNewPage({ onBack, onSaved }: { onBack: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    type: 'COMPANY', full_name: '', inn: '', kpp: '', ogrn: '',
    email: '', phone: '', legal_address: '', bank_name: 'ПАО Сбербанк России',
    bank_account: '', bik: '', corr_account: '30101810400000000225'
  })
  const [unit, setUnit] = useState({ number: '', floor: '2', area: '', rent: '', cleaning: '2500' })
  const [lease, setLease] = useState({ start_date: '', end_date: '', deposit: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))
  const fu = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setUnit(p => ({ ...p, [k]: e.target.value }))
  const fl = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setLease(p => ({ ...p, [k]: e.target.value }))

  const inp: React.CSSProperties = {
    width: '100%', padding: '9px 12px', border: '1px solid #e8ebf3',
    borderRadius: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none',
    color: '#1a2240', background: '#fff', transition: 'border-color .15s'
  }

  const label: React.CSSProperties = { fontSize: 12, color: '#8596b4', marginBottom: 5, display: 'block', fontWeight: 500 }

  const card: React.CSSProperties = {
    background: '#fff', border: '1px solid #e8ebf3', borderRadius: 10,
    padding: '20px 20px 16px', marginBottom: 14
  }

  const cardTitle: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 16,
    textTransform: 'uppercase', letterSpacing: '.6px'
  }

  const grid2: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: '12px 16px' }
  const grid3: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: '12px 16px' }
  const grid4: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: '12px 16px' }

  const save = async () => {
    if (!form.full_name) { setError('Введите наименование'); return }
    setSaving(true)
    try {
      const { data: tenant, error: err } = await supabase
        .from('tenants').insert({ ...form, status: 'ACTIVE' }).select().single()
      if (err) throw err
      if (unit.number && tenant) {
        const { data: unitData } = await supabase.from('units').insert({
          tenant_id: tenant.id,
          number: unit.number,
          floor: parseInt(unit.floor),
          area: parseFloat(unit.area) || 0,
          rent: parseFloat(unit.rent) || 0,
          cleaning: parseFloat(unit.cleaning) || 2500,
        }).select().single()
        if (lease.start_date && unitData) {
          await supabase.from('leases').insert({
            tenant_id: tenant.id,
            unit_id: unitData.id,
            start_date: lease.start_date,
            end_date: lease.end_date,
            rent: parseFloat(unit.rent) || 0,
            deposit: parseFloat(lease.deposit) || 0,
            status: 'ACTIVE'
          })
        }
      }
      onSaved()
    } catch (e: any) { setError(e.message) }
    setSaving(false)
  }

  const printDoc = (type: 'contract' | 'act') => {
    const title = type === 'contract' ? 'ДОГОВОР АРЕНДЫ НЕЖИЛОГО ПОМЕЩЕНИЯ' : 'АКТ ПРИЁМА-ПЕРЕДАЧИ ПОМЕЩЕНИЯ'
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
    <style>
      body{font-family:Arial,sans-serif;font-size:11pt;color:#000;padding:20mm 20mm 20mm 30mm}
      h2{text-align:center;font-size:13pt;margin:20px 0 10px}
      .sub{text-align:center;font-size:11pt;margin-bottom:30px}
      .city{display:flex;justify-content:space-between;margin-bottom:20px}
      p{margin:8px 0;line-height:1.6}
      table{width:100%;border-collapse:collapse;margin:20px 0}
      td{border:1px solid #000;padding:6px 8px;font-size:10pt}
      .sigs{display:flex;justify-content:space-between;margin-top:40px}
      .sig{width:45%}
      .sig-line{border-bottom:1px solid #000;margin:30px 0 4px}
      b{font-weight:bold}
    </style></head><body>
    <h2>${title}</h2>
    <div class="sub">нежилого помещения</div>
    <div class="city"><span>г. Дмитров, Московская область</span><span>«___» __________ 2026 г.</span></div>
    <p><b>Арендодатель:</b> ИП Зотова Екатерина Викторовна, ИНН 500705271772, ОГРНИП 315500700008401,<br>
    141801, МО, г. Дмитров, мкр. им. Владимира Махалина, д.20</p>
    <p><b>Арендатор:</b> ${form.full_name}${form.inn ? ', ИНН ' + form.inn : ''}${form.ogrn ? ', ОГРН ' + form.ogrn : ''}${form.legal_address ? ',<br>' + form.legal_address : ''}</p>
    ${type === 'contract' ? `
    <p><b>1. ПРЕДМЕТ ДОГОВОРА</b></p>
    <p>1.1. Арендодатель передаёт Арендатору в аренду нежилое помещение № ${unit.number || '___'}, 
    площадью ${unit.area || '___'} кв.м, ${unit.floor ? unit.floor + ' этаж' : ''}, 
    расположенное по адресу: 141801, МО, г. Дмитров, мкр. им. Владимира Махалина, д.20.</p>
    <p><b>2. АРЕНДНАЯ ПЛАТА</b></p>
    <p>2.1. Постоянная часть: ${unit.rent ? parseInt(unit.rent).toLocaleString('ru') : '___'} руб/мес, НДС не облагается.</p>
    <p>2.2. Переменная часть: электроэнергия по счётчику × тариф × 1,0638; уборка ${unit.cleaning} руб/мес.</p>
    <p>2.3. Гарантийный платёж: ${lease.deposit ? parseInt(lease.deposit).toLocaleString('ru') : '___'} руб.</p>
    <p><b>3. СРОК АРЕНДЫ</b></p>
    <p>3.1. Договор действует с ${lease.start_date || '___'} по ${lease.end_date || '___'}.</p>
    <p><b>4. ОТВЕТСТВЕННОСТЬ</b></p>
    <p>4.1. Пени за просрочку: 0,3% от суммы долга за каждый день.</p>
    ` : `
    <p>Арендодатель передал, а Арендатор принял нежилое помещение № ${unit.number || '___'}, 
    площадью ${unit.area || '___'} кв.м, расположенное по адресу: 141801, МО, г. Дмитров, 
    мкр. им. Владимира Махалина, д.20.</p>
    <p><b>Состояние помещения:</b> удовлетворительное, пригодное для использования.</p>
    <p><b>Показания счётчиков на дату передачи:</b></p>
    <table><tr><td>Электроэнергия</td><td>№ счётчика: ___________</td><td>Показание: ___________ кВт·ч</td></tr></table>
    <p><b>Ключи переданы:</b> _____ комплект(а)</p>
    <p>Претензий к состоянию помещения не имеется.</p>
    `}
    <table>
      <tr><td><b>АРЕНДОДАТЕЛЬ</b><br>ИП Зотова Е.В.<br>ИНН 500705271772<br>р/с 40802810340000024041<br>ПАО Сбербанк, БИК 044525225</td>
      <td><b>АРЕНДАТОР</b><br>${form.full_name}<br>${form.inn ? 'ИНН ' + form.inn : ''}<br>${form.bank_account ? 'р/с ' + form.bank_account : ''}<br>${form.bank_name || ''}</td></tr>
    </table>
    <div class="sigs">
      <div class="sig"><div class="sig-line"></div><div>Зотова Е.В. / Арендодатель</div></div>
      <div class="sig"><div class="sig-line"></div><div>_______________ / Арендатор</div></div>
    </div>
    <script>window.onload=function(){window.print()}<\/script>
    </body></html>`
    const w = window.open('', '_blank')
    if (w) { w.document.write(html); w.document.close() }
  }

  return (
    <div style={{ maxWidth: 860 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={onBack} style={{ padding: '6px 12px', border: '1px solid #e8ebf3', borderRadius: 7, background: '#fff', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', color: '#6b7280' }}>← Назад</button>
          <div style={{ fontSize: 18, fontWeight: 600, color: '#1a2240' }}>Новый арендатор</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => printDoc('act')} style={{ padding: '7px 14px', border: '1px solid #e8ebf3', borderRadius: 8, background: '#fff', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', color: '#374151' }}>
            📋 Акт приёма-передачи
          </button>
          <button onClick={() => printDoc('contract')} style={{ padding: '7px 14px', border: '1px solid #4f6ef7', borderRadius: 8, background: '#eff3ff', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', color: '#4f6ef7', fontWeight: 500 }}>
            📄 Распечатать договор
          </button>
        </div>
      </div>

      <div style={card}>
        <div style={cardTitle}>Реквизиты арендатора</div>
        <div style={{ marginBottom: 12 }}>
          <label style={label}>Тип арендатора</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {TYPES.map(t => (
              <button key={t.value} onClick={() => setForm(p => ({ ...p, type: t.value }))}
                style={{ padding: '7px 16px', border: `1px solid ${form.type === t.value ? '#4f6ef7' : '#e8ebf3'}`,
                  borderRadius: 7, background: form.type === t.value ? '#eff3ff' : '#fff',
                  color: form.type === t.value ? '#4f6ef7' : '#6b7280', fontSize: 12,
                  cursor: 'pointer', fontFamily: 'inherit', fontWeight: form.type === t.value ? 500 : 400 }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={label}>Полное наименование *</label>
          <input style={inp} value={form.full_name} onChange={f('full_name')} placeholder={form.type === 'COMPANY' ? 'ООО Название' : form.type === 'IP' ? 'ИП Фамилия Имя Отчество' : 'Фамилия Имя Отчество'} />
        </div>
        <div style={grid3}>
          <div><label style={label}>ИНН</label><input style={inp} value={form.inn} onChange={f('inn')} placeholder={form.type === 'IP' ? '500700000000' : '7700000000'} /></div>
          <div><label style={label}>{form.type === 'COMPANY' ? 'КПП' : 'КПП (не требуется)'}</label><input style={inp} value={form.kpp} onChange={f('kpp')} placeholder="770001001" disabled={form.type !== 'COMPANY'} /></div>
          <div><label style={label}>{form.type === 'IP' ? 'ОГРНИП' : form.type === 'COMPANY' ? 'ОГРН' : 'Паспорт'}</label><input style={inp} value={form.ogrn} onChange={f('ogrn')} placeholder={form.type === 'IP' ? '315500700000000' : '1027700000000'} /></div>
          <div><label style={label}>Email</label><input style={inp} type="email" value={form.email} onChange={f('email')} placeholder="email@company.ru" /></div>
          <div><label style={label}>Телефон</label><input style={inp} value={form.phone} onChange={f('phone')} placeholder="+7 916 000-00-00" /></div>
          <div><label style={label}>Факс / доп. контакт</label><input style={inp} placeholder="+7 916 000-00-00" /></div>
        </div>
        <div style={{ marginTop: 12 }}>
          <label style={label}>Юридический адрес</label>
          <input style={inp} value={form.legal_address} onChange={f('legal_address')} placeholder="г. Москва, ул. Пример, д. 1" />
        </div>
      </div>

      <div style={card}>
        <div style={cardTitle}>Банковские реквизиты</div>
        <div style={{ marginBottom: 12 }}>
          <label style={label}>Банк</label>
          <input style={inp} value={form.bank_name} onChange={f('bank_name')} placeholder="ПАО Сбербанк России" />
        </div>
        <div style={grid3}>
          <div style={{ gridColumn: '1/3' }}><label style={label}>Расчётный счёт</label><input style={inp} value={form.bank_account} onChange={f('bank_account')} placeholder="40702810000000000000" /></div>
          <div><label style={label}>БИК</label><input style={inp} value={form.bik} onChange={f('bik')} placeholder="044525225" /></div>
          <div style={{ gridColumn: '1/-1' }}><label style={label}>Корреспондентский счёт</label><input style={inp} value={form.corr_account} onChange={f('corr_account')} placeholder="30101810400000000225" /></div>
        </div>
      </div>

      <div style={card}>
        <div style={cardTitle}>Помещение и договор</div>
        <div style={grid4}>
          <div><label style={label}>Номер офиса</label><input style={inp} value={unit.number} onChange={fu('number')} placeholder="204" /></div>
          <div><label style={label}>Этаж</label><input style={inp} type="number" value={unit.floor} onChange={fu('floor')} /></div>
          <div><label style={label}>Площадь м²</label><input style={inp} type="number" value={unit.area} onChange={fu('area')} placeholder="21.6" /></div>
          <div><label style={label}>Аренда ₽/мес</label><input style={inp} type="number" value={unit.rent} onChange={fu('rent')} placeholder="20500" /></div>
        </div>
        <div style={{ ...grid3, marginTop: 12 }}>
          <div><label style={label}>Дата начала</label><input style={inp} type="date" value={lease.start_date} onChange={fl('start_date')} /></div>
          <div><label style={label}>Дата окончания</label><input style={inp} type="date" value={lease.end_date} onChange={fl('end_date')} /></div>
          <div><label style={label}>Гарантийный платёж ₽</label><input style={inp} type="number" value={lease.deposit} onChange={fl('deposit')} placeholder={unit.rent || '20500'} /></div>
        </div>
      </div>

      {error && <div style={{ fontSize: 12, color: '#ef4444', marginBottom: 12, padding: '8px 12px', background: '#fef2f2', borderRadius: 7 }}>{error}</div>}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingBottom: 24 }}>
        <button onClick={onBack} style={{ padding: '10px 22px', border: '1px solid #e8ebf3', borderRadius: 8, background: '#fff', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', color: '#6b7280' }}>Отмена</button>
        <button onClick={save} disabled={saving} style={{ padding: '10px 22px', border: 'none', borderRadius: 8, background: '#4f6ef7', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', color: '#fff', opacity: saving ? 0.7 : 1 }}>
          {saving ? 'Сохранение...' : '✓ Создать арендатора'}
        </button>
      </div>
    </div>
  )
}
