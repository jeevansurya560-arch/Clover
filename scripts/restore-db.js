import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Verifies SHA-256 checksum of the backup file
 */
export function verifyBackupChecksum(backupFilePath, shaFilePath) {
  if (!fs.existsSync(backupFilePath)) {
    throw new Error(`Backup file not found: ${backupFilePath}`);
  }
  if (!fs.existsSync(shaFilePath)) {
    throw new Error(`Checksum file not found: ${shaFilePath}`);
  }

  const expectedContent = fs.readFileSync(shaFilePath, 'utf8').trim();
  const expectedHash = expectedContent.split(/\s+/)[0];

  const fileBuffer = fs.readFileSync(backupFilePath);
  const actualHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

  if (actualHash.toLowerCase() !== expectedHash.toLowerCase()) {
    throw new Error(`Checksum verification failed!\n  Expected: ${expectedHash}\n  Actual:   ${actualHash}`);
  }

  return { verified: true, hash: actualHash };
}

/**
 * Restores database from a verified .sql.gz backup
 */
export async function restoreDatabase(backupFilePath, options = {}) {
  const databaseUrl = options.databaseUrl || process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/roomsync';
  const shaFilePath = options.shaFilePath || `${backupFilePath}.sha256`;

  // 1. Checksum verification
  const check = verifyBackupChecksum(backupFilePath, shaFilePath);
  console.log(`[Clover Restore] Checksum verified: ${check.hash}`);

  // 2. Decompress .sql.gz
  const compressedData = fs.readFileSync(backupFilePath);
  const sqlText = zlib.gunzipSync(compressedData).toString('utf8');

  // 3. Execute restoration
  let restoreMethod = 'unknown';

  try {
    // Attempt Docker restore via psql
    await new Promise((resolve, reject) => {
      const child = spawn('docker', ['exec', '-i', 'roomsync-postgres', 'psql', '-U', 'postgres', 'roomsync'], {
        stdio: ['pipe', 'pipe', 'pipe']
      });
      let stderr = '';
      child.stderr.on('data', (d) => { stderr += d.toString(); });
      child.on('error', reject);
      child.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Docker psql exited with code ${code}: ${stderr}`));
      });
      child.stdin.write(sqlText);
      child.stdin.end();
    });
    restoreMethod = 'docker-psql';
  } catch (dockerErr) {
    // Fallback to pure node-postgres execution
    const pool = new pg.Pool({ connectionString: databaseUrl });
    const client = await pool.connect();
    try {
      await client.query(sqlText);
      restoreMethod = 'node-pg-client';
    } finally {
      client.release();
      await pool.end();
    }
  }

  return {
    success: true,
    backupFilePath,
    sha256: check.hash,
    restoreMethod,
    restoredBytes: sqlText.length
  };
}

// Direct CLI execution
if (process.argv[1] && process.argv[1].endsWith('restore-db.js')) {
  const backupDir = path.resolve(process.cwd(), 'backups');
  let targetFile = process.argv[2];

  if (!targetFile) {
    // Find newest backup in backups/
    if (!fs.existsSync(backupDir)) {
      console.error('❌ No backups directory found at', backupDir);
      process.exit(1);
    }
    const files = fs.readdirSync(backupDir).filter(f => f.endsWith('.sql.gz')).sort().reverse();
    if (files.length === 0) {
      console.error('❌ No .sql.gz backup files found in', backupDir);
      process.exit(1);
    }
    targetFile = path.join(backupDir, files[0]);
  }

  console.log(`[Clover Restore] Restoring from ${targetFile}...`);
  restoreDatabase(targetFile)
    .then((res) => {
      console.log('✅ Database restore complete:');
      console.log(`   Method: ${res.restoreMethod}`);
      console.log(`   Restored SQL Size: ${(res.restoredBytes / 1024).toFixed(1)} KB`);
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ Database restore failed:', err.message);
      process.exit(1);
    });
}
