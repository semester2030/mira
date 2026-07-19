import {
  CanonicalWardrobe,
  CanonicalWardrobeCollection,
  CanonicalWardrobeFavorite,
  CanonicalWardrobeItem,
  CanonicalWardrobeLook,
} from '../models/canonical-wardrobe';
import { CanonicalFashionSession } from '../models/canonical-fashion-session';
import {
  CanonicalFashionRuntime,
  isValidFashionRuntimeTransition,
} from '../runtime/fashion-runtime-state';

export interface FashionValidationIssue {
  code: string;
  path: string;
  message: string;
}

export interface FashionValidationResult {
  valid: boolean;
  issues: FashionValidationIssue[];
}

function issue(code: string, path: string, message: string): FashionValidationIssue {
  return { code, path, message };
}

/** Law #23–#26 ownership checks on wardrobe payload shape */
export function validateWardrobeOwnershipLaws(
  wardrobe: CanonicalWardrobe,
): FashionValidationIssue[] {
  const issues: FashionValidationIssue[] = [];
  const json = JSON.stringify(wardrobe);
  if (json.includes('"styleEngine"') || json.includes('"recommendationEngine"')) {
    issues.push(
      issue(
        'ownership_law_25',
        'wardrobe',
        'Wardrobe must not own Styling or Recommendation engines (Law #25)',
      ),
    );
  }
  if (json.includes('"providerPayload"') || json.includes('fashnPayload')) {
    issues.push(
      issue('provider_leakage', 'wardrobe', 'Provider payload in wardrobe (Law #28/#30)'),
    );
  }
  return issues;
}

export function validateWardrobe(wardrobe: CanonicalWardrobe): FashionValidationResult {
  const issues: FashionValidationIssue[] = [
    ...validateWardrobeOwnershipLaws(wardrobe),
  ];

  if (!wardrobe.wardrobeId) {
    issues.push(issue('missing_id', 'wardrobeId', 'wardrobeId required'));
  }
  if (!wardrobe.userId) {
    issues.push(issue('missing_user', 'userId', 'userId required'));
  }
  if (wardrobe.lifecycle !== 'active' && wardrobe.lifecycle !== 'archived') {
    issues.push(issue('invalid_lifecycle', 'lifecycle', 'lifecycle must be active|archived'));
  }

  const itemIds = new Set<string>();
  const garmentIds = new Set<string>();
  for (const item of wardrobe.items) {
    if (itemIds.has(item.itemId)) {
      issues.push(issue('duplicate_item_id', `items.${item.itemId}`, 'Duplicate itemId'));
    }
    itemIds.add(item.itemId);
    if (!item.garmentId) {
      issues.push(issue('missing_garment_ref', `items.${item.itemId}`, 'garmentId required'));
    }
    // Duplicate active garment refs not allowed
    if (item.status === 'active') {
      if (garmentIds.has(item.garmentId)) {
        issues.push(
          issue(
            'duplicate_garment_id',
            `items.${item.itemId}`,
            'Duplicate active garmentId in wardrobe',
          ),
        );
      }
      garmentIds.add(item.garmentId);
    }
    const entityClass = item.entityClass ?? 'garment';
    if (entityClass === 'garment' && !item.garmentId) {
      issues.push(issue('entity_alias', `items.${item.itemId}`, 'garment entity requires garmentId'));
    }
  }

  const knownGarments = new Set(wardrobe.items.map((i) => i.garmentId));
  const knownLooks = new Set(wardrobe.looks.map((l) => l.lookId));
  const knownOutfits = new Set(
    wardrobe.looks.map((l) => l.outfitId).filter(Boolean) as string[],
  );

  for (const col of wardrobe.collections) {
    for (const gid of col.garmentIds) {
      if (!knownGarments.has(gid)) {
        issues.push(
          issue('orphan_collection_garment', `collections.${col.collectionId}`, `Unknown garmentId ${gid}`),
        );
      }
    }
    for (const oid of col.outfitIds) {
      if (!knownOutfits.has(oid)) {
        // Outfit intelligence not in 6B — allow outfitIds only if referenced by a look
        issues.push(
          issue(
            'orphan_collection_outfit',
            `collections.${col.collectionId}`,
            `Unknown outfitId ${oid} (must be referenced by a look)`,
          ),
        );
      }
    }
  }

  for (const fav of wardrobe.favorites) {
    if (fav.targetType === 'garment' && !knownGarments.has(fav.targetId)) {
      issues.push(issue('orphan_favorite', `favorites.${fav.favoriteId}`, 'Unknown garment target'));
    }
    if (fav.targetType === 'look' && !knownLooks.has(fav.targetId)) {
      issues.push(issue('orphan_favorite', `favorites.${fav.favoriteId}`, 'Unknown look target'));
    }
    if (fav.targetType === 'outfit' && !knownOutfits.has(fav.targetId)) {
      issues.push(issue('orphan_favorite', `favorites.${fav.favoriteId}`, 'Unknown outfit target'));
    }
  }

  for (const look of wardrobe.looks) {
    for (const gid of look.garmentIds) {
      if (!knownGarments.has(gid)) {
        issues.push(issue('orphan_look_garment', `looks.${look.lookId}`, `Unknown garmentId ${gid}`));
      }
    }
  }

  if (!wardrobe.runtime?.status || typeof wardrobe.runtime.retryable !== 'boolean') {
    issues.push(issue('invalid_runtime', 'runtime', 'Runtime status and retryable required'));
  }
  if (!wardrobe.runtime?.trustLevel) {
    issues.push(issue('invalid_runtime', 'runtime.trustLevel', 'trustLevel required'));
  }

  return { valid: issues.length === 0, issues };
}

export function validateSession(session: CanonicalFashionSession): FashionValidationResult {
  const issues: FashionValidationIssue[] = [];
  if (!session.sessionId) {
    issues.push(issue('missing_id', 'sessionId', 'sessionId required'));
  }
  if (!session.version) {
    issues.push(issue('missing_version', 'version', 'session version required'));
  }
  const attemptSet = new Set(session.attemptIds);
  if (attemptSet.size !== session.attemptIds.length) {
    issues.push(issue('duplicate_attempt_id', 'attemptIds', 'Duplicate attemptIds'));
  }
  const garmentSet = new Set(session.garmentIds);
  if (garmentSet.size !== session.garmentIds.length) {
    issues.push(issue('duplicate_garment_id', 'garmentIds', 'Duplicate garmentIds in session'));
  }
  // Law #24: session may bind wardrobeId but must not embed wardrobe ownership engines
  const json = JSON.stringify(session);
  if (json.includes('fashnPayload') || json.includes('openaiRaw')) {
    issues.push(issue('provider_leakage', 'session', 'Provider payload in session'));
  }
  if (typeof session.runtime?.retryable !== 'boolean') {
    issues.push(issue('invalid_runtime', 'runtime.retryable', 'retryable required'));
  }
  if (!session.trust?.level) {
    issues.push(issue('invalid_trust', 'trust.level', 'trust level required'));
  }
  if (!session.progress || !Array.isArray(session.progress.goals)) {
    issues.push(issue('invalid_progress', 'progress', 'progress skeleton required'));
  }
  return { valid: issues.length === 0, issues };
}

export function validateRuntimeTransition(
  from: CanonicalFashionRuntime,
  to: CanonicalFashionRuntime,
): FashionValidationResult {
  const issues: FashionValidationIssue[] = [];
  if (!isValidFashionRuntimeTransition(from.status, to.status)) {
    issues.push(
      issue(
        'invalid_runtime_transition',
        'runtime.status',
        `Illegal transition ${from.status} → ${to.status}`,
      ),
    );
  }
  if (typeof to.retryable !== 'boolean') {
    issues.push(issue('invalid_runtime', 'retryable', 'retryable required'));
  }
  if (!to.trustLevel) {
    issues.push(issue('invalid_runtime', 'trustLevel', 'trustLevel required'));
  }
  return { valid: issues.length === 0, issues };
}

export function assertValidWardrobe(wardrobe: CanonicalWardrobe): void {
  const r = validateWardrobe(wardrobe);
  if (!r.valid) {
    throw new Error(
      `Wardrobe validation failed: ${r.issues.map((i) => i.code).join(',')}`,
    );
  }
}

export function assertValidSession(session: CanonicalFashionSession): void {
  const r = validateSession(session);
  if (!r.valid) {
    throw new Error(
      `Session validation failed: ${r.issues.map((i) => i.code).join(',')}`,
    );
  }
}

export type {
  CanonicalWardrobeItem,
  CanonicalWardrobeCollection,
  CanonicalWardrobeFavorite,
  CanonicalWardrobeLook,
};
