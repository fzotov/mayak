import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

interface Tenant {
  id: string;
  full_name: string;
  type: string;
  inn: string;
  kpp: string;
  ogrn: string;
  email: string;
  phone: string;
  legal_address: string;
  bank_account: string;
  bik: string;
  bank_name: string;
  status: string;
}

interface TenantProfileProps {
  tenantId: string;
}

const typeLabel = (type: string) => {
  if (type === 'COMPANY') return 'Юрлицо';
  if (type === 'IP') return 'ИП';
  if (type === 'INDIVIDUAL') return 'Физлицо';
  return type;
};

const cardStyle: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 10,
  padding: 20,
  marginBottom: 16,
};

const fieldStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
};

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  color: '#6b7280',
  fontWeight: 500,
};

const valueStyle: React.CSSProperties = {
  fontSize: 14,
  color: '#111827',
};

const inputStyle: React.CSSProperties = {
  fontSize: 14,
  color: '#111827',
  border: '1px solid #d1d5db',
  borderRadius: 6,
  padding: '8px 10px',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
};

export default function TenantProfile({ tenantId }: TenantProfileProps) {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('tenants')
        .select('*')
        .eq('id', tenantId)
        .single();
      if (data) {
        setTenant(data);
        setPhone(data.phone || '');
        setEmail(data.email || '');
      }
      setLoading(false);
    };
    load();
  }, [tenantId]);

  const handleSave = async () => {
    setSaving(true);
    await supabase
      .from('tenants')
      .update({ phone, email })
      .eq('id', tenantId);
    setSaving(false);
    setToast('Изменения сохранены');
    setTimeout(() => setToast(''), 3000);
  };

  if (loading) {
    return <div style={{ padding: 20, color: '#6b7280' }}>Загрузка...</div>;
  }

  if (!tenant) {
    return <div style={{ padding: 20, color: '#ef4444' }}>Арендатор не найден</div>;
  }

  const rekvFields = [
    { label: 'Название / ФИО', value: tenant.full_name },
    { label: 'Тип', value: typeLabel(tenant.type) },
    { label: 'ИНН', value: tenant.inn },
    { label: 'КПП', value: tenant.kpp },
    { label: 'ОГРН', value: tenant.ogrn },
    { label: 'Юридический адрес', value: tenant.legal_address },
    { label: 'Банк', value: tenant.bank_name },
    { label: 'Расчётный счёт', value: tenant.bank_account },
    { label: 'БИК', value: tenant.bik },
  ];

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 16px', fontFamily: 'sans-serif' }}>
      {toast && (
        <div style={{
          position: 'fixed',
          top: 20,
          right: 20,
          background: '#22c55e',
          color: '#fff',
          padding: '10px 18px',
          borderRadius: 8,
          fontSize: 14,
          zIndex: 1000,
          boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
        }}>
          {toast}
        </div>
      )}

      {/* Реквизиты */}
      <div style={cardStyle}>
        <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600, color: '#111827' }}>Реквизиты</h2>
        <div style={{
          background: '#f9fafb',
          borderRadius: 8,
          padding: 16,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '16px 24px',
        }}>
          {rekvFields.map(({ label, value }) => (
            <div key={label} style={fieldStyle}>
              <span style={labelStyle}>{label}</span>
              <span style={valueStyle}>{value || '—'}</span>
            </div>
          ))}
        </div>
        <p style={{ margin: '12px 0 0', fontSize: 12, color: '#9ca3af' }}>
          Для изменения реквизитов обратитесь к администратору
        </p>
      </div>

      {/* Контакты */}
      <div style={cardStyle}>
        <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600, color: '#111827' }}>Контакты</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 24px', marginBottom: 20 }}>
          <div style={fieldStyle}>
            <label style={labelStyle} htmlFor="tp-phone">Телефон</label>
            <input
              id="tp-phone"
              style={inputStyle}
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="+7 (999) 000-00-00"
            />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle} htmlFor="tp-email">Email</label>
            <input
              id="tp-email"
              style={inputStyle}
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="example@mail.com"
            />
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            background: saving ? '#9ca3af' : '#2563eb',
            color: '#fff',
            border: 'none',
            borderRadius: 7,
            padding: '9px 20px',
            fontSize: 14,
            fontWeight: 500,
            cursor: saving ? 'not-allowed' : 'pointer',
          }}
        >
          {saving ? 'Сохранение...' : 'Сохранить изменения'}
        </button>
      </div>
    </div>
  );
}
