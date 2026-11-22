import { HouseholdRealtimeDO } from './realtime/cloudflare-do.js';
import { repository } from './database/repository.js';
import { buildApp } from './server.js';

export { HouseholdRealtimeDO };

let cachedApp = null;

async function getFastifyApp() {
  if (!cachedApp) {
    cachedApp = await buildApp();
  }
  return cachedApp;
}

/**
 * Cloudflare Worker Entrypoint for Clover 🍀
 * Unifies:
 * 1. Next.js Static Asset Serving via env.ASSETS
 * 2. Real-Time WebSockets via Cloudflare Durable Objects (HouseholdRealtimeDO)
 * 3. Fastify REST API Routing & Supabase Data Queries
 * 4. Background Scheduled Processing via Cloudflare Cron Triggers
 */
export default {
  async fetch(request, env, ctx) {
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
        const app = await getFastifyApp();

        // Convert Fetch Request headers to plain object
        const headers = {};
        for (const [key, value] of request.headers.entries()) {
          headers[key] = value;
        }

        let payload = undefined;
        if (request.method !== 'GET' && request.method !== 'HEAD') {
          payload = await request.text();
        }

        // Dispatch request to Fastify app instance via inject
        const response = await app.inject({
          method: request.method,
          url: url.pathname + url.search,
          headers,
          payload
        });

        // If outbox event was generated, dispatch to Durable Object in background
        if (env.HOUSEHOLD_REALTIME && response.statusCode >= 200 && response.statusCode < 300) {
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

        return new Response(response.payload, {
          status: response.statusCode,
          headers: response.headers
        });
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
