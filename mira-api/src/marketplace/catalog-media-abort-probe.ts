/**
 * In-process probe for media GET abort evidence (isolated tests only).
 * Keyed by x-mira-media-req request id from the controller.
 */
const upstreamClosed = new Map<string, { at: string; mediaId: string }>();

export function noteMediaUpstreamAbort(requestId: string, mediaId: string) {
  const id = String(requestId || '').trim();
  if (!id) return;
  upstreamClosed.set(id, { at: new Date().toISOString(), mediaId });
}

export function mediaUpstreamAbortSeen(requestId: string): boolean {
  return upstreamClosed.has(String(requestId || '').trim());
}

export function takeMediaUpstreamAbort(requestId: string) {
  const id = String(requestId || '').trim();
  const row = upstreamClosed.get(id) || null;
  if (row) upstreamClosed.delete(id);
  return row;
}

export function clearMediaUpstreamAborts() {
  upstreamClosed.clear();
}
