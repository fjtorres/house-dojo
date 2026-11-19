import { createClient } from '@supabase/supabase-js'

// Public values: access is enforced by RLS in supabase/migrations, not by hiding these.
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
)
