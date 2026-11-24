// Учётное ядро: типы и вызовы функций базы (supabase/migrations/20261125_accounting_core.sql).
// Все проведения идут через функции базы — напрямую в финансовые таблицы не пишем.
import { supabase } from './supabase'

export interface Article { code: string; name: string; grp: string; register: 'receivable' | 'deposit'; priority: number; keywords: string[]; vat_rate: number | null; onec_account: string | null; onec_item: string | null; active: boolean }
export interface Lease { id: string; tenant_id: string; number: string | null; start_date: string | null; end_date: string | null; status: 'draft' | 'active' | 'closed'; payment_day: number; deposit_required: number; billing_mode: 'split' | 'single'; penalty_enabled: boolean; penalty_rate: number; notes: string | null }
export interface LeaseLine { id: string; lease_id: string; article_code: string; unit_id: string | null; unit_label: string | null; area: number | null; rate_per_sqm: number | null; amount: number; valid_from: string; valid_to: string | null; note: string | null }
export interface ChargeState { id: string; tenant_id: string; lease_id: string | null; article_code: string; article_name: string; grp: string; register: string; date: string; period: string | null; due_date: string; description: string | null; invoice_id: string | null; source: string; amount: number; effective_amount: number; reversed: boolean; paid: number; open_amount: number; days_overdue: number }
export interface PaymentState { id: string; tenant_id: string; date: string; amount: number; direction: 'in' | 'out'; source: string; purpose: string | null; reversed: boolean; allocated: number; free_amount: number }
export interface TurnoverRow { tenant_id: string; tenant_name: string; register: 'receivable' | 'deposit' | 'advance'; article_code: string | null; article_name: string | null; grp: string | null; lease_id: string | null; opening: number; debit: number; credit: number; closing: number }
export interface DepositRow { lease_id: string; tenant_id: string; tenant_name: string; number: string | null; status: string; deposit_required: number; requested: number; held: number; shortfall: number }
export interface DocRow { tenant_id: string; date: string; created_at: string; doc_type: string; doc_id: string; article_code: string | null; article_name: string | null; lease_id: string | null; description: string | null; charged: number; paid: number; invoice_id: string | null; ref_id: string | null; register: string }
export interface InvoiceState { id: string; tenant_id: string; lease_id: string | null; kind: string; number: string; date: string; period: string; due_date: string; issue_status: string; tenant_name: string; total: number; paid: number; open_amount: number; pay_status: string }
export interface BillingLine { tenant_id: string; tenant_name: string; lease_id: string | null; article_code: string; amount: number; due_date: string; description: string; basis: any; billing_key: string; kind: string; already: boolean }

/** Вызов функции базы; ошибка базы превращается в понятное исключение. */
export async function rpc<T = any>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) throw new Error(error.message.replace(/^.*?ERROR:\s*/, ''))
  return data as T
}

export async function loadArticles(): Promise<Article[]> {
  const { data, error } = await supabase.from('accounting_articles').select('*').order('priority')
  if (error) throw new Error(error.message)
  return (data || []) as Article[]
}

export const PAY_STATUS: Record<string, { label: string; tone: 'green' | 'red' | 'amber' | 'blue' | 'neutral' }> = {
  paid: { label: 'Оплачен', tone: 'green' },
  partial: { label: 'Оплачен частично', tone: 'amber' },
  partial_overdue: { label: 'Частично, просрочен', tone: 'red' },
  overdue: { label: 'Просрочен', tone: 'red' },
  unpaid: { label: 'Ожидает оплаты', tone: 'blue' },
}

export const INVOICE_KIND: Record<string, string> = {
  rent: 'Аренда и услуги', utilities: 'Коммунальные', combined: 'Общий', deposit: 'Депозит', one_off: 'Разовый',
}

export const DOC_TYPE: Record<string, string> = {
  charge: 'Начисление', payment: 'Оплата', payment_storno: 'Сторно оплаты', refund: 'Возврат',
  deposit_offset: 'Зачёт депозита', deposit_refund: 'Возврат депозита',
}

/** Сводка по арендатору из оборотов: долг по статьям, аванс, депозит. */
export function summarize(rows: TurnoverRow[]) {
  const debt = rows.filter(r => r.register === 'receivable').reduce((s, r) => s + Number(r.closing), 0)
  const advance = rows.filter(r => r.register === 'advance').reduce((s, r) => s + Number(r.closing), 0)
  const deposit = rows.filter(r => r.register === 'deposit').reduce((s, r) => s + Number(r.closing), 0)
  const charged = rows.filter(r => r.register === 'receivable').reduce((s, r) => s + Number(r.debit), 0)
  const paidOff = rows.filter(r => r.register === 'receivable').reduce((s, r) => s + Number(r.credit), 0)
  const openingDebt = rows.filter(r => r.register === 'receivable').reduce((s, r) => s + Number(r.opening), 0)
  const openingAdv = rows.filter(r => r.register === 'advance').reduce((s, r) => s + Number(r.opening), 0)
  return { debt, advance, deposit, charged, paidOff, opening: openingDebt - openingAdv, balance: debt - advance }
}
