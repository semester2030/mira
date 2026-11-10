/**
 * Shared attributes PATCH merge for E1 closure.
 * Contract:
 * - omitted key → keep
 * - empty patch {} → keep existing bag unchanged
 * - array value → replace as one unit (no concat)
 * - nested object → deep-merge keys
 * - top-level null for a key → clear that key (intentional)
 * - nested null → rejected (e.g. dimensionsCm.w=null)
 * - attributes === null as whole bag → forbidden
 */

export type AttributesMergeError = {
  fieldId: string;
  code: string;
  messageAr: string;
};

export type AttributesMergeResult =
  | { ok: true; value: Record<string, unknown> | null; unchanged: boolean }
  | { ok: false; errors: AttributesMergeError[] };

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function cloneBag(v: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(v)) as Record<string, unknown>;
}

function mergeNested(
  base: Record<string, unknown>,
  patch: Record<string, unknown>,
  path: string,
  errors: AttributesMergeError[],
): Record<string, unknown> {
  const out = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    const fieldId = `${path}.${key}`;
    if (value === undefined) continue;
    if (value === null) {
      const isDim =
        fieldId.startsWith('dimensionsCm.') || fieldId.startsWith('itemDimensions.');
      errors.push({
        fieldId,
        code: isDim ? 'DIMENSIONS_NULL' : 'ATTRIBUTES_NESTED_NULL',
        messageAr: isDim
          ? 'البعد لا يقبل null'
          : 'لا يُقبل null داخل كائن متداخل؛ أرسل قيمة صالحة أو احذف المفتاح من الطبقة العليا',
      });
      continue;
    }
    if (Array.isArray(value)) {
      out[key] = value;
      continue;
    }
    if (isPlainObject(value) && isPlainObject(out[key])) {
      out[key] = mergeNested(out[key] as Record<string, unknown>, value, fieldId, errors);
      continue;
    }
    if (isPlainObject(value)) {
      out[key] = mergeNested({}, value, fieldId, errors);
      continue;
    }
    out[key] = value;
  }
  return out;
}

export function mergeAttributesPatch(
  current: unknown,
  patch: unknown,
  opts?: { clearAll?: boolean },
): AttributesMergeResult {
  const errors: AttributesMergeError[] = [];

  if (patch === undefined) {
    if (current == null) return { ok: true, value: null, unchanged: true };
    if (!isPlainObject(current)) {
      return {
        ok: false,
        errors: [{ fieldId: 'attributes', code: 'ATTRIBUTES_CURRENT_TYPE', messageAr: 'الخصائص الحالية تالفة' }],
      };
    }
    return { ok: true, value: cloneBag(current), unchanged: true };
  }

  if (patch === null) {
    return {
      ok: false,
      errors: [
        {
          fieldId: 'attributes',
          code: 'ATTRIBUTES_NULL_FORBIDDEN',
          messageAr: 'null لكامل الخصائص غير مسموح؛ امسح مفاتيح محددة بـ null على المستوى الأعلى',
        },
      ],
    };
  }

  if (!isPlainObject(patch)) {
    return {
      ok: false,
      errors: [
        {
          fieldId: 'attributes',
          code: 'ATTRIBUTES_TYPE',
          messageAr: 'خصائص المنتج يجب أن تكون كائنًا وليس مصفوفة',
        },
      ],
    };
  }

  if (opts?.clearAll === true) {
    return { ok: true, value: null, unchanged: false };
  }

  if (current != null && !isPlainObject(current)) {
    return {
      ok: false,
      errors: [{ fieldId: 'attributes', code: 'ATTRIBUTES_CURRENT_TYPE', messageAr: 'الخصائص الحالية تالفة' }],
    };
  }

  const base: Record<string, unknown> = current == null ? {} : cloneBag(current as Record<string, unknown>);

  // Empty object patch: keep existing (do not wipe).
  if (Object.keys(patch).length === 0) {
    return { ok: true, value: Object.keys(base).length ? base : null, unchanged: true };
  }

  const merged = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    if (value === null) {
      delete merged[key];
      continue;
    }
    if (Array.isArray(value)) {
      merged[key] = value;
      continue;
    }
    if (isPlainObject(value) && isPlainObject(merged[key])) {
      merged[key] = mergeNested(merged[key] as Record<string, unknown>, value, key, errors);
      continue;
    }
    if (isPlainObject(value)) {
      merged[key] = mergeNested({}, value, key, errors);
      continue;
    }
    merged[key] = value;
  }

  if (errors.length) return { ok: false, errors };
  return { ok: true, value: Object.keys(merged).length ? merged : null, unchanged: false };
}
