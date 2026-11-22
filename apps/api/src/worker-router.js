import jwt from 'jsonwebtoken';
import { repository } from './database/repository.js';
import { config } from './config.js';
import {
  validateExpenseInput,
  validateSettlementInput,
  validateShoppingItemInput,
  validateChoreInput,
  validateBillInput,
  validatePollInput
} from '@roomsync/shared';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-user-id, x-household-id, idempotency-key',
  'Access-Control-Allow-Credentials': 'true'
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders
    }
  });
}

function errorResponse(message, status = 400, details = null) {
  const body = { error: message };
  if (details) body.details = details;
  return jsonResponse(body, status);
}

async function authenticateRequest(request, env) {
  const authHeader = request.headers.get('authorization');
  let userId = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const secret = env.JWT_SECRET || process.env.JWT_SECRET || config.jwtSecret;
      const decoded = jwt.verify(token, secret);
      userId = decoded.sub || decoded.userId;
    } catch {
      const profile = await repository.getProfile(token);
      if (profile) userId = profile.id;
    }
  }

  if (!userId && request.headers.get('x-user-id')) {
    userId = request.headers.get('x-user-id');
  }

  // Fallback to demo profile (Alex / You)
  if (!userId) {
    userId = '00000000-0000-0000-0000-000000000003';
  }

  const user = await repository.getProfile(userId);
  return user;
}

async function resolveHousehold(request, user, queryHouseholdId, bodyHouseholdId) {
  let householdId = request.headers.get('x-household-id') || queryHouseholdId || bodyHouseholdId;
  const memberships = await repository.getUserMemberships(user.id);

  if (!householdId && memberships.length > 0) {
    householdId = memberships[0].household_id;
  }

  const membership = memberships.find(m => m.household_id === householdId);
  return { householdId, membership };
}

export async function handleWorkerApi(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // 1. CORS Preflight
  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // 2. Health Endpoint
  if (path === '/api/health') {
    return jsonResponse({
      status: 'healthy',
      database: 'supabase_postgresql',
      timestamp: new Date().toISOString()
    });
  }

  // 3. Profiles Endpoint (Public for switching)
  if (method === 'GET' && path === '/api/auth/profiles') {
    const profiles = await repository.getAllProfiles();
    return jsonResponse({ profiles });
  }

  // Parse Body for mutating methods
  let body = {};
  if (method !== 'GET' && method !== 'HEAD') {
    try {
      const text = await request.text();
      if (text) body = JSON.parse(text);
    } catch {
      return errorResponse('Invalid JSON payload');
    }
  }

  // 4. Demo Switch Endpoint
  if (method === 'POST' && path === '/api/auth/demo-switch') {
    const { userId } = body;
    const user = await repository.getProfile(userId);
    if (!user) return errorResponse('User not found', 404);

    const secret = env.JWT_SECRET || process.env.JWT_SECRET || config.jwtSecret;
    const token = jwt.sign({ sub: user.id, email: user.email }, secret, { expiresIn: '7d' });
    const memberships = await repository.getUserMemberships(user.id);
    return jsonResponse({ token, user, memberships });
  }

  // 5. Authenticate user for protected routes
  const user = await authenticateRequest(request, env);
  if (!user) {
    return errorResponse('Unauthorized: User not found', 401);
  }

  // 6. Current User Me
  if (method === 'GET' && path === '/api/auth/me') {
    const memberships = await repository.getUserMemberships(user.id);
    return jsonResponse({ user, memberships });
  }

  // 7. Households listing and creation
  if (path === '/api/households') {
    if (method === 'GET') {
      const memberships = await repository.getUserMemberships(user.id);
      return jsonResponse({ households: memberships });
    }
    if (method === 'POST') {
      const { name, currency } = body;
      if (!name || typeof name !== 'string') return errorResponse('Household name is required');
      const household = await repository.createHousehold({
        name,
        currency: currency || 'INR',
        userId: user.id
      });
      return jsonResponse(household, 201);
    }
  }

  // 8. Join household
  if (method === 'POST' && path === '/api/households/join') {
    const { joinCode } = body;
    if (!joinCode) return errorResponse('Join code is required');
    try {
      const household = await repository.joinHousehold({ joinCode, userId: user.id });
      return jsonResponse({ success: true, household });
    } catch (err) {
      return errorResponse(err.message);
    }
  }

  // 9. Household-scoped operations
  const { householdId, membership } = await resolveHousehold(
    request,
    user,
    url.searchParams.get('householdId'),
    body.householdId
  );

  if (!householdId) {
    return errorResponse('No active household found for user', 400);
  }

  // Current Household Details
  if (method === 'GET' && path === '/api/households/current') {
    const household = await repository.getHousehold(householdId);
    const members = await repository.getHouseholdMembers(householdId);
    return jsonResponse({ household, members, myMembership: membership });
  }

  // Expenses Vertical
  if (path === '/api/expenses') {
    if (method === 'GET') {
      const category = url.searchParams.get('category');
      const payerId = url.searchParams.get('payerId');
      const expenses = await repository.getExpenses(householdId, { category, payerId });
      return jsonResponse({ expenses });
    }
    if (method === 'POST') {
      const validation = validateExpenseInput(body);
      if (!validation.isValid) {
        return errorResponse('Validation failed', 400, validation.errors);
      }
      try {
        const expense = await repository.createExpense({
          householdId,
          payerId: body.payer_id,
          amountPaise: body.amount_paise,
          description: body.description,
          category: body.category || 'groceries',
          splitType: body.split_type || 'equal',
          participants: body.participants,
          customAmounts: body.custom_amounts || {},
          percentages: body.percentages || {},
          weights: body.weights || {},
          idempotencyKey: request.headers.get('idempotency-key') || body.idempotency_key
        });
        return jsonResponse(expense, 201);
      } catch (err) {
        return errorResponse(err.message);
      }
    }
  }

  // Void Expense
  const voidMatch = path.match(/^\/api\/expenses\/([^/]+)\/void$/);
  if (method === 'POST' && voidMatch) {
    try {
      const expense = await repository.voidExpense({
        expenseId: voidMatch[1],
        householdId,
        userId: user.id
      });
      return jsonResponse({ success: true, expense });
    } catch (err) {
      return errorResponse(err.message, 404);
    }
  }

  // Balances
  if (method === 'GET' && path === '/api/balances') {
    const data = await repository.getBalances(householdId);
    return jsonResponse(data);
  }

  // Settlements
  if (path === '/api/settlements') {
    if (method === 'GET') {
      const settlements = await repository.getSettlements(householdId);
      return jsonResponse({ settlements });
    }
    if (method === 'POST') {
      const validation = validateSettlementInput(body);
      if (!validation.isValid) {
        return errorResponse('Validation failed', 400, validation.errors);
      }
      try {
        const settlement = await repository.recordSettlement({
          householdId,
          senderId: body.sender_id,
          recipientId: body.recipient_id,
          amountPaise: body.amount_paise,
          notes: body.notes || '',
          recordedBy: user.id,
          idempotencyKey: request.headers.get('idempotency-key') || body.idempotency_key
        });
        return jsonResponse(settlement, 201);
      } catch (err) {
        return errorResponse(err.message);
      }
    }
  }

  // Shopping Vertical
  if (path === '/api/shopping') {
    if (method === 'GET') {
      const status = url.searchParams.get('status');
      const items = await repository.getShoppingItems(householdId, status);
      return jsonResponse({ items });
    }
    if (method === 'POST') {
      const validation = validateShoppingItemInput(body);
      if (!validation.isValid) {
        return errorResponse('Validation failed', 400, validation.errors);
      }
      const item = await repository.addShoppingItem({
        householdId,
        itemName: body.item_name,
        quantity: body.quantity || '1',
        category: body.category || 'groceries',
        assignedTo: body.assigned_to || null,
        addedBy: user.id
      });
      return jsonResponse(item, 201);
    }
  }

  const shoppingItemMatch = path.match(/^\/api\/shopping\/([^/]+)$/);
  if (method === 'PATCH' && shoppingItemMatch) {
    try {
      const item = await repository.updateShoppingItem({
        itemId: shoppingItemMatch[1],
        householdId,
        status: body.status,
        purchasedBy: user.id
      });
      return jsonResponse({ success: true, item });
    } catch (err) {
      return errorResponse(err.message);
    }
  }

  const shoppingConvertMatch = path.match(/^\/api\/shopping\/([^/]+)\/convert-to-expense$/);
  if (method === 'POST' && shoppingConvertMatch) {
    const { amount_paise, participants } = body;
    if (!amount_paise || !Number.isInteger(amount_paise) || amount_paise <= 0) {
      return errorResponse('Valid amount_paise is required');
    }
    try {
      const result = await repository.convertShoppingToExpense({
        itemId: shoppingConvertMatch[1],
        householdId,
        payerId: user.id,
        amountPaise: amount_paise,
        participants
      });
      return jsonResponse(result);
    } catch (err) {
      return errorResponse(err.message);
    }
  }

  // Chores Vertical
  if (path === '/api/chores') {
    if (method === 'GET') {
      const chores = await repository.getChores(householdId);
      return jsonResponse({ chores });
    }
    if (method === 'POST') {
      const validation = validateChoreInput(body);
      if (!validation.isValid) {
        return errorResponse('Validation failed', 400, validation.errors);
      }
      const chore = await repository.createChore({
        householdId,
        title: body.title,
        description: body.description || '',
        assignedTo: body.assigned_to || null,
        dueDate: body.due_date,
        recurrence: body.recurrence || 'daily'
      });
      return jsonResponse(chore, 201);
    }
  }

  const choreCompleteMatch = path.match(/^\/api\/chores\/([^/]+)\/complete$/);
  if (method === 'POST' && choreCompleteMatch) {
    try {
      const chore = await repository.completeChore({
        choreId: choreCompleteMatch[1],
        householdId,
        completedBy: user.id
      });
      return jsonResponse({ success: true, chore });
    } catch (err) {
      return errorResponse(err.message);
    }
  }

  // Bills Vertical
  if (path === '/api/bills') {
    if (method === 'GET') {
      const bills = await repository.getBills(householdId);
      return jsonResponse({ bills });
    }
    if (method === 'POST') {
      const validation = validateBillInput(body);
      if (!validation.isValid) {
        return errorResponse('Validation failed', 400, validation.errors);
      }
      const bill = await repository.createBill({
        householdId,
        title: body.title,
        amountPaise: body.amount_paise,
        dueDate: body.due_date,
        responsibleMemberId: body.responsible_member_id || user.id,
        isRecurring: !!body.is_recurring,
        recurrenceInterval: body.recurrence_interval || 'monthly'
      });
      return jsonResponse(bill, 201);
    }
  }

  const billPayMatch = path.match(/^\/api\/bills\/([^/]+)\/pay$/);
  if (method === 'POST' && billPayMatch) {
    const { participants } = body;
    const members = await repository.getHouseholdMembers(householdId);
    const participantIds = participants || members.map(m => m.user_id);
    try {
      const result = await repository.payBill({
        billId: billPayMatch[1],
        householdId,
        payerId: user.id,
        participants: participantIds
      });
      return jsonResponse(result);
    } catch (err) {
      return errorResponse(err.message);
    }
  }

  // Polls Vertical
  if (path === '/api/polls') {
    if (method === 'GET') {
      const polls = await repository.getPolls(householdId);
      return jsonResponse({ polls });
    }
    if (method === 'POST') {
      const validation = validatePollInput(body);
      if (!validation.isValid) {
        return errorResponse('Validation failed', 400, validation.errors);
      }
      const poll = await repository.createPoll({
        householdId,
        question: body.question,
        options: body.options,
        createdBy: user.id,
        expiresAt: body.expires_at
      });
      return jsonResponse(poll, 201);
    }
  }

  const pollVoteMatch = path.match(/^\/api\/polls\/([^/]+)\/vote$/);
  if (method === 'POST' && pollVoteMatch) {
    const { optionId } = body;
    if (!optionId) return errorResponse('optionId is required');
    try {
      await repository.votePoll({
        pollId: pollVoteMatch[1],
        optionId,
        userId: user.id
      });
      return jsonResponse({ success: true });
    } catch (err) {
      return errorResponse(err.message);
    }
  }

  // Activity Feed
  if (method === 'GET' && path === '/api/activity') {
    const limit = parseInt(url.searchParams.get('limit') || '20', 10);
    const activity = await repository.getActivity(householdId, limit);
    return jsonResponse({ activity });
  }

  // Analytics
  if (method === 'GET' && path === '/api/analytics') {
    const analytics = await repository.getAnalytics(householdId);
    return jsonResponse(analytics);
  }

  return errorResponse(`Endpoint not found: ${method} ${path}`, 404);
}
