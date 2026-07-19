/**
 * Canonical Mira capability IDs — PERMANENT (Engineering Law #13).
 * Renaming is forbidden. Deprecation is allowed. Version separately.
 *
 * Note: `glasses` is the frozen ID for eyewear try-on.
 * Display name may say "Eyewear"; the id must remain `glasses`.
 */
export type BeautyCapabilityId =
  | 'lip'
  | 'foundation'
  | 'blush'
  | 'eyeshadow'
  | 'contour'
  | 'hair_color'
  | 'hair_style'
  | 'glasses'
  | 'look'
  | 'makeup_vto';

/** Frozen set — used by validation */
export const FROZEN_CAPABILITY_IDS: readonly BeautyCapabilityId[] = [
  'lip',
  'foundation',
  'blush',
  'eyeshadow',
  'contour',
  'hair_color',
  'hair_style',
  'glasses',
  'look',
  'makeup_vto',
] as const;

export type BeautyCapabilityCategory =
  | 'makeup'
  | 'hair'
  | 'accessories'
  | 'beauty_effects'
  | 'look'
  | 'legacy';

export type BeautyCapabilityGroup =
  | 'makeup'
  | 'hair'
  | 'accessories'
  | 'beauty_effects'
  | 'comparison'
  | 'history'
  | 'collections'
  | 'session'
  | 'legacy'
  | 'future';

export type BeautyCapabilityMode = 'image' | 'realtime' | 'offline';

export type BeautyPlatform =
  | 'ios'
  | 'android'
  | 'web'
  | 'server'
  | 'unknown';

/** Frozen cost classes (Engineering Law — catalog v1) */
export type BeautyCostClass = 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';

export type BeautyCapabilityLifecycleStatus =
  | 'draft'
  | 'active'
  | 'deprecated'
  | 'removed';

export type BeautyRequiredAsset =
  | 'lip_mask'
  | 'hair_mask'
  | 'face_mask'
  | 'face_mesh'
  | 'face_alignment'
  | 'portrait_image'
  | 'capture_quality'
  | 'none';

export type BeautyDependencyId =
  | BeautyRequiredAsset
  | BeautyCapabilityId
  | 'capability_policy'
  | 'provider_manager'
  | 'beauty_session'
  | 'subscription_entitlement'
  | 'user_consent';

/**
 * Capability Metadata — single source of truth (Engineering Law #14).
 * No provider metadata fields allowed here.
 */
export interface BeautyCapabilityMetadata {
  id: BeautyCapabilityId;
  /** Semver for this capability's contract, e.g. 1.0.0 */
  version: string;
  /** Stable formula/id tag, e.g. beauty-cap-lip-v1 */
  formulaId: string;
  displayNameEn: string;
  displayNameAr: string;
  category: BeautyCapabilityCategory;
  group: BeautyCapabilityGroup;
  status: BeautyCapabilityLifecycleStatus;
  descriptionEn: string;
  descriptionAr: string;
  modes: BeautyCapabilityMode[];
  platforms: BeautyPlatform[];
  realtime: boolean;
  offline: boolean;
  qualityRequirements: string[];
  requiredAssets: BeautyRequiredAsset[];
  /** Explicit dependencies — never inferred (Law #15) */
  dependencies: BeautyDependencyId[];
  costClass: BeautyCostClass;
  futureStatus: string;
  deprecationPolicy: string;
  /** Real execution still gated by Phase 5B */
  executionEnabled: boolean;
}
