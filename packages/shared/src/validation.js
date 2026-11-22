/**
 * Shared Request Validation Functions
 */

export function validateExpenseInput(data) {
  const errors = [];
  if (!data.description || typeof data.description !== 'string' || data.description.trim().length === 0) {
    errors.push('Description is required');
  }
  if (!data.amount_paise || !Number.isInteger(data.amount_paise) || data.amount_paise <= 0) {
    errors.push('Amount in paise must be a positive integer');
  }
  if (!data.payer_id || typeof data.payer_id !== 'string') {
    errors.push('Payer ID is required');
  }
  if (!Array.isArray(data.participants) || data.participants.length === 0) {
    errors.push('At least one participant is required');
  }
  return {
    isValid: errors.length === 0,
    errors
  };
}

export function validateSettlementInput(data) {
  const errors = [];
  if (!data.sender_id || typeof data.sender_id !== 'string') {
    errors.push('Sender ID is required');
  }
  if (!data.recipient_id || typeof data.recipient_id !== 'string') {
    errors.push('Recipient ID is required');
  }
  if (data.sender_id === data.recipient_id) {
    errors.push('Sender and recipient cannot be the same person');
  }
  if (!data.amount_paise || !Number.isInteger(data.amount_paise) || data.amount_paise <= 0) {
    errors.push('Amount in paise must be a positive integer');
  }
  return {
    isValid: errors.length === 0,
    errors
  };
}

export function validateShoppingItemInput(data) {
  const errors = [];
  if (!data.item_name || typeof data.item_name !== 'string' || data.item_name.trim().length === 0) {
    errors.push('Item name is required');
  }
  return {
    isValid: errors.length === 0,
    errors
  };
}

export function validateChoreInput(data) {
  const errors = [];
  if (!data.title || typeof data.title !== 'string' || data.title.trim().length === 0) {
    errors.push('Chore title is required');
  }
  return {
    isValid: errors.length === 0,
    errors
  };
}

export function validateBillInput(data) {
  const errors = [];
  if (!data.title || typeof data.title !== 'string' || data.title.trim().length === 0) {
    errors.push('Bill title is required');
  }
  if (!data.amount_paise || !Number.isInteger(data.amount_paise) || data.amount_paise <= 0) {
    errors.push('Bill amount must be a positive integer');
  }
  if (!data.due_date) {
    errors.push('Due date is required');
  }
  return {
    isValid: errors.length === 0,
    errors
  };
}

export function validatePollInput(data) {
  const errors = [];
  if (!data.question || typeof data.question !== 'string' || data.question.trim().length === 0) {
    errors.push('Poll question is required');
  }
  if (!Array.isArray(data.options) || data.options.length < 2) {
    errors.push('At least two options are required');
  }
  return {
    isValid: errors.length === 0,
    errors
  };
}
