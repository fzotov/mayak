-- ─────────────────────────────────────────────────────────────────────────────
-- Этап 5 ТЗ v2: сальдо арендаторов для списка и экрана «Должники».
-- Выполнять после 20261126_bank.sql. Можно повторно.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.tenant_saldo()
returns table (tenant_id uuid, tenant_name text, inn text, email text, debt numeric, advance numeric, deposit numeric, balance numeric,
               overdue numeric, max_days_overdue int, oldest_due date, last_payment_date date, last_payment_amount numeric, articles jsonb)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public._acc_guard();
  return query
  with reg as (
    select p.tenant_id,
           coalesce(sum(p.debit - p.credit) filter (where p.register = 'receivable'), 0) as debt,
           coalesce(sum(p.debit - p.credit) filter (where p.register = 'advance'), 0) as advance,
           coalesce(sum(p.debit - p.credit) filter (where p.register = 'deposit'), 0) as deposit
    from public.ledger_postings p group by p.tenant_id
  ), od as (
    select cs.tenant_id, sum(cs.open_amount) filter (where cs.due_date < current_date) as overdue,
           max(cs.days_overdue) as max_days, min(cs.due_date) filter (where cs.due_date < current_date) as oldest
    from public.v_charge_state cs where cs.open_amount > 0 and cs.register = 'receivable' group by cs.tenant_id
  ), art as (
    select x.tenant_id, jsonb_agg(jsonb_build_object('code', x.article_code, 'name', a.name, 'debt', x.amt) order by a.priority) as articles
    from (select p.tenant_id, p.article_code, sum(p.debit - p.credit) as amt from public.ledger_postings p
          where p.register = 'receivable' group by 1, 2 having sum(p.debit - p.credit) <> 0) x
    join public.accounting_articles a on a.code = x.article_code group by x.tenant_id
  ), lp as (
    select distinct on (pm.tenant_id) pm.tenant_id, pm.date, pm.amount from public.payments pm
    where pm.direction = 'in' and pm.storno_of is null and pm.source <> 'opening'
      and not exists (select 1 from public.payments s where s.storno_of = pm.id)
    order by pm.tenant_id, pm.date desc, pm.created_at desc
  )
  select t.id, t.full_name, t.inn, coalesce(nullif(t.email, ''), nullif(t.contact_email, '')),
         reg.debt, reg.advance, reg.deposit, reg.debt - reg.advance,
         coalesce(od.overdue, 0), coalesce(od.max_days, 0), od.oldest, lp.date, lp.amount, coalesce(art.articles, '[]'::jsonb)
  from reg join public.tenants t on t.id = reg.tenant_id
  left join od on od.tenant_id = reg.tenant_id
  left join art on art.tenant_id = reg.tenant_id
  left join lp on lp.tenant_id = reg.tenant_id
  order by reg.debt - reg.advance desc;
end $$;

revoke all on function public.tenant_saldo() from public, anon;
grant execute on function public.tenant_saldo() to authenticated, service_role;
