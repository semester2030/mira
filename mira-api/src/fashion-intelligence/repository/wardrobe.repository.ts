import { CanonicalWardrobe } from '../models/canonical-wardrobe';
import { CanonicalFashionSession } from '../models/canonical-fashion-session';

/**
 * Wardrobe persistence port — Mira-owned.
 * 6B: in-memory implementation. Durable DB can replace without schema redesign.
 */
export interface WardrobeRepository {
  save(wardrobe: CanonicalWardrobe): Promise<CanonicalWardrobe>;
  findById(wardrobeId: string): Promise<CanonicalWardrobe | null>;
  findByUserId(userId: string): Promise<CanonicalWardrobe | null>;
  delete(wardrobeId: string): Promise<boolean>;
  listUserIds(): Promise<string[]>;
}

export interface FashionSessionRepository {
  save(session: CanonicalFashionSession): Promise<CanonicalFashionSession>;
  findById(sessionId: string): Promise<CanonicalFashionSession | null>;
  findByUserId(userId: string): Promise<CanonicalFashionSession[]>;
  delete(sessionId: string): Promise<boolean>;
}

export const WARDROBE_REPOSITORY = Symbol('WARDROBE_REPOSITORY');
export const FASHION_SESSION_REPOSITORY = Symbol('FASHION_SESSION_REPOSITORY');
