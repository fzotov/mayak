import { useTenant } from './useTenant'
import { Card, Title, Row, Badge, Loading, money, date, page } from './ui'

const TYPE: Record<string, string> = { COMPANY: 'Юридическое лицо', IP: 'Индивидуальный предприниматель', INDIVIDUAL: 'Физическое лицо' }

export default function TenantContract({ tenantId }: { tenantId: string }) {
  const { tenant: t, loading } = useTenant(tenantId)
  if (loading) return <Loading />
  if (!t) return null
  const days = t.contract_end_date ? Math.ceil((new Date(t.contract_end_date).getTime() - Date.now()) / 86400000) : null
  return (
    <div style={page}>
      <Card>
        <Title right={days === null ? undefined : days <= 0 ? <Badge tone="bad">срок истёк</Badge> : days <= 60 ? <Badge tone="warn">осталось {days} дн.</Badge> : <Badge tone="ok">действует</Badge>}>Договор аренды</Title>
        <Row label="Номер" value={t.contract_number ? `№ ${t.contract_number}` : null} />
        <Row label="Начало" value={t.contract_start_date ? date(t.contract_start_date) : null} />
        <Row label="Окончание" value={t.contract_end_date ? date(t.contract_end_date) : null} />
      </Card>
      <Card>
        <Title>Помещение и ставка</Title>
        <Row label="Помещение" value={t.unit_number ? `№ ${t.unit_number}` : null} />
        <Row label="Площадь" value={t.area_actual ? `${t.area_actual} м²` : null} />
        <Row label="Ставка" value={t.rate_per_sqm ? `${Number(t.rate_per_sqm).toLocaleString('ru-RU')} ₽/м²` : null} />
        <Row label="Аренда в месяц" value={t.monthly_rent ? money(t.monthly_rent) : null} />
        {Number(t.cleaning_fee) > 0 && <Row label="Уборка" value={money(t.cleaning_fee)} />}
        {Number(t.monthly_total) > 0 && <Row label="Итого в месяц" value={money(t.monthly_total)} />}
      </Card>
      <Card>
        <Title>Арендатор</Title>
        <Row label="Наименование" value={t.full_name} />
        <Row label="Тип" value={TYPE[t.type]} />
        <Row label="ИНН" value={t.inn} />
        {t.kpp && <Row label="КПП" value={t.kpp} />}
        <Row label="Юридический адрес" value={t.legal_address} />
      </Card>
      <div style={{ fontSize: 13, color: 'var(--text-3)', textAlign: 'center', lineHeight: 1.6 }}>
        Если данные устарели, сообщите в администрацию: +7 (916) 763-02-07
      </div>
    </div>
  )
}
