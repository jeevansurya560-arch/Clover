import pg from 'pg';
import { config } from '../config.js';

const { Pool } = pg;

export let pool = null;
export let isUsingPostgres = false;

// Attempt to initialize real PostgreSQL Pool (supports direct Postgres & Supabase Pooler)
try {
  const isSupabaseOrSSL = config.databaseUrl.includes('supabase.co') || config.databaseUrl.includes('sslmode=require');
  const cleanConnectionString = isSupabaseOrSSL
    ? config.databaseUrl.replace(/([?&])sslmode=[^&]+(&|$)/, '$1').replace(/[?&]$/, '')
    : config.databaseUrl;

  pool = new Pool({
    connectionString: cleanConnectionString,
    ssl: isSupabaseOrSSL ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 10000,
    max: 10
  });

  pool.on('error', (err) => {
    // Log unexpected errors on idle clients without crashing
    console.warn('[Postgres Pool Warning]', err.message);
  });
} catch (err) {
  console.warn('[Postgres Init] Real Postgres not configured:', err.message);
}

export async function closeDatabase() {
  if (pool) {
    try {
      await pool.end();
    } catch {}
  }
}

/**
 * Health check query
 */
export async function checkDatabaseHealth() {
  if (pool) {
    try {
      const res = await pool.query('SELECT 1 as alive');
      if (res && res.rows && res.rows[0].alive === 1) {
        isUsingPostgres = true;
        return { status: 'healthy', driver: 'postgresql' };
      }
    } catch {
      // Fall through to fallback
    }
  }
  return { status: 'fallback_ready', driver: 'in_memory_store' };
}
