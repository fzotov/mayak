import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { apiFetch } from '../lib/api'

const ROLES: Record<string, string> = { owner: 'Владелец', manager: 'Управляющий', accountant: 'Бухгалтер', technician: 'Техник' }
const inp: React.CSSProperties = { width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 15, fontFamily: 'inherit', outline: 'none', color: '#111', boxSizing: 'border-box' }
const lbl: React.CSSProperties = { fontSize: 13, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 6 }
const btn: React.CSSProperties = { padding: '10px 16px', background: '#111', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }
const h: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: '#111', margin: '0 0 12px' }

interface Props { user: any; profile: { full_name: string; role: string }; onClose: () => void; onLogout: () => void }

/** Профиль: смена пароля, выход; для владельца — кто имеет доступ в систему. */
export function SettingsModal({ user, profile, onClose, onLogout }: Props) {
  const isOwner = profile.role === 'owner'
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [people, setPeople] = useState<any[]>([])
  const [inv, setInv] = useState({ fullName: '', email: '', role: 'manager' })
  const [invMsg, setInvMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const loadPeople = () => supabase.from('profiles').select('user_id, email, full_name, role').order('created_at').then(({ data }) => setPeople(data || []))
  useEffect(() => { if (isOwner) loadPeople() }, [isOwner])

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPw.length < 8) { setPwMsg({ ok: false, text: 'Пароль должен быть не короче 8 символов' }); return }
    if (newPw !== confirmPw) { setPwMsg({ ok: false, text: 'Пароли не совпадают' }); return }
    const { error } = await supabase.auth.updateUser({ password: newPw })
    if (error) setPwMsg({ ok: false, text: 'Не удалось сменить пароль: ' + error.message })
    else { setPwMsg({ ok: true, text: 'Пароль изменён' }); setNewPw(''); setConfirmPw('') }
  }

  const invite = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true); setInvMsg(null)
    const r = await apiFetch('/api/staff-invite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(inv) })
    const d = await r.json().catch(() => ({ ok: false, error: 'Сервер не ответил' }))
    setBusy(false)
    if (d.ok) { setInvMsg({ ok: true, text: `Приглашение отправлено на ${inv.email}` }); setInv({ fullName: '', email: '', role: 'manager' }) }
    else setInvMsg({ ok: false, text: d.error || 'Не удалось отправить приглашение' })
  }

  const revoke = async (p: any) => {
    if (!confirm(`Отозвать доступ у ${p.full_name || p.email}?`)) return
    const r = await apiFetch('/api/staff-invite', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: p.user_id }) })
    const d = await r.json().catch(() => ({ ok: false }))
    if (d.ok) loadPeople(); else alert(d.error || 'Не удалось отозвать доступ')
  }

  const note = (m: { ok: boolean; text: string } | null) => m && (
    <div style={{ fontSize: 13, marginTop: 10, padding: '8px 12px', borderRadius: 8, background: m.ok ? '#f0fdf4' : '#fef2f2', color: m.ok ? '#166534' : '#b91c1c' }}>{m.text}</div>
  )

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 520, maxHeight: '90dvh', overflowY: 'auto' }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#111' }}>{profile.full_name || user.email}</div>
            <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>{ROLES[profile.role] || profile.role} · {user.email}</div>
          </div>
          <button onClick={onClose} aria-label="Закрыть" style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#9ca3af', lineHeight: 1 }}>×</button>
        </div>

        <div style={{ padding: 22 }}>
          <form onSubmit={changePassword} style={{ marginBottom: 26 }}>
            <p style={h}>Смена пароля</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 12 }}>
              <div><label style={lbl}>Новый пароль</label><input style={inp} type="password" autoComplete="new-password" value={newPw} onChange={e => setNewPw(e.target.value)} /></div>
              <div><label style={lbl}>Ещё раз</label><input style={inp} type="password" autoComplete="new-password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} /></div>
            </div>
            <button type="submit" style={btn}>Сменить пароль</button>
            {note(pwMsg)}
          </form>

          {isOwner && (
            <div style={{ marginBottom: 26 }}>
              <p style={h}>Доступ в систему</p>
              <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, marginBottom: 14 }}>
                {people.map((p, i) => (
                  <div key={p.user_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderTop: i ? '1px solid #f0f0f0' : 'none' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.full_name || p.email}</div>
                      <div style={{ fontSize: 12, color: '#6b7280' }}>{ROLES[p.role] || p.role} · {p.email}</div>
                    </div>
                    {p.user_id !== user.id && <button onClick={() => revoke(p)} style={{ border: '1px solid #e5e7eb', background: '#fff', color: '#b91c1c', borderRadius: 7, padding: '5px 10px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Отозвать</button>}
                  </div>
                ))}
              </div>
              <form onSubmit={invite}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 12 }}>
                  <input style={inp} placeholder="Имя и фамилия" value={inv.fullName} onChange={e => setInv({ ...inv, fullName: e.target.value })} required />
                  <input style={inp} type="email" placeholder="Email" value={inv.email} onChange={e => setInv({ ...inv, email: e.target.value })} required />
                  <select style={inp} value={inv.role} onChange={e => setInv({ ...inv, role: e.target.value })}>
                    {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <button type="submit" disabled={busy} style={{ ...btn, opacity: busy ? 0.6 : 1 }}>{busy ? 'Отправляем…' : 'Пригласить сотрудника'}</button>
                {note(invMsg)}
              </form>
            </div>
          )}

          <button onClick={onLogout} style={{ ...btn, background: '#fff', color: '#111', border: '1px solid #e5e7eb' }}>Выйти</button>
        </div>
      </div>
    </div>
  )
}
