import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const TABS = ['Общие', 'Помещения', 'Счётчики', 'Услуги', 'Счета', 'История', 'Документы', 'Доступ']
const TYPE_LABELS: Record<string, string> = { COMPANY: 'Юрлицо', IP: 'ИП', INDIVIDUAL: 'Физлицо' }
const METER_LABELS: Record<string, string> = { electricity: 'Электричество', cold_water: 'Холодная вода', hot_water: 'Горячая вода' }
const METER_UNITS: Record<string, string> = { electricity: 'кВт·ч', cold_water: 'м³', hot_water: 'м³' }

const initial = {
  fullName: 'ООО Техцентр', type: 'COMPANY', inn: '7703456789',
  kpp: '770301001', ogrn: '1027700000001', email: 'tech@techcenter.ru',
  phone: '+7 916 333-33-33', legalAddress: 'г. Москва, ул. Тверская, д. 1',
  bankAccount: '40702810100000000001', bik: '044525225', bank: 'ПАО Сбербанк',
  leaseStart: '01.03.2025', leaseEnd: '31.12.2025', rent: 20500, deposit: 20500,
}

const s = {
  card: { background: '#fff', border: '1px solid #e8ebf3', borderRadius: 9, padding: 16, marginBottom: 12 } as React.CSSProperties,
  label: { fontSize: 13, color: '#8596b4', marginBottom: 3, fontWeight: 500 } as React.CSSProperties,
  value: { fontSize: 14, color: '#1a2240', fontWeight: 500 } as React.CSSProperties,
  grid2: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px 20px' } as React.CSSProperties,
  grid3: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '12px 20px' } as React.CSSProperties,
  inp: { width: '100%', minWidth: 0, boxSizing: 'border-box', padding: '7px 10px', border: '1px solid #e8ebf3', borderRadius: 6, fontSize: 14, fontFamily: 'inherit', outline: 'none', color: '#1a2240' } as React.CSSProperties,
  inpDisabled: { width: '100%', padding: '7px 10px', border: '1px solid #f0f2f8', borderRadius: 6, fontSize: 14, fontFamily: 'inherit', outline: 'none', color: '#1a2240', background: '#f8f9fc' } as React.CSSProperties,
}

function ConfirmModal({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')
  const confirm = () => {
    if (pw.length < 4) { setErr('Введите пароль'); return }
    // В реальной системе — проверка через Supabase
    onConfirm()
  }
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <div style={{ background: '#fff', borderRadius: 12, padding: 28, width: 360, boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: '#1a2240', marginBottom: 6 }}>Подтверждение изменений</div>
        <div style={{ fontSize: 14, color: '#8596b4', marginBottom: 20 }}>Введите пароль для сохранения изменений в карточке арендатора</div>
        <label style={s.label}>Пароль</label>
        <input type="password" style={{ ...s.inp, marginBottom: 8 }} value={pw} onChange={e => { setPw(e.target.value); setErr('') }} placeholder="Введите пароль" autoFocus />
        {err && <div style={{ fontSize: 13, color: '#ef4444', marginBottom: 8 }}>{err}</div>}
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button onClick={onCancel} style={{ flex: 1, padding: '9px', border: '1px solid #e8ebf3', borderRadius: 7, background: '#fff', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', color: '#6b7280' }}>Отмена</button>
          <button onClick={confirm} style={{ flex: 1, padding: '9px', border: 'none', borderRadius: 7, background: '#4f6ef7', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', color: '#fff' }}>Сохранить</button>
        </div>
      </div>
    </div>
  )
}

function SuccessToast() {
  return (
    <div style={{ position: 'fixed', top: 20, right: 24, background: '#111827', color: '#fff', padding: '10px 18px', borderRadius: 8, fontSize: 14, fontWeight: 500, zIndex: 200, display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ color: '#34d399' }}>✓</span> Изменения сохранены
    </div>
  )
}

export function TenantCardPage({ onBack, onCreateInvoice }: { onBack: () => void; onCreateInvoice?: () => void }) {
  const [tab, setTab] = useState(0)
  const [editing, setEditing] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [form, setForm] = useState(initial)
  const [saved, setSaved] = useState(initial)
  const [portalAccess, setPortalAccess] = useState<any>(null)
  const [portalLoaded, setPortalLoaded] = useState(false)

  useEffect(() => {
    supabase.from('tenant_portal_access').select('*').eq('email', initial.email).maybeSingle()
      .then(({ data }) => { setPortalAccess(data); setPortalLoaded(true) })
  }, [])
  const [services, setServices] = useState([
    { name: 'Уборка', price: 2500, active: true },
  ])
  const [addService, setAddService] = useState(false)
  const [showInvoiceForm, setShowInvoiceForm] = useState(false)
  const [invoiceMonth, setInvoiceMonth] = useState(new Date().getMonth() + 1)
  const [invoiceYear, setInvoiceYear] = useState(new Date().getFullYear())
  const [creating, setCreating] = useState(false)
  const [invoiceCreated, setInvoiceCreated] = useState(false)

  const MONTHS = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']

  const createInvoice = async () => {
    setCreating(true)
    try {
      await fetch('/api/billing-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: invoiceMonth, year: invoiceYear })
      })
      setInvoiceCreated(true)
      setShowInvoiceForm(false)
      setTimeout(() => setInvoiceCreated(false), 3000)
    } catch {
      // ignore network errors for mock page
    } finally {
      setCreating(false)
    }
  }
  const [newService, setNewService] = useState({ name: '', price: '' })
  const [meters] = useState([
    { type: 'electricity', serial: 'ЭЛ-12345', tariff: 6.38, lastReading: 15420, date: '01.06.2025' },
    { type: 'cold_water', serial: 'ХВ-67890', tariff: 45.2, lastReading: 234, date: '01.06.2025' },
  ])

  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(p => ({ ...p, [k]: e.target.value }))

  const handleSave = () => setShowConfirm(true)
  const handleConfirm = () => {
    setSaved(form)
    setShowConfirm(false)
    setEditing(false)
    setShowSuccess(true)
    setTimeout(() => setShowSuccess(false), 3000)
  }
  const handleCancel = () => { setForm(saved); setEditing(false) }

  const tabStyle = (i: number): React.CSSProperties => ({
    padding: '7px 14px', border: 'none', background: 'none', fontSize: 14,
    color: tab === i ? '#4f6ef7' : '#6b7280', cursor: 'pointer',
    borderBottom: tab === i ? '2px solid #4f6ef7' : '2px solid transparent',
    marginBottom: -1, fontFamily: 'inherit', fontWeight: tab === i ? 500 : 400,
  })

  const Field = ({ label, k, type = 'text' }: { label: string; k: keyof typeof form; type?: string }) => (
    <div>
      <div style={s.label}>{label}</div>
      {editing
        ? <input style={s.inp} type={type} defaultValue={String(form[k])} onBlur={e => setForm(p => ({ ...p, [k]: e.target.value }))} key={k} />
        : <div style={s.value}>{String(saved[k]) || '—'}</div>}
    </div>
  )

  return (
    <div style={{ maxWidth: 900 }}>
      {invoiceCreated && (
        <div style={{ position: 'fixed', top: 20, right: 24, background: '#111827', color: '#fff', padding: '10px 18px', borderRadius: 8, fontSize: 14, fontWeight: 500, zIndex: 200, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#34d399' }}>✓</span> Счёт создан
        </div>
      )}

      {showInvoiceForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 28, width: 380, boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#1a2240', marginBottom: 6 }}>Выставить счёт</div>
            <div style={{ fontSize: 12, color: '#8596b4', marginBottom: 20 }}>Создание счёта</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 12, color: '#8596b4', marginBottom: 5 }}>Месяц</div>
                <select value={invoiceMonth} onChange={e => setInvoiceMonth(Number(e.target.value))}
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid #e8ebf3', borderRadius: 7, fontSize: 13, fontFamily: 'inherit', outline: 'none' }}>
                  {MONTHS.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#8596b4', marginBottom: 5 }}>Год</div>
                <select value={invoiceYear} onChange={e => setInvoiceYear(Number(e.target.value))}
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid #e8ebf3', borderRadius: 7, fontSize: 13, fontFamily: 'inherit', outline: 'none' }}>
                  {[2024,2025,2026].map(y => <option key={y}>{y}</option>)}
                </select>
              </div>
            </div>
            <div style={{ padding: '10px 12px', background: '#f8f9fc', borderRadius: 7, marginBottom: 16, fontSize: 13 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ color: '#6b7280' }}>Аренда</span>
                <span>{saved.rent.toLocaleString('ru')} ₽</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ color: '#6b7280' }}>Уборка</span>
                <span>{2500..toLocaleString('ru')} ₽</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, borderTop: '1px solid #e8ebf3', paddingTop: 6, marginTop: 4 }}>
                <span>Итого (без коммунальных)</span>
                <span style={{ color: '#4f6ef7' }}>{(saved.rent + 2500).toLocaleString('ru')} ₽</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setShowInvoiceForm(false)}
                style={{ flex: 1, padding: '9px', border: '1px solid #e8ebf3', borderRadius: 7, background: '#fff', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', color: '#6b7280' }}>Отмена</button>
              <button onClick={createInvoice} disabled={creating}
                style={{ flex: 1, padding: '9px', border: 'none', borderRadius: 7, background: '#4f6ef7', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', color: '#fff' }}>
                {creating ? 'Создаю...' : 'Создать счёт'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showConfirm && <ConfirmModal onConfirm={handleConfirm} onCancel={() => setShowConfirm(false)} />}
      {showSuccess && <SuccessToast />}

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button onClick={onBack} style={{ padding: '6px 12px', border: '1px solid #e8ebf3', borderRadius: 7, background: '#fff', cursor: 'pointer', fontSize: 14, fontFamily: 'inherit', color: '#6b7280' }}>← Назад</button>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#1a2240' }}>{saved.fullName}</div>
            {portalLoaded && (
              <div title={
                !portalAccess ? 'Нет доступа к порталу' :
                portalAccess.status === 'active' ? 'Портал активен' :
                portalAccess.status === 'blocked' ? 'Доступ заблокирован' : 'Приглашён, не активировал'
              } style={{
                width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                background: !portalAccess ? '#d1d5db' : portalAccess.status === 'active' ? '#22c55e' : portalAccess.status === 'blocked' ? '#ef4444' : '#f59e0b',
              }} />
            )}
          </div>
          <div style={{ fontSize: 14, color: '#8596b4' }}>{TYPE_LABELS[saved.type]} · ИНН {saved.inn}</div>
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

      <div style={{ display: 'flex', borderBottom: '1px solid #e8ebf3', marginBottom: 16, gap: 2 }}>
        {TABS.map((name, i) => <button key={i} style={tabStyle(i)} onClick={() => setTab(i)}>{name}</button>)}
      </div>

      {tab === 0 && (
        <>
          <div style={s.card}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '.5px' }}>Реквизиты</div>
            <div style={{ ...s.grid3, marginBottom: 12 }}>
              <Field label="Полное наименование" k="fullName" />
              <Field label="ИНН" k="inn" />
              <Field label="КПП" k="kpp" />
              <Field label="ОГРН" k="ogrn" />
              <Field label="Email" k="email" type="email" />
              <Field label="Телефон" k="phone" type="tel" />
            </div>
          </div>
          <div style={s.card}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '.5px' }}>Адрес и банк</div>
            <div style={s.grid2}>
              <Field label="Юридический адрес" k="legalAddress" />
              <Field label="Банк" k="bank" />
              <Field label="Расчётный счёт" k="bankAccount" />
              <Field label="БИК" k="bik" />
            </div>
          </div>
          <div style={s.card}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '.5px' }}>Договор</div>
            <div style={s.grid3}>
              <Field label="Дата начала" k="leaseStart" />
              <Field label="Дата окончания" k="leaseEnd" />
              <div>
                <div style={s.label}>Арендная плата</div>
                {editing
                  ? <input style={s.inp} type="number" value={form.rent} onChange={e => setForm(p => ({ ...p, rent: Number(e.target.value) }))} />
                  : <div style={s.value}>{saved.rent.toLocaleString('ru')} ₽/мес</div>}
              </div>
              <div>
                <div style={s.label}>Гарантийный платёж</div>
                <div style={s.value}>{saved.deposit.toLocaleString('ru')} ₽ — Оплачен</div>
              </div>
            </div>
          </div>
        </>
      )}

      {tab === 1 && (
        <div style={s.card}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '.5px' }}>Арендуемые помещения</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead><tr style={{ background: '#f8f9fc', borderBottom: '1px solid #e8ebf3' }}>
              {['Офис', 'Этаж', 'Площадь', 'Аренда', 'Уборка', 'Итого'].map(h => (
                <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 500, color: '#8596b4', fontSize: 13 }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid #f0f2f8' }}>
                <td style={{ padding: '9px 12px', fontWeight: 500, color: '#1a2240' }}>№ 204</td>
                <td style={{ padding: '9px 12px', color: '#6b7280' }}>2</td>
                <td style={{ padding: '9px 12px', color: '#6b7280' }}>21,6 м²</td>
                <td style={{ padding: '9px 12px' }}>20 500 ₽</td>
                <td style={{ padding: '9px 12px' }}>2 500 ₽</td>
                <td style={{ padding: '9px 12px', fontWeight: 600, color: '#1a2240' }}>23 000 ₽</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {tab === 2 && (
        <div style={s.card}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '.5px' }}>Приборы учёта</div>
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

      {tab === 3 && (
        <div style={s.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: '.5px' }}>Доп. услуги</div>
            <button onClick={() => setAddService(true)} style={{ padding: '5px 12px', border: 'none', borderRadius: 6, background: '#4f6ef7', color: '#fff', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>+ Добавить</button>
          </div>
          {services.map((sv, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: '#f8f9fc', borderRadius: 7, marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, color: '#1a2240' }}>{sv.name}</div>
                <div style={{ fontSize: 13, color: '#8596b4', marginTop: 2 }}>Ежемесячно</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#1a2240' }}>{sv.price.toLocaleString('ru')} ₽</div>
                <div onClick={() => setServices(prev => prev.map((s, j) => j === i ? { ...s, active: !s.active } : s))}
                  style={{ width: 36, height: 20, borderRadius: 10, background: sv.active ? '#4f6ef7' : '#e5e7eb', cursor: 'pointer', position: 'relative', transition: 'background .2s', flexShrink: 0 }}>
                  <div style={{ position: 'absolute', top: 2, left: sv.active ? 18 : 2, width: 16, height: 16, background: '#fff', borderRadius: '50%', transition: 'left .2s' }} />
                </div>
              </div>
            </div>
          ))}
          {addService && (
            <div style={{ padding: 14, border: '1px solid #e8ebf3', borderRadius: 8, marginTop: 10 }}>
              <div style={s.grid2}>
                <div><div style={s.label}>Название</div><input style={s.inp} value={newService.name} onChange={e => setNewService(p => ({ ...p, name: e.target.value }))} placeholder="Охрана, парковка..." /></div>
                <div><div style={s.label}>Стоимость ₽/мес</div><input style={s.inp} type="number" value={newService.price} onChange={e => setNewService(p => ({ ...p, price: e.target.value }))} placeholder="0" /></div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button onClick={() => { setServices(p => [...p, { name: newService.name, price: Number(newService.price), active: true }]); setAddService(false); setNewService({ name: '', price: '' }) }}
                  style={{ padding: '7px 16px', border: 'none', borderRadius: 6, background: '#4f6ef7', color: '#fff', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>Сохранить</button>
                <button onClick={() => setAddService(false)} style={{ padding: '7px 16px', border: '1px solid #e8ebf3', borderRadius: 6, background: '#fff', color: '#6b7280', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>Отмена</button>
              </div>
            </div>
          )}
          <div style={{ marginTop: 14, padding: '10px 12px', background: '#eff3ff', borderRadius: 7, display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
            <span style={{ color: '#4f6ef7' }}>Итого доп. услуги</span>
            <span style={{ fontWeight: 600, color: '#4f6ef7' }}>{services.filter(s => s.active).reduce((sum, s) => sum + s.price, 0).toLocaleString('ru')} ₽/мес</span>
          </div>
        </div>
      )}

      {tab === 4 && (
        <div style={s.card}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '.5px' }}>История счетов</div>
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

      {tab === 5 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <HistoryTab />
        </div>
      )}
      {tab === 7 && (
        <AccessTab
          email={saved.email}
          tenantName={saved.fullName}
          portalAccess={portalAccess}
          onRefresh={() => {
            supabase.from('tenant_portal_access').select('*').eq('email', saved.email).maybeSingle()
              .then(({ data }) => setPortalAccess(data))
          }}
        />
      )}

      {tab === 6 && (
        <div style={s.card}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '.5px' }}>Документы</div>
          {[
            { name: 'Договор аренды №06/2025', date: '01.03.2025', type: 'Договор' },
            { name: 'Акт приёма-передачи', date: '01.03.2025', type: 'Акт' },
            { name: 'Правила внутреннего распорядка', date: '01.03.2025', type: 'Приложение' },
          ].map((doc, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: '#f8f9fc', borderRadius: 7, marginBottom: 8 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <div style={{ width: 32, height: 32, borderRadius: 6, background: '#eff3ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>📄</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: '#1a2240' }}>{doc.name}</div>
                  <div style={{ fontSize: 13, color: '#8596b4', marginTop: 2 }}>{doc.type} · {doc.date}</div>
                </div>
              </div>
              <button style={{ padding: '5px 12px', border: '1px solid #e8ebf3', borderRadius: 6, background: '#fff', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', color: '#4f6ef7' }}>Скачать</button>
            </div>
          ))}
          <button style={{ width: '100%', padding: 8, border: '1px dashed #e8ebf3', borderRadius: 7, background: 'transparent', color: '#4f6ef7', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', marginTop: 4 }}>+ Загрузить документ</button>
        </div>
      )}
    </div>
  )
}

const PORTAL_URL = 'https://mayak-xi.vercel.app/tenant'

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  invited:  { label: 'Приглашён',    color: '#d97706', bg: '#fef3c7' },
  active:   { label: 'Активен',      color: '#16a34a', bg: '#dcfce7' },
  blocked:  { label: 'Заблокирован', color: '#ef4444', bg: '#fee2e2' },
}

function AccessTab({ email, tenantName, portalAccess, onRefresh }: {
  email: string
  tenantName: string
  portalAccess: any
  onRefresh: () => void
}) {
  const [inviteEmail, setInviteEmail] = useState(email)
  const [sending, setSending] = useState(false)
  const [copied, setCopied] = useState(false)
  const inp: React.CSSProperties = { width: '100%', boxSizing: 'border-box' as const, padding: '9px 12px', border: '1px solid #e8ebf3', borderRadius: 7, fontSize: 14, fontFamily: 'inherit', outline: 'none', color: '#1a2240' }
  const btn = (extra?: React.CSSProperties): React.CSSProperties => ({ padding: '8px 16px', borderRadius: 7, border: 'none', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500, ...extra })

  async function sendInvite() {
    if (!inviteEmail) return alert('Введите email')
    setSending(true)
    try {
      const r = await fetch('/api/send-tenant-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, tenantName, unitNumber: '204' }),
      })

      // API не доступен локально (только Vercel) — fallback: создаём запись без письма
      if (!r.ok || r.headers.get('content-type')?.includes('text/html')) {
        const token = Array.from(crypto.getRandomValues(new Uint8Array(32))).map(b => b.toString(16).padStart(2, '0')).join('')
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        const { error } = await supabase.from('tenant_portal_access').upsert(
          { email: inviteEmail, invite_token: token, invite_sent_at: new Date().toISOString(), invite_expires_at: expiresAt, status: 'invited' },
          { onConflict: 'email' }
        )
        if (error) { alert('Ошибка БД: ' + error.message); return }
        const activateUrl = `https://mayak-xi.vercel.app/tenant/activate?token=${token}`
        alert(`✓ Запись создана.\n\nAPI письма недоступно в dev-режиме.\nСсылка активации:\n${activateUrl}`)
        onRefresh()
        return
      }

      let d: any
      try { d = await r.json() } catch { throw new Error('Сервер вернул неожиданный ответ') }
      if (!d.ok) { alert('Ошибка: ' + d.error); return }
      alert('Приглашение отправлено на ' + inviteEmail)
      onRefresh()
    } catch (e: any) {
      alert('Ошибка отправки: ' + e.message)
    } finally {
      setSending(false)
    }
  }

  async function blockAccess() {
    if (!confirm('Заблокировать доступ к порталу?')) return
    await supabase.from('tenant_portal_access').update({ status: 'blocked' }).eq('id', portalAccess.id)
    onRefresh()
  }

  async function unblockAccess() {
    await supabase.from('tenant_portal_access').update({ status: portalAccess.password_hash ? 'active' : 'invited' }).eq('id', portalAccess.id)
    onRefresh()
  }

  async function resetPassword() {
    if (!confirm('Сбросить пароль и отправить новое приглашение?')) return
    await supabase.from('tenant_portal_access').update({ password_hash: null, status: 'invited' }).eq('id', portalAccess.id)
    sendInvite()
  }

  function copyLink() {
    navigator.clipboard.writeText(PORTAL_URL).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
  }

  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleString('ru', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

  if (!portalAccess) {
    return (
      <div style={{ ...s.card, maxWidth: 560 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 0 28px', gap: 12 }}>
          <div style={{ fontSize: 40 }}>🔐</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#1a2240' }}>Доступ к порталу не настроен</div>
          <div style={{ fontSize: 14, color: '#8596b4', textAlign: 'center', maxWidth: 360, lineHeight: 1.5 }}>
            Создайте доступ для арендатора — он получит письмо со ссылкой для активации аккаунта.
          </div>
        </div>
        <div style={{ borderTop: '1px solid #f0f2f8', paddingTop: 20 }}>
          <div style={{ fontSize: 13, color: '#8596b4', marginBottom: 5, fontWeight: 500 }}>Email для приглашения</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              style={{ ...inp, flex: 1 }}
              type="email"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              placeholder="email@example.com"
            />
            <button
              onClick={sendInvite}
              disabled={sending}
              style={btn({ background: '#111', color: '#fff', opacity: sending ? 0.7 : 1, whiteSpace: 'nowrap' })}
            >
              {sending ? 'Отправка...' : 'Создать доступ и отправить приглашение'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  const st = STATUS_LABELS[portalAccess.status] ?? STATUS_LABELS.invited

  return (
    <div style={{ ...s.card, maxWidth: 560 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '.5px' }}>Доступ к порталу</div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px', marginBottom: 20 }}>
        <div>
          <div style={s.label}>Email</div>
          <div style={s.value}>{portalAccess.email}</div>
        </div>
        <div>
          <div style={s.label}>Статус</div>
          <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 10, fontSize: 13, fontWeight: 500, background: st.bg, color: st.color }}>
            {st.label}
          </span>
        </div>
        <div>
          <div style={s.label}>Приглашение отправлено</div>
          <div style={s.value}>{fmtDate(portalAccess.invite_sent_at)}</div>
        </div>
        <div>
          <div style={s.label}>Последний вход</div>
          <div style={s.value}>{fmtDate(portalAccess.last_login_at)}</div>
        </div>
      </div>

      <div style={{ marginBottom: 20, padding: '10px 12px', background: '#f8f9fc', borderRadius: 7, display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1, fontSize: 13, color: '#4f6ef7', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{PORTAL_URL}</div>
        <button onClick={copyLink} style={btn({ background: copied ? '#dcfce7' : '#fff', color: copied ? '#16a34a' : '#4f6ef7', border: '1px solid ' + (copied ? '#bbf7d0' : '#e8ebf3') })}>
          {copied ? '✓ Скопировано' : 'Копировать'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={sendInvite} disabled={sending} style={btn({ background: '#eff3ff', color: '#4f6ef7', opacity: sending ? 0.7 : 1 })}>
          {sending ? 'Отправка...' : '✉ Отправить повторно'}
        </button>
        {portalAccess.status === 'blocked' ? (
          <button onClick={unblockAccess} style={btn({ background: '#dcfce7', color: '#16a34a' })}>Разблокировать</button>
        ) : (
          <button onClick={blockAccess} style={btn({ background: '#fee2e2', color: '#ef4444' })}>Заблокировать</button>
        )}
        <button onClick={resetPassword} style={btn({ background: '#f8f9fc', color: '#6b7280', border: '1px solid #e8ebf3' })}>🔑 Сбросить пароль</button>
      </div>
    </div>
  )
}

function HistoryTab() {
  const [rentHistory, setRentHistory] = useState<any[]>([])
  const [depositHistory, setDepositHistory] = useState<any[]>([])
  const [showRentModal, setShowRentModal] = useState(false)
  const [showDepModal, setShowDepModal] = useState(false)
  const [rentForm, setRentForm] = useState({ date: '', amount: 0, note: '' })
  const [depForm, setDepForm] = useState({ date: '', amount: 0, action: 'received', note: '' })
  const inp: React.CSSProperties = { width: '100%', border: '1px solid #e5e7eb', borderRadius: 6, padding: '7px 10px', fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' as const }

  useEffect(() => { fetchHistory() }, [])

  async function fetchHistory() {
    const [{ data: rh }, { data: dh }] = await Promise.all([
      supabase.from('rent_history').select('*').order('date', { ascending: false }),
      supabase.from('deposit_history').select('*').order('date', { ascending: false })
    ])
    setRentHistory(rh || [])
    setDepositHistory(dh || [])
  }

  async function addRent() {
    if (!rentForm.amount) return alert('Введите сумму')
    const r = await supabase.from('rent_history').insert(rentForm)
    if (r.error) { alert('Ошибка: ' + r.error.message); return }
    setShowRentModal(false)
    setRentForm({ date: '', amount: 0, note: '' })
    fetchHistory()
  }

  async function addDeposit() {
    if (!depForm.date || !depForm.amount) return alert('Заполните дату и сумму')
    const { error } = await supabase.from('deposit_history').insert(depForm)
    if (error) { alert('Ошибка: ' + error.message); return }
    setShowDepModal(false)
    setDepForm({ date: '', amount: 0, action: 'received', note: '' })
    fetchHistory()
  }

  async function deleteRent(id: string) {
    if (!confirm('Удалить запись?')) return
    await supabase.from('rent_history').delete().eq('id', id)
    fetchHistory()
  }

  async function deleteDeposit(id: string) {
    if (!confirm('Удалить запись?')) return
    await supabase.from('deposit_history').delete().eq('id', id)
    fetchHistory()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#111' }}>История аренды</div>
          <button onClick={() => setShowRentModal(true)} style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: '#111', color: '#fff', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>+ Добавить</button>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                {['Дата', 'Сумма', 'Заметка', ''].map(h => <th key={h} style={{ padding: '9px 14px', textAlign: 'left', fontWeight: 500, color: '#6b7280', fontSize: 12 }}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {rentHistory.length === 0 ? (
                <tr><td colSpan={4} style={{ padding: 16, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>Нет записей</td></tr>
              ) : rentHistory.map(r => (
                <tr key={r.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '9px 14px', color: '#374151' }}>{new Date(r.date).toLocaleDateString('ru')}</td>
                  <td style={{ padding: '9px 14px', fontWeight: 600, color: '#111' }}>{Number(r.amount).toLocaleString('ru')} ₽</td>
                  <td style={{ padding: '9px 14px', color: '#6b7280' }}>{r.note || '—'}</td>
                  <td style={{ padding: '9px 14px' }}><button onClick={() => deleteRent(r.id)} style={{ border: 'none', background: 'none', color: '#ef4444', fontSize: 13, cursor: 'pointer' }}>Удалить</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#111' }}>История депозитов</div>
          <button onClick={() => setShowDepModal(true)} style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: '#111', color: '#fff', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>+ Добавить</button>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                {['Дата', 'Действие', 'Сумма', 'Заметка', ''].map(h => <th key={h} style={{ padding: '9px 14px', textAlign: 'left', fontWeight: 500, color: '#6b7280', fontSize: 12 }}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {depositHistory.length === 0 ? (
                <tr><td colSpan={5} style={{ padding: 16, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>Нет записей</td></tr>
              ) : depositHistory.map(d => (
                <tr key={d.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '9px 14px', color: '#374151' }}>{new Date(d.date).toLocaleDateString('ru')}</td>
                  <td style={{ padding: '9px 14px' }}>
                    <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 10, background: d.action === 'received' ? '#dcfce7' : '#fee2e2', color: d.action === 'received' ? '#16a34a' : '#ef4444' }}>
                      {d.action === 'received' ? 'Получен' : 'Возврат'}
                    </span>
                  </td>
                  <td style={{ padding: '9px 14px', fontWeight: 600, color: '#111' }}>{Number(d.amount).toLocaleString('ru')} ₽</td>
                  <td style={{ padding: '9px 14px', color: '#6b7280' }}>{d.note || '—'}</td>
                  <td style={{ padding: '9px 14px' }}><button onClick={() => deleteDeposit(d.id)} style={{ border: 'none', background: 'none', color: '#ef4444', fontSize: 13, cursor: 'pointer' }}>Удалить</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showRentModal && (
        <div style={{ position: 'fixed', inset: 0, background: '#00000040', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 400, boxShadow: '0 8px 32px #0002', border: '1px solid #e5e7eb' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>Добавить аренду</div>
              <button onClick={() => setShowRentModal(false)} style={{ border: 'none', background: 'none', fontSize: 18, color: '#9ca3af', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div><label style={{ fontSize: 12, color: '#6b7280', marginBottom: 4, display: 'block' }}>Дата</label><input style={inp} type="date" value={rentForm.date} onChange={e => setRentForm(f => ({ ...f, date: e.target.value }))} /></div>
              <div><label style={{ fontSize: 12, color: '#6b7280', marginBottom: 4, display: 'block' }}>Сумма (₽)</label><input style={inp} type="number" value={rentForm.amount || ''} onChange={e => setRentForm(f => ({ ...f, amount: Number(e.target.value) }))} /></div>
              <div><label style={{ fontSize: 12, color: '#6b7280', marginBottom: 4, display: 'block' }}>Заметка</label><input style={inp} value={rentForm.note} onChange={e => setRentForm(f => ({ ...f, note: e.target.value }))} /></div>
            </div>
            <div style={{ display: 'flex', gap: 8, padding: '14px 20px', borderTop: '1px solid #e5e7eb' }}>
              <button onClick={addRent} style={{ flex: 1, padding: '8px', borderRadius: 6, border: 'none', background: '#111', color: '#fff', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>Сохранить</button>
              <button onClick={() => setShowRentModal(false)} style={{ padding: '8px 14px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', color: '#6b7280', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>Отмена</button>
            </div>
          </div>
        </div>
      )}

      {showDepModal && (
        <div style={{ position: 'fixed', inset: 0, background: '#00000040', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 400, boxShadow: '0 8px 32px #0002', border: '1px solid #e5e7eb' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>Добавить депозит</div>
              <button onClick={() => setShowDepModal(false)} style={{ border: 'none', background: 'none', fontSize: 18, color: '#9ca3af', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div><label style={{ fontSize: 12, color: '#6b7280', marginBottom: 4, display: 'block' }}>Дата</label><input style={inp} type="date" value={depForm.date} onChange={e => setDepForm(f => ({ ...f, date: e.target.value }))} /></div>
              <div><label style={{ fontSize: 12, color: '#6b7280', marginBottom: 4, display: 'block' }}>Действие</label>
                <select style={inp} value={depForm.action} onChange={e => setDepForm(f => ({ ...f, action: e.target.value }))}>
                  <option value="received">Получен</option>
                  <option value="returned">Возврат</option>
                </select>
              </div>
              <div><label style={{ fontSize: 12, color: '#6b7280', marginBottom: 4, display: 'block' }}>Сумма (₽)</label><input style={inp} type="number" value={depForm.amount || ''} onChange={e => setDepForm(f => ({ ...f, amount: Number(e.target.value) }))} /></div>
              <div><label style={{ fontSize: 12, color: '#6b7280', marginBottom: 4, display: 'block' }}>Заметка</label><input style={inp} value={depForm.note} onChange={e => setDepForm(f => ({ ...f, note: e.target.value }))} /></div>
            </div>
            <div style={{ display: 'flex', gap: 8, padding: '14px 20px', borderTop: '1px solid #e5e7eb' }}>
              <button onClick={addDeposit} style={{ flex: 1, padding: '8px', borderRadius: 6, border: 'none', background: '#111', color: '#fff', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>Сохранить</button>
              <button onClick={() => setShowDepModal(false)} style={{ padding: '8px 14px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', color: '#6b7280', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>Отмена</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
