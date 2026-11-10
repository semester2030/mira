import { Prisma } from '@prisma/client';
import { mergeAttributesPatch } from './attributes-patch.merge';
import {
  normalizeOptionalId,
  pruneAttributesByDependsOn,
  resolveFromSubcategory,
  validateProductTaxonomyWrite,
  type AttributeFieldDef,
  type ProductTaxonomyInput,
} from './product-taxonomy.validate';
import type { EleganceTaxonomyDoc, TaxonomyFieldError } from './taxonomy.types';

export type TaxonomyWriteContext = {
  doc: EleganceTaxonomyDoc;
  knownProfileIds?: Set<string>;
  /**
   * Resolve attribute field defs for the FINAL profileId after taxonomy resolution.
   * Must not use a stale/pre-patch profile.
   */
  resolveAttributeFieldDefs?: (profileId: string | null) => Map<string, AttributeFieldDef> | undefined;
  /** @deprecated Prefer resolveAttributeFieldDefs; ignored when resolver is set. */
  attributeFieldDefs?: Map<string, AttributeFieldDef>;
};

export type ProductTaxonomyState = {
  category: string | null;
  subcategory: string | null;
  profileId: string | null;
  attributesJson: unknown;
};

export type TaxonomyPatchInput = {
  category?: string | null;
  subcategory?: string | null;
  profileId?: string | null;
  attributes?: unknown;
};

export type AppliedTaxonomyWrite = {
  errors: TaxonomyFieldError[];
  next: ProductTaxonomyState;
  liveData: Record<string, unknown>;
  draftData: Record<string, unknown>;
};

export type DraftTaxonomyRow = {
  draftTaxonomySet?: boolean | null;
  draftCategory?: string | null;
  draftSubcategory?: string | null;
  draftProfileId?: string | null;
  draftAttributesJson?: unknown;
  category?: string | null;
  subcategory?: string | null;
  profileId?: string | null;
  attributesJson?: unknown;
};

/**
 * Pending draft taxonomy is authoritative when draftTaxonomySet=true — including intentional nulls.
 * Never coalesce null draft fields back to published values.
 */
export function readTaxonomyBaseline(row: DraftTaxonomyRow): ProductTaxonomyState {
  if (row.draftTaxonomySet) {
    return {
      category: row.draftCategory ?? null,
      subcategory: row.draftSubcategory ?? null,
      profileId: row.draftProfileId ?? null,
      attributesJson: row.draftAttributesJson ?? null,
    };
  }
  return {
    category: row.category ?? null,
    subcategory: row.subcategory ?? null,
    profileId: row.profileId ?? null,
    attributesJson: row.attributesJson ?? null,
  };
}

/** Apply pending draft taxonomy onto live columns (approve path). Null draft values clear live. */
export function pendingTaxonomyToLiveWrite(row: DraftTaxonomyRow): Record<string, unknown> | null {
  if (!row.draftTaxonomySet) return null;
  return {
    category: row.draftCategory ?? null,
    subcategory: row.draftSubcategory ?? null,
    profileId: row.draftProfileId ?? null,
    attributesJson:
      row.draftAttributesJson == null
        ? Prisma.DbNull
        : (row.draftAttributesJson as Prisma.InputJsonValue),
    draftCategory: null,
    draftSubcategory: null,
    draftProfileId: null,
    draftAttributesJson: Prisma.DbNull,
    draftTaxonomySet: false,
  };
}

function asJson(value: Record<string, unknown> | null): Prisma.InputJsonValue | typeof Prisma.DbNull {
  return value == null ? Prisma.DbNull : (value as Prisma.InputJsonValue);
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

/** True when the patch adds/changes attribute values (not only clears or dimensionsCm). */
function attributePatchRequiresTrustedContext(
  patchAttributes: unknown,
  patchedAttrKeys: Set<string>,
): boolean {
  if (!isPlainObject(patchAttributes)) return patchAttributes != null;
  for (const key of patchedAttrKeys) {
    if (key === 'dimensionsCm') continue;
    if (patchAttributes[key] === null) continue; // explicit clear of a key
    return true;
  }
  return false;
}

/**
 * Resolve next taxonomy state from current + patch, validate merged result against FINAL profile defs.
 *
 * Stored profileId may be null after an explicit clear. Attribute validation still uses a
 * trusted context derived from subcategory when available — missing defs never mean "accept all".
 */
export function applyTaxonomyPatch(
  ctx: TaxonomyWriteContext,
  current: ProductTaxonomyState,
  patch: TaxonomyPatchInput,
  opts?: { published?: boolean },
): AppliedTaxonomyWrite {
  const errors: TaxonomyFieldError[] = [];
  const published = opts?.published === true;

  const categoryIn = patch.category !== undefined ? normalizeOptionalId(patch.category) : undefined;
  const subcategoryIn = patch.subcategory !== undefined ? normalizeOptionalId(patch.subcategory) : undefined;
  const profileIn = patch.profileId !== undefined ? normalizeOptionalId(patch.profileId) : undefined;

  let nextCategory = categoryIn !== undefined ? categoryIn : current.category;
  let nextSubcategory = subcategoryIn !== undefined ? subcategoryIn : current.subcategory;
  // Stored profile — respects explicit null clear; do not silently restore.
  let nextProfileId = profileIn !== undefined ? profileIn : current.profileId;
  // Validation context may differ from stored when profile was cleared but subcategory remains.
  let validationProfileId: string | null = nextProfileId;

  // Resolve canonical category/profile from subcategory when not explicitly conflicting.
  if (nextSubcategory) {
    const resolved = resolveFromSubcategory(ctx.doc, nextSubcategory);
    if (resolved) {
      if (categoryIn === undefined && (nextCategory == null || nextCategory === '')) {
        nextCategory = resolved.category;
      }
      if (profileIn === undefined) {
        // Omitted profileId: only rewrite *stored* profile when subcategory is explicitly changing.
        // Do NOT restore a previously cleared null just because attributes were patched or the
        // same subcategory remains on the baseline.
        const subcategoryChanged =
          subcategoryIn !== undefined &&
          (subcategoryIn ?? null) !== (current.subcategory ?? null);
        if (subcategoryChanged) {
          nextProfileId = resolved.profileId;
          validationProfileId = resolved.profileId;
        } else {
          // Keep stored value (including intentional null). Validate via taxonomy profile.
          validationProfileId =
            nextProfileId != null && nextProfileId !== '' ? nextProfileId : resolved.profileId;
        }
      } else if (profileIn == null || profileIn === '') {
        // Explicit clear stays stored as null; still validate attributes against taxonomy profile.
        validationProfileId = resolved.profileId;
      } else {
        validationProfileId = nextProfileId;
      }
    }
  } else if (profileIn === null) {
    validationProfileId = null;
  }

  let nextAttributes = current.attributesJson;
  const patchedAttrKeys = new Set<string>();
  if (patch.attributes !== undefined) {
    if (isPlainObject(patch.attributes)) {
      for (const k of Object.keys(patch.attributes)) patchedAttrKeys.add(k);
    }
    const merged = mergeAttributesPatch(current.attributesJson, patch.attributes);
    if (!merged.ok) {
      errors.push(...merged.errors);
    } else {
      nextAttributes = merged.value;
    }
  }

  const needsTrustedContext = attributePatchRequiresTrustedContext(patch.attributes, patchedAttrKeys);
  if (needsTrustedContext && (validationProfileId == null || validationProfileId === '')) {
    errors.push({
      fieldId: 'attributes',
      code: 'ATTRIBUTE_CONTEXT_REQUIRED',
      messageAr: 'لا يمكن التحقق من الخصائص دون تصنيف فرعي أو ملف حقول موثوق',
    });
  }

  // Load field defs for the TRUSTED validation profile (may differ from stored null after clear).
  const attributeFieldDefs =
    validationProfileId
      ? ctx.resolveAttributeFieldDefs?.(validationProfileId) ??
        (ctx.attributeFieldDefs ?? undefined)
      : undefined;

  if (needsTrustedContext && validationProfileId && !attributeFieldDefs) {
    errors.push({
      fieldId: 'attributes',
      code: 'ATTRIBUTE_CONTEXT_REQUIRED',
      messageAr: 'تعذر تحميل تعريفات خصائص الملف للتحقق',
    });
  }

  // Strip dependsOn-incompatible keys so a subcategory change cannot keep prior fields hidden.
  if (nextAttributes != null && isPlainObject(nextAttributes) && attributeFieldDefs) {
    nextAttributes = pruneAttributesByDependsOn(
      nextAttributes as Record<string, unknown>,
      attributeFieldDefs,
      { category: nextCategory, subcategory: nextSubcategory },
    );
  }

  const validateInput: ProductTaxonomyInput = {
    category: nextCategory,
    subcategory: nextSubcategory,
    profileId: nextProfileId,
    attributes: undefined,
    allowOmittedSubcategory: true,
    knownProfileIds: ctx.knownProfileIds,
    attributeFieldDefs,
    // Unknown keys only enforced for newly patched keys (see below).
    allowUnknownAttributeKeys: true,
  };
  errors.push(...validateProductTaxonomyWrite(ctx.doc, validateInput));

  if (patch.attributes !== undefined && errors.every((e) => e.fieldId !== 'attributes')) {
    if (nextAttributes != null && isPlainObject(nextAttributes)) {
      // Validate types for all known fields present in the final bag.
      const typed = validateProductTaxonomyWrite(ctx.doc, {
        ...validateInput,
        attributes: nextAttributes,
        allowUnknownAttributeKeys: true,
      });
      for (const e of typed) {
        // dependsOn mismatches are pruned above; ignore residual DEPENDS_ON noise.
        if (e.code === 'ATTRIBUTE_DEPENDS_ON') continue;
        if (!errors.some((x) => x.fieldId === e.fieldId && x.code === e.code)) errors.push(e);
      }
      // Reject NEW / patched unknown keys (not present in prior bag as legacy).
      if (attributeFieldDefs) {
        const prior = isPlainObject(current.attributesJson) ? current.attributesJson : {};
        for (const key of patchedAttrKeys) {
          if (key === 'dimensionsCm') continue;
          if (attributeFieldDefs.has(key)) continue;
          // Clearing an unknown legacy key with null is allowed (intentional clear).
          const patchObj = isPlainObject(patch.attributes) ? patch.attributes : {};
          if (patchObj[key] === null && Object.prototype.hasOwnProperty.call(prior, key)) {
            continue;
          }
          // Brand-new unknown key, or modifying an unknown key's value → reject.
          errors.push({
            fieldId: key,
            code: 'ATTRIBUTE_UNKNOWN',
            messageAr: `خاصية غير مسموحة لهذا الملف: ${key}`,
          });
        }
      } else if (needsTrustedContext && patchedAttrKeys.size > 0) {
        // No defs available for a write that requires context — reject non-clear keys.
        for (const key of patchedAttrKeys) {
          if (key === 'dimensionsCm') continue;
          const patchObj = isPlainObject(patch.attributes) ? patch.attributes : {};
          if (patchObj[key] === null) continue;
          errors.push({
            fieldId: key,
            code: 'ATTRIBUTE_UNKNOWN',
            messageAr: `خاصية غير مسموحة لهذا الملف: ${key}`,
          });
        }
      }
    } else if (nextAttributes != null) {
      errors.push({
        fieldId: 'attributes',
        code: 'ATTRIBUTES_TYPE',
        messageAr: 'خصائص المنتج يجب أن تكون كائنًا وليس مصفوفة',
      });
    }
  }

  const next: ProductTaxonomyState = {
    category: nextCategory,
    subcategory: nextSubcategory,
    profileId: nextProfileId,
    attributesJson: nextAttributes,
  };

  const liveData: Record<string, unknown> = {};
  const draftData: Record<string, unknown> = {};

  if (published) {
    const taxonomyTouched =
      patch.category !== undefined ||
      patch.subcategory !== undefined ||
      patch.profileId !== undefined ||
      patch.attributes !== undefined;
    if (taxonomyTouched) {
      draftData.draftTaxonomySet = true;
      draftData.draftCategory = next.category;
      draftData.draftSubcategory = next.subcategory;
      draftData.draftProfileId = next.profileId;
      draftData.draftAttributesJson = asJson(
        next.attributesJson == null || !isPlainObject(next.attributesJson)
          ? null
          : next.attributesJson,
      );
    }
  } else {
    if (patch.category !== undefined) liveData.category = next.category;
    if (patch.subcategory !== undefined) liveData.subcategory = next.subcategory;
    if (patch.profileId !== undefined) liveData.profileId = next.profileId;
    if (subcategoryIn && patch.category === undefined && next.category && current.category == null) {
      liveData.category = next.category;
    }
    if (subcategoryIn && patch.profileId === undefined && next.profileId) {
      liveData.profileId = next.profileId;
    }
    if (patch.attributes !== undefined) {
      liveData.attributesJson = asJson(
        next.attributesJson == null || !isPlainObject(next.attributesJson) ? null : next.attributesJson,
      );
    }
  }

  return { errors, next, liveData, draftData };
}
