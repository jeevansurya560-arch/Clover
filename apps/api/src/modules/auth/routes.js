import jwt from 'jsonwebtoken';
import { repository } from '../../database/repository.js';
import { config } from '../../config.js';
import { authenticate } from '../../middleware/auth.js';

export async function authRoutes(fastify) {
  // Get current user profile and households
  fastify.get('/api/auth/me', { preHandler: [authenticate] }, async (request) => {
    const memberships = await repository.getUserMemberships(request.user.id);
    return {
      user: request.user,
      memberships
    };
  });

  // Switch demo user (Alex, Riya, Aman) for easy multi-user browser testing
  fastify.post('/api/auth/demo-switch', async (request, reply) => {
    const { userId } = request.body || {};
    const user = await repository.getProfile(userId);
    if (!user) return reply.code(404).send({ error: 'User not found' });

    const token = jwt.sign({ sub: user.id, email: user.email }, config.jwtSecret, { expiresIn: '7d' });
    const memberships = await repository.getUserMemberships(user.id);

    return {
      token,
      user,
      memberships
    };
  });

  // List all available profiles (for easy switching and assignment)
  fastify.get('/api/auth/profiles', async () => {
    const profiles = await repository.getAllProfiles();
    return { profiles };
  });
}
