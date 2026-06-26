import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

interface Contract {
  id: string;
  number: string;
  start_date: string;
  status: string;
}

interface Invoice {
  id: string;
  number: string;
  period: string;
  total_amount: number;
  status: string;
  created_at: string;
}

interface Props {
  tenantId: string;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const headerStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 100px 110px 80px 110px',
  padding: '8px 16px',
  fontSize: 12,
  fontWeight: 600,
  color: '#6b7280',
  borderBottom: '1px solid #e5e7eb',
  background: '#f9fafb',
};

const rowStyle = (even: boolean): React.CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: '1fr 100px 110px 80px 110px',
  padding: '10px 16px',
  fontSize: 13,
  color: '#111827',
  background: even ? '#f9fafb' : '#fff',
  alignItems: 'center',
  borderBottom: '1px solid #f3f4f6',
});

const btnStyle: React.CSSProperties = {
  fontSize: 12,
  padding: '4px 10px',
  border: '1px solid #d1d5db',
  borderRadius: 6,
  background: '#fff',
  color: '#374151',
  cursor: 'not-allowed',
  opacity: 0.6,
};

export default function TenantDocuments({ tenantId }: Props) {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [{ data: contractsData }, { data: invoicesData }] = await Promise.all([
        supabase
          .from('contracts')
          .select('id, number, start_date, status')
          .eq('tenant_id', tenantId),
        supabase
          .from('invoices')
          .select('id, number, period, total_amount, status, created_at')
          .eq('tenant_id', tenantId)
          .eq('status', 'paid')
          .order('created_at', { ascending: false })
          .limit(24),
      ]);
      setContracts(contractsData ?? []);
      setInvoices(invoicesData ?? []);
      setLoading(false);
    }
    load();
  }, [tenantId]);

  const cardStyle: React.CSSProperties = {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 10,
    padding: 0,
    overflow: 'hidden',
    marginBottom: 16,
  };

  const titleStyle: React.CSSProperties = {
    padding: 16,
    fontSize: 14,
    fontWeight: 600,
    borderBottom: '1px solid #e5e7eb',
    color: '#111827',
  };

  const emptyStyle: React.CSSProperties = {
    padding: '20px 16px',
    fontSize: 13,
    color: '#9ca3af',
    textAlign: 'center',
  };

  if (loading) {
    return <div style={{ padding: 24, color: '#6b7280', fontSize: 13 }}>Загрузка...</div>;
  }

  return (
    <div style={{ padding: 24 }}>
      {/* Contracts */}
      <div style={cardStyle}>
        <div style={titleStyle}>Договоры</div>
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: 600 }}>
            <div style={headerStyle}>
              <span>Название</span>
              <span>Тип</span>
              <span>Дата</span>
              <span>Размер</span>
              <span>Действие</span>
            </div>
            {contracts.length === 0 ? (
              <div style={emptyStyle}>Договоров нет</div>
            ) : (
              contracts.map((c, i) => (
                <div key={c.id} style={rowStyle(i % 2 === 1)}>
                  <span>📋 Договор аренды №{c.number}</span>
                  <span style={{ color: '#6b7280' }}>Договор</span>
                  <span>{formatDate(c.start_date)}</span>
                  <span style={{ color: '#6b7280' }}>—</span>
                  <span>
                    <button
                      style={btnStyle}
                      disabled
                      onClick={() => alert('Файл не загружен')}
                    >
                      Скачать
                    </button>
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Invoices */}
      <div style={cardStyle}>
        <div style={titleStyle}>Счета и акты</div>
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: 600 }}>
            <div style={headerStyle}>
              <span>Название</span>
              <span>Тип</span>
              <span>Дата</span>
              <span>Размер</span>
              <span>Действие</span>
            </div>
            {invoices.length === 0 ? (
              <div style={emptyStyle}>Оплаченных счетов нет</div>
            ) : (
              invoices.map((inv, i) => (
                <div key={inv.id} style={rowStyle(i % 2 === 1)}>
                  <span>📄 Счёт №{inv.number} за {inv.period}</span>
                  <span style={{ color: '#6b7280' }}>Счёт</span>
                  <span>{formatDate(inv.created_at)}</span>
                  <span style={{ color: '#6b7280' }}>—</span>
                  <span>
                    <button style={btnStyle} disabled>
                      Скачать PDF
                    </button>
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Other */}
      <div style={cardStyle}>
        <div style={titleStyle}>Прочее</div>
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: 600 }}>
            <div style={headerStyle}>
              <span>Название</span>
              <span>Тип</span>
              <span>Дата</span>
              <span>Размер</span>
              <span>Действие</span>
            </div>
            <div style={rowStyle(false)}>
              <span>📃 Правила внутреннего распорядка</span>
              <span style={{ color: '#6b7280' }}>Документ</span>
              <span>01.01.2025</span>
              <span style={{ color: '#6b7280' }}>—</span>
              <span>
                <button style={btnStyle} disabled>
                  Скачать
                </button>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
