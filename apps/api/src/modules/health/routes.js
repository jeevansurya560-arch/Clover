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
        connectTimeout: 1000,
        maxRetriesPerRequest: 0,
        lazyConnect: true
      });
      await tempClient.connect();
      const pong = await tempClient.ping();
      if (pong === 'PONG') {
        redisHealth = { status: 'healthy', ping: 'PONG', url: config.redisUrl };
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
      service: 'roomsync-api',
      timestamp: new Date().toISOString(),
      database: dbHealth,
      redis: redisHealth
    };
  });
}
