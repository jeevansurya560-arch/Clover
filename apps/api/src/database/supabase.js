import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'dummy-anon-key';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || null;

/**
 * Public/User-scoped Supabase client (respects RLS)
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false }
});

/**
 * Admin/Service-role Supabase client (server-side only, bypasses RLS)
 * Never expose to frontend or client-side bundles!
 */
export const supabaseAdmin = supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    })
  : null;

/**
 * Get authenticated Supabase client for a specific user JWT
 */
export function getAuthenticatedSupabaseClient(userJwt) {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
    global: {
      headers: {
        Authorization: `Bearer ${userJwt}`
      }
    }
  });
}
