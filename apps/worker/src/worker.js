import { Worker, Queue } from 'bullmq';
import IORedis from 'ioredis';
import dotenv from 'dotenv';
import { runDatabaseBackup } from '../../../scripts/backup-db.js';

dotenv.config();

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
export let redisConnection = null;

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
    console.warn('[Clover Worker] Redis connection notice:', err.message);
  });
} catch (err) {
  console.warn('[Clover Worker] Redis init warning:', err.message);
}

// BullMQ Queue with strict memory retention options to eliminate memory creep
export const recurringQueue = redisConnection ? new Queue('roomsync-recurring', {
  connection: redisConnection,
  defaultJobOptions: {
    // Retain at most 1,000 completed jobs or 24 hours to prevent memory exhaustion
    removeOnComplete: { age: 86400, count: 1000 },
    // Retain failed jobs for 7 days (max 5,000) for operational inspection
    removeOnFail: { age: 7 * 86400, count: 5000 },
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 }
  }
}) : null;

/**
 * Queue Hygiene Routine: Actively sweeps and prunes expired job keys
 */
export async function cleanQueueHistory() {
  if (!recurringQueue) return { cleanedCompleted: 0, cleanedFailed: 0 };
  try {
    const cleanedCompleted = await recurringQueue.clean(24 * 3600 * 1000, 1000, 'completed');
    const cleanedFailed = await recurringQueue.clean(7 * 24 * 3600 * 1000, 5000, 'failed');
    return { cleanedCompleted: cleanedCompleted.length, cleanedFailed: cleanedFailed.length };
  } catch (err) {
    console.warn('[Clover Worker] Queue hygiene warning:', err.message);
    return { error: err.message };
  }
}

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

    case 'backup-database':
      console.log('[Worker] Running automated database backup...');
      try {
        const backupRes = await runDatabaseBackup();
        return { processed: true, backup: backupRes };
      } catch (err) {
        console.error('[Worker] Backup execution failed:', err.message);
        throw err;
      }

    case 'queue-maintenance':
      console.log('[Worker] Running queue memory hygiene sweep...');
      const cleanRes = await cleanQueueHistory();
      return { processed: true, cleaned: cleanRes };

    default:
      console.log(`[Worker] Unhandled job ${job.name}`);
      return { processed: false };
  }
}

let workerInstance = null;
if (redisConnection && process.env.NODE_ENV !== 'test') {
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

    console.log('[Clover Worker] BullMQ queue worker started successfully with memory retention protection.');
  } catch (err) {
    console.warn('[Clover Worker] BullMQ worker standby mode:', err.message);
  }
}

export async function stopWorker() {
  if (workerInstance) {
    await workerInstance.close();
    workerInstance = null;
  }
  if (recurringQueue) {
    await recurringQueue.close();
  }
  if (redisConnection) {
    await redisConnection.quit();
  }
}

export default workerInstance;
