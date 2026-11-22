import crypto from 'node:crypto';
import { pool } from './db.js';
import {
  calculateSplit,
  calculateBalances,
  calculateSettlementSuggestions,
  SPLIT_TYPES,
  EVENT_TYPES
} from '@roomsync/shared';

// In-Memory Fallback State for Offline/Standby Mode
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
  expenses: [],
  expense_shares: [],
  settlements: [],
  shopping_items: [],
  chores: [],
  chore_rotations: [],
  bills: [],
  polls: [],
  poll_options: [],
  poll_votes: [],
  household_events: [],
  outbox_events: [],
  monthly_budgets: []
};

async function queryDb(sql, params = []) {
  if (!pool) return null;
  try {
    return await pool.query(sql, params);
  } catch (err) {
    console.error('[queryDb error]', err.message);
    return null;
  }
}

export const repository = {
  // ==========================================
  // Profiles & Auth
  // ==========================================
  async getProfile(userId) {
    const res = await queryDb('SELECT * FROM profiles WHERE id = $1', [userId]);
    if (res && res.rows[0]) return res.rows[0];
    return memoryStore.profiles.find(p => p.id === userId) || null;
  },

  async createProfile(profile) {
    const id = profile.id || crypto.randomUUID();
    const res = await queryDb(
      `INSERT INTO profiles (id, email, full_name, avatar_url)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, avatar_url = EXCLUDED.avatar_url
       RETURNING *`,
      [id, profile.email, profile.full_name, profile.avatar_url]
    );
    if (res && res.rows[0]) return res.rows[0];

    const existing = memoryStore.profiles.find(p => p.id === id);
    if (existing) return existing;
    const newP = { id, ...profile };
    memoryStore.profiles.push(newP);
    return newP;
  },

  async getAllProfiles() {
    const res = await queryDb('SELECT * FROM profiles ORDER BY full_name ASC');
    if (res && res.rows.length > 0) return res.rows;
    return [...memoryStore.profiles];
  },

  async getProfileByEmail(email) {
    const res = await queryDb('SELECT * FROM profiles WHERE LOWER(email) = LOWER($1)', [email]);
    if (res && res.rows[0]) return res.rows[0];
    return memoryStore.profiles.find(p => p.email.toLowerCase() === email.toLowerCase()) || null;
  },

  // ==========================================
  // Households & Memberships
  // ==========================================
  async getHousehold(householdId) {
    const res = await queryDb('SELECT * FROM households WHERE id = $1', [householdId]);
    if (res && res.rows[0]) return res.rows[0];
    return memoryStore.households.find(h => h.id === householdId) || null;
  },

  async getHouseholdMembers(householdId) {
    const res = await queryDb(
      `SELECT m.id, m.household_id, m.user_id, m.role, m.status, m.joined_at,
              p.email, p.full_name, p.avatar_url
       FROM memberships m
       JOIN profiles p ON m.user_id = p.id
       WHERE m.household_id = $1 AND m.status = 'active'
       ORDER BY m.joined_at ASC`,
      [householdId]
    );
    if (res && res.rows.length > 0) return res.rows;

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
    const res = await queryDb(
      `SELECT m.id, m.household_id, m.user_id, m.role, m.status, m.joined_at,
              h.name as household_name, h.currency, h.join_code
       FROM memberships m
       JOIN households h ON m.household_id = h.id
       WHERE m.user_id = $1 AND m.status = 'active'`,
      [userId]
    );
    if (res && res.rows.length > 0) return res.rows;

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
    if (pool) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const hhId = crypto.randomUUID();
        const joinCode = 'SYNC-' + Math.random().toString(36).substring(2, 8).toUpperCase();
        const hhRes = await client.query(
          `INSERT INTO households (id, name, currency, join_code, created_by)
           VALUES ($1, $2, $3, $4, $5) RETURNING *`,
          [hhId, name, currency, joinCode, userId]
        );
        const household = hhRes.rows[0];

        await client.query(
          `INSERT INTO memberships (household_id, user_id, role, status)
           VALUES ($1, $2, 'admin', 'active')`,
          [hhId, userId]
        );
        await client.query('COMMIT');
        return household;
      } catch (err) {
        await client.query('ROLLBACK');
      } finally {
        client.release();
      }
    }

    const hhId = crypto.randomUUID();
    const joinCode = 'SYNC-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    const newHousehold = { id: hhId, name, currency, join_code: joinCode, created_by: userId, created_at: new Date().toISOString() };
    memoryStore.households.push(newHousehold);
    memoryStore.memberships.push({ id: crypto.randomUUID(), household_id: hhId, user_id: userId, role: 'admin', status: 'active', joined_at: new Date().toISOString() });
    return newHousehold;
  },

  async joinHousehold({ joinCode, userId }) {
    if (pool) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const hhRes = await client.query('SELECT * FROM households WHERE UPPER(join_code) = UPPER($1)', [joinCode.trim()]);
        if (!hhRes.rows[0]) throw new Error('Invalid household invitation code');
        const hh = hhRes.rows[0];

        await client.query(
          `INSERT INTO memberships (household_id, user_id, role, status)
           VALUES ($1, $2, 'member', 'active')
           ON CONFLICT (household_id, user_id) DO UPDATE SET status = 'active'`,
          [hh.id, userId]
        );
        await client.query('COMMIT');
        return hh;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }

    const hh = memoryStore.households.find(h => h.join_code.toUpperCase() === joinCode.trim().toUpperCase());
    if (!hh) throw new Error('Invalid household invitation code');
    const existing = memoryStore.memberships.find(m => m.household_id === hh.id && m.user_id === userId);
    if (existing) {
      existing.status = 'active';
      return hh;
    }
    memoryStore.memberships.push({ id: crypto.randomUUID(), household_id: hh.id, user_id: userId, role: 'member', status: 'active', joined_at: new Date().toISOString() });
    return hh;
  },

  // ==========================================
  // Expenses & Authoritative Balances
  // ==========================================
  async getExpenses(householdId, { category, payerId, isVoid = false } = {}) {
    let sql = `
      SELECT e.id, e.household_id, e.payer_id, e.amount_paise::text as amount_paise_str,
             e.amount_paise, e.description, e.category, e.split_type, e.expense_date,
             e.idempotency_key, e.version, e.is_void, e.created_at,
             p.full_name as payer_name, p.avatar_url as payer_avatar
      FROM expenses e
      JOIN profiles p ON e.payer_id = p.id
      WHERE e.household_id = $1 AND e.is_void = $2
    `;
    const params = [householdId, isVoid];
    if (category) {
      params.push(category);
      sql += ` AND e.category = $${params.length}`;
    }
    if (payerId) {
      params.push(payerId);
      sql += ` AND e.payer_id = $${params.length}`;
    }
    sql += ` ORDER BY e.expense_date DESC`;

    const res = await queryDb(sql, params);
    if (res && res.rows.length >= 0) {
      const expenses = res.rows.map(r => ({ ...r, amount_paise: Number(r.amount_paise) }));
      // Fetch shares for each
      for (const exp of expenses) {
        const sharesRes = await queryDb(
          `SELECT s.id, s.expense_id, s.user_id, s.share_paise,
                  p.full_name as user_name, p.avatar_url
           FROM expense_shares s
           JOIN profiles p ON s.user_id = p.id
           WHERE s.expense_id = $1`,
          [exp.id]
        );
        exp.shares = sharesRes ? sharesRes.rows.map(s => ({ ...s, share_paise: Number(s.share_paise) })) : [];
      }
      return expenses;
    }

    // In-memory fallback
    let exps = memoryStore.expenses.filter(e => e.household_id === householdId && e.is_void === isVoid);
    if (category) exps = exps.filter(e => e.category === category);
    if (payerId) exps = exps.filter(e => e.payer_id === payerId);
    return exps.map(e => {
      const payer = memoryStore.profiles.find(p => p.id === e.payer_id) || {};
      const shares = memoryStore.expense_shares.filter(s => s.expense_id === e.id).map(s => {
        const u = memoryStore.profiles.find(p => p.id === s.user_id) || {};
        return { ...s, user_name: u.full_name, avatar_url: u.avatar_url };
      });
      return { ...e, payer_name: payer.full_name, payer_avatar: payer.avatar_url, shares };
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
    const calculatedShares = calculateSplit({
      totalPaise: amountPaise,
      splitType,
      participants,
      customAmounts,
      percentages,
      weights
    });

    if (pool) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        if (idempotencyKey) {
          const existing = await client.query('SELECT * FROM expenses WHERE idempotency_key = $1', [idempotencyKey]);
          if (existing.rows[0]) {
            await client.query('COMMIT');
            const exp = existing.rows[0];
            const sharesRes = await client.query('SELECT * FROM expense_shares WHERE expense_id = $1', [exp.id]);
            return { ...exp, amount_paise: Number(exp.amount_paise), shares: sharesRes.rows.map(s => ({ ...s, share_paise: Number(s.share_paise) })) };
          }
        }

        const expId = crypto.randomUUID();
        const expRes = await client.query(
          `INSERT INTO expenses (id, household_id, payer_id, amount_paise, description, category, split_type, idempotency_key)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING *`,
          [expId, householdId, payerId, amountPaise, description, category, splitType, idempotencyKey]
        );
        const exp = expRes.rows[0];

        for (const s of calculatedShares) {
          await client.query(
            `INSERT INTO expense_shares (expense_id, user_id, share_paise) VALUES ($1, $2, $3)`,
            [expId, s.userId, s.sharePaise]
          );
        }

        const payer = await this.getProfile(payerId);
        await client.query(
          `INSERT INTO household_events (household_id, actor_id, event_type, description, entity_type, entity_id, metadata)
           VALUES ($1, $2, $3, $4, 'expense', $5, $6)`,
          [
            householdId,
            payerId,
            EVENT_TYPES.EXPENSE_CREATED,
            `${payer?.full_name || 'Someone'} added ₹${(amountPaise / 100).toLocaleString('en-IN')} expense (${description})`,
            expId,
            JSON.stringify({ amountPaise, description })
          ]
        );

        await client.query(
          `INSERT INTO outbox_events (household_id, event_type, payload, status)
           VALUES ($1, $2, $3, 'pending')`,
          [householdId, EVENT_TYPES.EXPENSE_CREATED, JSON.stringify({ expense: exp, shares: calculatedShares })]
        );

        await client.query('COMMIT');
        return { ...exp, amount_paise: Number(exp.amount_paise), shares: calculatedShares };
      } catch (err) {
        console.error('[createExpense error]', err.message || err);
        try { await client.query('ROLLBACK'); } catch {}
        throw err;
      } finally {
        client.release();
      }
    }

    // In-memory fallback
    if (idempotencyKey) {
      const existing = memoryStore.expenses.find(e => e.idempotency_key === idempotencyKey);
      if (existing) return existing;
    }

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

    const payer = await this.getProfile(payerId);
    memoryStore.household_events.unshift({
      id: crypto.randomUUID(),
      household_id: householdId,
      actor_id: payerId,
      event_type: EVENT_TYPES.EXPENSE_CREATED,
      description: `${payer?.full_name || 'Someone'} added ₹${(amountPaise / 100).toLocaleString('en-IN')} expense (${description})`,
      entity_type: 'expense',
      entity_id: expenseId,
      metadata: { amountPaise, description },
      created_at: new Date().toISOString()
    });

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
    if (pool) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const res = await client.query(
          `UPDATE expenses SET is_void = true, version = version + 1
           WHERE id = $1 AND household_id = $2
           RETURNING *`,
          [expenseId, householdId]
        );
        if (!res.rows[0]) throw new Error('Expense not found');
        const expense = res.rows[0];

        const user = await this.getProfile(userId);
        await client.query(
          `INSERT INTO household_events (household_id, actor_id, event_type, description, entity_type, entity_id)
           VALUES ($1, $2, $3, $4, 'expense', $5)`,
          [
            householdId,
            userId,
            EVENT_TYPES.EXPENSE_VOIDED,
            `${user?.full_name || 'Someone'} voided expense: ${expense.description}`,
            expenseId
          ]
        );

        await client.query(
          `INSERT INTO outbox_events (household_id, event_type, payload, status)
           VALUES ($1, $2, $3, 'pending')`,
          [householdId, EVENT_TYPES.EXPENSE_VOIDED, JSON.stringify({ expenseId })]
        );

        await client.query('COMMIT');
        return expense;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }

    const expense = memoryStore.expenses.find(e => e.id === expenseId && e.household_id === householdId);
    if (!expense) throw new Error('Expense not found');
    expense.is_void = true;
    expense.version += 1;

    const user = await this.getProfile(userId);
    memoryStore.household_events.unshift({
      id: crypto.randomUUID(),
      household_id: householdId,
      actor_id: userId,
      event_type: EVENT_TYPES.EXPENSE_VOIDED,
      description: `${user?.full_name || 'Someone'} voided expense: ${expense.description}`,
      entity_type: 'expense',
      entity_id: expenseId,
      created_at: new Date().toISOString()
    });
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

    let expenses = [];
    let shares = [];
    let settlements = [];

    if (pool) {
      const expRes = await queryDb(
        `SELECT id, payer_id, amount_paise FROM expenses WHERE household_id = $1 AND is_void = false`,
        [householdId]
      );
      if (expRes) {
        expenses = expRes.rows.map(e => ({ ...e, amount_paise: Number(e.amount_paise) }));
        const expIds = expenses.map(e => e.id);
        if (expIds.length > 0) {
          const shareRes = await queryDb(
            `SELECT expense_id, user_id, share_paise FROM expense_shares WHERE expense_id = ANY($1::uuid[])`,
            [expIds]
          );
          if (shareRes) {
            shares = shareRes.rows.map(s => ({ ...s, share_paise: Number(s.share_paise) }));
          }
        }
      }

      const setRes = await queryDb(
        `SELECT sender_id, recipient_id, amount_paise FROM settlements WHERE household_id = $1`,
        [householdId]
      );
      if (setRes) {
        settlements = setRes.rows.map(s => ({ ...s, amount_paise: Number(s.amount_paise) }));
      }
    } else {
      expenses = memoryStore.expenses.filter(e => e.household_id === householdId && !e.is_void);
      const expenseIds = new Set(expenses.map(e => e.id));
      shares = memoryStore.expense_shares.filter(s => expenseIds.has(s.expense_id));
      settlements = memoryStore.settlements.filter(s => s.household_id === householdId);
    }

    const rawBalances = calculateBalances({
      memberIds,
      expenses,
      expenseShares: shares,
      settlements
    });

    const suggestions = calculateSettlementSuggestions(rawBalances);

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
        fromUserName: from.full_name || 'Member',
        toUserName: to.full_name || 'Member'
      };
    });

    return {
      balances: enrichedBalances,
      settlementSuggestions: enrichedSuggestions,
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
    if (pool) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        if (idempotencyKey) {
          const existing = await client.query('SELECT * FROM settlements WHERE idempotency_key = $1', [idempotencyKey]);
          if (existing.rows[0]) {
            await client.query('COMMIT');
            return { ...existing.rows[0], amount_paise: Number(existing.rows[0].amount_paise) };
          }
        }

        const id = crypto.randomUUID();
        const res = await client.query(
          `INSERT INTO settlements (id, household_id, sender_id, recipient_id, amount_paise, notes, recorded_by, idempotency_key)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING *`,
          [id, householdId, senderId, recipientId, amountPaise, notes, recordedBy, idempotencyKey]
        );
        const settlement = res.rows[0];

        const sender = await this.getProfile(senderId);
        const recipient = await this.getProfile(recipientId);
        await client.query(
          `INSERT INTO household_events (household_id, actor_id, event_type, description, entity_type, entity_id, metadata)
           VALUES ($1, $2, $3, $4, 'settlement', $5, $6)`,
          [
            householdId,
            recordedBy,
            EVENT_TYPES.SETTLEMENT_RECORDED,
            `${sender?.full_name || 'Member'} paid ₹${(amountPaise / 100).toLocaleString('en-IN')} to ${recipient?.full_name || 'Member'}`,
            id,
            JSON.stringify({ amountPaise, senderId, recipientId })
          ]
        );

        await client.query(
          `INSERT INTO outbox_events (household_id, event_type, payload, status)
           VALUES ($1, $2, $3, 'pending')`,
          [householdId, EVENT_TYPES.SETTLEMENT_RECORDED, JSON.stringify({ settlement })]
        );

        await client.query('COMMIT');
        return { ...settlement, amount_paise: Number(settlement.amount_paise) };
      } catch (err) {
        await client.query('ROLLBACK');
      } finally {
        client.release();
      }
    }

    if (idempotencyKey) {
      const existing = memoryStore.settlements.find(s => s.idempotency_key === idempotencyKey);
      if (existing) return existing;
    }

    const id = crypto.randomUUID();
    const settlement = {
      id,
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
    memoryStore.settlements.push(settlement);

    const sender = await this.getProfile(senderId);
    const recipient = await this.getProfile(recipientId);
    memoryStore.household_events.unshift({
      id: crypto.randomUUID(),
      household_id: householdId,
      actor_id: recordedBy,
      event_type: EVENT_TYPES.SETTLEMENT_RECORDED,
      description: `${sender?.full_name || 'Member'} paid ₹${(amountPaise / 100).toLocaleString('en-IN')} to ${recipient?.full_name || 'Member'}`,
      entity_type: 'settlement',
      entity_id: id,
      created_at: new Date().toISOString()
    });

    memoryStore.outbox_events.push({
      id: crypto.randomUUID(),
      household_id: householdId,
      event_type: EVENT_TYPES.SETTLEMENT_RECORDED,
      payload: { settlement },
      status: 'pending',
      created_at: new Date().toISOString()
    });

    return settlement;
  },

  async getSettlements(householdId) {
    const res = await queryDb(
      `SELECT s.*,
              sender.full_name as sender_name, sender.avatar_url as sender_avatar,
              rec.full_name as recipient_name, rec.avatar_url as recipient_avatar
       FROM settlements s
       JOIN profiles sender ON s.sender_id = sender.id
       JOIN profiles rec ON s.recipient_id = rec.id
       WHERE s.household_id = $1
       ORDER BY s.settlement_date DESC`,
      [householdId]
    );
    if (res && res.rows.length >= 0) {
      return res.rows.map(r => ({ ...r, amount_paise: Number(r.amount_paise) }));
    }

    return memoryStore.settlements
      .filter(s => s.household_id === householdId)
      .map(s => {
        const sender = memoryStore.profiles.find(p => p.id === s.sender_id) || {};
        const recipient = memoryStore.profiles.find(p => p.id === s.recipient_id) || {};
        return {
          ...s,
          sender_name: sender.full_name,
          sender_avatar: sender.avatar_url,
          recipient_name: recipient.full_name,
          recipient_avatar: recipient.avatar_url
        };
      })
      .sort((a, b) => new Date(b.settlement_date) - new Date(a.settlement_date));
  },

  // ==========================================
  // Shopping Items
  // ==========================================
  async getShoppingItems(householdId, { status } = {}) {
    let sql = `
      SELECT i.*, p.full_name as assigned_name, p.avatar_url as assigned_avatar
      FROM shopping_items i
      LEFT JOIN profiles p ON i.assigned_to = p.id
      WHERE i.household_id = $1
    `;
    const params = [householdId];
    if (status) {
      params.push(status);
      sql += ` AND i.status = $${params.length}`;
    }
    sql += ` ORDER BY i.created_at DESC`;

    const res = await queryDb(sql, params);
    if (res && res.rows.length >= 0) return res.rows;

    let items = memoryStore.shopping_items.filter(i => i.household_id === householdId);
    if (status) items = items.filter(i => i.status === status);
    return items.map(i => {
      const assigned = memoryStore.profiles.find(p => p.id === i.assigned_to) || {};
      return { ...i, assigned_name: assigned.full_name, assigned_avatar: assigned.avatar_url };
    });
  },

  async addShoppingItem({ householdId, itemName, quantity = '1', category = 'groceries', assignedTo, addedBy }) {
    const res = await queryDb(
      `INSERT INTO shopping_items (household_id, item_name, quantity, category, assigned_to, added_by, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending')
       RETURNING *`,
      [householdId, itemName, quantity, category, assignedTo || null, addedBy]
    );
    if (res && res.rows[0]) return res.rows[0];

    const newItem = {
      id: crypto.randomUUID(),
      household_id: householdId,
      item_name: itemName,
      quantity,
      category,
      assigned_to: assignedTo,
      added_by: addedBy,
      status: 'pending',
      created_at: new Date().toISOString()
    };
    memoryStore.shopping_items.unshift(newItem);
    return newItem;
  },

  async updateShoppingItem(arg1, arg2, arg3) {
    let itemId, householdId, updates;
    if (typeof arg1 === 'object') {
      itemId = arg1.itemId;
      householdId = arg1.householdId;
      updates = { status: arg1.status, purchased_by: arg1.purchasedBy };
    } else {
      itemId = arg1;
      householdId = arg2;
      updates = arg3 || {};
    }

    if (pool && updates.status) {
      const res = await queryDb(
        `UPDATE shopping_items SET status = $1, updated_at = NOW() WHERE id = $2 AND household_id = $3 RETURNING *`,
        [updates.status, itemId, householdId]
      );
      if (res && res.rows[0]) return res.rows[0];
    }

    const item = memoryStore.shopping_items.find(i => i.id === itemId && i.household_id === householdId);
    if (!item) throw new Error('Shopping item not found');
    Object.assign(item, updates, { updated_at: new Date().toISOString() });
    return item;
  },

  async convertShoppingToExpense(params) {
    return this.convertShoppingItemToExpense(params);
  },

  async convertShoppingItemToExpense({ itemId, householdId, payerId, amountPaise, participants }) {
    let itemTitle = 'Grocery Item';
    if (pool) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const itmRes = await client.query('SELECT * FROM shopping_items WHERE id = $1 AND household_id = $2', [itemId, householdId]);
        if (itmRes.rows[0]) itemTitle = itmRes.rows[0].item_name;

        const expense = await this.createExpense({
          householdId,
          payerId,
          amountPaise,
          description: `Shopping: ${itemTitle}`,
          category: 'groceries',
          splitType: SPLIT_TYPES.EQUAL,
          participants
        });

        await client.query(
          `UPDATE shopping_items SET status = 'purchased', linked_expense_id = $1 WHERE id = $2`,
          [expense.id, itemId]
        );

        await client.query('COMMIT');
        return { item: { id: itemId, status: 'purchased' }, expense };
      } catch (err) {
        await client.query('ROLLBACK');
      } finally {
        client.release();
      }
    }

    const item = memoryStore.shopping_items.find(i => i.id === itemId && i.household_id === householdId);
    if (item) {
      item.status = 'purchased';
      itemTitle = item.item_name;
    }
    const expense = await this.createExpense({
      householdId,
      payerId,
      amountPaise,
      description: `Shopping: ${itemTitle}`,
      category: 'groceries',
      splitType: SPLIT_TYPES.EQUAL,
      participants
    });
    return { item, expense };
  },

  // ==========================================
  // Chores & Rotations
  // ==========================================
  async getChores(householdId) {
    const res = await queryDb(
      `SELECT c.*, p.full_name as assigned_name, p.avatar_url as assigned_avatar
       FROM chores c
       LEFT JOIN profiles p ON c.assigned_to = p.id
       WHERE c.household_id = $1
       ORDER BY c.due_date ASC`,
      [householdId]
    );
    if (res && res.rows.length >= 0) return res.rows;

    return memoryStore.chores
      .filter(c => c.household_id === householdId)
      .map(c => {
        const assigned = memoryStore.profiles.find(p => p.id === c.assigned_to) || {};
        return { ...c, assigned_name: assigned.full_name, assigned_avatar: assigned.avatar_url };
      });
  },

  async createChore({ householdId, title, description = '', assignedTo, dueDate, recurrence = 'daily' }) {
    const res = await queryDb(
      `INSERT INTO chores (household_id, title, description, assigned_to, due_date, recurrence, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending')
       RETURNING *`,
      [householdId, title, description, assignedTo || null, dueDate || new Date().toISOString(), recurrence]
    );
    if (res && res.rows[0]) return res.rows[0];

    const chore = {
      id: crypto.randomUUID(),
      household_id: householdId,
      title,
      description,
      assigned_to: assignedTo,
      due_date: dueDate || new Date(Date.now() + 86400000).toISOString(),
      recurrence,
      status: 'pending',
      created_at: new Date().toISOString()
    };
    memoryStore.chores.push(chore);
    return chore;
  },

  async completeChore(arg1, arg2, arg3) {
    let choreId, householdId, userId;
    if (typeof arg1 === 'object') {
      choreId = arg1.choreId;
      householdId = arg1.householdId;
      userId = arg1.completedBy;
    } else {
      choreId = arg1;
      householdId = arg2;
      userId = arg3;
    }

    if (pool) {
      const res = await queryDb(
        `UPDATE chores SET status = 'completed', last_completed_at = NOW(), last_completed_by = $1
         WHERE id = $2 AND household_id = $3
         RETURNING *`,
        [userId, choreId, householdId]
      );
      if (res && res.rows[0]) return res.rows[0];
    }

    const chore = memoryStore.chores.find(c => c.id === choreId && c.household_id === householdId);
    if (!chore) throw new Error('Chore not found');
    chore.status = 'completed';
    chore.last_completed_at = new Date().toISOString();
    chore.last_completed_by = userId;
    return chore;
  },

  // ==========================================
  // Bills & Utilities
  // ==========================================
  async getBills(householdId) {
    const res = await queryDb(
      `SELECT b.*, b.amount_paise::text as amount_paise_str, p.full_name as responsible_name
       FROM bills b
       LEFT JOIN profiles p ON b.responsible_member_id = p.id
       WHERE b.household_id = $1
       ORDER BY b.due_date ASC`,
      [householdId]
    );
    if (res && res.rows.length >= 0) {
      return res.rows.map(r => ({ ...r, amount_paise: Number(r.amount_paise) }));
    }

    return memoryStore.bills
      .filter(b => b.household_id === householdId)
      .map(b => {
        const resp = memoryStore.profiles.find(p => p.id === b.responsible_member_id) || {};
        return { ...b, responsible_name: resp.full_name };
      });
  },

  async createBill({ householdId, title, amountPaise, dueDate, responsibleMemberId, isRecurring = false, interval = 'monthly' }) {
    const res = await queryDb(
      `INSERT INTO bills (household_id, title, amount_paise, due_date, responsible_member_id, is_recurring, recurrence_interval, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'upcoming')
       RETURNING *`,
      [householdId, title, amountPaise, dueDate || new Date().toISOString(), responsibleMemberId || null, isRecurring, interval]
    );
    if (res && res.rows[0]) return { ...res.rows[0], amount_paise: Number(res.rows[0].amount_paise) };

    const bill = {
      id: crypto.randomUUID(),
      household_id: householdId,
      title,
      amount_paise: amountPaise,
      due_date: dueDate || new Date(Date.now() + 7 * 86400000).toISOString(),
      responsible_member_id: responsibleMemberId,
      status: 'upcoming',
      is_recurring: isRecurring,
      recurrence_interval: interval,
      created_at: new Date().toISOString()
    };
    memoryStore.bills.push(bill);
    return bill;
  },

  async markBillPaid(billId, householdId, userId) {
    if (pool) {
      const res = await queryDb(
        `UPDATE bills SET status = 'paid', updated_at = NOW() WHERE id = $1 AND household_id = $2 RETURNING *`,
        [billId, householdId]
      );
      if (res && res.rows[0]) return { ...res.rows[0], amount_paise: Number(res.rows[0].amount_paise) };
    }

    const bill = memoryStore.bills.find(b => b.id === billId && b.household_id === householdId);
    if (!bill) throw new Error('Bill not found');
    bill.status = 'paid';
    return bill;
  },

  async payBill({ billId, householdId, payerId, participants }) {
    if (pool) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const bRes = await client.query('SELECT * FROM bills WHERE id = $1 AND household_id = $2', [billId, householdId]);
        if (!bRes.rows[0]) throw new Error('Bill not found');
        const bill = bRes.rows[0];

        const expense = await this.createExpense({
          householdId,
          payerId,
          amountPaise: Number(bill.amount_paise),
          description: `Bill Payment: ${bill.title}`,
          category: 'utilities',
          splitType: SPLIT_TYPES.EQUAL,
          participants
        });

        const updatedBillRes = await client.query(
          `UPDATE bills SET status = 'paid', linked_expense_id = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
          [expense.id, billId]
        );
        await client.query('COMMIT');
        return {
          bill: { ...updatedBillRes.rows[0], amount_paise: Number(updatedBillRes.rows[0].amount_paise) },
          expense
        };
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }

    const bill = memoryStore.bills.find(b => b.id === billId && b.household_id === householdId);
    if (!bill) throw new Error('Bill not found');
    bill.status = 'paid';
    const expense = await this.createExpense({
      householdId,
      payerId,
      amountPaise: bill.amount_paise,
      description: `Bill Payment: ${bill.title}`,
      category: 'utilities',
      splitType: SPLIT_TYPES.EQUAL,
      participants
    });
    bill.linked_expense_id = expense.id;
    return { bill, expense };
  },

  // ==========================================
  // Polls & Decision Engine
  // ==========================================
  async getPolls(householdId, userId) {
    let polls = [];
    if (pool) {
      const pollRes = await queryDb(`SELECT * FROM polls WHERE household_id = $1 ORDER BY created_at DESC`, [householdId]);
      if (pollRes) {
        for (const p of pollRes.rows) {
          const optRes = await queryDb(`SELECT * FROM poll_options WHERE poll_id = $1`, [p.id]);
          const userVoteRes = await queryDb(`SELECT option_id FROM poll_votes WHERE poll_id = $1 AND user_id = $2`, [p.id, userId]);
          polls.push({
            ...p,
            options: optRes ? optRes.rows : [],
            userVotedOptionId: userVoteRes?.rows[0]?.option_id || null
          });
        }
        return polls;
      }
    }

    polls = memoryStore.polls.filter(p => p.household_id === householdId);
    return polls.map(p => {
      const options = memoryStore.poll_options.filter(o => o.poll_id === p.id);
      const userVote = memoryStore.poll_votes.find(v => v.poll_id === p.id && v.user_id === userId);
      return {
        ...p,
        options,
        userVotedOptionId: userVote?.option_id || null
      };
    });
  },

  async createPoll({ householdId, question, createdBy, options = [], expiresAt }) {
    if (pool) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const pollRes = await client.query(
          `INSERT INTO polls (household_id, question, created_by, expires_at, status)
           VALUES ($1, $2, $3, $4, 'active')
           RETURNING *`,
          [householdId, question, createdBy, expiresAt || null]
        );
        const poll = pollRes.rows[0];
        const createdOptions = [];
        for (const opt of options) {
          const optRes = await client.query(
            `INSERT INTO poll_options (poll_id, text, votes_count) VALUES ($1, $2, 0) RETURNING *`,
            [poll.id, opt]
          );
          createdOptions.push(optRes.rows[0]);
        }
        await client.query('COMMIT');
        return { ...poll, options: createdOptions };
      } catch (err) {
        await client.query('ROLLBACK');
      } finally {
        client.release();
      }
    }

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

    const createdOpts = options.map(optText => {
      const opt = { id: crypto.randomUUID(), poll_id: pollId, text: optText, votes_count: 0 };
      memoryStore.poll_options.push(opt);
      return opt;
    });

    return { ...newPoll, options: createdOpts };
  },

  async votePoll({ pollId, optionId, userId }) {
    if (pool) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const existing = await client.query('SELECT * FROM poll_votes WHERE poll_id = $1 AND user_id = $2', [pollId, userId]);
        if (existing.rows[0]) {
          await client.query('UPDATE poll_options SET votes_count = GREATEST(votes_count - 1, 0) WHERE id = $1', [existing.rows[0].option_id]);
          await client.query('UPDATE poll_votes SET option_id = $1 WHERE poll_id = $2 AND user_id = $3', [optionId, pollId, userId]);
        } else {
          await client.query(
            `INSERT INTO poll_votes (poll_id, option_id, user_id) VALUES ($1, $2, $3)`,
            [pollId, optionId, userId]
          );
        }
        await client.query(
          `UPDATE poll_options SET votes_count = votes_count + 1 WHERE id = $1`,
          [optionId]
        );
        await client.query('COMMIT');
        return { success: true };
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }

    const existingVote = memoryStore.poll_votes.find(v => v.poll_id === pollId && v.user_id === userId);
    if (existingVote) {
      const oldOpt = memoryStore.poll_options.find(o => o.id === existingVote.option_id);
      if (oldOpt) oldOpt.votes_count = Math.max(0, oldOpt.votes_count - 1);
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
    if (opt) opt.votes_count += 1;
    return { success: true };
  },

  // ==========================================
  // Household Events (Activity Feed)
  // ==========================================
  async getActivity(householdId, limit = 20) {
    return this.getActivityEvents(householdId, limit);
  },

  async getActivityEvents(householdId, limit = 20) {
    const res = await queryDb(
      `SELECT e.*, p.full_name as actor_name, p.avatar_url as actor_avatar
       FROM household_events e
       LEFT JOIN profiles p ON e.actor_id = p.id
       WHERE e.household_id = $1
       ORDER BY e.created_at DESC
       LIMIT $2`,
      [householdId, limit]
    );
    if (res && res.rows.length >= 0) return res.rows;

    return memoryStore.household_events
      .filter(e => e.household_id === householdId)
      .slice(0, limit)
      .map(e => {
        const actor = memoryStore.profiles.find(p => p.id === e.actor_id) || {};
        return { ...e, actor_name: actor.full_name, actor_avatar: actor.avatar_url };
      });
  },

  async getAnalytics(householdId) {
    const expenses = await this.getExpenses(householdId);
    const totalSpentPaise = expenses.reduce((sum, e) => sum + e.amount_paise, 0);
    const categoryBreakdown = {};
    for (const e of expenses) {
      categoryBreakdown[e.category] = (categoryBreakdown[e.category] || 0) + e.amount_paise;
    }
    return {
      totalSpentPaise,
      budgetPaise: 3000000,
      categoryBreakdown,
      expenseCount: expenses.length
    };
  },

  // ==========================================
  // Transactional Outbox (Socket.IO Real-time Engine)
  // ==========================================
  async getPendingOutbox() {
    const res = await queryDb(
      `SELECT * FROM outbox_events WHERE status = 'pending' ORDER BY created_at ASC LIMIT 50`
    );
    if (res && res.rows.length >= 0) {
      return res.rows.map(r => ({
        ...r,
        payload: typeof r.payload === 'string' ? JSON.parse(r.payload) : r.payload
      }));
    }
    return memoryStore.outbox_events.filter(e => e.status === 'pending');
  },

  async markOutboxDelivered(eventId) {
    if (pool) {
      await queryDb(
        `UPDATE outbox_events SET status = 'delivered', delivered_at = NOW() WHERE id = $1`,
        [eventId]
      );
    }
    const e = memoryStore.outbox_events.find(ev => ev.id === eventId);
    if (e) {
      e.status = 'delivered';
      e.delivered_at = new Date().toISOString();
    }
  }
};
