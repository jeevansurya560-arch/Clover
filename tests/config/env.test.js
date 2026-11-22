import assert from 'node:assert';
import test from 'node:test';
import { validateEnv } from '../../apps/api/src/config.js';

test('Production Environment Safety & Config Validation Tests', async (t) => {
  await t.test('1. Development mode accepts default configuration', () => {
    const devEnv = {
      NODE_ENV: 'development',
      PORT: '4000'
    };
    assert.strictEqual(validateEnv(devEnv), true);
  });

  await t.test('2. Production mode rejects missing DATABASE_URL', () => {
    const prodEnv = {
      NODE_ENV: 'production',
      REDIS_URL: 'rediss://default:secret@prod-redis.io:6379',
      JWT_SECRET: 'production-super-secure-key-with-over-32-characters-entropy'
    };
    assert.throws(
      () => validateEnv(prodEnv),
      (err) => err.configErrors.some(e => e.includes('DATABASE_URL is required in production mode'))
    );
  });

  await t.test('3. Production mode rejects DATABASE_URL pointing to localhost', () => {
    const prodEnv = {
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/roomsync',
      REDIS_URL: 'rediss://default:secret@prod-redis.io:6379',
      JWT_SECRET: 'production-super-secure-key-with-over-32-characters-entropy'
    };
    assert.throws(
      () => validateEnv(prodEnv),
      (err) => err.configErrors.some(e => e.includes('DATABASE_URL points to localhost/127.0.0.1 in production'))
    );
  });

  await t.test('4. Production mode rejects REDIS_URL pointing to localhost', () => {
    const prodEnv = {
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://postgres:secret@db.supabase.co:5432/postgres',
      REDIS_URL: 'redis://127.0.0.1:6379',
      JWT_SECRET: 'production-super-secure-key-with-over-32-characters-entropy'
    };
    assert.throws(
      () => validateEnv(prodEnv),
      (err) => err.configErrors.some(e => e.includes('REDIS_URL points to localhost/127.0.0.1 in production'))
    );
  });

  await t.test('5. Production mode rejects default or weak JWT_SECRET', () => {
    const prodEnv = {
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://postgres:secret@db.supabase.co:5432/postgres',
      REDIS_URL: 'rediss://default:secret@prod-redis.io:6379',
      JWT_SECRET: 'roomsync-super-secret-dev-jwt-key-32chars'
    };
    assert.throws(
      () => validateEnv(prodEnv),
      (err) => err.configErrors.some(e => e.includes('cannot use the default insecure development secret'))
    );
  });

  await t.test('6. Production mode accepts valid external credentials and secret', () => {
    const prodEnv = {
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://postgres:prodpass@db.aws-rds.amazonaws.com:5432/clover_prod',
      REDIS_URL: 'rediss://default:prodpass@eu-central.upstash.io:6379',
      JWT_SECRET: 'production-super-secure-key-with-over-32-characters-entropy'
    };
    assert.strictEqual(validateEnv(prodEnv), true);
  });
});
