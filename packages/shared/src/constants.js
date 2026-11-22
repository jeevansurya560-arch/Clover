/**
 * RoomSync Shared Domain Constants and Events
 */

export const CURRENCY = {
  CODE: 'INR',
  SYMBOL: '₹',
  PAISE_PER_RUPEE: 100
};

export const SPLIT_TYPES = {
  EQUAL: 'equal',
  CUSTOM: 'custom',
  PERCENTAGE: 'percentage',
  WEIGHTED: 'weighted'
};

export const EXPENSE_CATEGORIES = [
  { id: 'groceries', name: 'Groceries', icon: 'shopping-bag' },
  { id: 'utilities', name: 'Utilities', icon: 'zap' },
  { id: 'rent', name: 'Rent', icon: 'home' },
  { id: 'food', name: 'Food & Dining', icon: 'utensils' },
  { id: 'household', name: 'Household', icon: 'box' },
  { id: 'entertainment', name: 'Entertainment', icon: 'film' },
  { id: 'other', name: 'Other', icon: 'tag' }
];

export const CHORE_RECURRENCE = {
  NONE: 'none',
  DAILY: 'daily',
  WEEKLY: 'weekly',
  BIWEEKLY: 'biweekly',
  MONTHLY: 'monthly'
};

export const EVENT_TYPES = {
  EXPENSE_CREATED: 'expense:created',
  EXPENSE_UPDATED: 'expense:updated',
  EXPENSE_VOIDED: 'expense:voided',
  SETTLEMENT_RECORDED: 'settlement:recorded',
  SHOPPING_ITEM_ADDED: 'shopping:item_added',
  SHOPPING_ITEM_UPDATED: 'shopping:item_updated',
  SHOPPING_ITEM_DELETED: 'shopping:item_deleted',
  SHOPPING_CONVERTED: 'shopping:converted_to_expense',
  CHORE_CREATED: 'chore:created',
  CHORE_UPDATED: 'chore:updated',
  CHORE_COMPLETED: 'chore:completed',
  CHORE_ROTATED: 'chore:rotated',
  BILL_CREATED: 'bill:created',
  BILL_PAID: 'bill:paid',
  POLL_CREATED: 'poll:created',
  POLL_VOTED: 'poll:voted',
  POLL_CLOSED: 'poll:closed',
  MEMBER_INVITED: 'member:invited',
  MEMBER_JOINED: 'member:joined',
  MEMBER_REMOVED: 'member:removed',
  HOUSEHOLD_UPDATED: 'household:updated'
};

export const ROLES = {
  ADMIN: 'admin',
  MEMBER: 'member'
};
