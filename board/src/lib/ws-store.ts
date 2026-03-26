const WS_SERVER = process.env.WS_URL ?? 'http://localhost:4201';

/**
 * Broadcast an event to all connected WebSocket clients via the ws-server.
 * Fire-and-forget — never throws.
 */
export function broadcast(data: unknown) {
  fetch(`${WS_SERVER}/broadcast`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).catch(() => {});
}

// Legacy SSE client store — kept for compatibility, no longer used
export function addClient(_id: string, _send: (data: unknown) => void) {}
export function removeClient(_id: string) {}
