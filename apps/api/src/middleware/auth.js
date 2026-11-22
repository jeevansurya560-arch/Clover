import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { repository } from '../database/repository.js';

/**
 * Authentication and Household Isolation Middleware
 */
export async function authenticate(request, reply) {
  try {
    const authHeader = request.headers.authorization;
    let userId = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        const decoded = jwt.verify(token, config.jwtSecret);
        userId = decoded.sub || decoded.userId;
      } catch {
        // If not a signed JWT, check if it's a direct user ID / dev token
        const profile = await repository.getProfile(token);
        if (profile) userId = profile.id;
      }
    }

    // Dev fallback header
    if (!userId && request.headers['x-user-id']) {
      userId = request.headers['x-user-id'];
    }

    // Default to "You (Alex)" if testing in local dev without explicit headers
    if (!userId) {
      userId = '00000000-0000-0000-0000-000000000003';
    }

    const user = await repository.getProfile(userId);
    if (!user) {
      return reply.code(401).send({ error: 'Unauthorized: User not found' });
    }

    request.user = user;
  } catch (err) {
    return reply.code(401).send({ error: 'Authentication failed', message: err.message });
  }
}

/**
 * Enforce Household Scoping & Membership Isolation
 */
export async function requireHouseholdMembership(request, reply) {
  const householdId = request.headers['x-household-id'] || request.params.householdId || request.query.householdId || request.body?.householdId;
  
  if (!householdId) {
    // If no specific household is requested, resolve the user's primary active household
    const memberships = await repository.getUserMemberships(request.user.id);
    if (memberships.length === 0) {
      return reply.code(403).send({ error: 'Forbidden: No active household memberships found for user' });
    }
    request.householdId = memberships[0].household_id;
    request.membership = memberships[0];
    return;
  }

  const memberships = await repository.getUserMemberships(request.user.id);
  const activeMem = memberships.find(m => m.household_id === householdId);

  if (!activeMem) {
    return reply.code(403).send({
      error: 'Forbidden: Household isolation violation. User is not an authorized member of this household.'
    });
  }

  request.householdId = householdId;
  request.membership = activeMem;
}
