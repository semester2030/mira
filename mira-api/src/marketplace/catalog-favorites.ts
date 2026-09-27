export type FavoriteKind = 'product' | 'service';

export type FavoriteRow = {
  userId: string;
  kind: FavoriteKind;
  entityId: string;
};

export type FavoriteToggle =
  | { ok: true; saved: boolean }
  | { ok: false; reason: 'unauthenticated' | 'unpublished' };

/** In-memory rules used by the API adapter and by isolated tests. */
export class CatalogFavoriteBook {
  constructor(private rows: FavoriteRow[] = []) {}

  list(userId: string): FavoriteRow[] {
    if (!userId) return [];
    return this.rows.filter((row) => row.userId === userId);
  }

  set(userId: string, kind: FavoriteKind, entityId: string, published: boolean, saved: boolean): FavoriteToggle {
    if (!userId) return { ok: false, reason: 'unauthenticated' };
    if (!published) return { ok: false, reason: 'unpublished' };
    const index = this.rows.findIndex((row) => row.userId === userId && row.kind === kind && row.entityId === entityId);
    if (saved) {
      if (index < 0) this.rows.push({ userId, kind, entityId });
      return { ok: true, saved: true };
    }
    if (index >= 0) this.rows.splice(index, 1);
    return { ok: true, saved: false };
  }

  toggle(userId: string, kind: FavoriteKind, entityId: string, published: boolean): FavoriteToggle {
    if (!userId) return { ok: false, reason: 'unauthenticated' };
    if (!published) return { ok: false, reason: 'unpublished' };
    const index = this.rows.findIndex((row) => row.userId === userId && row.kind === kind && row.entityId === entityId);
    if (index >= 0) {
      this.rows.splice(index, 1);
      return { ok: true, saved: false };
    }
    this.rows.push({ userId, kind, entityId });
    return { ok: true, saved: true };
  }
}
