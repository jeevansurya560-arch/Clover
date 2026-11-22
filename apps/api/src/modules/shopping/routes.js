import { repository } from '../../database/repository.js';
import { authenticate, requireHouseholdMembership } from '../../middleware/auth.js';
import { validateShoppingItemInput } from '@roomsync/shared';

export async function shoppingRoutes(fastify) {
  // List shopping items (To Buy vs Purchased)
  fastify.get('/api/shopping', { preHandler: [authenticate, requireHouseholdMembership] }, async (request) => {
    const { status } = request.query;
    const items = await repository.getShoppingItems(request.householdId, status);
    return { items };
  });

  // Add shopping item
  fastify.post('/api/shopping', { preHandler: [authenticate, requireHouseholdMembership] }, async (request, reply) => {
    const data = request.body || {};
    const validation = validateShoppingItemInput(data);
    if (!validation.isValid) {
      return reply.code(400).send({ error: 'Validation failed', details: validation.errors });
    }

    const item = await repository.addShoppingItem({
      householdId: request.householdId,
      itemName: data.item_name,
      quantity: data.quantity || '1',
      category: data.category || 'groceries',
      assignedTo: data.assigned_to || null,
      addedBy: request.user.id
    });
    return reply.code(201).send(item);
  });

  // Mark purchased / toggle status
  fastify.patch('/api/shopping/:id', { preHandler: [authenticate, requireHouseholdMembership] }, async (request, reply) => {
    try {
      const { status } = request.body || {};
      const item = await repository.updateShoppingItem({
        itemId: request.params.id,
        householdId: request.householdId,
        status,
        purchasedBy: request.user.id
      });
      return { success: true, item };
    } catch (err) {
      return reply.code(400).send({ error: err.message });
    }
  });

  // Convert shopping item to household expense
  fastify.post('/api/shopping/:id/convert-to-expense', { preHandler: [authenticate, requireHouseholdMembership] }, async (request, reply) => {
    const { amount_paise, participants } = request.body || {};
    if (!amount_paise || !Number.isInteger(amount_paise) || amount_paise <= 0) {
      return reply.code(400).send({ error: 'Valid amount_paise is required' });
    }

    try {
      const result = await repository.convertShoppingToExpense({
        itemId: request.params.id,
        householdId: request.householdId,
        payerId: request.user.id,
        amountPaise: amount_paise,
        participants: participants || [request.user.id]
      });
      return reply.code(201).send(result);
    } catch (err) {
      return reply.code(400).send({ error: err.message });
    }
  });
}
