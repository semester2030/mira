/**
 * P5 catalog cursor — bound to a normalized query fingerprint + sort + item key.
 * Format: `v1.<sort>.<fp8>.<kind>:<id>`
 * Rejecting a cursor from another filter/sort set avoids empty "success" pages.
 */

import { createHash } from 'node:crypto';
import type { CatalogFilterInput, CatalogSort } from './catalog-filters';

const CURSOR_RE = /^v1\.(key|price_asc|price_desc)\.([a-f0-9]{8})\.(product|service):([A-Za-z0-9_-]+)$/;
const LEGACY_KEY_RE = /^(product|service):([A-Za-z0-9_-]+)$/;

/** Browse-context fields that change the result set but are not inside CatalogFilterInput. */
export type CatalogBrowseContext = {
  type?: string;
  venue?: string;
  visual?: string;
  lane?: string;
};

function sortedUnique(values: readonly string[] | undefined): string[] {
  return [...new Set((values ?? []).map((v) => v.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

export function normalizeFilterFingerprint(
  filter: CatalogFilterInput,
  context: CatalogBrowseContext = {},
): string {
  const payload = {
    q: (filter.q ?? '').trim(),
    tags: sortedUnique(filter.tags),
    category: (filter.category ?? '').trim(),
    subcategory: (filter.subcategory ?? '').trim(),
    city: (filter.city ?? '').trim(),
    partnerId: (filter.partnerId ?? '').trim(),
    kind: filter.kind ?? '',
    variantSelections: Object.fromEntries(
      Object.entries(filter.variantSelections ?? {})
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, sortedUnique(v)]),
    ),
    inStock: filter.inStock ?? null,
    priceMinHalalas: filter.priceMinHalalas ?? null,
    priceMaxHalalas: filter.priceMaxHalalas ?? null,
    durationMin: filter.durationMin ?? null,
    durationMax: filter.durationMax ?? null,
    placeModes: sortedUnique(filter.placeModes),
    branchIds: sortedUnique(filter.branchIds),
    availableOn: filter.availableOn ?? '',
    sort: filter.sort ?? 'key',
    type: (context.type ?? '').trim(),
    venue: (context.venue ?? '').trim(),
    visual: context.visual === '1' ? '1' : '',
    lane: (context.lane ?? '').trim(),
  };
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex').slice(0, 8);
}

/** Fingerprint of an empty browse (used to gate legacy cursors). */
export function emptyCatalogFingerprint(): string {
  return normalizeFilterFingerprint({}, {});
}

export function encodeCatalogCursor(args: {
  sort: CatalogSort;
  fingerprint: string;
  kind: 'product' | 'service';
  id: string;
}): string {
  return `v1.${args.sort}.${args.fingerprint}.${args.kind}:${args.id}`;
}

export type DecodedCatalogCursor =
  | { ok: true; sort: CatalogSort; fingerprint: string; kind: 'product' | 'service'; id: string }
  | { ok: false; reason: 'invalid_cursor' | 'cursor_mismatch' };

export function decodeCatalogCursor(
  raw: string | undefined,
  expected: { sort: CatalogSort; fingerprint: string },
): DecodedCatalogCursor {
  if (raw == null || raw.trim() === '') {
    return { ok: true, sort: expected.sort, fingerprint: expected.fingerprint, kind: 'product', id: '' };
  }
  const value = raw.trim();
  const match = CURSOR_RE.exec(value);
  if (match) {
    const sort = match[1] as CatalogSort;
    const fingerprint = match[2]!;
    const kind = match[3] as 'product' | 'service';
    const id = match[4]!;
    if (sort !== expected.sort || fingerprint !== expected.fingerprint) {
      return { ok: false, reason: 'cursor_mismatch' };
    }
    return { ok: true, sort, fingerprint, kind, id };
  }
  // Legacy key-only cursor: only when sort=key AND the query set is the empty default.
  // New filters must not be bypassed by a pre-P5 cursor.
  const legacy = LEGACY_KEY_RE.exec(value);
  if (legacy && expected.sort === 'key' && expected.fingerprint === emptyCatalogFingerprint()) {
    return {
      ok: true,
      sort: 'key',
      fingerprint: expected.fingerprint,
      kind: legacy[1] as 'product' | 'service',
      id: legacy[2]!,
    };
  }
  if (legacy) {
    return { ok: false, reason: 'cursor_mismatch' };
  }
  return { ok: false, reason: 'invalid_cursor' };
}

export function parseCatalogLimit(raw: string | undefined): { ok: true; limit: number } | { ok: false } {
  const parsed = raw == null || raw === '' ? 8 : Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 24) return { ok: false };
  return { ok: true, limit: parsed };
}
