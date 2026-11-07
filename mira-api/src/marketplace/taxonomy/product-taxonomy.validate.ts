import type { EleganceTaxonomyDoc, TaxonomyFieldError, TaxonomyNode } from './taxonomy.types';

export type ProductTaxonomyInput = {
  category?: string | null;
  subcategory?: string | null;
  profileId?: string | null;
  attributes?: unknown;
  /** When true, omitted subcategory is allowed (legacy rows / patch without field). */
  allowOmittedSubcategory?: boolean;
};

function nodeMap(doc: EleganceTaxonomyDoc): Map<string, TaxonomyNode> {
  return new Map(doc.nodes.map((n) => [n.id, n]));
}

function resolveWriteEnabled(node: TaxonomyNode, nodes: Map<string, TaxonomyNode>): boolean {
  if (node.writeEnabled === false) return false;
  if (node.writeEnabled === true) return true;
  if (node.parentId) {
    const parent = nodes.get(node.parentId);
    if (parent) return resolveWriteEnabled(parent, nodes);
  }
  return true;
}

/**
 * Validate category/subcategory/profileId against elegance taxonomy.
 * Server-authoritative write gate for E1.
 */
export function validateProductTaxonomyWrite(
  doc: EleganceTaxonomyDoc,
  input: ProductTaxonomyInput,
): TaxonomyFieldError[] {
  const errors: TaxonomyFieldError[] = [];
  const nodes = nodeMap(doc);

  if (input.attributes !== undefined && input.attributes !== null) {
    if (typeof input.attributes !== 'object' || Array.isArray(input.attributes)) {
      errors.push({
        fieldId: 'attributes',
        code: 'ATTRIBUTES_TYPE',
        messageAr: 'خصائص المنتج يجب أن تكون كائنًا وليس مصفوفة',
      });
    } else {
      const attrs = input.attributes as Record<string, unknown>;
      const dim = attrs.dimensionsCm;
      if (dim !== undefined && dim !== null) {
        if (typeof dim !== 'object' || Array.isArray(dim)) {
          errors.push({ fieldId: 'dimensionsCm', code: 'DIMENSIONS_TYPE', messageAr: 'الأبعاد يجب أن تكون كائنًا' });
        } else {
          for (const axis of ['w', 'h', 'd'] as const) {
            const v = (dim as Record<string, unknown>)[axis];
            if (v === undefined) continue;
            if (v === null) {
              errors.push({ fieldId: `dimensionsCm.${axis}`, code: 'DIMENSIONS_NULL', messageAr: 'البعد لا يقبل null' });
            } else if (typeof v !== 'number' || !Number.isFinite(v)) {
              errors.push({ fieldId: `dimensionsCm.${axis}`, code: 'DIMENSIONS_TYPE', messageAr: 'البعد يجب أن يكون رقمًا' });
            } else if (v < 0) {
              errors.push({ fieldId: `dimensionsCm.${axis}`, code: 'DIMENSIONS_MIN', messageAr: 'البعد لا يقبل قيمة سالبة' });
            }
          }
        }
      }
    }
  }

  const sub = input.subcategory;
  if (sub === undefined || sub === null || sub === '') {
    if (!input.allowOmittedSubcategory) {
      // create may omit subcategory (legacy path); caller sets allowOmittedSubcategory
    }
    // If category alone provided without subcategory — ok for legacy
    return errors;
  }

  if (typeof sub !== 'string') {
    errors.push({ fieldId: 'subcategory', code: 'SUBCATEGORY_TYPE', messageAr: 'التصنيف الفرعي غير صالح' });
    return errors;
  }

  const node = nodes.get(sub);
  if (!node) {
    errors.push({ fieldId: 'subcategory', code: 'SUBCATEGORY_UNKNOWN', messageAr: 'التصنيف الفرعي غير معروف' });
    return errors;
  }
  if (!node.active) {
    errors.push({ fieldId: 'subcategory', code: 'SUBCATEGORY_INACTIVE', messageAr: 'التصنيف الفرعي غير مفعّل' });
  }
  if (node.browseOnly || sub.endsWith('.all') || sub === 'elegance.all' || sub === 'all') {
    errors.push({
      fieldId: 'subcategory',
      code: 'SUBCATEGORY_BROWSE_ONLY',
      messageAr: 'لا يمكن حفظ خيار التصفح «الكل» كتصنيف للمنتج',
    });
  }
  if (!resolveWriteEnabled(node, nodes)) {
    errors.push({
      fieldId: 'subcategory',
      code: 'SUBCATEGORY_WRITE_DISABLED',
      messageAr: 'هذا التصنيف غير جاهز للحفظ بعد (مرحلة لاحقة)',
    });
  }

  const expectedCategory = node.parentId;
  if (input.category != null && input.category !== '' && expectedCategory && input.category !== expectedCategory) {
    errors.push({
      fieldId: 'category',
      code: 'CATEGORY_SUBCATEGORY_MISMATCH',
      messageAr: 'القسم لا يطابق التصنيف الفرعي',
    });
  }

  const expectedProfile = node.profileId || (expectedCategory ? nodes.get(expectedCategory)?.profileId : undefined);
  if (input.profileId != null && input.profileId !== '' && expectedProfile && input.profileId !== expectedProfile) {
    errors.push({
      fieldId: 'profileId',
      code: 'PROFILE_SUBCATEGORY_MISMATCH',
      messageAr: 'ملف الحقول لا يطابق التصنيف الفرعي',
    });
  }

  return errors;
}

/** Resolve canonical category + profileId from subcategory when valid. */
export function resolveFromSubcategory(
  doc: EleganceTaxonomyDoc,
  subcategory: string,
): { category: string; profileId: string | null } | null {
  const node = doc.nodes.find((n) => n.id === subcategory);
  if (!node || node.browseOnly || !node.parentId) return null;
  const parent = doc.nodes.find((n) => n.id === node.parentId);
  return {
    category: node.parentId,
    profileId: node.profileId ?? parent?.profileId ?? null,
  };
}
