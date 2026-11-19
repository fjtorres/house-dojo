import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

// Public values: access is enforced by RLS in supabase/migrations, not by hiding these.
export const supabase = createClient<Database>(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
)

const messages: Record<string, string> = {
  'invalid invite code': 'Ese código no existe. Revísalo con papá o mamá.',
  'sign in with email to create a family': 'Para crear una familia entra con tu email.',
  'family request already pending': 'Ya tienes una familia esperando aprobación.',
  'admins only': 'Solo para administradores.',
  'family not found': 'Esa familia ya no existe.',
}

export const errorText = (e: { message: string }) => messages[e.message] ?? e.message
