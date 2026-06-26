import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

interface Meter {
  id: string;
  tenant_id: string;
  unit_id: string;
  type: 'electricity' | 'cold_water' | 'hot_water';
  serial: string;
  tariff: number;
}

interface MeterReading {
  id: string;
  meter_id: string;
  reading: number;
  previous_reading: number | null;
  consumption: number | null;
  amount: number | null;
  reading_date: string;
  created_at: string;
}

const TYPE_LABELS: Record<string, string> = {
  electricity: 'Электричество',
  cold_water: 'Холодная вода',
  hot_water: 'Горячая вода',
};

const TYPE_UNITS: Record<string, string> = {
  electricity: 'кВт·ч',
  cold_water: 'м³',
  hot_water: 'м³',
};

const TYPE_ICONS: Record<string, string> = {
  electricity: '⚡',
  cold_water: '💧',
  hot_water: '🔥',
};

interface ReadingForm {
  value: string;
  success: boolean;
  error: string;
}

interface Props {
  tenantId: string;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

export default function TenantMeters({ tenantId }: Props) {
  const [meters, setMeters] = useState<Meter[]>([]);
  const [readings, setReadings] = useState<Record<string, MeterReading[]>>({});
  const [loading, setLoading] = useState(true);
  const [readingForms, setReadingForms] = useState<Record<string, ReadingForm>>({});

  useEffect(() => {
    loadData();
  }, [tenantId]);

  async function loadData() {
    setLoading(true);
    const { data: metersData, error } = await supabase
      .from('meters')
      .select('*')
      .eq('tenant_id', tenantId);

    if (error || !metersData) {
      setLoading(false);
      return;
    }

    setMeters(metersData);

    const forms: Record<string, ReadingForm> = {};
    const allReadings: Record<string, MeterReading[]> = {};

    await Promise.all(
      metersData.map(async (meter: Meter) => {
        forms[meter.id] = { value: '', success: false, error: '' };
        const { data: rData } = await supabase
          .from('meter_readings')
          .select('*')
          .eq('meter_id', meter.id)
          .order('reading_date', { ascending: false })
          .limit(6);
        allReadings[meter.id] = rData || [];
      })
    );

    setReadings(allReadings);
    setReadingForms(forms);
    setLoading(false);
  }

  function updateForm(meterId: string, patch: Partial<ReadingForm>) {
    setReadingForms(prev => ({
      ...prev,
      [meterId]: { ...prev[meterId], ...patch },
    }));
  }

  async function handleSubmit(meter: Meter) {
    const form = readingForms[meter.id];
    const value = parseFloat(form.value);
    const meterReadings = readings[meter.id] || [];
    const lastReading = meterReadings[0];
    const previousReading = lastReading ? lastReading.reading : 0;

    if (isNaN(value)) {
      updateForm(meter.id, { error: 'Введите корректное значение' });
      return;
    }

    if (value < previousReading) {
      updateForm(meter.id, {
        error: `Показание не может быть меньше предыдущего (${previousReading})`,
      });
      return;
    }

    const today = new Date().toISOString().split('T')[0];

    const { error } = await supabase.from('meter_readings').insert({
      meter_id: meter.id,
      reading: value,
      reading_date: today,
    });

    if (error) {
      updateForm(meter.id, { error: 'Ошибка при сохранении показания' });
      return;
    }

    const unit = TYPE_UNITS[meter.type];
    updateForm(meter.id, {
      value: '',
      success: true,
      error: `Показание ${value} ${unit} успешно передано`,
    });

    // Reload readings for this meter
    const { data: rData } = await supabase
      .from('meter_readings')
      .select('*')
      .eq('meter_id', meter.id)
      .order('reading_date', { ascending: false })
      .limit(6);

    setReadings(prev => ({ ...prev, [meter.id]: rData || [] }));
  }

  if (loading) {
    return <div style={{ padding: 20, color: '#6b7280' }}>Загрузка счётчиков...</div>;
  }

  if (meters.length === 0) {
    return (
      <div
        style={{
          padding: 32,
          textAlign: 'center',
          color: '#6b7280',
          background: '#fff',
          border: '1px solid #e5e7eb',
          borderRadius: 10,
        }}
      >
        Счётчики не подключены. Обратитесь к администратору.
      </div>
    );
  }

  return (
    <div>
      {meters.map(meter => {
        const meterReadings = readings[meter.id] || [];
        const lastReading = meterReadings[0];
        const unit = TYPE_UNITS[meter.type];
        const icon = TYPE_ICONS[meter.type];
        const label = TYPE_LABELS[meter.type];
        const form = readingForms[meter.id] || { value: '', success: false, error: '' };
        const minValue = lastReading ? lastReading.reading : 0;

        return (
          <div
            key={meter.id}
            style={{
              background: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: 10,
              padding: 20,
              marginBottom: 16,
            }}
          >
            {/* Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                marginBottom: 16,
              }}
            >
              <span style={{ fontSize: 24 }}>{icon}</span>
              <div>
                <div style={{ fontWeight: 600, fontSize: 16, color: '#111827' }}>
                  {label}
                </div>
                <div style={{ fontSize: 13, color: '#6b7280' }}>
                  № {meter.serial} · Тариф: {meter.tariff} ₽/{unit}
                </div>
              </div>
            </div>

            {/* Last reading */}
            {lastReading && (
              <div
                style={{
                  background: '#f9fafb',
                  borderRadius: 8,
                  padding: '10px 14px',
                  marginBottom: 16,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span style={{ color: '#6b7280', fontSize: 13 }}>Последнее показание:</span>
                <span style={{ fontWeight: 600, color: '#111827' }}>
                  {lastReading.reading} {unit}
                </span>
                <span style={{ color: '#9ca3af', fontSize: 13 }}>
                  от {formatDate(lastReading.reading_date)}
                </span>
              </div>
            )}

            {/* Submit form */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 500, fontSize: 14, color: '#374151', marginBottom: 10 }}>
                Передать показания
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div>
                  <label
                    style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}
                  >
                    Текущее показание ({unit})
                  </label>
                  <input
                    type="number"
                    min={minValue}
                    step="any"
                    value={form.value}
                    onChange={e => updateForm(meter.id, { value: e.target.value, success: false, error: '' })}
                    placeholder={`мин. ${minValue}`}
                    style={{
                      border: '1px solid #d1d5db',
                      borderRadius: 6,
                      padding: '7px 12px',
                      fontSize: 14,
                      width: 160,
                      outline: 'none',
                    }}
                  />
                </div>
                <div>
                  <label
                    style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}
                  >
                    Фото показания (необязательно)
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    style={{
                      fontSize: 13,
                      color: '#374151',
                    }}
                  />
                </div>
                <button
                  onClick={() => handleSubmit(meter)}
                  style={{
                    background: '#2563eb',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 6,
                    padding: '8px 16px',
                    fontSize: 14,
                    fontWeight: 500,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Передать показания
                </button>
              </div>

              {form.error && !form.success && (
                <div style={{ marginTop: 8, fontSize: 13, color: '#dc2626' }}>{form.error}</div>
              )}
              {form.success && form.error && (
                <div style={{ marginTop: 8, fontSize: 13, color: '#16a34a' }}>{form.error}</div>
              )}
            </div>

            {/* History table */}
            {meterReadings.length > 0 && (
              <div style={{ overflowX: 'auto' }}>
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: 13,
                  }}
                >
                  <thead>
                    <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                      {['Дата', 'Предыдущее', 'Текущее', 'Расход', 'Сумма'].map(col => (
                        <th
                          key={col}
                          style={{
                            textAlign: 'left',
                            padding: '6px 10px',
                            color: '#6b7280',
                            fontWeight: 500,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {meterReadings.map(r => (
                      <tr key={r.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '6px 10px', color: '#374151' }}>
                          {formatDate(r.reading_date)}
                        </td>
                        <td style={{ padding: '6px 10px', color: '#374151' }}>
                          {r.previous_reading != null ? `${r.previous_reading} ${unit}` : '—'}
                        </td>
                        <td style={{ padding: '6px 10px', color: '#111827', fontWeight: 500 }}>
                          {r.reading} {unit}
                        </td>
                        <td style={{ padding: '6px 10px', color: '#374151' }}>
                          {r.consumption != null ? `${r.consumption} ${unit}` : '—'}
                        </td>
                        <td style={{ padding: '6px 10px', color: '#374151' }}>
                          {r.amount != null ? `${r.amount.toLocaleString('ru-RU')} ₽` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
