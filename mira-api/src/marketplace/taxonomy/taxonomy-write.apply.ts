import { Prisma } from '@prisma/client';
import { mergeAttributesPatch } from './attributes-patch.merge';
import {
  normalizeOptionalId,
  validateProductTaxonomyWrite,
  type AttributeFieldDef,
  type ProductTaxonomyInput,
} from './product-taxonomy.validate';
import type { EleganceTaxonomyDoc, TaxonomyFieldError } from './taxonomy.types';
import { resolveFromSubcategory } from './product-taxonomy.validate';

export type TaxonomyWriteContext = {
  doc: EleganceTaxonomyDoc;
  knownProfileIds?: Set<string>;
  attributeFieldDefs?: Map<string, AttributeFieldDef>;
  allowUnknownAttributeKeys?: boolean;
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
  /** Prisma fragment for unpublished (live) write */
  liveData: Record<string, unknown>;
  /** Prisma fragment for published pending draft */
  draftData: Record<string, unknown>;
};

function asJson(value: Record<string, unknown> | null): Prisma.InputJsonValue | typeof Prisma.DbNull {
  return value == null ? Prisma.DbNull : (value as Prisma.InputJsonValue);
}

/**
 * Resolve next taxonomy state from current + patch, validate merged result, build Prisma fragments.
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
  let nextProfileId = profileIn !== undefined ? profileIn : current.profileId;

  if (subcategoryIn) {
    const resolved = resolveFromSubcategory(ctx.doc, subcategoryIn);
    if (resolved) {
      if (categoryIn === undefined && !current.category) nextCategory = resolved.category;
      if (profileIn === undefined && !current.profileId && resolved.profileId) {
        nextProfileId = resolved.profileId;
      }
    }
  }

  let nextAttributes = current.attributesJson;
  if (patch.attributes !== undefined) {
    const merged = mergeAttributesPatch(current.attributesJson, patch.attributes);
    if (!merged.ok) {
      errors.push(...merged.errors);
    } else {
      nextAttributes = merged.value;
    }
  }

  const validateInput: ProductTaxonomyInput = {
    category: nextCategory,
    subcategory: nextSubcategory,
    profileId: nextProfileId,
    attributes: patch.attributes !== undefined ? nextAttributes : undefined,
    allowOmittedSubcategory: true,
    knownProfileIds: ctx.knownProfileIds,
    attributeFieldDefs: ctx.attributeFieldDefs,
    allowUnknownAttributeKeys: ctx.allowUnknownAttributeKeys ?? true,
  };
  // Always validate taxonomy ids even when attributes omitted.
  if (patch.attributes === undefined) {
    validateInput.attributes = undefined;
  }
  errors.push(...validateProductTaxonomyWrite(ctx.doc, validateInput));

  // When attributes were patched, also validate final merged bag types.
  if (patch.attributes !== undefined && nextAttributes != null && typeof nextAttributes === 'object') {
    const again = validateProductTaxonomyWrite(ctx.doc, {
      ...validateInput,
      attributes: nextAttributes,
    });
    for (const e of again) {
      if (!errors.some((x) => x.fieldId === e.fieldId && x.code === e.code)) errors.push(e);
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
        next.attributesJson == null || typeof next.attributesJson !== 'object' || Array.isArray(next.attributesJson)
          ? null
          : (next.attributesJson as Record<string, unknown>),
      );
    }
  } else {
    if (patch.category !== undefined) liveData.category = next.category;
    if (patch.subcategory !== undefined) liveData.subcategory = next.subcategory;
    if (patch.profileId !== undefined) liveData.profileId = next.profileId;
    if (subcategoryIn && !patch.category && !current.category && next.category) {
      liveData.category = next.category;
    }
    if (subcategoryIn && !patch.profileId && !current.profileId && next.profileId) {
      liveData.profileId = next.profileId;
    }
    if (patch.attributes !== undefined) {
      liveData.attributesJson = asJson(
        next.attributesJson == null || typeof next.attributesJson !== 'object' || Array.isArray(next.attributesJson)
          ? null
          : (next.attributesJson as Record<string, unknown>),
      );
    }
  }

  return { errors, next, liveData, draftData };
}
