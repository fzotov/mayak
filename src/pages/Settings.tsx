import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { apiFetch } from '../lib/api'
import { C, Modal, Button, Field, Input, Select, Notice, Muted, Row, Loading, Empty, ErrorBox } from '../components/ui'

const ROLES: Record<string, string> = { owner: 'Владелец', manager: 'Управляющий' }
const h: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: C.text, margin: '0 0 12px' }

interface Props { user: any; profile: { full_name: string; role: string }; onClose: () => void; onLogout: () => void }
type Msg = { ok: boolean; text: string } | null

/** Профиль: смена пароля, выход; для владельца — кто имеет доступ в систему. */
export function SettingsModal({ user, profile, onClose, onLogout }: Props) {
  const isOwner = profile.role === 'owner'
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwMsg, setPwMsg] = useState<Msg>(null)
  const [people, setPeople] = useState<any[]>([])
  const [peopleLoading, setPeopleLoading] = useState(false)
  const [peopleErr, setPeopleErr] = useState('')
  const [inv, setInv] = useState({ fullName: '', email: '', role: 'manager' })
  const [invMsg, setInvMsg] = useState<Msg>(null)
  const [busy, setBusy] = useState(false)
  const [revoking, setRevoking] = useState<any | null>(null)
  const [revokeBusy, setRevokeBusy] = useState(false)
  const [revokeErr, setRevokeErr] = useState('')

  const loadPeople = () => {
    setPeopleLoading(true); setPeopleErr('')
    return supabase.from('profiles').select('user_id, email, full_name, role').order('created_at').then(({ data, error }) => {
      if (error) setPeopleErr('Не удалось загрузить список: ' + error.message)
      setPeople(data || []); setPeopleLoading(false)
    })
  }
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

  const revoke = async () => {
    const p = revoking
    if (!p) return
    setRevokeBusy(true); setRevokeErr('')
    const r = await apiFetch('/api/staff-invite', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: p.user_id }) })
    const d = await r.json().catch(() => ({ ok: false }))
    setRevokeBusy(false)
    if (d.ok) { setRevoking(null); loadPeople() } else setRevokeErr(d.error || 'Не удалось отозвать доступ')
  }

  const note = (m: Msg) => m && <Notice tone={m.ok ? 'green' : 'red'}>{m.text}</Notice>

  return (
    <>
      <Modal title="Профиль" onClose={() => { if (!revoking) onClose() }} width={520}
        footer={<Button onClick={onLogout}>Выйти</Button>}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>{profile.full_name || user.email}</div>
          <Muted small>{ROLES[profile.role] || profile.role} · {user.email}</Muted>
        </div>

        <form onSubmit={changePassword} style={{ display: 'grid', gap: 12, paddingTop: 12, borderTop: `1px solid ${C.line}` }}>
          <p style={h}>Смена пароля</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            <Field label="Новый пароль"><Input type="password" autoComplete="new-password" value={newPw} onChange={e => setNewPw(e.target.value)} /></Field>
            <Field label="Ещё раз"><Input type="password" autoComplete="new-password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} /></Field>
          </div>
          <div><Button kind="primary" type="submit">Сменить пароль</Button></div>
          {note(pwMsg)}
        </form>

        {isOwner && (
          <div style={{ display: 'grid', gap: 12, paddingTop: 12, borderTop: `1px solid ${C.line}` }}>
            <p style={h}>Доступ в систему</p>
            {peopleErr && <ErrorBox error={peopleErr} onRetry={loadPeople} />}
            <div style={{ border: `1px solid ${C.line}`, borderRadius: C.radiusSm }}>
              {peopleLoading && people.length === 0 ? <Loading /> : people.length === 0 ? <Empty>Нет сотрудников</Empty> : people.map((p, i) => (
                <div key={p.user_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderTop: i ? `1px solid ${C.line}` : 'none' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.full_name || p.email}</div>
                    <Muted small>{ROLES[p.role] || p.role} · {p.email}</Muted>
                  </div>
                  {p.user_id !== user.id && <Button small kind="danger" onClick={() => { setRevokeErr(''); setRevoking(p) }}>Отозвать</Button>}
                </div>
              ))}
            </div>
            <form onSubmit={invite} style={{ display: 'grid', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
                <Input placeholder="Имя и фамилия" value={inv.fullName} onChange={e => setInv({ ...inv, fullName: e.target.value })} required />
                <Input type="email" placeholder="Email" value={inv.email} onChange={e => setInv({ ...inv, email: e.target.value })} required />
                <Select value={inv.role} onChange={e => setInv({ ...inv, role: e.target.value })}>
                  {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </Select>
              </div>
              <div><Button kind="primary" type="submit" disabled={busy}>{busy ? 'Отправляем…' : 'Пригласить сотрудника'}</Button></div>
              {note(invMsg)}
            </form>
          </div>
        )}
      </Modal>

      {revoking && (
        <Modal title="Отозвать доступ" onClose={() => setRevoking(null)} width={420}
          footer={<Row><Button onClick={() => setRevoking(null)}>Отмена</Button><Button kind="danger" disabled={revokeBusy} onClick={revoke}>{revokeBusy ? 'Отзываем…' : 'Отозвать'}</Button></Row>}>
          <div>Отозвать доступ у {revoking.full_name || revoking.email}?</div>
          {revokeErr && <Notice tone="red">{revokeErr}</Notice>}
        </Modal>
      )}
    </>
  )
}
