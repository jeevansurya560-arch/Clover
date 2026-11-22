import EventEmitter from 'node:events';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import { config } from './config.js';
import { initSocket } from './realtime/socket.js';
import { checkDatabaseHealth, closeDatabase } from './database/db.js';
import { startOutboxDispatcher } from './outbox/dispatcher.js';

// Route Modules
import { healthRoutes } from './modules/health/routes.js';
import { authRoutes } from './modules/auth/routes.js';
import { householdRoutes } from './modules/households/routes.js';
import { expenseRoutes } from './modules/expenses/routes.js';
import { shoppingRoutes } from './modules/shopping/routes.js';
import { choreRoutes } from './modules/chores/routes.js';
import { billRoutes } from './modules/bills/routes.js';
import { pollRoutes } from './modules/polls/routes.js';
import { activityRoutes } from './modules/activity/routes.js';
import { analyticsRoutes } from './modules/analytics/routes.js';

export async function buildApp(options = {}) {
  const isWorker = options.isWorker || typeof WebSocketPair !== 'undefined' || process.env.CLOUDFLARE_WORKER === 'true';

  const fastifyOptions = {
    logger: false,
    pluginTimeout: 0
  };

  if (isWorker) {
    const dummyServer = new EventEmitter();
    dummyServer.address = () => ({ port: 80, address: '127.0.0.1' });
    dummyServer.listen = (opts, cb) => { if (typeof opts === 'function') opts(); else if (cb) cb(); };
    dummyServer.close = (cb) => { if (cb) cb(); };
    fastifyOptions.serverFactory = () => dummyServer;
  }

  const app = Fastify(fastifyOptions);

  app.register(cors, {
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
  });

  app.register(sensible);

  // Register domain routes
  app.register(healthRoutes);
  app.register(authRoutes);
  app.register(householdRoutes);
  app.register(expenseRoutes);
  app.register(shoppingRoutes);
  app.register(choreRoutes);
  app.register(billRoutes);
  app.register(pollRoutes);
  app.register(activityRoutes);
  app.register(analyticsRoutes);

  await app.ready();
  return app;
}

export async function startServer() {
  const app = await buildApp();

  // Attach Socket.IO to Fastify's underlying raw HTTP server
  initSocket(app.server);

  // Start background Transactional Outbox Dispatcher
  startOutboxDispatcher();

  try {
    await app.listen({ port: config.port, host: config.host });
    console.log(`[RoomSync API] Server listening at http://${config.host}:${config.port}`);
    console.log(`[RoomSync Realtime] Socket.IO enabled on port ${config.port}`);
    return app;
  } catch (err) {
    console.error('[RoomSync API Error]', err);
    process.exit(1);
  }
}

// Auto-start when executed directly
if (process.argv[1] && process.argv[1].endsWith('server.js')) {
  startServer();
}
