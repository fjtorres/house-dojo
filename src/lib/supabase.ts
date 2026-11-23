import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import { messages } from '../i18n'

// Public values: access is enforced by RLS in supabase/migrations, not by hiding these.
export const supabase = createClient<Database>(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
)

export const errorText = (e: { message: string }) => messages().errors.db[e.message] ?? e.message
