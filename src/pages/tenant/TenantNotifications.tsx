import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { T, Card, Title, Loading, Empty, date, page } from './ui'

export default function TenantNotifications({ tenantId }: { tenantId: string }) {
  const [items, setItems] = useState<any[] | null>(null)
  const load = () => supabase.from('tenant_notifications').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(100).then(({ data }) => setItems(data || []))
  useEffect(() => { load() }, [tenantId])

  const readAll = async () => {
    await supabase.from('tenant_notifications').update({ is_read: true }).eq('tenant_id', tenantId).eq('is_read', false)
    load()
  }
  if (!items) return <Loading />
  const unread = items.some(n => !n.is_read)
  return (
    <div style={page}>
      <Card>
        <Title right={unread ? <button onClick={readAll} style={{ background: 'none', border: 'none', color: T.sub, fontSize: 13, cursor: 'pointer', fontFamily: T.font }}>Прочитать все</button> : undefined}>Уведомления</Title>
        {items.length === 0 ? <Empty>Уведомлений нет</Empty> : items.map(n => (
          <div key={n.id} style={{ display: 'flex', gap: 12, padding: '13px 0', borderTop: `1px solid ${T.border}` }}>
            <div style={{ width: 8, height: 8, borderRadius: 4, marginTop: 6, flexShrink: 0, background: n.is_read ? 'transparent' : T.accent }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: n.is_read ? 400 : 500 }}>{n.title}</div>
              {n.body && <div style={{ fontSize: 14, color: T.sub, marginTop: 4, lineHeight: 1.5 }}>{n.body}</div>}
              <div style={{ fontSize: 12, color: T.muted, marginTop: 6 }}>{date(n.created_at)}</div>
            </div>
          </div>
        ))}
      </Card>
    </div>
  )
}
