-- ─────────────────────────────────────────────────────────────────────────────
-- Публичный сайт mayak-d.ru: заявки, медиа помещений, права доступа.
-- Выполнить один раз в Supabase → SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Дополнительные поля помещений для сайта ─────────────────────────────────
alter table public.units add column if not exists video_url    text;
alter table public.units add column if not exists is_published boolean not null default true;

comment on column public.units.video_url    is 'Видео помещения: файл в бакете unit-media или ссылка YouTube/VK/Rutube';
comment on column public.units.is_published is 'Показывать помещение на публичном сайте (если оно свободно)';

-- 2. Заявки с сайта ──────────────────────────────────────────────────────────
create table if not exists public.site_leads (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  name         text,
  phone        text not null,
  email        text,
  message      text,
  unit_number  text,                       -- какое помещение смотрел посетитель
  area_wanted  numeric,                    -- желаемая площадь из калькулятора
  source       text default 'site',        -- форма: hero / unit / calc / contacts
  page_url     text,
  status       text not null default 'new' -- new | in_work | done | spam
);

create index if not exists site_leads_created_idx on public.site_leads (created_at desc);
create index if not exists site_leads_status_idx  on public.site_leads (status);

alter table public.site_leads enable row level security;

-- посетитель сайта (anon) может только оставить заявку
drop policy if exists site_leads_insert_anon on public.site_leads;
create policy site_leads_insert_anon on public.site_leads
  for insert to anon, authenticated with check (true);

-- читают и ведут заявки только сотрудники (вошедшие в админку)
drop policy if exists site_leads_select_auth on public.site_leads;
create policy site_leads_select_auth on public.site_leads
  for select to authenticated using (true);

drop policy if exists site_leads_update_auth on public.site_leads;
create policy site_leads_update_auth on public.site_leads
  for update to authenticated using (true) with check (true);

drop policy if exists site_leads_delete_auth on public.site_leads;
create policy site_leads_delete_auth on public.site_leads
  for delete to authenticated using (true);

-- 3. Бакет с фото и видео помещений ──────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'unit-media', 'unit-media', true, 52428800,
  array['image/jpeg','image/png','image/webp','image/avif','video/mp4','video/webm','video/quicktime']
)
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- читать медиа может кто угодно (это витрина сайта)
drop policy if exists unit_media_read on storage.objects;
create policy unit_media_read on storage.objects
  for select to anon, authenticated using (bucket_id = 'unit-media');

-- загружать и удалять — только сотрудники
drop policy if exists unit_media_insert on storage.objects;
create policy unit_media_insert on storage.objects
  for insert to authenticated with check (bucket_id = 'unit-media');

drop policy if exists unit_media_update on storage.objects;
create policy unit_media_update on storage.objects
  for update to authenticated using (bucket_id = 'unit-media') with check (bucket_id = 'unit-media');

drop policy if exists unit_media_delete on storage.objects;
create policy unit_media_delete on storage.objects
  for delete to authenticated using (bucket_id = 'unit-media');
