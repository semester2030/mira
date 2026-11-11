import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CatalogContentService } from '../../marketplace/catalog-content.service';
import {
  assertAvailabilityConsistent,
  assertResourceCapacitiesConsistent,
  badRequest,
  capacityBearingWindowsFromDocument,
  normalizeAvailabilityDocument,
  normalizeIdempotencyKey,
  stableFingerprint,
} from '../../marketplace/commerce.types';
import { RegistryService } from '../registry/registry.service';
import { EDITOR_SCHEMA_VERSION } from '../registry/registry.types';
import { attributesJsonFromDraftValues, optionsJsonFromDraftValues } from '../registry/draft-values-mapping';
import { assertVariantMediaIdsEligible } from '../variant-media-ids';
import { resolveSaudiCity } from '../../geo/saudi-cities';
import {
  branchIdFromServiceProfile,
  placeModeFromServiceProfile,
} from '../../marketplace/catalog-filters';
import { TaxonomyService } from '../../marketplace/taxonomy/taxonomy.service';
import {
  applyTaxonomyPatch,
  readTaxonomyBaseline,
} from '../../marketplace/taxonomy/taxonomy-write.apply';
import type { AttributeFieldDef } from '../../marketplace/taxonomy/product-taxonomy.validate';
import { normalizeOptionalId } from '../../marketplace/taxonomy/product-taxonomy.validate';
import { PARTNER_KIND_FORBIDDEN, partnerCanCreateKind } from '../partner-capabilities';
import { PartnerActivitiesService } from '../partner-activities/partner-activities.service';
import { PolicyError } from '../partner-activities/partner-activities.types';
import { assertJewelryMaterialPolicy } from '../../marketplace/taxonomy/jewelry-material.policy';

/** Normalize coverage city ids (Arabic name → stable sa-* id). */
function normalizeCoverageJson(raw: unknown): { cityIds: string[] } | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const cityIdsRaw = (raw as { cityIds?: unknown }).cityIds;
  if (!Array.isArray(cityIdsRaw)) return null;
  const cityIds = cityIdsRaw
    .map((x) => {
      if (typeof x !== 'string' || !x.trim()) return null;
      const resolved = resolveSaudiCity(x.trim());
      return resolved ? resolved.id : x.trim();
    })
    .filter((x): x is string => !!x);
  return { cityIds };
}

function placeFieldsFromBulkValues(values: Record<string, unknown>): {
  placeMode?: string | null;
  branchId?: string | null;
  coverageJson?: Prisma.InputJsonValue | typeof Prisma.DbNull;
} {
  const profile = values.serviceProfile;
  const placeModeExplicit = Object.prototype.hasOwnProperty.call(values, 'placeMode');
  const branchIdExplicit = Object.prototype.hasOwnProperty.call(values, 'branchId');
  let placeMode: string | null = null;
  if (placeModeExplicit) {
    const raw = values.placeMode;
    placeMode = typeof raw === 'string' && raw.trim() ? raw.trim() : null;
  } else {
    placeMode = placeModeFromServiceProfile(profile) || null;
  }
  if (placeMode === 'in_branch') placeMode = 'branch';
  // Explicit null/'' clears branch — never fall through to serviceProfile.
  // Absent key may restore from profile (legacy answers).
  let branchId: string | null | undefined;
  if (branchIdExplicit) {
    const raw = values.branchId;
    branchId =
      typeof raw === 'string' && raw.trim() ? raw.trim() : null;
  } else {
    branchId = branchIdFromServiceProfile(profile) || null;
  }
  // Non-branch modes never keep a stale branchId.
  if (placeMode && placeMode !== 'branch') branchId = null;
  let coverageJson: Prisma.InputJsonValue | typeof Prisma.DbNull | undefined;
  if (values.coverageJson != null) {
    const norm = normalizeCoverageJson(values.coverageJson);
    coverageJson = norm ? (norm as unknown as Prisma.InputJsonValue) : Prisma.DbNull;
  } else if (Array.isArray(values.coverageCityIds)) {
    const norm = normalizeCoverageJson({ cityIds: values.coverageCityIds });
    coverageJson = norm ? (norm as unknown as Prisma.InputJsonValue) : Prisma.DbNull;
  } else if (Array.isArray(values.coverageZones)) {
    // Portal registry field → Service.coverageJson.cityIds
    const norm = normalizeCoverageJson({ cityIds: values.coverageZones });
    coverageJson = norm ? (norm as unknown as Prisma.InputJsonValue) : Prisma.DbNull;
  } else if (placeMode === 'home' && values.coverageCityId) {
    const norm = normalizeCoverageJson({ cityIds: [String(values.coverageCityId)] });
    coverageJson = norm ? (norm as unknown as Prisma.InputJsonValue) : undefined;
  } else if (profile && typeof profile === 'object') {
    const answers =
      (profile as { answers?: Record<string, unknown> }).answers &&
      typeof (profile as { answers?: unknown }).answers === 'object'
        ? ((profile as { answers: Record<string, unknown> }).answers as Record<string, unknown>)
        : null;
    if (answers) {
      const raw = answers.coverageZones ?? answers.home_coverage ?? answers.coverageCityIds;
      if (Array.isArray(raw)) {
        const norm = normalizeCoverageJson({ cityIds: raw });
        if (norm) coverageJson = norm as unknown as Prisma.InputJsonValue;
      } else if (typeof raw === 'string' && raw.trim()) {
        const parts = raw.split(/[,|،]/).map((s) => s.trim()).filter(Boolean);
        const norm = normalizeCoverageJson({ cityIds: parts });
        if (norm) coverageJson = norm as unknown as Prisma.InputJsonValue;
      }
    }
  }
  const out: {
    placeMode?: string | null;
    branchId?: string | null;
    coverageJson?: Prisma.InputJsonValue | typeof Prisma.DbNull;
  } = {};
  if (placeModeExplicit) out.placeMode = placeMode;
  else if (placeMode) out.placeMode = placeMode;
  // Always emit branchId when explicit (including null clear) or when resolved to a value.
  if (branchIdExplicit || branchId) out.branchId = branchId ?? null;
  if (coverageJson !== undefined) out.coverageJson = coverageJson;
  // Explicit empty coverageZones clears prior coverage on rematerialize.
  if (Array.isArray(values.coverageZones) && values.coverageZones.length === 0) {
    out.coverageJson = Prisma.DbNull;
  }
  return out;
}

/** Map bulk weeklyHours/dateExceptions → availabilityJson when canonical doc missing. */
function availabilityFromBulkSchedule(values: Record<string, unknown>) {
  if (values.availabilityJson != null && typeof values.availabilityJson === 'object') {
    return normalizeAvailabilityDocument(values.availabilityJson, { strict: true });
  }
  const hours = Array.isArray(values.weeklyHours) ? values.weeklyHours : [];
  const dayMap: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
  const toMin = (t: unknown) => {
    const s = String(t || '10:00');
    const [h, m] = s.split(':').map((x) => Number(x));
    if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
    return h * 60 + m;
  };
  // Empty optional resourceId must stay empty — never invent «resource-1».
  const defaultResourceId =
    typeof values.defaultResourceId === 'string' && values.defaultResourceId.trim()
      ? values.defaultResourceId.trim()
      : '';
  const capacity =
    typeof values.defaultCapacity === 'number' && Number.isInteger(values.defaultCapacity) && values.defaultCapacity > 0
      ? values.defaultCapacity
      : 1;
  const windows = hours.map((raw) => {
    if (!raw || typeof raw !== 'object') {
      throw badRequest('AVAILABILITY_WINDOW_INVALID', 'فترة توفر غير صالحة');
    }
    const h = raw as Record<string, unknown>;
    const dayKey = String(h.day || h.weekday || '');
    const weekday =
      typeof h.weekday === 'number' && Number.isInteger(h.weekday)
        ? h.weekday
        : dayMap[dayKey] != null
          ? dayMap[dayKey]
          : null;
    const startMin = typeof h.startMin === 'number' ? h.startMin : toMin(h.open || h.start);
    const endMin = typeof h.endMin === 'number' ? h.endMin : toMin(h.close || h.end);
    // Strict: never silently drop invalid draft/materialize windows.
    if (weekday == null || startMin == null || endMin == null || endMin <= startMin) {
      throw badRequest('AVAILABILITY_WINDOW_INVALID', 'فترة توفر غير صالحة');
    }
    const rowCapacity = typeof h.capacity === 'number' ? h.capacity : capacity;
    if (!Number.isInteger(rowCapacity) || rowCapacity < 1 || rowCapacity > 100) {
      throw badRequest('AVAILABILITY_WINDOW_INVALID', 'فترة توفر غير صالحة');
    }
    const rowResource =
      typeof h.resourceId === 'string' && h.resourceId.trim() ? h.resourceId.trim() : defaultResourceId;
    return {
      weekday,
      startMin,
      endMin,
      capacity: rowCapacity,
      resourceId: rowResource,
    };
  });
  // dateExceptions may be closed date strings OR exception objects {date, kind, ...}.
  // Do not drop special/closed exception rows — prior code forced exceptions: [].
  const closedDates: string[] = [];
  const exceptions: Array<Record<string, unknown>> = [];
  const rawExceptions = Array.isArray(values.dateExceptions) ? values.dateExceptions : [];
  for (const x of rawExceptions) {
    if (typeof x === 'string') {
      const d = x.trim();
      if (d) closedDates.push(d);
      continue;
    }
    if (!x || typeof x !== 'object') continue;
    const row = x as Record<string, unknown>;
    const date = String(row.date || '').trim();
    if (!date) continue;
    const kind = String(row.kind || '').trim();
    if (kind === 'special') {
      exceptions.push({
        date,
        kind: 'special',
        startMin: row.startMin,
        endMin: row.endMin,
        ...(row.capacity != null ? { capacity: row.capacity } : {}),
        ...(typeof row.resourceId === 'string' && row.resourceId.trim()
          ? { resourceId: row.resourceId.trim() }
          : {}),
      });
    } else if (kind === 'closed') {
      // Prefer closedDates list for kind=closed; also allow exception form.
      if (row.resourceId) {
        exceptions.push({ date, kind: 'closed', resourceId: String(row.resourceId).trim() });
      } else {
        closedDates.push(date);
      }
    } else if (!kind) {
      // Bare {date} without kind → closed day.
      closedDates.push(date);
    }
  }
  if (!windows.length && !closedDates.length && !exceptions.length) return null;
  // Same contract as partners-portal.availabilityWrite — draft materialize must not persist overlaps.
  const doc = normalizeAvailabilityDocument(
    { v: 2, timezone: 'Asia/Riyadh', windows, exceptions, closedDates },
    { strict: true },
  );
  assertAvailabilityConsistent(doc.windows);
  assertResourceCapacitiesConsistent(capacityBearingWindowsFromDocument(doc));
  return doc;
}

function editorError(status: HttpStatus, code: string, messageAr: string, extra: Record<string, unknown> = {}) {
  return new HttpException({ message: messageAr, messageAr, code, ...extra }, status);
}

type PutBody = {
  expectedRevision: number | null;
  kind: 'product' | 'service';
  profileId: string;
  schemaVersion: number;
  values: Record<string, unknown>;
  targetOwnerId?: string | null;
};

@Injectable()
export class EditorDraftsService {
  private readonly taxonomy: TaxonomyService;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RegistryService) private readonly registry: RegistryService,
    @Inject(CatalogContentService) private readonly content: CatalogContentService,
    @Optional() @Inject(TaxonomyService) taxonomy?: TaxonomyService,
    @Optional() @Inject(PartnerActivitiesService) private readonly activities?: PartnerActivitiesService,
  ) {
    this.taxonomy = taxonomy ?? new TaxonomyService();
    if (!taxonomy) this.taxonomy.onModuleInit();
  }

  private mapPolicyError(err: unknown): never {
    if (err instanceof PolicyError) {
      throw new ForbiddenException({
        message: err.code,
        messageAr:
          err.code === 'ACTIVITY_NOT_APPROVED'
            ? 'هذا العرض خارج الأنشطة المعتمدة لحسابك'
            : err.code,
        code: err.code,
      });
    }
    throw err;
  }

  /** Server write gate for draft create / taxonomy change / materialize. Developers bypass. */
  private assertJewelryAttrs(values: Record<string, unknown>, profileId: string | null | undefined) {
    const isJewelry =
      profileId === 'product.jewelry' ||
      values.category === 'jewelry' ||
      (typeof values.subcategory === 'string' && values.subcategory.startsWith('jewelry.'));
    if (!isJewelry) return;
    const attrs = attributesJsonFromDraftValues(values, this.registry.getRegistry().fields);
    const bag =
      attrs && typeof attrs === 'object' && !Array.isArray(attrs)
        ? (attrs as Record<string, unknown>)
        : {};
    // Also accept flat metal on values for early draft.
    if (values.metal != null && bag.metal == null) bag.metal = values.metal;
    if (values.stoneTypes != null && bag.stoneTypes == null) bag.stoneTypes = values.stoneTypes;
    if (values.diamondOrigin != null && bag.diamondOrigin == null) bag.diamondOrigin = values.diamondOrigin;
    const violations = assertJewelryMaterialPolicy(bag);
    if (violations.length) {
      throw editorError(HttpStatus.FORBIDDEN, violations[0].code, violations[0].messageAr, {
        fieldErrors: violations.map((v) => ({ fieldId: v.fieldId || 'metal', code: v.code })),
      });
    }
  }

  private async enforceActivityWrite(
    partnerId: string,
    kind: 'product' | 'service',
    fields: {
      subcategory?: string | null;
      category?: string | null;
      profileId?: string | null;
      title: string;
      lineageId: string | null;
      attributes?: Record<string, unknown> | null;
    },
  ): Promise<void> {
    if (!this.activities) return;
    const activity = this.activities.resolveWriteActivity({
      kind,
      subcategory: fields.subcategory,
      category: fields.category,
      profileId: fields.profileId,
      attributes: fields.attributes,
    });
    const hasGrants = await this.activities.hasGrants(partnerId);
    if (!activity) {
      // Draft shell before leaf pick is allowed; a concrete unknown leaf is rejected.
      if (hasGrants && fields.subcategory) {
        throw new ForbiddenException({
          message: 'ACTIVITY_NOT_APPROVED',
          messageAr: 'هذا العرض خارج الأنشطة المعتمدة لحسابك',
          code: 'ACTIVITY_NOT_APPROVED',
        });
      }
      return;
    }
    const partner = await this.prisma.partner.findUnique({ where: { id: partnerId } });
    const user = await this.prisma.partnerUser.findUnique({ where: { partnerId } });
    if (!partner || !user) throw new ForbiddenException('الحساب غير نشط');
    try {
      await this.activities.assertAuthorizedWrite(
        {
          id: user.id,
          role: partner.type === 'developer' ? 'developer' : 'partner',
          active: partner.status === 'active',
          partnerId,
          display: partner.nameAr,
        },
        {
          partnerId,
          kind,
          activity,
          title: fields.title,
          lineageId: fields.lineageId,
        },
      );
    } catch (err) {
      this.mapPolicyError(err);
    }
  }

  private attributeDefsForProfile(profileId: string | null): Map<string, AttributeFieldDef> | undefined {
    if (!profileId) return undefined;
    const profile = this.registry.getProfile(profileId);
    if (!profile) return undefined;
    const attributeFieldDefs = new Map<string, AttributeFieldDef>();
    const fields = this.registry.getRegistry().fields;
    for (const fieldId of profile.fields ?? []) {
      const def = fields[fieldId];
      if (!def) continue;
      const storage = (def as { storage?: string }).storage;
      if (typeof storage === 'string' && storage.startsWith('attributes.')) {
        const entry: AttributeFieldDef = {
          id: fieldId,
          type: def.type,
          values: def.values,
          min: def.min ?? null,
          max: def.max ?? null,
          dependsOn: (def as { dependsOn?: AttributeFieldDef['dependsOn'] }).dependsOn ?? null,
          inputModes: (def as { inputModes?: string[] | null }).inputModes ?? null,
        };
        attributeFieldDefs.set(fieldId, entry);
        const storageKey = storage.slice('attributes.'.length);
        if (storageKey && storageKey !== fieldId) attributeFieldDefs.set(storageKey, entry);
      }
    }
    return attributeFieldDefs;
  }

  private taxonomyWriteContext() {
    return {
      doc: this.taxonomy.getDoc(),
      knownProfileIds: new Set(this.registry.getRegistry().profiles.map((p) => p.id)),
      resolveAttributeFieldDefs: (profileId: string | null) => this.attributeDefsForProfile(profileId),
    };
  }

  private throwTaxonomyErrors(errors: Array<{ fieldId: string; code: string; messageAr?: string }>) {
    if (!errors.length) return;
    throw new HttpException(
      {
        message: errors[0].messageAr || errors[0].code,
        messageAr: errors[0].messageAr || errors[0].code,
        code: errors[0].code,
        fieldErrors: errors,
      },
      HttpStatus.BAD_REQUEST,
    );
  }

  private async partnerType(partnerId: string): Promise<string> {
    const partner = await this.prisma.partner.findUnique({ where: { id: partnerId } });
    if (!partner || partner.status !== 'active') throw new NotFoundException('الشريك غير متاح');
    return partner.type;
  }

  private serialize(row: {
    id: string;
    clientDraftId: string;
    kind: string;
    profileId: string;
    schemaVersion: number;
    valuesJson: Prisma.JsonValue;
    revision: number;
    status: string;
    targetOwnerId: string | null;
    materializedAt: Date | null;
    submitReviewStatus?: string | null;
    submitReviewError?: string | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      draftId: row.id,
      clientDraftId: row.clientDraftId,
      kind: row.kind,
      profileId: row.profileId,
      schemaVersion: row.schemaVersion,
      values: (row.valuesJson ?? {}) as Record<string, unknown>,
      revision: row.revision,
      status: row.status,
      targetOwnerId: row.targetOwnerId,
      materializedAt: row.materializedAt?.toISOString() ?? null,
      submitReviewStatus: row.submitReviewStatus ?? null,
      submitReviewError: row.submitReviewError ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async list(partnerId: string, cursor?: string, limit = 20) {
    this.registry.assertEditorV2Enabled();
    const take = Math.min(Math.max(limit || 20, 1), 50);
    const rows = await this.prisma.partnerEditorDraft.findMany({
      where: {
        partnerId,
        status: { not: 'discarded' },
        ...(cursor ? { updatedAt: { lt: new Date(cursor) } } : {}),
      },
      orderBy: { updatedAt: 'desc' },
      take: take + 1,
    });
    const slice = rows.slice(0, take);
    return {
      items: slice.map((r) => this.serialize(r)),
      nextCursor: rows.length > take ? slice[slice.length - 1]?.updatedAt.toISOString() ?? null : null,
    };
  }

  async get(partnerId: string, clientDraftId: string) {
    this.registry.assertEditorV2Enabled();
    const row = await this.prisma.partnerEditorDraft.findUnique({
      where: { partnerId_clientDraftId: { partnerId, clientDraftId } },
    });
    if (!row || row.status === 'discarded') throw new NotFoundException('المسودة غير موجودة');
    return this.serialize(row);
  }

  async put(partnerId: string, clientDraftId: string, body: PutBody) {
    this.registry.assertEditorV2Enabled();
    if (!clientDraftId || clientDraftId.length > 128) {
      throw editorError(HttpStatus.BAD_REQUEST, 'CLIENT_DRAFT_ID_INVALID', 'معرّف المسودة غير صالح');
    }
    if (body.kind !== 'product' && body.kind !== 'service') {
      throw editorError(HttpStatus.BAD_REQUEST, 'KIND_INVALID', 'نوع العنصر غير صالح');
    }
    if (!body.values || typeof body.values !== 'object' || Array.isArray(body.values)) {
      throw editorError(HttpStatus.BAD_REQUEST, 'VALUES_REQUIRED', 'يجب إرسال values ككائن (يُسمح بـ {})');
    }
    const partnerType = await this.partnerType(partnerId);
    if (!partnerCanCreateKind(partnerType, body.kind)) {
      throw editorError(HttpStatus.FORBIDDEN, PARTNER_KIND_FORBIDDEN, 'نوع العنصر غير مسموح لهذا الحساب');
    }
    const profile = this.registry.assertProfileAllowed(body.profileId, partnerType, body.kind);
    const schemaVersion = body.schemaVersion ?? EDITOR_SCHEMA_VERSION;
    this.registry.validateValues({
      profile,
      values: body.values,
      mode: 'draft',
      schemaVersion,
      partnerType,
    });

    // Draft save must reject invalid availability schedules (same contract as materialize/write).
    // Empty/absent schedule stays allowed; only present weeklyHours/dateExceptions/availabilityJson are checked.
    if (body.kind === 'service') {
      const values = body.values as Record<string, unknown>;
      const hasSchedule =
        values.availabilityJson != null ||
        Array.isArray(values.weeklyHours) ||
        Array.isArray(values.dateExceptions);
      if (hasSchedule) {
        try {
          availabilityFromBulkSchedule(values);
        } catch (err) {
          if (err instanceof HttpException) throw err;
          const e = err as { message?: string };
          throw editorError(
            HttpStatus.BAD_REQUEST,
            'AVAILABILITY_INVALID',
            e?.message || 'إعداد الإتاحة غير صالح',
          );
        }
      }
    }

    if (body.targetOwnerId) {
      await this.assertTargetOwner(partnerId, body.kind, body.targetOwnerId);
    }

    const valuesGate = body.values as Record<string, unknown>;
    this.assertJewelryAttrs(valuesGate, body.profileId);
    const titleGate =
      typeof valuesGate.nameAr === 'string' && valuesGate.nameAr.trim()
        ? valuesGate.nameAr.trim()
        : 'مسودة';
    const attrsGate = attributesJsonFromDraftValues(valuesGate, this.registry.getRegistry().fields);
    await this.enforceActivityWrite(partnerId, body.kind, {
      subcategory:
        typeof valuesGate.subcategory === 'string' ? valuesGate.subcategory : null,
      category: typeof valuesGate.category === 'string' ? valuesGate.category : null,
      profileId: body.profileId,
      title: titleGate,
      lineageId: body.targetOwnerId ?? null,
      attributes:
        attrsGate && typeof attrsGate === 'object' && !Array.isArray(attrsGate)
          ? (attrsGate as Record<string, unknown>)
          : valuesGate,
    });

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.partnerEditorDraft.findUnique({
        where: { partnerId_clientDraftId: { partnerId, clientDraftId } },
      });
      if (!existing) {
        if (body.expectedRevision != null) {
          throw editorError(HttpStatus.CONFLICT, 'DRAFT_REVISION_CONFLICT', 'المسودة غير موجودة لهذا الإصدار');
        }
        const created = await tx.partnerEditorDraft.create({
          data: {
            partnerId,
            clientDraftId,
            kind: body.kind,
            profileId: body.profileId,
            schemaVersion,
            valuesJson: body.values as Prisma.InputJsonValue,
            revision: 1,
            status: 'open',
            targetOwnerId: body.targetOwnerId ?? null,
          },
        });
        return this.serialize(created);
      }
      if (existing.status === 'materialized') {
        throw editorError(HttpStatus.CONFLICT, 'DRAFT_ALREADY_MATERIALIZED', 'تم تحويل المسودة مسبقًا');
      }
      if (existing.status === 'discarded') {
        throw editorError(HttpStatus.CONFLICT, 'DRAFT_DISCARDED', 'المسودة ملغاة');
      }
      if (body.expectedRevision !== existing.revision) {
        throw editorError(HttpStatus.CONFLICT, 'DRAFT_REVISION_CONFLICT', 'تعارض تعديل على المسودة', {
          currentRevision: existing.revision,
        });
      }
      const updated = await tx.partnerEditorDraft.updateMany({
        where: { id: existing.id, revision: existing.revision, status: 'open' },
        data: {
          kind: body.kind,
          profileId: body.profileId,
          schemaVersion,
          valuesJson: body.values as Prisma.InputJsonValue,
          targetOwnerId: body.targetOwnerId === undefined ? existing.targetOwnerId : body.targetOwnerId,
          revision: existing.revision + 1,
        },
      });
      if (updated.count !== 1) {
        throw editorError(HttpStatus.CONFLICT, 'DRAFT_REVISION_CONFLICT', 'تعارض تعديل على المسودة');
      }
      const row = await tx.partnerEditorDraft.findUniqueOrThrow({ where: { id: existing.id } });
      return this.serialize(row);
    });
  }

  async discard(partnerId: string, clientDraftId: string) {
    this.registry.assertEditorV2Enabled();
    const row = await this.prisma.partnerEditorDraft.findUnique({
      where: { partnerId_clientDraftId: { partnerId, clientDraftId } },
    });
    if (!row || row.status === 'discarded') throw new NotFoundException('المسودة غير موجودة');
    await this.prisma.partnerEditorDraft.update({
      where: { id: row.id },
      data: { status: 'discarded' },
    });
    return { ok: true };
  }

  private async assertTargetOwner(partnerId: string, kind: string, targetOwnerId: string) {
    if (kind === 'product') {
      const product = await this.prisma.product.findFirst({ where: { id: targetOwnerId, partnerId } });
      if (!product) throw new NotFoundException('المنتج غير موجود');
      return product;
    }
    const service = await this.prisma.service.findFirst({ where: { id: targetOwnerId, partnerId } });
    if (!service) throw new NotFoundException('الخدمة غير موجودة');
    return service;
  }

  async materialize(
    partnerId: string,
    clientDraftId: string,
    body: { expectedRevision: number; submitReview?: boolean },
    idempotencyKeyHeader: string | undefined,
  ) {
    this.registry.assertEditorV2Enabled();
    if (body.expectedRevision == null || !Number.isInteger(body.expectedRevision)) {
      throw editorError(HttpStatus.BAD_REQUEST, 'EXPECTED_REVISION_REQUIRED', 'expectedRevision مطلوب');
    }
    const idempotencyKey = normalizeIdempotencyKey(idempotencyKeyHeader);
    const submitReview = body.submitReview === true;
    const fingerprint = stableFingerprint({
      clientDraftId,
      expectedRevision: body.expectedRevision,
      submitReview,
    });
    const partnerType = await this.partnerType(partnerId);

    const outcome = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT id FROM partner_editor_drafts WHERE partner_id = ${partnerId} AND client_draft_id = ${clientDraftId} FOR UPDATE`;
      const draft = await tx.partnerEditorDraft.findUnique({
        where: { partnerId_clientDraftId: { partnerId, clientDraftId } },
      });
      if (!draft || draft.status === 'discarded') throw new NotFoundException('المسودة غير موجودة');
      if (draft.kind !== 'product' && draft.kind !== 'service') {
        throw editorError(HttpStatus.BAD_REQUEST, 'KIND_INVALID', 'نوع العنصر غير صالح');
      }
      if (!partnerCanCreateKind(partnerType, draft.kind)) {
        throw editorError(HttpStatus.FORBIDDEN, PARTNER_KIND_FORBIDDEN, 'نوع العنصر غير مسموح لهذا الحساب');
      }

      if (draft.status === 'materialized') {
        const canRetrySubmit =
          submitReview &&
          !!draft.targetOwnerId &&
          draft.submitReviewStatus !== 'submitted' &&
          (draft.submitReviewStatus === 'pending' ||
            draft.submitReviewStatus === 'failed' ||
            draft.submitReviewStatus == null ||
            draft.submitReviewStatus === 'none');
        if (draft.materializeKey === idempotencyKey) {
          if (draft.materializeFingerprint && draft.materializeFingerprint !== fingerprint) {
            // Same materialize key may upgrade submitReview:false → true after media attach.
            if (!canRetrySubmit) {
              throw editorError(HttpStatus.CONFLICT, 'IDEMPOTENCY_CONFLICT', 'مفتاح منع التكرار مستخدم لطلب مختلف');
            }
          }
          return {
            replay: true,
            needsSubmitRetry: canRetrySubmit,
            draftId: draft.id,
            revision: draft.revision,
            status: draft.status,
            targetKind: draft.kind,
            targetOwnerId: draft.targetOwnerId!,
            materializedAt: draft.materializedAt!.toISOString(),
            submitReview,
            submitReviewStatus: draft.submitReviewStatus,
          };
        }
        // Already materialized under another key — still allow one-shot submit/publish upgrade.
        if (canRetrySubmit) {
          return {
            replay: true,
            needsSubmitRetry: true,
            draftId: draft.id,
            revision: draft.revision,
            status: draft.status,
            targetKind: draft.kind,
            targetOwnerId: draft.targetOwnerId!,
            materializedAt: draft.materializedAt!.toISOString(),
            submitReview,
            submitReviewStatus: draft.submitReviewStatus,
          };
        }
        throw editorError(HttpStatus.CONFLICT, 'DRAFT_ALREADY_MATERIALIZED', 'تم تحويل المسودة مسبقًا');
      }

      if (draft.revision !== body.expectedRevision) {
        throw editorError(HttpStatus.CONFLICT, 'DRAFT_REVISION_CONFLICT', 'تعارض إصدار المسودة', {
          currentRevision: draft.revision,
        });
      }

      const profile = this.registry.assertProfileAllowed(draft.profileId, partnerType, draft.kind);
      const values = { ...((draft.valuesJson ?? {}) as Record<string, unknown>) };
      // Default purchaseMode only when omitted — empty externalUrl remains allowed.
      // Do NOT invent priceMode here: if omitted, priceHalalas publish rule stays inactive
      // and the materialize Prisma gate returns MATERIALIZE_INVALID without fake zeros.
      if (values.purchaseMode == null && draft.kind === 'product') values.purchaseMode = 'external';
      this.registry.validateValues({
        profile,
        values,
        mode: 'publish',
        schemaVersion: draft.schemaVersion,
        partnerType,
      });

      const nameAr = typeof values.nameAr === 'string' ? values.nameAr.trim() : '';
      const priceRaw = values.priceHalalas;
      const durationRaw = values.durationMin;
      const fieldErrors: Array<{ fieldId: string; code: string }> = [];
      if (!nameAr) fieldErrors.push({ fieldId: 'nameAr', code: 'MATERIALIZE_REQUIRED' });
      if (typeof priceRaw !== 'number' || !Number.isInteger(priceRaw) || priceRaw < 0) {
        fieldErrors.push({ fieldId: 'priceHalalas', code: 'MATERIALIZE_REQUIRED' });
      }
      if (draft.kind === 'service') {
        if (typeof durationRaw !== 'number' || !Number.isInteger(durationRaw) || durationRaw <= 0) {
          fieldErrors.push({ fieldId: 'durationMin', code: 'MATERIALIZE_REQUIRED' });
        }
      }
      if (fieldErrors.length) {
        throw editorError(
          HttpStatus.UNPROCESSABLE_ENTITY,
          'MATERIALIZE_INVALID',
          'لا يمكن إنشاء العنصر: حقول مطلوبة ناقصة. لم تُملأ قيم وهمية.',
          { fieldErrors },
        );
      }

      const materializeSub =
        typeof values.subcategory === 'string' && values.subcategory.trim()
          ? values.subcategory.trim()
          : null;
      // Occasions/gifts leaves must be chosen before materialize — shared profile is not a grant.
      if (
        (draft.profileId === 'service.occasions' ||
          draft.profileId === 'product.gifts' ||
          draft.profileId === 'product.occasions_favors') &&
        !materializeSub
      ) {
        throw editorError(
          HttpStatus.UNPROCESSABLE_ENTITY,
          'MATERIALIZE_INVALID',
          'اختاري فرع النشاط قبل التحويل.',
          { fieldErrors: [{ fieldId: 'subcategory', code: 'MATERIALIZE_REQUIRED' }] },
        );
      }
      this.assertJewelryAttrs(values, draft.profileId);
      const attrsMat = attributesJsonFromDraftValues(values, this.registry.getRegistry().fields);
      await this.enforceActivityWrite(partnerId, draft.kind as 'product' | 'service', {
        subcategory: materializeSub,
        category: typeof values.category === 'string' ? values.category : null,
        profileId: draft.profileId,
        title: nameAr,
        lineageId: draft.targetOwnerId ?? null,
        attributes:
          attrsMat && typeof attrsMat === 'object' && !Array.isArray(attrsMat)
            ? (attrsMat as Record<string, unknown>)
            : values,
      });

      let targetOwnerId = draft.targetOwnerId;
      if (targetOwnerId) {
        await this.applyToExisting(tx, partnerId, draft.kind as 'product' | 'service', targetOwnerId, draft, values);
      } else {
        targetOwnerId = await this.createFromDraft(tx, partnerId, draft.kind as 'product' | 'service', draft, values);
      }

      const marked = await tx.partnerEditorDraft.updateMany({
        where: { id: draft.id, revision: draft.revision, status: 'open' },
        data: {
          status: 'materialized',
          targetOwnerId,
          materializedAt: new Date(),
          materializeKey: idempotencyKey,
          materializeFingerprint: fingerprint,
          submitReviewStatus: submitReview ? 'pending' : 'none',
          submitReviewError: null,
        },
      });
      if (marked.count !== 1) {
        throw editorError(HttpStatus.CONFLICT, 'DRAFT_REVISION_CONFLICT', 'تعارض أثناء التحويل');
      }
      const refreshed = await tx.partnerEditorDraft.findUniqueOrThrow({ where: { id: draft.id } });
      return {
        replay: false,
        needsSubmitRetry: submitReview,
        draftId: refreshed.id,
        revision: refreshed.revision,
        status: refreshed.status,
        targetKind: refreshed.kind,
        targetOwnerId: refreshed.targetOwnerId!,
        materializedAt: refreshed.materializedAt!.toISOString(),
        submitReview,
        submitReviewStatus: refreshed.submitReviewStatus,
      };
    });

    let reviewSubmitted = false;
    let reviewError: string | null = null;
    if (submitReview && (outcome.needsSubmitRetry || (!outcome.replay && outcome.submitReviewStatus === 'pending'))) {
      try {
        await this.content.submit(partnerId, outcome.targetKind as 'product' | 'service', outcome.targetOwnerId);
        reviewSubmitted = true;
        await this.prisma.partnerEditorDraft.update({
          where: { id: outcome.draftId },
          data: { submitReviewStatus: 'submitted', submitReviewError: null },
        });
      } catch (error) {
        reviewError = error instanceof Error ? error.message : String(error);
        await this.prisma.partnerEditorDraft.update({
          where: { id: outcome.draftId },
          data: { submitReviewStatus: 'failed', submitReviewError: reviewError.slice(0, 500) },
        });
        throw editorError(
          HttpStatus.SERVICE_UNAVAILABLE,
          'MATERIALIZE_SUBMIT_REVIEW_FAILED',
          'تم تحويل المسودة إلى عنصر، لكن تعذر الإرسال للمراجعة. أعيدي المحاولة بنفس المفتاح دون إنشاء عنصر ثانٍ.',
          {
            targetOwnerId: outcome.targetOwnerId,
            targetKind: outcome.targetKind,
            draftId: outcome.draftId,
            materializedAt: outcome.materializedAt,
            submitReviewStatus: 'failed',
            reviewError,
            resume: true,
          },
        );
      }
    } else if (outcome.replay && submitReview && outcome.submitReviewStatus === 'submitted') {
      reviewSubmitted = true;
    }

    // Expose the live owner reviewRevision after create/submit so the client can bind
    // without a racy follow-up GET (avoids first post-materialize profile put on a stale 0).
    let targetReviewRevision: number | null = null;
    try {
      if (outcome.targetKind === 'service') {
        const svc = await this.prisma.service.findFirst({
          where: { id: outcome.targetOwnerId, partnerId },
          select: { reviewRevision: true },
        });
        targetReviewRevision = svc?.reviewRevision ?? null;
      } else if (outcome.targetKind === 'product') {
        const prod = await this.prisma.product.findFirst({
          where: { id: outcome.targetOwnerId, partnerId },
          select: { reviewRevision: true },
        });
        targetReviewRevision = prod?.reviewRevision ?? null;
      }
    } catch {
      targetReviewRevision = null;
    }

    return {
      ...outcome,
      reviewSubmitted,
      submitReviewStatus: reviewSubmitted ? 'submitted' : outcome.submitReviewStatus ?? (submitReview ? 'pending' : 'none'),
      targetReviewRevision,
    };
  }

  private async createFromDraft(
    tx: Prisma.TransactionClient,
    partnerId: string,
    kind: 'product' | 'service',
    draft: { profileId: string; schemaVersion: number },
    values: Record<string, unknown>,
  ): Promise<string> {
    const nameAr = String(values.nameAr).trim();
    const priceHalalas = values.priceHalalas as number;
    if (kind === 'product') {
      const attributesRaw = attributesJsonFromDraftValues(values, this.registry.getRegistry().fields);
      const applied = applyTaxonomyPatch(
        this.taxonomyWriteContext(),
        { category: null, subcategory: null, profileId: draft.profileId, attributesJson: null },
        {
          category: normalizeOptionalId(values.category) ?? null,
          subcategory: values.subcategory === undefined ? undefined : normalizeOptionalId(values.subcategory),
          profileId: draft.profileId,
          attributes: attributesRaw,
        },
        { published: false },
      );
      this.throwTaxonomyErrors(applied.errors);
      const row = await tx.product.create({
        data: {
          partnerId,
          nameAr,
          nameEn: typeof values.nameEn === 'string' && values.nameEn.trim() ? values.nameEn.trim() : nameAr,
          descriptionAr: typeof values.descriptionAr === 'string' ? values.descriptionAr.trim() || null : null,
          priceHalalas,
          externalUrl: typeof values.externalUrl === 'string' ? values.externalUrl.trim() : '',
          concernTags: Array.isArray(values.concernTags)
            ? values.concernTags.filter((t): t is string => typeof t === 'string')
            : [],
          category: applied.next.category,
          subcategory: applied.next.subcategory,
          ...(attributesRaw !== undefined
            ? {
                attributesJson:
                  applied.next.attributesJson == null
                    ? Prisma.DbNull
                    : (applied.next.attributesJson as Prisma.InputJsonValue),
              }
            : {}),
          active: false,
          contentStatus: 'draft',
          reviewStatus: 'draft',
          profileId: applied.next.profileId ?? draft.profileId,
          schemaVersion: draft.schemaVersion,
          purchaseMode:
            values.purchaseMode === 'internal_cod' || values.purchaseMode === 'external'
              ? String(values.purchaseMode)
              : 'external',
          stockQty: typeof values.stockQty === 'number' && Number.isInteger(values.stockQty) ? values.stockQty : null,
          inventoryMode:
            values.inventoryMode === 'variant' || values.inventoryMode === 'product'
              ? String(values.inventoryMode)
              : Array.isArray(values.variantsJson) && (values.variantsJson as unknown[]).length
                ? 'variant'
                : 'product',
          deliveryFeeHalalas:
            typeof values.deliveryFeeHalalas === 'number' && Number.isInteger(values.deliveryFeeHalalas)
              ? values.deliveryFeeHalalas
              : null,
          optionsJson: optionsJsonFromDraftValues(values),
          variantsJson:
            values.variantsJson && typeof values.variantsJson === 'object'
              ? (values.variantsJson as Prisma.InputJsonValue)
              : undefined,
        },
      });
      // Seed P3.1 variant inventory rows from draft variants so cart/stock work after materialize.
      if (Array.isArray(values.variantsJson)) {
        for (const raw of values.variantsJson) {
          if (!raw || typeof raw !== 'object') continue;
          const v = raw as Record<string, unknown>;
          const variantId = typeof v.id === 'string' ? v.id.trim() : '';
          if (!variantId) continue;
          const stockQty =
            typeof v.stockQty === 'number' && Number.isInteger(v.stockQty) && v.stockQty >= 0 ? v.stockQty : null;
          const stockMode = stockQty == null ? 'untracked' : 'tracked';
          await tx.productVariantInventory.upsert({
            where: { productId_variantId: { productId: row.id, variantId } },
            create: {
              productId: row.id,
              variantId,
              variantKey: variantId,
              stockMode,
              stockQty,
              reservedQty: 0,
            },
            update: {
              stockMode,
              stockQty,
              archivedAt: null,
            },
          });
        }
      }
      return row.id;
    }
    const durationMin = values.durationMin as number;
    let serviceProfileJson: Prisma.InputJsonValue | undefined;
    if (values.serviceProfile && typeof values.serviceProfile === 'object') {
      const partner = await tx.partner.findUniqueOrThrow({ where: { id: partnerId } });
      const normalized = this.registry.normalizeServiceProfile(values.serviceProfile, partner.type);
      serviceProfileJson = normalized as unknown as Prisma.InputJsonValue;
    }
    const attributesRaw = attributesJsonFromDraftValues(values, this.registry.getRegistry().fields);
    // Persist taxonomy leaf on services (no Service.subcategory column) so browse filters stay exact.
    const leaf =
      typeof values.subcategory === 'string' && values.subcategory.trim()
        ? values.subcategory.trim()
        : null;
    const mergedAttrs: Record<string, unknown> = {
      ...(attributesRaw && typeof attributesRaw === 'object' && !Array.isArray(attributesRaw)
        ? (attributesRaw as Record<string, unknown>)
        : {}),
    };
    if (leaf) {
      mergedAttrs.subcategory = leaf;
      mergedAttrs.taxonomyLeaf = leaf;
    }
    const attributesJson =
      Object.keys(mergedAttrs).length > 0 ? (mergedAttrs as Prisma.InputJsonValue) : undefined;
    const availabilityDoc = availabilityFromBulkSchedule(values);
    const bookingEnabled =
      values.bookingEnabled === true ||
      (values.bookingEnabled !== false && !!availabilityDoc && (availabilityDoc.windows || []).length > 0);
    const placeFields = placeFieldsFromBulkValues(values);
    const category =
      typeof values.category === 'string' && values.category.trim()
        ? values.category.trim()
        : leaf && leaf.startsWith('occasions.')
          ? 'occasions'
          : null;
    const row = await tx.service.create({
      data: {
        partnerId,
        nameAr,
        nameEn: typeof values.nameEn === 'string' && values.nameEn.trim() ? values.nameEn.trim() : nameAr,
        descriptionAr: typeof values.descriptionAr === 'string' ? values.descriptionAr.trim() || null : null,
        durationMin,
        priceHalalas,
        concernTags: Array.isArray(values.concernTags)
          ? values.concernTags.filter((t): t is string => typeof t === 'string')
          : [],
        category,
        bookingEnabled,
        payMode: 'pay_at_venue',
        active: false,
        contentStatus: 'draft',
        reviewStatus: 'draft',
        profileId: draft.profileId,
        schemaVersion: draft.schemaVersion,
        ...(serviceProfileJson !== undefined ? { serviceProfileJson } : {}),
        ...(attributesJson !== undefined ? { attributesJson } : {}),
        ...(availabilityDoc
          ? { availabilityJson: availabilityDoc as unknown as Prisma.InputJsonValue }
          : {}),
        ...placeFields,
      },
    });
    return row.id;
  }

  private async applyToExisting(
    tx: Prisma.TransactionClient,
    partnerId: string,
    kind: 'product' | 'service',
    targetOwnerId: string,
    draft: { profileId: string; schemaVersion: number },
    values: Record<string, unknown>,
  ) {
    if (kind === 'product') {
      await tx.$executeRaw`SELECT id FROM products WHERE id = ${targetOwnerId} FOR UPDATE`;
      const current = await tx.product.findFirst({ where: { id: targetOwnerId, partnerId } });
      if (!current) throw new NotFoundException('المنتج غير موجود');
      const published = current.contentStatus === 'published';
      const nameAr = typeof values.nameAr === 'string' ? values.nameAr.trim() : current.nameAr;
      const nameEn =
        typeof values.nameEn === 'string' && values.nameEn.trim()
          ? values.nameEn.trim()
          : published
            ? current.nameEn
            : nameAr;
      const descriptionAr =
        typeof values.descriptionAr === 'string' ? values.descriptionAr.trim() || null : current.descriptionAr;
      if (values.variantsJson !== undefined && values.variantsJson !== null) {
        await assertVariantMediaIdsEligible(tx, targetOwnerId, values.variantsJson);
      }

      const attributesRaw = attributesJsonFromDraftValues(values, this.registry.getRegistry().fields);
      const baseline = readTaxonomyBaseline(current);
      const taxonomyTouched =
        values.category !== undefined ||
        values.subcategory !== undefined ||
        attributesRaw !== undefined ||
        draft.profileId !== (baseline.profileId ?? '');
      const applied = taxonomyTouched
        ? applyTaxonomyPatch(
            this.taxonomyWriteContext(),
            baseline,
            {
              category: values.category === undefined ? undefined : normalizeOptionalId(values.category),
              subcategory: values.subcategory === undefined ? undefined : normalizeOptionalId(values.subcategory),
              profileId: draft.profileId,
              attributes: attributesRaw,
            },
            { published },
          )
        : null;
      if (applied) this.throwTaxonomyErrors(applied.errors);

      // Content only — do not overwrite operational price/stock/delivery from stale draft when published.
      if (published) {
        await tx.product.update({
          where: { id: targetOwnerId },
          data: {
            draftNameAr: nameAr,
            draftNameEn: nameEn,
            draftDescriptionAr: descriptionAr ?? '',
            schemaVersion: draft.schemaVersion,
            reviewRevision: { increment: 1 },
            reviewStatus: current.reviewStatus === 'in_review' ? 'in_review' : 'draft',
            ...(applied ? applied.draftData : {}),
            ...(() => {
              const mapped = optionsJsonFromDraftValues(values);
              if (mapped === undefined && values.optionsJson === undefined) return {};
              return {
                draftOptionsSet: true,
                draftOptionsJson: mapped === undefined ? Prisma.DbNull : mapped,
              };
            })(),
            ...(values.variantsJson !== undefined
              ? {
                  draftVariantsSet: true,
                  draftVariantsJson:
                    values.variantsJson == null
                      ? Prisma.DbNull
                      : (values.variantsJson as Prisma.InputJsonValue),
                }
              : {}),
          },
        });
      } else {
        const mappedOptions = optionsJsonFromDraftValues(values);
        await tx.product.update({
          where: { id: targetOwnerId },
          data: {
            nameAr,
            nameEn,
            descriptionAr,
            profileId: applied?.next.profileId ?? draft.profileId,
            schemaVersion: draft.schemaVersion,
            reviewRevision: { increment: 1 },
            reviewStatus: 'draft',
            ...(typeof values.priceHalalas === 'number' ? { priceHalalas: values.priceHalalas } : {}),
            ...(typeof values.externalUrl === 'string' ? { externalUrl: values.externalUrl.trim() } : {}),
            ...(Array.isArray(values.concernTags)
              ? { concernTags: values.concernTags.filter((t): t is string => typeof t === 'string') }
              : {}),
            ...(applied ? applied.liveData : {}),
            ...(mappedOptions !== undefined ? { optionsJson: mappedOptions } : {}),
            ...(values.variantsJson !== undefined
              ? {
                  variantsJson:
                    values.variantsJson == null
                      ? Prisma.DbNull
                      : (values.variantsJson as Prisma.InputJsonValue),
                }
              : {}),
          },
        });
      }
      return;
    }

    await tx.$executeRaw`SELECT id FROM services WHERE id = ${targetOwnerId} FOR UPDATE`;
    const current = await tx.service.findFirst({ where: { id: targetOwnerId, partnerId } });
    if (!current) throw new NotFoundException('الخدمة غير موجودة');
    const published = current.contentStatus === 'published';
    const nameAr = typeof values.nameAr === 'string' ? values.nameAr.trim() : current.nameAr;
    const nameEn =
      typeof values.nameEn === 'string' && values.nameEn.trim()
        ? values.nameEn.trim()
        : published
          ? current.nameEn
          : nameAr;
    const descriptionAr =
      typeof values.descriptionAr === 'string' ? values.descriptionAr.trim() || null : current.descriptionAr;
    const profileDoc =
      values.serviceProfile && typeof values.serviceProfile === 'object'
        ? (values.serviceProfile as Prisma.InputJsonValue)
        : undefined;
    const attributesRaw = attributesJsonFromDraftValues(values, this.registry.getRegistry().fields);
    const leaf =
      typeof values.subcategory === 'string' && values.subcategory.trim()
        ? values.subcategory.trim()
        : null;
    const mergeServiceAttrs = (raw: unknown): Prisma.InputJsonValue | undefined => {
      if (raw === undefined && !leaf) return undefined;
      const base =
        raw && typeof raw === 'object' && !Array.isArray(raw) ? { ...(raw as Record<string, unknown>) } : {};
      if (leaf) {
        base.subcategory = leaf;
        base.taxonomyLeaf = leaf;
      }
      return base as Prisma.InputJsonValue;
    };
    const mergedAttrs = mergeServiceAttrs(attributesRaw);

    if (published) {
      await tx.service.update({
        where: { id: targetOwnerId },
        data: {
          draftNameAr: nameAr,
          draftNameEn: nameEn,
          draftDescriptionAr: descriptionAr ?? '',
          profileId: draft.profileId,
          schemaVersion: draft.schemaVersion,
          reviewRevision: { increment: 1 },
          reviewStatus: current.reviewStatus === 'in_review' ? 'in_review' : 'draft',
          // Do NOT overwrite live price/duration/availability from draft content.
          ...(profileDoc !== undefined
            ? { draftServiceProfileSet: true, draftServiceProfileJson: profileDoc }
            : {}),
          ...(mergedAttrs !== undefined
            ? {
                draftAttributesSet: true,
                draftAttributesJson: mergedAttrs,
              }
            : {}),
        },
      });
    } else {
      await tx.service.update({
        where: { id: targetOwnerId },
        data: {
          nameAr,
          nameEn,
          descriptionAr,
          profileId: draft.profileId,
          schemaVersion: draft.schemaVersion,
          reviewRevision: { increment: 1 },
          reviewStatus: 'draft',
          ...(typeof values.priceHalalas === 'number' ? { priceHalalas: values.priceHalalas } : {}),
          ...(typeof values.durationMin === 'number' ? { durationMin: values.durationMin } : {}),
          ...(Array.isArray(values.concernTags)
            ? { concernTags: values.concernTags.filter((t): t is string => typeof t === 'string') }
            : {}),
          ...(typeof values.category === 'string' || values.category === null
            ? { category: typeof values.category === 'string' ? values.category : null }
            : leaf
              ? { category: leaf.startsWith('occasions.') ? 'occasions' : current.category }
              : {}),
          ...(profileDoc !== undefined
            ? {
                serviceProfileJson: profileDoc,
                draftServiceProfileJson: Prisma.DbNull,
                draftServiceProfileSet: false,
              }
            : {}),
          ...(mergedAttrs !== undefined
            ? {
                attributesJson: mergedAttrs,
                draftAttributesJson: Prisma.DbNull,
                draftAttributesSet: false,
              }
            : {}),
          ...(() => {
            const scheduleTouched =
              Array.isArray(values.weeklyHours) ||
              Array.isArray(values.dateExceptions) ||
              values.availabilityJson !== undefined;
            if (!scheduleTouched) return {};
            // Do not swallow normalize errors — surface as failed rematerialize.
            const availabilityDoc = availabilityFromBulkSchedule(values);
            // Explicit empty weeklyHours/dateExceptions must clear stored availability
            // (omit vs clear: missing keys = no schedule change; [] = clear).
            if (!availabilityDoc) {
              return {
                availabilityJson: Prisma.DbNull,
                bookingEnabled: false,
              };
            }
            return {
              availabilityJson: availabilityDoc as unknown as Prisma.InputJsonValue,
              bookingEnabled:
                values.bookingEnabled === true ||
                (values.bookingEnabled !== false && (availabilityDoc.windows || []).length > 0),
            };
          })(),
          ...placeFieldsFromBulkValues(values),
        },
      });
    }
  }
}
