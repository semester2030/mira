/**
 * Shared partner-scoped schedule locks for bookings and merchant service edits.
 * Keys always include partnerId so independent partners never serialize on the same name.
 */
export function bookingResourceLockKey(partnerId: string, resourceId: string): string {
  return `commerce-booking-resource:${partnerId}:${resourceId}`;
}

export function bookingServiceLockKey(serviceId: string): string {
  return `commerce-booking-service:${serviceId}`;
}

/** Stable lock keys for a service schedule write or booking against its windows. */
export function scheduleLockKeys(opts: {
  partnerId: string;
  serviceId: string;
  resourceIds: ReadonlyArray<string>;
}): string[] {
  const keys = new Set<string>();
  keys.add(bookingServiceLockKey(opts.serviceId));
  for (const resourceId of opts.resourceIds) {
    if (resourceId) keys.add(bookingResourceLockKey(opts.partnerId, resourceId));
  }
  return [...keys].sort();
}

type TxLike = {
  $executeRaw: (query: TemplateStringsArray, ...values: unknown[]) => Promise<unknown>;
};

/** Acquire advisory xact locks in sorted order to avoid deadlocks. */
export async function acquireScheduleLocks(tx: TxLike, keys: ReadonlyArray<string>): Promise<void> {
  for (const key of keys) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
  }
}
