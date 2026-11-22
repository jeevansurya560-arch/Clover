import assert from 'node:assert';
import test from 'node:test';
import { buildApp } from '../../apps/api/src/server.js';
import { repository } from '../../apps/api/src/database/repository.js';

test('Security & Multi-Tenant Household Isolation Tests', async (t) => {
  const app = await buildApp();

  // Create an isolated second household ("Apartment 404") with an unrelated user ("stranger")
  const stranger = {
    id: '99999999-9999-9999-9999-999999999999',
    email: 'stranger@example.com',
    full_name: 'Stranger Danger',
    avatar_url: 'avatar-stranger'
  };
  // Register stranger in repository
  await repository.createProfile(stranger);
  await repository.createHousehold({
    name: 'Apartment 404',
    currency: 'INR',
    userId: stranger.id
  });

  await t.test('1. Unauthorized request with unknown user is rejected', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/households/current',
      headers: { 'x-user-id': '00000000-9999-9999-9999-000000000000' }
    });
    assert.strictEqual(res.statusCode, 401);
  });

  await t.test('2. Stranger cannot access DreamHouse expenses (Household Isolation)', async () => {
    const dreamHouseId = '11111111-1111-1111-1111-111111111111';
    const res = await app.inject({
      method: 'GET',
      url: '/api/expenses',
      headers: {
        'x-user-id': stranger.id,
        'x-household-id': dreamHouseId
      }
    });
    assert.strictEqual(res.statusCode, 403);
    const body = JSON.parse(res.payload);
    assert(body.error.includes('isolation violation'));
  });

  await t.test('3. Stranger cannot access DreamHouse balances or financial records', async () => {
    const dreamHouseId = '11111111-1111-1111-1111-111111111111';
    const res = await app.inject({
      method: 'GET',
      url: '/api/balances',
      headers: {
        'x-user-id': stranger.id,
        'x-household-id': dreamHouseId
      }
    });
    assert.strictEqual(res.statusCode, 403);
  });

  await t.test('4. Idempotency Key prevents duplicate expense submissions', async () => {
    const idempotencyKey = 'unique-key-test-' + Date.now();
    const payload = {
      description: 'Idempotency Grocery Test',
      amount_paise: 50000,
      payer_id: '00000000-0000-0000-0000-000000000003',
      category: 'groceries',
      split_type: 'equal',
      participants: ['00000000-0000-0000-0000-000000000003']
    };

    const firstRes = await app.inject({
      method: 'POST',
      url: '/api/expenses',
      headers: {
        'x-user-id': '00000000-0000-0000-0000-000000000003',
        'idempotency-key': idempotencyKey
      },
      payload
    });
    assert.strictEqual(firstRes.statusCode, 201);
    const firstBody = JSON.parse(firstRes.payload);

    // Second call with same idempotency key
    const secondRes = await app.inject({
      method: 'POST',
      url: '/api/expenses',
      headers: {
        'x-user-id': '00000000-0000-0000-0000-000000000003',
        'idempotency-key': idempotencyKey
      },
      payload
    });
    assert.strictEqual(secondRes.statusCode, 201);
    const secondBody = JSON.parse(secondRes.payload);

    assert.strictEqual(firstBody.id, secondBody.id, 'Idempotency key must return existing expense without duplication');
  });

  await app.close();
});
