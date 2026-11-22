import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const { Client } = pg;

async function runMigrations() {
  const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/roomsync';
  const isSupabaseOrSSL = connectionString.includes('supabase.co') || connectionString.includes('sslmode=require');
  console.log(`[Migration] Connecting to PostgreSQL at ${connectionString}...`);

  const client = new Client({
    connectionString,
    ssl: isSupabaseOrSSL ? { rejectUnauthorized: false } : false
  });
  await client.connect();

  console.log('Connected to PostgreSQL successfully.');

  const migrationsDir = path.resolve(__dirname, '../../../../supabase/migrations');
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

  for (const file of files) {
    const filePath = path.join(migrationsDir, file);
    console.log(`[Migration] Applying ${file}...`);
    const sql = fs.readFileSync(filePath, 'utf8');
    await client.query(sql);
    console.log(`[Migration] ✔ Successfully applied ${file}`);
  }

  await client.end();
  console.log('[Migration] All migrations completed successfully.');
}

runMigrations().catch(err => {
  console.error('[Migration Error]', err.message);
  process.exit(1);
});
