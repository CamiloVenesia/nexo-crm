
import { createClient } from '@supabase/supabase-js';

const url = (
  import.meta.env.VITE_SUPABASE_URL ?? ''
).trim();

const key = (
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? ''
).trim();

// Sin configuración se conserva la demo local.
// Con configuración se habilita Supabase Auth.

export const supabase =
  url && key
    ? createClient(url, key, {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
        },
      })
    : null;
