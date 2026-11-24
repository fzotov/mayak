-- Сценарии приёмки этапа 4 (ТЗ v2, 6.5) без подключения к банку. Всё откатывается; успех — «TESTS_OK».
do $$
declare t uuid; l uuid; t2 uuid; r jsonb; v numeric; n int; s text; tx uuid; inv text;
begin
  insert into public.tenants (full_name, status, tenant_group, inn) values ('ТЕСТ банк', 'ACTIVE', 'room', '7700000001') returning id into t;
  insert into public.leases (tenant_id, number, start_date, status, deposit_required) values (t, 'Т-77/2026', '2026-01-01', 'active', 30000) returning id into l;
  insert into public.lease_lines (lease_id, article_code, amount, valid_from) values (l, 'RENT', 24000, '2026-01-01'), (l, 'CLEAN', 1500, '2026-01-01');
  insert into public.tenants (full_name, status, tenant_group, inn) values ('ТЕСТ банк 2', 'ACTIVE', 'room', '7700000002') returning id into t2;
  perform public.billing_post('2026-10-01');
  select number into inv from public.invoices where tenant_id = t limit 1;

  r := public.bank_import(jsonb_build_object(
    'file_name', 'kl_to_1c.txt', 'sha256', 'test-sha-1', 'account', '40802810000000000001',
    'date_from', '2026-10-01', 'date_to', '2026-10-31', 'opening', 1000, 'total_in', 75000, 'total_out', 500, 'closing', 75500,
    'docs', jsonb_build_array(
      -- 1. ИНН арендатора, меньше начисленного
      jsonb_build_object('key', 'k1', 'date', '2026-10-06', 'number', '11', 'amount', 15000, 'direction', 'credit', 'counterparty', 'ТЕСТ банк', 'counter_inn', '7700000001', 'counter_account', '40702810000000000011', 'purpose', 'Оплата по договору аренды'),
      -- 2. депозит по назначению
      jsonb_build_object('key', 'k2', 'date', '2026-10-07', 'number', '12', 'amount', 30000, 'direction', 'credit', 'counterparty', 'ТЕСТ банк', 'counter_inn', '7700000001', 'counter_account', '40702810000000000011', 'purpose', 'Обеспечительный платёж по договору Т-77/2026'),
      -- 3. неизвестный плательщик
      jsonb_build_object('key', 'k3', 'date', '2026-10-08', 'number', '13', 'amount', 10000, 'direction', 'credit', 'counterparty', 'Иванов И.И.', 'counter_inn', '', 'counter_account', '40817810000000000099', 'purpose', 'перевод'),
      -- 4. другой ИНН, но номер счёта в назначении
      jsonb_build_object('key', 'k4', 'date', '2026-10-09', 'number', '14', 'amount', 20000, 'direction', 'credit', 'counterparty', 'ООО Посредник', 'counter_inn', '7799999999', 'counter_account', '40702810000000000055', 'purpose', 'Оплата по счёту № ' || inv || ' за ТЕСТ банк'),
      -- 5. расход
      jsonb_build_object('key', 'k5', 'date', '2026-10-10', 'number', '15', 'amount', 500, 'direction', 'debit', 'counterparty', 'Банк', 'counter_inn', '7707083893', 'counter_account', '', 'purpose', 'Комиссия')
    )));
  if (r ->> 'added')::int <> 5 or (r ->> 'credited')::int <> 3 or (r ->> 'unrecognized')::int <> 1 then raise exception '1: импорт %', r; end if;
  if r ->> 'check' <> 'ok' then raise exception '1: сверка выписки %', r; end if;

  -- 15000 + 20000 гасят 25500 начислений, 9500 — аванс; 30000 — в депозит, не в расчёты
  select coalesce(sum(debit - credit), 0) into v from public.ledger_postings where tenant_id = t and register = 'receivable';
  if v <> 0 then raise exception '2: долг 0, есть %', v; end if;
  select coalesce(sum(debit - credit), 0) into v from public.ledger_postings where tenant_id = t and register = 'advance';
  if v <> 9500 then raise exception '2: аванс 9500, есть %', v; end if;
  select held into v from public.v_deposits where lease_id = l;
  if v <> 30000 then raise exception '3: депозит по назначению 30000, есть %', v; end if;

  -- ручной разбор с запоминанием плательщика; следующий платёж от него зачисляется сам
  select id into tx from public.bank_transactions where bank_key = 'k3';
  perform public.bank_assign(tx, t2, true);
  r := public.bank_import(jsonb_build_object('file_name', 'kl2.txt', 'sha256', 'test-sha-2', 'account', '40802810000000000001',
    'docs', jsonb_build_array(
      jsonb_build_object('key', 'k1', 'date', '2026-10-06', 'number', '11', 'amount', 15000, 'direction', 'credit', 'counterparty', 'ТЕСТ банк', 'counter_inn', '7700000001', 'counter_account', '', 'purpose', 'повтор'),
      jsonb_build_object('key', 'k6', 'date', '2026-10-20', 'number', '16', 'amount', 5000, 'direction', 'credit', 'counterparty', 'Иванов И.И.', 'counter_inn', '', 'counter_account', '40817810000000000099', 'purpose', 'перевод'))));
  if (r ->> 'added')::int <> 1 or (r ->> 'skipped')::int <> 1 or (r ->> 'credited')::int <> 1 then raise exception '4: повторная загрузка %', r; end if;
  select coalesce(sum(debit - credit), 0) into v from public.ledger_postings where tenant_id = t2 and register = 'advance';
  if v <> 15000 then raise exception '4: у привязанного арендатора аванс 15000, есть %', v; end if;

  -- тот же файл второй раз не загружается
  begin
    perform public.bank_import(jsonb_build_object('sha256', 'test-sha-1', 'account', 'x', 'docs', '[]'::jsonb));
    raise exception '5: повторный файл загрузился';
  exception when others then if sqlerrm not like '%уже загружен%' then raise; end if; end;

  -- расхождение остатков ловится
  r := public.bank_import(jsonb_build_object('sha256', 'test-sha-3', 'account', '40802810000000000001', 'opening', 0, 'total_in', 999, 'total_out', 0, 'closing', 999, 'docs', '[]'::jsonb));
  if r ->> 'check' <> 'mismatch' then raise exception '6: расхождение не найдено %', r; end if;

  select count(*) into n from public.verify_ledger();
  if n <> 0 then raise exception '7: самопроверка нашла %', (select jsonb_agg(x) from public.verify_ledger() x); end if;
  select status into s from public.bank_transactions where bank_key = 'k5';
  if s <> 'new' then raise exception '8: расход должен ждать сверки, статус %', s; end if;

  raise exception 'TESTS_OK: банк — все 8 сценариев прошли';
end $$;
