import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

interface Props {
  tenantId: string;
  onNavigate: (p: string) => void;
}

interface Unit {
  id: string;
  number: string;
  floor: number;
}

interface Contract {
  id: string;
  end_date: string;
}

interface Invoice {
  id: string;
  number: string;
  period: string;
  total_amount: number;
  status: string;
  due_date: string;
}

interface Repair {
  id: string;
  number: string;
  category: string;
  description: string;
  status: string;
  priority: string;
}

interface Meter {
  id: string;
  name: string;
  unit_of_measure: string;
}

interface Notification {
  id: string;
  type: string;
  title: string;
  created_at: string;
}

const cardStyle: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 10,
  padding: 16,
  fontFamily: 'Inter, sans-serif',
};

const statusBadge = (status: string, map: Record<string, { label: string; color: string; bg: string }>) => {
  const s = map[status] || { label: status, color: '#374151', bg: '#f3f4f6' };
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: 12,
      fontSize: 12,
      fontWeight: 600,
      color: s.color,
      background: s.bg,
    }}>{s.label}</span>
  );
};

const invoiceStatusMap: Record<string, { label: string; color: string; bg: string }> = {
  paid: { label: 'Оплачен', color: '#15803d', bg: '#dcfce7' },
  sent: { label: 'Выставлен', color: '#1d4ed8', bg: '#dbeafe' },
  overdue: { label: 'Просрочен', color: '#dc2626', bg: '#fee2e2' },
  draft: { label: 'Черновик', color: '#6b7280', bg: '#f3f4f6' },
};

const repairStatusMap: Record<string, { label: string; color: string; bg: string }> = {
  new: { label: 'Новая', color: '#6b7280', bg: '#f3f4f6' },
  accepted: { label: 'Принята', color: '#1d4ed8', bg: '#dbeafe' },
  in_progress: { label: 'В работе', color: '#b45309', bg: '#fef3c7' },
  completed: { label: 'Выполнена', color: '#15803d', bg: '#dcfce7' },
  rejected: { label: 'Отклонена', color: '#dc2626', bg: '#fee2e2' },
};

function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
}

function daysUntil(dateStr: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const d = new Date(dateStr);
  return Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function relativeTime(dateStr: string): string {
  const now = new Date();
  const d = new Date(dateStr);
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'только что';
  if (diffMin < 60) return `${diffMin} мин. назад`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH} ч. назад`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 30) return `${diffD} дн. назад`;
  return formatDate(dateStr);
}

function notificationIcon(type: string): string {
  switch (type) {
    case 'invoice': return '🧾';
    case 'repair': return '🔧';
    case 'contract': return '📋';
    case 'payment': return '💳';
    default: return '🔔';
  }
}

export default function TenantDashboard({ tenantId, onNavigate }: Props) {
  const [unit, setUnit] = useState<Unit | null>(null);
  const [contract, setContract] = useState<Contract | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [repairs, setRepairs] = useState<Repair[]>([]);
  const [meters, setMeters] = useState<Meter[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  // meter reading form
  const [selectedMeter, setSelectedMeter] = useState('');
  const [readingValue, setReadingValue] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [
        { data: unitData },
        { data: contractData },
        { data: invoiceData },
        { data: repairData },
        { data: meterData },
        { data: notifData },
      ] = await Promise.all([
        supabase.from('units').select('id,number,floor').eq('tenant_id', tenantId).maybeSingle(),
        supabase.from('contracts').select('id,end_date').eq('tenant_id', tenantId).eq('status', 'active').maybeSingle(),
        supabase.from('invoices').select('id,number,period,total_amount,status,due_date').eq('tenant_id', tenantId).order('due_date', { ascending: false }),
        supabase.from('repairs').select('id,number,category,description,status,priority').eq('tenant_id', tenantId).order('created_at', { ascending: false }),
        supabase.from('meters').select('id,name,unit_of_measure').eq('tenant_id', tenantId),
        supabase.from('tenant_notifications').select('id,type,title,created_at').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(5),
      ]);

      setUnit(unitData || null);
      setContract(contractData || null);
      setInvoices(invoiceData || []);
      setRepairs(repairData || []);
      setMeters(meterData || []);
      if (meterData && meterData.length > 0) setSelectedMeter(meterData[0].id);
      setNotifications(notifData || []);
      setLoading(false);
    }
    load();
  }, [tenantId]);

  const debt = invoices
    .filter(i => ['sent','SENT','overdue','OVERDUE'].includes(i.status))
    .reduce((sum, i) => sum + (i.total_amount || 0), 0);

  const activeRepairs = repairs.filter(r => r.status !== 'completed' && r.status !== 'rejected').length;

  const contractDays = contract ? daysUntil(contract.end_date) : null;
  const contractColor = contractDays === null ? '#374151' : contractDays < 30 ? '#dc2626' : contractDays < 60 ? '#d97706' : '#374151';

  async function handleMeterSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedMeter || !readingValue) return;
    setSubmitLoading(true);
    setSubmitError('');
    setSubmitSuccess(false);
    const today = new Date().toISOString().split('T')[0];
    const { error } = await supabase.from('meter_readings').insert({
      meter_id: selectedMeter,
      reading: parseFloat(readingValue),
      reading_date: today,
    });
    setSubmitLoading(false);
    if (error) {
      setSubmitError('Ошибка при передаче показаний');
    } else {
      setSubmitSuccess(true);
      setReadingValue('');
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 32, fontFamily: 'Inter, sans-serif', color: '#6b7280' }}>
        Загрузка...
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'Inter, sans-serif', padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {/* Card 1: Офис */}
        <div style={cardStyle}>
          <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 6, fontWeight: 500 }}>Мой офис</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#111827' }}>
            {unit ? unit.number : '—'}
          </div>
          {unit && (
            <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>этаж {unit.floor}</div>
          )}
        </div>

        {/* Card 2: Договор до */}
        <div style={cardStyle}>
          <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 6, fontWeight: 500 }}>Договор до</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: contractColor }}>
            {contract ? formatDate(contract.end_date) : '—'}
          </div>
          {contractDays !== null && (
            <div style={{ fontSize: 13, color: contractColor, marginTop: 2 }}>
              {contractDays > 0 ? `${contractDays} дн. осталось` : 'Истёк'}
            </div>
          )}
        </div>

        {/* Card 3: Задолженность */}
        <div style={cardStyle}>
          <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 6, fontWeight: 500 }}>Задолженность</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: debt > 0 ? '#dc2626' : '#111827' }}>
            {debt > 0 ? `${debt.toLocaleString('ru-RU')} ₽` : '0 ₽'}
          </div>
          <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>
            {debt > 0 ? 'Требует оплаты' : 'Нет задолженностей'}
          </div>
        </div>

        {/* Card 4: Активных заявок */}
        <div style={cardStyle}>
          <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 6, fontWeight: 500 }}>Активных заявок</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#111827' }}>{activeRepairs}</div>
          <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>
            {activeRepairs === 0 ? 'Нет открытых заявок' : 'В обработке'}
          </div>
        </div>
      </div>

      {/* Two column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Left column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Последние счета */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#111827' }}>Последние счета</h3>
              <button
                onClick={() => onNavigate('invoices')}
                style={{ background: 'none', border: 'none', color: '#6366f1', fontSize: 13, cursor: 'pointer', padding: 0 }}
              >
                Все счета →
              </button>
            </div>
            {invoices.length === 0 ? (
              <div style={{ color: '#9ca3af', fontSize: 14 }}>Счетов нет</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {invoices.slice(0, 3).map(inv => (
                  <div key={inv.id} style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr auto auto',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 0',
                    borderBottom: '1px solid #f3f4f6',
                  }}>
                    <div style={{ fontSize: 13, color: '#374151' }}>{inv.period}</div>
                    <div style={{ fontSize: 12, color: '#9ca3af' }}>№{inv.number}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', whiteSpace: 'nowrap' }}>
                      {(inv.total_amount || 0).toLocaleString('ru-RU')} ₽
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {statusBadge(inv.status, invoiceStatusMap)}
                      <button style={{
                        fontSize: 12,
                        padding: '3px 8px',
                        borderRadius: 6,
                        border: '1px solid #d1d5db',
                        background: '#f9fafb',
                        color: '#9ca3af',
                        cursor: 'not-allowed',
                      }} disabled>Скачать</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Мои заявки */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#111827' }}>Мои заявки</h3>
              <button
                onClick={() => onNavigate('repairs')}
                style={{ background: 'none', border: 'none', color: '#6366f1', fontSize: 13, cursor: 'pointer', padding: 0 }}
              >
                Все заявки →
              </button>
            </div>
            {repairs.length === 0 ? (
              <div style={{ color: '#9ca3af', fontSize: 14 }}>Заявок нет</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {repairs.slice(0, 3).map(r => (
                  <div key={r.id} style={{
                    display: 'grid',
                    gridTemplateColumns: 'auto 1fr auto',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 0',
                    borderBottom: '1px solid #f3f4f6',
                  }}>
                    <div style={{ fontSize: 12, color: '#9ca3af' }}>#{r.number}</div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{r.category}</div>
                      <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 1 }}>
                        {r.description ? r.description.slice(0, 40) + (r.description.length > 40 ? '…' : '') : ''}
                      </div>
                    </div>
                    {statusBadge(r.status, repairStatusMap)}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Передать показания */}
          <div style={cardStyle}>
            <h3 style={{ margin: '0 0 14px 0', fontSize: 15, fontWeight: 700, color: '#111827' }}>Передать показания</h3>
            {meters.length === 0 ? (
              <div style={{ color: '#9ca3af', fontSize: 14 }}>Счётчики не подключены</div>
            ) : (
              <form onSubmit={handleMeterSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Счётчик</label>
                  <select
                    value={selectedMeter}
                    onChange={e => setSelectedMeter(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      border: '1px solid #d1d5db',
                      borderRadius: 6,
                      fontSize: 14,
                      color: '#111827',
                      background: '#fff',
                      boxSizing: 'border-box',
                    }}
                  >
                    {meters.map(m => (
                      <option key={m.id} value={m.id}>{m.name} ({m.unit_of_measure})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Показание</label>
                  <input
                    type="number"
                    step="0.01"
                    value={readingValue}
                    onChange={e => { setReadingValue(e.target.value); setSubmitSuccess(false); setSubmitError(''); }}
                    placeholder="Введите показание"
                    required
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      border: '1px solid #d1d5db',
                      borderRadius: 6,
                      fontSize: 14,
                      color: '#111827',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
                {submitSuccess && (
                  <div style={{ fontSize: 13, color: '#15803d', background: '#dcfce7', borderRadius: 6, padding: '6px 10px' }}>
                    Показания успешно переданы!
                  </div>
                )}
                {submitError && (
                  <div style={{ fontSize: 13, color: '#dc2626', background: '#fee2e2', borderRadius: 6, padding: '6px 10px' }}>
                    {submitError}
                  </div>
                )}
                <button
                  type="submit"
                  disabled={submitLoading}
                  style={{
                    padding: '9px 16px',
                    background: submitLoading ? '#a5b4fc' : '#6366f1',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 7,
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: submitLoading ? 'not-allowed' : 'pointer',
                    transition: 'background 0.15s',
                  }}
                >
                  {submitLoading ? 'Передача...' : 'Передать'}
                </button>
              </form>
            )}
          </div>

          {/* Уведомления */}
          <div style={cardStyle}>
            <h3 style={{ margin: '0 0 14px 0', fontSize: 15, fontWeight: 700, color: '#111827' }}>Уведомления</h3>
            {notifications.length === 0 ? (
              <div style={{ color: '#9ca3af', fontSize: 14 }}>Уведомлений нет</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {notifications.map(n => (
                  <div key={n.id} style={{
                    display: 'grid',
                    gridTemplateColumns: 'auto 1fr auto',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 0',
                    borderBottom: '1px solid #f3f4f6',
                  }}>
                    <span style={{ fontSize: 18 }}>{notificationIcon(n.type)}</span>
                    <div style={{ fontSize: 13, color: '#374151', fontWeight: 500 }}>{n.title}</div>
                    <div style={{ fontSize: 11, color: '#9ca3af', whiteSpace: 'nowrap' }}>{relativeTime(n.created_at)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
