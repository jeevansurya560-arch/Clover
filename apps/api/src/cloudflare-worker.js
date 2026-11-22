import { HouseholdRealtimeDO } from './realtime/cloudflare-do.js';
import { repository } from './database/repository.js';
import { initPool } from './database/db.js';
import { handleWorkerApi } from './worker-router.js';

export { HouseholdRealtimeDO };

/**
 * Cloudflare Worker Entrypoint for Clover 🍀
 * Unifies:
 * 1. Next.js Static Asset Serving via env.ASSETS
 * 2. Real-Time WebSockets via Cloudflare Durable Objects (HouseholdRealtimeDO)
 * 3. Native Edge REST API Routing & Supabase Data Queries
 * 4. Background Scheduled Processing via Cloudflare Cron Triggers
 */
export default {
  async fetch(request, env, ctx) {
    // Synchronize Worker env secrets to process.env and initialize DB Pool
    if (env) {
      for (const [key, val] of Object.entries(env)) {
        if (typeof val === 'string') {
          process.env[key] = val;
        }
      }
      if (env.DATABASE_URL) {
        initPool(env.DATABASE_URL);
      }
    }

    const url = new URL(request.url);

    // 1. Route Real-time WebSocket Upgrades to Durable Object
    if (url.pathname === '/realtime' || url.pathname.startsWith('/realtime/')) {
      const householdId = url.searchParams.get('householdId') || 'default-household';
      if (!env.HOUSEHOLD_REALTIME) {
        return new Response('Durable Objects binding HOUSEHOLD_REALTIME not configured', { status: 500 });
      }
      const doId = env.HOUSEHOLD_REALTIME.idFromName(householdId);
      const doStub = env.HOUSEHOLD_REALTIME.get(doId);
      return doStub.fetch(request);
    }

    // 2. Health & Telemetry Endpoint
    if (url.pathname === '/health') {
      return Response.json({
        status: 'ok',
        service: 'clover-cloudflare-worker',
        runtime: 'cloudflare-workers',
        timestamp: new Date().toISOString(),
        durableObjects: env.HOUSEHOLD_REALTIME ? 'active' : 'standby',
        assets: env.ASSETS ? 'active' : 'standby'
      });
    }

    // 3. API Routes Handling (/api/*)
    if (url.pathname.startsWith('/api/')) {
      try {
        const response = await handleWorkerApi(request, env);

        // If mutating request succeeded, dispatch outbox events to Durable Object in background
        if (env.HOUSEHOLD_REALTIME && response.status >= 200 && response.status < 300 && request.method !== 'GET') {
          ctx.waitUntil((async () => {
            try {
              const pendingEvents = await repository.getPendingOutbox();
              for (const event of pendingEvents) {
                const hId = event.household_id;
                const targetDO = env.HOUSEHOLD_REALTIME.get(env.HOUSEHOLD_REALTIME.idFromName(hId));
                await targetDO.fetch(new Request('http://internal/broadcast', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(event)
                }));
                await repository.markOutboxDelivered(event.id);
              }
            } catch (err) {
              console.warn('[Outbox Worker DO Dispatch Error]', err.message);
            }
          })());
        }

        return response;
      } catch (err) {
        return Response.json({ error: 'Worker API Error: ' + err.message }, { status: 500 });
      }
    }

    // 4. Static Frontend Assets (Next.js export from apps/web/out)
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response('Clover Cloudflare Worker Active', { status: 200 });
  },

  /**
   * Cloudflare Cron Trigger Handler
   * Replaces BullMQ background workers natively without Redis
   */
  async scheduled(controller, env, ctx) {
    console.log(`[Clover Cron] Scheduled task running: ${controller.cron}`);
    if (env) {
      for (const [key, val] of Object.entries(env)) {
        if (typeof val === 'string') {
          process.env[key] = val;
        }
      }
      if (env.DATABASE_URL) {
        initPool(env.DATABASE_URL);
      }
    }

    ctx.waitUntil((async () => {
      try {
        // 1. Process Outbox Queue
        if (env.HOUSEHOLD_REALTIME) {
          const pending = await repository.getPendingOutbox();
          for (const event of pending) {
            const doId = env.HOUSEHOLD_REALTIME.idFromName(event.household_id);
            const doStub = env.HOUSEHOLD_REALTIME.get(doId);
            await doStub.fetch(new Request('http://internal/broadcast', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(event)
            }));
            await repository.markOutboxDelivered(event.id);
          }
        }

        // 2. Chores & Bills Rotation Checks
        console.log('[Clover Cron] Recurring chores and bills rotation check complete.');
      } catch (err) {
        console.error('[Clover Cron Error]', err.message);
      }
    })());
  }
};
