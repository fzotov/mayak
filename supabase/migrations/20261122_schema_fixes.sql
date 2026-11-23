-- Колонки и таблицы, к которым код обращался, но которых не было в базе
-- (из-за этого карточка арендатора не сохранялась, а документы и договоры не открывались).
-- Выполнять ДО 20261123_security.sql. Скрипт можно выполнять повторно.

alter table public.tenants add column if not exists correspondent_account text;
alter table public.tenants add column if not exists director_name        text;
alter table public.tenants add column if not exists director_position    text;
alter table public.tenants add column if not exists director_basis       text;
alter table public.tenants add column if not exists passport_series      text;
alter table public.tenants add column if not exists passport_number      text;
alter table public.tenants add column if not exists passport_issued_by   text;
alter table public.tenants add column if not exists passport_issued_date date;
alter table public.tenants add column if not exists onboarding_status    text;

create table if not exists public.tenant_contracts (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  contract_type   text not null default 'lease',
  contract_number text,
  signed_date     date,
  valid_from      date,
  valid_to        date,
  notes           text,
  created_at      timestamptz not null default now()
);
create index if not exists tenant_contracts_tenant_idx on public.tenant_contracts (tenant_id);

create table if not exists public.tenant_documents (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  doc_type    text not null,
  file_name   text,
  file_url    text,
  notes       text,
  uploaded_at timestamptz not null default now()
);
create index if not exists tenant_documents_tenant_idx on public.tenant_documents (tenant_id);

create index if not exists ledger_entries_tenant_idx on public.ledger_entries (tenant_id, date desc);

-- показания счётчиков: админка пишет period / prev_value / curr_value, кабинет — reading / reading_date
alter table public.meter_readings add column if not exists period     date;
alter table public.meter_readings add column if not exists prev_value numeric;
alter table public.meter_readings add column if not exists curr_value numeric;
alter table public.meter_readings add column if not exists notes      text;

alter table public.tasks add column if not exists source text default 'EMPLOYEE';

-- последний успешный снимок выгрузки 1С: страница взаиморасчётов работает и когда 1С недоступна
create table if not exists public.onec_snapshot (
  id         int primary key default 1 check (id = 1),
  fetched_at timestamptz not null default now(),
  as_of      timestamptz,
  data       jsonb not null
);
