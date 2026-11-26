import { supabase } from '../../lib/supabase'
import { sb, useSb, useAction } from '../../lib/query'
import { T, Card, Title, Loading, Empty, Note, date, page } from './ui'
import { TenantDeviceCard } from './TenantDevice'

export default function TenantNotifications({ tenantId }: { tenantId: string }) {
  const q = useSb(['tenant_notifications', tenantId, 'cabinet'], () => sb(supabase.from('tenant_notifications').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(100)))
  const readAllA = useAction(() => sb(supabase.from('tenant_notifications').update({ is_read: true }).eq('tenant_id', tenantId).eq('is_read', false)), { invalidate: ['tenant_notifications'] })
  const readAll = () => readAllA.mutate(undefined)

  if (q.isPending) return <Loading />
  const items = q.data ?? []
  const unread = items.some(n => !n.is_read)
  return (
    <div style={page}>
      <TenantDeviceCard />
      <Card>
        <Title right={unread ? <button onClick={readAll} disabled={readAllA.isPending} style={{ minHeight: 44, padding: '0 4px', margin: '-12px 0', background: 'none', border: 'none', color: T.sub, fontSize: 13, cursor: 'pointer', fontFamily: T.font }}>Прочитать все</button> : undefined}>Уведомления</Title>
        {readAllA.error && <Note>{readAllA.error}</Note>}
        {q.error ? <Empty>Не удалось загрузить уведомления. Обновите страницу.</Empty> : items.length === 0 ? <Empty>Уведомлений нет</Empty> : items.map(n => (
          <div key={n.id} style={{ display: 'flex', gap: 12, padding: '13px 0', borderTop: `1px solid ${T.border}` }}>
            <div style={{ width: 8, height: 8, borderRadius: 4, marginTop: 6, flexShrink: 0, background: n.is_read ? 'transparent' : T.accent }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: n.is_read ? 400 : 500, overflowWrap: 'anywhere' }}>{n.title}</div>
              {n.body && <div style={{ fontSize: 14, color: T.sub, marginTop: 4, lineHeight: 1.5, overflowWrap: 'anywhere' }}>{n.body}</div>}
              <div style={{ fontSize: 12, color: T.muted, marginTop: 6 }}>{date(n.created_at)}</div>
            </div>
          </div>
        ))}
      </Card>
    </div>
  )
}
