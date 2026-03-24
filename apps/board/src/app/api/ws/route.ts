// WebSocket is handled via a custom Next.js server or via polling fallback.
// This route provides Server-Sent Events as a WebSocket-compatible alternative.
import { NextRequest } from 'next/server';
import { addClient, removeClient } from '@/lib/ws-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const clientId = Math.random().toString(36).slice(2);

      const send = (data: unknown) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {}
      };

      addClient(clientId, send);

      // Heartbeat
      const interval = setInterval(() => {
        try { controller.enqueue(encoder.encode(': heartbeat\n\n')); } catch { clearInterval(interval); }
      }, 30000);

      return () => {
        clearInterval(interval);
        removeClient(clientId);
      };
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
