import { repository } from '../../database/repository.js';
import { authenticate, requireHouseholdMembership } from '../../middleware/auth.js';
import { validateExpenseInput, validateSettlementInput } from '@roomsync/shared';

export async function expenseRoutes(fastify) {
  // Get all expenses with filters
  fastify.get('/api/expenses', { preHandler: [authenticate, requireHouseholdMembership] }, async (request) => {
    const { category, payerId } = request.query;
    const expenses = await repository.getExpenses(request.householdId, { category, payerId });
    return { expenses };
  });

  // Create an expense
  fastify.post('/api/expenses', { preHandler: [authenticate, requireHouseholdMembership] }, async (request, reply) => {
    const data = request.body || {};
    const validation = validateExpenseInput(data);
    if (!validation.isValid) {
      return reply.code(400).send({ error: 'Validation failed', details: validation.errors });
    }

    try {
      const expense = await repository.createExpense({
        householdId: request.householdId,
        payerId: data.payer_id,
        amountPaise: data.amount_paise,
        description: data.description,
        category: data.category || 'groceries',
        splitType: data.split_type || 'equal',
        participants: data.participants,
        customAmounts: data.custom_amounts || {},
        percentages: data.percentages || {},
        weights: data.weights || {},
        idempotencyKey: request.headers['idempotency-key'] || data.idempotency_key
      });

      return reply.code(201).send(expense);
    } catch (err) {
      return reply.code(400).send({ error: err.message });
    }
  });

  // Void/correct an expense
  fastify.post('/api/expenses/:id/void', { preHandler: [authenticate, requireHouseholdMembership] }, async (request, reply) => {
    try {
      const expense = await repository.voidExpense({
        expenseId: request.params.id,
        householdId: request.householdId,
        userId: request.user.id
      });
      return { success: true, expense };
    } catch (err) {
      return reply.code(404).send({ error: err.message });
    }
  });

  // Authoritative Balances & Settlement Suggestions
  fastify.get('/api/balances', { preHandler: [authenticate, requireHouseholdMembership] }, async (request) => {
    const data = await repository.getBalances(request.householdId);
    return data;
  });

  // Record a settlement repayment
  fastify.post('/api/settlements', { preHandler: [authenticate, requireHouseholdMembership] }, async (request, reply) => {
    const data = request.body || {};
    const validation = validateSettlementInput(data);
    if (!validation.isValid) {
      return reply.code(400).send({ error: 'Validation failed', details: validation.errors });
    }

    try {
      const settlement = await repository.recordSettlement({
        householdId: request.householdId,
        senderId: data.sender_id,
        recipientId: data.recipient_id,
        amountPaise: data.amount_paise,
        notes: data.notes || '',
        recordedBy: request.user.id,
        idempotencyKey: request.headers['idempotency-key'] || data.idempotency_key
      });
      return reply.code(201).send(settlement);
    } catch (err) {
      return reply.code(400).send({ error: err.message });
    }
  });

  // List settlements history
  fastify.get('/api/settlements', { preHandler: [authenticate, requireHouseholdMembership] }, async (request) => {
    const settlements = await repository.getSettlements(request.householdId);
    return { settlements };
  });
}
