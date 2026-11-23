-- ─────────────────────────────────────────────────────────────────────────────
-- Роли сотрудников. В бизнес-центре работают двое: владелец и управляющая.
-- Оба видят и ведут всё; владелец дополнительно выдаёт и отзывает доступ
-- (это проверяет функция api/staff-invite.js).
-- Отменяет промежуточный вариант с техником и бухгалтером от 23.11.2026.
-- Выполнять после 20261123_security.sql. Скрипт можно выполнять повторно.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.profiles drop constraint if exists profiles_role_check;
update public.profiles set role = 'manager' where role not in ('owner', 'manager');
alter table public.profiles add constraint profiles_role_check check (role in ('owner', 'manager'));

do $$
declare t text;
begin
  for t in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and c.relkind = 'r'
             and c.relname not in ('auth_tokens', 'profiles', 'tenant_users')
  loop
    execute format('drop policy if exists staff_all on public.%I', t);
    execute format('drop policy if exists staff_read on public.%I', t);
    execute format('drop policy if exists office_write on public.%I', t);
    execute format('create policy staff_all on public.%I for all to authenticated using (public.is_staff()) with check (public.is_staff())', t);
  end loop;
end $$;

drop policy if exists tenant_users_staff_delete on public.tenant_users;
create policy tenant_users_staff_delete on public.tenant_users for delete to authenticated using (public.is_staff());

drop policy if exists staff_files on storage.objects;
drop policy if exists staff_files_ops on storage.objects;
drop policy if exists office_files on storage.objects;
create policy staff_files on storage.objects for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

drop function if exists public.is_office();
