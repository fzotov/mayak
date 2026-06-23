import { useState, useEffect } from 'react'
import { getTenants, getInvoices } from './supabase'

export function useRealTenants() {
  const [tenants, setTenants] = useState<any[]>([])
  useEffect(() => {
    getTenants().then(data => {
      {
        const mapped = data.map((t: any) => ({
          ...t,
          fullName: t.full_name,
          leaseStatus: t.status,
          unit: t.units?.[0]?.number || '—',
        }))
        setTenants(mapped)
      }
    })
  }, [])
  return tenants
}

export function useRealInvoices() {
  const [invoices, setInvoices] = useState<any[]>([])
  useEffect(() => {
    getInvoices().then(data => {
      {
        const mapped = data.map((inv: any) => ({
          ...inv,
          total: inv.total_amount,
          lease: {
            tenant: { fullName: inv.tenants?.full_name || '—' },
            unit: { number: inv.units?.number || '—' }
          },
          periodStart: inv.period,
          dueDate: inv.due_date,
        }))
        setInvoices(mapped)
      }
    })
  }, [])
  return invoices
}
