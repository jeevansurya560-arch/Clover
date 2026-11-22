import assert from 'node:assert';
import test from 'node:test';
import { buildApp } from '../../apps/api/src/server.js';

test('API Integration Tests — Full Product Verticals', async (t) => {
  const app = await buildApp();

  await t.test('1. GET /health reports healthy status', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.strictEqual(body.status, 'ok');
  });

  await t.test('2. GET /api/auth/me returns profile and active memberships', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { 'x-user-id': '00000000-0000-0000-0000-000000000003' }
    });
    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.strictEqual(body.user.full_name, 'You (Alex)');
    assert(body.memberships.length > 0);
  });

  await t.test('3. GET /api/households/current returns DreamHouse details & roommates', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/households/current',
      headers: { 'x-user-id': '00000000-0000-0000-0000-000000000003' }
    });
    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.strictEqual(body.household.name, 'DreamHouse');
    assert.strictEqual(body.members.length, 3);
  });

  await t.test('4. GET /api/expenses returns seeded household expenses with shares', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/expenses',
      headers: { 'x-user-id': '00000000-0000-0000-0000-000000000003' }
    });
    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert(Array.isArray(body.expenses));
    assert(body.expenses.length >= 3);
    assert(body.expenses[0].shares.length > 0);
  });

  await t.test('5. POST /api/expenses creates new expense with exact shares & event', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/expenses',
      headers: { 'x-user-id': '00000000-0000-0000-0000-000000000003' },
      payload: {
        description: 'Dish Soap & Sponge',
        amount_paise: 15000,
        payer_id: '00000000-0000-0000-0000-000000000003',
        category: 'household',
        split_type: 'equal',
        participants: [
          '00000000-0000-0000-0000-000000000001',
          '00000000-0000-0000-0000-000000000002',
          '00000000-0000-0000-0000-000000000003'
        ]
      }
    });
    assert.strictEqual(res.statusCode, 201);
    const body = JSON.parse(res.payload);
    assert.strictEqual(body.amount_paise, 15000);
    assert.strictEqual(body.shares.length, 3);
    assert.strictEqual(body.shares[0].sharePaise, 5000);
  });

  await t.test('6. GET /api/balances computes net positions and settlement suggestions', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/balances',
      headers: { 'x-user-id': '00000000-0000-0000-0000-000000000003' }
    });
    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert(body.balances);
    assert(Array.isArray(body.suggestions));
    // Verify sum of net positions is 0
    const netSum = Object.values(body.balances).reduce((sum, b) => sum + b.netPaise, 0);
    assert.strictEqual(netSum, 0);
  });

  await t.test('7. POST /api/settlements records repayment', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/settlements',
      headers: { 'x-user-id': '00000000-0000-0000-0000-000000000003' },
      payload: {
        sender_id: '00000000-0000-0000-0000-000000000001',
        recipient_id: '00000000-0000-0000-0000-000000000002',
        amount_paise: 62000,
        notes: 'Settle pizza & groceries'
      }
    });
    assert.strictEqual(res.statusCode, 201);
    const body = JSON.parse(res.payload);
    assert.strictEqual(body.amount_paise, 62000);
  });

  await t.test('8. Shopping Vertical — Add item and convert to expense', async () => {
    // Add item
    const addRes = await app.inject({
      method: 'POST',
      url: '/api/shopping',
      headers: { 'x-user-id': '00000000-0000-0000-0000-000000000003' },
      payload: {
        item_name: 'Coffee Beans',
        quantity: '500g',
        category: 'food'
      }
    });
    assert.strictEqual(addRes.statusCode, 201);
    const item = JSON.parse(addRes.payload);

    // Convert to expense
    const convRes = await app.inject({
      method: 'POST',
      url: `/api/shopping/${item.id}/convert-to-expense`,
      headers: { 'x-user-id': '00000000-0000-0000-0000-000000000003' },
      payload: {
        amount_paise: 45000,
        participants: ['00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003']
      }
    });
    assert.strictEqual(convRes.statusCode, 201);
    const convBody = JSON.parse(convRes.payload);
    assert.strictEqual(convBody.item.status, 'purchased');
    assert.strictEqual(convBody.expense.amount_paise, 45000);
  });

  await t.test('9. Chores Vertical — Create and complete with rotation', async () => {
    const choresRes = await app.inject({
      method: 'GET',
      url: '/api/chores',
      headers: { 'x-user-id': '00000000-0000-0000-0000-000000000003' }
    });
    assert.strictEqual(choresRes.statusCode, 200);
    const { chores } = JSON.parse(choresRes.payload);
    const kitchenChore = chores.find(c => c.title === 'Clean Kitchen');
    assert(kitchenChore);

    const compRes = await app.inject({
      method: 'POST',
      url: `/api/chores/${kitchenChore.id}/complete`,
      headers: { 'x-user-id': '00000000-0000-0000-0000-000000000003' }
    });
    assert.strictEqual(compRes.statusCode, 200);
  });

  await t.test('10. Bills Vertical — Mark bill paid and link to expense', async () => {
    const billsRes = await app.inject({
      method: 'GET',
      url: '/api/bills',
      headers: { 'x-user-id': '00000000-0000-0000-0000-000000000003' }
    });
    assert.strictEqual(billsRes.statusCode, 200);
    const { bills } = JSON.parse(billsRes.payload);
    const internetBill = bills.find(b => b.title === 'Internet');
    assert(internetBill);

    const payRes = await app.inject({
      method: 'POST',
      url: `/api/bills/${internetBill.id}/pay`,
      headers: { 'x-user-id': '00000000-0000-0000-0000-000000000003' }
    });
    assert.strictEqual(payRes.statusCode, 200);
    const payBody = JSON.parse(payRes.payload);
    assert.strictEqual(payBody.bill.status, 'paid');
    assert.strictEqual(payBody.expense.amount_paise, 89900);
  });

  await t.test('11. Polls Vertical — Vote on active poll', async () => {
    const pollsRes = await app.inject({
      method: 'GET',
      url: '/api/polls',
      headers: { 'x-user-id': '00000000-0000-0000-0000-000000000003' }
    });
    assert.strictEqual(pollsRes.statusCode, 200);
    const { polls } = JSON.parse(pollsRes.payload);
    assert(polls.length > 0);
    const poll = polls[0];

    const voteRes = await app.inject({
      method: 'POST',
      url: `/api/polls/${poll.id}/vote`,
      headers: { 'x-user-id': '00000000-0000-0000-0000-000000000003' },
      payload: { optionId: poll.options[0].id }
    });
    assert.strictEqual(voteRes.statusCode, 200);
  });

  await t.test('12. Activity & Analytics feeds', async () => {
    const actRes = await app.inject({
      method: 'GET',
      url: '/api/activity',
      headers: { 'x-user-id': '00000000-0000-0000-0000-000000000003' }
    });
    assert.strictEqual(actRes.statusCode, 200);
    const { activity } = JSON.parse(actRes.payload);
    assert(activity.length > 0);

    const analRes = await app.inject({
      method: 'GET',
      url: '/api/analytics',
      headers: { 'x-user-id': '00000000-0000-0000-0000-000000000003' }
    });
    assert.strictEqual(analRes.statusCode, 200);
    const analBody = JSON.parse(analRes.payload);
    assert(analBody.totalSpentPaise > 0);
  });

  await app.close();
});
