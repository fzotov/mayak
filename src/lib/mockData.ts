export const mockStats = {
  totalUnits: 60,
  occupiedUnits: 52,
  vacantUnits: 8,
  occupancyRate: 87,
  totalMonthlyRevenue: 1248400,
  overdueInvoicesCount: 4,
  overdueInvoicesTotal: 77900,
  openRequestsCount: 7,
  expiringLeasesCount: 3,
}

export const mockTasks = [
  { id: '1', title: 'Task 1 - Send invoices', source: 'OWNER', priority: 'CRITICAL', dueDate: '2025-06-09', status: 'OPEN', unitNumber: null, tenantName: null },
  { id: '2', title: 'Task 2 - Inspection', source: 'OWNER', priority: 'HIGH', dueDate: '2025-06-09', status: 'IN_PROGRESS', unitNumber: null, tenantName: null },
  { id: '3', title: 'Task 3 - Meter readings', source: 'SYSTEM', priority: 'NORMAL', dueDate: '2025-06-09', status: 'OPEN', unitNumber: null, tenantName: null },
  { id: '4', title: 'Task 4 - Check requests', source: 'EMPLOYEE', priority: 'NORMAL', dueDate: '2025-06-09', status: 'IN_PROGRESS', unitNumber: null, tenantName: null },
]

export const mockOverdue = [
  { id: '1', number: '2024-0018', total: 22800, daysOverdue: 32, lease: { tenant: { fullName: 'IP Frolova E.V.' }, unit: { number: '203' } } },
  { id: '2', number: '2024-0024', total: 41400, daysOverdue: 28, lease: { tenant: { fullName: 'OOO Consult' }, unit: { number: '208' } } },
  { id: '3', number: '2024-0031', total: 13700, daysOverdue: 15, lease: { tenant: { fullName: 'OOO Reklama' }, unit: { number: '226' } } },
]

export const mockEvents = [
  { id: '1', title: 'Lease expires - OOO StroyProject', eventDate: '2025-06-10', eventType: 'lease_expiry' },
  { id: '2', title: 'Meter check - office 204', eventDate: '2025-06-15', eventType: 'meter_verification' },
  { id: '3', title: 'Planned maintenance - ventilation', eventDate: '2025-06-20', eventType: 'maintenance' },
  { id: '4', title: 'Lease expires - IP Smirnov (102)', eventDate: '2025-06-30', eventType: 'lease_expiry' },
]

export const mockInvoices = [
  { id: '1', number: '2024-0018', total: 22800, status: 'OVERDUE', periodStart: '2025-05-01', dueDate: '2025-06-01', lease: { tenant: { fullName: 'IP Frolova E.V.' }, unit: { number: '203' } } },
  { id: '2', number: '2024-0024', total: 41400, status: 'OVERDUE', periodStart: '2025-05-01', dueDate: '2025-06-01', lease: { tenant: { fullName: 'OOO Consult' }, unit: { number: '208' } } },
  { id: '3', number: '2024-0041', total: 36000, status: 'SENT', periodStart: '2025-06-01', dueDate: '2025-06-10', lease: { tenant: { fullName: 'OOO Mayak-Service' }, unit: { number: '201' } } },
  { id: '4', number: '2024-0042', total: 18700, status: 'DRAFT', periodStart: '2025-06-01', dueDate: null, lease: { tenant: { fullName: 'IP Zakharov' }, unit: { number: '205' } } },
  { id: '5', number: '2024-0039', total: 20500, status: 'PAID', periodStart: '2025-06-01', dueDate: '2025-06-05', lease: { tenant: { fullName: 'OOO Techcenter' }, unit: { number: '204' } } },
]

export const mockTenants = [
  { id: '1', fullName: 'OOO Mayak-Service', type: 'COMPANY', inn: '7701234567', email: 'info@mayak.ru', phone: '+7 916 111-11-11', unitNumber: '201', leaseStatus: 'ACTIVE', leaseEnd: '31.08.2025' },
  { id: '2', fullName: 'IP Frolova E.V.', type: 'IP', inn: '771234567890', email: 'frolova@mail.ru', phone: '+7 916 222-22-22', unitNumber: '203', leaseStatus: 'DEBT', leaseEnd: '30.04.2025' },
  { id: '3', fullName: 'OOO Techcenter', type: 'COMPANY', inn: '7703456789', email: 'tech@techcenter.ru', phone: '+7 916 333-33-33', unitNumber: '204', leaseStatus: 'ACTIVE', leaseEnd: '31.12.2025' },
  { id: '4', fullName: 'IP Zakharov', type: 'IP', inn: '772345678901', email: 'zakharov@gmail.com', phone: '+7 916 444-44-44', unitNumber: '205', leaseStatus: 'EXPIRING', leaseEnd: '30.06.2025' },
  { id: '5', fullName: 'Ivanova A.S.', type: 'INDIVIDUAL', inn: null, email: 'ivanova@yandex.ru', phone: '+7 916 555-55-55', unitNumber: '106', leaseStatus: 'ACTIVE', leaseEnd: '28.02.2026' },
]
