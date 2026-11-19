import { createHash } from 'node:crypto';

export type VisitItemInput = {
  serviceId: string;
  startsAt: Date;
  resourceId: string;
};

export function parseVisitItems(raw: unknown): VisitItemInput[] {
  if (!Array.isArray(raw) || raw.length < 2) {
    throw Object.assign(new Error('VISIT_ITEMS_REQUIRED'), { code: 'VISIT_ITEMS_REQUIRED' });
  }
  // RC4 journey-1: consecutive visit is exactly two services the customer chose.
  if (raw.length !== 2) {
    throw Object.assign(new Error('VISIT_ITEMS_EXACTLY_TWO'), { code: 'VISIT_ITEMS_EXACTLY_TWO' });
  }
  return raw.map((row, index) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      throw Object.assign(new Error('VISIT_ITEM_INVALID'), { code: 'VISIT_ITEM_INVALID', index });
    }
    const o = row as Record<string, unknown>;
    const serviceId = typeof o.serviceId === 'string' ? o.serviceId.trim() : '';
    const startsAt = typeof o.startsAt === 'string' ? new Date(o.startsAt) : new Date(NaN);
    if (!serviceId || Number.isNaN(startsAt.getTime())) {
      throw Object.assign(new Error('VISIT_ITEM_INVALID'), { code: 'VISIT_ITEM_INVALID', index });
    }
    const resourceId = typeof o.resourceId === 'string' ? o.resourceId.trim() : '';
    return { serviceId, startsAt, resourceId };
  });
}

export function visitRequestFingerprint(input: {
  mode: string;
  branchId: string;
  contactName: string;
  contactPhone: string;
  notes: string | null;
  items: Array<{ serviceId: string; startsAt: string; resourceId: string }>;
}): string {
  const payload = JSON.stringify(input);
  return createHash('sha256').update(payload).digest('hex');
}
