import { createClient } from '@supabase/supabase-js';

let supabaseClient = null;

/**
 * Returns an authoritative Supabase HTTPS Client.
 * Uses native Web fetch, immune to raw TCP/SSL socket drops on edge runtimes.
 */
export function getSupabaseClient(env = process.env) {
  const url = env.SUPABASE_URL || 'https://uppnvaogkumnryxinmvh.supabase.co';
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY || env.SUPABASE_KEY;

  if (!key) return null;

  if (!supabaseClient) {
    supabaseClient = createClient(url, key, {
      auth: { persistSession: false }
    });
  }
  return supabaseClient;
}
