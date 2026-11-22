import pg from 'pg';
import { config } from '../config.js';

const { Pool, Client } = pg;

export let realPool = null;
export let isUsingPostgres = false;
let currentConnectionString = null;

export function getCleanConnectionString(customUrl) {
  const targetUrl = (customUrl || process.env.DATABASE_URL || config.databaseUrl || '').trim();
  if (!targetUrl) return '';

  const isSupabaseOrSSL = targetUrl.includes('supabase.co') || targetUrl.includes('sslmode=require');
  return isSupabaseOrSSL
    ? targetUrl.replace(/([?&])sslmode=[^&]+(&|$)/, '$1').replace(/[?&]$/, '')
    : targetUrl;
}

export function initPool(customUrl) {
  const cleanConnectionString = getCleanConnectionString(customUrl);
  if (!cleanConnectionString) return null;

  const isSupabaseOrSSL = cleanConnectionString.includes('supabase.co') || cleanConnectionString.includes('sslmode=require');

  if (realPool && currentConnectionString === cleanConnectionString) {
    return realPool;
  }

  if (realPool) {
    try { realPool.end(); } catch {}
  }

  currentConnectionString = cleanConnectionString;

  try {
    realPool = new Pool({
      connectionString: cleanConnectionString,
      ssl: isSupabaseOrSSL ? { rejectUnauthorized: false } : false,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 10000,
      max: 10
    });

    realPool.on('error', (err) => {
      console.warn('[Postgres Pool Warning]', err.message);
    });
  } catch (err) {
    console.warn('[Postgres Init] Real Postgres not configured:', err.message);
  }

  return realPool;
}

export async function query(sql, params = []) {
  const isWorker = typeof WebSocketPair !== 'undefined' || process.env.CLOUDFLARE_WORKER === 'true';
  const cleanConnectionString = getCleanConnectionString();
  if (!cleanConnectionString) return null;

  if (isWorker) {
    const isSupabaseOrSSL = cleanConnectionString.includes('supabase.co') || cleanConnectionString.includes('sslmode=require');
    const hostMatch = cleanConnectionString.match(/@([^:/]+)/);
    const dbHost = hostMatch ? hostMatch[1] : undefined;
    const client = new Client({
      connectionString: cleanConnectionString,
      ssl: isSupabaseOrSSL ? { rejectUnauthorized: false, servername: dbHost, expectedServerHostname: dbHost } : false,
      connectionTimeoutMillis: 5000
    });
    try {
      console.log('[db query worker] Connecting client...');
      await client.connect();
      console.log('[db query worker] Client connected. Querying:', sql.substring(0, 60));
      return await client.query(sql, params);
    } catch (err) {
      console.error('[db query worker error]', err.message || err);
      throw err;
    } finally {
      try { await client.end(); } catch {}
    }
  } else {
    if (!realPool) initPool();
    return await realPool.query(sql, params);
  }
}

export async function getClient() {
  const isWorker = typeof WebSocketPair !== 'undefined' || process.env.CLOUDFLARE_WORKER === 'true';
  const cleanConnectionString = getCleanConnectionString();
  if (!cleanConnectionString) throw new Error('No database connection string');

  if (isWorker) {
    const isSupabaseOrSSL = cleanConnectionString.includes('supabase.co') || cleanConnectionString.includes('sslmode=require');
    const hostMatch = cleanConnectionString.match(/@([^:/]+)/);
    const dbHost = hostMatch ? hostMatch[1] : undefined;
    const client = new Client({
      connectionString: cleanConnectionString,
      ssl: isSupabaseOrSSL ? { rejectUnauthorized: false, servername: dbHost, expectedServerHostname: dbHost } : false,
      connectionTimeoutMillis: 5000
    });
    try {
      console.log('[db getClient worker] Connecting client...');
      await client.connect();
      console.log('[db getClient worker] Client connected successfully');
    } catch (err) {
      console.error('[db getClient worker connect error]', err.message || err);
      throw err;
    }
    client.release = async () => {
      try { await client.end(); } catch {}
    };
    return client;
  } else {
    if (!realPool) initPool();
    return await realPool.connect();
  }
}

export const pool = {
  query: (sql, params) => query(sql, params),
  connect: () => getClient(),
  end: () => closeDatabase(),
  on: (event, handler) => {
    if (realPool) realPool.on(event, handler);
  }
};

// Initial initialization attempt
try {
  initPool();
} catch (err) {
  console.warn('[Postgres Init] Initial attempt failed:', err.message);
}

export async function closeDatabase() {
  if (realPool) {
    try {
      await realPool.end();
    } catch {}
    realPool = null;
  }
}

/**
 * Health check query
 */
export async function checkDatabaseHealth() {
  try {
    const res = await query('SELECT 1 as alive');
    if (res && res.rows && res.rows[0].alive === 1) {
      isUsingPostgres = true;
      return { status: 'healthy', driver: 'postgresql' };
    }
  } catch (err) {
    console.warn('[checkDatabaseHealth]', err.message);
  }
  return { status: 'fallback_ready', driver: 'in_memory_store' };
}
