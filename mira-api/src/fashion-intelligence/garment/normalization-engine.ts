/**
 * Normalization Engine — uses shared fashion-aliases SSOT (6C.1).
 */
import {
  FASHION_CATEGORY_ALIASES,
  FASHION_COLOR_ALIASES,
  FASHION_FIT_ALIASES,
  FASHION_MATERIAL_ALIASES,
  FASHION_TYPE_ALIASES,
  fashionAliasSlug,
} from '../../vision/schema/fashion-aliases';

export function normalizeCategoryId(raw: string | undefined | null): string {
  if (!raw || !String(raw).trim()) return 'unknown';
  const k = fashionAliasSlug(String(raw));
  return FASHION_CATEGORY_ALIASES[k] ?? k;
}

export function normalizeTypeId(raw: string | undefined | null): string {
  if (!raw || !String(raw).trim()) return 'unknown';
  const k = fashionAliasSlug(String(raw));
  return FASHION_TYPE_ALIASES[k] ?? k;
}

export function normalizeColorId(raw: string | undefined | null): string {
  if (!raw || !String(raw).trim()) return '';
  const k = fashionAliasSlug(String(raw));
  return FASHION_COLOR_ALIASES[k] ?? k;
}

export function normalizeMaterialId(raw: string | undefined | null): string {
  if (!raw || !String(raw).trim()) return '';
  const k = fashionAliasSlug(String(raw));
  return FASHION_MATERIAL_ALIASES[k] ?? k;
}

export function normalizeFitId(raw: string | undefined | null): string {
  if (!raw || !String(raw).trim()) return '';
  const k = fashionAliasSlug(String(raw));
  return FASHION_FIT_ALIASES[k] ?? k;
}

export function normalizeLanguageLabel(raw: string | undefined | null): string {
  if (!raw) return '';
  return String(raw).trim().replace(/\s+/g, ' ');
}
