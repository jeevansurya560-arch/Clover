/**
 * Financial Calculation Engine for RoomSync
 * 
 * Rules:
 * - Currency is INR (₹).
 * - All internal money representations are integer paise (1 Rupee = 100 paise).
 * - Exact server-side integer arithmetic, zero floating-point accumulation.
 * - Deterministic rounding: finalized shares must sum EXACTLY to the expense total.
 * - Authoritative balance rule:
 *     netPosition = amountPaid - expenseShares + settlementsSent - settlementsReceived
 * - Invariant: Sum of all member net positions in a household always totals 0.
 */

import { SPLIT_TYPES } from './constants.js';

/**
 * Convert Rupees to integer paise.
 * @param {number|string} rupees 
 * @returns {number} integer paise
 */
export function toPaise(rupees) {
  if (typeof rupees === 'string') {
    rupees = parseFloat(rupees.replace(/,/g, ''));
  }
  if (isNaN(rupees) || !isFinite(rupees)) {
    throw new Error('Invalid rupee amount');
  }
  return Math.round(rupees * 100);
}

/**
 * Convert integer paise to Rupees (decimal number).
 * @param {number} paise 
 * @returns {number} rupees
 */
export function toRupees(paise) {
  if (!Number.isInteger(paise)) {
    throw new Error(`Paise must be an integer, received: ${paise}`);
  }
  return paise / 100;
}

/**
 * Format integer paise into standard Indian Rupee string (e.g. ₹1,200.00 or ₹1,200).
 * @param {number} paise 
 * @param {boolean} includeDecimals
 * @returns {string} formatted INR
 */
export function formatINR(paise, includeDecimals = false) {
  if (typeof paise !== 'number' || isNaN(paise)) {
    return '₹0';
  }
  const isNegative = paise < 0;
  const absPaise = Math.abs(paise);
  const rupees = Math.floor(absPaise / 100);
  const remainderPaise = absPaise % 100;

  // Indian numbering format (e.g., 1,00,000)
  const rupeeString = rupees.toLocaleString('en-IN');
  const sign = isNegative ? '-' : '';

  if (includeDecimals || remainderPaise > 0) {
    const paiseStr = remainderPaise.toString().padStart(2, '0');
    return `${sign}₹${rupeeString}.${paiseStr}`;
  }
  return `${sign}₹${rupeeString}`;
}

/**
 * Calculate deterministic share amounts for an expense.
 * Guarantees that sum(shares) === totalPaise exactly.
 *
 * @param {Object} params
 * @param {number} params.totalPaise - Total expense in paise (positive integer)
 * @param {string} params.splitType - 'equal' | 'custom' | 'percentage' | 'weighted'
 * @param {Array<string>} params.participants - User IDs of participants
 * @param {Object} [params.customAmounts] - { [userId]: paise } for 'custom'
 * @param {Object} [params.percentages] - { [userId]: number } for 'percentage' (sum to 100)
 * @param {Object} [params.weights] - { [userId]: number } for 'weighted'
 * @returns {Array<{ userId: string, sharePaise: number }>}
 */
export function calculateSplit({
  totalPaise,
  splitType = SPLIT_TYPES.EQUAL,
  participants = [],
  customAmounts = {},
  percentages = {},
  weights = {}
}) {
  if (!Number.isInteger(totalPaise) || totalPaise <= 0) {
    throw new Error('Total paise must be a positive integer');
  }
  if (!Array.isArray(participants) || participants.length === 0) {
    throw new Error('At least one participant is required');
  }

  // Remove duplicates and sort deterministically
  const sortedParticipants = [...new Set(participants)].sort();
  const count = sortedParticipants.length;

  if (splitType === SPLIT_TYPES.EQUAL) {
    const baseShare = Math.floor(totalPaise / count);
    const remainder = totalPaise % count;

    // Distribute remainder 1 paise at a time to the first N participants
    return sortedParticipants.map((userId, idx) => ({
      userId,
      sharePaise: baseShare + (idx < remainder ? 1 : 0)
    }));
  }

  if (splitType === SPLIT_TYPES.CUSTOM) {
    let sum = 0;
    const shares = sortedParticipants.map(userId => {
      const share = customAmounts[userId] || 0;
      if (!Number.isInteger(share) || share < 0) {
        throw new Error(`Invalid custom share for user ${userId}: must be non-negative integer`);
      }
      sum += share;
      return { userId, sharePaise: share };
    });

    if (sum !== totalPaise) {
      throw new Error(`Custom shares sum (${sum} paise) does not match total expense (${totalPaise} paise)`);
    }
    return shares;
  }

  if (splitType === SPLIT_TYPES.PERCENTAGE) {
    let pctSum = 0;
    sortedParticipants.forEach(userId => {
      const pct = percentages[userId] || 0;
      if (pct < 0) throw new Error(`Negative percentage for user ${userId}`);
      pctSum += pct;
    });

    if (Math.abs(pctSum - 100) > 0.01) {
      throw new Error(`Percentages must sum to 100 (received ${pctSum})`);
    }

    // Allocate base shares
    let allocated = 0;
    const provisional = sortedParticipants.map(userId => {
      const pct = percentages[userId] || 0;
      const share = Math.floor((pct * totalPaise) / 100);
      allocated += share;
      return { userId, sharePaise: share };
    });

    // Remainder due to integer division
    const remainder = totalPaise - allocated;
    for (let i = 0; i < remainder; i++) {
      provisional[i % count].sharePaise += 1;
    }
    return provisional;
  }

  if (splitType === SPLIT_TYPES.WEIGHTED) {
    let totalWeight = 0;
    sortedParticipants.forEach(userId => {
      const w = weights[userId] ?? 1;
      if (w < 0) throw new Error(`Negative weight for user ${userId}`);
      totalWeight += w;
    });

    if (totalWeight <= 0) {
      throw new Error('Total weight must be positive');
    }

    let allocated = 0;
    const provisional = sortedParticipants.map(userId => {
      const w = weights[userId] ?? 1;
      const share = Math.floor((w * totalPaise) / totalWeight);
      allocated += share;
      return { userId, sharePaise: share };
    });

    const remainder = totalPaise - allocated;
    for (let i = 0; i < remainder; i++) {
      provisional[i % count].sharePaise += 1;
    }
    return provisional;
  }

  throw new Error(`Unknown split type: ${splitType}`);
}

/**
 * Calculate net balances for each member from authoritative records.
 * 
 * Formula:
 * netPosition = amountPaid - expenseShares + settlementsSent - settlementsReceived
 * 
 * If netPosition > 0: Member is owed money (creditor).
 * If netPosition < 0: Member owes money (debtor).
 * 
 * @param {Object} params
 * @param {Array<string>} params.memberIds
 * @param {Array<Object>} params.expenses - Active, non-voided expenses
 * @param {Array<Object>} params.expenseShares - Associated shares for expenses
 * @param {Array<Object>} params.settlements - Recorded settlements
 * @returns {Object} { [userId]: { netPaise, totalPaidPaise, totalSharePaise, totalSettledSentPaise, totalSettledReceivedPaise } }
 */
export function calculateBalances({
  memberIds = [],
  expenses = [],
  expenseShares = [],
  settlements = []
}) {
  const balances = {};

  // Initialize for all members
  for (const id of memberIds) {
    balances[id] = {
      userId: id,
      netPaise: 0,
      totalPaidPaise: 0,
      totalSharePaise: 0,
      totalSettledSentPaise: 0,
      totalSettledReceivedPaise: 0
    };
  }

  // 1. Credit payers
  for (const exp of expenses) {
    if (exp.is_void) continue;
    const payerId = exp.payer_id;
    if (balances[payerId]) {
      balances[payerId].totalPaidPaise += exp.amount_paise;
    } else {
      balances[payerId] = {
        userId: payerId,
        netPaise: 0,
        totalPaidPaise: exp.amount_paise,
        totalSharePaise: 0,
        totalSettledSentPaise: 0,
        totalSettledReceivedPaise: 0
      };
    }
  }

  // 2. Debit shares
  for (const share of expenseShares) {
    const userId = share.user_id;
    if (balances[userId]) {
      balances[userId].totalSharePaise += share.share_paise;
    } else {
      balances[userId] = {
        userId,
        netPaise: 0,
        totalPaidPaise: 0,
        totalSharePaise: share.share_paise,
        totalSettledSentPaise: 0,
        totalSettledReceivedPaise: 0
      };
    }
  }

  // 3. Apply settlements
  for (const set of settlements) {
    const senderId = set.sender_id;
    const recipientId = set.recipient_id;

    if (balances[senderId]) {
      balances[senderId].totalSettledSentPaise += set.amount_paise;
    }
    if (balances[recipientId]) {
      balances[recipientId].totalSettledReceivedPaise += set.amount_paise;
    }
  }

  // 4. Compute net position
  let totalHouseholdNet = 0;
  for (const id of Object.keys(balances)) {
    const b = balances[id];
    b.netPaise = (b.totalPaidPaise - b.totalSharePaise) + (b.totalSettledSentPaise - b.totalSettledReceivedPaise);
    totalHouseholdNet += b.netPaise;
  }

  if (totalHouseholdNet !== 0) {
    throw new Error(`Household net balances do not sum to 0 (drift: ${totalHouseholdNet} paise)`);
  }

  return balances;
}

/**
 * Calculate greedy debt-simplification settlement suggestions.
 * Pairs largest debtor with largest creditor to minimize transactions.
 * 
 * @param {Object} balances - Output from calculateBalances
 * @returns {Array<{ fromUserId: string, toUserId: string, amountPaise: number }>}
 */
export function calculateSettlementSuggestions(balances) {
  const debtors = [];   // netPaise < 0 (owes money)
  const creditors = []; // netPaise > 0 (owed money)

  for (const b of Object.values(balances)) {
    if (b.netPaise < 0) {
      debtors.push({ userId: b.userId, amount: Math.abs(b.netPaise) });
    } else if (b.netPaise > 0) {
      creditors.push({ userId: b.userId, amount: b.netPaise });
    }
  }

  // Sort descending by amount
  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  const suggestions = [];
  let dIdx = 0;
  let cIdx = 0;

  while (dIdx < debtors.length && cIdx < creditors.length) {
    const debtor = debtors[dIdx];
    const creditor = creditors[cIdx];

    const transferAmount = Math.min(debtor.amount, creditor.amount);

    if (transferAmount > 0) {
      suggestions.push({
        fromUserId: debtor.userId,
        toUserId: creditor.userId,
        amountPaise: transferAmount
      });
    }

    debtor.amount -= transferAmount;
    creditor.amount -= transferAmount;

    if (debtor.amount === 0) dIdx++;
    if (creditor.amount === 0) cIdx++;
  }

  return suggestions;
}
