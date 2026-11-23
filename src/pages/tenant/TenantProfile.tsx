import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { apiFetch } from '../../lib/api'
import { useTenant } from './useTenant'
import { Card, Title, Row, Button, Loading, Note, input, label, page } from './ui'

export default function TenantProfile({ tenantId }: { tenantId: string }) {
  const { tenant: t, loading } = useTenant(tenantId)
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => { if (t) { setPhone(t.phone || ''); setEmail(t.email || '') } }, [t])

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true); setMsg(null)
    const r = await apiFetch('/api/tenant-profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone, email }) })
    const d = await r.json().catch(() => ({ ok: false }))
    setBusy(false)
    setMsg(d.ok ? { ok: true, text: 'Контакты сохранены' } : { ok: false, text: d.error || 'Не удалось сохранить' })
  }
  const changePw = async (e: React.FormEvent) => {
    e.preventDefault()
    if (pw.length < 8) { setPwMsg({ ok: false, text: 'Пароль должен быть не короче 8 символов' }); return }
    if (pw !== pw2) { setPwMsg({ ok: false, text: 'Пароли не совпадают' }); return }
    const { error } = await supabase.auth.updateUser({ password: pw })
    setPwMsg(error ? { ok: false, text: 'Не удалось сменить пароль' } : { ok: true, text: 'Пароль изменён' })
    if (!error) { setPw(''); setPw2('') }
  }

  if (loading) return <Loading />
  return (
    <div style={page}>
      <Card>
        <Title>Организация</Title>
        <Row label="Наименование" value={t?.full_name} />
        <Row label="ИНН" value={t?.inn} />
        <Row label="Помещение" value={t?.unit_number ? `№ ${t.unit_number}` : null} />
      </Card>
      <Card>
        <Title>Контакты для связи</Title>
        <form onSubmit={save}>
          <label style={label}>Телефон</label>
          <input style={{ ...input, marginBottom: 14 }} type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={e => setPhone(e.target.value)} />
          <label style={label}>Email</label>
          <input style={{ ...input, marginBottom: 16 }} type="email" inputMode="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} />
          <Button type="submit" disabled={busy} full>{busy ? 'Сохраняем…' : 'Сохранить'}</Button>
          {msg && <Note tone={msg.ok ? 'ok' : 'bad'}>{msg.text}</Note>}
        </form>
      </Card>
      <Card>
        <Title>Смена пароля</Title>
        <form onSubmit={changePw}>
          <label style={label}>Новый пароль</label>
          <input style={{ ...input, marginBottom: 14 }} type="password" autoComplete="new-password" value={pw} onChange={e => setPw(e.target.value)} />
          <label style={label}>Ещё раз</label>
          <input style={{ ...input, marginBottom: 16 }} type="password" autoComplete="new-password" value={pw2} onChange={e => setPw2(e.target.value)} />
          <Button type="submit" kind="ghost" full>Сменить пароль</Button>
          {pwMsg && <Note tone={pwMsg.ok ? 'ok' : 'bad'}>{pwMsg.text}</Note>}
        </form>
      </Card>
    </div>
  )
}
