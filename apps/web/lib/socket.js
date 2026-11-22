import { io } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4000';

let socket = null;

export function getSocket(userId = '00000000-0000-0000-0000-000000000003') {
  if (!socket) {
    socket = io(SOCKET_URL, {
      auth: { userId },
      reconnectionAttempts: 10,
      reconnectionDelay: 1000
    });

    socket.on('connect', () => {
      console.log('[Socket] Connected to RoomSync Realtime Server:', socket.id);
    });

    socket.on('disconnect', () => {
      console.log('[Socket] Disconnected from Realtime Server');
    });
  }
  return socket;
}
