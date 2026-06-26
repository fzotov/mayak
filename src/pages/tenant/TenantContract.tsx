import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

interface Contract {
  id: string;
  number: string;
  type: string;
  status: string;
  tenant_id: string;
  unit_id: string;
  start_date: string;
  end_date: string;
  rent_amount: number;
  deposit: number;
  notes: string | null;
}

interface Unit {
  id: string;
  number: string;
  floor: number;
  area: number;
  type: string;
  has_window: boolean;
  rooms_count: number;
  description: string | null;
}

interface Props {
  tenantId: string;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
}

function daysRemaining(endDate: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);
  return Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

const cardStyle: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 10,
  padding: 20,
  marginBottom: 16,
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 600,
  color: '#374151',
  marginBottom: 14,
  marginTop: 0,
};

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  color: '#6b7280',
  marginBottom: 2,
};

const valueStyle: React.CSSProperties = {
  fontSize: 14,
  color: '#111827',
  fontWeight: 500,
};

function InfoField({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div style={labelStyle}>{label}</div>
      <div style={valueStyle}>{value}</div>
    </div>
  );
}

export default function TenantContract({ tenantId }: Props) {
  const [contract, setContract] = useState<Contract | null>(null);
  const [unit, setUnit] = useState<Unit | null>(null);
  const [loading, setLoading] = useState(true);
  const [tooltipVisible, setTooltipVisible] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data: contractData } = await supabase
        .from('contracts')
        .select('*')
        .eq('tenant_id', tenantId)
        .limit(1)
        .maybeSingle();

      if (!contractData) {
        setLoading(false);
        return;
      }

      setContract(contractData);

      const { data: unitData } = await supabase
        .from('units')
        .select('*')
        .eq('id', contractData.unit_id)
        .maybeSingle();

      setUnit(unitData ?? null);
      setLoading(false);
    }

    load();
  }, [tenantId]);

  if (loading) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: '#6b7280' }}>
        Загрузка...
      </div>
    );
  }

  if (!contract) {
    return (
      <div
        style={{
          padding: 48,
          textAlign: 'center',
          color: '#6b7280',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <span style={{ fontSize: 48 }}>📄</span>
        <div style={{ fontSize: 16, fontWeight: 500 }}>Договор не найден</div>
      </div>
    );
  }

  const statusBadge = () => {
    if (contract.status === 'active') {
      return (
        <span
          style={{
            background: '#d1fae5',
            color: '#065f46',
            borderRadius: 6,
            padding: '2px 10px',
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          Активен
        </span>
      );
    }
    if (contract.status === 'expired') {
      return (
        <span
          style={{
            background: '#fee2e2',
            color: '#991b1b',
            borderRadius: 6,
            padding: '2px 10px',
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          Истёк
        </span>
      );
    }
    return (
      <span
        style={{
          background: '#f3f4f6',
          color: '#374151',
          borderRadius: 6,
          padding: '2px 10px',
          fontSize: 13,
          fontWeight: 500,
        }}
      >
        Черновик
      </span>
    );
  };

  const days = contract.status === 'active' ? daysRemaining(contract.end_date) : null;

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 16px' }}>
      {/* Header card */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#111827' }}>
            Договор №{contract.number}
          </h2>
          {statusBadge()}
          {days !== null && (
            <span style={{ fontSize: 13, color: '#6b7280', marginLeft: 4 }}>
              До окончания: {days} дней
            </span>
          )}
        </div>

        {days !== null && days < 30 && (
          <div
            style={{
              marginTop: 14,
              background: '#fff7ed',
              border: '1px solid #fb923c',
              borderRadius: 8,
              padding: '10px 14px',
              color: '#9a3412',
              fontSize: 13,
            }}
          >
            ⚠️ Договор истекает менее чем через 30 дней. Пожалуйста, свяжитесь с управляющим для продления.
          </div>
        )}
      </div>

      {/* Unit section */}
      {unit && (
        <div style={cardStyle}>
          <p style={sectionTitleStyle}>Помещение</p>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '14px 20px',
            }}
          >
            <InfoField label="Номер офиса" value={unit.number} />
            <InfoField label="Этаж" value={unit.floor} />
            <InfoField label="Площадь" value={`${unit.area} м²`} />
            <InfoField label="Тип помещения" value={unit.type} />
            <InfoField label="Наличие окон" value={unit.has_window ? 'Есть' : 'Нет'} />
            <InfoField label="Количество комнат" value={unit.rooms_count} />
          </div>
        </div>
      )}

      {/* Contract terms section */}
      <div style={cardStyle}>
        <p style={sectionTitleStyle}>Условия договора</p>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '14px 20px',
          }}
        >
          <InfoField label="Дата начала" value={formatDate(contract.start_date)} />
          <InfoField label="Дата окончания" value={formatDate(contract.end_date)} />
          <InfoField
            label="Арендная ставка"
            value={`${contract.rent_amount.toLocaleString('ru')} ₽/мес`}
          />
          <InfoField
            label="Депозит"
            value={`${contract.deposit.toLocaleString('ru')} ₽`}
          />
        </div>
      </div>

      {/* Notes */}
      {contract.notes && (
        <div style={cardStyle}>
          <p style={sectionTitleStyle}>Примечания</p>
          <p style={{ margin: 0, fontSize: 14, color: '#374151', lineHeight: 1.6 }}>
            {contract.notes}
          </p>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <button
            disabled
            onMouseEnter={() => setTooltipVisible(true)}
            onMouseLeave={() => setTooltipVisible(false)}
            style={{
              padding: '10px 18px',
              borderRadius: 8,
              border: '1px solid #d1d5db',
              background: '#f9fafb',
              color: '#9ca3af',
              fontSize: 14,
              cursor: 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            📄 Скачать договор PDF
          </button>
          {tooltipVisible && (
            <div
              style={{
                position: 'absolute',
                bottom: 'calc(100% + 6px)',
                left: '50%',
                transform: 'translateX(-50%)',
                background: '#1f2937',
                color: '#fff',
                fontSize: 12,
                borderRadius: 6,
                padding: '5px 10px',
                whiteSpace: 'nowrap',
                pointerEvents: 'none',
                zIndex: 10,
              }}
            >
              Функция в разработке
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
