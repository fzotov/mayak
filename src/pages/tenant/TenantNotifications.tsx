import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

interface TenantNotification {
  id: string;
  tenant_id: string;
  type: 'invoice' | 'repair_done' | 'payment_due' | 'contract_expiry' | 'repair_comment';
  title: string;
  body: string | null;
  is_read: boolean;
  link: string | null;
  created_at: string;
}

const TYPE_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
  invoice: { icon: '💳', color: '#2563eb', label: 'Новый счёт' },
  repair_done: { icon: '✅', color: '#16a34a', label: 'Заявка выполнена' },
  payment_due: { icon: '⚠️', color: '#d97706', label: 'Срок оплаты' },
  contract_expiry: { icon: '📋', color: '#ef4444', label: 'Договор истекает' },
  repair_comment: { icon: '💬', color: '#6b7280', label: 'Комментарий' },
};

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const itemDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (itemDate.getTime() === today.getTime()) {
    return `Сегодня, ${date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
  } else if (itemDate.getTime() === yesterday.getTime()) {
    return `Вчера, ${date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
  } else {
    return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
}

export default function TenantNotifications({ tenantId }: { tenantId: string }) {
  const [notifications, setNotifications] = useState<TenantNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadNotifications();
  }, [tenantId]);

  async function loadNotifications() {
    setLoading(true);
    const { data } = await supabase
      .from('tenant_notifications')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });
    setNotifications(data || []);
    setLoading(false);
  }

  async function markAsRead(id: string) {
    await supabase
      .from('tenant_notifications')
      .update({ is_read: true })
      .eq('id', id);
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, is_read: true } : n)
    );
  }

  async function markAllAsRead() {
    await supabase
      .from('tenant_notifications')
      .update({ is_read: true })
      .eq('tenant_id', tenantId);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  }

  const unreadCount = notifications.filter(n => !n.is_read).length;

  if (loading) {
    return (
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden', padding: 24, textAlign: 'center', color: '#6b7280' }}>
        Загрузка...
      </div>
    );
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #e5e7eb' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: '#111827' }}>Уведомления</span>
          {unreadCount > 0 && (
            <span style={{
              background: '#2563eb',
              color: '#fff',
              fontSize: 12,
              fontWeight: 600,
              borderRadius: 999,
              padding: '2px 8px',
              lineHeight: '18px',
            }}>
              {unreadCount}
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            style={{
              background: 'none',
              border: '1px solid #d1d5db',
              borderRadius: 6,
              padding: '6px 12px',
              fontSize: 13,
              color: '#374151',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            Отметить все прочитанными
          </button>
        )}
      </div>

      {/* Empty state */}
      {notifications.length === 0 && (
        <div style={{ padding: 48, textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔔</div>
          <div style={{ color: '#6b7280', fontSize: 15 }}>Уведомлений нет</div>
        </div>
      )}

      {/* Notification list */}
      {notifications.map((n, idx) => {
        const config = TYPE_CONFIG[n.type] || { icon: '🔔', color: '#6b7280', label: n.type };
        return (
          <div
            key={n.id}
            onClick={() => { if (!n.is_read) markAsRead(n.id); }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '14px 20px',
              background: n.is_read ? '#fff' : '#f0f9ff',
              borderBottom: idx < notifications.length - 1 ? '1px solid #e5e7eb' : 'none',
              cursor: n.is_read ? 'default' : 'pointer',
              transition: 'background 0.15s',
            }}
          >
            {/* Icon circle */}
            <div style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: config.color + '1a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 18,
              flexShrink: 0,
            }}>
              {config.icon}
            </div>

            {/* Content */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: '#111827', marginBottom: 2 }}>{n.title}</div>
              {n.body && (
                <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 2, whiteSpace: 'pre-wrap' }}>{n.body}</div>
              )}
              <div style={{ fontSize: 12, color: '#9ca3af' }}>{formatRelativeTime(n.created_at)}</div>
            </div>

            {/* Unread dot */}
            <div style={{ width: 16, flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
              {!n.is_read && (
                <div style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: '#2563eb',
                }} />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
