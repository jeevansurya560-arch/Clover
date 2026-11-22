import { repository } from '../../database/repository.js';
import { authenticate, requireHouseholdMembership } from '../../middleware/auth.js';

export async function activityRoutes(fastify) {
  fastify.get('/api/activity', { preHandler: [authenticate, requireHouseholdMembership] }, async (request) => {
    const limit = parseInt(request.query.limit || '20', 10);
    const activity = await repository.getActivity(request.householdId, limit);
    return { activity };
  });
}
