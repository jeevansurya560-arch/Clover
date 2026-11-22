import { repository } from '../../database/repository.js';
import { authenticate, requireHouseholdMembership } from '../../middleware/auth.js';
import { validateChoreInput } from '@roomsync/shared';

export async function choreRoutes(fastify) {
  // List chores
  fastify.get('/api/chores', { preHandler: [authenticate, requireHouseholdMembership] }, async (request) => {
    const chores = await repository.getChores(request.householdId);
    return { chores };
  });

  // Create chore
  fastify.post('/api/chores', { preHandler: [authenticate, requireHouseholdMembership] }, async (request, reply) => {
    const data = request.body || {};
    const validation = validateChoreInput(data);
    if (!validation.isValid) {
      return reply.code(400).send({ error: 'Validation failed', details: validation.errors });
    }

    const chore = await repository.createChore({
      householdId: request.householdId,
      title: data.title,
      description: data.description || '',
      assignedTo: data.assigned_to || null,
      dueDate: data.due_date,
      recurrence: data.recurrence || 'daily'
    });
    return reply.code(201).send(chore);
  });

  // Complete chore (triggers rotation and next due date if recurring)
  fastify.post('/api/chores/:id/complete', { preHandler: [authenticate, requireHouseholdMembership] }, async (request, reply) => {
    try {
      const chore = await repository.completeChore({
        choreId: request.params.id,
        householdId: request.householdId,
        completedBy: request.user.id
      });
      return { success: true, chore };
    } catch (err) {
      return reply.code(400).send({ error: err.message });
    }
  });
}
