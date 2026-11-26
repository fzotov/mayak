-- Описание схемы public для генерации типов TypeScript (scripts/gen-db-types.mjs).
-- Только для service_role: ни сотрудникам, ни арендаторам, ни anon недоступно.
create or replace function public.schema_snapshot() returns jsonb
language sql stable security definer set search_path = public, pg_catalog as $$
  select jsonb_build_object(
    'relations', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'name', c.relname,
        'kind', case c.relkind when 'r' then 'table' when 'p' then 'table' else 'view' end,
        'columns', (
          select jsonb_agg(jsonb_build_object(
            'name', a.attname,
            'type', format_type(a.atttypid, a.atttypmod),
            'base', coalesce(et.typname, t.typname),
            'array', t.typcategory = 'A',
            'nullable', not a.attnotnull,
            'has_default', a.atthasdef or a.attidentity <> '' or a.attgenerated <> '',
            'generated', a.attidentity = 'a' or a.attgenerated <> ''
          ) order by a.attnum)
          from pg_attribute a join pg_type t on t.oid = a.atttypid left join pg_type et on et.oid = t.typelem and t.typcategory = 'A'
          where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped),
        'fks', (
          select coalesce(jsonb_agg(jsonb_build_object(
            'name', k.conname,
            'columns', (select jsonb_agg(att.attname order by u.ord) from unnest(k.conkey) with ordinality u(n, ord) join pg_attribute att on att.attrelid = k.conrelid and att.attnum = u.n),
            'ref', rc.relname,
            'ref_columns', (select jsonb_agg(att.attname order by u.ord) from unnest(k.confkey) with ordinality u(n, ord) join pg_attribute att on att.attrelid = k.confrelid and att.attnum = u.n),
            'one_to_one', exists (select 1 from pg_constraint uq where uq.conrelid = k.conrelid and uq.contype in ('p', 'u') and uq.conkey = k.conkey)
          ) order by k.conname), '[]')
          from pg_constraint k join pg_class rc on rc.oid = k.confrelid join pg_namespace rn on rn.oid = rc.relnamespace
          where k.conrelid = c.oid and k.contype = 'f' and rn.nspname = 'public')
      ) order by c.relname), '[]')
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm')
    ),
    'functions', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'name', p.proname,
        'args', (
          select coalesce(jsonb_agg(jsonb_build_object('name', p.proargnames[i], 'base', coalesce(et.typname, t.typname), 'array', t.typcategory = 'A',
                                                       'optional', i > p.pronargs - p.pronargdefaults) order by i), '[]')
          from generate_subscripts(coalesce(p.proallargtypes, array(select unnest(p.proargtypes::oid[]))), 1) i
          join pg_type t on t.oid = (coalesce(p.proallargtypes, array(select unnest(p.proargtypes::oid[]))))[i]
          left join pg_type et on et.oid = t.typelem and t.typcategory = 'A'
          where coalesce(p.proargmodes[i], 'i') in ('i', 'b') and p.proargnames is not null),
        'returns_set', p.proretset,
        'returns', (select coalesce(et.typname, t.typname) from pg_type t left join pg_type et on et.oid = t.typelem and t.typcategory = 'A' where t.oid = p.prorettype),
        'returns_array', (select t.typcategory = 'A' from pg_type t where t.oid = p.prorettype),
        'returns_relation', (select rc.relname from pg_type t join pg_class rc on rc.oid = t.typrelid where t.oid = p.prorettype),
        'out_columns', (
          select jsonb_agg(jsonb_build_object('name', p.proargnames[i], 'base', coalesce(et.typname, t.typname), 'array', t.typcategory = 'A') order by i)
          from generate_subscripts(p.proallargtypes, 1) i
          join pg_type t on t.oid = p.proallargtypes[i]
          left join pg_type et on et.oid = t.typelem and t.typcategory = 'A'
          where p.proargmodes[i] in ('t', 'o', 'b'))
      ) order by p.proname), '[]')
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.prokind = 'f' and p.prorettype <> 'trigger'::regtype and p.proname not like '\_%'
        and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
    )
  )
$$;
revoke all on function public.schema_snapshot() from public, anon, authenticated;
grant execute on function public.schema_snapshot() to service_role;
