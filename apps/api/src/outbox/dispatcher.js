import { repository } from '../database/repository.js';
import { getIO } from '../realtime/socket.js';

let intervalHandle = null;

/**
 * Background Outbox Event Dispatcher
 * Polls uncommitted outbox events and pushes them to authorized Socket.IO rooms.
 */
export function startOutboxDispatcher() {
  if (intervalHandle) return;

  intervalHandle = setInterval(async () => {
    try {
      const io = getIO();
      if (!io) return;

      const pendingEvents = await repository.getPendingOutbox();
      for (const event of pendingEvents) {
        const roomName = `household:${event.household_id}`;
        
        // Broadcast event to connected household roommates
        io.to(roomName).emit(event.event_type, {
          id: event.id,
          householdId: event.household_id,
          eventType: event.event_type,
          payload: event.payload,
          timestamp: event.created_at
        });

        await repository.markOutboxDelivered(event.id);
      }
    } catch (err) {
      console.error('[Outbox Dispatcher Error]', err.message);
    }
  }, 1000);
}

export function stopOutboxDispatcher() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}
