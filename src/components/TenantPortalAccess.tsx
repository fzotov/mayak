import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { sb, useSb, useAction, useInvalidate } from '../lib/query'
import type { Tables } from '../lib/database.types'
import { apiFetch } from '../lib/api'
import { Card, Button, Input, Notice, ErrorBox, Muted, Badge, C, dateRu } from './ui'
import { ask } from './Dialogs'

/** Блок в карточке арендатора: кто имеет доступ в кабинет, приглашение по почте. */
export function TenantPortalAccess({ tenantId, defaultEmail }: { tenantId: string; defaultEmail?: string }) {
  const [email, setEmail] = useState(defaultEmail || '')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const invalidate = useInvalidate()
  const usersQ = useSb(['tenant_users', tenantId], () => sb(supabase.from('tenant_users').select('user_id, email, activated_at').eq('tenant_id', tenantId).order('created_at')))
  const users = usersQ.data || []
  const loadError = usersQ.error?.message || ''
  const load = () => { usersQ.refetch() }
  const unlinkA = useAction((userId: string) => sb(supabase.from('tenant_users').delete().eq('user_id', userId)), { invalidate: ['tenant_users'] })

  const invite = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true); setMsg(null)
    const r = await apiFetch('/api/send-tenant-invite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenantId, email }) })
    const d: { ok?: boolean; error?: string } = await r.json().catch(() => ({ ok: false, error: 'Сервер не ответил' }))
    setBusy(false)
    if (d.ok) invalidate('tenant_users')
    setMsg(d.ok ? { ok: true, text: `Приглашение отправлено на ${email}. Ссылка действует 7 дней.` } : { ok: false, text: d.error || 'Не удалось отправить' })
  }

  const unlink = async (u: Pick<Tables<'tenant_users'>, 'user_id' | 'email'>) => {
    if (!(await ask(`Закрыть доступ в кабинет для ${u.email}?`, { ok: 'Закрыть доступ', danger: true }))) return
    unlinkA.mutate(u.user_id, { onError: e => setMsg({ ok: false, text: e.message }) })
  }

  return (
    <Card title="Кабинет арендатора">
      <div style={{ display: 'grid', gap: 12 }}>
        {loadError && <ErrorBox error={loadError} onRetry={load} />}
        <Muted>{users.length ? 'Доступ открыт:' : 'Доступ ещё не выдан. Отправьте приглашение — арендатор сам задаст пароль.'}</Muted>
        {users.length > 0 && (
          <div>
            {users.map(u => (
              <div key={u.user_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderTop: `1px solid ${C.line}`, fontSize: 14, flexWrap: 'wrap' }}>
                <span style={{ flex: 1, minWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.email}</span>
                <Badge tone="green">активен{u.activated_at ? ' с ' + dateRu(u.activated_at) : ''}</Badge>
                <Button small kind="danger" disabled={unlinkA.isPending} onClick={() => unlink(u)}>Закрыть доступ</Button>
              </div>
            ))}
          </div>
        )}
        <form onSubmit={invite} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="Email арендатора" style={{ flex: '1 1 220px', width: 'auto' }} />
          <Button type="submit" kind="primary" disabled={busy}>{busy ? 'Отправляем…' : 'Пригласить'}</Button>
        </form>
        {msg && <Notice tone={msg.ok ? 'green' : 'red'}>{msg.text}</Notice>}
      </div>
    </Card>
  )
}
