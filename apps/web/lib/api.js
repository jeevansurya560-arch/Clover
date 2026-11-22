const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export async function fetchApi(endpoint, { method = 'GET', body, headers = {}, userId, householdId } = {}) {
  const finalHeaders = {
    'Content-Type': 'application/json',
    ...headers
  };

  if (userId) {
    finalHeaders['x-user-id'] = userId;
  }
  if (householdId) {
    finalHeaders['x-household-id'] = householdId;
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    method,
    headers: finalHeaders,
    body: body ? JSON.stringify(body) : undefined
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || `HTTP error ${res.status}`);
  }

  return data;
}
