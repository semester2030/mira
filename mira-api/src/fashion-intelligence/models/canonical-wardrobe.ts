/**
 * Canonical Fashion Entity alias (Architecture Addendum).
 * 6B: garmentId is entityId where entityClass = garment.
 * No Fashion Entity CRUD yet — refs only.
 */
export type FashionEntityClass =
  | 'garment'
  | 'accessory'
  | 'shoes'
  | 'bag'
  | 'jewelry'
  | 'watch'
  | 'fragrance'
  | 'other';

export type WardrobeItemStatus =
  | 'active'
  | 'archived'
  | 'donated'
  | 'deleted';

export type WardrobeLifecycle = 'active' | 'archived';

export type FavoriteTargetType = 'garment' | 'outfit' | 'look';

/** Wardrobe item — stores canonical references only (no intelligence). */
export interface CanonicalWardrobeItem {
  itemId: string;
  /** Alias: entityId when entityClass = garment (Addendum) */
  garmentId: string;
  entityClass?: FashionEntityClass;
  status: WardrobeItemStatus;
  acquiredAt?: string;
  notes?: string;
}

export interface CanonicalWardrobeCollection {
  collectionId: string;
  titleEn: string;
  titleAr: string;
  garmentIds: string[];
  outfitIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CanonicalWardrobeFavorite {
  favoriteId: string;
  targetType: FavoriteTargetType;
  targetId: string;
  createdAt: string;
}

export interface CanonicalWardrobeLook {
  lookId: string;
  titleEn?: string;
  titleAr?: string;
  outfitId?: string;
  garmentIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CanonicalWardrobeUsage {
  targetId: string;
  targetType: 'garment' | 'outfit';
  wearCount: number;
  lastWornAt?: string;
}

export interface CanonicalWardrobeStatistics {
  categoryCounts: Record<string, number>;
  gapHints: string[];
  /** Coverage — not attractiveness */
  coverageScore?: number;
  itemCount: number;
  lookCount: number;
  collectionCount: number;
  favoriteCount: number;
}

/** Canonical Wardrobe — Phase 6A.5 §5 · implemented in 6B */
export interface CanonicalWardrobe {
  wardrobeId: string;
  userId: string;
  version: string;
  items: CanonicalWardrobeItem[];
  collections: CanonicalWardrobeCollection[];
  favorites: CanonicalWardrobeFavorite[];
  looks: CanonicalWardrobeLook[];
  usage: CanonicalWardrobeUsage[];
  statistics: CanonicalWardrobeStatistics;
  lifecycle: WardrobeLifecycle;
  runtime: import('../runtime/fashion-runtime-state').CanonicalFashionRuntime;
  createdAt: string;
  updatedAt: string;
}
