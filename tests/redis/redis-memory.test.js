import assert from 'node:assert';
import test from 'node:test';
import IORedis from 'ioredis';
import { recurringQueue, cleanQueueHistory, stopWorker } from '../../apps/worker/src/worker.js';
import { buildApp } from '../../apps/api/src/server.js';
import { config } from '../../apps/api/src/config.js';

test('Redis Memory Resilience & Eviction Policy Tests', async (t) => {
  const redis = new IORedis(config.redisUrl, { lazyConnect: true });
  await redis.connect();

  await t.test('1. Redis maxmemory-policy is configured to protect queues (noeviction)', async () => {
    const policyConfig = await redis.config('GET', 'maxmemory-policy');
    const policy = policyConfig[1];
    assert.strictEqual(
      policy,
      'noeviction',
      'Redis maxmemory-policy must be noeviction so BullMQ queues/jobs are never silently evicted'
    );
  });

  await t.test('2. Redis maxmemory ceiling is configured to protect host OS from OOM', async () => {
    const memConfig = await redis.config('GET', 'maxmemory');
    const maxMemoryBytes = parseInt(memConfig[1], 10);
    assert(
      maxMemoryBytes > 0,
      `Redis maxmemory must be greater than 0 (found ${maxMemoryBytes} bytes)`
    );
  });

  await t.test('3. BullMQ queue specifies explicit retention limits to prevent memory growth', () => {
    assert(recurringQueue !== null, 'recurringQueue must be initialized');
    const defaultOpts = recurringQueue.defaultJobOptions;
    assert(defaultOpts, 'defaultJobOptions must be defined on BullMQ queue');
    assert(defaultOpts.removeOnComplete, 'removeOnComplete must be configured');
    assert(defaultOpts.removeOnComplete.count <= 1000, 'removeOnComplete count must be capped');
    assert(defaultOpts.removeOnFail, 'removeOnFail must be configured');
  });

  await t.test('4. Queue memory hygiene routine prunes old job metadata', async () => {
    const cleanResult = await cleanQueueHistory();
    assert.strictEqual(typeof cleanResult.cleanedCompleted, 'number');
    assert.strictEqual(typeof cleanResult.cleanedFailed, 'number');
  });

  await t.test('5. GET /health exposes Redis memory pressure telemetry', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'GET',
      url: '/health'
    });
    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.strictEqual(body.redis.status, 'healthy');
    assert(body.redis.memory, 'Memory telemetry must be present');
    assert.strictEqual(body.redis.memory.maxmemoryPolicy, 'noeviction');
    assert.strictEqual(body.redis.memory.evictionSafety, 'protected');
    await app.close();
  });

  await redis.quit();
  await stopWorker();
});
