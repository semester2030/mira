import * as fs from 'fs';
import * as path from 'path';
import {
  normalizeCategoryId,
  normalizeColorId,
  normalizeTypeId,
} from './normalization-engine';

export interface CatalogPieceIndex {
  id: string;
  category: string;
  subcategory?: string;
  colorId?: string;
  typeHint?: string;
}

let cachedIndex: CatalogPieceIndex[] | null = null;
let cachedCategories: Set<string> | null = null;

function repoRootFromHere(): string {
  return path.resolve(__dirname, '../../../..');
}

/**
 * Catalog Resolution Engine — resolve catalogPieceId only.
 * No marketplace / recommendation.
 * 6C.1: ambiguous → limitation only (no piece id / no season attach).
 */
export class CatalogResolutionEngine {
  constructor(private readonly pieces: CatalogPieceIndex[] = loadCatalogIndex()) {}

  resolve(input: {
    categoryId: string;
    typeId: string;
    colors: string[];
  }): { catalogPieceId?: string; limitationCodes: string[] } {
    const limitationCodes: string[] = [];
    const cat = normalizeCategoryId(input.categoryId);
    const type = normalizeTypeId(input.typeId);
    const color = input.colors[0] ? normalizeColorId(input.colors[0]) : '';

    const candidates = this.pieces.filter((p) => {
      const pCat = normalizeCategoryId(p.category);
      if (cat !== 'unknown' && pCat !== cat && pCat !== 'unknown') return false;
      if (type !== 'unknown') {
        const idHit = p.id.includes(type) || p.typeHint === type;
        const subHit = p.subcategory === type;
        if (!idHit && !subHit) return false;
      }
      if (color && p.colorId) {
        return colorsCompatible(p.colorId, color);
      }
      return true;
    });

    if (candidates.length === 1) {
      return { catalogPieceId: candidates[0].id, limitationCodes };
    }
    if (candidates.length === 0) {
      limitationCodes.push('catalog_unresolved');
      return { limitationCodes };
    }
    // Ambiguous: do not attach a piece id (avoids wrong season/occasion evidence)
    limitationCodes.push('catalog_ambiguous');
    return { limitationCodes };
  }

  validatePieceId(id: string): boolean {
    return this.pieces.some((p) => p.id === id);
  }
}

function colorsCompatible(a: string, b: string): boolean {
  const na = normalizeColorId(a);
  const nb = normalizeColorId(b);
  if (na === nb) return true;
  const stemA = na.split('_')[0] ?? na;
  const stemB = nb.split('_')[0] ?? nb;
  return stemA === stemB;
}

/** Categories present in catalog index — SSOT for catalog-owned category acceptance. */
export function catalogOwnedCategoryIds(
  rootDir = repoRootFromHere(),
): Set<string> {
  if (cachedCategories) return cachedCategories;
  const pieces = loadCatalogIndex(rootDir);
  cachedCategories = new Set(
    pieces.map((p) => normalizeCategoryId(p.category)).filter((c) => c && c !== 'unknown'),
  );
  return cachedCategories;
}

export function loadCatalogIndex(rootDir = repoRootFromHere()): CatalogPieceIndex[] {
  if (cachedIndex) return cachedIndex;
  const catalogPath = path.join(rootDir, 'assets/fashion/catalog.json');
  try {
    const raw = JSON.parse(fs.readFileSync(catalogPath, 'utf8')) as {
      pieces?: Array<Record<string, unknown>>;
    };
    cachedIndex = (raw.pieces ?? []).map((p) => ({
      id: String(p.id ?? ''),
      category: String(p.category ?? 'unknown'),
      subcategory:
        p.subcategory != null ? String(p.subcategory) : undefined,
      colorId:
        p.colorId != null
          ? String(p.colorId)
          : p.color != null
            ? String(p.color)
            : undefined,
      typeHint: inferTypeHint(String(p.id ?? ''), String(p.file ?? '')),
    })).filter((p) => p.id);
  } catch {
    cachedIndex = [];
  }
  return cachedIndex;
}

function inferTypeHint(id: string, file: string): string | undefined {
  const blob = `${id}_${file}`.toLowerCase();
  for (const t of [
    'blazer',
    'jacket',
    'dress',
    'skirt',
    'pants',
    'jeans',
    'shirt',
    'blouse',
    'coat',
    'abaya',
    'heels',
    'bag',
    'scarf',
  ]) {
    if (blob.includes(t)) return t;
  }
  return undefined;
}

export function resetCatalogIndexCache(): void {
  cachedIndex = null;
  cachedCategories = null;
}
