-- ─────────────────────────────────────────────────────────────────────────────
-- Этап 1 ТЗ v2: вход, роли и защита строк (RLS) на всех таблицах.
-- После выполнения: без входа база не отдаёт ничего, кроме приёма заявок с сайта;
-- сотрудник видит всё; арендатор — только строки своего tenant_id.
-- Скрипт можно выполнять повторно.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Сотрудники с доступом в систему ─────────────────────────────────────────
create table if not exists public.profiles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  email      text,
  full_name  text not null default '',
  role       text not null default 'manager' check (role in ('owner','manager','accountant','technician')),
  created_at timestamptz not null default now()
);

-- 2. Пользователи кабинета арендатора (несколько на одного арендатора) ───────
create table if not exists public.tenant_users (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  email        text,
  invited_at   timestamptz,
  activated_at timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists tenant_users_tenant_idx on public.tenant_users (tenant_id);
create index if not exists tenant_users_email_idx  on public.tenant_users (email);

-- 3. Одноразовые ссылки (приглашения, сброс пароля). Только service key. ─────
create table if not exists public.auth_tokens (
  id         uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  kind       text not null check (kind in ('tenant_invite','staff_invite','reset')),
  email      text not null,
  tenant_id  uuid references public.tenants(id) on delete cascade,
  payload    jsonb,
  expires_at timestamptz not null,
  used_at    timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists auth_tokens_email_idx on public.auth_tokens (email, kind);

-- 4. Сальдо арендатора по данным 1С (обновляется при каждой загрузке) ────────
create table if not exists public.tenant_balances (
  tenant_id  uuid primary key references public.tenants(id) on delete cascade,
  debt       numeric(14,2) not null default 0,   -- арендатор должен нам
  advance    numeric(14,2) not null default 0,   -- переплата арендатора
  as_of      timestamptz,                        -- на какую дату сальдо в 1С
  updated_at timestamptz not null default now()
);

-- 5. Первый владелец ─────────────────────────────────────────────────────────
insert into public.profiles (user_id, email, full_name, role)
select id, lower(email), 'Фёдор Зотов', 'owner' from auth.users where lower(email) = 'fzotov@yahoo.com'
on conflict (user_id) do nothing;

-- 6. Функции для политик ─────────────────────────────────────────────────────
create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.profiles where user_id = auth.uid()) $$;

create or replace function public.staff_role() returns text
language sql stable security definer set search_path = public as
$$ select role from public.profiles where user_id = auth.uid() $$;

create or replace function public.my_tenant_id() returns uuid
language sql stable security definer set search_path = public as
$$ select tenant_id from public.tenant_users where user_id = auth.uid() $$;

revoke all on function public.is_staff(), public.staff_role(), public.my_tenant_id() from public, anon;
grant execute on function public.is_staff(), public.staff_role(), public.my_tenant_id() to authenticated, service_role;

-- 7. RLS на всех таблицах: снять старые политики, закрыть anon, открыть сотрудникам ─
do $$
declare t record; p record;
begin
  for t in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and c.relkind = 'r'
  loop
    execute format('alter table public.%I enable row level security', t.relname);
    for p in select polname from pg_policy where polrelid = format('public.%I', t.relname)::regclass loop
      execute format('drop policy %I on public.%I', p.polname, t.relname);
    end loop;
    execute format('revoke all on public.%I from anon', t.relname);
    if t.relname not in ('auth_tokens', 'profiles', 'tenant_users') then
      execute format('create policy staff_all on public.%I for all to authenticated using (public.is_staff()) with check (public.is_staff())', t.relname);
    end if;
  end loop;
end $$;

alter default privileges in schema public revoke all on tables from anon;

-- profiles: каждый видит свою строку, сотрудники — все; менять может только сервер
create policy profiles_select on public.profiles for select to authenticated
  using (user_id = auth.uid() or public.is_staff());
-- tenant_users: арендатор видит свою привязку, сотрудники — все и могут отвязать
create policy tenant_users_select on public.tenant_users for select to authenticated
  using (user_id = auth.uid() or public.is_staff());
create policy tenant_users_staff_delete on public.tenant_users for delete to authenticated
  using (public.is_staff());
-- auth_tokens: политик нет — доступ только у service key

-- 8. Заявки с сайта: посетитель может только оставить заявку ─────────────────
grant insert on public.site_leads to anon;
create policy site_leads_insert_public on public.site_leads for insert to anon, authenticated with check (true);

-- 9. Арендатор: только чтение своих строк ────────────────────────────────────
create policy tenant_own on public.tenants              for select to authenticated using (id = public.my_tenant_id());
create policy tenant_own on public.tenant_balances      for select to authenticated using (tenant_id = public.my_tenant_id());
create policy tenant_own on public.ledger_entries       for select to authenticated using (tenant_id = public.my_tenant_id());
create policy tenant_own on public.invoices             for select to authenticated using (tenant_id = public.my_tenant_id() and upper(status) <> 'DRAFT');
create policy tenant_own on public.contracts            for select to authenticated using (tenant_id = public.my_tenant_id());
create policy tenant_own on public.meters               for select to authenticated using (tenant_id = public.my_tenant_id());
create policy tenant_own on public.meter_readings       for select to authenticated
  using (exists (select 1 from public.meters m where m.id = meter_id and m.tenant_id = public.my_tenant_id()));
create policy tenant_own on public.units                for select to authenticated using (tenant_id = public.my_tenant_id());
create policy tenant_own on public.tenant_premises      for select to authenticated using (tenant_id = public.my_tenant_id());
create policy tenant_own on public.repairs              for select to authenticated using (tenant_id = public.my_tenant_id());
create policy tenant_own on public.tenant_notifications for select to authenticated using (tenant_id = public.my_tenant_id());

-- заявку на ремонт арендатор создаёт через функцию api/tenant-repair (служебные поля задаёт сервер)
-- уведомления: арендатор может отметить прочитанным
create policy tenant_mark_read on public.tenant_notifications for update to authenticated
  using (tenant_id = public.my_tenant_id()) with check (tenant_id = public.my_tenant_id());

-- реквизиты арендодателя нужны арендатору для оплаты
create policy tenant_read on public.landlords         for select to authenticated using (public.my_tenant_id() is not null and active is not false);
create policy tenant_read on public.landlord_accounts for select to authenticated using (public.my_tenant_id() is not null and active is not false);

-- 10. Поиск по базе знаний — только сотрудникам и серверу ────────────────────
do $$ begin
  execute (select string_agg(format('revoke execute on function %s from public, anon', p.oid::regprocedure), '; ')
           from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'search_knowledge');
exception when others then null; end $$;

-- 11. Хранилище файлов ───────────────────────────────────────────────────────
-- Документы арендаторов и сканы счетов поставщиков — закрытые бакеты, файлы по подписанным ссылкам.
insert into storage.buckets (id, name, public) values ('tenant-documents', 'tenant-documents', false)
on conflict (id) do update set public = false;
update storage.buckets set public = false where id in ('invoices', 'meter-photos');

do $$ declare p record; begin
  for p in select policyname from pg_policies where schemaname = 'storage' and tablename = 'objects' loop
    execute format('drop policy %I on storage.objects', p.policyname);
  end loop;
end $$;

create policy staff_files on storage.objects for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
-- фото помещений для сайта читаются всеми
create policy public_unit_media on storage.objects for select to anon, authenticated
  using (bucket_id = 'unit-media');
