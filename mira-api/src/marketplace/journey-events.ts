/** Journey events in the existing database. No names, phones, emails, or images. */

export type JourneyEventName =
  | 'service_viewed'
  | 'order_started'
  | 'order_completed'
  | 'order_failed'
  | 'booking_started'
  | 'booking_completed'
  | 'booking_failed';

export interface JourneyEvent {
  name: JourneyEventName;
  kind: 'service' | 'order' | 'booking';
  at: string;
  subjectId?: string;
  code?: string;
}

/** Events older than this are deleted on the next write. */
export const JOURNEY_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
/** Newest events kept after the age cutoff. */
export const JOURNEY_MAX_EVENTS = 2000;

type JourneyRow = {
  id: string;
  name: string;
  kind: string;
  subjectId: string | null;
  code: string | null;
  createdAt: Date;
};

export type JourneyStore = {
  journeyEvent: {
    create: (args: { data: { name: string; kind: string; subjectId: string | null; code: string | null } }) => Promise<unknown>;
    findMany: (args: {
      where?: { createdAt?: { lt: Date } };
      orderBy?: { createdAt: 'asc' | 'desc' };
      take?: number;
      select?: { id: true };
    }) => Promise<JourneyRow[]>;
    deleteMany: (args: { where: { createdAt?: { lt: Date }; id?: { in: string[] } } }) => Promise<unknown>;
    count: () => Promise<number>;
  };
};

const memory: JourneyEvent[] = [];

function hasTable(store: unknown): store is JourneyStore {
  return Boolean(store && typeof store === 'object' && 'journeyEvent' in store && (store as JourneyStore).journeyEvent?.create);
}

function toEvent(row: JourneyRow): JourneyEvent {
  return {
    name: row.name as JourneyEventName,
    kind: row.kind as JourneyEvent['kind'],
    at: row.createdAt.toISOString(),
    ...(row.subjectId ? { subjectId: row.subjectId } : {}),
    ...(row.code ? { code: row.code } : {}),
  };
}

async function persist(store: JourneyStore, event: JourneyEvent): Promise<void> {
  const cutoff = new Date(Date.now() - JOURNEY_RETENTION_MS);
  await store.journeyEvent.deleteMany({ where: { createdAt: { lt: cutoff } } });
  await store.journeyEvent.create({
    data: {
      name: event.name,
      kind: event.kind,
      subjectId: event.subjectId ?? null,
      code: event.code ?? null,
    },
  });
  const overflow = (await store.journeyEvent.count()) - JOURNEY_MAX_EVENTS;
  if (overflow > 0) {
    const oldest = await store.journeyEvent.findMany({
      orderBy: { createdAt: 'asc' },
      take: overflow,
      select: { id: true },
    });
    const ids = oldest.map((row) => row.id).filter(Boolean);
    if (ids.length > 0) await store.journeyEvent.deleteMany({ where: { id: { in: ids } } });
  }
}

export async function recordJourney(event: Omit<JourneyEvent, 'at'>, store?: unknown): Promise<void> {
  const row: JourneyEvent = { ...event, at: new Date().toISOString() };
  try {
    if (hasTable(store)) {
      await persist(store, row);
      return;
    }
  } catch {
    return;
  }
  memory.push(row);
}

export function journeyEvents(): readonly JourneyEvent[] {
  return memory;
}

export async function storedJourneyEvents(store: unknown): Promise<JourneyEvent[]> {
  if (!hasTable(store)) return [];
  try {
    const rows = await store.journeyEvent.findMany({ orderBy: { createdAt: 'asc' } });
    return rows.map(toEvent);
  } catch {
    return [];
  }
}

export function resetJourneyForTests(): void {
  memory.length = 0;
}

export function journeyCode(error: unknown): string {
  if (error && typeof error === 'object' && 'getResponse' in error) {
    const body = (error as { getResponse: () => unknown }).getResponse();
    if (body && typeof body === 'object' && 'code' in body) {
      const code = (body as { code?: unknown }).code;
      if (typeof code === 'string' && code) return code;
    }
  }
  return 'failed';
}
