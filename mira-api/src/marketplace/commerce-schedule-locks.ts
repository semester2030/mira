/**
 * Shared partner-scoped schedule locks for bookings and merchant service edits.
 * Keys always include partnerId so independent partners never serialize on the same name.
 *
 * Protocol (RC6):
 * 1. Acquire partner coordination advisory lock first.
 * 2. Re-read that partner's services and expand the sharing graph.
 * 3. Acquire the full sorted set of service/resource advisories once.
 * 4. FOR UPDATE service rows in sorted id order.
 * Never acquire additional resource/service locks after holding a partial set —
 * that ordering inversion causes deadlock when the graph grows during wait.
 */

export function partnerScheduleCoordKey(partnerId: string): string {
  return `commerce-schedule-partner:${partnerId}`;
}

export function bookingResourceLockKey(partnerId: string, resourceId: string): string {
  return `commerce-booking-resource:${partnerId}:${resourceId}`;
}

export function bookingServiceLockKey(serviceId: string): string {
  return `commerce-booking-service:${serviceId}`;
}

/** Stable lock keys for schedule writes/bookings. Include every affected service id. */
export function scheduleLockKeys(opts: {
  partnerId: string;
  serviceIds: ReadonlyArray<string>;
  resourceIds: ReadonlyArray<string>;
}): string[] {
  const keys = new Set<string>();
  for (const serviceId of opts.serviceIds) {
    if (serviceId) keys.add(bookingServiceLockKey(serviceId));
  }
  for (const resourceId of opts.resourceIds) {
    if (resourceId) keys.add(bookingResourceLockKey(opts.partnerId, resourceId));
  }
  return [...keys].sort();
}

/**
 * Expand seed service/resources to the full partner-local sharing graph
 * (services sharing a resource, then resources on those services, transitively).
 * Independent partners never appear here — caller scopes the service list by partnerId.
 */
export function expandScheduleScope(
  services: ReadonlyArray<{ id: string; resourceIds: ReadonlyArray<string> }>,
  seedServiceIds: ReadonlyArray<string>,
  seedResourceIds: ReadonlyArray<string>,
): { serviceIds: string[]; resourceIds: string[] } {
  const serviceIds = new Set(seedServiceIds.filter(Boolean));
  const resourceIds = new Set(seedResourceIds.filter(Boolean));
  let changed = true;
  while (changed) {
    changed = false;
    for (const svc of services) {
      const overlapsResource = svc.resourceIds.some((r) => r && resourceIds.has(r));
      const overlapsService = serviceIds.has(svc.id);
      if (!overlapsResource && !overlapsService) continue;
      if (!serviceIds.has(svc.id)) {
        serviceIds.add(svc.id);
        changed = true;
      }
      for (const r of svc.resourceIds) {
        if (r && !resourceIds.has(r)) {
          resourceIds.add(r);
          changed = true;
        }
      }
    }
  }
  return {
    serviceIds: [...serviceIds].sort(),
    resourceIds: [...resourceIds].sort(),
  };
}

type TxLike = {
  $executeRaw: (query: TemplateStringsArray, ...values: unknown[]) => Promise<unknown>;
  $queryRaw?: (query: TemplateStringsArray, ...values: unknown[]) => Promise<unknown>;
};

/** Acquire advisory xact locks in sorted order to avoid deadlocks. */
export async function acquireScheduleLocks(tx: TxLike, keys: ReadonlyArray<string>): Promise<void> {
  for (const key of keys) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
  }
}

/** Lock service rows in sorted id order after advisory keys. */
export async function lockServiceRows(tx: TxLike, serviceIds: ReadonlyArray<string>): Promise<void> {
  const ids = [...new Set(serviceIds.filter(Boolean))].sort();
  for (const id of ids) {
    if (!tx.$queryRaw) continue;
    await tx.$queryRaw`SELECT id FROM services WHERE id = ${id} FOR UPDATE`;
  }
}

/**
 * Full partner schedule protocol: coordination → re-read → expand → sorted locks once.
 * `loadServices` must read from the same transaction after the coordination lock is held.
 */
export async function lockPartnerScheduleScope(
  tx: TxLike,
  opts: {
    partnerId: string;
    seedServiceIds: ReadonlyArray<string>;
    seedResourceIds: ReadonlyArray<string>;
    loadServices: () => Promise<Array<{ id: string; resourceIds: ReadonlyArray<string> }>>;
  },
): Promise<{ serviceIds: string[]; resourceIds: string[] }> {
  if (!opts.partnerId) {
    throw new Error('partnerId required for schedule protocol');
  }
  await acquireScheduleLocks(tx, [partnerScheduleCoordKey(opts.partnerId)]);
  const services = await opts.loadServices();
  const scope = expandScheduleScope(services, opts.seedServiceIds, opts.seedResourceIds);
  await acquireScheduleLocks(
    tx,
    scheduleLockKeys({
      partnerId: opts.partnerId,
      serviceIds: scope.serviceIds,
      resourceIds: scope.resourceIds,
    }),
  );
  const rowIds = scope.serviceIds.filter((id) => id && !String(id).startsWith('create:'));
  await lockServiceRows(tx, rowIds);
  // Test-only barrier AFTER full protocol locks — never used in production.
  await maybeTestScheduleGate();
  return scope;
}

/** Spin until MIRA_TEST_SCHEDULE_GATE is cleared. Empty/unset = no-op. */
export async function maybeTestScheduleGate(): Promise<void> {
  if (process.env.MIRA_TEST_SCHEDULE_GATE !== 'hold') return;
  const started = Date.now();
  while (process.env.MIRA_TEST_SCHEDULE_GATE === 'hold') {
    if (Date.now() - started > 20_000) {
      throw new Error('MIRA_TEST_SCHEDULE_GATE hold timed out');
    }
    await new Promise((r) => setTimeout(r, 15));
  }
}
