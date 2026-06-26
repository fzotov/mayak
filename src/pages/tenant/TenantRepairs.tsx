import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

interface Repair {
  id: string;
  number: number;
  tenant_id: string;
  unit_id: string | null;
  category: string;
  priority: string;
  status: string;
  description: string;
  photos: string[] | null;
  assignee_id: string | null;
  due_date: string | null;
  completed_date: string | null;
  cost: number | null;
  comment: string | null;
  created_at: string;
}

interface Unit {
  id: string;
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  new: { label: 'Новая', bg: '#f3f4f6', color: '#6b7280' },
  accepted: { label: 'Принята', bg: '#dbeafe', color: '#2563eb' },
  in_progress: { label: 'В работе', bg: '#fef3c7', color: '#d97706' },
  completed: { label: 'Выполнена', bg: '#dcfce7', color: '#16a34a' },
  rejected: { label: 'Отклонена', bg: '#fee2e2', color: '#ef4444' },
};

const CATEGORIES = ['Электрика', 'Сантехника', 'Отопление', 'Интернет', 'Уборка', 'Другое'];

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('ru-RU');
}

export default function TenantRepairs({ tenantId }: { tenantId: string }) {
  const [repairs, setRepairs] = useState<Repair[]>([]);
  const [unit, setUnit] = useState<Unit | null>(null);
  const [selectedRepair, setSelectedRepair] = useState<Repair | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [formError, setFormError] = useState('');

  const loadRepairs = async () => {
    const { data } = await supabase
      .from('repairs')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });
    if (data) setRepairs(data);
  };

  const loadUnit = async () => {
    const { data } = await supabase
      .from('units')
      .select('id')
      .eq('tenant_id', tenantId)
      .limit(1)
      .single();
    if (data) setUnit(data);
  };

  useEffect(() => {
    loadRepairs();
    loadUnit();
  }, [tenantId]);

  const handleSubmit = async () => {
    setFormError('');
    if (description.trim().length < 10) {
      setFormError('Описание должно быть не менее 10 символов.');
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from('repairs').insert({
      tenant_id: tenantId,
      unit_id: unit?.id || null,
      category,
      description: description.trim(),
      priority: 'medium',
      status: 'new',
    });
    setSubmitting(false);
    if (error) {
      setFormError('Ошибка при отправке. Попробуйте снова.');
      return;
    }
    setDescription('');
    setCategory(CATEGORIES[0]);
    setShowForm(false);
    setSuccessMsg('Заявка успешно подана!');
    setTimeout(() => setSuccessMsg(''), 4000);
    await loadRepairs();
  };

  const statusBadge = (status: string) => {
    const cfg = STATUS_CONFIG[status] || { label: status, bg: '#f3f4f6', color: '#6b7280' };
    return (
      <span style={{
        background: cfg.bg,
        color: cfg.color,
        borderRadius: 6,
        padding: '2px 10px',
        fontSize: 13,
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}>
        {cfg.label}
      </span>
    );
  };

  return (
    <div style={{ fontFamily: 'sans-serif', maxWidth: 900, margin: '0 auto', padding: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 22 }}>Заявки на ремонт</h2>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            style={{
              background: '#2563eb', color: '#fff', border: 'none',
              borderRadius: 8, padding: '8px 18px', fontSize: 14,
              cursor: 'pointer', fontWeight: 600,
            }}
          >
            + Подать заявку
          </button>
        )}
      </div>

      {successMsg && (
        <div style={{
          background: '#dcfce7', color: '#16a34a', borderRadius: 8,
          padding: '10px 16px', marginBottom: 16, fontWeight: 600,
        }}>
          {successMsg}
        </div>
      )}

      {showForm && (
        <div style={{
          background: '#fff', border: '1px solid #e5e7eb',
          borderRadius: 10, padding: 20, marginBottom: 20,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <span style={{ fontWeight: 700, fontSize: 16 }}>Подать заявку</span>
            <button
              onClick={() => { setShowForm(false); setFormError(''); setDescription(''); setCategory(CATEGORIES[0]); }}
              style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6b7280' }}
            >
              ×
            </button>
          </div>

          <label style={{ display: 'block', marginBottom: 12 }}>
            <span style={{ fontSize: 13, color: '#374151', fontWeight: 600 }}>Категория</span>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              style={{
                display: 'block', width: '100%', marginTop: 4,
                border: '1px solid #d1d5db', borderRadius: 6, padding: '8px 10px',
                fontSize: 14, background: '#fff',
              }}
            >
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>

          <label style={{ display: 'block', marginBottom: 12 }}>
            <span style={{ fontSize: 13, color: '#374151', fontWeight: 600 }}>Описание проблемы</span>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={4}
              placeholder="Опишите проблему подробно..."
              style={{
                display: 'block', width: '100%', marginTop: 4, boxSizing: 'border-box',
                border: '1px solid #d1d5db', borderRadius: 6, padding: '8px 10px',
                fontSize: 14, resize: 'vertical',
              }}
            />
          </label>

          <p style={{ fontSize: 12, color: '#9ca3af', margin: '0 0 14px' }}>
            Приоритет установит администратор
          </p>

          {formError && (
            <p style={{ color: '#ef4444', fontSize: 13, marginBottom: 12 }}>{formError}</p>
          )}

          <button
            onClick={handleSubmit}
            disabled={submitting}
            style={{
              background: submitting ? '#93c5fd' : '#2563eb',
              color: '#fff', border: 'none', borderRadius: 8,
              padding: '9px 22px', fontSize: 14, fontWeight: 600,
              cursor: submitting ? 'not-allowed' : 'pointer',
            }}
          >
            {submitting ? 'Отправка...' : 'Подать заявку'}
          </button>
        </div>
      )}

      {repairs.length === 0 ? (
        <div style={{
          background: '#fff', border: '1px solid #e5e7eb',
          borderRadius: 10, padding: 32, textAlign: 'center', color: '#9ca3af',
        }}>
          Заявок пока нет
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                {['№', 'Дата', 'Категория', 'Описание', 'Статус', 'Действие'].map(h => (
                  <th key={h} style={{
                    padding: '10px 12px', textAlign: 'left',
                    fontWeight: 600, color: '#374151', whiteSpace: 'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {repairs.map(r => (
                <tr key={r.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '10px 12px', color: '#6b7280' }}>#{r.number}</td>
                  <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>{formatDate(r.created_at)}</td>
                  <td style={{ padding: '10px 12px' }}>{r.category}</td>
                  <td style={{ padding: '10px 12px', maxWidth: 220, color: '#374151' }}>
                    {r.description.length > 50 ? r.description.slice(0, 50) + '…' : r.description}
                  </td>
                  <td style={{ padding: '10px 12px' }}>{statusBadge(r.status)}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <button
                      onClick={() => setSelectedRepair(r)}
                      style={{
                        background: 'none', border: '1px solid #d1d5db',
                        borderRadius: 6, padding: '4px 12px', fontSize: 13,
                        cursor: 'pointer', color: '#374151',
                      }}
                    >
                      Подробнее
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedRepair && (
        <div
          onClick={() => setSelectedRepair(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: 16,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#fff', borderRadius: 12, padding: 28,
              maxWidth: 520, width: '100%', position: 'relative',
            }}
          >
            <button
              onClick={() => setSelectedRepair(null)}
              style={{
                position: 'absolute', top: 14, right: 16,
                background: 'none', border: 'none', fontSize: 22,
                cursor: 'pointer', color: '#6b7280',
              }}
            >
              ×
            </button>

            <h3 style={{ margin: '0 0 18px', fontSize: 18 }}>
              Заявка #{selectedRepair.number}
            </h3>

            <div style={{ marginBottom: 12 }}>
              <span style={{ color: '#9ca3af', fontSize: 13 }}>Категория</span>
              <div style={{ fontWeight: 600, marginTop: 2 }}>{selectedRepair.category}</div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <span style={{ color: '#9ca3af', fontSize: 13 }}>Дата подачи</span>
              <div style={{ marginTop: 2 }}>{formatDate(selectedRepair.created_at)}</div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <span style={{ color: '#9ca3af', fontSize: 13 }}>Статус</span>
              <div style={{ marginTop: 4 }}>{statusBadge(selectedRepair.status)}</div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <span style={{ color: '#9ca3af', fontSize: 13 }}>Описание</span>
              <div style={{ marginTop: 2, lineHeight: 1.6 }}>{selectedRepair.description}</div>
            </div>

            {selectedRepair.comment && (
              <div style={{
                background: '#f3f4f6', borderRadius: 8, padding: '10px 14px',
                marginBottom: 12, fontSize: 14,
              }}>
                <span style={{ color: '#6b7280', fontSize: 12 }}>Комментарий администратора</span>
                <div style={{ marginTop: 4 }}>{selectedRepair.comment}</div>
              </div>
            )}

            {selectedRepair.completed_date && (
              <div style={{ color: '#16a34a', fontSize: 13, marginBottom: 8 }}>
                Выполнено: {formatDate(selectedRepair.completed_date)}
              </div>
            )}

            <button
              onClick={() => setSelectedRepair(null)}
              style={{
                marginTop: 8, background: '#f3f4f6', border: 'none',
                borderRadius: 8, padding: '8px 20px', fontSize: 14,
                cursor: 'pointer', color: '#374151', fontWeight: 600,
              }}
            >
              Закрыть
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
