import assert from 'node:assert';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { runDatabaseBackup } from '../../scripts/backup-db.js';
import { verifyBackupChecksum, restoreDatabase } from '../../scripts/restore-db.js';

test('Automated Database Backup & Checksum Verification Tests', async (t) => {
  const testBackupDir = path.resolve(process.cwd(), 'backups-test');

  // Clean test backup directory
  if (fs.existsSync(testBackupDir)) {
    fs.rmSync(testBackupDir, { recursive: true, force: true });
  }

  let backupResult = null;

  await t.test('1. Generates compressed .sql.gz and .sha256 files', async () => {
    backupResult = await runDatabaseBackup({
      backupDir: testBackupDir,
      retentionDays: 7
    });

    assert.strictEqual(backupResult.success, true);
    assert(fs.existsSync(backupResult.filePath), 'Backup .sql.gz file must exist');
    assert(fs.existsSync(backupResult.shaPath), 'Checksum .sha256 file must exist');
    assert(backupResult.sizeBytes > 0, 'Backup file size must be non-zero');
    assert.strictEqual(typeof backupResult.sha256, 'string');
    assert.strictEqual(backupResult.sha256.length, 64, 'SHA-256 must be 64 characters');
  });

  await t.test('2. SHA-256 checksum verification succeeds on valid backup', () => {
    const check = verifyBackupChecksum(backupResult.filePath, backupResult.shaPath);
    assert.strictEqual(check.verified, true);
    assert.strictEqual(check.hash, backupResult.sha256);
  });

  await t.test('3. SHA-256 checksum rejects corrupted backup file', () => {
    const corruptedFile = path.join(testBackupDir, 'corrupted_backup.sql.gz');
    const corruptedSha = path.join(testBackupDir, 'corrupted_backup.sql.gz.sha256');

    // Create a corrupted clone
    const buffer = fs.readFileSync(backupResult.filePath);
    buffer[10] = (buffer[10] + 1) % 256; // Corrupt single byte
    fs.writeFileSync(corruptedFile, buffer);
    fs.copyFileSync(backupResult.shaPath, corruptedSha);

    assert.throws(
      () => verifyBackupChecksum(corruptedFile, corruptedSha),
      (err) => err.message.includes('Checksum verification failed')
    );
  });

  await t.test('4. Decompressed backup contains valid SQL with household schemas', () => {
    const compressed = fs.readFileSync(backupResult.filePath);
    const sql = zlib.gunzipSync(compressed).toString('utf8');
    assert(
      sql.includes('households') || sql.includes('profiles') || sql.includes('expenses'),
      'Backup SQL must contain core household relational schema or data'
    );
  });

  await t.test('5. Pruning removes expired backups outside retention window', async () => {
    // Create a mock expired backup file with mtime set to 10 days ago
    const expiredFile = path.join(testBackupDir, 'clover_backup_20200101_000000.sql.gz');
    const expiredSha = path.join(testBackupDir, 'clover_backup_20200101_000000.sql.gz.sha256');
    fs.writeFileSync(expiredFile, 'dummy');
    fs.writeFileSync(expiredSha, 'dummy');

    const tenDaysAgo = new Date(Date.now() - (10 * 24 * 60 * 60 * 1000));
    fs.utimesSync(expiredFile, tenDaysAgo, tenDaysAgo);
    fs.utimesSync(expiredSha, tenDaysAgo, tenDaysAgo);

    // Run backup with 7 day retention
    const secondRun = await runDatabaseBackup({
      backupDir: testBackupDir,
      retentionDays: 7
    });

    assert(secondRun.prunedCount >= 2, 'Must prune expired backup and checksum files');
    assert(!fs.existsSync(expiredFile), 'Expired backup file must be removed');
    assert(!fs.existsSync(expiredSha), 'Expired sha file must be removed');
  });

  // Cleanup test backup directory
  if (fs.existsSync(testBackupDir)) {
    fs.rmSync(testBackupDir, { recursive: true, force: true });
  }
});
