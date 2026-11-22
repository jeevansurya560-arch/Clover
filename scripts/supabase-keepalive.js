import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Sanitizes URLs and keys to prevent credential leakage in logs
 */
function sanitize(str) {
  if (!str) return 'not_configured';
  return str.replace(/:[^:@]+@/, ':***@').replace(/([a-zA-Z0-9_-]{8})[a-zA-Z0-9_-]+/g, '$1***');
}

/**
 * Supabase Keep-Alive Health Probe
 * Performs a lightweight, non-destructive read query to keep the Supabase PostgreSQL
 * project active and prevent the 3-day inactivity auto-pause on Supabase Free tier.
 */
export async function runSupabaseKeepAlive(options = {}) {
  const supabaseUrl = options.supabaseUrl || process.env.SUPABASE_URL;
  const supabaseAnonKey = options.supabaseAnonKey || process.env.SUPABASE_ANON_KEY;
  const databaseUrl = options.databaseUrl || process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/roomsync';

  console.log('====================================================');
  console.log('     CLOVER SUPABASE INACTIVITY KEEP-ALIVE PROBE    ');
  console.log('====================================================');
  console.log(`[Probe] Timestamp: ${new Date().toISOString()}`);

  let attempts = 0;
  const maxAttempts = 3;
  let lastError = null;

  while (attempts < maxAttempts) {
    attempts++;
    console.log(`[Probe] Attempt ${attempts} of ${maxAttempts}...`);

    // Strategy 1: REST API Ping (No table write, queries Supabase PostgREST endpoint)
    if (supabaseUrl && supabaseAnonKey) {
      try {
        const cleanUrl = supabaseUrl.replace(/\/+$/, '');
        console.log(`[Probe] Testing Supabase REST endpoint: ${cleanUrl.replace(/:[^:@]+@/, ':***@')}...`);

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        const res = await fetch(`${cleanUrl}/rest/v1/households?select=id&limit=1`, {
          method: 'GET',
          headers: {
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${supabaseAnonKey}`,
            'Range-Unit': 'items',
            'Range': '0-0'
          },
          signal: controller.signal
        });
        clearTimeout(timeout);

        if (res.ok || res.status === 200 || res.status === 206 || res.status === 401 || res.status === 403) {
          // Any non-connection response proves the Supabase project compute is awake and responding
          console.log(`✔ [Keep-Alive Success] Supabase REST API responded with HTTP status ${res.status}`);
          return {
            success: true,
            method: 'rest-api',
            statusCode: res.status,
            attempt: attempts,
            timestamp: new Date().toISOString()
          };
        } else {
          throw new Error(`HTTP error ${res.status}: ${res.statusText}`);
        }
      } catch (err) {
        lastError = err;
        console.warn(`[Probe Warning] REST attempt failed: ${err.message}`);
      }
    }

    // Strategy 2: Direct PostgreSQL SELECT 1 Query
    if (databaseUrl) {
      try {
        console.log(`[Probe] Testing direct PostgreSQL connection...`);
        const isSupabaseOrSSL = databaseUrl.includes('supabase.co') || databaseUrl.includes('sslmode=require');
        const pool = new pg.Pool({
          connectionString: databaseUrl,
          ssl: isSupabaseOrSSL ? { rejectUnauthorized: false } : false,
          connectionTimeoutMillis: 10000
        });

        const client = await pool.connect();
        const result = await client.query('SELECT 1 as keepalive_alive, NOW() as server_time');
        client.release();
        await pool.end();

        console.log(`✔ [Keep-Alive Success] PostgreSQL database query succeeded.`);
        console.log(`   Database server time: ${result.rows[0].server_time}`);
        return {
          success: true,
          method: 'postgres-select',
          serverTime: result.rows[0].server_time,
          attempt: attempts,
          timestamp: new Date().toISOString()
        };
      } catch (err) {
        lastError = err;
        console.warn(`[Probe Warning] PostgreSQL attempt failed: ${err.message}`);
      }
    }

    if (attempts < maxAttempts) {
      const backoffMs = attempts * 2000;
      console.log(`[Probe] Waiting ${backoffMs}ms before retry...`);
      await new Promise(r => setTimeout(r, backoffMs));
    }
  }

  throw new Error(`All keep-alive attempts failed. Last error: ${lastError ? lastError.message : 'Unknown'}`);
}

// Direct CLI Execution
if (process.argv[1] && process.argv[1].endsWith('supabase-keepalive.js')) {
  runSupabaseKeepAlive()
    .then((result) => {
      console.log('✅ Supabase Keep-Alive check passed. Project is active.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ Supabase Keep-Alive failed:', err.message);
      process.exit(1);
    });
}
