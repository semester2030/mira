import { BeautyCapabilityId, BeautyCapabilityMode } from '../capability/capability-ids';
import { BeautyProviderId } from './provider-ids';

/**
 * Provider × Capability matrix entry.
 * Priority: higher wins (e.g. Perfect 100 > Banuba 80 for lip).
 */
export interface ProviderCapabilityMatrixEntry {
  capabilityId: BeautyCapabilityId;
  providerId: BeautyProviderId;
  supported: boolean;
  modes: BeautyCapabilityMode[];
  realtime: boolean;
  offline: boolean;
  estimatedCostUnits: number;
  priority: number;
  featureFlag: string;
  requiredAssets: string[];
}

/**
 * Extended matrix — foundation declares support; execution still blocked by policy.
 */
export const PROVIDER_CAPABILITY_MATRIX: ProviderCapabilityMatrixEntry[] = [
  // Lip
  {
    capabilityId: 'lip',
    providerId: 'perfect_beauty',
    supported: true,
    modes: ['image', 'realtime'],
    realtime: true,
    offline: false,
    estimatedCostUnits: 2,
    priority: 100,
    featureFlag: 'BEAUTY_PERFECT_LIP',
    requiredAssets: ['lip_mask', 'portrait_image'],
  },
  {
    capabilityId: 'lip',
    providerId: 'banuba_beauty',
    supported: true,
    modes: ['realtime'],
    realtime: true,
    offline: true,
    estimatedCostUnits: 1,
    priority: 80,
    featureFlag: 'BEAUTY_BANUBA_LIP',
    requiredAssets: ['lip_mask', 'portrait_image'],
  },
  // Foundation
  {
    capabilityId: 'foundation',
    providerId: 'perfect_beauty',
    supported: true,
    modes: ['image', 'realtime'],
    realtime: true,
    offline: false,
    estimatedCostUnits: 2,
    priority: 100,
    featureFlag: 'BEAUTY_PERFECT_FOUNDATION',
    requiredAssets: ['face_mask', 'portrait_image'],
  },
  {
    capabilityId: 'foundation',
    providerId: 'banuba_beauty',
    supported: true,
    modes: ['realtime'],
    realtime: true,
    offline: true,
    estimatedCostUnits: 1,
    priority: 80,
    featureFlag: 'BEAUTY_BANUBA_FOUNDATION',
    requiredAssets: ['face_mask', 'portrait_image'],
  },
  // Blush
  {
    capabilityId: 'blush',
    providerId: 'perfect_beauty',
    supported: true,
    modes: ['image'],
    realtime: false,
    offline: false,
    estimatedCostUnits: 1,
    priority: 100,
    featureFlag: 'BEAUTY_PERFECT_BLUSH',
    requiredAssets: ['face_mask', 'portrait_image'],
  },
  {
    capabilityId: 'blush',
    providerId: 'banuba_beauty',
    supported: true,
    modes: ['realtime'],
    realtime: true,
    offline: true,
    estimatedCostUnits: 1,
    priority: 90,
    featureFlag: 'BEAUTY_BANUBA_BLUSH',
    requiredAssets: ['face_mask', 'portrait_image'],
  },
  // Eyeshadow
  {
    capabilityId: 'eyeshadow',
    providerId: 'perfect_beauty',
    supported: true,
    modes: ['image'],
    realtime: false,
    offline: false,
    estimatedCostUnits: 2,
    priority: 100,
    featureFlag: 'BEAUTY_PERFECT_EYESHADOW',
    requiredAssets: ['face_mask', 'portrait_image'],
  },
  {
    capabilityId: 'eyeshadow',
    providerId: 'banuba_beauty',
    supported: true,
    modes: ['realtime'],
    realtime: true,
    offline: true,
    estimatedCostUnits: 1,
    priority: 85,
    featureFlag: 'BEAUTY_BANUBA_EYESHADOW',
    requiredAssets: ['face_mask', 'portrait_image'],
  },
  // Contour
  {
    capabilityId: 'contour',
    providerId: 'perfect_beauty',
    supported: true,
    modes: ['image'],
    realtime: false,
    offline: false,
    estimatedCostUnits: 2,
    priority: 100,
    featureFlag: 'BEAUTY_PERFECT_CONTOUR',
    requiredAssets: ['face_mask', 'portrait_image'],
  },
  // Hair
  {
    capabilityId: 'hair_color',
    providerId: 'perfect_beauty',
    supported: true,
    modes: ['image'],
    realtime: false,
    offline: false,
    estimatedCostUnits: 3,
    priority: 90,
    featureFlag: 'BEAUTY_PERFECT_HAIR_COLOR',
    requiredAssets: ['hair_mask', 'portrait_image'],
  },
  {
    capabilityId: 'hair_color',
    providerId: 'banuba_beauty',
    supported: true,
    modes: ['realtime', 'offline'],
    realtime: true,
    offline: true,
    estimatedCostUnits: 1,
    priority: 100,
    featureFlag: 'BEAUTY_BANUBA_HAIR_COLOR',
    requiredAssets: ['hair_mask', 'portrait_image'],
  },
  {
    capabilityId: 'hair_style',
    providerId: 'perfect_beauty',
    supported: true,
    modes: ['image'],
    realtime: false,
    offline: false,
    estimatedCostUnits: 4,
    priority: 100,
    featureFlag: 'BEAUTY_PERFECT_HAIR_STYLE',
    requiredAssets: ['hair_mask', 'portrait_image'],
  },
  // Glasses
  {
    capabilityId: 'glasses',
    providerId: 'banuba_beauty',
    supported: true,
    modes: ['realtime'],
    realtime: true,
    offline: true,
    estimatedCostUnits: 1,
    priority: 100,
    featureFlag: 'BEAUTY_BANUBA_GLASSES',
    requiredAssets: ['face_mesh', 'portrait_image'],
  },
  {
    capabilityId: 'glasses',
    providerId: 'perfect_beauty',
    supported: true,
    modes: ['image'],
    realtime: false,
    offline: false,
    estimatedCostUnits: 2,
    priority: 70,
    featureFlag: 'BEAUTY_PERFECT_GLASSES',
    requiredAssets: ['face_mesh', 'portrait_image'],
  },
  // Look
  {
    capabilityId: 'look',
    providerId: 'perfect_beauty',
    supported: true,
    modes: ['image'],
    realtime: false,
    offline: false,
    estimatedCostUnits: 5,
    priority: 100,
    featureFlag: 'BEAUTY_PERFECT_LOOK',
    requiredAssets: ['face_mask', 'portrait_image'],
  },
  // Legacy makeup_vto
  {
    capabilityId: 'makeup_vto',
    providerId: 'perfect_beauty',
    supported: true,
    modes: ['image'],
    realtime: false,
    offline: false,
    estimatedCostUnits: 2,
    priority: 100,
    featureFlag: 'BEAUTY_PERFECT_MAKEUP_VTO',
    requiredAssets: ['portrait_image'],
  },
  {
    capabilityId: 'makeup_vto',
    providerId: 'disabled',
    supported: false,
    modes: ['image'],
    realtime: false,
    offline: false,
    estimatedCostUnits: 0,
    priority: 0,
    featureFlag: 'BEAUTY_TRYON_ENABLED',
    requiredAssets: ['portrait_image'],
  },
];

export function matrixForCapability(
  capabilityId: BeautyCapabilityId,
): ProviderCapabilityMatrixEntry[] {
  return PROVIDER_CAPABILITY_MATRIX.filter(
    (e) => e.capabilityId === capabilityId && e.supported,
  );
}
