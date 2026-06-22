import { useState } from 'react'
import { supabase } from '../lib/supabase'

const TABS = [
  { label: 'Личные данные', icon: '👤' },
  { label: 'Безопасность', icon: '🔒' },
  { label: 'Настройки', icon: '⚙️' },
]

export function SettingsModal({ onClose, onLogout }: { onClose: () => void; onLogout: () => void }) {
  const [tab, setTab] = useState(0)
  const [name, setName] = useState('Андрей Соколов')
  const [role, setRole] = useState('Управляющий')
  const [phone, setPhone] = useState('+7 916 000-00-00')
  const [email, setEmail] = useState('manager@mayak-d.ru')
  const [company, setCompany] = useState('БЦ Маяк')
  const [timezone, setTimezone] = useState('Europe/Moscow (UTC+3)')
  const [saved, setSaved] = useState(false)
  const [oldPw, setOldPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwMsg, setPwMsg] = useState('')

  const inp: React.CSSProperties = { width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 14, fontFamily: 'inherit', outline: 'none', color: '#1a2240', background: '#fff' }

  const saveProfile = () => { setSaved(true); setTimeout(() => setSaved(false), 2000) }
  const changePassword = async () => {
    if (newPw !== confirmPw) { setPwMsg('Пароли не совпадают'); return }
    if (newPw.length < 6) { setPwMsg('Минимум 6 символов'); return }
    const { error } = await supabase.auth.updateUser({ password: newPw })
    if (error) setPwMsg('Ошибка: ' + error.message)
    else { setPwMsg('Пароль изменён'); setOldPw(''); setNewPw(''); setConfirmPw('') }
    setTimeout(() => setPwMsg(''), 3000)
  }

  const initials = name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#fff', borderRadius: 16, width: 680, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #f0f2f8', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 600, color: '#1a2240' }}>Профиль</div>
            <div style={{ fontSize: 13, color: '#8596b4', marginTop: 2 }}>Управление вашим аккаунтом</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#9ca3af', padding: '0 4px' }}>✕</button>
        </div>

        <div style={{ display: 'flex', minHeight: 400 }}>
          <div style={{ width: 200, borderRight: '1px solid #f0f2f8', padding: '16px 12px', flexShrink: 0 }}>
            {TABS.map((t, i) => (
              <button key={i} onClick={() => setTab(i)} style={{
                width: '100%', padding: '10px 12px', border: 'none', borderRadius: 8,
                background: tab === i ? '#fff5f0' : 'transparent',
                color: tab === i ? '#ea580c' : '#374151',
                fontSize: 14, fontFamily: 'inherit', cursor: 'pointer',
                textAlign: 'left', fontWeight: tab === i ? 500 : 400,
                display: 'flex', alignItems: 'center', gap: 10, marginBottom: 2
              }}>
                <span style={{ fontSize: 15 }}>{t.icon}</span>
                {t.label}
              </button>
            ))}
            <div style={{ borderTop: '1px solid #f0f2f8', marginTop: 8, paddingTop: 8 }}>
              <button onClick={async () => { await supabase.auth.signOut(); onLogout() }} style={{
                width: '100%', padding: '10px 12px', border: 'none', borderRadius: 8,
                background: 'transparent', color: '#ef4444', fontSize: 14,
                fontFamily: 'inherit', cursor: 'pointer', textAlign: 'left',
                display: 'flex', alignItems: 'center', gap: 10
              }}>
                <span>↪</span> Выйти из аккаунта
              </button>
            </div>
          </div>

          <div style={{ flex: 1, padding: '20px 24px' }}>
            {tab === 0 && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
                  <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#ea580c', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 600, color: '#fff', flexShrink: 0 }}>
                    {initials}
                  </div>
                  <button style={{ padding: '10px 16px', border: '1px solid #e5e7eb', borderRadius: 10, background: '#fff', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', color: '#374151', display: 'flex', alignItems: 'center', gap: 6 }}>
                    📷 Изменить фото
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 16px', marginBottom: 20 }}>
                  <div>
                    <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 6 }}>Имя и фамилия</div>
                    <input style={inp} value={name} onChange={e => setName(e.target.value)} />
                  </div>
                  <div>
                    <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 6 }}>Должность</div>
                    <input style={inp} value={role} onChange={e => setRole(e.target.value)} />
                  </div>
                  <div>
                    <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 6 }}>Email</div>
                    <input style={inp} value={email} onChange={e => setEmail(e.target.value)} />
                  </div>
                  <div>
                    <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 6 }}>Телефон</div>
                    <input style={inp} value={phone} onChange={e => setPhone(e.target.value)} />
                  </div>
                  <div>
                    <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 6 }}>Компания</div>
                    <input style={inp} value={company} onChange={e => setCompany(e.target.value)} />
                  </div>
                  <div>
                    <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 6 }}>Часовой пояс</div>
                    <input style={inp} value={timezone} onChange={e => setTimezone(e.target.value)} />
                  </div>
                </div>

                {saved && <div style={{ fontSize: 12, color: '#16a34a', marginBottom: 12, padding: '8px 12px', background: '#f0fdf4', borderRadius: 8 }}>Изменения сохранены</div>}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                  <button onClick={onClose} style={{ padding: '10px 20px', border: '1px solid #e5e7eb', borderRadius: 10, background: '#fff', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', color: '#374151' }}>Отмена</button>
                  <button onClick={saveProfile} style={{ padding: '10px 20px', border: 'none', borderRadius: 10, background: '#ea580c', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', color: '#fff', display: 'flex', alignItems: 'center', gap: 6 }}>
                    ✓ Сохранить изменения
                  </button>
                </div>
              </>
            )}

            {tab === 1 && (
              <>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 6 }}>Текущий пароль</div>
                  <input style={inp} type="password" value={oldPw} onChange={e => setOldPw(e.target.value)} placeholder="Введите текущий пароль" />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 16px', marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 6 }}>Новый пароль</div>
                    <input style={inp} type="password" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="Минимум 6 символов" />
                  </div>
                  <div>
                    <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 6 }}>Подтверждение пароля</div>
                    <input style={inp} type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} placeholder="Повторите пароль" />
                  </div>
                </div>
                {pwMsg && <div style={{ fontSize: 12, color: pwMsg.includes('Ошибка') || pwMsg.includes('не') ? '#ef4444' : '#16a34a', marginBottom: 12, padding: '8px 12px', background: pwMsg.includes('Ошибка') || pwMsg.includes('не') ? '#fef2f2' : '#f0fdf4', borderRadius: 8 }}>{pwMsg}</div>}
                <button onClick={changePassword} style={{ padding: '10px 20px', border: 'none', borderRadius: 10, background: '#ea580c', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', color: '#fff', display: 'flex', alignItems: 'center', gap: 6 }}>
                  🔒 Обновить пароль
                </button>

                <div style={{ marginTop: 20, padding: 16, border: '1px solid #e5e7eb', borderRadius: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 500, color: '#1a2240' }}>Двухфакторная аутентификация</div>
                      <div style={{ fontSize: 12, color: '#8596b4', marginTop: 2 }}>Дополнительная защита входа через приложение-аутентификатор</div>
                    </div>
                    <div style={{ width: 44, height: 24, borderRadius: 12, background: '#e5e7eb', cursor: 'pointer', position: 'relative', flexShrink: 0 }}>
                      <div style={{ position: 'absolute', top: 3, left: 3, width: 18, height: 18, background: '#fff', borderRadius: '50%' }} />
                    </div>
                  </div>
                </div>
              </>
            )}

            {tab === 2 && (
              <>
                {[
                  { label: 'Email уведомления', desc: 'Получать уведомления о новых платежах и задачах', on: true },
                  { label: 'Напоминания о просрочке', desc: 'Автоматические напоминания арендаторам', on: true },
                  { label: 'Ежемесячный отчёт', desc: 'Отчёт на email в конце каждого месяца', on: false },
                ].map((item, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderBottom: '1px solid #f0f2f8' }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 500, color: '#1a2240' }}>{item.label}</div>
                      <div style={{ fontSize: 12, color: '#8596b4', marginTop: 2 }}>{item.desc}</div>
                    </div>
                    <div style={{ width: 44, height: 24, borderRadius: 12, background: item.on ? '#ea580c' : '#e5e7eb', cursor: 'pointer', position: 'relative', flexShrink: 0 }}>
                      <div style={{ position: 'absolute', top: 3, left: item.on ? 23 : 3, width: 18, height: 18, background: '#fff', borderRadius: '50%', transition: 'left .2s' }} />
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
