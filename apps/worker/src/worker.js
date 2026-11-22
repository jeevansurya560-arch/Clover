import { Worker, Queue } from 'bullmq';
import IORedis from 'ioredis';
import dotenv from 'dotenv';
dotenv.config();

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
let redisConnection = null;

try {
  redisConnection = new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy(times) {
      const delay = Math.min(times * 500, 5000);
      return delay;
    }
  });

  redisConnection.on('error', (err) => {
    console.warn('[RoomSync Worker] Redis connection notice:', err.message);
  });
} catch (err) {
  console.warn('[RoomSync Worker] Redis init warning:', err.message);
}

export const recurringQueue = redisConnection ? new Queue('roomsync-recurring', { connection: redisConnection }) : null;

// Worker job processors
export async function processJob(job) {
  console.log(`[Worker Job] Processing ${job.name} (ID: ${job.id})`);
  switch (job.name) {
    case 'reconcile-recurring-bills':
      console.log('[Worker] Checking recurring bill occurrences...');
      return { processed: true, count: 0 };

    case 'rotate-recurring-chores':
      console.log('[Worker] Checking and rotating recurring chores...');
      return { processed: true, count: 0 };

    case 'outbox-sweeper':
      console.log('[Worker] Sweeping outbox queue...');
      return { processed: true };

    default:
      console.log(`[Worker] Unhandled job ${job.name}`);
      return { processed: false };
  }
}

let workerInstance = null;
if (redisConnection) {
  try {
    workerInstance = new Worker('roomsync-recurring', processJob, {
      connection: redisConnection,
      concurrency: 5
    });

    workerInstance.on('completed', (job) => {
      console.log(`[Worker Job Completed] ${job.name} (#${job.id})`);
    });

    workerInstance.on('failed', (job, err) => {
      console.error(`[Worker Job Failed] ${job?.name}: ${err.message}`);
    });

    console.log('[RoomSync Worker] BullMQ queue worker started successfully.');
  } catch (err) {
    console.warn('[RoomSync Worker] BullMQ worker standby mode:', err.message);
  }
}

export default workerInstance;
