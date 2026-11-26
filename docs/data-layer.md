# Данные в админке и кабинете (ТЗ v2, п. 5.6)

- Клиент `supabase` (src/lib/supabase.ts) типизирован схемой базы: `src/lib/database.types.ts`. Файл генерируется, руками не правится:
  `node scripts/gen-db-types.mjs` (нужен SUPABASE_SERVICE_KEY в .env.local; схема берётся функцией `public.schema_snapshot()`). Перегенерировать после каждой миграции.
- Типы строк: `Tables<'tenants'>`, `TablesInsert<'tenants'>`, `TablesUpdate<'tenants'>`, результат функции — `Rpc<'tenant_saldo'>`.
- Загрузка — react-query через src/lib/query.tsx:
  - `useSb(key, () => sb(supabase.from('x').select(...)))` — запрос; `sb()` превращает ошибку базы в исключение;
  - `sbRpc('fn', args)` — функция базы с типами;
  - `useAction(fn, { invalidate: ['tenants', 'leases'] })` — запись; после успеха обновляются все запросы, чей ключ начинается с этих имён;
  - `<QueryState q={query} empty="Нет данных">{data => …}</QueryState>` — загрузка / ошибка с «Повторить» / пусто.
- Ключ запроса начинается с имени таблицы, представления или функции: `['tenants']`, `['tenants', id]`, `['rpc:tenant_saldo']`, `['v_invoice_state', tenantId]`.
- `any` не используется; `tsconfig` — `strict: true`.
