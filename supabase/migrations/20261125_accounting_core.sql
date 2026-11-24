-- ─────────────────────────────────────────────────────────────────────────────
-- Этап 2 ТЗ v2: учётное ядро.
-- Документы (начисления, оплаты, разнесения, операции с депозитом) пишут
-- движения в регистр ledger_postings. Остатки не хранятся — это суммы движений.
-- Регистры: receivable (расчёты по статьям), deposit (депозиты по договорам),
-- advance (авансы — деньги арендатора, ещё ни к чему не отнесённые).
-- Писать в финансовые таблицы можно только функциями ниже; напрямую — нет.
-- Выполнять после 20261124_roles.sql. Скрипт можно выполнять повторно.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Справочник статей ───────────────────────────────────────────────────────
create table if not exists public.accounting_articles (
  code         text primary key,
  name         text not null,
  grp          text not null,
  register     text not null default 'receivable' check (register in ('receivable', 'deposit')),
  priority     int  not null default 100,
  keywords     text[] not null default '{}',
  vat_rate     numeric(5,2),
  onec_account text,
  onec_item    text,
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

insert into public.accounting_articles (code, name, grp, register, priority, keywords) values
  ('OPENING',    'Входящий остаток из 1С без разбивки', 'Прочее',       'receivable', 10, '{}'),
  ('RENT',       'Аренда помещения',                    'Аренда',       'receivable', 20, '{аренд}'),
  ('DEPOSIT',    'Обеспечительный платёж',              'Депозит',      'deposit',    25, '{обеспечит,депозит,залог}'),
  ('ELEC',       'Электроэнергия',                      'Коммунальные', 'receivable', 30, '{электр,квт}'),
  ('CWATER',     'Холодная вода',                       'Коммунальные', 'receivable', 31, '{холодн,хвс}'),
  ('HWATER',     'Горячая вода',                        'Коммунальные', 'receivable', 32, '{горяч,гвс}'),
  ('HEAT',       'Тепло',                               'Коммунальные', 'receivable', 33, '{тепл,отоплен}'),
  ('UTIL_OTHER', 'Вывоз мусора и прочее возмещение',    'Коммунальные', 'receivable', 34, '{мусор,возмещ,коммунал}'),
  ('CLEAN',      'Уборка',                              'Услуги',       'receivable', 40, '{уборк}'),
  ('SERVICE',    'Разовые услуги',                      'Услуги',       'receivable', 41, '{услуг}'),
  ('AD_STELE',   'Рекламная стела',                     'Реклама',      'receivable', 50, '{стел}'),
  ('AD_OTHER',   'Прочая реклама',                      'Реклама',      'receivable', 51, '{реклам,фасад,рамк}'),
  ('PENALTY',    'Пени',                                'Санкции',      'receivable', 60, '{пени,неустойк}'),
  ('FINE',       'Штрафы по договору',                  'Санкции',      'receivable', 61, '{штраф}'),
  ('OTHER',      'Прочие начисления',                   'Прочее',       'receivable', 70, '{}')
on conflict (code) do nothing;

-- ── Договоры ────────────────────────────────────────────────────────────────
-- leases — единственная таблица договоров. Старые поля rent/deposit/deposit_paid/unit_id
-- остаются для совместимости, расчёт идёт по lease_lines.
alter table public.leases add column if not exists number           text;
alter table public.leases add column if not exists payment_day      int not null default 5;
alter table public.leases add column if not exists deposit_required numeric(14,2) not null default 0;
alter table public.leases add column if not exists billing_mode     text not null default 'split';
alter table public.leases add column if not exists penalty_enabled  boolean not null default false;
alter table public.leases add column if not exists penalty_rate     numeric(8,4) not null default 0;  -- % в день
alter table public.leases add column if not exists notes            text;
alter table public.leases add column if not exists updated_at       timestamptz;
alter table public.leases alter column status set default 'active';
update public.leases set status = lower(status) where status <> lower(status);
alter table public.leases drop constraint if exists leases_status_check;
alter table public.leases add constraint leases_status_check check (status in ('draft', 'active', 'closed'));
alter table public.leases drop constraint if exists leases_billing_mode_check;
alter table public.leases add constraint leases_billing_mode_check check (billing_mode in ('split', 'single'));
alter table public.leases drop constraint if exists leases_payment_day_check;
alter table public.leases add constraint leases_payment_day_check check (payment_day between 1 and 28);
create index if not exists leases_tenant_idx on public.leases (tenant_id);

-- Строки договора: помещения со ставкой и прочие ежемесячные начисления (уборка, реклама).
-- История ставок — новой строкой с новым valid_from и закрытием старой valid_to.
create table if not exists public.lease_lines (
  id           uuid primary key default gen_random_uuid(),
  lease_id     uuid not null references public.leases (id) on delete cascade,
  article_code text not null references public.accounting_articles (code),
  unit_id      uuid references public.units (id) on delete set null,
  unit_label   text,
  area         numeric(10,2),
  rate_per_sqm numeric(14,2),
  amount       numeric(14,2) not null check (amount >= 0),   -- в месяц
  valid_from   date not null,
  valid_to     date,
  note         text,
  created_at   timestamptz not null default now(),
  check (valid_to is null or valid_to >= valid_from)
);
create index if not exists lease_lines_lease_idx on public.lease_lines (lease_id);

-- ── Документы ───────────────────────────────────────────────────────────────
alter table public.invoices add column if not exists lease_id    uuid references public.leases (id);
alter table public.invoices add column if not exists kind        text;
alter table public.invoices add column if not exists date        date;
alter table public.invoices add column if not exists pdf_path    text;
alter table public.invoices add column if not exists billing_key text;
create unique index if not exists invoices_billing_key_uq on public.invoices (billing_key);
create unique index if not exists invoices_number_uq on public.invoices (number) where number is not null;

create table if not exists public.charges (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants (id),
  lease_id     uuid references public.leases (id),
  article_code text not null references public.accounting_articles (code),
  date         date not null default current_date,
  period       date,
  amount       numeric(14,2) not null check (amount <> 0),
  due_date     date not null,
  description  text,
  basis        jsonb,
  invoice_id   uuid references public.invoices (id),
  storno_of    uuid unique references public.charges (id),
  source       text not null default 'manual' check (source in ('billing', 'manual', 'opening', 'storno', 'deposit')),
  billing_key  text unique,
  created_by   uuid default auth.uid(),
  created_at   timestamptz not null default now(),
  check ((storno_of is null) = (amount > 0))
);
create index if not exists charges_tenant_idx on public.charges (tenant_id);
create index if not exists charges_invoice_idx on public.charges (invoice_id);

alter table public.payments add column if not exists direction  text not null default 'in';
alter table public.payments add column if not exists source     text not null default 'manual';
alter table public.payments add column if not exists purpose    text;
alter table public.payments add column if not exists storno_of  uuid references public.payments (id);
alter table public.payments add column if not exists created_by uuid default auth.uid();
do $$ begin
  if (select numeric_precision from information_schema.columns where table_schema = 'public' and table_name = 'payments' and column_name = 'amount') is null then
    alter table public.payments alter column amount type numeric(14,2);
  end if;
end $$;
alter table public.payments alter column tenant_id set not null;
alter table public.payments alter column date set not null;
alter table public.payments alter column amount set not null;
alter table public.payments drop constraint if exists payments_direction_check;
alter table public.payments add constraint payments_direction_check check (direction in ('in', 'out'));
alter table public.payments drop constraint if exists payments_source_check;
alter table public.payments add constraint payments_source_check check (source in ('bank', 'cash', 'opening', 'manual', 'refund', 'storno'));
alter table public.payments drop constraint if exists payments_amount_check;
alter table public.payments add constraint payments_amount_check check (amount > 0);
create unique index if not exists payments_storno_uq on public.payments (storno_of) where storno_of is not null;
-- одна банковская операция зачисляется не больше одного раза
create unique index if not exists payments_bank_tx_uq on public.payments (bank_transaction_id) where bank_transaction_id is not null;
create index if not exists payments_tenant_idx on public.payments (tenant_id);

create table if not exists public.deposit_operations (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenants (id),
  lease_id   uuid not null references public.leases (id),
  kind       text not null check (kind in ('require', 'offset', 'refund')),
  date       date not null default current_date,
  amount     numeric(14,2) not null check (amount > 0),
  reason     text not null check (length(trim(reason)) > 0),
  charge_id  uuid references public.charges (id),
  payment_id uuid references public.payments (id),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

-- Разнесение: сумма из источника (оплата или депозит договора) закрывает цель
-- (начисление или возврат арендатору). Отменяется отметкой, не удалением.
create table if not exists public.allocations (
  id                   uuid primary key default gen_random_uuid(),
  tenant_id            uuid not null references public.tenants (id),
  date                 date not null,
  amount               numeric(14,2) not null check (amount > 0),
  source_payment_id    uuid references public.payments (id),
  source_lease_id      uuid references public.leases (id),
  target_charge_id     uuid references public.charges (id),
  target_payment_id    uuid references public.payments (id),
  deposit_operation_id uuid references public.deposit_operations (id),
  auto                 boolean not null default true,
  cancelled_at         timestamptz,
  cancel_reason        text,
  cancelled_by         uuid,
  created_by           uuid default auth.uid(),
  created_at           timestamptz not null default now(),
  check (num_nonnulls(source_payment_id, source_lease_id) = 1),
  check (num_nonnulls(target_charge_id, target_payment_id) = 1)
);
create index if not exists allocations_src_idx on public.allocations (source_payment_id) where cancelled_at is null;
create index if not exists allocations_tgt_idx on public.allocations (target_charge_id) where cancelled_at is null;
create index if not exists allocations_tenant_idx on public.allocations (tenant_id);

-- ── Регистр и журнал ────────────────────────────────────────────────────────
create table if not exists public.ledger_postings (
  id           bigserial primary key,
  date         date not null,
  tenant_id    uuid not null references public.tenants (id),
  lease_id     uuid references public.leases (id),
  register     text not null check (register in ('receivable', 'deposit', 'advance')),
  article_code text references public.accounting_articles (code),
  period       date,
  debit        numeric(14,2) not null default 0,
  credit       numeric(14,2) not null default 0,
  doc_type     text not null,
  doc_id       uuid not null,
  created_at   timestamptz not null default now(),
  check (debit >= 0 and credit >= 0 and (debit > 0 or credit > 0))
);
create index if not exists ledger_postings_tenant_idx on public.ledger_postings (tenant_id, register, date);
create index if not exists ledger_postings_doc_idx on public.ledger_postings (doc_type, doc_id);

create table if not exists public.audit_log (
  id        bigserial primary key,
  at        timestamptz not null default now(),
  user_id   uuid default auth.uid(),
  action    text not null,
  entity    text not null,
  entity_id uuid,
  data      jsonb
);
create index if not exists audit_log_entity_idx on public.audit_log (entity, entity_id);

-- ── Неизменяемость проведённого ─────────────────────────────────────────────
create or replace function public._acc_immutable() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Проведённые документы не удаляются — только сторно' using errcode = '42501';
  end if;
  if tg_table_name = 'ledger_postings' or tg_table_name = 'audit_log' or tg_table_name = 'deposit_operations' then
    raise exception 'Записи % не изменяются', tg_table_name using errcode = '42501';
  end if;
  if tg_table_name = 'charges' and (to_jsonb(new) - 'invoice_id') <> (to_jsonb(old) - 'invoice_id') then
    raise exception 'В начислении можно поменять только счёт' using errcode = '42501';
  end if;
  if tg_table_name = 'payments' and (to_jsonb(new) - array['note', 'bank_transaction_id']) <> (to_jsonb(old) - array['note', 'bank_transaction_id']) then
    raise exception 'В оплате можно поменять только примечание' using errcode = '42501';
  end if;
  if tg_table_name = 'allocations' and (to_jsonb(old) ->> 'cancelled_at' is not null
      or (to_jsonb(new) - array['cancelled_at', 'cancel_reason', 'cancelled_by']) <> (to_jsonb(old) - array['cancelled_at', 'cancel_reason', 'cancelled_by'])) then
    raise exception 'Разнесение можно только отменить, один раз' using errcode = '42501';
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['ledger_postings', 'audit_log', 'charges', 'payments', 'allocations', 'deposit_operations'] loop
    execute format('drop trigger if exists acc_immutable on public.%I', t);
    execute format('create trigger acc_immutable before update or delete on public.%I for each row execute function public._acc_immutable()', t);
  end loop;
end $$;

-- ── Доступ ──────────────────────────────────────────────────────────────────
alter table public.accounting_articles enable row level security;
alter table public.lease_lines        enable row level security;
alter table public.charges            enable row level security;
alter table public.deposit_operations enable row level security;
alter table public.allocations        enable row level security;
alter table public.ledger_postings    enable row level security;
alter table public.audit_log          enable row level security;

-- справочники и договоры сотрудники правят напрямую
drop policy if exists staff_all on public.accounting_articles;
create policy staff_all on public.accounting_articles for all to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists staff_all on public.lease_lines;
create policy staff_all on public.lease_lines for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- финансовые документы сотрудники только читают; пишут функции
do $$
declare t text;
begin
  foreach t in array array['charges', 'payments', 'invoices', 'allocations', 'deposit_operations', 'ledger_postings', 'audit_log'] loop
    execute format('drop policy if exists staff_all on public.%I', t);
    execute format('drop policy if exists staff_read on public.%I', t);
    execute format('create policy staff_read on public.%I for select to authenticated using (public.is_staff())', t);
  end loop;
end $$;

-- арендатор видит свои строки
drop policy if exists tenant_own on public.charges;
create policy tenant_own on public.charges for select to authenticated using (tenant_id = public.my_tenant_id());
drop policy if exists tenant_own on public.payments;
create policy tenant_own on public.payments for select to authenticated using (tenant_id = public.my_tenant_id());
drop policy if exists tenant_own on public.allocations;
create policy tenant_own on public.allocations for select to authenticated using (tenant_id = public.my_tenant_id());
drop policy if exists tenant_own on public.ledger_postings;
create policy tenant_own on public.ledger_postings for select to authenticated using (tenant_id = public.my_tenant_id());
drop policy if exists tenant_own on public.leases;
create policy tenant_own on public.leases for select to authenticated using (tenant_id = public.my_tenant_id());
drop policy if exists tenant_own on public.lease_lines;
create policy tenant_own on public.lease_lines for select to authenticated
  using (exists (select 1 from public.leases l where l.id = lease_id and l.tenant_id = public.my_tenant_id()));
drop policy if exists tenant_read on public.accounting_articles;
create policy tenant_read on public.accounting_articles for select to authenticated using (public.my_tenant_id() is not null);

-- ── Внутренние помощники ────────────────────────────────────────────────────
create or replace function public._acc_guard() returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if public.is_staff() or coalesce(auth.role(), '') = 'service_role' or session_user = 'postgres' then return; end if;
  raise exception 'Нет прав на учётные операции' using errcode = '42501';
end $$;

create or replace function public._acc_lock(p_tenant uuid) returns void
language sql as $$ select pg_advisory_xact_lock(hashtextextended('acc:' || p_tenant::text, 0)) $$;

create or replace function public._acc_post(p_date date, p_tenant uuid, p_lease uuid, p_register text, p_article text,
  p_period date, p_debit numeric, p_credit numeric, p_doc_type text, p_doc_id uuid) returns void
language sql security definer set search_path = public as $$
  insert into public.ledger_postings (date, tenant_id, lease_id, register, article_code, period, debit, credit, doc_type, doc_id)
  values (p_date, p_tenant, p_lease, p_register, p_article, p_period, coalesce(p_debit, 0), coalesce(p_credit, 0), p_doc_type, p_doc_id)
$$;

create or replace function public._acc_audit(p_action text, p_entity text, p_id uuid, p_data jsonb) returns void
language sql security definer set search_path = public as $$
  insert into public.audit_log (action, entity, entity_id, data) values (p_action, p_entity, p_id, p_data)
$$;

-- ── Состояние документов ────────────────────────────────────────────────────
create or replace view public.v_charge_state with (security_invoker = true) as
select c.id, c.tenant_id, c.lease_id, c.article_code, a.name as article_name, a.grp, a.register, a.priority,
       c.date, c.period, c.due_date, c.description, c.invoice_id, c.source, c.amount, c.created_at,
       c.amount + coalesce(s.amount, 0) as effective_amount,
       s.id is not null as reversed,
       coalesce(al.paid, 0) as paid,
       c.amount + coalesce(s.amount, 0) - coalesce(al.paid, 0) as open_amount,
       greatest(0, current_date - c.due_date) as days_overdue
from public.charges c
join public.accounting_articles a on a.code = c.article_code
left join public.charges s on s.storno_of = c.id
left join (select target_charge_id, sum(amount) as paid from public.allocations
           where cancelled_at is null and target_charge_id is not null group by 1) al on al.target_charge_id = c.id
where c.storno_of is null;

create or replace view public.v_payment_state with (security_invoker = true) as
select p.id, p.tenant_id, p.date, p.amount, p.direction, p.source, p.purpose, p.description, p.bank_transaction_id, p.created_at,
       s.id is not null as reversed,
       coalesce(o.used, 0) as allocated,
       case when p.direction = 'in' then p.amount - coalesce(o.used, 0) - case when s.id is null then 0 else p.amount end
            else p.amount - coalesce(i.covered, 0) end as free_amount
from public.payments p
left join public.payments s on s.storno_of = p.id
left join (select source_payment_id, sum(amount) as used from public.allocations
           where cancelled_at is null and source_payment_id is not null group by 1) o on o.source_payment_id = p.id
left join (select target_payment_id, sum(amount) as covered from public.allocations
           where cancelled_at is null and target_payment_id is not null group by 1) i on i.target_payment_id = p.id
where p.storno_of is null;

create or replace function public._deposit_balance(p_lease uuid) returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce(sum(debit - credit), 0) from public.ledger_postings where register = 'deposit' and lease_id = p_lease
$$;

-- ── Разнесение ──────────────────────────────────────────────────────────────
create or replace function public._acc_allocate(p_src_payment uuid, p_src_lease uuid, p_tgt_charge uuid, p_tgt_payment uuid,
  p_amount numeric, p_auto boolean, p_depop uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_tenant uuid; v_date date; v_id uuid; v_free numeric; v_ch record; v_tp record; v_sp record;
begin
  if p_amount is null or p_amount <= 0 then raise exception 'Сумма разнесения должна быть больше нуля'; end if;

  if p_src_payment is not null then
    select * into v_sp from public.v_payment_state where id = p_src_payment;
    if v_sp.id is null or v_sp.direction <> 'in' then raise exception 'Источник — не поступление'; end if;
    if v_sp.free_amount < p_amount then raise exception 'В оплате свободно %, нужно %', v_sp.free_amount, p_amount; end if;
    v_tenant := v_sp.tenant_id; v_date := v_sp.date;
  else
    select tenant_id into v_tenant from public.leases where id = p_src_lease;
    if v_tenant is null then raise exception 'Договор не найден'; end if;
    v_free := public._deposit_balance(p_src_lease);
    if v_free < p_amount then raise exception 'На депозите договора %, нужно %', v_free, p_amount; end if;
    v_date := current_date;
  end if;

  if p_tgt_charge is not null then
    select * into v_ch from public.v_charge_state where id = p_tgt_charge;
    if v_ch.id is null then raise exception 'Начисление не найдено'; end if;
    if v_ch.tenant_id <> v_tenant then raise exception 'Начисление другого арендатора'; end if;
    if v_ch.open_amount < p_amount then raise exception 'По начислению осталось %, нужно %', v_ch.open_amount, p_amount; end if;
    if v_ch.register = 'deposit' and p_src_lease is not null then raise exception 'Депозит нельзя зачесть в депозит'; end if;
    if v_ch.register = 'deposit' and v_ch.lease_id is null then raise exception 'Требование депозита без договора'; end if;
    v_date := greatest(v_date, v_ch.date);
  else
    select * into v_tp from public.v_payment_state where id = p_tgt_payment;
    if v_tp.id is null or v_tp.direction <> 'out' then raise exception 'Цель — не возврат'; end if;
    if v_tp.tenant_id <> v_tenant then raise exception 'Возврат другого арендатора'; end if;
    if v_tp.free_amount < p_amount then raise exception 'Возврат уже покрыт'; end if;
    v_date := greatest(v_date, v_tp.date);
  end if;

  insert into public.allocations (tenant_id, date, amount, source_payment_id, source_lease_id, target_charge_id, target_payment_id, deposit_operation_id, auto)
  values (v_tenant, v_date, p_amount, p_src_payment, p_src_lease, p_tgt_charge, p_tgt_payment, p_depop, p_auto)
  returning id into v_id;

  if p_src_payment is not null then
    perform public._acc_post(v_date, v_tenant, null, 'advance', null, null, 0, p_amount, 'allocation', v_id);
  else
    perform public._acc_post(v_date, v_tenant, p_src_lease, 'deposit', 'DEPOSIT', null, 0, p_amount, 'allocation', v_id);
  end if;
  if p_tgt_charge is not null then
    if v_ch.register = 'deposit' then
      perform public._acc_post(v_date, v_tenant, v_ch.lease_id, 'deposit', 'DEPOSIT', null, p_amount, 0, 'allocation', v_id);
    else
      perform public._acc_post(v_date, v_tenant, v_ch.lease_id, 'receivable', v_ch.article_code, v_ch.period, 0, p_amount, 'allocation', v_id);
    end if;
  end if;
  return v_id;
end $$;

create or replace function public._acc_cancel_allocation(p_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare v_a public.allocations; v_reg text; v_lease uuid; r record;
begin
  select * into v_a from public.allocations where id = p_id for update;
  if v_a.id is null then raise exception 'Разнесение не найдено'; end if;
  if v_a.cancelled_at is not null then return; end if;
  if v_a.target_payment_id is not null then raise exception 'Разнесение на возврат не отменяется: оформите поступление обратно'; end if;
  select a.register, c.lease_id into v_reg, v_lease from public.charges c join public.accounting_articles a on a.code = c.article_code where c.id = v_a.target_charge_id;
  if v_reg = 'deposit' and public._deposit_balance(v_lease) < v_a.amount then
    raise exception 'Депозит уже использован, отменить внесение нельзя';
  end if;
  update public.allocations set cancelled_at = now(), cancel_reason = p_reason, cancelled_by = auth.uid() where id = p_id;
  for r in select * from public.ledger_postings where doc_type = 'allocation' and doc_id = p_id loop
    perform public._acc_post(current_date, r.tenant_id, r.lease_id, r.register, r.article_code, r.period, r.credit, r.debit, 'allocation_cancel', p_id);
  end loop;
end $$;

-- Свободные деньги арендатора закрывают открытые начисления по очереди:
-- сначала более ранний срок, при равном сроке — по очереди статьи.
create or replace function public.allocate_tenant(p_tenant uuid) returns int
language plpgsql security definer set search_path = public as $$
declare ch record; p record; v_need numeric; v_part numeric; v_n int := 0;
begin
  perform public._acc_guard();
  perform public._acc_lock(p_tenant);
  for ch in select id, open_amount from public.v_charge_state
            where tenant_id = p_tenant and open_amount > 0 and not reversed
            order by due_date, priority, date, created_at loop
    v_need := ch.open_amount;
    for p in select id, free_amount from public.v_payment_state
             where tenant_id = p_tenant and direction = 'in' and free_amount > 0
             order by date, created_at loop
      v_part := least(v_need, p.free_amount);
      perform public._acc_allocate(p.id, null, ch.id, null, v_part, true, null);
      v_n := v_n + 1;
      v_need := v_need - v_part;
      exit when v_need <= 0;
    end loop;
    exit when v_need > 0;  -- деньги кончились
  end loop;
  return v_n;
end $$;

-- ── Начисления ──────────────────────────────────────────────────────────────
create or replace function public._acc_insert_charge(p_tenant uuid, p_lease uuid, p_article text, p_period date, p_amount numeric,
  p_due date, p_date date, p_description text, p_basis jsonb, p_source text, p_key text, p_storno_of uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_reg text;
begin
  select register into v_reg from public.accounting_articles where code = p_article and (active or p_storno_of is not null);
  if v_reg is null then raise exception 'Статья % не найдена или выключена', p_article; end if;
  if v_reg = 'deposit' and p_lease is null then raise exception 'Депозит начисляется только по договору'; end if;
  insert into public.charges (tenant_id, lease_id, article_code, date, period, amount, due_date, description, basis, source, billing_key, storno_of)
  values (p_tenant, p_lease, p_article, coalesce(p_date, current_date), p_period, round(p_amount, 2), p_due, p_description, p_basis, p_source, p_key, p_storno_of)
  on conflict (billing_key) do nothing
  returning id into v_id;
  if v_id is null then return null; end if;
  if v_reg = 'receivable' then
    if p_amount > 0 then
      perform public._acc_post(coalesce(p_date, current_date), p_tenant, p_lease, 'receivable', p_article, p_period, round(p_amount, 2), 0, 'charge', v_id);
    else
      perform public._acc_post(coalesce(p_date, current_date), p_tenant, p_lease, 'receivable', p_article, p_period, 0, round(-p_amount, 2), 'charge', v_id);
    end if;
  end if;
  return v_id;
end $$;

create or replace function public.post_charge(p_tenant uuid, p_lease uuid, p_article text, p_amount numeric, p_due date,
  p_period date default null, p_description text default null, p_date date default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  perform public._acc_guard();
  if p_amount is null or p_amount <= 0 then raise exception 'Сумма начисления должна быть больше нуля'; end if;
  if p_article = 'DEPOSIT' then raise exception 'Депозит требуется через операцию «Требование депозита»'; end if;
  perform public._acc_lock(p_tenant);
  v_id := public._acc_insert_charge(p_tenant, p_lease, p_article, p_period, p_amount, p_due, p_date, p_description, null, 'manual', null, null);
  perform public._acc_audit('charge.post', 'charges', v_id, jsonb_build_object('article', p_article, 'amount', p_amount));
  perform public.allocate_tenant(p_tenant);
  return v_id;
end $$;

create or replace function public.storno_charge(p_charge uuid, p_reason text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_c public.charges; v_id uuid; r record;
begin
  perform public._acc_guard();
  if coalesce(trim(p_reason), '') = '' then raise exception 'Укажите причину сторно'; end if;
  select * into v_c from public.charges where id = p_charge;
  if v_c.id is null or v_c.storno_of is not null then raise exception 'Начисление не найдено'; end if;
  perform public._acc_lock(v_c.tenant_id);
  if exists (select 1 from public.charges where storno_of = p_charge) then raise exception 'Начисление уже сторнировано'; end if;
  for r in select id from public.allocations where target_charge_id = p_charge and cancelled_at is null loop
    perform public._acc_cancel_allocation(r.id, 'Сторно начисления: ' || p_reason);
  end loop;
  v_id := public._acc_insert_charge(v_c.tenant_id, v_c.lease_id, v_c.article_code, v_c.period, -v_c.amount, v_c.due_date, current_date,
                                    p_reason, null, 'storno', null, p_charge);
  perform public._acc_audit('charge.storno', 'charges', p_charge, jsonb_build_object('reason', p_reason, 'storno_id', v_id));
  perform public.allocate_tenant(v_c.tenant_id);
  return v_id;
end $$;

-- ── Оплаты ──────────────────────────────────────────────────────────────────
create or replace function public.post_payment(p_tenant uuid, p_date date, p_amount numeric, p_source text default 'manual',
  p_purpose text default null, p_bank_tx uuid default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  perform public._acc_guard();
  if p_amount is null or p_amount <= 0 then raise exception 'Сумма оплаты должна быть больше нуля'; end if;
  if p_source not in ('bank', 'cash', 'manual', 'opening') then raise exception 'Неизвестный источник оплаты'; end if;
  perform public._acc_lock(p_tenant);
  insert into public.payments (tenant_id, date, amount, direction, source, purpose, description, bank_transaction_id, type)
  values (p_tenant, p_date, round(p_amount, 2), 'in', p_source, p_purpose, p_purpose, p_bank_tx, 'payment')
  returning id into v_id;
  perform public._acc_post(p_date, p_tenant, null, 'advance', null, null, round(p_amount, 2), 0, 'payment', v_id);
  perform public._acc_audit('payment.post', 'payments', v_id, jsonb_build_object('amount', p_amount, 'source', p_source));
  perform public.allocate_tenant(p_tenant);
  return v_id;
end $$;

create or replace function public.storno_payment(p_payment uuid, p_reason text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_p public.payments; v_id uuid; r record;
begin
  perform public._acc_guard();
  if coalesce(trim(p_reason), '') = '' then raise exception 'Укажите причину сторно'; end if;
  select * into v_p from public.payments where id = p_payment;
  if v_p.id is null or v_p.direction <> 'in' or v_p.storno_of is not null then raise exception 'Поступление не найдено'; end if;
  perform public._acc_lock(v_p.tenant_id);
  if exists (select 1 from public.payments where storno_of = p_payment) then raise exception 'Поступление уже сторнировано'; end if;
  if exists (select 1 from public.allocations where source_payment_id = p_payment and cancelled_at is null and target_payment_id is not null) then
    raise exception 'Из этой оплаты уже сделан возврат';
  end if;
  for r in select id from public.allocations where source_payment_id = p_payment and cancelled_at is null loop
    perform public._acc_cancel_allocation(r.id, 'Сторно оплаты: ' || p_reason);
  end loop;
  insert into public.payments (tenant_id, date, amount, direction, source, purpose, description, storno_of, type)
  values (v_p.tenant_id, current_date, v_p.amount, 'in', 'storno', p_reason, p_reason, p_payment, 'storno')
  returning id into v_id;
  perform public._acc_post(current_date, v_p.tenant_id, null, 'advance', null, null, 0, v_p.amount, 'payment_storno', v_id);
  perform public._acc_audit('payment.storno', 'payments', p_payment, jsonb_build_object('reason', p_reason));
  perform public.allocate_tenant(v_p.tenant_id);
  return v_id;
end $$;

-- Ручное исключение из очереди: отменить разнесение (деньги вернутся в аванс)
-- и при необходимости разнести вручную на выбранное начисление.
create or replace function public.cancel_allocation(p_allocation uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare v_t uuid;
begin
  perform public._acc_guard();
  if coalesce(trim(p_reason), '') = '' then raise exception 'Укажите причину'; end if;
  select tenant_id into v_t from public.allocations where id = p_allocation;
  if v_t is null then raise exception 'Разнесение не найдено'; end if;
  perform public._acc_lock(v_t);
  perform public._acc_cancel_allocation(p_allocation, p_reason);
  perform public._acc_audit('allocation.cancel', 'allocations', p_allocation, jsonb_build_object('reason', p_reason));
end $$;

create or replace function public.allocate_manual(p_payment uuid, p_charge uuid, p_amount numeric) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_t uuid; v_id uuid;
begin
  perform public._acc_guard();
  select tenant_id into v_t from public.payments where id = p_payment;
  if v_t is null then raise exception 'Оплата не найдена'; end if;
  perform public._acc_lock(v_t);
  v_id := public._acc_allocate(p_payment, null, p_charge, null, p_amount, false, null);
  perform public._acc_audit('allocation.manual', 'allocations', v_id, jsonb_build_object('payment', p_payment, 'charge', p_charge, 'amount', p_amount));
  return v_id;
end $$;

-- ── Депозит ─────────────────────────────────────────────────────────────────
create or replace function public.deposit_require(p_lease uuid, p_amount numeric, p_due date, p_reason text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_t uuid; v_ch uuid; v_op uuid;
begin
  perform public._acc_guard();
  if coalesce(trim(p_reason), '') = '' then raise exception 'Укажите основание'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Сумма должна быть больше нуля'; end if;
  select tenant_id into v_t from public.leases where id = p_lease;
  if v_t is null then raise exception 'Договор не найден'; end if;
  perform public._acc_lock(v_t);
  v_ch := public._acc_insert_charge(v_t, p_lease, 'DEPOSIT', null, p_amount, p_due, current_date, p_reason, null, 'deposit', null, null);
  insert into public.deposit_operations (tenant_id, lease_id, kind, amount, reason, charge_id) values (v_t, p_lease, 'require', p_amount, p_reason, v_ch)
  returning id into v_op;
  perform public._acc_audit('deposit.require', 'deposit_operations', v_op, jsonb_build_object('amount', p_amount));
  perform public.allocate_tenant(v_t);
  return v_op;
end $$;

create or replace function public.deposit_offset(p_lease uuid, p_charge uuid, p_amount numeric, p_reason text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_t uuid; v_op uuid;
begin
  perform public._acc_guard();
  if coalesce(trim(p_reason), '') = '' then raise exception 'Укажите основание зачёта'; end if;
  select tenant_id into v_t from public.leases where id = p_lease;
  if v_t is null then raise exception 'Договор не найден'; end if;
  perform public._acc_lock(v_t);
  insert into public.deposit_operations (tenant_id, lease_id, kind, amount, reason, charge_id) values (v_t, p_lease, 'offset', p_amount, p_reason, p_charge)
  returning id into v_op;
  perform public._acc_allocate(null, p_lease, p_charge, null, p_amount, false, v_op);
  perform public._acc_audit('deposit.offset', 'deposit_operations', v_op, jsonb_build_object('amount', p_amount, 'charge', p_charge));
  return v_op;
end $$;

-- Возврат арендатору: из аванса (переплаты) или из депозита договора.
create or replace function public.refund(p_tenant uuid, p_from text, p_amount numeric, p_date date, p_reason text, p_lease uuid default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_pay uuid; v_op uuid; v_need numeric; v_part numeric; p record;
begin
  perform public._acc_guard();
  if coalesce(trim(p_reason), '') = '' then raise exception 'Укажите основание возврата'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Сумма должна быть больше нуля'; end if;
  perform public._acc_lock(p_tenant);
  insert into public.payments (tenant_id, date, amount, direction, source, purpose, description, type)
  values (p_tenant, p_date, round(p_amount, 2), 'out', 'refund', p_reason, p_reason, 'refund') returning id into v_pay;
  if p_from = 'deposit' then
    if p_lease is null then raise exception 'Укажите договор'; end if;
    if (select tenant_id from public.leases where id = p_lease) <> p_tenant then raise exception 'Договор другого арендатора'; end if;
    insert into public.deposit_operations (tenant_id, lease_id, kind, amount, reason, payment_id) values (p_tenant, p_lease, 'refund', p_amount, p_reason, v_pay)
    returning id into v_op;
    perform public._acc_allocate(null, p_lease, null, v_pay, round(p_amount, 2), false, v_op);
  elsif p_from = 'advance' then
    v_need := round(p_amount, 2);
    for p in select id, free_amount from public.v_payment_state where tenant_id = p_tenant and direction = 'in' and free_amount > 0 order by date, created_at loop
      v_part := least(v_need, p.free_amount);
      perform public._acc_allocate(p.id, null, null, v_pay, v_part, false, null);
      v_need := v_need - v_part;
      exit when v_need <= 0;
    end loop;
    if v_need > 0 then raise exception 'Аванса не хватает на возврат: не хватает %', v_need; end if;
  else
    raise exception 'Возврат бывает из аванса или из депозита';
  end if;
  perform public._acc_audit('refund', 'payments', v_pay, jsonb_build_object('from', p_from, 'amount', p_amount, 'lease', p_lease));
  return v_pay;
end $$;

-- Входящий остаток (этап 3): долг — начислением OPENING, переплата — поступлением.
create or replace function public.post_opening_balance(p_tenant uuid, p_date date, p_amount numeric, p_note text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  perform public._acc_guard();
  if p_amount = 0 then return null; end if;
  perform public._acc_lock(p_tenant);
  if p_amount > 0 then
    v_id := public._acc_insert_charge(p_tenant, null, 'OPENING', null, p_amount, p_date, p_date, coalesce(p_note, 'Входящий остаток'), null, 'opening',
                                      'O:' || p_tenant || ':' || p_date, null);
  else
    if exists (select 1 from public.payments where tenant_id = p_tenant and source = 'opening' and date = p_date) then return null; end if;
    insert into public.payments (tenant_id, date, amount, direction, source, purpose, description, type)
    values (p_tenant, p_date, -p_amount, 'in', 'opening', coalesce(p_note, 'Входящий остаток (переплата)'), p_note, 'opening') returning id into v_id;
    perform public._acc_post(p_date, p_tenant, null, 'advance', null, null, -p_amount, 0, 'payment', v_id);
  end if;
  perform public._acc_audit('opening', 'tenants', p_tenant, jsonb_build_object('amount', p_amount, 'date', p_date));
  perform public.allocate_tenant(p_tenant);
  return v_id;
end $$;

-- ── Биллинг ─────────────────────────────────────────────────────────────────
create or replace function public._setting_on(p_key text, p_date date) returns numeric
language sql stable security definer set search_path = public as $$
  select value::numeric from public.settings where key = p_key and coalesce(valid_from, '1900-01-01') <= p_date
  order by valid_from desc nulls last limit 1
$$;

-- Строки начислений за месяц (p_period — любой день месяца). Ничего не пишет.
create or replace function public.billing_lines(p_period date)
returns table (tenant_id uuid, tenant_name text, lease_id uuid, article_code text, amount numeric, due_date date,
               description text, basis jsonb, billing_key text, kind text, already boolean)
language plpgsql stable security definer set search_path = public as $$
declare m0 date := date_trunc('month', p_period)::date; m1 date := (date_trunc('month', p_period) + interval '1 month - 1 day')::date;
        dim int := extract(day from (date_trunc('month', p_period) + interval '1 month - 1 day'))::int;
begin
  perform public._acc_guard();
  return query
  with lines as (
    -- 1. ежемесячные строки договоров, неполный месяц — пропорционально дням
    select l.tenant_id, l.id as lease_id, ll.article_code,
           round(ll.amount * ((least(m1, coalesce(ll.valid_to, m1), coalesce(l.end_date, m1)) - greatest(m0, ll.valid_from, coalesce(l.start_date, m0)) + 1)::numeric / dim), 2) as amount,
           make_date(extract(year from m0)::int, extract(month from m0)::int, l.payment_day) as due_date,
           a.name || ' за ' || to_char(m0, 'MM.YYYY') || coalesce(' (' || ll.unit_label || ')', '') as description,
           jsonb_build_object('lease_line', ll.id, 'monthly', ll.amount, 'area', ll.area, 'rate', ll.rate_per_sqm,
             'days', least(m1, coalesce(ll.valid_to, m1), coalesce(l.end_date, m1)) - greatest(m0, ll.valid_from, coalesce(l.start_date, m0)) + 1, 'days_in_month', dim) as basis,
           'L:' || ll.id || ':' || m0 as billing_key,
           'rent' as kind
    from public.leases l
    join public.lease_lines ll on ll.lease_id = l.id
    join public.accounting_articles a on a.code = ll.article_code
    where l.status = 'active'
      and ll.valid_from <= m1 and coalesce(ll.valid_to, m1) >= m0
      and coalesce(l.start_date, m0) <= m1 and coalesce(l.end_date, m1) >= m0
    union all
    -- 2. счётчики: электроэнергия и вода по показаниям месяца
    select mt.tenant_id, (select x.id from public.leases x where x.tenant_id = mt.tenant_id and x.status = 'active' order by x.start_date desc nulls last limit 1),
           case mt.type when 'electricity' then 'ELEC' when 'cold_water' then 'CWATER' else 'HWATER' end,
           round(coalesce(r.amount, coalesce(r.consumption, r.curr_value - r.prev_value, r.reading - r.previous_reading)
                 * coalesce(nullif(mt.tariff, 0), public._setting_on(case mt.type when 'electricity' then 'electricity_tariff'
                     when 'cold_water' then 'cold_water_tariff' else 'hot_water_tariff' end, m0))), 2),
           make_date(extract(year from m1 + 1)::int, extract(month from m1 + 1)::int,
             coalesce((select x.payment_day from public.leases x where x.tenant_id = mt.tenant_id and x.status = 'active' order by x.start_date desc nulls last limit 1), 5)),
           case mt.type when 'electricity' then 'Электроэнергия' when 'cold_water' then 'Холодная вода' else 'Горячая вода' end
             || ' за ' || to_char(m0, 'MM.YYYY') || ', счётчик ' || coalesce(mt.serial, mt.number, ''),
           jsonb_build_object('meter', mt.id, 'reading', r.id, 'consumption', coalesce(r.consumption, r.curr_value - r.prev_value, r.reading - r.previous_reading),
             'tariff', coalesce(nullif(mt.tariff, 0), public._setting_on(case mt.type when 'electricity' then 'electricity_tariff'
                     when 'cold_water' then 'cold_water_tariff' else 'hot_water_tariff' end, m0))),
           'M:' || r.id,
           'utilities'
    from public.meter_readings r
    join public.meters mt on mt.id = r.meter_id
    where mt.tenant_id is not null and mt.type in ('electricity', 'cold_water', 'hot_water')
      and date_trunc('month', coalesce(r.period, r.reading_date)) = m0
    union all
    -- 3. тепло — по распределению счёта за тепло этого месяца
    select (it ->> 'tenant_id')::uuid,
           (select x.id from public.leases x where x.tenant_id = (it ->> 'tenant_id')::uuid and x.status = 'active' order by x.start_date desc nulls last limit 1),
           'HEAT', round((it ->> 'amount_final')::numeric, 2),
           make_date(extract(year from m1 + 1)::int, extract(month from m1 + 1)::int,
             coalesce((select x.payment_day from public.leases x where x.tenant_id = (it ->> 'tenant_id')::uuid and x.status = 'active' order by x.start_date desc nulls last limit 1), 5)),
           'Тепло за ' || to_char(m0, 'MM.YYYY') || coalesce(', помещение ' || (it ->> 'unit_number'), ''),
           jsonb_build_object('heat_bill', hb.id, 'area', it -> 'area', 'share', it -> 'share', 'coefficient', hb.coefficient),
           'H:' || hb.id || ':' || (it ->> 'unit_id'),
           'utilities'
    from public.heat_bills hb, jsonb_array_elements(coalesce(hb.items, '[]'::jsonb)) it
    where date_trunc('month', hb.period) = m0 and nullif(it ->> 'tenant_id', '') is not null and coalesce((it ->> 'amount_final')::numeric, 0) > 0
    union all
    -- 4. пени по договорам, где они включены: просроченный остаток × ставка × дни просрочки в этом месяце
    select cs.tenant_id, cs.lease_id, 'PENALTY',
           round(sum(cs.open_amount * l.penalty_rate / 100 * (m1 - greatest(m0, cs.due_date + 1) + 1)), 2),
           make_date(extract(year from m1 + 1)::int, extract(month from m1 + 1)::int, l.payment_day),
           'Пени за ' || to_char(m0, 'MM.YYYY'),
           jsonb_build_object('rate_per_day', l.penalty_rate, 'charges', jsonb_agg(jsonb_build_object('charge', cs.id, 'open', cs.open_amount, 'due', cs.due_date))),
           'P:' || cs.lease_id || ':' || m0,
           'utilities'
    from public.v_charge_state cs
    join public.leases l on l.id = cs.lease_id
    where l.penalty_enabled and l.penalty_rate > 0 and cs.register = 'receivable' and cs.article_code <> 'PENALTY'
      and cs.open_amount > 0 and cs.due_date < m1
    group by cs.tenant_id, cs.lease_id, l.penalty_rate, l.payment_day
  )
  select x.tenant_id, t.full_name, x.lease_id, x.article_code, x.amount, x.due_date, x.description, x.basis, x.billing_key,
         case when l.billing_mode = 'single' then 'combined' else x.kind end,
         exists (select 1 from public.charges c where c.billing_key = x.billing_key)
  from lines x
  join public.tenants t on t.id = x.tenant_id
  left join public.leases l on l.id = x.lease_id
  where x.amount > 0
  order by t.full_name, x.kind, x.article_code;
end $$;

-- Счётчики арендаторов без показаний за месяц: по ним коммунальные не начисляются.
create or replace function public.billing_missing_readings(p_period date)
returns table (tenant_id uuid, tenant_name text, meter_id uuid, meter_type text, meter_label text)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public._acc_guard();
  return query
  select mt.tenant_id, t.full_name, mt.id, mt.type, coalesce(mt.serial, mt.number)
  from public.meters mt join public.tenants t on t.id = mt.tenant_id
  where mt.type in ('electricity', 'cold_water', 'hot_water')
    and not exists (select 1 from public.meter_readings r where r.meter_id = mt.id
                    and date_trunc('month', coalesce(r.period, r.reading_date)) = date_trunc('month', p_period))
  order by t.full_name;
end $$;

-- Провести начисления за месяц и собрать их в счета. Повторный запуск ничего не дублирует.
create or replace function public.billing_post(p_period date) returns jsonb
language plpgsql security definer set search_path = public as $$
declare m0 date := date_trunc('month', p_period)::date; r record; v_ch uuid; v_inv uuid; v_n int := 0; v_i int := 0;
        v_seq int; v_year text := to_char(current_date, 'YYYY'); v_tenants uuid[] := '{}';
begin
  perform public._acc_guard();
  perform pg_advisory_xact_lock(hashtextextended('billing', 0));
  for r in select * from public.billing_lines(m0) where not already loop
    perform public._acc_lock(r.tenant_id);
    v_ch := public._acc_insert_charge(r.tenant_id, r.lease_id, r.article_code, m0, r.amount, r.due_date, m0,
                                      r.description, r.basis || jsonb_build_object('kind', r.kind), 'billing', r.billing_key, null);
    if v_ch is not null then v_n := v_n + 1; v_tenants := array_append(v_tenants, r.tenant_id); end if;
  end loop;

  -- счета: по арендатору, договору и виду; в счёт попадают начисления месяца без счёта
  for r in select c.tenant_id, c.lease_id, c.basis ->> 'kind' as kind, min(c.due_date) as due, sum(c.amount) as total,
                  sum(c.amount) filter (where c.article_code = 'RENT') as rent,
                  sum(c.amount) filter (where c.article_code = 'CLEAN') as cleaning,
                  sum(c.amount) filter (where a.grp = 'Коммунальные') as utilities,
                  array_agg(c.id) as ids
           from public.charges c join public.accounting_articles a on a.code = c.article_code
           where c.source = 'billing' and c.period = m0 and c.invoice_id is null
           group by 1, 2, 3 loop
    select coalesce(max(nullif(regexp_replace(number, '^' || v_year || '-', ''), number)::int), 0) + 1 into v_seq
    from public.invoices where number like v_year || '-%' and number ~ ('^' || v_year || '-[0-9]+$');
    insert into public.invoices (tenant_id, lease_id, kind, number, date, period, due_date, status, rent_amount, cleaning_amount,
                                 utilities_amount, services_amount, total_amount, billing_key)
    values (r.tenant_id, r.lease_id, r.kind, v_year || '-' || lpad(v_seq::text, 4, '0'), current_date, to_char(m0, 'YYYY-MM'), r.due, 'ISSUED',
            coalesce(r.rent, 0), coalesce(r.cleaning, 0), coalesce(r.utilities, 0),
            r.total - coalesce(r.rent, 0) - coalesce(r.cleaning, 0) - coalesce(r.utilities, 0), r.total,
            'I:' || r.tenant_id || ':' || coalesce(r.lease_id::text, '-') || ':' || r.kind || ':' || m0 || ':' || v_seq)
    returning id into v_inv;
    update public.charges set invoice_id = v_inv where id = any (r.ids);
    v_i := v_i + 1;
  end loop;

  for r in select distinct unnest(v_tenants) as t loop
    perform public.allocate_tenant(r.t);
  end loop;
  perform public._acc_audit('billing.post', 'invoices', null, jsonb_build_object('period', m0, 'charges', v_n, 'invoices', v_i));
  return jsonb_build_object('charges', v_n, 'invoices', v_i);
end $$;

-- ── Отчёты ──────────────────────────────────────────────────────────────────
create or replace view public.v_invoice_state with (security_invoker = true) as
select i.id, i.tenant_id, i.lease_id, i.kind, i.number, i.date, i.period, i.due_date, i.status as issue_status, i.pdf_path, i.created_at,
       t.full_name as tenant_name,
       coalesce(sum(cs.effective_amount), 0) as total,
       coalesce(sum(cs.paid), 0) as paid,
       coalesce(sum(cs.open_amount), 0) as open_amount,
       case when count(cs.id) = 0 then i.status
            when coalesce(sum(cs.open_amount), 0) <= 0 then 'paid'
            when coalesce(sum(cs.paid), 0) > 0 then case when i.due_date < current_date then 'partial_overdue' else 'partial' end
            when i.due_date < current_date then 'overdue'
            else 'unpaid' end as pay_status
from public.invoices i
join public.tenants t on t.id = i.tenant_id
left join public.v_charge_state cs on cs.invoice_id = i.id
where i.billing_key is not null
group by i.id, t.full_name;

-- Обороты по регистрам за период: остаток на начало, приход, расход, остаток на конец.
-- Для расчётов приход = начислено, расход = оплачено (погашено); для авансов — наоборот по смыслу.
create or replace function public.ledger_turnover(p_from date, p_to date, p_tenant uuid default null)
returns table (tenant_id uuid, tenant_name text, register text, article_code text, article_name text, grp text, lease_id uuid,
               opening numeric, debit numeric, credit numeric, closing numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public._acc_guard_read(p_tenant);
  return query
  select p.tenant_id, t.full_name, p.register, p.article_code, a.name, a.grp,
         case when p.register = 'deposit' then p.lease_id end,
         coalesce(sum(p.debit - p.credit) filter (where p.date < p_from), 0),
         coalesce(sum(p.debit) filter (where p.date between p_from and p_to), 0),
         coalesce(sum(p.credit) filter (where p.date between p_from and p_to), 0),
         coalesce(sum(p.debit - p.credit) filter (where p.date <= p_to), 0)
  from public.ledger_postings p
  join public.tenants t on t.id = p.tenant_id
  left join public.accounting_articles a on a.code = p.article_code
  where (p_tenant is null or p.tenant_id = p_tenant) and p.date <= p_to
  group by p.tenant_id, t.full_name, p.register, p.article_code, a.name, a.grp, a.priority, case when p.register = 'deposit' then p.lease_id end
  order by t.full_name, p.register, a.priority nulls first;
end $$;

-- Сотрудник видит всех, арендатор — только себя.
create or replace function public._acc_guard_read(p_tenant uuid) returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if public.is_staff() or coalesce(auth.role(), '') = 'service_role' or session_user = 'postgres' then return; end if;
  if p_tenant is not null and p_tenant = public.my_tenant_id() then return; end if;
  raise exception 'Нет прав' using errcode = '42501';
end $$;

create or replace view public.v_deposits with (security_invoker = true) as
select l.id as lease_id, l.tenant_id, t.full_name as tenant_name, l.number, l.status, l.deposit_required,
       coalesce((select sum(cs.effective_amount) from public.v_charge_state cs where cs.lease_id = l.id and cs.register = 'deposit'), 0) as requested,
       coalesce((select sum(p.debit - p.credit) from public.ledger_postings p where p.register = 'deposit' and p.lease_id = l.id), 0) as held,
       l.deposit_required - coalesce((select sum(p.debit - p.credit) from public.ledger_postings p where p.register = 'deposit' and p.lease_id = l.id), 0) as shortfall
from public.leases l join public.tenants t on t.id = l.tenant_id;

-- Карточка расчётов: хронология документов арендатора.
create or replace view public.v_tenant_documents with (security_invoker = true) as
select c.tenant_id, c.date, c.created_at, 'charge'::text as doc_type, c.id as doc_id, c.article_code, a.name as article_name, c.lease_id,
       case when c.storno_of is null then c.description else 'Сторно: ' || coalesce(c.description, '') end as description,
       case when a.register = 'receivable' then c.amount else 0 end as charged, 0::numeric as paid,
       c.invoice_id, c.storno_of as ref_id, a.register
from public.charges c join public.accounting_articles a on a.code = c.article_code
union all
select p.tenant_id, p.date, p.created_at, case when p.direction = 'out' then 'refund' when p.storno_of is not null then 'payment_storno' else 'payment' end,
       p.id, null, null, null,
       coalesce(p.purpose, p.description, case p.source when 'opening' then 'Входящий остаток (переплата)' else 'Оплата' end),
       0, case when p.direction = 'out' or p.storno_of is not null then -p.amount else p.amount end,
       null, p.storno_of, 'advance'
from public.payments p
union all
select d.tenant_id, d.date, d.created_at, 'deposit_' || d.kind, d.id, 'DEPOSIT', 'Обеспечительный платёж', d.lease_id, d.reason,
       0, 0, null, coalesce(d.charge_id, d.payment_id), 'deposit'
from public.deposit_operations d where d.kind <> 'require';

-- ── Самопроверка ────────────────────────────────────────────────────────────
-- Пересчитывает остатки из документов и сравнивает с регистром. Пустой результат — всё сходится.
create or replace function public.verify_ledger()
returns table (problem text, tenant_id uuid, register text, key text, from_documents numeric, from_postings numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public._acc_guard();
  return query
  with docs as (
    select c.tenant_id, 'receivable'::text as register, c.article_code as key, sum(c.amount) as amt
    from public.charges c join public.accounting_articles a on a.code = c.article_code where a.register = 'receivable' group by 1, 2, 3
    union all
    select cs.tenant_id, 'receivable', cs.article_code, -sum(al.amount)
    from public.allocations al join public.v_charge_state cs on cs.id = al.target_charge_id
    where al.cancelled_at is null and cs.register = 'receivable' group by 1, 2, 3
    union all
    select p.tenant_id, 'advance', '', sum(case when p.storno_of is null then p.amount else -p.amount end)
    from public.payments p where p.direction = 'in' group by 1, 2, 3
    union all
    select al.tenant_id, 'advance', '', -sum(al.amount) from public.allocations al
    where al.cancelled_at is null and al.source_payment_id is not null group by 1, 2, 3
    union all
    select cs.tenant_id, 'deposit', cs.lease_id::text, sum(al.amount)
    from public.allocations al join public.v_charge_state cs on cs.id = al.target_charge_id
    where al.cancelled_at is null and cs.register = 'deposit' group by 1, 2, 3
    union all
    select al.tenant_id, 'deposit', al.source_lease_id::text, -sum(al.amount) from public.allocations al
    where al.cancelled_at is null and al.source_lease_id is not null group by 1, 2, 3
  ), d as (select x.tenant_id, x.register, x.key, sum(x.amt) as amt from docs x group by 1, 2, 3),
  p as (
    select lp.tenant_id, lp.register, case lp.register when 'receivable' then lp.article_code when 'deposit' then lp.lease_id::text else '' end as key,
           sum(lp.debit - lp.credit) as amt
    from public.ledger_postings lp group by 1, 2, 3
  )
  select 'остаток не сходится', coalesce(d.tenant_id, p.tenant_id), coalesce(d.register, p.register), coalesce(d.key, p.key), coalesce(d.amt, 0), coalesce(p.amt, 0)
  from d full join p on p.tenant_id = d.tenant_id and p.register = d.register and p.key = d.key
  where coalesce(d.amt, 0) <> coalesce(p.amt, 0)
  union all
  select 'оплата разнесена больше суммы', v.tenant_id, 'advance', v.id::text, v.amount, v.allocated from public.v_payment_state v where v.free_amount < 0
  union all
  select 'начисление погашено больше суммы', v.tenant_id, 'receivable', v.id::text, v.effective_amount, v.paid from public.v_charge_state v where v.open_amount < 0
  union all
  select 'депозит ушёл в минус', l.tenant_id, 'deposit', l.id::text, 0, public._deposit_balance(l.id) from public.leases l where public._deposit_balance(l.id) < 0;
end $$;

-- ── Права на функции ────────────────────────────────────────────────────────
do $$
declare f text;
begin
  for f in select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and (p.proname like '\_acc\_%' or p.proname in ('_deposit_balance', '_setting_on')) loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
  for f in select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname in ('allocate_tenant', 'post_charge', 'storno_charge', 'post_payment', 'storno_payment',
             'cancel_allocation', 'allocate_manual', 'deposit_require', 'deposit_offset', 'refund', 'post_opening_balance',
             'billing_lines', 'billing_missing_readings', 'billing_post', 'ledger_turnover', 'verify_ledger') loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;
end $$;
-- _acc_guard_read и _acc_guard вызываются из функций с правами владельца — им прямой доступ не нужен.

-- ── Начальные договоры из карточек арендаторов ─────────────────────────────
-- Один раз: по каждому действующему арендатору без договора создаётся договор
-- с номером и датами из карточки и строками: аренда, уборка, реклама.
do $$
declare t record; v_lease uuid; v_from date;
begin
  for t in select * from public.tenants
           where upper(coalesce(status, '')) = 'ACTIVE'
             and (coalesce(monthly_rent, 0) > 0 or coalesce(cleaning_fee, 0) > 0 or coalesce(ad_facade, 0) + coalesce(ad_stella, 0) + coalesce(ad_frame, 0) > 0)
             and not exists (select 1 from public.leases l where l.tenant_id = tenants.id) loop
    v_from := coalesce(t.contract_start_date, date '2024-01-01');
    insert into public.leases (tenant_id, number, start_date, end_date, status, notes)
    values (t.id, t.contract_number, v_from, t.contract_end_date, 'active', 'Создан из карточки арендатора при переходе на учёт в Маяке')
    returning id into v_lease;
    if coalesce(t.monthly_rent, 0) > 0 then
      insert into public.lease_lines (lease_id, article_code, unit_label, area, rate_per_sqm, amount, valid_from)
      values (v_lease, 'RENT', t.unit_number, t.area_actual, t.rate_per_sqm, t.monthly_rent, v_from);
    end if;
    if coalesce(t.cleaning_fee, 0) > 0 then
      insert into public.lease_lines (lease_id, article_code, unit_label, amount, valid_from) values (v_lease, 'CLEAN', t.unit_number, t.cleaning_fee, v_from);
    end if;
    if coalesce(t.ad_stella, 0) > 0 then
      insert into public.lease_lines (lease_id, article_code, amount, valid_from, note) values (v_lease, 'AD_STELE', t.ad_stella, v_from, 'Стела');
    end if;
    if coalesce(t.ad_facade, 0) > 0 then
      insert into public.lease_lines (lease_id, article_code, amount, valid_from, note) values (v_lease, 'AD_OTHER', t.ad_facade, v_from, 'Реклама на фасаде');
    end if;
    if coalesce(t.ad_frame, 0) > 0 then
      insert into public.lease_lines (lease_id, article_code, amount, valid_from, note) values (v_lease, 'AD_OTHER', t.ad_frame, v_from, 'Рекламная рамка');
    end if;
  end loop;
end $$;
