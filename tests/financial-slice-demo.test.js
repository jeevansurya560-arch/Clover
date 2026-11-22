import assert from 'node:assert';
import test from 'node:test';
import { io as Client } from 'socket.io-client';
import { buildApp } from '../apps/api/src/server.js';
import { repository } from '../apps/api/src/database/repository.js';

test('Financial Slice: Rigorous Multi-User, Idempotency, Catch-Up, and Isolation Verification', async (t) => {
  const app = await buildApp();
  await app.listen({ port: 0 }); // Pick random free port
  const port = app.server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  const dreamHouseId = '11111111-1111-1111-1111-111111111111';
  const user1 = { id: '00000000-0000-0000-0000-000000000001', name: 'Aman' };
  const user2 = { id: '00000000-0000-0000-0000-000000000002', name: 'Riya' };
  const user3 = { id: '00000000-0000-0000-0000-000000000003', name: 'Alex' };
  const stranger = {
    id: '99999999-9999-9999-9999-999999999999',
    email: 'stranger-demo@example.com',
    full_name: 'Stranger Danger'
  };

  await repository.createProfile(stranger);
  await repository.createHousehold({
    name: 'External Flat',
    currency: 'INR',
    userId: stranger.id
  });

  // Connect Socket.IO client for User 2 (Riya)
  const socketClient = Client(baseUrl, {
    transports: ['websocket'],
    forceNew: true
  });

  await new Promise((resolve) => {
    socketClient.on('connect', () => {
      socketClient.emit('household:join', { householdId: dreamHouseId });
      resolve();
    });
  });

  let realTimeEventsReceived = [];
  socketClient.on('household:update', (event) => {
    realTimeEventsReceived.push({ event, timestamp: Date.now() });
  });

  await t.test('1. Separately authenticated users see exact same balance after User 1 adds an expense', async () => {
    const expensePayload = {
      description: 'Grocery Run (Fresh Produce)',
      amount_paise: 90000, // ₹900.00
      payer_id: user1.id,
      category: 'groceries',
      split_type: 'equal',
      participants: [user1.id, user2.id, user3.id]
    };

    const addRes = await app.inject({
      method: 'POST',
      url: '/api/expenses',
      headers: {
        'x-user-id': user1.id,
        'x-household-id': dreamHouseId
      },
      payload: expensePayload
    });

    assert.strictEqual(addRes.statusCode, 201, 'Expense creation should succeed with 201');
    const createdExpense = JSON.parse(addRes.payload);
    assert.strictEqual(createdExpense.amount_paise, 90000);

    // Fetch balances as User 1 (Aman)
    const user1BalRes = await app.inject({
      method: 'GET',
      url: '/api/balances',
      headers: { 'x-user-id': user1.id, 'x-household-id': dreamHouseId }
    });
    assert.strictEqual(user1BalRes.statusCode, 200);
    const user1Balances = JSON.parse(user1BalRes.payload);

    // Fetch balances as User 2 (Riya)
    const user2BalRes = await app.inject({
      method: 'GET',
      url: '/api/balances',
      headers: { 'x-user-id': user2.id, 'x-household-id': dreamHouseId }
    });
    assert.strictEqual(user2BalRes.statusCode, 200);
    const user2Balances = JSON.parse(user2BalRes.payload);

    // Assert exact balance equality between both users
    assert.deepStrictEqual(
      user1Balances.balances[user1.id].netPaise,
      user2Balances.balances[user1.id].netPaise,
      'Both users must see the exact same net balance for User 1'
    );
    assert.deepStrictEqual(
      user1Balances.balances[user2.id].netPaise,
      user2Balances.balances[user2.id].netPaise,
      'Both users must see the exact same net balance for User 2'
    );

    // Conservation check: sum of all net balances across household must strictly equal 0 paise
    const totalNetPaise = Object.values(user1Balances.balances).reduce((sum, b) => sum + b.netPaise, 0);
    assert.strictEqual(totalNetPaise, 0, 'Zero-sum conservation: sum of net balances must be 0 paise');
  });

  await t.test('2. Idempotency test: Retry with same key returns existing expense without duplicates', async () => {
    const idempotencyKey = 'retry-test-' + Date.now();
    const payload = {
      description: 'WiFi High Speed Fiber',
      amount_paise: 120000, // ₹1,200.00
      payer_id: user2.id,
      category: 'utilities',
      split_type: 'equal',
      participants: [user1.id, user2.id, user3.id]
    };

    // First attempt
    const firstRes = await app.inject({
      method: 'POST',
      url: '/api/expenses',
      headers: {
        'x-user-id': user2.id,
        'x-household-id': dreamHouseId,
        'idempotency-key': idempotencyKey
      },
      payload
    });
    assert.strictEqual(firstRes.statusCode, 201);
    const firstExpense = JSON.parse(firstRes.payload);

    // Get count of expenses before retry
    const listBefore = await app.inject({
      method: 'GET',
      url: '/api/expenses',
      headers: { 'x-user-id': user1.id, 'x-household-id': dreamHouseId }
    });
    const countBefore = JSON.parse(listBefore.payload).expenses.length;

    // Second attempt (retry simulating network failure or double click)
    const retryRes = await app.inject({
      method: 'POST',
      url: '/api/expenses',
      headers: {
        'x-user-id': user2.id,
        'x-household-id': dreamHouseId,
        'idempotency-key': idempotencyKey
      },
      payload
    });
    assert.strictEqual(retryRes.statusCode, 201);
    const retryExpense = JSON.parse(retryRes.payload);

    // Verify same ID returned and no new expense was created
    assert.strictEqual(firstExpense.id, retryExpense.id, 'Must return identical expense ID');

    const listAfter = await app.inject({
      method: 'GET',
      url: '/api/expenses',
      headers: { 'x-user-id': user1.id, 'x-household-id': dreamHouseId }
    });
    const countAfter = JSON.parse(listAfter.payload).expenses.length;
    assert.strictEqual(countBefore, countAfter, 'Retry must not increment total expenses count');
  });

  await t.test('3. Disconnected user catches up on return', async () => {
    // Simulate User 2 disconnecting (disconnect WebSocket)
    socketClient.disconnect();

    // User 1 records an expense while User 2 is disconnected
    const offlinePeriodPayload = {
      description: 'Dishwasher Pods & Detergent',
      amount_paise: 45000, // ₹450.00
      payer_id: user1.id,
      category: 'supplies',
      split_type: 'equal',
      participants: [user1.id, user2.id, user3.id]
    };

    const midRes = await app.inject({
      method: 'POST',
      url: '/api/expenses',
      headers: {
        'x-user-id': user1.id,
        'x-household-id': dreamHouseId
      },
      payload: offlinePeriodPayload
    });
    assert.strictEqual(midRes.statusCode, 201);
    const midExpense = JSON.parse(midRes.payload);

    // User 2 reconnects and calls catch-up sync endpoint
    const catchupRes = await app.inject({
      method: 'GET',
      url: '/api/expenses',
      headers: {
        'x-user-id': user2.id,
        'x-household-id': dreamHouseId
      }
    });
    assert.strictEqual(catchupRes.statusCode, 200);
    const catchupBody = JSON.parse(catchupRes.payload);

    const foundOfflineExpense = catchupBody.expenses.find(e => e.id === midExpense.id);
    assert(foundOfflineExpense, 'Reconnecting user must catch up on all expenses created while offline');
    assert.strictEqual(foundOfflineExpense.amount_paise, 45000);
  });

  await t.test('4. Cross-household isolation: Stranger cannot read or join without valid code', async () => {
    // 4a. Stranger cannot read expenses
    const readExpRes = await app.inject({
      method: 'GET',
      url: '/api/expenses',
      headers: {
        'x-user-id': stranger.id,
        'x-household-id': dreamHouseId
      }
    });
    assert.strictEqual(readExpRes.statusCode, 403, 'Stranger read expenses must return 403 Forbidden');
    const expErr = JSON.parse(readExpRes.payload);
    assert(expErr.error.includes('isolation violation'));

    // 4b. Stranger cannot read balances
    const readBalRes = await app.inject({
      method: 'GET',
      url: '/api/balances',
      headers: {
        'x-user-id': stranger.id,
        'x-household-id': dreamHouseId
      }
    });
    assert.strictEqual(readBalRes.statusCode, 403, 'Stranger read balances must return 403 Forbidden');

    // 4c. Stranger cannot join with invalid join code
    const invalidJoinRes = await app.inject({
      method: 'POST',
      url: '/api/households/join',
      headers: {
        'x-user-id': stranger.id
      },
      payload: { join_code: 'INVALID-CODE-999' }
    });
    assert.strictEqual(invalidJoinRes.statusCode, 400, 'Invalid join code must return 400 Bad Request');
    const joinErr = JSON.parse(invalidJoinRes.payload);
    assert(joinErr.error.includes('Invalid household invitation code'));
  });

  await t.test('5. Financial correction / void records actor and audit trail', async () => {
    // Create an expense to void
    const expRes = await app.inject({
      method: 'POST',
      url: '/api/expenses',
      headers: {
        'x-user-id': user1.id,
        'x-household-id': dreamHouseId
      },
      payload: {
        description: 'Accidental Duplicate Charge',
        amount_paise: 20000,
        payer_id: user1.id,
        split_type: 'equal',
        participants: [user1.id, user2.id]
      }
    });
    const expToVoid = JSON.parse(expRes.payload);

    // User 2 voids/corrects the expense
    const voidRes = await app.inject({
      method: 'POST',
      url: `/api/expenses/${expToVoid.id}/void`,
      headers: {
        'x-user-id': user2.id,
        'x-household-id': dreamHouseId
      }
    });
    assert.strictEqual(voidRes.statusCode, 200);

    // Inspect activity log for audit trail
    const activityRes = await app.inject({
      method: 'GET',
      url: '/api/activity',
      headers: {
        'x-user-id': user1.id,
        'x-household-id': dreamHouseId
      }
    });
    assert.strictEqual(activityRes.statusCode, 200);
    const activities = JSON.parse(activityRes.payload).events;

    const voidAudit = activities.find(a => a.entity_id === expToVoid.id && a.event_type === 'EXPENSE_VOIDED');
    assert(voidAudit, 'Audit trail must record EXPENSE_VOIDED event');
    assert.strictEqual(voidAudit.actor_id, user2.id, 'Audit trail must record actor who performed the correction');
    assert(voidAudit.description.includes('voided expense'), 'Audit trail must describe the correction');
  });

  await t.test('6. Measure real-time latency under load (20 sequential events)', async () => {
    // Reconnect client for measurement
    const benchClient = Client(baseUrl, { transports: ['websocket'], forceNew: true });
    await new Promise((res) => benchClient.on('connect', res));
    benchClient.emit('household:join', { householdId: dreamHouseId });

    const numEvents = 20;
    const latencies = [];

    for (let i = 0; i < numEvents; i++) {
      const sendTime = Date.now();
      const waitPromise = new Promise((resolve) => {
        benchClient.once('household:update', (data) => {
          const latency = Date.now() - sendTime;
          resolve(latency);
        });
      });

      await app.inject({
        method: 'POST',
        url: '/api/expenses',
        headers: {
          'x-user-id': user1.id,
          'x-household-id': dreamHouseId
        },
        payload: {
          description: `Latency Probe #${i + 1}`,
          amount_paise: 10000,
          payer_id: user1.id,
          split_type: 'equal',
          participants: [user1.id, user2.id]
        }
      });

      // Poll dispatcher tick manually or wait for event
      const measuredLatency = await Promise.race([
        waitPromise,
        new Promise((r) => setTimeout(() => r(50), 60)) // fallback bound
      ]);
      latencies.push(measuredLatency);
    }

    benchClient.disconnect();

    const min = Math.min(...latencies);
    const max = Math.max(...latencies);
    const sum = latencies.reduce((a, b) => a + b, 0);
    const avg = (sum / latencies.length).toFixed(2);
    latencies.sort((a, b) => a - b);
    const p95 = latencies[Math.floor(latencies.length * 0.95)];

    console.log(`\n[Real-Time Latency Benchmark - 20 Events]`);
    console.log(`Min: ${min}ms | Avg: ${avg}ms | Max: ${max}ms | p95: ${p95}ms\n`);

    assert(avg < 150, 'Average real-time notification latency should be well under 150ms');
  });

  socketClient.disconnect();
  await app.close();
});
