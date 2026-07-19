/**
 * Beauty Capability Catalog — frozen identity (Phase 5A.5).
 * Capability IDs are permanent. Renaming is forbidden (Engineering Law #13).
 */
export const BEAUTY_CAPABILITY_CATALOG_VERSION = '1.0.0';
export const BEAUTY_CAPABILITY_CATALOG_STATUS =
  'Frozen · Production Catalog' as const;
export const BEAUTY_CAPABILITY_VERSION_POLICY = 'beauty-cap-semver-v1';
export const BEAUTY_CAPABILITY_RUNTIME_MATRIX_VERSION =
  'beauty-cap-runtime-matrix-v1';
export const BEAUTY_CAPABILITY_DEPENDENCY_GRAPH_VERSION =
  'beauty-cap-deps-v1';
export const BEAUTY_CAPABILITY_COMPAT_MATRIX_VERSION =
  'beauty-cap-compat-v1';
export const BEAUTY_PROVIDER_SUPPORT_MATRIX_VERSION =
  'beauty-provider-support-v1';

/** Re-export foundation release constants */
export {
  BEAUTY_EXPERIENCE_RELEASE,
  BEAUTY_EXPERIENCE_STATUS,
  BEAUTY_EXPERIENCE_ARCHITECTURE,
  BEAUTY_EXPERIENCE_COMPAT,
  BEAUTY_CAPABILITY_REGISTRY_VERSION,
  BEAUTY_SESSION_VERSION,
  BEAUTY_POLICY_VERSION,
  BEAUTY_PROVIDER_MANAGER_VERSION,
} from '../release';
