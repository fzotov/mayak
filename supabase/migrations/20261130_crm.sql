-- Этап 7: CRM — продолжение «Сайт и заявки».
-- Сделка ведёт клиента от заявки до заселения (kind = new) или действующего арендатора к продлению (kind = renewal).
-- У каждой открытой сделки обязателен следующий шаг с датой (ограничение deals_next_step).

create table if not exists public.deals (
  id               uuid primary key default gen_random_uuid(),
  number           bigint generated always as identity,
  kind             text not null default 'new' check (kind in ('new', 'renewal')),
  stage            text not null default 'new' check (stage in ('new', 'contacted', 'viewing', 'offer', 'contract', 'won', 'lost')),
  lost_reason      text,
  name             text,                -- контактное лицо
  company          text,
  phone            text,
  email            text,
  source           text not null default 'other' check (source in ('site', 'call', 'visit', 'telegram', 'referral', 'tenant', 'other')),
  source_detail    text,                -- форма/страница сайта, рекламный канал
  lead_id          uuid unique references public.site_leads(id) on delete set null,
  tenant_id        uuid references public.tenants(id) on delete set null,  -- действующий (renewal) или заселённый (won)
  lease_id         uuid references public.leases(id) on delete set null,   -- договор, который продлеваем
  area_wanted      numeric,           -- м²
  budget           numeric,
  notes            text,
  owner_id         uuid references auth.users(id) on delete set null,
  next_step        text,
  next_step_at     date,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  stage_changed_at timestamptz not null default now(),
  closed_at        timestamptz,
  constraint deals_next_step check (stage in ('won', 'lost') or (nullif(btrim(next_step), '') is not null and next_step_at is not null)),
  constraint deals_lost_reason check (stage <> 'lost' or nullif(btrim(lost_reason), '') is not null)
);
alter table public.deals alter column area_wanted type numeric using nullif(area_wanted::text, '')::numeric;
create index if not exists deals_open_idx on public.deals (next_step_at) where stage not in ('won', 'lost');
create index if not exists deals_tenant_idx on public.deals (tenant_id);
create unique index if not exists deals_open_renewal_uq on public.deals (lease_id) where kind = 'renewal' and stage not in ('won', 'lost');

create table if not exists public.deal_units (
  deal_id uuid not null references public.deals(id) on delete cascade,
  unit_id uuid not null references public.units(id) on delete cascade,
  primary key (deal_id, unit_id)
);

-- Касания и журнал обращений. Привязка к сделке и/или к арендатору (журнал действующих арендаторов).
create table if not exists public.deal_events (
  id              uuid primary key default gen_random_uuid(),
  deal_id         uuid references public.deals(id) on delete cascade,
  tenant_id       uuid references public.tenants(id) on delete cascade,
  kind            text not null check (kind in ('call', 'visit', 'viewing', 'email', 'message', 'meeting', 'note', 'stage', 'system')),
  text            text,
  stage_from      text,
  stage_to        text,
  created_by      uuid default auth.uid(),
  created_by_name text,
  created_at      timestamptz not null default now(),
  check (deal_id is not null or tenant_id is not null)
);
create index if not exists deal_events_deal_idx on public.deal_events (deal_id, created_at desc);
create index if not exists deal_events_tenant_idx on public.deal_events (tenant_id, created_at desc);

do $$ declare t text; begin
  foreach t in array array['deals', 'deal_units', 'deal_events'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists staff_all on public.%I', t);
    execute format('create policy staff_all on public.%I for all to authenticated using (public.is_staff()) with check (public.is_staff())', t);
  end loop;
end $$;

-- Имя автора касания — из профиля сотрудника.
create or replace function public._deal_event_author() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.created_by_name is null and new.created_by is not null then
    select full_name into new.created_by_name from public.profiles where user_id = new.created_by;
  end if;
  if new.tenant_id is null and new.deal_id is not null then
    select tenant_id into new.tenant_id from public.deals where id = new.deal_id;
  end if;
  return new;
end $$;
drop trigger if exists deal_events_author on public.deal_events;
create trigger deal_events_author before insert on public.deal_events for each row execute function public._deal_event_author();

-- Служебные поля сделки и запись смены этапа.
create or replace function public._deal_touch() returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  if tg_op = 'INSERT' and new.owner_id is null then new.owner_id := auth.uid(); end if;
  if tg_op = 'UPDATE' and new.stage is distinct from old.stage then
    new.stage_changed_at := now();
    new.closed_at := case when new.stage in ('won', 'lost') then now() else null end;
  end if;
  return new;
end $$;
drop trigger if exists deals_touch on public.deals;
create trigger deals_touch before insert or update on public.deals for each row execute function public._deal_touch();

create or replace function public._deal_log() returns trigger language plpgsql security definer set search_path = public as $$
declare names jsonb := '{"new":"Новая","contacted":"Связались","viewing":"Показ","offer":"Предложение","contract":"Договор","won":"Заселён","lost":"Отказ"}';
begin
  if tg_op = 'INSERT' then
    insert into public.deal_events (deal_id, tenant_id, kind, text, stage_to)
    values (new.id, new.tenant_id, 'system',
            case new.kind when 'renewal' then 'Сделка по продлению договора создана' else 'Сделка создана' end, new.stage);
  elsif new.stage is distinct from old.stage then
    insert into public.deal_events (deal_id, tenant_id, kind, text, stage_from, stage_to)
    values (new.id, new.tenant_id, 'stage',
            (names ->> old.stage) || ' → ' || (names ->> new.stage) || case when new.stage = 'lost' then ': ' || new.lost_reason else '' end,
            old.stage, new.stage);
    -- заявка с сайта следует за сделкой
    if new.lead_id is not null then
      update public.site_leads set status = case when new.stage in ('won', 'lost') then 'done' else 'in_work' end where id = new.lead_id;
    end if;
    -- заселение: помещения сделки заняты
    if new.stage = 'won' and new.kind = 'new' and new.tenant_id is not null then
      update public.units set status = 'occupied', tenant_id = new.tenant_id
       where id in (select unit_id from public.deal_units where deal_id = new.id) and (tenant_id is null or tenant_id = new.tenant_id);
    end if;
  end if;
  return null;
end $$;
drop trigger if exists deals_log on public.deals;
create trigger deals_log after insert or update on public.deals for each row execute function public._deal_log();

-- ── Заявка с сайта → сделка ─────────────────────────────────────────────────
create or replace function public._lead_to_deal(l public.site_leads) returns uuid language plpgsql security definer set search_path = public as $$
declare d uuid;
begin
  insert into public.deals (kind, stage, name, phone, email, source, source_detail, lead_id, area_wanted, notes, next_step, next_step_at, created_at)
  values ('new', case when l.status in ('in_work') then 'contacted' else 'new' end,
          nullif(l.name, ''), nullif(l.phone, ''), nullif(l.email, ''), 'site',
          concat_ws(' · ', nullif(l.source, ''), nullif(l.page_url, '')), l.id, l.area_wanted, nullif(l.message, ''),
          'Связаться с клиентом', greatest(l.created_at::date, current_date), l.created_at)
  on conflict (lead_id) do nothing
  returning id into d;
  if d is not null and l.unit_number is not null then
    insert into public.deal_units (deal_id, unit_id)
    select d, u.id from public.units u where u.number = l.unit_number on conflict do nothing;
  end if;
  return d;
end $$;

create or replace function public._site_lead_deal() returns trigger language plpgsql security definer set search_path = public as $$
begin perform public._lead_to_deal(new); return new; end $$;
drop trigger if exists site_leads_deal on public.site_leads;
create trigger site_leads_deal after insert on public.site_leads for each row execute function public._site_lead_deal();

-- существующие необработанные заявки
select public._lead_to_deal(l) from public.site_leads l where coalesce(l.status, 'new') <> 'done';

-- ── Продления: за 60 и за 30 дней до конца договора ─────────────────────────
create or replace function public.crm_sync_renewals() returns int language plpgsql security definer set search_path = public as $$
declare r record; n int := 0; d uuid;
begin
  if not (public.is_staff() or auth.role() = 'service_role' or session_user = 'postgres') then raise exception 'Нет доступа'; end if;
  -- 60 дней: открыть сделку
  for r in
    select l.id lease_id, l.tenant_id, l.end_date, l.number, t.full_name, coalesce(t.contact_name, t.director_name) contact,
           coalesce(nullif(t.contact_phone, ''), t.phone) phone, coalesce(nullif(t.contact_email, ''), t.email) email
      from public.leases l join public.tenants t on t.id = l.tenant_id
     where l.status = 'active' and l.end_date between current_date and current_date + 60
       and not exists (select 1 from public.deals x where x.lease_id = l.id and x.kind = 'renewal')
  loop
    insert into public.deals (kind, stage, company, name, phone, email, source, tenant_id, lease_id, next_step, next_step_at)
    values ('renewal', 'new', r.full_name, r.contact, r.phone, r.email, 'tenant', r.tenant_id, r.lease_id,
            'Обсудить продление и индексацию ставки', current_date)
    returning id into d;
    insert into public.deal_units (deal_id, unit_id) select d, unit_id from public.leases where id = r.lease_id and unit_id is not null on conflict do nothing;
    insert into public.push_outbox (audience, title, body, url, tag)
    values ('staff', 'Договор заканчивается через ' || (r.end_date - current_date) || ' дн.', r.full_name, '/deals/' || d, 'renew-' || r.lease_id);
    n := n + 1;
  end loop;
  -- 30 дней: напомнить по открытой сделке
  for r in
    select x.id, x.company, l.end_date from public.deals x join public.leases l on l.id = x.lease_id
     where x.kind = 'renewal' and x.stage not in ('won', 'lost') and l.end_date <= current_date + 30
       and not exists (select 1 from public.deal_events e where e.deal_id = x.id and e.kind = 'system' and e.text like 'До конца договора 30%')
  loop
    insert into public.deal_events (deal_id, kind, text) values (r.id, 'system', 'До конца договора 30 дней или меньше (' || to_char(r.end_date, 'DD.MM.YYYY') || ')');
    update public.deals set next_step_at = least(next_step_at, current_date) where id = r.id;
    insert into public.push_outbox (audience, title, body, url, tag)
    values ('staff', 'До конца договора ' || (r.end_date - current_date) || ' дн.', r.company, '/deals/' || r.id, 'renew30-' || r.id);
    n := n + 1;
  end loop;
  return n;
end $$;
grant execute on function public.crm_sync_renewals() to authenticated;

-- ежедневно в 06:00 UTC (09:00 МСК), если pg_cron доступен
do $$ begin
  create extension if not exists pg_cron;
  perform cron.unschedule('crm_sync_renewals') where exists (select 1 from cron.job where jobname = 'crm_sync_renewals');
  perform cron.schedule('crm_sync_renewals', '0 6 * * *', 'select public.crm_sync_renewals()');
exception when others then raise notice 'pg_cron недоступен: продления синхронизируются при открытии раздела «Сделки»';
end $$;

-- ── Отчёт ───────────────────────────────────────────────────────────────────
-- Воронка по источникам за период (по дате создания сделки): сколько дошло до показа, до договора, заселено, средний срок.
create or replace function public.crm_funnel(p_from date, p_to date)
returns table (source text, deals int, viewings int, contracts int, won int, lost int, avg_days_to_won numeric)
language sql stable security invoker set search_path = public as $$
  with d as (
    select x.*,
      exists (select 1 from public.deal_events e where e.deal_id = x.id and e.stage_to in ('viewing', 'offer', 'contract', 'won')) or x.stage in ('viewing', 'offer', 'contract', 'won') as reached_viewing,
      exists (select 1 from public.deal_events e where e.deal_id = x.id and e.stage_to in ('contract', 'won')) or x.stage in ('contract', 'won') as reached_contract
    from public.deals x where x.kind = 'new' and x.created_at::date between p_from and p_to
  )
  select source, count(*)::int, count(*) filter (where reached_viewing)::int, count(*) filter (where reached_contract)::int,
         count(*) filter (where stage = 'won')::int, count(*) filter (where stage = 'lost')::int,
         round(avg(extract(epoch from closed_at - created_at) / 86400) filter (where stage = 'won'), 1)
    from d group by source order by count(*) desc;
$$;

-- Простой свободных помещений: свободно с конца последнего договора. Если договоров по помещению не было — неизвестно (null).
create or replace function public.crm_vacancy()
returns table (unit_id uuid, number text, floor int, area numeric, free_since date, days_free int, open_deals int)
language sql stable security invoker set search_path = public as $$
  select u.id, u.number::text, u.floor::int, u.area, f.since, current_date - f.since,
         (select count(*)::int from public.deal_units du join public.deals d on d.id = du.deal_id where du.unit_id = u.id and d.stage not in ('won', 'lost'))
    from public.units u
    left join lateral (select max(l.end_date) since from public.leases l where l.unit_id = u.id and l.end_date <= current_date) f on true
   where u.status = 'free'
   order by 6 desc nulls last;
$$;
grant execute on function public.crm_funnel(date, date), public.crm_vacancy() to authenticated;

-- служебная функция вызывается только триггером
revoke all on function public._lead_to_deal(public.site_leads) from public, anon, authenticated;
