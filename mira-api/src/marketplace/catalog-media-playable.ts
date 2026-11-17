/**
 * Hide only media IDs proven broken by live Range probe + storage-key audit.
 * Do NOT judge playability from UUID key shape — legacy UUID keys may still resolve.
 *
 * Source: admin/store-readiness/evidence/media-404-mapping.json (2026-11-15).
 */
export const PROVEN_BROKEN_CATALOG_MEDIA_IDS: ReadonlySet<string> = new Set([
  '7fbf6a79-abe2-4fc5-8400-230059928d5b',
  '7df5abb5-b5f1-4132-abc9-5b76928f180b',
  'fe6cc966-07fd-484a-a742-ac9176c90b06',
  '97e4706e-77a3-48f3-aa20-1c4be244ba01',
  '0daf602c-98b2-46d5-9148-182b9780b868',
  '0eb8d0e0-3991-4a2a-a435-81642baa7b79',
  // Live Range probe 2026-11-16: 2267-byte stub; mid-range 416; black frame on device.
  '94d514e3-99bf-4c5f-b517-fe4178aacb0f',
  // Live Range probe 2026-11-17: same 2267-byte QT stub (Content-Range 0-2047/2267).
  // Owned by product 9b8edf30; appeared in Discover feed after wedding-dress stall.
  '37dbc44c-0057-4ed2-b1e7-3c4c37f92e5c',
  'a9a871ca-df82-482e-b4b8-3ab7eab7e412',
  'ff222451-9e16-4a84-8f1f-974adf34f7ee',
  '38f83110-07ae-450e-9299-04ed12bf61f1',
  'ea3ba1cd-0618-41f3-90aa-5f85b1ad265b',
  '1a2614ae-63f8-448a-b1a6-92d8cc2600fe',
]);

/** True unless this mediaId was proven broken in the audited probe set. */
export function isCatalogMediaAllowedInFeed(
  mediaId: string | null | undefined,
  extraHiddenIds?: ReadonlySet<string> | Iterable<string>,
): boolean {
  if (!mediaId || typeof mediaId !== 'string' || !mediaId.trim()) return false;
  if (PROVEN_BROKEN_CATALOG_MEDIA_IDS.has(mediaId)) return false;
  if (extraHiddenIds) {
    const set =
      extraHiddenIds instanceof Set ? extraHiddenIds : new Set(extraHiddenIds);
    if (set.has(mediaId)) return false;
  }
  return true;
}

/**
 * @deprecated Prefer [isCatalogMediaAllowedInFeed]. UUID-shaped keys stay allowed.
 * Empty/null keys are not playable.
 */
export function isPlayableCatalogStorageKey(storageKey: string | null | undefined): boolean {
  if (!storageKey || typeof storageKey !== 'string') return false;
  return storageKey.trim().length > 0;
}

export function filterPlayableCatalogMedia<
  T extends { id?: string; storageKey?: string | null },
>(rows: T[], extraHiddenIds?: ReadonlySet<string> | Iterable<string>): T[] {
  return rows.filter((row) => {
    if (row.id) return isCatalogMediaAllowedInFeed(row.id, extraHiddenIds);
    // Rows without id: keep if storage key present (legacy callers).
    return isPlayableCatalogStorageKey(row.storageKey);
  });
}
