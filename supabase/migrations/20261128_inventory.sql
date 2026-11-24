-- Склад: изменение остатков одной операцией базы — приращением, а не перезаписью значения,
-- которое экран прочитал раньше (иначе две строки одного товара или два окна затирают друг друга).
create or replace function public.inventory_adjust(p_item uuid, p_available numeric, p_total numeric default 0)
returns numeric language plpgsql security definer set search_path = public as $$
declare v numeric;
begin
  if not public.is_staff() and coalesce(auth.role(), '') <> 'service_role' then raise exception 'Нет прав' using errcode = '42501'; end if;
  update public.inventory set quantity_available = coalesce(quantity_available, 0) + p_available, quantity = coalesce(quantity, 0) + p_total
  where id = p_item returning quantity_available into v;
  if v is null then raise exception 'Товар не найден'; end if;
  if v < 0 then raise exception 'Недостаточно на складе: не хватает %', -v; end if;
  return v;
end $$;
revoke all on function public.inventory_adjust(uuid, numeric, numeric) from public, anon;
grant execute on function public.inventory_adjust(uuid, numeric, numeric) to authenticated, service_role;
