// Типы базы для supabase-js из живой схемы: node scripts/gen-db-types.mjs
// Берёт описание схемы функцией public.schema_snapshot() (только service_role; ключ — SUPABASE_SERVICE_KEY из .env.local)
// и пишет src/lib/database.types.ts в формате `supabase gen types typescript`.
import { readFileSync, writeFileSync } from 'node:fs'

const env = Object.fromEntries(readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
  .split('\n').filter(l => /^[A-Z_]+=/.test(l)).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]))
const url = process.env.SUPABASE_URL || env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_KEY || env.SUPABASE_SERVICE_KEY
if (!url || !key) throw new Error('Нужны VITE_SUPABASE_URL и SUPABASE_SERVICE_KEY в .env.local')

const res = await fetch(url + '/rest/v1/rpc/schema_snapshot', {
  method: 'POST', headers: { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' }, body: '{}',
})
if (!res.ok) throw new Error('schema_snapshot: ' + res.status + ' ' + await res.text())
const snap = await res.json()

const SCALAR = {
  uuid: 'string', text: 'string', varchar: 'string', bpchar: 'string', char: 'string', name: 'string', citext: 'string',
  date: 'string', timestamp: 'string', timestamptz: 'string', time: 'string', timetz: 'string', interval: 'string', inet: 'string', bytea: 'string',
  int2: 'number', int4: 'number', int8: 'number', numeric: 'number', float4: 'number', float8: 'number', oid: 'number',
  bool: 'boolean', json: 'Json', jsonb: 'Json', void: 'undefined', regclass: 'string', tsvector: 'string', vector: 'string',
}
const relNames = new Set(snap.relations.map(r => r.name))
const ts = (base, isArray) => {
  let t = SCALAR[base] ?? (relNames.has(base) ? `Database['public']['Tables']['${base}']['Row']` : 'unknown')
  return isArray ? `${t.includes(' ') ? `(${t})` : t}[]` : t
}
const key_ = n => (/^[a-z_][a-z0-9_]*$/.test(n) ? n : JSON.stringify(n))
const ind = (s, n) => s.split('\n').map(l => (l ? ' '.repeat(n) + l : l)).join('\n')

function relBlock(r) {
  const cols = r.columns
  const row = cols.map(c => `${key_(c.name)}: ${ts(c.base, c.array)}${c.nullable ? ' | null' : ''}`).join('\n')
  const rels = r.fks.map(f => `{
  foreignKeyName: ${JSON.stringify(f.name)}
  columns: ${JSON.stringify(f.columns)}
  isOneToOne: ${f.one_to_one}
  referencedRelation: ${JSON.stringify(f.ref)}
  referencedColumns: ${JSON.stringify(f.ref_columns)}
}`).join(',\n')
  const relationships = `Relationships: [${rels ? '\n' + ind(rels, 2) + '\n' : ''}]`
  if (r.kind === 'view') {
    // для представлений supabase помечает все столбцы как допускающие null
    const vrow = cols.map(c => `${key_(c.name)}: ${ts(c.base, c.array)} | null`).join('\n')
    return `${key_(r.name)}: {\n  Row: {\n${ind(vrow, 4)}\n  }\n  ${relationships}\n}`
  }
  const ins = cols.filter(c => !c.generated).map(c => `${key_(c.name)}${c.nullable || c.has_default ? '?' : ''}: ${ts(c.base, c.array)}${c.nullable ? ' | null' : ''}`).join('\n')
  const upd = cols.filter(c => !c.generated).map(c => `${key_(c.name)}?: ${ts(c.base, c.array)}${c.nullable ? ' | null' : ''}`).join('\n')
  return `${key_(r.name)}: {\n  Row: {\n${ind(row, 4)}\n  }\n  Insert: {\n${ind(ins, 4)}\n  }\n  Update: {\n${ind(upd, 4)}\n  }\n  ${relationships}\n}`
}

function fnBlock(f) {
  const args = (f.args || []).filter(a => a.name)
  // аргумент функции на SQL может прийти null (так помечаются «нет счёта», «не указано»)
  const argsT = args.length ? `{\n${ind(args.map(a => `${key_(a.name)}${a.optional ? '?' : ''}: ${ts(a.base, a.array)} | null`).join('\n'), 4)}\n  }` : 'Record<PropertyKey, never>'
  let ret
  if (f.out_columns && f.out_columns.length) {
    ret = `{\n${ind(f.out_columns.map(c => `${key_(c.name)}: ${ts(c.base, c.array)}`).join("\n"), 6)}\n    }[]`
  } else if (f.returns_relation) {
    ret = `Database['public']['Tables']['${f.returns_relation}']['Row']${f.returns_set ? '[]' : ''}`
  } else {
    ret = ts(f.returns, f.returns_array) + (f.returns_set ? '[]' : '')
  }
  return `${key_(f.name)}: {\n  Args: ${argsT}\n  Returns: ${ret}\n}`
}

const tables = snap.relations.filter(r => r.kind === 'table').map(relBlock).join('\n')
const views = snap.relations.filter(r => r.kind === 'view').map(relBlock).join('\n')
// одна функция может иметь перегрузки — supabase-js принимает union, берём первую по имени
const seen = new Set()
const fns = snap.functions.filter(f => (seen.has(f.name) ? false : seen.add(f.name))).map(fnBlock).join('\n')

const out = `// Сгенерировано scripts/gen-db-types.mjs из живой схемы. Не править руками: node scripts/gen-db-types.mjs
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
${ind(tables, 6)}
    }
    Views: {
${ind(views, 6)}
    }
    Functions: {
${ind(fns, 6)}
    }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}

type PublicSchema = Database['public']
export type Tables<T extends keyof PublicSchema['Tables'] | keyof PublicSchema['Views']> =
  T extends keyof PublicSchema['Tables'] ? PublicSchema['Tables'][T]['Row']
  : T extends keyof PublicSchema['Views'] ? PublicSchema['Views'][T]['Row'] : never
export type TablesInsert<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Insert']
export type TablesUpdate<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Update']
export type Rpc<T extends keyof PublicSchema['Functions']> = PublicSchema['Functions'][T]['Returns']
`
writeFileSync(new URL('../src/lib/database.types.ts', import.meta.url), out)
console.log(`database.types.ts: таблиц ${snap.relations.filter(r => r.kind === 'table').length}, представлений ${snap.relations.filter(r => r.kind === 'view').length}, функций ${seen.size}`)
