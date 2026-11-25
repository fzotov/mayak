-- Этап 6: телефон. Push-подписки, очередь push-сообщений, фото заявок, доступ арендатора к своим файлам.
-- Отправка: триггеры кладут сообщение в push_outbox, после вставки база через pg_net дёргает
-- /api/push-dispatch; функция сама забирает неотправленное (push_claim) — в запросе нет данных,
-- поэтому вызов без секрета ничего не даёт постороннему, кроме досылки уже стоящих в очереди сообщений.

create extension if not exists pg_net with schema extensions;

-- ── Подписки ────────────────────────────────────────────────────────────────
create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  kind        text not null check (kind in ('staff', 'tenant')),
  tenant_id   uuid references public.tenants(id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  created_at  timestamptz not null default now(),
  last_ok_at  timestamptz
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
drop policy if exists own_select on public.push_subscriptions;
create policy own_select on public.push_subscriptions for select to authenticated using (user_id = auth.uid());
drop policy if exists own_delete on public.push_subscriptions;
create policy own_delete on public.push_subscriptions for delete to authenticated using (user_id = auth.uid());
-- запись только через /api/push-subscribe (сервер сам определяет kind и tenant_id)

-- ── Очередь ─────────────────────────────────────────────────────────────────
create table if not exists public.push_outbox (
  id          bigint generated always as identity primary key,
  audience    text not null check (audience in ('staff', 'tenant')),
  tenant_id   uuid references public.tenants(id) on delete cascade,
  title       text not null,
  body        text,
  url         text,
  tag         text,
  created_at  timestamptz not null default now(),
  sent_at     timestamptz,
  delivered   int,
  error       text
);
create index if not exists push_outbox_pending_idx on public.push_outbox (created_at) where sent_at is null;
alter table public.push_outbox enable row level security;
drop policy if exists staff_read on public.push_outbox;
create policy staff_read on public.push_outbox for select to authenticated using (public.is_staff());

create or replace function public._push_dispatch_url() returns text language sql immutable as
$$ select 'https://mayak-xi.vercel.app/api/push-dispatch' $$;

create or replace function public._push_kick() returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  perform net.http_post(url := public._push_dispatch_url(), body := '{}'::jsonb,
                        headers := '{"Content-Type":"application/json"}'::jsonb, timeout_milliseconds := 5000);
  return null;
exception when others then
  return null; -- очередь остаётся, досылается следующим вызовом
end $$;
drop trigger if exists push_outbox_kick on public.push_outbox;
create trigger push_outbox_kick after insert on public.push_outbox for each statement execute function public._push_kick();

-- Забрать порцию неотправленных (только сервер). Сообщения старше суток не шлём.
create or replace function public.push_claim(p_limit int default 50) returns setof public.push_outbox
language sql security definer set search_path = public as $$
  update public.push_outbox o set sent_at = now()
   where o.id in (select id from public.push_outbox
                   where sent_at is null and created_at > now() - interval '1 day'
                   order by id for update skip locked limit p_limit)
  returning o.*;
$$;
revoke all on function public.push_claim(int) from public, anon, authenticated;
grant execute on function public.push_claim(int) to service_role;

-- ── События ─────────────────────────────────────────────────────────────────
-- Любое уведомление арендатору (новый счёт, напоминание, статус заявки) уходит и push'ем.
create or replace function public._push_tenant_notification() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.push_outbox (audience, tenant_id, title, body, url, tag)
  values ('tenant', new.tenant_id, new.title, new.body,
          coalesce(nullif(new.link, ''), case when new.type ilike '%repair%' then '/tenant/repairs'
                                              when new.type ilike '%invoice%' or new.type ilike '%debt%' or new.type ilike '%remind%' then '/tenant/invoices'
                                              else '/tenant/notifications' end),
          'n-' || new.id);
  return new;
end $$;
drop trigger if exists tenant_notifications_push on public.tenant_notifications;
create trigger tenant_notifications_push after insert on public.tenant_notifications for each row execute function public._push_tenant_notification();

-- Смена статуса заявки → уведомление арендатору (в кабинет и push).
create or replace function public._repair_status_notify() returns trigger language plpgsql security definer set search_path = public as $$
declare t text;
begin
  if new.tenant_id is null or new.status is not distinct from old.status then return new; end if;
  t := case new.status when 'accepted' then 'принята' when 'in_progress' then 'в работе'
                       when 'completed' then 'выполнена' when 'rejected' then 'отклонена' else null end;
  if t is null then return new; end if;
  insert into public.tenant_notifications (tenant_id, type, title, body, link)
  values (new.tenant_id, 'repair_status', 'Заявка № ' || coalesce(new.number::text, '') || ' ' || t,
          nullif(concat_ws(' · ', new.category, nullif(new.comment, '')), ''), '/tenant/repairs');
  return new;
end $$;
drop trigger if exists repairs_status_notify on public.repairs;
create trigger repairs_status_notify after update of status on public.repairs for each row execute function public._repair_status_notify();

-- Аварийная заявка → сотрудникам.
create or replace function public._repair_emergency_push() returns trigger language plpgsql security definer set search_path = public as $$
declare who text; place text;
begin
  if new.priority is distinct from 'emergency' then return new; end if;
  if tg_op = 'UPDATE' and old.priority is not distinct from 'emergency' then return new; end if;
  select full_name into who from public.tenants where id = new.tenant_id;
  select number into place from public.units where id = new.unit_id;
  insert into public.push_outbox (audience, title, body, url, tag)
  values ('staff', 'Авария: ' || coalesce(new.category, 'заявка'),
          concat_ws(' · ', who, case when place is not null then 'пом. ' || place end, left(new.description, 140)),
          '/repairs', 'repair-' || new.id);
  return new;
end $$;
drop trigger if exists repairs_emergency_push on public.repairs;
create trigger repairs_emergency_push after insert or update of priority on public.repairs for each row execute function public._repair_emergency_push();

-- Новая заявка с сайта → сотрудникам.
create or replace function public._site_lead_push() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.push_outbox (audience, title, body, url, tag)
  values ('staff', 'Заявка с сайта',
          concat_ws(' · ', nullif(new.name, ''), nullif(new.phone, ''),
                    case when new.unit_number is not null then 'пом. ' || new.unit_number end, left(nullif(new.message, ''), 120)),
          '/site', 'lead-' || new.id);
  return new;
end $$;
drop trigger if exists site_leads_push on public.site_leads;
create trigger site_leads_push after insert on public.site_leads for each row execute function public._site_lead_push();

-- Крупное поступление → сотрудникам. Порог — настройка push_large_payment (по умолчанию 100 000 ₽).
insert into public.settings (key, value, description)
select 'push_large_payment', 100000, 'Порог push-уведомления о крупном поступлении, ₽'
where not exists (select 1 from public.settings where key = 'push_large_payment');

create or replace function public._payment_large_push() returns trigger language plpgsql security definer set search_path = public as $$
declare lim numeric; who text;
begin
  if coalesce(new.direction, 'in') <> 'in' or new.storno_of is not null then return new; end if;
  select value::numeric into lim from public.settings where key = 'push_large_payment' order by valid_from desc nulls last, created_at desc limit 1;
  if new.amount < coalesce(lim, 100000) then return new; end if;
  select full_name into who from public.tenants where id = new.tenant_id;
  insert into public.push_outbox (audience, title, body, url, tag)
  values ('staff', 'Поступление ' || replace(to_char(round(new.amount), 'FM999,999,999,990'), ',', ' ') || ' ₽',
          concat_ws(' · ', coalesce(who, 'плательщик не определён'), left(coalesce(new.purpose, new.description), 120)),
          case when new.tenant_id is not null then '/settlements/' || new.tenant_id else '/bank' end, 'pay-' || new.id);
  return new;
end $$;
drop trigger if exists payments_large_push on public.payments;
create trigger payments_large_push after insert on public.payments for each row execute function public._payment_large_push();

-- ── Фото заявок «до / после» ────────────────────────────────────────────────
alter table public.repairs add column if not exists photos_after text[];
alter table public.repairs add column if not exists accepted_at  timestamptz;

insert into storage.buckets (id, name, public) values ('repair-photos', 'repair-photos', false)
on conflict (id) do update set public = false;

-- Арендатор видит свои файлы: папка второго уровня — его tenant_id.
--   tenant-documents/tenant-docs/<tenant_id>/…   документы из карточки
--   repair-photos/tenant/<tenant_id>/…           фото к его заявкам
--   meter-photos/tenant/<tenant_id>/…            фото его показаний
drop policy if exists tenant_own_files on storage.objects;
create policy tenant_own_files on storage.objects for select to authenticated using (
  bucket_id in ('tenant-documents', 'repair-photos', 'meter-photos')
  and (storage.foldername(name))[2] = public.my_tenant_id()::text
);

-- Арендатор видит список своих документов из карточки.
drop policy if exists tenant_own on public.tenant_documents;
create policy tenant_own on public.tenant_documents for select to authenticated using (tenant_id = public.my_tenant_id());
