import IORedis from 'ioredis';
import { checkDatabaseHealth } from '../../database/db.js';
import { config } from '../../config.js';

export async function healthRoutes(fastify) {
  fastify.get('/health', async (request, reply) => {
    const dbHealth = await checkDatabaseHealth();
    let redisHealth = { status: 'standby' };

    let tempClient = null;
    try {
      tempClient = new IORedis(config.redisUrl, {
        connectTimeout: 1500,
        maxRetriesPerRequest: 0,
        lazyConnect: true
      });
      await tempClient.connect();
      const pong = await tempClient.ping();

      if (pong === 'PONG') {
        let memoryInfo = {};
        let maxmemoryPolicy = 'unknown';

        try {
          const rawMemory = await tempClient.info('memory');
          const maxPolicyConfig = await tempClient.config('GET', 'maxmemory-policy');
          maxmemoryPolicy = Array.isArray(maxPolicyConfig) && maxPolicyConfig[1] ? maxPolicyConfig[1] : 'unknown';

          const usedMatch = rawMemory.match(/used_memory_human:([^\r\n]+)/);
          const maxMatch = rawMemory.match(/maxmemory_human:([^\r\n]+)/);
          const usedBytesMatch = rawMemory.match(/used_memory:([0-9]+)/);
          const maxBytesMatch = rawMemory.match(/maxmemory:([0-9]+)/);

          const usedBytes = usedBytesMatch ? parseInt(usedBytesMatch[1], 10) : 0;
          const maxBytes = maxBytesMatch ? parseInt(maxBytesMatch[1], 10) : 0;

          const usagePercent = maxBytes > 0 ? `${((usedBytes / maxBytes) * 100).toFixed(1)}%` : 'unbounded';
          const isEvictionSafe = maxmemoryPolicy === 'noeviction' || maxmemoryPolicy.startsWith('volatile');

          memoryInfo = {
            usedMemoryHuman: usedMatch ? usedMatch[1].trim() : 'unknown',
            maxMemoryHuman: maxMatch ? maxMatch[1].trim() : 'unbounded',
            maxmemoryBytes: maxBytes,
            usagePercent,
            maxmemoryPolicy,
            evictionSafety: isEvictionSafe ? 'protected' : 'risk-data-loss',
            pressureStatus: (maxBytes > 0 && (usedBytes / maxBytes) > 0.85) ? 'high-pressure' : 'optimal'
          };
        } catch {
          memoryInfo = { status: 'basic' };
        }

        redisHealth = {
          status: 'healthy',
          ping: 'PONG',
          url: config.redisUrl.replace(/:[^:@]+@/, ':***@'),
          memory: memoryInfo
        };
      }
    } catch (err) {
      redisHealth = { status: 'offline', error: err.message };
    } finally {
      if (tempClient) {
        tempClient.disconnect();
      }
    }

    return {
      status: 'ok',
      service: 'clover-api',
      timestamp: new Date().toISOString(),
      database: dbHealth,
      redis: redisHealth
    };
  });
}
