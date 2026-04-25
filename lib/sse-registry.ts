// In-memory SSE client registry. In serverless deployments each instance has
// its own map; for single-server deployments this works across requests.
type SendFn = (data: string) => void;

const clients = new Map<string, Set<SendFn>>();

export function registerSseClient(artistId: string, send: SendFn): () => void {
  if (!clients.has(artistId)) clients.set(artistId, new Set());
  clients.get(artistId)!.add(send);

  return () => {
    const set = clients.get(artistId);
    if (!set) return;
    set.delete(send);
    if (set.size === 0) clients.delete(artistId);
  };
}

export function pushSseEvent(artistId: string, payload: Record<string, unknown>): void {
  const set = clients.get(artistId);
  if (!set || set.size === 0) return;
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  for (const send of set) {
    try { send(data); } catch { /* connection already closed */ }
  }
}
