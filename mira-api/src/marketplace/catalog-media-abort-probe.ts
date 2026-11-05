/**
 * In-process probes for media GET abort evidence (isolated tests only).
 *
 * - Client disconnect / response close alone is NOT proof the storage read closed.
 * - Storage adapters call noteMediaStorageReadClosed only after the Body/stream
 *   emits a real `close` following an abort request (never on destroy() alone, never on EOF).
 * - Map is bounded (max entries + max age) and cleaned on take/clear.
 */

const MAX_ENTRIES = 64;
const MAX_AGE_MS = 5 * 60_000;

type AbortCloseRow = { at: string; mediaId: string; reason: 'abort'; ts: number };
type ClientRow = { at: string; mediaId: string; ts: number };

const storageAbortClosed = new Map<string, AbortCloseRow>();
const clientDisconnect = new Map<string, ClientRow>();
/** Abort requested for requestId but close not yet observed. */
const abortRequested = new Map<string, { mediaId: string; ts: number }>();

function pruneMaps() {
  const now = Date.now();
  for (const map of [storageAbortClosed, clientDisconnect, abortRequested] as const) {
    for (const [k, v] of map) {
      if (now - v.ts > MAX_AGE_MS) map.delete(k);
    }
  }
  while (storageAbortClosed.size > MAX_ENTRIES) {
    const oldest = storageAbortClosed.keys().next().value;
    if (oldest == null) break;
    storageAbortClosed.delete(oldest);
  }
  while (abortRequested.size > MAX_ENTRIES) {
    const oldest = abortRequested.keys().next().value;
    if (oldest == null) break;
    abortRequested.delete(oldest);
  }
  while (clientDisconnect.size > MAX_ENTRIES) {
    const oldest = clientDisconnect.keys().next().value;
    if (oldest == null) break;
    clientDisconnect.delete(oldest);
  }
}

/** Mark that abort was requested for this read — does NOT prove storage closed. */
export function noteMediaStorageAbortRequested(requestId: string, mediaId: string) {
  const id = String(requestId || '').trim();
  if (!id) return;
  abortRequested.set(id, { mediaId, ts: Date.now() });
  pruneMaps();
}

/**
 * Record that the storage Body/stream actually closed after an abort request.
 * Calling this without a prior abort request (or for EOF) is a no-op.
 */
export function noteMediaStorageReadClosed(requestId: string, mediaId: string, reason: 'abort' = 'abort') {
  const id = String(requestId || '').trim();
  if (!id || reason !== 'abort') return;
  if (!abortRequested.has(id)) {
    // EOF or close without abort request — do not treat as abort proof.
    return;
  }
  abortRequested.delete(id);
  storageAbortClosed.set(id, { at: new Date().toISOString(), mediaId, reason: 'abort', ts: Date.now() });
  pruneMaps();
}

/** Optional: client disconnected before response finished (does not prove storage closed). */
export function noteMediaClientDisconnect(requestId: string, mediaId: string) {
  const id = String(requestId || '').trim();
  if (!id) return;
  clientDisconnect.set(id, { at: new Date().toISOString(), mediaId, ts: Date.now() });
  pruneMaps();
}

/** @deprecated Prefer noteMediaStorageReadClosed — kept for transitional call sites. */
export function noteMediaUpstreamAbort(requestId: string, mediaId: string) {
  noteMediaClientDisconnect(requestId, mediaId);
}

export function mediaStorageAbortSeen(requestId: string): boolean {
  pruneMaps();
  return storageAbortClosed.has(String(requestId || '').trim());
}

export function mediaStorageAbortRequested(requestId: string): boolean {
  pruneMaps();
  return abortRequested.has(String(requestId || '').trim());
}

export function mediaUpstreamAbortSeen(requestId: string): boolean {
  return mediaStorageAbortSeen(requestId);
}

export function takeMediaUpstreamAbort(requestId: string) {
  const id = String(requestId || '').trim();
  const row = storageAbortClosed.get(id) || null;
  if (row) storageAbortClosed.delete(id);
  clientDisconnect.delete(id);
  abortRequested.delete(id);
  return row;
}

export function clearMediaUpstreamAborts() {
  storageAbortClosed.clear();
  clientDisconnect.clear();
  abortRequested.clear();
}

export function mediaAbortProbeSizes() {
  pruneMaps();
  return {
    closed: storageAbortClosed.size,
    requested: abortRequested.size,
    client: clientDisconnect.size,
    maxEntries: MAX_ENTRIES,
  };
}

/**
 * Wait until storage close is recorded for requestId, or timeout.
 * Does NOT invent success — polls mediaStorageAbortSeen only.
 */
export async function waitMediaStorageAbortClosed(
  requestId: string,
  timeoutMs = 2000,
  pollMs = 20,
): Promise<boolean> {
  const deadline = Date.now() + Math.max(1, timeoutMs);
  while (Date.now() < deadline) {
    if (mediaStorageAbortSeen(requestId)) return true;
    await new Promise((r) => setTimeout(r, pollMs));
  }
  return mediaStorageAbortSeen(requestId);
}
