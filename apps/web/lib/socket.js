import { io } from 'socket.io-client';

const RAW_SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || '';

let socketInstance = null;

class CloudflareWebSocketAdapter {
  constructor(url, userId) {
    this.url = url;
    this.userId = userId;
    this.listeners = new Map();
    this.ws = null;
    this.connected = false;
    this.reconnectTimer = null;
    this.connect();
  }

  connect() {
    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this.connected = true;
        console.log('[Realtime] Connected to Cloudflare Durable Objects WebSocket');
        this.emitListeners('connect', { status: 'connected' });
      };

      this.ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          const eventType = payload.type || payload.event;
          const data = payload.data || payload.payload || payload;
          if (eventType) {
            this.emitListeners(eventType, data);
          }
        } catch {
          // Ignore parse errors
        }
      };

      this.ws.onclose = () => {
        this.connected = false;
        console.log('[Realtime] Disconnected from Cloudflare WebSocket. Reconnecting in 2s...');
        this.emitListeners('disconnect', {});
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = setTimeout(() => this.connect(), 2000);
      };

      this.ws.onerror = (err) => {
        console.warn('[Realtime Error]', err);
      };
    } catch (err) {
      console.warn('[Realtime Init Warning]', err.message);
    }
  }

  on(event, handler) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(handler);
    return this;
  }

  off(event, handler) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(handler);
    }
    return this;
  }

  emit(event, data, ackCallback) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: event, data }));
      if (typeof ackCallback === 'function') {
        ackCallback({ success: true });
      }
    }
    return this;
  }

  emitListeners(event, data) {
    const handlers = this.listeners.get(event);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(data);
        } catch (err) {
          console.error(`[Realtime Handler Error: ${event}]`, err);
        }
      }
    }
  }
}

/**
 * Universal Real-Time Client Factory
 * Seamlessly selects Cloudflare Durable Objects WebSockets in production/serverless,
 * or Socket.IO client when running against local Fastify server.
 */
export function getSocket(userId = '00000000-0000-0000-0000-000000000003') {
  if (socketInstance) return socketInstance;

  const isBrowser = typeof window !== 'undefined';
  const targetUrl = RAW_SOCKET_URL || (isBrowser ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}` : 'http://localhost:4000');

  const isCloudflareWebSocket = targetUrl.startsWith('ws://') || targetUrl.startsWith('wss://') || (!RAW_SOCKET_URL && isBrowser);

  if (isCloudflareWebSocket && isBrowser) {
    const wsUrl = `${targetUrl.replace(/^http/, 'ws')}/realtime?userId=${encodeURIComponent(userId)}`;
    socketInstance = new CloudflareWebSocketAdapter(wsUrl, userId);
  } else {
    // Local / Node Socket.IO fallback
    socketInstance = io(targetUrl || 'http://localhost:4000', {
      auth: { userId },
      reconnectionAttempts: 10,
      reconnectionDelay: 1000
    });

    socketInstance.on('connect', () => {
      console.log('[Socket.IO] Connected to Local Realtime Server:', socketInstance.id);
    });

    socketInstance.on('disconnect', () => {
      console.log('[Socket.IO] Disconnected from Local Realtime Server');
    });
  }

  return socketInstance;
}
