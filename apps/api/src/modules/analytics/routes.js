import { repository } from '../../database/repository.js';
import { authenticate, requireHouseholdMembership } from '../../middleware/auth.js';

export async function analyticsRoutes(fastify) {
  fastify.get('/api/analytics', { preHandler: [authenticate, requireHouseholdMembership] }, async (request) => {
    const analytics = await repository.getAnalytics(request.householdId);
    return analytics;
  });
}
