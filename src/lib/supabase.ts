import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

/** Клиент с типами из схемы базы (src/lib/database.types.ts, генерируется scripts/gen-db-types.mjs). */
export const supabase = createClient<Database>(url, key)
