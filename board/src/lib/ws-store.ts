type SendFn = (data: unknown) => void;

const clients = new Map<string, SendFn>();

export function addClient(id: string, send: SendFn) {
  clients.set(id, send);
}

export function removeClient(id: string) {
  clients.delete(id);
}

export function broadcast(data: unknown) {
  for (const send of clients.values()) {
    try { send(data); } catch {}
  }
}
