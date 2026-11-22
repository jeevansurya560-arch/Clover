import { repository } from '../../database/repository.js';
import { authenticate, requireHouseholdMembership } from '../../middleware/auth.js';
import { validateBillInput } from '@roomsync/shared';

export async function billRoutes(fastify) {
  // List upcoming & paid bills
  fastify.get('/api/bills', { preHandler: [authenticate, requireHouseholdMembership] }, async (request) => {
    const bills = await repository.getBills(request.householdId);
    return { bills };
  });

  // Create bill
  fastify.post('/api/bills', { preHandler: [authenticate, requireHouseholdMembership] }, async (request, reply) => {
    const data = request.body || {};
    const validation = validateBillInput(data);
    if (!validation.isValid) {
      return reply.code(400).send({ error: 'Validation failed', details: validation.errors });
    }

    const bill = await repository.createBill({
      householdId: request.householdId,
      title: data.title,
      amountPaise: data.amount_paise,
      dueDate: data.due_date,
      responsibleMemberId: data.responsible_member_id || request.user.id,
      isRecurring: !!data.is_recurring,
      recurrenceInterval: data.recurrence_interval || 'monthly'
    });
    return reply.code(201).send(bill);
  });

  // Mark bill paid -> creates linked household expense atomically
  fastify.post('/api/bills/:id/pay', { preHandler: [authenticate, requireHouseholdMembership] }, async (request, reply) => {
    const { participants } = request.body || {};
    const members = await repository.getHouseholdMembers(request.householdId);
    const participantIds = participants || members.map(m => m.user_id);

    try {
      const result = await repository.payBill({
        billId: request.params.id,
        householdId: request.householdId,
        payerId: request.user.id,
        participants: participantIds
      });
      return reply.code(200).send(result);
    } catch (err) {
      return reply.code(400).send({ error: err.message });
    }
  });
}
