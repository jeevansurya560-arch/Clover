import { Server } from 'socket.io';
import { repository } from '../database/repository.js';
import { config } from '../config.js';

let ioInstance = null;

export function initSocket(server) {
  const io = new Server(server, {
    cors: {
      origin: config.corsOrigin,
      methods: ['GET', 'POST']
    }
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      let userId = socket.handshake.auth?.userId || socket.handshake.query?.userId;

      if (!userId && token) {
        const user = await repository.getProfile(token);
        if (user) userId = user.id;
      }

      if (!userId) {
        // Default to demo user if unspecified
        userId = '00000000-0000-0000-0000-000000000003';
      }

      const profile = await repository.getProfile(userId);
      if (!profile) return next(new Error('Authentication error: User not found'));

      socket.data.user = profile;
      next();
    } catch (err) {
      next(new Error('Socket authentication error: ' + err.message));
    }
  });

  io.on('connection', async (socket) => {
    const user = socket.data.user;
    console.log(`[Socket.IO] Connected: ${user.full_name} (${socket.id})`);

    // Handle joining household room after validating authorization
    socket.on('household:join', async (householdId, callback) => {
      try {
        const memberships = await repository.getUserMemberships(user.id);
        const isMember = memberships.some(m => m.household_id === householdId);

        if (!isMember) {
          if (callback) callback({ success: false, error: 'Unauthorized for this household' });
          return;
        }

        socket.join(`household:${householdId}`);
        console.log(`[Socket.IO] ${user.full_name} joined room household:${householdId}`);
        if (callback) callback({ success: true, room: `household:${householdId}` });
      } catch (err) {
        if (callback) callback({ success: false, error: err.message });
      }
    });

    socket.on('household:leave', (householdId) => {
      socket.leave(`household:${householdId}`);
      console.log(`[Socket.IO] ${user.full_name} left room household:${householdId}`);
    });

    socket.on('disconnect', () => {
      console.log(`[Socket.IO] Disconnected: ${user.full_name} (${socket.id})`);
    });
  });

  ioInstance = io;
  return io;
}

export function getIO() {
  return ioInstance;
}
