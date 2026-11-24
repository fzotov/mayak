-- ─────────────────────────────────────────────────────────────────────────────
-- Этап 4 ТЗ v2: банк. Загрузка выписки (файл 1CClientBankExchange из СберБизнес),
-- определение арендатора и автоматическое зачисление поступлений в расчёты.
-- Sber API подключается позже (нужно заявление владельца счёта) и будет писать
-- в те же таблицы. Выполнять после 20261125_accounting_core.sql. Можно повторно.
-- ─────────────────────────────────────────────────────────────────────────────

-- Файлы выписок: контрольная сумма не даёт загрузить один файл дважды,
-- остатки и обороты банка сверяются с загруженными операциями.
create table if not exists public.bank_statement_files (
  id            uuid primary key default gen_random_uuid(),
  file_name     text,
  sha256        text not null unique,
  account       text not null,
  date_from     date,
  date_to       date,
  opening       numeric(14,2),
  total_in      numeric(14,2),
  total_out     numeric(14,2),
  closing       numeric(14,2),
  docs_in       numeric(14,2),
  docs_out      numeric(14,2),
  check_status  text not null default 'ok' check (check_status in ('ok', 'mismatch')),
  check_note    text,
  added         int not null default 0,
  skipped       int not null default 0,
  uploaded_by   uuid default auth.uid(),
  created_at    timestamptz not null default now()
);

alter table public.bank_transactions add column if not exists bank_key       text;
alter table public.bank_transactions add column if not exists doc_number     text;
alter table public.bank_transactions add column if not exists payer_inn      text;
alter table public.bank_transactions add column if not exists payer_account  text;
alter table public.bank_transactions add column if not exists counter_inn    text;
alter table public.bank_transactions add column if not exists statement_id   uuid references public.bank_statement_files (id);
alter table public.bank_transactions add column if not exists tenant_id      uuid references public.tenants (id);
alter table public.bank_transactions add column if not exists payment_id     uuid references public.payments (id);
alter table public.bank_transactions add column if not exists status         text not null default 'new';
alter table public.bank_transactions add column if not exists match_note     text;
alter table public.bank_transactions drop constraint if exists bank_transactions_status_check;
alter table public.bank_transactions add constraint bank_transactions_status_check
  check (status in ('new', 'credited', 'unrecognized', 'ignored', 'expense'));
create unique index if not exists bank_transactions_key_uq on public.bank_transactions (account_number, bank_key) where bank_key is not null;
create index if not exists bank_transactions_status_idx on public.bank_transactions (status);

-- Плательщик, которого оператор однажды привязал к арендатору (оплата с другого юрлица, от физлица).
create table if not exists public.bank_payer_links (
  id            uuid primary key default gen_random_uuid(),
  payer_inn     text,
  payer_account text,
  tenant_id     uuid not null references public.tenants (id) on delete cascade,
  note          text,
  created_by    uuid default auth.uid(),
  created_at    timestamptz not null default now(),
  check (payer_inn is not null or payer_account is not null)
);
create unique index if not exists bank_payer_links_inn_uq on public.bank_payer_links (payer_inn) where payer_inn is not null;
create unique index if not exists bank_payer_links_acc_uq on public.bank_payer_links (payer_account) where payer_account is not null and payer_inn is null;

alter table public.bank_statement_files enable row level security;
alter table public.bank_payer_links     enable row level security;
drop policy if exists staff_read on public.bank_statement_files;
create policy staff_read on public.bank_statement_files for select to authenticated using (public.is_staff());
drop policy if exists staff_all on public.bank_payer_links;
create policy staff_all on public.bank_payer_links for all to authenticated using (public.is_staff()) with check (public.is_staff());
-- операции банка пишет только загрузка выписки; сотрудник меняет статус через функции
drop policy if exists staff_all on public.bank_transactions;
drop policy if exists staff_read on public.bank_transactions;
create policy staff_read on public.bank_transactions for select to authenticated using (public.is_staff());

-- ── Зачисление с учётом назначения платежа ──────────────────────────────────
-- Если в назначении названа ровно одна статья (по ключевым словам справочника),
-- деньги сначала идут на открытые начисления этой статьи. Депозит без открытого
-- требования: требование создаётся на недовнесённую сумму (или на весь платёж).
-- Остальное — по общей очереди.
create or replace function public._acc_allocate_by_purpose(p_payment uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_p record; v_art text; v_n int; v_lease uuid; v_short numeric; v_free numeric; ch record; v_part numeric; v_text text;
begin
  select * into v_p from public.v_payment_state where id = p_payment;
  v_text := lower(coalesce(v_p.purpose, ''));
  if v_text = '' or v_p.free_amount <= 0 then return; end if;
  -- «аренда» есть почти в любом назначении («оплата по договору аренды»), поэтому аренду указанием статьи не считаем:
  -- она и так первая в общей очереди.
  select count(*), min(x.code) into v_n, v_art from (
    select a.code from public.accounting_articles a
    where a.active and a.code not in ('RENT', 'OPENING')
      and exists (select 1 from unnest(a.keywords) k where length(k) >= 4 and v_text like '%' || lower(k) || '%')
  ) x;
  if v_n <> 1 then return; end if;

  if v_art = 'DEPOSIT' then
    select l.id, greatest(0, l.deposit_required - public._deposit_balance(l.id)
                         - coalesce((select sum(cs.open_amount) from public.v_charge_state cs where cs.lease_id = l.id and cs.register = 'deposit'), 0))
      into v_lease, v_short
    from public.leases l where l.tenant_id = v_p.tenant_id and l.status = 'active' order by l.start_date desc nulls last limit 1;
    if v_lease is null then return; end if;
    if not exists (select 1 from public.v_charge_state where lease_id = v_lease and register = 'deposit' and open_amount > 0) then
      perform public._acc_insert_charge(v_p.tenant_id, v_lease, 'DEPOSIT', null,
        case when v_short > 0 then least(v_short, v_p.free_amount) else v_p.free_amount end,
        v_p.date, v_p.date, 'Обеспечительный платёж по назначению платежа', null, 'deposit', null, null);
    end if;
  end if;

  v_free := v_p.free_amount;
  for ch in select id, open_amount from public.v_charge_state
            where tenant_id = v_p.tenant_id and article_code = v_art and open_amount > 0 order by due_date, created_at loop
    v_part := least(v_free, ch.open_amount);
    perform public._acc_allocate(p_payment, null, ch.id, null, v_part, true, null);
    v_free := v_free - v_part;
    exit when v_free <= 0;
  end loop;
end $$;

-- post_payment теперь сначала учитывает назначение платежа, затем общая очередь.
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
  perform public._acc_allocate_by_purpose(v_id);
  perform public.allocate_tenant(p_tenant);
  return v_id;
end $$;

-- ── Определение арендатора ──────────────────────────────────────────────────
-- 1) ИНН плательщика = ИНН арендатора; 2) номер счёта или договора в назначении;
-- 3) ранее привязанный плательщик. Возвращает арендатора и причину.
create or replace function public.bank_identify(p_tx uuid, out tenant_id uuid, out reason text)
language plpgsql stable security definer set search_path = public as $$
declare t record; v_text text; v_hits uuid[];
begin
  select * into t from public.bank_transactions where id = p_tx;
  v_text := ' ' || lower(coalesce(t.description, '')) || ' ';
  if coalesce(t.payer_inn, '') ~ '^\d{10}(\d{2})?$' then
    select array_agg(x.id) into v_hits from public.tenants x where x.inn = t.payer_inn;
    if array_length(v_hits, 1) = 1 then tenant_id := v_hits[1]; reason := 'ИНН плательщика'; return; end if;
  end if;
  select array_agg(distinct i.tenant_id) into v_hits from public.invoices i
  where i.number is not null and length(i.number) >= 6 and v_text ~ ('[^0-9]' || regexp_replace(i.number, '([^0-9a-zA-Z])', '\\\1', 'g') || '[^0-9]');
  if array_length(v_hits, 1) = 1 then tenant_id := v_hits[1]; reason := 'номер счёта в назначении'; return; end if;
  select array_agg(distinct l.tenant_id) into v_hits from public.leases l
  where l.number is not null and length(l.number) >= 4 and l.status = 'active'
    and v_text ~ ('(договор|дог\.?|№)[^0-9]{0,15}' || regexp_replace(l.number, '([^0-9a-zA-Z])', '\\\1', 'g') || '[^0-9]');
  if array_length(v_hits, 1) = 1 then tenant_id := v_hits[1]; reason := 'номер договора в назначении'; return; end if;
  select pl.tenant_id into tenant_id from public.bank_payer_links pl
  where (pl.payer_inn is not null and pl.payer_inn = t.payer_inn) or (pl.payer_inn is null and pl.payer_account = t.payer_account) limit 1;
  if tenant_id is not null then reason := 'плательщик привязан вручную'; end if;
end $$;

-- Зачислить поступление: арендатор найден — деньги на его баланс без участия человека,
-- иначе операция ждёт в очереди «Не распознано».
create or replace function public.bank_credit(p_tx uuid) returns text
language plpgsql security definer set search_path = public as $$
declare t public.bank_transactions; v_tenant uuid; v_reason text; v_pay uuid;
begin
  perform public._acc_guard();
  select * into t from public.bank_transactions where id = p_tx for update;
  if t.id is null then raise exception 'Операция не найдена'; end if;
  if t.direction <> 'credit' or t.status in ('credited', 'ignored') then return t.status; end if;
  select x.tenant_id, x.reason into v_tenant, v_reason from public.bank_identify(p_tx) x;
  if v_tenant is null then
    update public.bank_transactions set status = 'unrecognized', match_note = null where id = p_tx;
    return 'unrecognized';
  end if;
  v_pay := public.post_payment(v_tenant, t.date::date, abs(t.amount), 'bank', t.description, p_tx);
  update public.bank_transactions set status = 'credited', tenant_id = v_tenant, payment_id = v_pay, match_note = v_reason,
    matched_type = 'tenant', matched_id = v_tenant where id = p_tx;
  return 'credited';
end $$;

-- Ручной разбор: оператор указывает арендатора; при p_remember плательщик запоминается.
create or replace function public.bank_assign(p_tx uuid, p_tenant uuid, p_remember boolean default true) returns uuid
language plpgsql security definer set search_path = public as $$
declare t public.bank_transactions; v_pay uuid;
begin
  perform public._acc_guard();
  select * into t from public.bank_transactions where id = p_tx for update;
  if t.id is null or t.direction <> 'credit' then raise exception 'Это не поступление'; end if;
  if t.status = 'credited' then raise exception 'Операция уже зачислена'; end if;
  if p_remember and (t.payer_inn is not null or t.payer_account is not null) then
    insert into public.bank_payer_links (payer_inn, payer_account, tenant_id, note)
    values (nullif(t.payer_inn, ''), case when nullif(t.payer_inn, '') is null then t.payer_account end, p_tenant, t.counterparty)
    on conflict do nothing;
  end if;
  v_pay := public.post_payment(p_tenant, t.date::date, abs(t.amount), 'bank', t.description, p_tx);
  update public.bank_transactions set status = 'credited', tenant_id = p_tenant, payment_id = v_pay, match_note = 'разобрано вручную',
    matched_type = 'tenant', matched_id = p_tenant where id = p_tx;
  perform public._acc_audit('bank.assign', 'bank_transactions', p_tx, jsonb_build_object('tenant', p_tenant, 'remember', p_remember));
  return v_pay;
end $$;

-- Поступление не от арендатора (возврат поставщика, проценты банка и т. п.) — в учёт арендаторов не идёт.
create or replace function public.bank_ignore(p_tx uuid, p_note text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public._acc_guard();
  update public.bank_transactions set status = 'ignored', match_note = coalesce(nullif(trim(p_note), ''), 'не от арендатора'), matched_type = 'ignored'
  where id = p_tx and status in ('new', 'unrecognized');
  perform public._acc_audit('bank.ignore', 'bank_transactions', p_tx, jsonb_build_object('note', p_note));
end $$;

-- Отметки расходных операций при сверке с входящими счетами (экран «Сверка»).
create or replace function public.bank_mark_expense(p_tx uuid, p_invoice uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public._acc_guard();
  update public.bank_transactions set status = 'expense', matched_type = case when p_invoice is null then 'ignored' else 'invoice' end, matched_id = p_invoice
  where id = p_tx and direction = 'debit';
end $$;

-- ── Загрузка выписки ────────────────────────────────────────────────────────
-- p_file: {file_name, sha256, account, date_from, date_to, opening, total_in, total_out, closing,
--          docs: [{key, date, number, amount, direction, counterparty, counter_inn, counter_account, purpose}]}
-- Повторная загрузка того же файла запрещена; уже загруженная операция (тот же ключ) пропускается.
create or replace function public.bank_import(p_file jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_file uuid; d jsonb; v_id uuid; v_added int := 0; v_skipped int := 0; v_in numeric := 0; v_out numeric := 0;
        v_cred int := 0; v_unrec int := 0; v_status text; v_note text; r record;
begin
  perform public._acc_guard();
  if exists (select 1 from public.bank_statement_files where sha256 = p_file ->> 'sha256') then
    raise exception 'Этот файл выписки уже загружен';
  end if;
  insert into public.bank_statement_files (file_name, sha256, account, date_from, date_to, opening, total_in, total_out, closing)
  values (p_file ->> 'file_name', p_file ->> 'sha256', p_file ->> 'account', (p_file ->> 'date_from')::date, (p_file ->> 'date_to')::date,
          (p_file ->> 'opening')::numeric, (p_file ->> 'total_in')::numeric, (p_file ->> 'total_out')::numeric, (p_file ->> 'closing')::numeric)
  returning id into v_file;

  for d in select * from jsonb_array_elements(p_file -> 'docs') loop
    if d ->> 'direction' = 'credit' then v_in := v_in + (d ->> 'amount')::numeric; else v_out := v_out + (d ->> 'amount')::numeric; end if;
    insert into public.bank_transactions (date, amount, direction, counterparty, description, account_number, reference, bank_key, doc_number,
      payer_inn, payer_account, counter_inn, statement_id, status)
    values ((d ->> 'date')::date, (d ->> 'amount')::numeric, d ->> 'direction', d ->> 'counterparty', d ->> 'purpose', p_file ->> 'account',
      d ->> 'number', d ->> 'key', d ->> 'number',
      case when d ->> 'direction' = 'credit' then nullif(d ->> 'counter_inn', '') end,
      case when d ->> 'direction' = 'credit' then nullif(d ->> 'counter_account', '') end,
      nullif(d ->> 'counter_inn', ''), v_file, 'new')
    on conflict (account_number, bank_key) where bank_key is not null do nothing
    returning id into v_id;
    if v_id is null then v_skipped := v_skipped + 1; else v_added := v_added + 1; end if;
    v_id := null;
  end loop;

  -- сверка: остаток на начало + поступило − списано = остаток на конец; суммы документов = обороты банка
  v_status := 'ok';
  if (p_file ->> 'opening') is not null and (p_file ->> 'closing') is not null
     and round((p_file ->> 'opening')::numeric + coalesce((p_file ->> 'total_in')::numeric, v_in) - coalesce((p_file ->> 'total_out')::numeric, v_out) - (p_file ->> 'closing')::numeric, 2) <> 0 then
    v_status := 'mismatch'; v_note := 'Остаток на начало + обороты не равен остатку на конец';
  end if;
  if (p_file ->> 'total_in') is not null and round(v_in - (p_file ->> 'total_in')::numeric, 2) <> 0 then
    v_status := 'mismatch'; v_note := concat_ws('; ', v_note, format('поступления по документам %s, по банку %s', v_in, p_file ->> 'total_in'));
  end if;
  if (p_file ->> 'total_out') is not null and round(v_out - (p_file ->> 'total_out')::numeric, 2) <> 0 then
    v_status := 'mismatch'; v_note := concat_ws('; ', v_note, format('списания по документам %s, по банку %s', v_out, p_file ->> 'total_out'));
  end if;
  update public.bank_statement_files set docs_in = v_in, docs_out = v_out, check_status = v_status, check_note = v_note,
    added = v_added, skipped = v_skipped where id = v_file;

  -- новые поступления сразу зачисляются, расходы ждут сверки с входящими счетами
  for r in select id, direction from public.bank_transactions where statement_id = v_file order by date, id loop
    if r.direction = 'credit' then
      if public.bank_credit(r.id) = 'credited' then v_cred := v_cred + 1; else v_unrec := v_unrec + 1; end if;
    end if;
  end loop;
  perform public._acc_audit('bank.import', 'bank_statement_files', v_file, jsonb_build_object('added', v_added, 'skipped', v_skipped));
  return jsonb_build_object('file', v_file, 'added', v_added, 'skipped', v_skipped, 'credited', v_cred, 'unrecognized', v_unrec,
                            'check', v_status, 'check_note', v_note);
end $$;

do $$
declare f text;
begin
  for f in select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname = '_acc_allocate_by_purpose' loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
  for f in select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname in ('post_payment', 'bank_identify', 'bank_credit', 'bank_assign', 'bank_ignore', 'bank_mark_expense', 'bank_import') loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;
end $$;
