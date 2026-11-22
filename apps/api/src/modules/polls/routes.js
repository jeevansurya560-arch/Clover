import { repository } from '../../database/repository.js';
import { authenticate, requireHouseholdMembership } from '../../middleware/auth.js';
import { validatePollInput } from '@roomsync/shared';

export async function pollRoutes(fastify) {
  // List polls
  fastify.get('/api/polls', { preHandler: [authenticate, requireHouseholdMembership] }, async (request) => {
    const polls = await repository.getPolls(request.householdId);
    return { polls };
  });

  // Create poll
  fastify.post('/api/polls', { preHandler: [authenticate, requireHouseholdMembership] }, async (request, reply) => {
    const data = request.body || {};
    const validation = validatePollInput(data);
    if (!validation.isValid) {
      return reply.code(400).send({ error: 'Validation failed', details: validation.errors });
    }

    const poll = await repository.createPoll({
      householdId: request.householdId,
      question: data.question,
      options: data.options,
      createdBy: request.user.id,
      expiresAt: data.expires_at
    });
    return reply.code(201).send(poll);
  });

  // Cast vote
  fastify.post('/api/polls/:id/vote', { preHandler: [authenticate, requireHouseholdMembership] }, async (request, reply) => {
    const { optionId } = request.body || {};
    if (!optionId) return reply.code(400).send({ error: 'optionId is required' });

    try {
      await repository.votePoll({
        pollId: request.params.id,
        optionId,
        userId: request.user.id
      });
      return { success: true };
    } catch (err) {
      return reply.code(400).send({ error: err.message });
    }
  });
}
