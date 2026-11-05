/**
 * P5 catalog availability — reuses commerce.types slot builders (same rules as booking listing).
 * Search never creates holds; it only checks whether ≥1 bookable slot exists on the date.
 */

import {
  ACTIVE_BOOKING_STATUSES,
  applyPartnerCapsToCalendar,
  buildDaySlots,
  capacityBearingWindowsFromDocument,
  findResourceCapacityConflicts,
  normalizeAvailabilityDocument,
  partnerResourceCapacities,
  resourceIdsForDate,
  resourceIdsFromAvailabilityDocument,
  type AvailabilityDocument,
  type AvailabilityWindow,
} from './commerce.types';

export { ACTIVE_BOOKING_STATUSES };

export type CatalogAvailabilityServiceInput = {
  id: string;
  partnerId: string;
  bookingEnabled: boolean;
  durationMin: number;
  availabilityJson: unknown;
  /** When set, service must advertise this branch to pass branch-scoped availableOn. */
  branchId?: string | null;
};

export type PartnerCapBundle = {
  windows: AvailabilityWindow[];
  calendar: AvailabilityDocument;
  conflictedResourceIds: Set<string>;
};

/** Build partner-capped calendar for one service document using sibling capacity lists. */
export function partnerCapBundleForService(
  serviceAvailabilityJson: unknown,
  siblingAvailabilityJsons: readonly unknown[],
): PartnerCapBundle {
  const resourceIds = resourceIdsFromAvailabilityDocument(serviceAvailabilityJson);
  const baseDoc = normalizeAvailabilityDocument(serviceAvailabilityJson);
  if (resourceIds.length === 0) {
    return { windows: baseDoc.windows, calendar: baseDoc, conflictedResourceIds: new Set() };
  }
  const lists = siblingAvailabilityJsons.map((j) => capacityBearingWindowsFromDocument(j));
  const conflicts = findResourceCapacityConflicts(lists).filter((c) => resourceIds.includes(c.resourceId));
  const caps = partnerResourceCapacities(lists);
  const conflicted = new Set(conflicts.map((c) => c.resourceId));
  const calendar = applyPartnerCapsToCalendar(baseDoc, caps, conflicted);
  return { windows: calendar.windows, calendar, conflictedResourceIds: conflicted };
}

export type HeldInterval = { startsAt: Date; endsAt: Date; resourceId: string };

/**
 * True iff the service is booking-enabled and has ≥1 slot with remaining>0 on dateKey,
 * using the same buildDaySlots/checkSlot rules as CommerceService.serviceAvailability.
 */
export function serviceHasBookableSlotOnDate(args: {
  service: CatalogAvailabilityServiceInput;
  dateKey: string;
  bundle: PartnerCapBundle;
  held: ReadonlyArray<HeldInterval>;
  now?: Date;
  /** Optional required branch — must match service.branchId when provided. */
  requiredBranchIds?: string[];
}): boolean {
  const { service, dateKey, bundle, held } = args;
  const now = args.now ?? new Date();
  if (!service.bookingEnabled) return false;
  if (!Number.isInteger(service.durationMin) || service.durationMin < 5) return false;
  if (args.requiredBranchIds && args.requiredBranchIds.length > 0) {
    if (!service.branchId || !args.requiredBranchIds.includes(service.branchId)) return false;
  }
  // Conflicted resources are already stripped/locked via applyPartnerCapsToCalendar.
  const slots = buildDaySlots(dateKey, service.durationMin, bundle.windows, held, now, bundle.calendar);
  return slots.some((s) => s.available);
}

/** Resource ids that can hold capacity for this service on the date (weekly + specials). */
export function resourceIdsForServiceDate(
  serviceAvailabilityJson: unknown,
  calendar: AvailabilityDocument,
  dateKey: string,
  windows: AvailabilityWindow[],
): string[] {
  return [
    ...new Set([
      ...windows.map((w) => w.resourceId),
      ...resourceIdsForDate(dateKey, calendar),
      ...resourceIdsFromAvailabilityDocument(serviceAvailabilityJson),
    ]),
  ].filter(Boolean);
}
