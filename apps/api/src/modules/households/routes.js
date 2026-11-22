import { repository } from '../../database/repository.js';
import { authenticate, requireHouseholdMembership } from '../../middleware/auth.js';

export async function householdRoutes(fastify) {
  // List current user's households
  fastify.get('/api/households', { preHandler: [authenticate] }, async (request) => {
    const memberships = await repository.getUserMemberships(request.user.id);
    return { households: memberships };
  });

  // Get current household details & members
  fastify.get('/api/households/current', { preHandler: [authenticate, requireHouseholdMembership] }, async (request) => {
    const household = await repository.getHousehold(request.householdId);
    const members = await repository.getHouseholdMembers(request.householdId);
    return { household, members, myMembership: request.membership };
  });

  // Create new household
  fastify.post('/api/households', { preHandler: [authenticate] }, async (request, reply) => {
    const { name, currency } = request.body || {};
    if (!name || typeof name !== 'string') {
      return reply.code(400).send({ error: 'Household name is required' });
    }
    const household = await repository.createHousehold({
      name,
      currency: currency || 'INR',
      userId: request.user.id
    });
    return reply.code(201).send(household);
  });

  // Join existing household via join code
  fastify.post('/api/households/join', { preHandler: [authenticate] }, async (request, reply) => {
    const { joinCode } = request.body || {};
    if (!joinCode) return reply.code(400).send({ error: 'Join code is required' });

    try {
      const household = await repository.joinHousehold({ joinCode, userId: request.user.id });
      return { success: true, household };
    } catch (err) {
      return reply.code(400).send({ error: err.message });
    }
  });
}
