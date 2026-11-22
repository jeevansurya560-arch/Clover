import assert from 'node:assert';
import test from 'node:test';
import {
  toPaise,
  toRupees,
  formatINR,
  calculateSplit,
  calculateBalances,
  calculateSettlementSuggestions,
  SPLIT_TYPES
} from '../../packages/shared/src/index.js';

test('Financial Calculations — Paise and Rupee Conversions', () => {
  assert.strictEqual(toPaise(1200), 120000);
  assert.strictEqual(toPaise('1,200.50'), 120050);
  assert.strictEqual(toRupees(120050), 1200.5);
  assert.strictEqual(formatINR(120000), '₹1,200');
  assert.strictEqual(formatINR(120050, true), '₹1,200.50');
  assert.strictEqual(formatINR(-62000), '-₹620');
});

test('Split Calculations — Equal Split with Exact Deterministic Remainder Allocation', () => {
  // ₹100 split 3 ways = 10,000 paise / 3 = 3333, 3333, 3334
  const split = calculateSplit({
    totalPaise: 10000,
    splitType: SPLIT_TYPES.EQUAL,
    participants: ['user_c', 'user_a', 'user_b'] // tests deterministic sorting
  });

  assert.strictEqual(split.length, 3);
  const sum = split.reduce((acc, s) => acc + s.sharePaise, 0);
  assert.strictEqual(sum, 10000, 'Sum of shares must equal total paise exactly');
  
  // Sorted order is user_a, user_b, user_c. Remainder 1 goes to user_a.
  assert.strictEqual(split[0].userId, 'user_a');
  assert.strictEqual(split[0].sharePaise, 3334);
  assert.strictEqual(split[1].sharePaise, 3333);
  assert.strictEqual(split[2].sharePaise, 3333);
});

test('Split Calculations — Custom Split', () => {
  const split = calculateSplit({
    totalPaise: 120000,
    splitType: SPLIT_TYPES.CUSTOM,
    participants: ['user_a', 'user_b'],
    customAmounts: {
      user_a: 70000,
      user_b: 50000
    }
  });

  const sum = split.reduce((acc, s) => acc + s.sharePaise, 0);
  assert.strictEqual(sum, 120000);
  assert.strictEqual(split.find(s => s.userId === 'user_a').sharePaise, 70000);
  assert.strictEqual(split.find(s => s.userId === 'user_b').sharePaise, 50000);
});

test('Split Calculations — Percentage Split with Rounding', () => {
  const split = calculateSplit({
    totalPaise: 10000,
    splitType: SPLIT_TYPES.PERCENTAGE,
    participants: ['user_a', 'user_b', 'user_c'],
    percentages: {
      user_a: 33.33,
      user_b: 33.33,
      user_c: 33.34
    }
  });

  const sum = split.reduce((acc, s) => acc + s.sharePaise, 0);
  assert.strictEqual(sum, 10000);
});

test('Split Calculations — Weighted Split', () => {
  const split = calculateSplit({
    totalPaise: 90000,
    splitType: SPLIT_TYPES.WEIGHTED,
    participants: ['user_a', 'user_b'],
    weights: {
      user_a: 2,
      user_b: 1
    }
  });

  const sum = split.reduce((acc, s) => acc + s.sharePaise, 0);
  assert.strictEqual(sum, 90000);
  assert.strictEqual(split.find(s => s.userId === 'user_a').sharePaise, 60000);
  assert.strictEqual(split.find(s => s.userId === 'user_b').sharePaise, 30000);
});

test('Balances & Settlement Suggestions — Household Invariant', () => {
  // Scenario matching RoomSync screenshot:
  // 3 Roommates: Aman, Riya, You
  // Aman paid ₹1,200 for Pizza Night (equal 3-way split: 400 each)
  // Riya paid ₹850 for Groceries (equal 3-way split: 283, 283, 284)
  // You paid ₹1,200 for Electricity (equal 3-way split: 400 each)
  const memberIds = ['aman', 'riya', 'you'];

  const expenses = [
    { id: 'exp_1', amount_paise: 120000, payer_id: 'aman', is_void: false },
    { id: 'exp_2', amount_paise: 85000, payer_id: 'riya', is_void: false },
    { id: 'exp_3', amount_paise: 120000, payer_id: 'you', is_void: false }
  ];

  const expenseShares = [
    // exp 1
    { expense_id: 'exp_1', user_id: 'aman', share_paise: 40000 },
    { expense_id: 'exp_1', user_id: 'riya', share_paise: 40000 },
    { expense_id: 'exp_1', user_id: 'you', share_paise: 40000 },
    // exp 2
    { expense_id: 'exp_2', user_id: 'aman', share_paise: 28334 },
    { expense_id: 'exp_2', user_id: 'riya', share_paise: 28333 },
    { expense_id: 'exp_2', user_id: 'you', share_paise: 28333 },
    // exp 3
    { expense_id: 'exp_3', user_id: 'aman', share_paise: 40000 },
    { expense_id: 'exp_3', user_id: 'riya', share_paise: 40000 },
    { expense_id: 'exp_3', user_id: 'you', share_paise: 40000 }
  ];

  const balances = calculateBalances({
    memberIds,
    expenses,
    expenseShares,
    settlements: []
  });

  // Verify net positions sum to 0
  const netSum = Object.values(balances).reduce((acc, b) => acc + b.netPaise, 0);
  assert.strictEqual(netSum, 0, 'Sum of all net positions must equal 0');

  // Verify settlement suggestions resolve all debts to 0
  const suggestions = calculateSettlementSuggestions(balances);
  assert(suggestions.length > 0);

  // Apply suggested settlements
  const simulatedSettlements = suggestions.map((s, idx) => ({
    id: `sim_${idx}`,
    sender_id: s.fromUserId,
    recipient_id: s.toUserId,
    amount_paise: s.amountPaise
  }));

  const postSettlementBalances = calculateBalances({
    memberIds,
    expenses,
    expenseShares,
    settlements: simulatedSettlements
  });

  for (const b of Object.values(postSettlementBalances)) {
    assert.strictEqual(b.netPaise, 0, `Member ${b.userId} balance must be 0 after settlement`);
  }
});
