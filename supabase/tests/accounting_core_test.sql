-- Сценарии приёмки этапа 2 (ТЗ v2, 4.6). Выполнять в SQL-редакторе Supabase.
-- Всё происходит в одной транзакции и откатывается: в конце блок нарочно
-- завершается исключением. Успех — сообщение «TESTS_OK», иначе — текст ошибки.
do $$
declare
  t uuid; l uuid; l2 uuid; t2 uuid; r jsonb; c_rent uuid; c_clean uuid; c_dep uuid; c_nov_clean uuid;
  v numeric; n int; al uuid;
begin
  insert into public.tenants (full_name, status, tenant_group) values ('ТЕСТ ядро учёта', 'ACTIVE', 'room') returning id into t;
  insert into public.leases (tenant_id, number, start_date, status, payment_day, deposit_required)
  values (t, 'ТЕСТ-1', '2026-01-01', 'active', 5, 60000) returning id into l;
  insert into public.lease_lines (lease_id, article_code, unit_label, area, rate_per_sqm, amount, valid_from)
  values (l, 'RENT', '999', 20, 1500, 30000, '2026-01-01'), (l, 'CLEAN', '999', null, null, 2500, '2026-01-01');

  -- второй арендатор въезжает 16 октября: неполный месяц
  insert into public.tenants (full_name, status, tenant_group) values ('ТЕСТ въезд в середине месяца', 'ACTIVE', 'room') returning id into t2;
  insert into public.leases (tenant_id, number, start_date, status) values (t2, 'ТЕСТ-2', '2026-10-16', 'active') returning id into l2;
  insert into public.lease_lines (lease_id, article_code, amount, valid_from) values (l2, 'RENT', 31000, '2026-10-16');

  -- 1. биллинг за октябрь и идемпотентность
  r := public.billing_post('2026-10-01');
  select count(*) into n from public.charges where tenant_id = t and period = '2026-10-01';
  if n <> 2 then raise exception '1: ожидалось 2 начисления, есть %', n; end if;
  select id into c_rent from public.charges where tenant_id = t and article_code = 'RENT' and period = '2026-10-01';
  select id into c_clean from public.charges where tenant_id = t and article_code = 'CLEAN' and period = '2026-10-01';
  if (select amount from public.charges where id = c_rent) <> 30000 then raise exception '1: аренда не 30000'; end if;
  if (select due_date from public.charges where id = c_rent) <> '2026-10-05' then raise exception '1: срок не 05.10'; end if;
  if (select count(*) from public.invoices where tenant_id = t) <> 1 then raise exception '1: ожидался 1 счёт (аренда+уборка)'; end if;
  select amount into v from public.charges where tenant_id = t2 and period = '2026-10-01';
  if v <> 16000 then raise exception '1: неполный месяц: ожидалось 31000*16/31 = 16000, получено %', v; end if;
  r := public.billing_post('2026-10-01');
  if (r ->> 'charges')::int <> 0 or (r ->> 'invoices')::int <> 0 then raise exception '1: повторный запуск создал %', r; end if;

  -- 2. оплатил меньше начисленного: 20000 из 32500
  perform public.post_payment(t, '2026-10-07', 20000, 'manual', 'Оплата по счёту');
  select open_amount into v from public.v_charge_state where id = c_rent;
  if v <> 10000 then raise exception '2: аренда должна быть погашена частично, остаток 10000, есть %', v; end if;
  select open_amount into v from public.v_charge_state where id = c_clean;
  if v <> 2500 then raise exception '2: уборка не оплачена, остаток 2500, есть %', v; end if;
  if (select pay_status from public.v_invoice_state where tenant_id = t) not in ('partial', 'partial_overdue') then raise exception '2: счёт должен быть частично оплачен'; end if;
  select coalesce(sum(debit - credit), 0) into v from public.ledger_postings where tenant_id = t and register = 'receivable';
  if v <> 12500 then raise exception '2: долг 12500, в регистре %', v; end if;

  -- 3. депозит: требование → поступление → зачёт в долг по аренде → довнесение → возврат
  perform public.deposit_require(l, 60000, '2026-10-01', 'Депозит по договору ТЕСТ-1');
  perform public.post_payment(t, '2026-10-08', 60000, 'manual', 'Обеспечительный платёж');
  select held into v from public.v_deposits where lease_id = l;
  if v <> 60000 then raise exception '3: на депозите 60000, есть %', v; end if;
  select coalesce(sum(debit - credit), 0) into v from public.ledger_postings where tenant_id = t and register = 'receivable';
  if v <> 12500 then raise exception '3: депозит не должен гасить долг, долг 12500, есть %', v; end if;
  perform public.deposit_offset(l, c_rent, 10000, 'Зачёт депозита в долг по аренде за октябрь');
  select held into v from public.v_deposits where lease_id = l;
  if v <> 50000 then raise exception '3: после зачёта на депозите 50000, есть %', v; end if;
  if (select open_amount from public.v_charge_state where id = c_rent) <> 0 then raise exception '3: аренда должна закрыться зачётом'; end if;
  perform public.deposit_require(l, 10000, '2026-10-20', 'Довнесение депозита после зачёта');
  -- 12500: сначала гасится уборка с более ранним сроком (2500), остальное — депозит
  perform public.post_payment(t, '2026-10-21', 12500, 'manual', 'Довнесение депозита и уборка');
  select held into v from public.v_deposits where lease_id = l;
  if v <> 60000 then raise exception '3: после довнесения 60000, есть %', v; end if;
  perform public.refund(t, 'deposit', 60000, '2026-10-31', 'Возврат депозита при выезде', l);
  if (select held from public.v_deposits where lease_id = l) <> 0 then raise exception '3: после возврата депозит 0'; end if;

  -- 4. переплата закрывает следующий счёт
  perform public.post_payment(t, '2026-10-25', 50000, 'manual', 'Оплата с запасом');
  select coalesce(sum(debit - credit), 0) into v from public.ledger_postings where tenant_id = t and register = 'advance';
  if v <> 50000 then raise exception '4: аванс 50000, есть %', v; end if;
  r := public.billing_post('2026-11-01');
  select coalesce(sum(debit - credit), 0) into v from public.ledger_postings where tenant_id = t and register = 'advance';
  if v <> 17500 then raise exception '4: после ноябрьского счёта аванс 17500, есть %', v; end if;
  select coalesce(sum(debit - credit), 0) into v from public.ledger_postings where tenant_id = t and register = 'receivable';
  if v <> 0 then raise exception '4: долга нет, есть %', v; end if;
  if (select count(*) from public.v_invoice_state where tenant_id = t and pay_status <> 'paid') <> 0 then raise exception '4: все счета оплачены'; end if;

  -- 5. сторно начисления возвращает остатки
  select id into c_nov_clean from public.charges where tenant_id = t and article_code = 'CLEAN' and period = '2026-11-01';
  perform public.storno_charge(c_nov_clean, 'Уборка в ноябре не оказывалась');
  select coalesce(sum(debit - credit), 0) into v from public.ledger_postings where tenant_id = t and register = 'advance';
  if v <> 20000 then raise exception '5: после сторно уборки аванс 20000, есть %', v; end if;
  select coalesce(sum(debit - credit), 0) into v from public.ledger_postings where tenant_id = t and register = 'receivable' and article_code = 'CLEAN';
  if v <> 0 then raise exception '5: по уборке 0, есть %', v; end if;
  begin
    perform public.storno_charge(c_nov_clean, 'повтор');
    raise exception '5: повторное сторно прошло';
  exception when others then
    if sqlerrm not like '%уже сторнировано%' then raise; end if;
  end;

  -- 6. отмена разнесения и повторная автоматическая разноска дают те же остатки
  select id into al from public.allocations where target_charge_id = c_clean and cancelled_at is null limit 1;
  perform public.cancel_allocation(al, 'Проверка');
  select open_amount into v from public.v_charge_state where id = c_clean;
  if v <> 2500 then raise exception '6: после отмены уборка открыта на 2500, есть %', v; end if;
  perform public.allocate_tenant(t);
  select open_amount into v from public.v_charge_state where id = c_clean;
  if v <> 0 then raise exception '6: после разноски уборка закрыта, остаток %', v; end if;

  -- 7. неизменяемость
  begin
    update public.charges set amount = 1 where id = c_rent;
    raise exception '7: начисление изменилось';
  exception when others then
    if sqlerrm not like '%можно поменять только счёт%' then raise; end if;
  end;
  begin
    delete from public.ledger_postings where tenant_id = t;
    raise exception '7: движения удалились';
  exception when others then
    if sqlerrm not like '%не удаляются%' then raise; end if;
  end;

  -- 8. сторно оплаты
  perform public.post_payment(t, '2026-11-10', 1000, 'manual', 'Ошибочная');
  perform public.storno_payment((select id from public.payments where tenant_id = t and amount = 1000 and storno_of is null), 'Задвоение');
  select coalesce(sum(debit - credit), 0) into v from public.ledger_postings where tenant_id = t and register = 'advance';
  if v <> 20000 then raise exception '8: аванс после сторно оплаты 20000, есть %', v; end if;

  -- 9. самопроверка регистра
  select count(*) into n from public.verify_ledger();
  if n <> 0 then raise exception '9: самопроверка нашла % расхождений: %', n, (select jsonb_agg(x) from public.verify_ledger() x); end if;

  -- 10. обороты
  select count(*) into n from public.ledger_turnover('2026-10-01', '2026-11-30', t);
  if n = 0 then raise exception '10: оборотов нет'; end if;

  raise exception 'TESTS_OK: все 10 сценариев прошли; всего строк биллинга за ноябрь по всем договорам: %',
    (select count(*) from public.charges where period = '2026-11-01');
end $$;
