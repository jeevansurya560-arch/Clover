import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const { Client } = pg;

async function runSeed() {
  const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/roomsync';
  const isSupabaseOrSSL = connectionString.includes('supabase.co') || connectionString.includes('sslmode=require');
  console.log(`[Seed] Connecting to PostgreSQL at ${connectionString}...`);

  const client = new Client({
    connectionString,
    ssl: isSupabaseOrSSL ? { rejectUnauthorized: false } : false
  });
  await client.connect();

  console.log('Connected to PostgreSQL successfully.');

  const seedFile = path.resolve(__dirname, '../../../../supabase/seed.sql');
  console.log(`[Seed] Applying seed file ${seedFile}...`);
  const sql = fs.readFileSync(seedFile, 'utf8');
  await client.query(sql);
  console.log('[Seed] ✔ Seed data successfully loaded.');

  await client.end();
}

runSeed().catch(err => {
  console.error('[Seed Error]', err.message);
  process.exit(1);
});
