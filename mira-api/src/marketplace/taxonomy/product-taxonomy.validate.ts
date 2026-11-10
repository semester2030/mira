import type { EleganceTaxonomyDoc, TaxonomyFieldError, TaxonomyNode } from './taxonomy.types';

export type AttributeFieldDef = {
  id: string;
  type: string;
  values?: unknown[];
  min?: number | null;
  max?: number | null;
  /** Registry dependsOn — e.g. heelHeightCm only when subcategory is shoes.heel. */
  dependsOn?: { field?: string; includes?: string[]; equals?: unknown } | null;
  /** When includes "manual", allow stable custom:<slug> values in addition to enum ids. */
  inputModes?: string[] | null;
};

export type ProductTaxonomyInput = {
  category?: string | null;
  subcategory?: string | null;
  profileId?: string | null;
  attributes?: unknown;
  /** When true, omitted subcategory is allowed (legacy rows / patch without field). */
  allowOmittedSubcategory?: boolean;
  /** Known registry profile ids — reject unknown profileId. */
  knownProfileIds?: Set<string>;
  /** Profile field defs for attributes validation (id → def). Unknown keys rejected when set. */
  attributeFieldDefs?: Map<string, AttributeFieldDef>;
  /** When true, unknown attribute keys are kept (legacy) but typed when known. */
  allowUnknownAttributeKeys?: boolean;
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

function allowedValueIds(def: AttributeFieldDef): Set<string> | null {
  const values = def.values;
  if (!Array.isArray(values) || values.length === 0) return null;
  const ids = new Set<string>();
  for (const entry of values) {
    if (typeof entry === 'string') ids.add(entry);
    else if (entry && typeof entry === 'object') {
      const o = entry as { id?: string; value?: string };
      if (typeof o.id === 'string') ids.add(o.id);
      if (typeof o.value === 'string') ids.add(o.value);
    }
  }
  return ids.size ? ids : null;
}

function allowsManualCustomIds(def: AttributeFieldDef): boolean {
  return Array.isArray(def.inputModes) && def.inputModes.includes('manual');
}

function isStableCustomAttrId(id: string): boolean {
  return /^custom:[A-Za-z0-9\u0600-\u06FF\-_.]{1,48}$/.test(id);
}

const CUSTOM_ATTR_LABELS_KEY = 'customAttrLabels';

function validateDimensionBag(
  fieldId: string,
  dim: unknown,
  errors: TaxonomyFieldError[],
): void {
  if (dim === undefined || dim === null) return;
  if (typeof dim !== 'object' || Array.isArray(dim)) {
    errors.push({ fieldId, code: 'DIMENSIONS_TYPE', messageAr: 'الأبعاد يجب أن تكون كائنًا' });
    return;
  }
  for (const axis of ['w', 'h', 'd'] as const) {
    const v = (dim as Record<string, unknown>)[axis];
    if (v === undefined) continue;
    if (v === null) {
      errors.push({
        fieldId: `${fieldId}.${axis}`,
        code: 'DIMENSIONS_NULL',
        messageAr: 'البعد لا يقبل null',
      });
    } else if (typeof v !== 'number' || !Number.isFinite(v)) {
      errors.push({
        fieldId: `${fieldId}.${axis}`,
        code: 'DIMENSIONS_TYPE',
        messageAr: 'البعد يجب أن يكون رقمًا',
      });
    } else if (v < 0) {
      errors.push({
        fieldId: `${fieldId}.${axis}`,
        code: 'DIMENSIONS_MIN',
        messageAr: 'البعد لا يقبل قيمة سالبة',
      });
    }
  }
}

/** Keep itemDimensions and legacy dimensionsCm as one authoritative bag. */
export function unifyDimensionSources(
  attrs: Record<string, unknown>,
): TaxonomyFieldError[] {
  const errors: TaxonomyFieldError[] = [];
  const item = attrs.itemDimensions;
  const legacy = attrs.dimensionsCm;
  const itemObj = item != null && typeof item === 'object' && !Array.isArray(item) ? (item as Record<string, unknown>) : null;
  const legacyObj =
    legacy != null && typeof legacy === 'object' && !Array.isArray(legacy)
      ? (legacy as Record<string, unknown>)
      : null;
  if (itemObj && legacyObj) {
    for (const axis of ['w', 'h', 'd'] as const) {
      if (!(axis in itemObj) || !(axis in legacyObj)) continue;
      if (itemObj[axis] !== legacyObj[axis]) {
        errors.push({
          fieldId: `itemDimensions.${axis}`,
          code: 'DIMENSIONS_CONFLICT',
          messageAr: 'تعارض بين itemDimensions و dimensionsCm',
        });
      }
    }
    // Canonical field wins for storage after conflict reporting.
    attrs.dimensionsCm = { ...itemObj };
  } else if (itemObj && !legacyObj) {
    attrs.dimensionsCm = { ...itemObj };
  } else if (!itemObj && legacyObj) {
    attrs.itemDimensions = { ...legacyObj };
  }
  return errors;
}

function validateCustomAttrLabels(
  raw: unknown,
  errors: TaxonomyFieldError[],
): void {
  if (raw == null) return;
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    errors.push({
      fieldId: CUSTOM_ATTR_LABELS_KEY,
      code: 'CUSTOM_LABELS_TYPE',
      messageAr: 'خريطة القيم اليدوية يجب أن تكون كائنًا',
    });
    return;
  }
  for (const [fieldId, bag] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof bag !== 'object' || bag == null || Array.isArray(bag)) {
      errors.push({
        fieldId: `${CUSTOM_ATTR_LABELS_KEY}.${fieldId}`,
        code: 'CUSTOM_LABELS_TYPE',
        messageAr: 'قيم التسميات اليدوية يجب أن تكون كائنًا',
      });
      continue;
    }
    for (const [id, label] of Object.entries(bag as Record<string, unknown>)) {
      if (!isStableCustomAttrId(id)) {
        errors.push({
          fieldId: `${CUSTOM_ATTR_LABELS_KEY}.${fieldId}`,
          code: 'CUSTOM_LABELS_ID',
          messageAr: 'معرّف قيمة يدوية غير صالح',
        });
      }
      if (typeof label !== 'string' || !label.trim() || label.length > 80) {
        errors.push({
          fieldId: `${CUSTOM_ATTR_LABELS_KEY}.${fieldId}`,
          code: 'CUSTOM_LABELS_TEXT',
          messageAr: 'نص القيمة اليدوية غير صالح',
        });
      }
    }
  }
}

function validateAttributeValue(
  fieldId: string,
  def: AttributeFieldDef,
  raw: unknown,
): TaxonomyFieldError | null {
  if (raw === null || raw === undefined) return null;
  const t = def.type;
  if (t === 'array' || t === 'string[]' || t === 'multiSelect' || t === 'tags') {
    if (!Array.isArray(raw)) {
      return { fieldId, code: 'ATTRIBUTE_TYPE', messageAr: `الحقل ${fieldId} يجب أن يكون مصفوفة` };
    }
    const allowed = allowedValueIds(def);
    const manualOk = allowsManualCustomIds(def);
    for (const item of raw) {
      if (typeof item !== 'string') {
        return { fieldId, code: 'ATTRIBUTE_VALUE_TYPE', messageAr: `قيم ${fieldId} يجب أن تكون نصوصًا` };
      }
      if (allowed && !allowed.has(item)) {
        if (manualOk && isStableCustomAttrId(item)) continue;
        return { fieldId, code: 'ATTRIBUTE_VALUE_UNKNOWN', messageAr: `قيمة غير معروفة في ${fieldId}` };
      }
    }
    return null;
  }
  if (t === 'object' || fieldId === 'itemDimensions') {
    if (raw === null) return null;
    if (typeof raw !== 'object' || Array.isArray(raw)) {
      return { fieldId, code: 'ATTRIBUTE_TYPE', messageAr: `الحقل ${fieldId} يجب أن يكون كائن أبعاد` };
    }
    for (const axis of ['w', 'h', 'd'] as const) {
      const v = (raw as Record<string, unknown>)[axis];
      if (v === undefined) continue;
      if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) {
        return {
          fieldId: `${fieldId}.${axis}`,
          code: 'ATTRIBUTE_TYPE',
          messageAr: `البعد ${axis} يجب أن يكون رقمًا غير سالب`,
        };
      }
    }
    return null;
  }
  if (t === 'number' || t === 'integer') {
    if (typeof raw !== 'number' || !Number.isFinite(raw)) {
      return { fieldId, code: 'ATTRIBUTE_TYPE', messageAr: `الحقل ${fieldId} يجب أن يكون رقمًا` };
    }
    if (t === 'integer' && !Number.isInteger(raw)) {
      return { fieldId, code: 'ATTRIBUTE_TYPE', messageAr: `الحقل ${fieldId} يجب أن يكون عددًا صحيحًا` };
    }
    if (def.min != null && raw < def.min) {
      return { fieldId, code: 'ATTRIBUTE_MIN', messageAr: `الحقل ${fieldId} أقل من الحد` };
    }
    if (def.max != null && raw > def.max) {
      return { fieldId, code: 'ATTRIBUTE_MAX', messageAr: `الحقل ${fieldId} أكبر من الحد` };
    }
    return null;
  }
  if (t === 'boolean') {
    if (typeof raw !== 'boolean') {
      return { fieldId, code: 'ATTRIBUTE_TYPE', messageAr: `الحقل ${fieldId} يجب أن يكون منطقيًا` };
    }
    return null;
  }
  if (t === 'object' || t === 'json') {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
      return { fieldId, code: 'ATTRIBUTE_TYPE', messageAr: `الحقل ${fieldId} يجب أن يكون كائنًا` };
    }
    return null;
  }
  // string / text / enum / select
  if (typeof raw !== 'string') {
    return { fieldId, code: 'ATTRIBUTE_TYPE', messageAr: `الحقل ${fieldId} يجب أن يكون نصًا` };
  }
  const allowed = allowedValueIds(def);
  if (allowed && !allowed.has(raw)) {
    if (allowsManualCustomIds(def) && isStableCustomAttrId(raw)) return null;
    return { fieldId, code: 'ATTRIBUTE_VALUE_UNKNOWN', messageAr: `قيمة غير معروفة في ${fieldId}` };
  }
  return null;
}

export function attributeDependsVisible(
  def: AttributeFieldDef | undefined | null,
  ctx: { category?: string | null; subcategory?: string | null; [k: string]: unknown },
): boolean {
  if (!def || !def.dependsOn) return true;
  const dep = def.dependsOn;
  if (dep.field === 'subcategory' && Array.isArray(dep.includes)) {
    return dep.includes.indexOf(String(ctx.subcategory || '')) >= 0;
  }
  if (dep.field && Object.prototype.hasOwnProperty.call(ctx, dep.field)) {
    const cur = ctx[dep.field];
    if (Array.isArray(dep.includes)) return dep.includes.indexOf(cur as string) >= 0;
    if (dep.equals != null) return cur === dep.equals;
  }
  return true;
}

/** Drop attribute keys that fail dependsOn for the current category/subcategory. */
export function pruneAttributesByDependsOn(
  attrs: Record<string, unknown> | null | undefined,
  defs: Map<string, AttributeFieldDef> | undefined,
  ctx: { category?: string | null; subcategory?: string | null },
): Record<string, unknown> | null {
  if (attrs == null) return null;
  if (!defs) return { ...attrs };
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(attrs)) {
    const def = defs.get(key);
    if (def && !attributeDependsVisible(def, ctx)) continue;
    out[key] = value;
  }
  return out;
}

function validateAttributesBag(
  attrs: Record<string, unknown>,
  input: ProductTaxonomyInput,
  errors: TaxonomyFieldError[],
) {
  validateDimensionBag('dimensionsCm', attrs.dimensionsCm, errors);
  validateDimensionBag('itemDimensions', attrs.itemDimensions, errors);
  errors.push(...unifyDimensionSources(attrs));
  if (Object.prototype.hasOwnProperty.call(attrs, CUSTOM_ATTR_LABELS_KEY)) {
    validateCustomAttrLabels(attrs[CUSTOM_ATTR_LABELS_KEY], errors);
  }

  const defs = input.attributeFieldDefs;
  if (!defs) return;
  const depCtx = { category: input.category, subcategory: input.subcategory };
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'dimensionsCm' || key === 'itemDimensions') continue; // structural check above
    if (key === CUSTOM_ATTR_LABELS_KEY) continue; // meta map validated above
    const def = defs.get(key);
    if (!def) {
      if (!input.allowUnknownAttributeKeys) {
        errors.push({
          fieldId: key,
          code: 'ATTRIBUTE_UNKNOWN',
          messageAr: `خاصية غير مسموحة لهذا الملف: ${key}`,
        });
      }
      continue;
    }
    if (value != null && !attributeDependsVisible(def, depCtx)) {
      errors.push({
        fieldId: key,
        code: 'ATTRIBUTE_DEPENDS_ON',
        messageAr: `الحقل ${key} غير منطبق على التصنيف الحالي`,
      });
      continue;
    }
    const err = validateAttributeValue(key, def, value);
    if (err) errors.push(err);
  }
}

/**
 * Validate category/subcategory/profileId/attributes against elegance taxonomy (+ optional registry).
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
      validateAttributesBag(input.attributes as Record<string, unknown>, input, errors);
    }
  }

  // profileId without subcategory must still be a known profile when known set provided.
  if (input.profileId != null && input.profileId !== '') {
    if (typeof input.profileId !== 'string') {
      errors.push({ fieldId: 'profileId', code: 'PROFILE_TYPE', messageAr: 'ملف الحقول غير صالح' });
    } else if (input.knownProfileIds && !input.knownProfileIds.has(input.profileId)) {
      errors.push({
        fieldId: 'profileId',
        code: 'PROFILE_UNKNOWN',
        messageAr: 'ملف الحقول غير معروف',
      });
    }
  }

  if (input.category != null && input.category !== '') {
    if (typeof input.category !== 'string') {
      errors.push({ fieldId: 'category', code: 'CATEGORY_TYPE', messageAr: 'القسم غير صالح' });
    } else {
      const catNode = nodes.get(input.category);
      // If present in taxonomy, it must be a root section — not a leaf used as category.
      if (catNode && catNode.parentId != null) {
        errors.push({
          fieldId: 'category',
          code: 'CATEGORY_NOT_ROOT',
          messageAr: 'معرّف الفرع لا يُستخدم كقسم رئيسي',
        });
      }
    }
  }

  const sub = input.subcategory;
  if (sub === undefined || sub === null || sub === '') {
    // Omitted/null/empty subcategory: legacy path — do not TypeError.
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
  // Root category ids (parentId null) are not valid product subcategories.
  if (node.parentId == null) {
    errors.push({
      fieldId: 'subcategory',
      code: 'SUBCATEGORY_IS_CATEGORY',
      messageAr: 'لا يمكن حفظ القسم الرئيسي كتصنيف فرعي للمنتج',
    });
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

/** Safe normalize for optional string fields — never calls trim on null. */
export function normalizeOptionalId(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') return null;
  const t = value.trim();
  return t === '' ? null : t;
}
