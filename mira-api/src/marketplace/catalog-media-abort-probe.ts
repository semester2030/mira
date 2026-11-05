/**
 * In-process probes for media GET abort evidence (isolated tests only).
 *
 * - Client disconnect / response close alone is NOT proof the storage read closed.
 * - Storage adapters call noteMediaStorageReadClosed when the GetObject/body is
 *   destroyed because of abort (never on natural EOF).
 */
const storageAbortClosed = new Map<string, { at: string; mediaId: string; reason: 'abort' }>();
const clientDisconnect = new Map<string, { at: string; mediaId: string }>();

/** Bound to the storage Body/GetObject abort path — not response `close` alone. */
export function noteMediaStorageReadClosed(requestId: string, mediaId: string, reason: 'abort' = 'abort') {
  const id = String(requestId || '').trim();
  if (!id || reason !== 'abort') return;
  storageAbortClosed.set(id, { at: new Date().toISOString(), mediaId, reason: 'abort' });
}

/** Optional: client disconnected before response finished (does not prove storage closed). */
export function noteMediaClientDisconnect(requestId: string, mediaId: string) {
  const id = String(requestId || '').trim();
  if (!id) return;
  clientDisconnect.set(id, { at: new Date().toISOString(), mediaId });
}

/** @deprecated Prefer noteMediaStorageReadClosed — kept for transitional call sites. */
export function noteMediaUpstreamAbort(requestId: string, mediaId: string) {
  // Do NOT treat as storage proof. Record client disconnect only.
  noteMediaClientDisconnect(requestId, mediaId);
}

export function mediaStorageAbortSeen(requestId: string): boolean {
  return storageAbortClosed.has(String(requestId || '').trim());
}

export function mediaUpstreamAbortSeen(requestId: string): boolean {
  // Authoritative: storage body closed due to abort.
  return mediaStorageAbortSeen(requestId);
}

export function takeMediaUpstreamAbort(requestId: string) {
  const id = String(requestId || '').trim();
  const row = storageAbortClosed.get(id) || null;
  if (row) storageAbortClosed.delete(id);
  clientDisconnect.delete(id);
  return row;
}

export function clearMediaUpstreamAborts() {
  storageAbortClosed.clear();
  clientDisconnect.clear();
}
