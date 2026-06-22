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
    email: '', phone: '', legal_address: '', bank_name: '', bank_account: '', bik: ''
  })
  const [unit, setUnit] = useState({ number: '', floor: '2', area: '', rent: '', cleaning: '2500' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))
  const fu = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setUnit(p => ({ ...p, [k]: e.target.value }))

  const inp: React.CSSProperties = {
    width: '100%', padding: '8px 10px', border: '1px solid #e8ebf3',
    borderRadius: 7, fontSize: 13, fontFamily: 'inherit', outline: 'none', color: '#1a2240'
  }
  const s = { card: { background: '#fff', border: '1px solid #e8ebf3', borderRadius: 9, padding: 16, marginBottom: 12 } as React.CSSProperties }

  const save = async () => {
    if (!form.full_name) { setError('Введите наименование'); return }
    setSaving(true)
    try {
      const { data: tenant, error: err } = await supabase
        .from('tenants').insert({ ...form, status: 'ACTIVE' }).select().single()
      if (err) throw err

      if (unit.number && tenant) {
        await supabase.from('units').insert({
          tenant_id: tenant.id,
          number: unit.number,
          floor: parseInt(unit.floor),
          area: parseFloat(unit.area) || 0,
          rent: parseFloat(unit.rent) || 0,
          cleaning: parseFloat(unit.cleaning) || 2500,
        })
      }
      onSaved()
    } catch (e: any) {
      setError(e.message)
    }
    setSaving(false)
  }

  return (
    <div style={{ maxWidth: 800 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button onClick={onBack} style={{ padding: '6px 12px', border: '1px solid #e8ebf3', borderRadius: 7, background: '#fff', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', color: '#6b7280' }}>← Назад</button>
        <div style={{ fontSize: 18, fontWeight: 600, color: '#1a2240' }}>Новый арендатор</div>
      </div>

      <div style={s.card}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '.5px' }}>Реквизиты</div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: '#8596b4', marginBottom: 5 }}>Тип</div>
          <select style={inp} value={form.type} onChange={f('type')}>
            {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: '12px 16px' }}>
          <div style={{ gridColumn: '1/-1' }}>
            <div style={{ fontSize: 12, color: '#8596b4', marginBottom: 5 }}>Полное наименование *</div>
            <input style={inp} value={form.full_name} onChange={f('full_name')} placeholder="ООО Название или ИП Фамилия И.О." />
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#8596b4', marginBottom: 5 }}>ИНН</div>
            <input style={inp} value={form.inn} onChange={f('inn')} placeholder="7700000000" />
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#8596b4', marginBottom: 5 }}>КПП</div>
            <input style={inp} value={form.kpp} onChange={f('kpp')} placeholder="770001001" />
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#8596b4', marginBottom: 5 }}>ОГРН / ОГРНИП</div>
            <input style={inp} value={form.ogrn} onChange={f('ogrn')} placeholder="1027700000000" />
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#8596b4', marginBottom: 5 }}>Email</div>
            <input style={inp} type="email" value={form.email} onChange={f('email')} placeholder="email@company.ru" />
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#8596b4', marginBottom: 5 }}>Телефон</div>
            <input style={inp} value={form.phone} onChange={f('phone')} placeholder="+7 916 000-00-00" />
          </div>
          <div style={{ gridColumn: '1/-1' }}>
            <div style={{ fontSize: 12, color: '#8596b4', marginBottom: 5 }}>Юридический адрес</div>
            <input style={inp} value={form.legal_address} onChange={f('legal_address')} placeholder="г. Москва, ул. Пример, д. 1" />
          </div>
        </div>
      </div>

      <div style={s.card}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '.5px' }}>Банковские реквизиты</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: '12px 16px' }}>
          <div style={{ gridColumn: '1/-1' }}>
            <div style={{ fontSize: 12, color: '#8596b4', marginBottom: 5 }}>Банк</div>
            <input style={inp} value={form.bank_name} onChange={f('bank_name')} placeholder="ПАО Сбербанк России" />
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#8596b4', marginBottom: 5 }}>Расчётный счёт</div>
            <input style={inp} value={form.bank_account} onChange={f('bank_account')} placeholder="40702810000000000000" />
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#8596b4', marginBottom: 5 }}>БИК</div>
            <input style={inp} value={form.bik} onChange={f('bik')} placeholder="044525225" />
          </div>
        </div>
      </div>

      <div style={s.card}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '.5px' }}>Помещение</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: '12px 16px' }}>
          <div>
            <div style={{ fontSize: 12, color: '#8596b4', marginBottom: 5 }}>Номер офиса</div>
            <input style={inp} value={unit.number} onChange={fu('number')} placeholder="204" />
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#8596b4', marginBottom: 5 }}>Этаж</div>
            <input style={inp} type="number" value={unit.floor} onChange={fu('floor')} placeholder="2" />
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#8596b4', marginBottom: 5 }}>Площадь м²</div>
            <input style={inp} type="number" value={unit.area} onChange={fu('area')} placeholder="21.6" />
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#8596b4', marginBottom: 5 }}>Аренда ₽/мес</div>
            <input style={inp} type="number" value={unit.rent} onChange={fu('rent')} placeholder="20500" />
          </div>
        </div>
      </div>

      {error && <div style={{ fontSize: 12, color: '#ef4444', marginBottom: 12, padding: '8px 12px', background: '#fef2f2', borderRadius: 7 }}>{error}</div>}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <button onClick={onBack} style={{ padding: '9px 20px', border: '1px solid #e8ebf3', borderRadius: 8, background: '#fff', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', color: '#6b7280' }}>Отмена</button>
        <button onClick={save} disabled={saving} style={{ padding: '9px 20px', border: 'none', borderRadius: 8, background: '#4f6ef7', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', color: '#fff', opacity: saving ? 0.7 : 1 }}>
          {saving ? 'Сохранение...' : 'Создать арендатора'}
        </button>
      </div>
    </div>
  )
}
