import { useState } from 'react'

const TABS = ['Общие', 'Помещения', 'Счётчики', 'Услуги', 'Счета', 'Документы']
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
  label: { fontSize: 11, color: '#8596b4', marginBottom: 3, fontWeight: 500 } as React.CSSProperties,
  value: { fontSize: 13, color: '#1a2240', fontWeight: 500 } as React.CSSProperties,
  grid2: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px 20px' } as React.CSSProperties,
  grid3: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '12px 20px' } as React.CSSProperties,
  inp: { width: '100%', minWidth: 0, boxSizing: 'border-box', padding: '7px 10px', border: '1px solid #e8ebf3', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', outline: 'none', color: '#1a2240' } as React.CSSProperties,
  inpDisabled: { width: '100%', padding: '7px 10px', border: '1px solid #f0f2f8', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', outline: 'none', color: '#1a2240', background: '#f8f9fc' } as React.CSSProperties,
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
        <div style={{ fontSize: 12, color: '#8596b4', marginBottom: 20 }}>Введите пароль для сохранения изменений в карточке арендатора</div>
        <label style={s.label}>Пароль</label>
        <input type="password" style={{ ...s.inp, marginBottom: 8 }} value={pw} onChange={e => { setPw(e.target.value); setErr('') }} placeholder="Введите пароль" autoFocus />
        {err && <div style={{ fontSize: 11, color: '#ef4444', marginBottom: 8 }}>{err}</div>}
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button onClick={onCancel} style={{ flex: 1, padding: '9px', border: '1px solid #e8ebf3', borderRadius: 7, background: '#fff', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', color: '#6b7280' }}>Отмена</button>
          <button onClick={confirm} style={{ flex: 1, padding: '9px', border: 'none', borderRadius: 7, background: '#4f6ef7', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', color: '#fff' }}>Сохранить</button>
        </div>
      </div>
    </div>
  )
}

function SuccessToast() {
  return (
    <div style={{ position: 'fixed', top: 20, right: 24, background: '#111827', color: '#fff', padding: '10px 18px', borderRadius: 8, fontSize: 13, fontWeight: 500, zIndex: 200, display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ color: '#34d399' }}>✓</span> Изменения сохранены
    </div>
  )
}

export function TenantCardPage({ onBack }: { onBack: () => void }) {
  const [tab, setTab] = useState(0)
  const [editing, setEditing] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [form, setForm] = useState(initial)
  const [saved, setSaved] = useState(initial)
  const [services, setServices] = useState([
    { name: 'Уборка', price: 2500, active: true },
  ])
  const [addService, setAddService] = useState(false)
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
    padding: '7px 14px', border: 'none', background: 'none', fontSize: 13,
    color: tab === i ? '#4f6ef7' : '#6b7280', cursor: 'pointer',
    borderBottom: tab === i ? '2px solid #4f6ef7' : '2px solid transparent',
    marginBottom: -1, fontFamily: 'inherit', fontWeight: tab === i ? 500 : 400,
  })

  const Field = ({ label, k, type = 'text' }: { label: string; k: keyof typeof form; type?: string }) => (
    <div>
      <div style={s.label}>{label}</div>
      {editing
        ? <input style={s.inp} type={type} value={String(form[k])} onChange={f(k)} />
        : <div style={s.value}>{String(saved[k]) || '—'}</div>}
    </div>
  )

  return (
    <div style={{ maxWidth: 900 }}>
      {showConfirm && <ConfirmModal onConfirm={handleConfirm} onCancel={() => setShowConfirm(false)} />}
      {showSuccess && <SuccessToast />}

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button onClick={onBack} style={{ padding: '6px 12px', border: '1px solid #e8ebf3', borderRadius: 7, background: '#fff', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', color: '#6b7280' }}>← Назад</button>
        <div>
          <div style={{ fontSize: 18, fontWeight: 600, color: '#1a2240' }}>{saved.fullName}</div>
          <div style={{ fontSize: 12, color: '#8596b4' }}>{TYPE_LABELS[saved.type]} · ИНН {saved.inn}</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          {editing ? (
            <>
              <button onClick={handleCancel} style={{ padding: '7px 14px', border: '1px solid #e8ebf3', borderRadius: 7, background: '#fff', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', color: '#6b7280' }}>Отмена</button>
              <button onClick={handleSave} style={{ padding: '7px 14px', border: 'none', borderRadius: 7, background: '#4f6ef7', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', color: '#fff', fontWeight: 500 }}>Сохранить</button>
            </>
          ) : (
            <>
              <button onClick={() => setEditing(true)} style={{ padding: '7px 14px', border: '1px solid #e8ebf3', borderRadius: 7, background: '#fff', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', color: '#374151' }}>Редактировать</button>
              <button style={{ padding: '7px 14px', border: 'none', borderRadius: 7, background: '#4f6ef7', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', color: '#fff', fontWeight: 500 }}>Выставить счёт</button>
            </>
          )}
        </div>
      </div>

      {editing && (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: '#92400e', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>⚠️</span> Режим редактирования — внесите изменения и нажмите Сохранить
        </div>
      )}

      <div style={{ display: 'flex', borderBottom: '1px solid #e8ebf3', marginBottom: 16, gap: 2 }}>
        {TABS.map((name, i) => <button key={i} style={tabStyle(i)} onClick={() => setTab(i)}>{name}</button>)}
      </div>

      {tab === 0 && (
        <>
          <div style={s.card}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '.5px' }}>Реквизиты</div>
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
            <div style={{ fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '.5px' }}>Адрес и банк</div>
            <div style={s.grid2}>
              <Field label="Юридический адрес" k="legalAddress" />
              <Field label="Банк" k="bank" />
              <Field label="Расчётный счёт" k="bankAccount" />
              <Field label="БИК" k="bik" />
            </div>
          </div>
          <div style={s.card}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '.5px' }}>Договор</div>
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
          <div style={{ fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '.5px' }}>Арендуемые помещения</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr style={{ background: '#f8f9fc', borderBottom: '1px solid #e8ebf3' }}>
              {['Офис', 'Этаж', 'Площадь', 'Аренда', 'Уборка', 'Итого'].map(h => (
                <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 500, color: '#8596b4', fontSize: 11 }}>{h}</th>
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
          <div style={{ fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '.5px' }}>Приборы учёта</div>
          {meters.map((m, i) => (
            <div key={i} style={{ padding: 12, background: '#f8f9fc', borderRadius: 8, marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#1a2240' }}>{METER_LABELS[m.type]}</div>
                  <div style={{ fontSize: 11, color: '#8596b4', marginTop: 2 }}>№ {m.serial} · тариф {m.tariff} ₽/{METER_UNITS[m.type]}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1a2240' }}>{m.lastReading} {METER_UNITS[m.type]}</div>
                  <div style={{ fontSize: 11, color: '#8596b4' }}>на {m.date}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input placeholder="Новое показание" style={{ ...s.inp, flex: 1 }} type="number" />
                <button style={{ padding: '7px 14px', border: 'none', borderRadius: 6, background: '#4f6ef7', color: '#fff', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>Сохранить</button>
              </div>
            </div>
          ))}
          <button style={{ width: '100%', padding: 8, border: '1px dashed #e8ebf3', borderRadius: 7, background: 'transparent', color: '#4f6ef7', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', marginTop: 4 }}>+ Добавить счётчик</button>
        </div>
      )}

      {tab === 3 && (
        <div style={s.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: '.5px' }}>Доп. услуги</div>
            <button onClick={() => setAddService(true)} style={{ padding: '5px 12px', border: 'none', borderRadius: 6, background: '#4f6ef7', color: '#fff', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>+ Добавить</button>
          </div>
          {services.map((sv, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: '#f8f9fc', borderRadius: 7, marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#1a2240' }}>{sv.name}</div>
                <div style={{ fontSize: 11, color: '#8596b4', marginTop: 2 }}>Ежемесячно</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#1a2240' }}>{sv.price.toLocaleString('ru')} ₽</div>
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
                  style={{ padding: '7px 16px', border: 'none', borderRadius: 6, background: '#4f6ef7', color: '#fff', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Сохранить</button>
                <button onClick={() => setAddService(false)} style={{ padding: '7px 16px', border: '1px solid #e8ebf3', borderRadius: 6, background: '#fff', color: '#6b7280', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Отмена</button>
              </div>
            </div>
          )}
          <div style={{ marginTop: 14, padding: '10px 12px', background: '#eff3ff', borderRadius: 7, display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
            <span style={{ color: '#4f6ef7' }}>Итого доп. услуги</span>
            <span style={{ fontWeight: 600, color: '#4f6ef7' }}>{services.filter(s => s.active).reduce((sum, s) => sum + s.price, 0).toLocaleString('ru')} ₽/мес</span>
          </div>
        </div>
      )}

      {tab === 4 && (
        <div style={s.card}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '.5px' }}>История счетов</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr style={{ background: '#f8f9fc', borderBottom: '1px solid #e8ebf3' }}>
              {['Номер', 'Период', 'Аренда', 'Услуги', 'Итого', 'Статус'].map(h => (
                <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 500, color: '#8596b4', fontSize: 11 }}>{h}</th>
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
                    <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 500, background: inv.status === 'PAID' ? '#f0fdf4' : '#eff6ff', color: inv.status === 'PAID' ? '#16a34a' : '#2563eb' }}>
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
        <div style={s.card}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '.5px' }}>Документы</div>
          {[
            { name: 'Договор аренды №06/2025', date: '01.03.2025', type: 'Договор' },
            { name: 'Акт приёма-передачи', date: '01.03.2025', type: 'Акт' },
            { name: 'Правила внутреннего распорядка', date: '01.03.2025', type: 'Приложение' },
          ].map((doc, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: '#f8f9fc', borderRadius: 7, marginBottom: 8 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <div style={{ width: 32, height: 32, borderRadius: 6, background: '#eff3ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>📄</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#1a2240' }}>{doc.name}</div>
                  <div style={{ fontSize: 11, color: '#8596b4', marginTop: 2 }}>{doc.type} · {doc.date}</div>
                </div>
              </div>
              <button style={{ padding: '5px 12px', border: '1px solid #e8ebf3', borderRadius: 6, background: '#fff', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', color: '#4f6ef7' }}>Скачать</button>
            </div>
          ))}
          <button style={{ width: '100%', padding: 8, border: '1px dashed #e8ebf3', borderRadius: 7, background: 'transparent', color: '#4f6ef7', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', marginTop: 4 }}>+ Загрузить документ</button>
        </div>
      )}
    </div>
  )
}
