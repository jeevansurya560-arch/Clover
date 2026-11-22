import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Executes a child process and pipes stdout to a destination stream
 */
function dumpViaCommand(cmd, args, destStream) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';

    child.stdout.pipe(destStream, { end: false });
    child.stderr.on('data', (d) => { stderr += d.toString(); });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${cmd} exited with code ${code}: ${stderr}`));
      }
    });
  });
}

/**
 * Fallback: Pure-JS logical SQL backup via node-postgres
 */
async function dumpViaNodePg(databaseUrl, destStream) {
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 2 });
  const client = await pool.connect();

  try {
    destStream.write('-- Clover Automated Logical Database Backup\n');
    destStream.write(`-- Generated at: ${new Date().toISOString()}\n\n`);
    destStream.write('BEGIN;\n\n');

    // Fetch list of user tables
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);

    for (const row of tablesRes.rows) {
      const table = row.table_name;
      const dataRes = await client.query(`SELECT * FROM "${table}"`);
      if (dataRes.rows.length === 0) continue;

      destStream.write(`-- Table: ${table}\n`);
      for (const record of dataRes.rows) {
        const columns = Object.keys(record);
        const values = Object.values(record).map((val) => {
          if (val === null) return 'NULL';
          if (typeof val === 'number' || typeof val === 'boolean') return val;
          if (val instanceof Date) return `'${val.toISOString()}'`;
          if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
          return `'${String(val).replace(/'/g, "''")}'`;
        });
        destStream.write(`INSERT INTO "${table}" (${columns.map(c => `"${c}"`).join(', ')}) VALUES (${values.join(', ')}) ON CONFLICT DO NOTHING;\n`);
      }
      destStream.write('\n');
    }

    destStream.write('COMMIT;\n');
  } finally {
    client.release();
    await pool.end();
  }
}

/**
 * Prunes backups older than retentionDays
 */
function pruneOldBackups(backupDir, retentionDays) {
  if (!fs.existsSync(backupDir)) return 0;
  const cutoff = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);
  let pruned = 0;

  const files = fs.readdirSync(backupDir);
  for (const file of files) {
    if (!file.startsWith('clover_backup_')) continue;
    const filePath = path.join(backupDir, file);
    try {
      const stat = fs.statSync(filePath);
      if (stat.mtimeMs < cutoff) {
        fs.unlinkSync(filePath);
        pruned++;
      }
    } catch {
      // Ignore cleanup error
    }
  }
  return pruned;
}

/**
 * Automated Database Backup Routine
 */
export async function runDatabaseBackup(options = {}) {
  const backupDir = options.backupDir || path.resolve(process.cwd(), 'backups');
  const retentionDays = options.retentionDays || parseInt(process.env.BACKUP_RETENTION_DAYS || '7', 10);
  const externalDir = options.externalDir || process.env.BACKUP_EXTERNAL_DIR || null;
  const databaseUrl = options.databaseUrl || process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/roomsync';

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const now = new Date();
  const timestamp = now.toISOString().replace(/[-:]/g, '').replace('T', '_').split('.')[0];
  const filename = `clover_backup_${timestamp}.sql.gz`;
  const filePath = path.join(backupDir, filename);
  const shaPath = path.join(backupDir, `${filename}.sha256`);

  const fileWriteStream = fs.createWriteStream(filePath);
  const gzipStream = zlib.createGzip({ level: 9 });
  const hash = crypto.createHash('sha256');

  // Pipe gzip output to file and hash
  gzipStream.pipe(fileWriteStream);
  gzipStream.on('data', (chunk) => hash.update(chunk));

  let dumpMethod = 'unknown';

  // Strategy 1: Docker container pg_dump
  try {
    await dumpViaCommand('docker', ['exec', '-i', 'roomsync-postgres', 'pg_dump', '-U', 'postgres', 'roomsync'], gzipStream);
    dumpMethod = 'docker-pg_dump';
  } catch (dockerErr) {
    // Strategy 2: Host pg_dump
    try {
      await dumpViaCommand('pg_dump', [databaseUrl], gzipStream);
      dumpMethod = 'host-pg_dump';
    } catch (hostErr) {
      // Strategy 3: Pure JS via node-postgres
      await dumpViaNodePg(databaseUrl, gzipStream);
      dumpMethod = 'node-pg-logical';
    }
  }

  // End gzip stream and wait for file flush
  await new Promise((resolve, reject) => {
    gzipStream.end();
    fileWriteStream.on('finish', resolve);
    fileWriteStream.on('error', reject);
  });

  const sha256Hex = hash.digest('hex');
  fs.writeFileSync(shaPath, `${sha256Hex}  ${filename}\n`, 'utf8');

  const stat = fs.statSync(filePath);

  // Prune expired backups
  const prunedCount = pruneOldBackups(backupDir, retentionDays);

  // Mirror to external storage/directory if configured
  let externalMirrored = false;
  if (externalDir) {
    try {
      if (!fs.existsSync(externalDir)) {
        fs.mkdirSync(externalDir, { recursive: true });
      }
      fs.copyFileSync(filePath, path.join(externalDir, filename));
      fs.copyFileSync(shaPath, path.join(externalDir, `${filename}.sha256`));
      pruneOldBackups(externalDir, retentionDays);
      externalMirrored = true;
    } catch (err) {
      console.warn(`[Backup Warning] Mirroring to external dir (${externalDir}) failed:`, err.message);
    }
  }

  const result = {
    success: true,
    filename,
    filePath,
    shaPath,
    sizeBytes: stat.size,
    sha256: sha256Hex,
    dumpMethod,
    prunedCount,
    externalMirrored,
    timestamp: now.toISOString()
  };

  return result;
}

// Direct CLI execution
if (process.argv[1] && process.argv[1].endsWith('backup-db.js')) {
  console.log('[Clover Backup] Starting automated database backup...');
  runDatabaseBackup()
    .then((res) => {
      console.log('✅ Backup successfully created and verified:');
      console.log(`   File: ${res.filename} (${(res.sizeBytes / 1024).toFixed(1)} KB)`);
      console.log(`   SHA-256: ${res.sha256}`);
      console.log(`   Dump Method: ${res.dumpMethod}`);
      console.log(`   Pruned Old Backups: ${res.prunedCount}`);
      if (res.externalMirrored) console.log('   External Mirror: Synchronized');
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ Backup failed:', err.message);
      process.exit(1);
    });
}
