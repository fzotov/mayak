-- Этап 3: перенос из 1С. Выгрузка debts.xml (разбор — api/_lib/onecXml.js) кладётся в промежуточные таблицы,
-- арендаторы и договоры сопоставляются (без автосоздания арендаторов), входящие остатки разбиваются по статьям
-- по правилам onec_article_rules и проводятся на дату перехода. Сверка «Маяк = 1С» до копейки — onec_reconcile.
-- Ошибочно проведённые остатки отменяются сторно (onec_opening_storno), а не удалением.

create table if not exists public.onec_imports (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  created_by      uuid default auth.uid(),
  source          text not null check (source in ('http', 'file', 'test')),
  as_of           date,
  meta            jsonb,
  totals          jsonb,
  status          text not null default 'staged' check (status in ('staged', 'posted', 'reversed')),
  transition_date date,
  posted_at       timestamptz,
  posted_by       uuid,
  post_result     jsonb
);

create table if not exists public.onec_counterparties (
  import_id  uuid not null references public.onec_imports(id) on delete cascade,
  cp_id      text not null,
  name       text,
  inn        text,
  kpp        text,
  debt       numeric(14,2) not null default 0,
  advance    numeric(14,2) not null default 0,
  deposit    numeric(14,2) not null default 0,
  tenant_id  uuid references public.tenants(id) on delete set null,
  match_by   text check (match_by in ('id_1c', 'inn', 'manual', 'inn_ambiguous')),
  primary key (import_id, cp_id)
);

create table if not exists public.onec_contracts (
  import_id   uuid not null references public.onec_imports(id) on delete cascade,
  cp_id       text not null,
  contract_id text not null,
  name        text,
  number      text,
  date        date,
  kind        text,
  debt        numeric(14,2) not null default 0,
  advance     numeric(14,2) not null default 0,
  deposit     numeric(14,2) not null default 0,
  lease_id    uuid references public.leases(id) on delete set null,
  lease_match text check (lease_match in ('number', 'manual', 'created')),
  primary key (import_id, cp_id, contract_id)
);

create table if not exists public.onec_docs (
  import_id   uuid not null references public.onec_imports(id) on delete cascade,
  cp_id       text not null,
  contract_id text not null,
  doc_id      text not null,
  type        text,
  number      text,
  date        date,
  debt        numeric(14,2) not null default 0,
  advance     numeric(14,2) not null default 0,
  account     text,
  lines       jsonb not null default '[]',
  primary key (import_id, cp_id, contract_id, doc_id)
);

-- Правила разбивки по статьям. Поле: item — номенклатура строки (выгрузка v2), contract — наименование договора,
-- doc_type — вид документа, account — счёт учёта. pattern — регулярное выражение без учёта регистра.
create table if not exists public.onec_article_rules (
  id           serial primary key,
  priority     int  not null default 100,
  field        text not null check (field in ('item', 'contract', 'doc_type', 'account')),
  pattern      text not null,
  article_code text not null references public.accounting_articles(code),
  note         text,
  unique (field, pattern)
);
insert into public.onec_article_rules (priority, field, pattern, article_code, note) values
  (10, 'account',  '^76\.0?6',                          'DEPOSIT',    'обеспечительные платежи (уточнить счёт у бухгалтера)'),
  (10, 'item',     'обеспеч|гарантийн|депозит|залог',   'DEPOSIT',    null),
  (20, 'item',     'пени|неустойк',                     'PENALTY',    null),
  (20, 'item',     'штраф',                             'FINE',       null),
  (30, 'item',     'электро|э/э|квт',                   'ELEC',       null),
  (30, 'item',     'горяч',                             'HWATER',     null),
  (31, 'item',     'вод|водоснаб|водоотвед|канализ',    'CWATER',     null),
  (30, 'item',     'тепл|отоплен|гкал',                 'HEAT',       null),
  (30, 'item',     'мусор|тбо|коммунал',                'UTIL_OTHER', null),
  (40, 'item',     'уборк|клининг',                     'CLEAN',      null),
  (50, 'item',     'стел',                              'AD_STELE',   null),
  (51, 'item',     'реклам|вывеск|баннер|фасад',        'AD_OTHER',   null),
  (60, 'item',     'аренд',                             'RENT',       null),
  (70, 'item',     'услуг',                             'SERVICE',    null),
  (80, 'contract', 'обеспеч|гарантийн|депозит|залог',   'DEPOSIT',    null),
  (81, 'contract', 'стел',                              'AD_STELE',   null),
  (82, 'contract', 'реклам',                            'AD_OTHER',   null),
  (90, 'doc_type', 'пени|неустойк',                     'PENALTY',    null)
on conflict (field, pattern) do nothing;
-- Договор аренды сам по себе не даёт статью: в акте по нему бывает и аренда, и коммунальные, и уборка.
-- Без строк номенклатуры (выгрузка v1) такой остаток идёт на «Входящий остаток из 1С без разбивки» (OPENING).

do $$ declare t text; begin
  foreach t in array array['onec_imports', 'onec_counterparties', 'onec_contracts', 'onec_docs', 'onec_article_rules'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists staff_read on public.%I', t);
    execute format('create policy staff_read on public.%I for select to authenticated using (public.is_staff())', t);
  end loop;
  drop policy if exists owner_write on public.onec_article_rules;
  create policy owner_write on public.onec_article_rules for all to authenticated
    using (public.staff_role() = 'owner') with check (public.staff_role() = 'owner');
end $$;

create or replace function public._onec_owner() returns void language plpgsql stable security definer set search_path = public as $$
begin
  if public.staff_role() = 'owner' or coalesce(auth.role(), '') = 'service_role' or session_user = 'postgres' then return; end if;
  raise exception 'Перенос из 1С проводит только владелец' using errcode = '42501';
end $$;

create or replace function public._onec_norm(p text) returns text language sql immutable as
$$ select nullif(regexp_replace(lower(coalesce(p, '')), '[\s№.]|г$', '', 'g'), '') $$;

-- ── Загрузка выгрузки ───────────────────────────────────────────────────────
create or replace function public.onec_stage(p jsonb) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; cp jsonb; ct jsonb; d jsonb; v_t uuid; v_by text; v_n int; v_lease uuid;
begin
  perform public._acc_guard();
  insert into public.onec_imports (source, as_of, meta, totals)
  values (coalesce(p->>'source', 'file'), nullif(p->'meta'->>'asOf', '')::date, p->'meta',
          jsonb_build_object('counterparties', jsonb_array_length(coalesce(p->'counterparties', '[]'))))
  returning id into v_id;

  for cp in select * from jsonb_array_elements(coalesce(p->'counterparties', '[]')) loop
    v_t := null; v_by := null;
    select id into v_t from public.tenants where id_1c = cp->>'id' and coalesce(cp->>'id', '') <> '' limit 1;
    if v_t is not null then v_by := 'id_1c';
    elsif coalesce(cp->>'inn', '') <> '' then
      select count(*), min(id::text)::uuid into v_n, v_t from public.tenants where inn = cp->>'inn';
      if v_n = 1 then v_by := 'inn'; elsif v_n > 1 then v_t := null; v_by := 'inn_ambiguous'; else v_t := null; end if;
    end if;
    insert into public.onec_counterparties (import_id, cp_id, name, inn, kpp, debt, advance, deposit, tenant_id, match_by)
    values (v_id, cp->>'id', cp->>'name', nullif(cp->>'inn', ''), nullif(cp->>'kpp', ''),
            coalesce((cp->>'debt')::numeric, 0), coalesce((cp->>'advance')::numeric, 0), coalesce((cp->>'deposit')::numeric, 0), v_t, v_by)
    on conflict do nothing;

    for ct in select * from jsonb_array_elements(coalesce(cp->'contracts', '[]')) loop
      v_lease := null;
      if v_t is not null and public._onec_norm(ct->>'number') is not null then
        select id into v_lease from public.leases where tenant_id = v_t and public._onec_norm(number) = public._onec_norm(ct->>'number') limit 1;
      end if;
      insert into public.onec_contracts (import_id, cp_id, contract_id, name, number, date, kind, debt, advance, deposit, lease_id, lease_match)
      values (v_id, cp->>'id', coalesce(nullif(ct->>'id', ''), 'none'), ct->>'name', nullif(ct->>'number', ''), nullif(ct->>'date', '')::date, ct->>'kind',
              coalesce((ct->>'debt')::numeric, 0), coalesce((ct->>'advance')::numeric, 0), coalesce((ct->>'deposit')::numeric, 0),
              v_lease, case when v_lease is not null then 'number' end)
      on conflict do nothing;
      for d in select * from jsonb_array_elements(coalesce(ct->'docs', '[]')) loop
        insert into public.onec_docs (import_id, cp_id, contract_id, doc_id, type, number, date, debt, advance, account, lines)
        values (v_id, cp->>'id', coalesce(nullif(ct->>'id', ''), 'none'), d->>'id', d->>'type', d->>'number', nullif(d->>'date', '')::date,
                coalesce((d->>'debt')::numeric, 0), coalesce((d->>'advance')::numeric, 0), nullif(d->>'account', ''), coalesce(d->'lines', '[]'))
        on conflict do nothing;
      end loop;
    end loop;
  end loop;

  update public.onec_imports i set totals = i.totals || (
    select jsonb_build_object('debt', coalesce(sum(debt), 0), 'advance', coalesce(sum(advance), 0), 'deposit', coalesce(sum(deposit), 0),
                              'matched', count(*) filter (where tenant_id is not null), 'unmatched', count(*) filter (where tenant_id is null))
      from public.onec_counterparties where import_id = v_id)
   where i.id = v_id;
  perform public._acc_audit('onec.stage', 'onec_imports', v_id, p->'meta');
  return v_id;
end $$;

-- Ручная привязка: контрагент 1С → арендатор (запоминается в tenants.id_1c), договор 1С → договор Маяка.
create or replace function public.onec_link_tenant(p_import uuid, p_cp text, p_tenant uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_old text;
begin
  perform public._acc_guard();
  -- отвязка: снять запомненную связь у прежнего арендатора
  update public.tenants set id_1c = null
   where id = (select tenant_id from public.onec_counterparties where import_id = p_import and cp_id = p_cp)
     and id_1c = p_cp and (p_tenant is null or id <> p_tenant);
  if p_tenant is not null then
    select id_1c into v_old from public.tenants where id = p_tenant;
    if v_old is not null and v_old <> p_cp then raise exception 'Арендатор уже связан с другим контрагентом 1С (%)', v_old; end if;
    update public.tenants set id_1c = p_cp where id = p_tenant;
  end if;
  update public.onec_counterparties set tenant_id = p_tenant, match_by = case when p_tenant is null then null else 'manual' end
   where import_id = p_import and cp_id = p_cp;
  -- договоры этого контрагента сопоставить заново по номеру
  update public.onec_contracts c set lease_id = l.id, lease_match = 'number'
    from public.leases l
   where c.import_id = p_import and c.cp_id = p_cp and c.lease_id is null and l.tenant_id = p_tenant
     and public._onec_norm(l.number) = public._onec_norm(c.number);
end $$;

create or replace function public.onec_link_contract(p_import uuid, p_cp text, p_contract text, p_lease uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public._acc_guard();
  if p_lease is not null and not exists (
    select 1 from public.leases l join public.onec_counterparties c on c.tenant_id = l.tenant_id
     where l.id = p_lease and c.import_id = p_import and c.cp_id = p_cp) then
    raise exception 'Договор принадлежит другому арендатору';
  end if;
  update public.onec_contracts set lease_id = p_lease, lease_match = case when p_lease is null then null else 'manual' end
   where import_id = p_import and cp_id = p_cp and contract_id = p_contract;
end $$;

-- Договоры из 1С → leases: номер и дата из 1С; помещения и ставки остаются из Маяка.
-- Договоры 1С без пары (аренда и реклама) у сопоставленных арендаторов создаются без строк — помещения и ставки заполнить вручную.
create or replace function public.onec_apply_contracts(p_import uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r record; v_lease uuid; n_upd int := 0; n_new int := 0;
begin
  perform public._onec_owner();
  for r in select c.*, cp.tenant_id from public.onec_contracts c join public.onec_counterparties cp using (import_id, cp_id)
            where c.import_id = p_import and cp.tenant_id is not null loop
    if r.lease_id is not null then
      update public.leases set number = coalesce(r.number, number), start_date = coalesce(r.date, start_date), updated_at = now()
       where id = r.lease_id and (number is distinct from coalesce(r.number, number) or start_date is distinct from coalesce(r.date, start_date));
      if found then n_upd := n_upd + 1; end if;
    elsif r.kind in ('rent', 'ad', 'other') and r.number is not null then
      insert into public.leases (tenant_id, number, start_date, status, notes)
      values (r.tenant_id, r.number, r.date, 'active', 'Создан из 1С (' || r.name || '): заполнить помещения и ставки')
      returning id into v_lease;
      update public.onec_contracts set lease_id = v_lease, lease_match = 'created'
       where import_id = p_import and cp_id = r.cp_id and contract_id = r.contract_id;
      n_new := n_new + 1;
    end if;
  end loop;
  perform public._acc_audit('onec.contracts', 'onec_imports', p_import, jsonb_build_object('updated', n_upd, 'created', n_new));
  return jsonb_build_object('updated', n_upd, 'created', n_new);
end $$;

-- ── Статья по правилам ──────────────────────────────────────────────────────
create or replace function public._onec_article(p_item text, p_contract text, p_doc_type text, p_account text) returns text
language sql stable security definer set search_path = public as $$
  select coalesce((
    select r.article_code from public.onec_article_rules r
     where (r.field = 'item' and p_item is not null and p_item ~* r.pattern)
        or (r.field = 'account' and p_account is not null and p_account ~* r.pattern)
        or (r.field = 'contract' and p_contract is not null and p_contract ~* r.pattern)
        or (r.field = 'doc_type' and p_doc_type is not null and p_doc_type ~* r.pattern)
     order by case r.field when 'item' then 0 when 'account' then 0 else 1 end, r.priority, r.id
     limit 1), 'OPENING')
$$;

-- Строки входящих остатков. kind: charge — долг по статье, advance — переплата, deposit — полученный депозит.
create or replace function public.onec_opening_lines(p_import uuid)
returns table (cp_id text, cp_name text, tenant_id uuid, tenant_name text, contract_id text, contract_name text, lease_id uuid,
               doc_id text, doc_label text, kind text, article_code text, article_name text, amount numeric, rule text)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare d record; ln jsonb; v_sum numeric; v_left numeric; v_part numeric; v_i int; v_n int; v_art text;
begin
  perform public._acc_guard();
  for d in
    select cp.cp_id, cp.name cp_name, cp.tenant_id, t.full_name tenant_name, c.contract_id, c.name contract_name, c.lease_id,
           c.deposit c_deposit, c.debt c_debt, c.advance c_advance,
           o.doc_id, coalesce(o.type || ' № ' || nullif(o.number, '') || ' от ' || to_char(o.date, 'DD.MM.YYYY'), o.type, 'остаток по договору') doc_label,
           o.debt, o.advance, o.account, o.type doc_type, coalesce(o.lines, '[]') lines,
           (select count(*) from public.onec_docs x where x.import_id = c.import_id and x.cp_id = c.cp_id and x.contract_id = c.contract_id) n_docs
      from public.onec_contracts c
      join public.onec_counterparties cp using (import_id, cp_id)
      left join public.tenants t on t.id = cp.tenant_id
      left join public.onec_docs o on o.import_id = c.import_id and o.cp_id = c.cp_id and o.contract_id = c.contract_id
     where c.import_id = p_import
     order by cp.name, c.name, o.date, o.doc_id
  loop
    -- депозит, полученный по договору (выгрузка v2) — одной строкой на договор, при первом документе
    if d.c_deposit > 0 and (d.doc_id is null or d.doc_id = (select min(x.doc_id) from public.onec_docs x where x.import_id = p_import and x.cp_id = d.cp_id and x.contract_id = d.contract_id)) then
      cp_id := d.cp_id; cp_name := d.cp_name; tenant_id := d.tenant_id; tenant_name := d.tenant_name; contract_id := d.contract_id;
      contract_name := d.contract_name; lease_id := d.lease_id; doc_id := 'deposit'; doc_label := 'Депозит по договору';
      kind := 'deposit'; article_code := 'DEPOSIT'; article_name := 'Обеспечительный платёж'; amount := d.c_deposit; rule := 'Contract/@deposit';
      return next;
    end if;
    cp_id := d.cp_id; cp_name := d.cp_name; tenant_id := d.tenant_id; tenant_name := d.tenant_name; contract_id := d.contract_id;
    contract_name := d.contract_name; lease_id := d.lease_id;
    if d.doc_id is null then
      -- у договора нет документов — берём сальдо договора
      doc_id := 'contract'; doc_label := 'Сальдо по договору';
      if d.c_debt > 0 then
        v_art := public._onec_article(null, d.contract_name, null, null);
        kind := 'charge'; article_code := v_art; select name into article_name from public.accounting_articles where code = v_art;
        amount := d.c_debt; rule := case when v_art = 'OPENING' then 'нет разбивки' else 'по договору' end; return next;
      end if;
      if d.c_advance > 0 then kind := 'advance'; article_code := null; article_name := 'Переплата (аванс)'; amount := d.c_advance; rule := null; return next; end if;
      continue;
    end if;
    doc_id := d.doc_id; doc_label := d.doc_label;
    if d.advance > 0 then
      kind := 'advance'; article_code := null; article_name := 'Переплата (аванс)'; amount := d.advance; rule := null; return next;
    end if;
    if d.debt > 0 then
      v_n := jsonb_array_length(d.lines);
      select coalesce(sum((x->>'amount')::numeric), 0) into v_sum from jsonb_array_elements(d.lines) x;
      if v_n > 0 and v_sum > 0 then
        -- долг документа делится по строкам пропорционально; остаток копеек — на последнюю строку
        v_left := d.debt; v_i := 0;
        for ln in select * from jsonb_array_elements(d.lines) loop
          v_i := v_i + 1;
          v_part := case when v_i = v_n then v_left else round(d.debt * (ln->>'amount')::numeric / v_sum, 2) end;
          v_left := v_left - v_part;
          if v_part = 0 then continue; end if;
          v_art := public._onec_article(ln->>'item', d.contract_name, d.doc_type, coalesce(ln->>'account', d.account));
          kind := 'charge'; article_code := v_art; select name into article_name from public.accounting_articles where code = v_art;
          amount := v_part; rule := 'строка: ' || coalesce(ln->>'item', '—'); return next;
        end loop;
      else
        v_art := public._onec_article(null, d.contract_name, d.doc_type, d.account);
        kind := 'charge'; article_code := v_art; select name into article_name from public.accounting_articles where code = v_art;
        amount := d.debt; rule := case when v_art = 'OPENING' then 'нет строк номенклатуры' else 'по договору / документу' end; return next;
      end if;
    end if;
  end loop;
end $$;

-- ── Проведение остатков на дату перехода ────────────────────────────────────
create or replace function public.onec_opening_post(p_import uuid, p_date date) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r record; v_imp public.onec_imports; v_ch uuid; v_pay uuid; v_art text; n int := 0; skipped jsonb := '[]'; t uuid; v_desc text;
begin
  perform public._onec_owner();
  select * into v_imp from public.onec_imports where id = p_import for update;
  if v_imp.id is null then raise exception 'Загрузка не найдена'; end if;
  if v_imp.status <> 'staged' then raise exception 'Эта загрузка уже проведена или отменена'; end if;
  if p_date is null then raise exception 'Укажите дату перехода'; end if;
  if exists (select 1 from public.onec_imports where status = 'posted') then
    raise exception 'Остатки из 1С уже проведены другой загрузкой — сначала отмените её сторно';
  end if;
  if exists (select 1 from public.charges where source not in ('opening', 'storno') and date <= p_date)
     or exists (select 1 from public.payments where coalesce(source, '') <> 'opening' and storno_of is null and date <= p_date) then
    raise exception 'В Маяке уже есть начисления или оплаты до даты перехода — входящие остатки вводятся на чистый учёт';
  end if;

  for r in select * from public.onec_opening_lines(p_import) loop
    if r.tenant_id is null then
      skipped := skipped || jsonb_build_object('cp', r.cp_name, 'doc', r.doc_label, 'amount', r.amount, 'why', 'контрагент не сопоставлен');
      continue;
    end if;
    perform public._acc_lock(r.tenant_id);
    v_desc := 'Входящий остаток 1С на ' || to_char(p_date, 'DD.MM.YYYY') || ': ' || coalesce(r.contract_name, '') || ' · ' || r.doc_label;
    if r.kind = 'charge' then
      v_art := r.article_code;
      if v_art = 'DEPOSIT' and r.lease_id is null then v_art := 'OPENING'; end if;   -- депозит только по договору
      v_ch := public._acc_insert_charge(r.tenant_id, r.lease_id, v_art, null, r.amount, p_date, p_date, v_desc,
                jsonb_build_object('onec_import', p_import, 'cp', r.cp_id, 'contract', r.contract_id, 'doc', r.doc_id, 'rule', r.rule),
                'opening', 'O1C:' || p_import || ':' || r.cp_id || ':' || r.contract_id || ':' || r.doc_id || ':' || v_art || ':' || r.amount, null);
      if v_ch is null then
        -- одинаковая строка в одном документе (одна статья и сумма) — уникальный ключ с номером
        v_ch := public._acc_insert_charge(r.tenant_id, r.lease_id, v_art, null, r.amount, p_date, p_date, v_desc,
                  jsonb_build_object('onec_import', p_import, 'cp', r.cp_id, 'contract', r.contract_id, 'doc', r.doc_id, 'rule', r.rule),
                  'opening', 'O1C:' || p_import || ':' || gen_random_uuid(), null);
      end if;
      if v_ch is not null then insert into public.deposit_operations (tenant_id, lease_id, kind, date, amount, reason, charge_id)
        select r.tenant_id, r.lease_id, 'require', p_date, r.amount, v_desc, v_ch where v_art = 'DEPOSIT'; end if;
    elsif r.kind = 'advance' then
      insert into public.payments (tenant_id, date, amount, direction, source, purpose, description, type)
      values (r.tenant_id, p_date, r.amount, 'in', 'opening', v_desc, 'onec:' || p_import, 'opening') returning id into v_pay;
      perform public._acc_post(p_date, r.tenant_id, null, 'advance', null, null, r.amount, 0, 'payment', v_pay);
    elsif r.kind = 'deposit' then
      if r.lease_id is null then
        skipped := skipped || jsonb_build_object('cp', r.cp_name, 'doc', r.doc_label, 'amount', r.amount, 'why', 'депозит без договора в Маяке');
        continue;
      end if;
      v_ch := public._acc_insert_charge(r.tenant_id, r.lease_id, 'DEPOSIT', null, r.amount, p_date, p_date, v_desc,
                jsonb_build_object('onec_import', p_import, 'cp', r.cp_id, 'contract', r.contract_id), 'opening',
                'O1CD:' || p_import || ':' || r.cp_id || ':' || r.contract_id, null);
      insert into public.deposit_operations (tenant_id, lease_id, kind, date, amount, reason, charge_id)
      values (r.tenant_id, r.lease_id, 'require', p_date, r.amount, v_desc, v_ch);
      insert into public.payments (tenant_id, date, amount, direction, source, purpose, description, type)
      values (r.tenant_id, p_date, r.amount, 'in', 'opening', 'Депозит, полученный до перехода: ' || v_desc, 'onec:' || p_import, 'opening') returning id into v_pay;
      perform public._acc_post(p_date, r.tenant_id, null, 'advance', null, null, r.amount, 0, 'payment', v_pay);
      perform public._acc_allocate(v_pay, null, v_ch, null, r.amount, false, null);
    end if;
    n := n + 1;
  end loop;

  -- переплаты закрывают долги того же арендатора по общей очереди
  for t in select distinct c.tenant_id from public.onec_counterparties c where c.import_id = p_import and c.tenant_id is not null loop
    perform public.allocate_tenant(t);
  end loop;

  update public.onec_imports set status = 'posted', transition_date = p_date, posted_at = now(), posted_by = auth.uid(),
         post_result = jsonb_build_object('lines', n, 'skipped', skipped)
   where id = p_import;
  perform public._acc_audit('onec.opening_post', 'onec_imports', p_import, jsonb_build_object('date', p_date, 'lines', n, 'skipped', jsonb_array_length(skipped)));
  return jsonb_build_object('lines', n, 'skipped', skipped);
end $$;

-- Отмена проведённых остатков сторно (документы остаются в истории).
create or replace function public.onec_opening_storno(p_import uuid, p_reason text) returns int
language plpgsql security definer set search_path = public as $$
declare r record; n int := 0;
begin
  perform public._onec_owner();
  if coalesce(trim(p_reason), '') = '' then raise exception 'Укажите причину'; end if;
  if not exists (select 1 from public.onec_imports where id = p_import and status = 'posted') then raise exception 'Загрузка не проведена'; end if;
  for r in select id from public.payments where source = 'opening' and description = 'onec:' || p_import and storno_of is null
            and not exists (select 1 from public.payments s where s.storno_of = payments.id) loop
    perform public.storno_payment(r.id, 'Отмена остатков 1С: ' || p_reason); n := n + 1;
  end loop;
  for r in select id from public.charges where source = 'opening' and basis->>'onec_import' = p_import::text and storno_of is null
            and not exists (select 1 from public.charges s where s.storno_of = charges.id) loop
    perform public.storno_charge(r.id, 'Отмена остатков 1С: ' || p_reason); n := n + 1;
  end loop;
  update public.onec_imports set status = 'reversed' where id = p_import;
  perform public._acc_audit('onec.opening_storno', 'onec_imports', p_import, jsonb_build_object('docs', n, 'reason', p_reason));
  return n;
end $$;

-- ── Сверка ──────────────────────────────────────────────────────────────────
-- По каждому арендатору: сальдо расчётов (долг − аванс) и депозит в 1С и в Маяке на дату. diff = Маяк − 1С.
create or replace function public.onec_reconcile(p_import uuid, p_date date)
returns table (tenant_id uuid, tenant_name text, cp_names text, inn text, onec_balance numeric, onec_deposit numeric,
               mayak_balance numeric, mayak_deposit numeric, diff numeric, diff_deposit numeric, status text)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  perform public._acc_guard();
  return query
  with o as (
    select c.tenant_id, string_agg(distinct c.name, '; ') names, max(c.inn) inn,
           sum(c.debt - c.advance) bal, sum(c.deposit) dep, bool_or(c.tenant_id is null) unmatched
      from public.onec_counterparties c where c.import_id = p_import
     group by coalesce(c.tenant_id::text, c.cp_id), c.tenant_id
  ), m as (
    select p.tenant_id,
           coalesce(sum(p.debit - p.credit) filter (where p.register = 'receivable'), 0)
             - coalesce(sum(p.debit - p.credit) filter (where p.register = 'advance'), 0) bal,
           coalesce(sum(p.debit - p.credit) filter (where p.register = 'deposit'), 0) dep
      from public.ledger_postings p where p.date <= coalesce(p_date, current_date)
     group by p.tenant_id
  )
  select coalesce(o.tenant_id, m.tenant_id), t.full_name, o.names, coalesce(o.inn, t.inn),
         coalesce(o.bal, 0), coalesce(o.dep, 0), coalesce(m.bal, 0), coalesce(m.dep, 0),
         coalesce(m.bal, 0) - coalesce(o.bal, 0), coalesce(m.dep, 0) - coalesce(o.dep, 0),
         case when o.unmatched then 'нет в Маяке'
              when o.tenant_id is null and m.tenant_id is not null then 'нет в 1С'
              when coalesce(m.bal, 0) = coalesce(o.bal, 0) and coalesce(m.dep, 0) = coalesce(o.dep, 0) then 'совпадает'
              else 'расхождение' end
    from o full join m on m.tenant_id = o.tenant_id
    left join public.tenants t on t.id = coalesce(o.tenant_id, m.tenant_id)
   where coalesce(o.bal, 0) <> 0 or coalesce(o.dep, 0) <> 0 or coalesce(m.bal, 0) <> 0 or coalesce(m.dep, 0) <> 0 or o.unmatched
   order by 11 desc, abs(coalesce(m.bal, 0) - coalesce(o.bal, 0)) desc;
end $$;

-- Арендаторы Маяка, которых нет в выгрузке 1С (для ручного разбора).
create or replace function public.onec_tenants_missing(p_import uuid)
returns table (tenant_id uuid, full_name text, inn text, id_1c text, status text, leases int)
language sql stable security definer set search_path = public as $$
  select t.id, t.full_name, t.inn, t.id_1c, t.status, (select count(*)::int from public.leases l where l.tenant_id = t.id)
    from public.tenants t
   where public.is_staff()
     and not exists (select 1 from public.onec_counterparties c where c.import_id = p_import and c.tenant_id = t.id)
   order by t.full_name;
$$;

revoke all on function public.onec_stage(jsonb), public.onec_link_tenant(uuid, text, uuid), public.onec_link_contract(uuid, text, text, uuid),
  public.onec_apply_contracts(uuid), public.onec_opening_lines(uuid), public.onec_opening_post(uuid, date), public.onec_opening_storno(uuid, text),
  public.onec_reconcile(uuid, date), public.onec_tenants_missing(uuid), public._onec_article(text, text, text, text), public._onec_owner() from public, anon;
grant execute on function public.onec_stage(jsonb), public.onec_link_tenant(uuid, text, uuid), public.onec_link_contract(uuid, text, text, uuid),
  public.onec_apply_contracts(uuid), public.onec_opening_lines(uuid), public.onec_opening_post(uuid, date), public.onec_opening_storno(uuid, text),
  public.onec_reconcile(uuid, date), public.onec_tenants_missing(uuid) to authenticated, service_role;
