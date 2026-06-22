import { useState } from 'react'
import { supabase } from '../lib/supabase'

const TABS = ['Личные данные', 'Безопасность', 'Настройки']

export function SettingsPage({ onLogout }: { onLogout: () => void }) {
  const [tab, setTab] = useState(0)
  const [name, setName] = useState('Андрей Соколов')
  const [role, setRole] = useState('Управляющий')
  const [phone, setPhone] = useState('+7 916 000-00-00')
  const [email, setEmail] = useState('manager@mayak-d.ru')
  const [saved, setSaved] = useState(false)
  const [oldPw, setOldPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [pwMsg, setPwMsg] = useState('')

  const inp: React.CSSProperties = { width: '100%', padding: '9px 12px', border: '1px solid #e8ebf3', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', outline: 'none', color: '#1a2240' }
  const s = { card: { background: '#fff', border: '1px solid #e8ebf3', borderRadius: 9, padding: 20 } as React.CSSProperties }

  const saveProfile = () => { setSaved(true); setTimeout(() => setSaved(false), 2000) }

  const changePassword = async () => {
    if (!newPw || newPw.length < 6) { setPwMsg('Минимум 6 символов'); return }
    const { error } = await supabase.auth.updateUser({ password: newPw })
    if (error) setPwMsg('Ошибка: ' + error.message)
    else { setPwMsg('Пароль изменён'); setOldPw(''); setNewPw('') }
    setTimeout(() => setPwMsg(''), 3000)
  }

  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div style={{ maxWidth: 680 }}>
      <div style={{ display: 'flex', gap: 20 }}>
        <div style={{ width: 180, flexShrink: 0 }}>
          <div style={{ background: '#fff', border: '1px solid #e8ebf3', borderRadius: 9, overflow: 'hidden' }}>
            {TABS.map((t, i) => (
              <button key={i} onClick={() => setTab(i)} style={{
                width: '100%', padding: '11px 14px', border: 'none', background: tab === i ? '#eff3ff' : 'transparent',
                color: tab === i ? '#4f6ef7' : '#374151', fontSize: 13, fontFamily: 'inherit', cursor: 'pointer',
                textAlign: 'left', fontWeight: tab === i ? 500 : 400, borderLeft: tab === i ? '3px solid #4f6ef7' : '3px solid transparent'
              }}>{t}</button>
            ))}
            <div style={{ borderTop: '1px solid #f0f2f8' }}>
              <button onClick={async () => { await supabase.auth.signOut(); onLogout() }} style={{
                width: '100%', padding: '11px 14px', border: 'none', background: 'transparent',
                color: '#ef4444', fontSize: 13, fontFamily: 'inherit', cursor: 'pointer', textAlign: 'left',
                borderLeft: '3px solid transparent'
              }}>Выйти из аккаунта</button>
            </div>
          </div>
        </div>

        <div style={{ flex: 1 }}>
          {tab === 0 && (
            <div style={s.card}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 22 }}>
                <div style={{ width: 60, height: 60, borderRadius: '50%', background: '#4f6ef7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 600, color: '#fff', flexShrink: 0 }}>
                  {initials}
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#1a2240' }}>{name}</div>
                  <div style={{ fontSize: 12, color: '#8596b4', marginTop: 2 }}>{role}</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 16px', marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 12, color: '#8596b4', marginBottom: 5 }}>Имя и фамилия</div>
                  <input style={inp} value={name} onChange={e => setName(e.target.value)} />
                </div>
                <div>
                  <div style={{ fontSize: 12, color: '#8596b4', marginBottom: 5 }}>Должность</div>
                  <input style={inp} value={role} onChange={e => setRole(e.target.value)} />
                </div>
                <div>
                  <div style={{ fontSize: 12, color: '#8596b4', marginBottom: 5 }}>Email</div>
                  <input style={inp} value={email} onChange={e => setEmail(e.target.value)} />
                </div>
                <div>
                  <div style={{ fontSize: 12, color: '#8596b4', marginBottom: 5 }}>Телефон</div>
                  <input style={inp} value={phone} onChange={e => setPhone(e.target.value)} />
                </div>
              </div>

              {saved && <div style={{ fontSize: 12, color: '#16a34a', marginBottom: 10, padding: '8px 12px', background: '#f0fdf4', borderRadius: 6 }}>Сохранено</div>}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button style={{ padding: '9px 18px', border: '1px solid #e8ebf3', borderRadius: 7, background: '#fff', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', color: '#6b7280' }}>Отмена</button>
                <button onClick={saveProfile} style={{ padding: '9px 18px', border: 'none', borderRadius: 7, background: '#4f6ef7', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', color: '#fff' }}>Сохранить</button>
              </div>
            </div>
          )}

          {tab === 1 && (
            <div style={s.card}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1a2240', marginBottom: 16 }}>Изменить пароль</div>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: '#8596b4', marginBottom: 5 }}>Текущий пароль</div>
                <input style={inp} type="password" value={oldPw} onChange={e => setOldPw(e.target.value)} placeholder="Введите текущий пароль" />
              </div>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, color: '#8596b4', marginBottom: 5 }}>Новый пароль</div>
                <input style={inp} type="password" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="Минимум 6 символов" />
              </div>
              {pwMsg && <div style={{ fontSize: 12, color: pwMsg.includes('Ошибка') ? '#ef4444' : '#16a34a', marginBottom: 12, padding: '8px 12px', background: pwMsg.includes('Ошибка') ? '#fef2f2' : '#f0fdf4', borderRadius: 6 }}>{pwMsg}</div>}
              <button onClick={changePassword} style={{ width: '100%', padding: '10px', border: 'none', borderRadius: 7, background: '#4f6ef7', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', color: '#fff' }}>
                Сменить пароль
              </button>
            </div>
          )}

          {tab === 2 && (
            <div style={s.card}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1a2240', marginBottom: 16 }}>Настройки системы</div>
              {[
                { label: 'Email уведомления', desc: 'Получать уведомления о новых платежах и задачах' },
                { label: 'Напоминания о просрочке', desc: 'Автоматические напоминания арендаторам' },
                { label: 'Ежемесячный отчёт', desc: 'Отчёт на email в конце каждого месяца' },
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #f0f2f8' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#1a2240' }}>{item.label}</div>
                    <div style={{ fontSize: 11, color: '#8596b4', marginTop: 2 }}>{item.desc}</div>
                  </div>
                  <div style={{ width: 40, height: 22, borderRadius: 11, background: '#4f6ef7', cursor: 'pointer', position: 'relative', flexShrink: 0 }}>
                    <div style={{ position: 'absolute', top: 3, left: 20, width: 16, height: 16, background: '#fff', borderRadius: '50%' }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
