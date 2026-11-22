import Fastify from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import { config } from './config.js';
import { initSocket } from './realtime/socket.js';
import { checkDatabaseHealth, closeDatabase } from './database/db.js';

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

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: config.nodeEnv === 'test' ? 'silent' : 'info'
    }
  });

  await app.register(cors, {
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
  });

  await app.register(sensible);

  // Register domain routes
  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(householdRoutes);
  await app.register(expenseRoutes);
  await app.register(shoppingRoutes);
  await app.register(choreRoutes);
  await app.register(billRoutes);
  await app.register(pollRoutes);
  await app.register(activityRoutes);
  await app.register(analyticsRoutes);

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
    app.log.error(err);
    process.exit(1);
  }
}

// Auto-start when executed directly
if (process.argv[1] && process.argv[1].endsWith('server.js')) {
  startServer();
}
