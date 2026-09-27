export type CatalogKind = 'product' | 'service';

export type CatalogPageItem = {
  kind: CatalogKind;
  id: string;
};

const cursorPattern = /^(product|service):([A-Za-z0-9_-]+)$/;

export function catalogCursor(kind: string, id: string): string {
  return `${kind}:${id}`;
}

/** One code-unit order for sorting and for continuing after a cursor. */
export function compareCatalogKeys(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

export function pageCatalogItems<T extends CatalogPageItem>(
  items: readonly T[],
  cursor: string | undefined,
  limit: number,
): { ok: true; items: T[]; nextCursor: string | null } | { ok: false; reason: 'invalid_cursor' | 'invalid_limit' } {
  if (!Number.isInteger(limit) || limit < 1 || limit > 24) {
    return { ok: false, reason: 'invalid_limit' };
  }
  const sorted = [...items].sort((a, b) => compareCatalogKeys(catalogCursor(a.kind, a.id), catalogCursor(b.kind, b.id)));
  let start = 0;
  if (cursor != null && cursor.trim() !== '') {
    const match = cursorPattern.exec(cursor.trim());
    if (!match) return { ok: false, reason: 'invalid_cursor' };
    const key = catalogCursor(match[1], match[2]);
    const index = sorted.findIndex((item) => compareCatalogKeys(catalogCursor(item.kind, item.id), key) > 0);
    start = index < 0 ? sorted.length : index;
  }
  const slice = sorted.slice(start, start + limit);
  const last = slice[slice.length - 1];
  return {
    ok: true,
    items: slice,
    nextCursor: last != null && start + slice.length < sorted.length ? catalogCursor(last.kind, last.id) : null,
  };
}
