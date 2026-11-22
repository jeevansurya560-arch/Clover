import crypto from 'node:crypto';
import { pool, isUsingPostgres } from './db.js';
import {
  calculateSplit,
  calculateBalances,
  calculateSettlementSuggestions,
  SPLIT_TYPES,
  EVENT_TYPES
} from '@roomsync/shared';

// In-Memory Seed State for Instant Zero-Config Execution & Offline Fallback
const memoryStore = {
  profiles: [
    { id: '00000000-0000-0000-0000-000000000001', email: 'aman@roomsync.app', full_name: 'Aman', avatar_url: 'avatar-aman' },
    { id: '00000000-0000-0000-0000-000000000002', email: 'riya@roomsync.app', full_name: 'Riya', avatar_url: 'avatar-riya' },
    { id: '00000000-0000-0000-0000-000000000003', email: 'you@roomsync.app', full_name: 'You (Alex)', avatar_url: 'avatar-you' }
  ],
  households: [
    { id: '11111111-1111-1111-1111-111111111111', name: 'DreamHouse', currency: 'INR', join_code: 'DREAM2026', created_by: '00000000-0000-0000-0000-000000000003' }
  ],
  memberships: [
    { id: '22222222-2222-2222-2222-222222222201', household_id: '11111111-1111-1111-1111-111111111111', user_id: '00000000-0000-0000-0000-000000000001', role: 'member', status: 'active' },
    { id: '22222222-2222-2222-2222-222222222202', household_id: '11111111-1111-1111-1111-111111111111', user_id: '00000000-0000-0000-0000-000000000002', role: 'member', status: 'active' },
    { id: '22222222-2222-2222-2222-222222222203', household_id: '11111111-1111-1111-1111-111111111111', user_id: '00000000-0000-0000-0000-000000000003', role: 'admin', status: 'active' }
  ],
  expenses: [
    { id: '33333333-3333-3333-3333-333333333301', household_id: '11111111-1111-1111-1111-111111111111', payer_id: '00000000-0000-0000-0000-000000000001', amount_paise: 120000, description: 'Pizza Night', category: 'food', split_type: 'equal', expense_date: new Date(Date.now() - 2 * 86400000).toISOString(), version: 1, is_void: false },
    { id: '33333333-3333-3333-3333-333333333302', household_id: '11111111-1111-1111-1111-111111111111', payer_id: '00000000-0000-0000-0000-000000000002', amount_paise: 85000, description: 'Groceries', category: 'groceries', split_type: 'equal', expense_date: new Date(Date.now() - 4 * 86400000).toISOString(), version: 1, is_void: false },
    { id: '33333333-3333-3333-3333-333333333303', household_id: '11111111-1111-1111-1111-111111111111', payer_id: '00000000-0000-0000-0000-000000000003', amount_paise: 120000, description: 'Electricity Bill', category: 'utilities', split_type: 'equal', expense_date: new Date(Date.now() - 7 * 86400000).toISOString(), version: 1, is_void: false }
  ],
  expense_shares: [
    { id: '44444444-4444-4444-4444-444444444401', expense_id: '33333333-3333-3333-3333-333333333301', user_id: '00000000-0000-0000-0000-000000000001', share_paise: 40000 },
    { id: '44444444-4444-4444-4444-444444444402', expense_id: '33333333-3333-3333-3333-333333333301', user_id: '00000000-0000-0000-0000-000000000002', share_paise: 40000 },
    { id: '44444444-4444-4444-4444-444444444403', expense_id: '33333333-3333-3333-3333-333333333301', user_id: '00000000-0000-0000-0000-000000000003', share_paise: 40000 },
    { id: '44444444-4444-4444-4444-444444444404', expense_id: '33333333-3333-3333-3333-333333333302', user_id: '00000000-0000-0000-0000-000000000001', share_paise: 28334 },
    { id: '44444444-4444-4444-4444-444444444405', expense_id: '33333333-3333-3333-3333-333333333302', user_id: '00000000-0000-0000-0000-000000000002', share_paise: 28333 },
    { id: '44444444-4444-4444-4444-444444444406', expense_id: '33333333-3333-3333-3333-333333333302', user_id: '00000000-0000-0000-0000-000000000003', share_paise: 28333 },
    { id: '44444444-4444-4444-4444-444444444407', expense_id: '33333333-3333-3333-3333-333333333303', user_id: '00000000-0000-0000-0000-000000000001', share_paise: 40000 },
    { id: '44444444-4444-4444-4444-444444444408', expense_id: '33333333-3333-3333-3333-333333333303', user_id: '00000000-0000-0000-0000-000000000002', share_paise: 40000 },
    { id: '44444444-4444-4444-4444-444444444409', expense_id: '33333333-3333-3333-3333-333333333303', user_id: '00000000-0000-0000-0000-000000000003', share_paise: 40000 }
  ],
  settlements: [],
  shopping_items: [
    { id: '55555555-5555-5555-5555-555555555501', household_id: '11111111-1111-1111-1111-111111111111', item_name: 'Milk', quantity: '2 packs', category: 'groceries', assigned_to: '00000000-0000-0000-0000-000000000001', added_by: '00000000-0000-0000-0000-000000000002', status: 'pending', created_at: new Date(Date.now() - 3600000).toISOString() },
    { id: '55555555-5555-5555-5555-555555555502', household_id: '11111111-1111-1111-1111-111111111111', item_name: 'Bread', quantity: '1 loaf', category: 'groceries', assigned_to: '00000000-0000-0000-0000-000000000002', added_by: '00000000-0000-0000-0000-000000000003', status: 'pending', created_at: new Date(Date.now() - 7200000).toISOString() },
    { id: '55555555-5555-5555-5555-555555555503', household_id: '11111111-1111-1111-1111-111111111111', item_name: 'Eggs', quantity: '12 pcs', category: 'groceries', assigned_to: '00000000-0000-0000-0000-000000000003', added_by: '00000000-0000-0000-0000-000000000001', status: 'pending', created_at: new Date(Date.now() - 10800000).toISOString() },
    { id: '55555555-5555-5555-5555-555555555504', household_id: '11111111-1111-1111-1111-111111111111', item_name: 'Vegetables', quantity: '1 kg', category: 'groceries', assigned_to: '00000000-0000-0000-0000-000000000001', added_by: '00000000-0000-0000-0000-000000000002', status: 'pending', created_at: new Date(Date.now() - 14400000).toISOString() }
  ],
  chores: [
    { id: '66666666-6666-6666-6666-666666666601', household_id: '11111111-1111-1111-1111-111111111111', title: 'Clean Kitchen', description: 'Counters, dishes, and floor mop', assigned_to: '00000000-0000-0000-0000-000000000002', due_date: new Date(Date.now() + 4 * 3600000).toISOString(), recurrence: 'daily', status: 'pending' },
    { id: '66666666-6666-6666-6666-666666666602', household_id: '11111111-1111-1111-1111-111111111111', title: 'Take Out Garbage', description: 'Sort recyclables and trash bags', assigned_to: '00000000-0000-0000-0000-000000000001', due_date: new Date(Date.now() + 5 * 3600000).toISOString(), recurrence: 'daily', status: 'pending' }
  ],
  chore_rotations: [
    {
      id: '66666666-6666-6666-6666-666666666699',
      household_id: '11111111-1111-1111-1111-111111111111',
      chore_id: '66666666-6666-6666-6666-666666666601',
      rotation_order: [
        '00000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000002',
        '00000000-0000-0000-0000-000000000003'
      ],
      current_index: 1
    }
  ],
  bills: [
    { id: '77777777-7777-7777-7777-777777777701', household_id: '11111111-1111-1111-1111-111111111111', title: 'Internet', amount_paise: 89900, due_date: new Date(Date.now() + 3 * 86400000).toISOString(), responsible_member_id: '00000000-0000-0000-0000-000000000001', status: 'upcoming', is_recurring: true, recurrence_interval: 'monthly' },
    { id: '77777777-7777-7777-7777-777777777702', household_id: '11111111-1111-1111-1111-111111111111', title: 'Electricity', amount_paise: 120000, due_date: new Date(Date.now() + 6 * 86400000).toISOString(), responsible_member_id: '00000000-0000-0000-0000-000000000003', status: 'upcoming', is_recurring: true, recurrence_interval: 'monthly' },
    { id: '77777777-7777-7777-7777-777777777703', household_id: '11111111-1111-1111-1111-111111111111', title: 'Rent', amount_paise: 800000, due_date: new Date(Date.now() + 9 * 86400000).toISOString(), responsible_member_id: '00000000-0000-0000-0000-000000000002', status: 'upcoming', is_recurring: true, recurrence_interval: 'monthly' }
  ],
  polls: [
    { id: '88888888-8888-8888-8888-888888888801', household_id: '11111111-1111-1111-1111-111111111111', question: 'What should we buy next?', created_by: '00000000-0000-0000-0000-000000000003', expires_at: new Date(Date.now() + 2 * 86400000).toISOString(), status: 'active' }
  ],
  poll_options: [
    { id: '88888888-8888-8888-8888-888888888811', poll_id: '88888888-8888-8888-8888-888888888801', text: 'New Sofa', votes_count: 2 },
    { id: '88888888-8888-8888-8888-888888888812', poll_id: '88888888-8888-8888-8888-888888888801', text: 'Gaming Chair', votes_count: 1 }
  ],
  poll_votes: [
    { id: '88888888-8888-8888-8888-888888888821', poll_id: '88888888-8888-8888-8888-888888888801', option_id: '88888888-8888-8888-8888-888888888811', user_id: '00000000-0000-0000-0000-000000000001' },
    { id: '88888888-8888-8888-8888-888888888822', poll_id: '88888888-8888-8888-8888-888888888801', option_id: '88888888-8888-8888-8888-888888888811', user_id: '00000000-0000-0000-0000-000000000002' },
    { id: '88888888-8888-8888-8888-888888888823', poll_id: '88888888-8888-8888-8888-888888888801', option_id: '88888888-8888-8888-8888-888888888812', user_id: '00000000-0000-0000-0000-000000000003' }
  ],
  household_events: [
    { id: '99999999-9999-9999-9999-999999999901', household_id: '11111111-1111-1111-1111-111111111111', actor_id: '00000000-0000-0000-0000-000000000002', event_type: EVENT_TYPES.EXPENSE_CREATED, description: 'Riya added ₹1,200 expense', entity_type: 'expense', entity_id: '33333333-3333-3333-3333-333333333301', created_at: new Date(Date.now() - 120000).toISOString() },
    { id: '99999999-9999-9999-9999-999999999902', household_id: '11111111-1111-1111-1111-111111111111', actor_id: '00000000-0000-0000-0000-000000000003', event_type: EVENT_TYPES.CHORE_COMPLETED, description: 'You completed Clean Kitchen', entity_type: 'chore', entity_id: '66666666-6666-6666-6666-666666666601', created_at: new Date(Date.now() - 300000).toISOString() },
    { id: '99999999-9999-9999-9999-999999999903', household_id: '11111111-1111-1111-1111-111111111111', actor_id: '00000000-0000-0000-0000-000000000001', event_type: EVENT_TYPES.CHORE_COMPLETED, description: 'Aman completed Take Out Garbage', entity_type: 'chore', entity_id: '66666666-6666-6666-6666-666666666602', created_at: new Date(Date.now() - 600000).toISOString() }
  ],
  outbox_events: [],
  monthly_budgets: [
    { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', household_id: '11111111-1111-1111-1111-111111111111', month: '2026-04', budget_paise: 3000000 }
  ]
};

export const repository = {
  // Profiles & Auth
  async getProfile(userId) {
    return memoryStore.profiles.find(p => p.id === userId) || null;
  },

  async createProfile(profile) {
    const existing = memoryStore.profiles.find(p => p.id === profile.id);
    if (existing) return existing;
    memoryStore.profiles.push(profile);
    return profile;
  },

  async getAllProfiles() {
    return [...memoryStore.profiles];
  },

  async getProfileByEmail(email) {
    return memoryStore.profiles.find(p => p.email.toLowerCase() === email.toLowerCase()) || null;
  },

  // Households & Memberships
  async getHousehold(householdId) {
    return memoryStore.households.find(h => h.id === householdId) || null;
  },

  async getHouseholdMembers(householdId) {
    const memberRecords = memoryStore.memberships.filter(m => m.household_id === householdId && m.status === 'active');
    return memberRecords.map(m => {
      const profile = memoryStore.profiles.find(p => p.id === m.user_id) || {};
      return {
        ...m,
        email: profile.email,
        full_name: profile.full_name,
        avatar_url: profile.avatar_url
      };
    });
  },

  async getUserMemberships(userId) {
    const userMems = memoryStore.memberships.filter(m => m.user_id === userId && m.status === 'active');
    return userMems.map(m => {
      const hh = memoryStore.households.find(h => h.id === m.household_id) || {};
      return {
        ...m,
        household_name: hh.name,
        currency: hh.currency,
        join_code: hh.join_code
      };
    });
  },

  async createHousehold({ name, currency = 'INR', userId }) {
    const hhId = crypto.randomUUID();
    const joinCode = 'SYNC-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    const newHousehold = {
      id: hhId,
      name,
      currency,
      join_code: joinCode,
      created_by: userId,
      created_at: new Date().toISOString()
    };
    memoryStore.households.push(newHousehold);

    const memId = crypto.randomUUID();
    const newMembership = {
      id: memId,
      household_id: hhId,
      user_id: userId,
      role: 'admin',
      status: 'active',
      joined_at: new Date().toISOString()
    };
    memoryStore.memberships.push(newMembership);

    return newHousehold;
  },

  async joinHousehold({ joinCode, userId }) {
    const hh = memoryStore.households.find(h => h.join_code.toUpperCase() === joinCode.trim().toUpperCase());
    if (!hh) throw new Error('Invalid household invitation code');

    const existing = memoryStore.memberships.find(m => m.household_id === hh.id && m.user_id === userId);
    if (existing) {
      if (existing.status !== 'active') existing.status = 'active';
      return hh;
    }

    const newMem = {
      id: crypto.randomUUID(),
      household_id: hh.id,
      user_id: userId,
      role: 'member',
      status: 'active',
      joined_at: new Date().toISOString()
    };
    memoryStore.memberships.push(newMem);
    return hh;
  },

  // Expenses & Settlements
  async getExpenses(householdId, { category, payerId, isVoid = false } = {}) {
    let exps = memoryStore.expenses.filter(e => e.household_id === householdId && e.is_void === isVoid);
    if (category) exps = exps.filter(e => e.category === category);
    if (payerId) exps = exps.filter(e => e.payer_id === payerId);
    
    // Enrich with payer profile and shares
    return exps.map(e => {
      const payer = memoryStore.profiles.find(p => p.id === e.payer_id) || {};
      const shares = memoryStore.expense_shares.filter(s => s.expense_id === e.id).map(s => {
        const u = memoryStore.profiles.find(p => p.id === s.user_id) || {};
        return { ...s, user_name: u.full_name, avatar_url: u.avatar_url };
      });
      return {
        ...e,
        payer_name: payer.full_name,
        payer_avatar: payer.avatar_url,
        shares
      };
    }).sort((a, b) => new Date(b.expense_date) - new Date(a.expense_date));
  },

  async createExpense({
    householdId,
    payerId,
    amountPaise,
    description,
    category = 'groceries',
    splitType = SPLIT_TYPES.EQUAL,
    participants = [],
    customAmounts = {},
    percentages = {},
    weights = {},
    idempotencyKey = null
  }) {
    if (idempotencyKey) {
      const existing = memoryStore.expenses.find(e => e.idempotency_key === idempotencyKey);
      if (existing) return existing;
    }

    // 1. Calculate deterministic integer shares
    const calculatedShares = calculateSplit({
      totalPaise: amountPaise,
      splitType,
      participants,
      customAmounts,
      percentages,
      weights
    });

    const expenseId = crypto.randomUUID();
    const newExpense = {
      id: expenseId,
      household_id: householdId,
      payer_id: payerId,
      amount_paise: amountPaise,
      description,
      category,
      split_type: splitType,
      expense_date: new Date().toISOString(),
      idempotency_key: idempotencyKey,
      version: 1,
      is_void: false,
      created_at: new Date().toISOString()
    };
    memoryStore.expenses.push(newExpense);

    for (const s of calculatedShares) {
      memoryStore.expense_shares.push({
        id: crypto.randomUUID(),
        expense_id: expenseId,
        user_id: s.userId,
        share_paise: s.sharePaise
      });
    }

    // 2. Household Activity Event
    const payer = await this.getProfile(payerId);
    const event = {
      id: crypto.randomUUID(),
      household_id: householdId,
      actor_id: payerId,
      event_type: EVENT_TYPES.EXPENSE_CREATED,
      description: `${payer?.full_name || 'Someone'} added ₹${(amountPaise / 100).toLocaleString('en-IN')} expense (${description})`,
      entity_type: 'expense',
      entity_id: expenseId,
      metadata: { amountPaise, description },
      created_at: new Date().toISOString()
    };
    memoryStore.household_events.unshift(event);

    // 3. Outbox Event
    memoryStore.outbox_events.push({
      id: crypto.randomUUID(),
      household_id: householdId,
      event_type: EVENT_TYPES.EXPENSE_CREATED,
      payload: { expense: newExpense, shares: calculatedShares },
      status: 'pending',
      created_at: new Date().toISOString()
    });

    return { ...newExpense, shares: calculatedShares };
  },

  async voidExpense({ expenseId, householdId, userId }) {
    const expense = memoryStore.expenses.find(e => e.id === expenseId && e.household_id === householdId);
    if (!expense) throw new Error('Expense not found');
    expense.is_void = true;
    expense.version += 1;

    // Outbox & Activity
    const user = await this.getProfile(userId);
    const event = {
      id: crypto.randomUUID(),
      household_id: householdId,
      actor_id: userId,
      event_type: EVENT_TYPES.EXPENSE_VOIDED,
      description: `${user?.full_name || 'Someone'} voided expense: ${expense.description}`,
      entity_type: 'expense',
      entity_id: expenseId,
      created_at: new Date().toISOString()
    };
    memoryStore.household_events.unshift(event);
    memoryStore.outbox_events.push({
      id: crypto.randomUUID(),
      household_id: householdId,
      event_type: EVENT_TYPES.EXPENSE_VOIDED,
      payload: { expenseId },
      status: 'pending',
      created_at: new Date().toISOString()
    });
    return expense;
  },

  async getBalances(householdId) {
    const members = await this.getHouseholdMembers(householdId);
    const memberIds = members.map(m => m.user_id);

    const expenses = memoryStore.expenses.filter(e => e.household_id === householdId && !e.is_void);
    const expenseIds = new Set(expenses.map(e => e.id));
    const shares = memoryStore.expense_shares.filter(s => expenseIds.has(s.expense_id));
    const settlements = memoryStore.settlements.filter(s => s.household_id === householdId);

    const rawBalances = calculateBalances({
      memberIds,
      expenses,
      expenseShares: shares,
      settlements
    });

    const suggestions = calculateSettlementSuggestions(rawBalances);

    // Enrich balances with profile details
    const enrichedBalances = {};
    for (const [uid, b] of Object.entries(rawBalances)) {
      const profile = members.find(m => m.user_id === uid) || {};
      enrichedBalances[uid] = {
        ...b,
        user_name: profile.full_name || 'Member',
        avatar_url: profile.avatar_url
      };
    }

    const enrichedSuggestions = suggestions.map(s => {
      const from = members.find(m => m.user_id === s.fromUserId) || {};
      const to = members.find(m => m.user_id === s.toUserId) || {};
      return {
        ...s,
        from_name: from.full_name || 'Roommate',
        to_name: to.full_name || 'Roommate'
      };
    });

    return {
      balances: enrichedBalances,
      suggestions: enrichedSuggestions
    };
  },

  async recordSettlement({
    householdId,
    senderId,
    recipientId,
    amountPaise,
    notes = '',
    recordedBy,
    idempotencyKey = null
  }) {
    if (idempotencyKey) {
      const existing = memoryStore.settlements.find(s => s.idempotency_key === idempotencyKey);
      if (existing) return existing;
    }

    const settlementId = crypto.randomUUID();
    const newSettlement = {
      id: settlementId,
      household_id: householdId,
      sender_id: senderId,
      recipient_id: recipientId,
      amount_paise: amountPaise,
      notes,
      recorded_by: recordedBy,
      idempotency_key: idempotencyKey,
      settlement_date: new Date().toISOString(),
      created_at: new Date().toISOString()
    };
    memoryStore.settlements.push(newSettlement);

    // Activity & Outbox
    const sender = await this.getProfile(senderId);
    const recipient = await this.getProfile(recipientId);
    const recorder = await this.getProfile(recordedBy);

    const event = {
      id: crypto.randomUUID(),
      household_id: householdId,
      actor_id: recordedBy,
      event_type: EVENT_TYPES.SETTLEMENT_RECORDED,
      description: `${recorder?.full_name || 'Someone'} recorded settlement: ${sender?.full_name || 'Sender'} paid ₹${(amountPaise / 100).toLocaleString('en-IN')} to ${recipient?.full_name || 'Recipient'}`,
      entity_type: 'settlement',
      entity_id: settlementId,
      metadata: { amountPaise, senderId, recipientId },
      created_at: new Date().toISOString()
    };
    memoryStore.household_events.unshift(event);
    memoryStore.outbox_events.push({
      id: crypto.randomUUID(),
      household_id: householdId,
      event_type: EVENT_TYPES.SETTLEMENT_RECORDED,
      payload: newSettlement,
      status: 'pending',
      created_at: new Date().toISOString()
    });

    return newSettlement;
  },

  async getSettlements(householdId) {
    const list = memoryStore.settlements.filter(s => s.household_id === householdId);
    return list.map(s => {
      const sender = memoryStore.profiles.find(p => p.id === s.sender_id) || {};
      const recipient = memoryStore.profiles.find(p => p.id === s.recipient_id) || {};
      const recorder = memoryStore.profiles.find(p => p.id === s.recorded_by) || {};
      return {
        ...s,
        sender_name: sender.full_name,
        sender_avatar: sender.avatar_url,
        recipient_name: recipient.full_name,
        recipient_avatar: recipient.avatar_url,
        recorded_by_name: recorder.full_name
      };
    }).sort((a, b) => new Date(b.settlement_date) - new Date(a.settlement_date));
  },

  // Shopping Items
  async getShoppingItems(householdId, status) {
    let items = memoryStore.shopping_items.filter(i => i.household_id === householdId);
    if (status) items = items.filter(i => i.status === status);
    return items.map(i => {
      const assigned = memoryStore.profiles.find(p => p.id === i.assigned_to) || {};
      const added = memoryStore.profiles.find(p => p.id === i.added_by) || {};
      return {
        ...i,
        assigned_name: assigned.full_name || 'Unassigned',
        added_by_name: added.full_name || 'Roommate'
      };
    }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  },

  async addShoppingItem({ householdId, itemName, quantity = '1', category = 'groceries', assignedTo = null, addedBy }) {
    const id = crypto.randomUUID();
    const newItem = {
      id,
      household_id: householdId,
      item_name: itemName,
      quantity,
      category,
      assigned_to: assignedTo,
      added_by: addedBy,
      status: 'pending',
      created_at: new Date().toISOString()
    };
    memoryStore.shopping_items.push(newItem);

    const user = await this.getProfile(addedBy);
    memoryStore.household_events.unshift({
      id: crypto.randomUUID(),
      household_id: householdId,
      actor_id: addedBy,
      event_type: EVENT_TYPES.SHOPPING_ITEM_ADDED,
      description: `${user?.full_name || 'Someone'} added shopping item (${itemName})`,
      entity_type: 'shopping_item',
      entity_id: id,
      created_at: new Date().toISOString()
    });
    memoryStore.outbox_events.push({
      id: crypto.randomUUID(),
      household_id: householdId,
      event_type: EVENT_TYPES.SHOPPING_ITEM_ADDED,
      payload: newItem,
      status: 'pending',
      created_at: new Date().toISOString()
    });
    return newItem;
  },

  async updateShoppingItem({ itemId, householdId, status, purchasedBy }) {
    const item = memoryStore.shopping_items.find(i => i.id === itemId && i.household_id === householdId);
    if (!item) throw new Error('Shopping item not found');
    if (status) item.status = status;
    if (status === 'purchased') {
      item.purchased_by = purchasedBy;
      item.purchased_at = new Date().toISOString();
    } else if (status === 'pending') {
      item.purchased_by = null;
      item.purchased_at = null;
    }

    memoryStore.outbox_events.push({
      id: crypto.randomUUID(),
      household_id: householdId,
      event_type: EVENT_TYPES.SHOPPING_ITEM_UPDATED,
      payload: item,
      status: 'pending',
      created_at: new Date().toISOString()
    });
    return item;
  },

  async convertShoppingToExpense({ itemId, householdId, payerId, amountPaise, participants }) {
    const item = memoryStore.shopping_items.find(i => i.id === itemId && i.household_id === householdId);
    if (!item) throw new Error('Shopping item not found');
    if (item.linked_expense_id) throw new Error('Shopping item is already converted to an expense');

    const expense = await this.createExpense({
      householdId,
      payerId,
      amountPaise,
      description: `Bought: ${item.item_name} (${item.quantity})`,
      category: item.category || 'groceries',
      splitType: SPLIT_TYPES.EQUAL,
      participants
    });

    item.status = 'purchased';
    item.purchased_by = payerId;
    item.purchased_at = new Date().toISOString();
    item.linked_expense_id = expense.id;

    return { item, expense };
  },

  // Chores & Rotations
  async getChores(householdId) {
    const chores = memoryStore.chores.filter(c => c.household_id === householdId);
    return chores.map(c => {
      const assigned = memoryStore.profiles.find(p => p.id === c.assigned_to) || {};
      const rotation = memoryStore.chore_rotations.find(r => r.chore_id === c.id);
      return {
        ...c,
        assigned_name: assigned.full_name || 'Unassigned',
        assigned_avatar: assigned.avatar_url,
        rotation: rotation || null
      };
    }).sort((a, b) => new Date(a.due_date || 0) - new Date(b.due_date || 0));
  },

  async createChore({ householdId, title, description, assignedTo, dueDate, recurrence = 'daily' }) {
    const id = crypto.randomUUID();
    const newChore = {
      id,
      household_id: householdId,
      title,
      description,
      assigned_to: assignedTo,
      due_date: dueDate || new Date(Date.now() + 86400000).toISOString(),
      recurrence,
      status: 'pending',
      created_at: new Date().toISOString()
    };
    memoryStore.chores.push(newChore);

    memoryStore.outbox_events.push({
      id: crypto.randomUUID(),
      household_id: householdId,
      event_type: EVENT_TYPES.CHORE_CREATED,
      payload: newChore,
      status: 'pending',
      created_at: new Date().toISOString()
    });
    return newChore;
  },

  async completeChore({ choreId, householdId, completedBy }) {
    const chore = memoryStore.chores.find(c => c.id === choreId && c.household_id === householdId);
    if (!chore) throw new Error('Chore not found');
    chore.status = 'completed';
    chore.last_completed_at = new Date().toISOString();
    chore.last_completed_by = completedBy;

    // Handle rotation if assigned
    const rotation = memoryStore.chore_rotations.find(r => r.chore_id === choreId);
    let nextAssigneeId = null;
    if (rotation && Array.isArray(rotation.rotation_order) && rotation.rotation_order.length > 0) {
      rotation.current_index = (rotation.current_index + 1) % rotation.rotation_order.length;
      nextAssigneeId = rotation.rotation_order[rotation.current_index];
      
      // If recurring, advance due date and reassign
      if (chore.recurrence !== 'none') {
        chore.status = 'pending';
        chore.assigned_to = nextAssigneeId;
        chore.due_date = new Date(Date.now() + 86400000).toISOString();
      }
    }

    const user = await this.getProfile(completedBy);
    memoryStore.household_events.unshift({
      id: crypto.randomUUID(),
      household_id: householdId,
      actor_id: completedBy,
      event_type: EVENT_TYPES.CHORE_COMPLETED,
      description: `${user?.full_name || 'Someone'} completed ${chore.title}`,
      entity_type: 'chore',
      entity_id: choreId,
      created_at: new Date().toISOString()
    });

    memoryStore.outbox_events.push({
      id: crypto.randomUUID(),
      household_id: householdId,
      event_type: EVENT_TYPES.CHORE_COMPLETED,
      payload: { chore, nextAssigneeId },
      status: 'pending',
      created_at: new Date().toISOString()
    });
    return chore;
  },

  // Bills
  async getBills(householdId) {
    const bills = memoryStore.bills.filter(b => b.household_id === householdId);
    return bills.map(b => {
      const resp = memoryStore.profiles.find(p => p.id === b.responsible_member_id) || {};
      return {
        ...b,
        responsible_name: resp.full_name || 'Unassigned',
        responsible_avatar: resp.avatar_url
      };
    }).sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
  },

  async createBill({ householdId, title, amountPaise, dueDate, responsibleMemberId, isRecurring = false, recurrenceInterval = 'monthly' }) {
    const id = crypto.randomUUID();
    const newBill = {
      id,
      household_id: householdId,
      title,
      amount_paise: amountPaise,
      due_date: dueDate,
      responsible_member_id: responsibleMemberId,
      status: 'upcoming',
      is_recurring: isRecurring,
      recurrence_interval: recurrenceInterval,
      created_at: new Date().toISOString()
    };
    memoryStore.bills.push(newBill);

    memoryStore.outbox_events.push({
      id: crypto.randomUUID(),
      household_id: householdId,
      event_type: EVENT_TYPES.BILL_CREATED,
      payload: newBill,
      status: 'pending',
      created_at: new Date().toISOString()
    });
    return newBill;
  },

  async payBill({ billId, householdId, payerId, participants }) {
    const bill = memoryStore.bills.find(b => b.id === billId && b.household_id === householdId);
    if (!bill) throw new Error('Bill not found');
    if (bill.status === 'paid') throw new Error('Bill is already paid');

    const expense = await this.createExpense({
      householdId,
      payerId,
      amountPaise: bill.amount_paise,
      description: `Bill Payment: ${bill.title}`,
      category: 'utilities',
      splitType: SPLIT_TYPES.EQUAL,
      participants
    });

    bill.status = 'paid';
    bill.linked_expense_id = expense.id;

    memoryStore.outbox_events.push({
      id: crypto.randomUUID(),
      household_id: householdId,
      event_type: EVENT_TYPES.BILL_PAID,
      payload: { bill, expense },
      status: 'pending',
      created_at: new Date().toISOString()
    });
    return { bill, expense };
  },

  // Polls
  async getPolls(householdId) {
    const polls = memoryStore.polls.filter(p => p.household_id === householdId);
    return polls.map(p => {
      const options = memoryStore.poll_options.filter(o => o.poll_id === p.id);
      const totalVotes = options.reduce((sum, o) => sum + (o.votes_count || 0), 0);
      const votes = memoryStore.poll_votes.filter(v => v.poll_id === p.id);
      return {
        ...p,
        options,
        totalVotes,
        votes
      };
    }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  },

  async createPoll({ householdId, question, options = [], createdBy, expiresAt }) {
    const pollId = crypto.randomUUID();
    const newPoll = {
      id: pollId,
      household_id: householdId,
      question,
      created_by: createdBy,
      expires_at: expiresAt || new Date(Date.now() + 3 * 86400000).toISOString(),
      status: 'active',
      created_at: new Date().toISOString()
    };
    memoryStore.polls.push(newPoll);

    const createdOptions = [];
    for (const text of options) {
      const opt = {
        id: crypto.randomUUID(),
        poll_id: pollId,
        text,
        votes_count: 0
      };
      memoryStore.poll_options.push(opt);
      createdOptions.push(opt);
    }

    memoryStore.outbox_events.push({
      id: crypto.randomUUID(),
      household_id: householdId,
      event_type: EVENT_TYPES.POLL_CREATED,
      payload: { poll: newPoll, options: createdOptions },
      status: 'pending',
      created_at: new Date().toISOString()
    });
    return { ...newPoll, options: createdOptions };
  },

  async votePoll({ pollId, optionId, userId }) {
    const poll = memoryStore.polls.find(p => p.id === pollId);
    if (!poll) throw new Error('Poll not found');
    if (poll.status !== 'active') throw new Error('Poll is closed');

    // Single-choice voting: check existing vote
    const existingVote = memoryStore.poll_votes.find(v => v.poll_id === pollId && v.user_id === userId);
    if (existingVote) {
      if (existingVote.option_id === optionId) return { success: true }; // already voted this
      // decrement previous option
      const prevOpt = memoryStore.poll_options.find(o => o.id === existingVote.option_id);
      if (prevOpt && prevOpt.votes_count > 0) prevOpt.votes_count -= 1;
      existingVote.option_id = optionId;
    } else {
      memoryStore.poll_votes.push({
        id: crypto.randomUUID(),
        poll_id: pollId,
        option_id: optionId,
        user_id: userId,
        created_at: new Date().toISOString()
      });
    }

    const opt = memoryStore.poll_options.find(o => o.id === optionId);
    if (opt) opt.votes_count = (opt.votes_count || 0) + 1;

    memoryStore.outbox_events.push({
      id: crypto.randomUUID(),
      household_id: poll.household_id,
      event_type: EVENT_TYPES.POLL_VOTED,
      payload: { pollId, optionId, userId },
      status: 'pending',
      created_at: new Date().toISOString()
    });
    return { success: true };
  },

  // Activity & Analytics
  async getActivity(householdId, limit = 20) {
    const events = memoryStore.household_events.filter(e => e.household_id === householdId);
    return events.slice(0, limit).map(e => {
      const actor = memoryStore.profiles.find(p => p.id === e.actor_id) || {};
      return {
        ...e,
        actor_name: actor.full_name || 'Roommate',
        actor_avatar: actor.avatar_url
      };
    });
  },

  async getAnalytics(householdId) {
    const expenses = memoryStore.expenses.filter(e => e.household_id === householdId && !e.is_void);
    const totalSpentPaise = expenses.reduce((sum, e) => sum + e.amount_paise, 0);

    const categoryBreakdown = {};
    for (const e of expenses) {
      categoryBreakdown[e.category] = (categoryBreakdown[e.category] || 0) + e.amount_paise;
    }

    const budget = memoryStore.monthly_budgets.find(b => b.household_id === householdId) || { budget_paise: 3000000 };

    return {
      totalSpentPaise,
      budgetPaise: budget.budget_paise,
      categoryBreakdown,
      expenseCount: expenses.length
    };
  },

  // Outbox
  async getPendingOutbox() {
    return memoryStore.outbox_events.filter(e => e.status === 'pending');
  },

  async markOutboxDelivered(eventId) {
    const e = memoryStore.outbox_events.find(ev => ev.id === eventId);
    if (e) {
      e.status = 'delivered';
      e.delivered_at = new Date().toISOString();
    }
  }
};
