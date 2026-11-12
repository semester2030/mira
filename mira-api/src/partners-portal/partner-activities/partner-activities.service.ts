import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { PartnerActivitiesCatalog } from './partner-activities.catalog';
import {
  ACTIVITY_NOT_APPROVED,
  FACILITY_IDENTITY_KINDS,
  IDENTITY_KINDS,
  PolicyError,
  SERVICE_MODES,
  providerKindFromIdentity,
  type ActivityActor,
  type ActivityDef,
  type ActivityRequestInput,
  type IdentityKind,
  type ProviderKind,
  type ServiceMode,
  type WriteTarget,
} from './partner-activities.types';

const str = (v: unknown, n = 200) =>
  typeof v === 'string' && v.trim().length > 0 && v.trim().length <= n;
const normalize = (s: string) => s.normalize('NFKC').trim().replace(/\s+/gu, ' ');

function codes<T extends string>(
  x: unknown,
  allowed: Record<T, string>,
  required = false,
): T[] {
  if (
    !Array.isArray(x) ||
    x.length > Object.keys(allowed).length ||
    (required && !x.length) ||
    new Set(x).size !== x.length ||
    x.some((k) => !Object.prototype.hasOwnProperty.call(allowed, k))
  ) {
    throw new PolicyError(400, 'INVALID_OPTIONS');
  }
  return x as T[];
}

@Injectable()
export class PartnerActivitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: PartnerActivitiesCatalog,
  ) {}

  identityKinds() {
    return IDENTITY_KINDS;
  }

  modes() {
    return SERVICE_MODES;
  }

  catalogItems(): ActivityDef[] {
    return this.catalog.list();
  }

  catalogMap(): Map<string, ActivityDef> {
    return this.catalog.asMap();
  }

  /**
   * Map registration identity → Partner.type (developer never from public apply).
   * Independent specialists stay type=salon for catalog venue filters, but
   * activitiesMeta.providerKind='independent' is the source of account identity.
   */
  primaryPartnerType(identity: IdentityKind[]): string {
    if (identity.includes('events')) return 'event_planner';
    if (identity.includes('clinic')) return 'clinic';
    if (identity.includes('salon') || identity.includes('independent')) return 'salon';
    if (identity.includes('brand') || identity.includes('shop')) return 'brand';
    return 'brand';
  }

  providerKind(identity: IdentityKind[]): ProviderKind {
    return providerKindFromIdentity(identity);
  }

  validateRequest(data: ActivityRequestInput): {
    identity: IdentityKind[];
    locations: ServiceMode[];
    description: string;
    lines: Array<{ activity: string; scope: 'category' | 'one'; item_name: string }>;
    providerKind: ProviderKind;
  } {
    if (!data || typeof data !== 'object') throw new PolicyError(400, 'INVALID_APPLICATION');
    const identity = codes(data.identity, IDENTITY_KINDS, true);
    // Independent path is exclusive: cannot combine with facility identities on one account.
    const hasIndependent = identity.includes('independent');
    const hasFacility = identity.some((k) => (FACILITY_IDENTITY_KINDS as readonly string[]).includes(k));
    if (hasIndependent && hasFacility) {
      throw new PolicyError(400, 'IDENTITY_PATH_CONFLICT');
    }
    const locations = codes(data.locations || [], SERVICE_MODES, false);
    if (!str(data.description, 800) || !Array.isArray(data.lines) || !data.lines.length || data.lines.length > 150) {
      throw new PolicyError(400, 'INVALID_APPLICATION');
    }
    // Independents must not claim facility premises as their only mode without a studio mode.
    if (hasIndependent && locations.includes('venue') && !locations.includes('provider_home') && !locations.includes('client_home')) {
      throw new PolicyError(400, 'INDEPENDENT_VENUE_REQUIRES_STUDIO_OR_CLIENT');
    }
    const cat = this.catalogMap();
    const seen = new Set<string>();
    const lines = data.lines.map((v) => {
      if (!v || typeof v !== 'object') throw new PolicyError(400, 'UNKNOWN_ACTIVITY');
      const def = cat.get(v.activity);
      if (!def || def.selectable !== true || !['category', 'one'].includes(v.scope)) {
        throw new PolicyError(400, 'UNKNOWN_ACTIVITY');
      }
      if (v.scope === 'one' && (def.kind !== 'product' || !str(v.itemName, 120))) {
        throw new PolicyError(400, 'INVALID_SINGLE_ITEM');
      }
      if (v.scope === 'category' && v.itemName != null && v.itemName !== '') {
        throw new PolicyError(400, 'INVALID_SCOPE');
      }
      const it = v.scope === 'one' ? normalize(String(v.itemName)) : '';
      const key = JSON.stringify([v.activity, v.scope, it]);
      if (seen.has(key)) throw new PolicyError(400, 'DUPLICATE_LINE');
      seen.add(key);
      return { activity: v.activity, scope: v.scope as 'category' | 'one', item_name: it };
    });
    if (lines.some((l) => cat.get(l.activity)?.kind === 'service') && !locations.length) {
      throw new PolicyError(400, 'SERVICE_LOCATION_REQUIRED');
    }
    if (
      lines.some(
        (a) =>
          a.scope === 'one' &&
          lines.some((b) => b.activity === a.activity && b.scope === 'category'),
      )
    ) {
      throw new PolicyError(400, 'OVERLAPPING_SCOPE');
    }
    return {
      identity,
      locations,
      description: normalize(data.description),
      lines,
      providerKind: providerKindFromIdentity(identity),
    };
  }

  async createJoinRequest(applicationId: string, data: ActivityRequestInput) {
    const d = this.validateRequest(data);
    const rid = randomUUID();
    await this.prisma.$transaction(async (tx) => {
      await tx.paRequest.create({
        data: {
          id: rid,
          applicationId,
          partnerId: null,
          kind: 'join',
          state: 'pending',
          description: d.description,
          meta: { identity: d.identity, locations: d.locations },
        },
      });
      for (const l of d.lines) {
        await tx.paLine.create({
          data: {
            id: randomUUID(),
            requestId: rid,
            activity: l.activity,
            scope: l.scope,
            itemName: l.item_name,
            decision: 'pending',
          },
        });
      }
      await tx.paHistory.create({
        data: {
          id: randomUUID(),
          requestId: rid,
          actor: 'applicant',
          action: 'submitted',
          detail: { kind: 'join', count: d.lines.length },
        },
      });
    });
    return { requestId: rid, state: 'pending' as const };
  }

  async expand(actor: ActivityActor, data: ActivityRequestInput) {
    if (actor.role !== 'partner' || !actor.active || !str(actor.partnerId) || !str(actor.id)) {
      throw new PolicyError(403, 'ACTIVE_PARTNER_REQUIRED');
    }
    const d = this.validateRequest(data);
    const partnerId = actor.partnerId!;
    return this.prisma.$transaction(async (tx) => {
      const pending = await tx.paRequest.findFirst({
        where: { partnerId, kind: 'expand', state: 'pending' },
      });
      if (pending) throw new PolicyError(409, 'EXPANSION_PENDING');
      for (const l of d.lines) {
        const existing = await tx.paGrant.findFirst({
          where: {
            partnerId,
            activity: l.activity,
            OR: [
              { scope: 'category' },
              { scope: l.scope, itemName: l.item_name },
            ],
          },
        });
        if (existing) throw new PolicyError(409, 'ALREADY_GRANTED');
      }
      const rid = randomUUID();
      await tx.paRequest.create({
        data: {
          id: rid,
          applicationId: null,
          partnerId,
          kind: 'expand',
          state: 'pending',
          description: d.description,
          meta: { identity: d.identity, locations: d.locations },
        },
      });
      for (const l of d.lines) {
        await tx.paLine.create({
          data: {
            id: randomUUID(),
            requestId: rid,
            activity: l.activity,
            scope: l.scope,
            itemName: l.item_name,
            decision: 'pending',
          },
        });
      }
      await tx.paHistory.create({
        data: {
          id: randomUUID(),
          requestId: rid,
          actor: actor.id,
          action: 'submitted',
          detail: { kind: 'expand', count: d.lines.length },
        },
      });
      return { requestId: rid, state: 'pending' as const };
    });
  }

  async profile(partnerId: string) {
    const [grants, requests] = await Promise.all([
      this.prisma.paGrant.findMany({
        where: { partnerId },
        orderBy: [{ activity: 'asc' }, { itemName: 'asc' }],
        select: { activity: true, scope: true, itemName: true, boundItem: true },
      }),
      this.prisma.paRequest.findMany({
        where: { partnerId },
        orderBy: { submittedAt: 'desc' },
        include: { lines: { orderBy: [{ activity: 'asc' }, { itemName: 'asc' }] } },
      }),
    ]);
    return {
      grants: grants.map((g) => ({
        activity: g.activity,
        scope: g.scope,
        item_name: g.itemName,
        bound_item: g.boundItem,
      })),
      requests: requests.map((r) => ({
        id: r.id,
        kind: r.kind,
        state: r.state,
        description: r.description,
        meta: r.meta,
        reason: r.reason,
        submitted_at: r.submittedAt,
        reviewed_at: r.reviewedAt,
        lines: r.lines.map((l) => ({
          id: l.id,
          activity: l.activity,
          scope: l.scope,
          item_name: l.itemName,
          decision: l.decision,
        })),
      })),
    };
  }

  async queue() {
    const rows = await this.prisma.paRequest.findMany({
      where: { state: 'pending' },
      orderBy: { submittedAt: 'asc' },
      include: { lines: { orderBy: [{ activity: 'asc' }, { itemName: 'asc' }] } },
    });
    return rows.map((r) => ({
      id: r.id,
      applicationId: r.applicationId,
      partnerId: r.partnerId,
      kind: r.kind,
      state: r.state,
      description: r.description,
      meta: r.meta as { identity: string[]; locations: string[] },
      submitted_at: r.submittedAt,
      lines: r.lines.map((l) => ({
        id: l.id,
        activity: l.activity,
        scope: l.scope,
        item_name: l.itemName,
        decision: l.decision,
      })),
    }));
  }

  async findJoinRequestForApplication(applicationId: string) {
    return this.prisma.paRequest.findUnique({
      where: { applicationId },
      include: { lines: true },
    });
  }

  /** Validate decision payload against a pending request (no DB mutation). */
  async prepareDecision(
    actor: ActivityActor,
    requestId: string,
    payload: { approvedLineIds: string[]; reason?: string; verificationNote?: string },
  ) {
    if (actor.role !== 'admin' || !actor.active || !str(actor.id)) {
      throw new PolicyError(403, 'REVIEWER_REQUIRED');
    }
    const ids = payload.approvedLineIds;
    if (!Array.isArray(ids) || ids.some((k) => !str(k)) || new Set(ids).size !== ids.length) {
      throw new PolicyError(400, 'INVALID_DECISION');
    }
    if (payload.reason != null && (typeof payload.reason !== 'string' || payload.reason.length > 800)) {
      throw new PolicyError(400, 'INVALID_REASON');
    }
    const r = await this.prisma.paRequest.findUnique({
      where: { id: requestId },
      include: { lines: true },
    });
    if (!r) throw new PolicyError(404, 'NOT_FOUND');
    if (r.state !== 'pending') throw new PolicyError(409, 'ALREADY_REVIEWED');
    const lines = r.lines;
    if (ids.some((k) => !lines.some((l) => l.id === k))) {
      throw new PolicyError(400, 'LINE_OUTSIDE_REQUEST');
    }
    const cat = this.catalogMap();
    if (lines.some((l) => ids.includes(l.id) && cat.get(l.activity)?.selectable !== true)) {
      throw new PolicyError(409, 'INACTIVE_ACTIVITY');
    }
    if (ids.length < lines.length && !str(payload.reason, 800)) {
      throw new PolicyError(400, 'REASON_REQUIRED');
    }
    if (ids.length && !str(payload.verificationNote, 500)) {
      throw new PolicyError(400, 'VERIFICATION_REQUIRED');
    }
    const state =
      ids.length === 0 ? 'rejected' : ids.length === lines.length ? 'approved' : 'partial';
    const meta = (r.meta || { identity: [], locations: [] }) as {
      identity: string[];
      locations: string[];
    };
    return {
      request: r,
      lines,
      ids,
      state: state as 'approved' | 'partial' | 'rejected',
      meta,
      approvedActivities: lines.filter((l) => ids.includes(l.id)).map((l) => l.activity),
    };
  }

  /** Persist line decisions + grants after host join activation (if any). */
  async commitDecision(
    actor: ActivityActor,
    prepared: Awaited<ReturnType<PartnerActivitiesService['prepareDecision']>>,
    partnerId: string | null,
    payload: { reason?: string; verificationNote?: string },
  ) {
    const { request: r, lines, ids, state } = prepared;
    if (ids.length && !str(partnerId)) {
      throw new Error('host did not return verified partner id');
    }
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.paRequest.updateMany({
        where: { id: r.id, state: 'pending' },
        data: {
          state,
          partnerId: partnerId ?? null,
          reviewerId: actor.id,
          reviewedAt: new Date(),
          reason: payload.reason?.trim() || '',
        },
      });
      if (updated.count !== 1) throw new PolicyError(409, 'ALREADY_REVIEWED');

      for (const l of lines) {
        const yes = ids.includes(l.id);
        await tx.paLine.update({
          where: { id: l.id },
          data: { decision: yes ? 'approved' : 'rejected' },
        });
        if (yes && partnerId) {
          await tx.paGrant.upsert({
            where: {
              partnerId_activity_scope_itemName: {
                partnerId,
                activity: l.activity,
                scope: l.scope,
                itemName: l.itemName,
              },
            },
            create: {
              partnerId,
              activity: l.activity,
              scope: l.scope,
              itemName: l.itemName,
              lineId: l.id,
            },
            update: {},
          });
        }
      }

      await tx.paHistory.create({
        data: {
          id: randomUUID(),
          requestId: r.id,
          actor: actor.id,
          action: 'decision',
          detail: {
            state,
            approved: ids,
            verificationNote: ids.length ? String(payload.verificationNote || '').trim() : '',
            reason: payload.reason || '',
          },
        },
      });

      return { state, partnerId: partnerId ?? null };
    });
  }

  /** True when partner has at least one activity grant (enforcement mode). */
  async hasGrants(partnerId: string): Promise<boolean> {
    const n = await this.prisma.paGrant.count({ where: { partnerId } });
    return n > 0;
  }

  /**
   * Single write gate. Developers bypass grants. Partners with grants must match.
   * Partners without grants stay on legacy type capability (caller checks that first).
   * Pass lineageId null on create (pre-check); call bindSingleItem after insert.
   */
  async assertAuthorizedWrite(
    actor: ActivityActor,
    target: Omit<WriteTarget, 'lineageId'> & { lineageId: string | null },
  ): Promise<{ enforced: boolean; needsBind: boolean }> {
    if (actor.role === 'developer') {
      if (!actor.active || !str(actor.id)) throw new PolicyError(403, 'INACTIVE_ACCOUNT');
      return { enforced: false, needsBind: false };
    }
    if (actor.role !== 'partner' || !actor.active || !str(actor.partnerId) || !str(actor.id)) {
      throw new PolicyError(403, 'ACTIVE_PARTNER_REQUIRED');
    }
    if (target.partnerId !== actor.partnerId) throw new PolicyError(403, 'NOT_OWNER');

    const def = this.catalogMap().get(target.activity);
    if (!def || def.kind !== target.kind || !str(target.title, 200)) {
      throw new PolicyError(400, 'INVALID_TARGET');
    }

    const grantCount = await this.prisma.paGrant.count({ where: { partnerId: actor.partnerId! } });
    if (grantCount === 0) {
      return { enforced: false, needsBind: false };
    }

    if (def.selectable !== true) throw new PolicyError(403, 'INACTIVE_ACTIVITY');

    const categoryGrant = await this.prisma.paGrant.findFirst({
      where: { partnerId: actor.partnerId!, activity: target.activity, scope: 'category' },
    });
    if (categoryGrant) return { enforced: true, needsBind: false };

    const title = normalize(target.title);
    const one = await this.prisma.paGrant.findFirst({
      where: {
        partnerId: actor.partnerId!,
        activity: target.activity,
        scope: 'one',
        itemName: title,
      },
    });
    if (!one) throw new PolicyError(403, ACTIVITY_NOT_APPROVED);
    if (target.lineageId == null) {
      if (one.boundItem) throw new PolicyError(403, 'ITEM_ALREADY_BOUND');
      return { enforced: true, needsBind: true };
    }
    if (one.boundItem && one.boundItem !== target.lineageId) {
      throw new PolicyError(403, ACTIVITY_NOT_APPROVED);
    }
    const bound = await this.prisma.paGrant.updateMany({
      where: {
        lineId: one.lineId,
        OR: [{ boundItem: null }, { boundItem: target.lineageId }],
      },
      data: { boundItem: target.lineageId },
    });
    if (bound.count !== 1) throw new PolicyError(403, 'ITEM_ALREADY_BOUND');
    return { enforced: true, needsBind: false };
  }

  async bindSingleItem(
    partnerId: string,
    activity: string,
    title: string,
    lineageId: string,
  ): Promise<void> {
    const one = await this.prisma.paGrant.findFirst({
      where: {
        partnerId,
        activity,
        scope: 'one',
        itemName: normalize(title),
      },
    });
    if (!one) return;
    const bound = await this.prisma.paGrant.updateMany({
      where: {
        lineId: one.lineId,
        OR: [{ boundItem: null }, { boundItem: lineageId }],
      },
      data: { boundItem: lineageId },
    });
    if (bound.count !== 1) throw new PolicyError(403, 'ITEM_ALREADY_BOUND');
  }

  resolveWriteActivity(input: {
    kind: 'product' | 'service';
    subcategory?: string | null;
    category?: string | null;
    profileId?: string | null;
    attributes?: Record<string, unknown> | null;
  }): string | null {
    return this.catalog.resolveWriteActivity(input);
  }
}
