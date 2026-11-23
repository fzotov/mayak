import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { apiFetch } from '../lib/api'

/** Блок в карточке арендатора: кто имеет доступ в кабинет, приглашение по почте. */
export function TenantPortalAccess({ tenantId, defaultEmail }: { tenantId: string; defaultEmail?: string }) {
  const [users, setUsers] = useState<any[]>([])
  const [email, setEmail] = useState(defaultEmail || '')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const load = () => supabase.from('tenant_users').select('user_id, email, activated_at').eq('tenant_id', tenantId).order('created_at')
    .then(({ data }) => setUsers(data || []))
  useEffect(() => { load() }, [tenantId])

  const invite = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true); setMsg(null)
    const r = await apiFetch('/api/send-tenant-invite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenantId, email }) })
    const d = await r.json().catch(() => ({ ok: false, error: 'Сервер не ответил' }))
    setBusy(false)
    setMsg(d.ok ? { ok: true, text: `Приглашение отправлено на ${email}. Ссылка действует 7 дней.` } : { ok: false, text: d.error || 'Не удалось отправить' })
  }

  const unlink = async (u: any) => {
    if (!confirm(`Закрыть доступ в кабинет для ${u.email}?`)) return
    await supabase.from('tenant_users').delete().eq('user_id', u.user_id)
    load()
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #e8ebf3', borderRadius: 10, padding: 18, marginBottom: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: '#1a2240', marginBottom: 4 }}>Кабинет арендатора</div>
      <div style={{ fontSize: 13, color: '#8596b4', marginBottom: 14 }}>
        {users.length ? 'Доступ открыт:' : 'Доступ ещё не выдан. Отправьте приглашение — арендатор сам задаст пароль.'}
      </div>
      {users.map(u => (
        <div key={u.user_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderTop: '1px solid #f0f2f8', fontSize: 14 }}>
          <span style={{ flex: 1, color: '#1a2240', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.email}</span>
          <span style={{ fontSize: 12, color: '#16a34a' }}>активен{u.activated_at ? ' с ' + new Date(u.activated_at).toLocaleDateString('ru-RU') : ''}</span>
          <button onClick={() => unlink(u)} style={{ border: '1px solid #e8ebf3', background: '#fff', color: '#b91c1c', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Закрыть доступ</button>
        </div>
      ))}
      <form onSubmit={invite} style={{ display: 'flex', gap: 8, marginTop: users.length ? 14 : 0, flexWrap: 'wrap' }}>
        <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="Email арендатора"
          style={{ flex: '1 1 220px', padding: '8px 10px', border: '1px solid #e8ebf3', borderRadius: 7, fontSize: 14, fontFamily: 'inherit', outline: 'none' }} />
        <button type="submit" disabled={busy} style={{ padding: '8px 16px', border: 'none', borderRadius: 7, background: '#111', color: '#fff', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', opacity: busy ? 0.6 : 1 }}>
          {busy ? 'Отправляем…' : 'Пригласить'}
        </button>
      </form>
      {msg && <div style={{ fontSize: 13, marginTop: 10, padding: '8px 12px', borderRadius: 7, background: msg.ok ? '#f0fdf4' : '#fef2f2', color: msg.ok ? '#166534' : '#b91c1c' }}>{msg.text}</div>}
    </div>
  )
}
