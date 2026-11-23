-- ─────────────────────────────────────────────────────────────────────────────
-- Права сотрудников по ролям на уровне базы.
-- Владелец, управляющий, бухгалтер — всё. Техник — эксплуатация:
--   читает справочники, арендаторов и помещения (нужны для заявок и плана этажей),
--   ведёт заявки, счётчики, склад, задачи и базу знаний,
--   не видит деньги, договоры, документы арендаторов и доступы.
-- Выполнять после 20261123_security.sql. Скрипт можно выполнять повторно.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.is_office() returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.profiles where user_id = auth.uid() and role in ('owner','manager','accountant')) $$;
revoke all on function public.is_office() from public, anon;
grant execute on function public.is_office() to authenticated, service_role;

do $$
declare
  t text;
  -- техник: чтение и запись
  tech_rw text[] := array['repairs','repair_history','meters','meter_readings','inventory','inventory_movements',
                          'inventory_categories','tasks','kb_articles','knowledge_base'];
  -- техник: только чтение
  tech_ro text[] := array['tenants','units','buildings','tenant_premises','staff','service_categories','service_units',
                          'services','counterparties','counterparty_categories','letters','site_leads','advertising_slots'];
begin
  for t in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and c.relkind = 'r'
             and exists (select 1 from pg_policy p where p.polrelid = c.oid and p.polname = 'staff_all')
  loop
    execute format('drop policy if exists staff_all on public.%I', t);
    execute format('drop policy if exists staff_read on public.%I', t);
    execute format('drop policy if exists office_write on public.%I', t);
    if t = any(tech_rw) then
      execute format('create policy staff_all on public.%I for all to authenticated using (public.is_staff()) with check (public.is_staff())', t);
    elsif t = any(tech_ro) then
      execute format('create policy staff_read on public.%I for select to authenticated using (public.is_staff())', t);
      execute format('create policy office_write on public.%I for all to authenticated using (public.is_office()) with check (public.is_office())', t);
    else
      -- деньги, договоры, документы, настройки — только офис
      execute format('create policy staff_all on public.%I for all to authenticated using (public.is_office()) with check (public.is_office())', t);
    end if;
  end loop;
end $$;

-- tenant_users: отвязать арендатора от кабинета может только офис
drop policy if exists tenant_users_staff_delete on public.tenant_users;
create policy tenant_users_staff_delete on public.tenant_users for delete to authenticated using (public.is_office());

-- Хранилище: фото счётчиков и помещений — всем сотрудникам; счета поставщиков и документы арендаторов — офису
drop policy if exists staff_files on storage.objects;
drop policy if exists staff_files_ops on storage.objects;
drop policy if exists office_files on storage.objects;
create policy staff_files_ops on storage.objects for all to authenticated
  using (public.is_staff() and bucket_id in ('meter-photos', 'unit-media'))
  with check (public.is_staff() and bucket_id in ('meter-photos', 'unit-media'));
create policy office_files on storage.objects for all to authenticated
  using (public.is_office()) with check (public.is_office());
