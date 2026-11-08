import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { EditorDraftsService } from '../editor-drafts/editor-drafts.service';
import { EDITOR_SCHEMA_VERSION } from '../registry/registry.types';
import { RegistryService } from '../registry/registry.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PARTNER_KIND_FORBIDDEN, partnerCanCreateKind } from '../partner-capabilities';

function bulkError(status: HttpStatus, code: string, messageAr: string, extra: Record<string, unknown> = {}) {
  return new HttpException({ message: messageAr, messageAr, code, ...extra }, status);
}

/** Announced operational limit — raise later without changing card identity scheme. */
export const BULK_BATCH_MAX_CARDS = 50;
export const BULK_BATCH_DEFAULT_LIMIT = 10;

const META_SUFFIX = '_meta';

type MetaPayload = {
  v: 1;
  batchId: string;
  kind: 'product' | 'service';
  profileId: string;
  cardIds: string[];
  count: number;
  limit: number;
  createdAt: string;
  /** creating = cards incomplete; ready = all card drafts present */
  createStatus: 'creating' | 'ready';
};

function isWrittenValue(prev: unknown): boolean {
  return (
    prev != null &&
    prev !== '' &&
    !(typeof prev === 'object' && !Array.isArray(prev) && Object.keys(prev as object).length === 0)
  );
}

/** Flatten owner product/service row into draft-shaped values for bulk reopen. */
function ownerRowToDraftValues(
  kind: 'product' | 'service',
  row: Record<string, unknown>,
): Record<string, unknown> {
  const draftTaxonomySet = row.draftTaxonomySet === true;
  const category = draftTaxonomySet ? row.draftCategory : row.category;
  const subcategory = draftTaxonomySet ? row.draftSubcategory : row.subcategory;
  const profileId = draftTaxonomySet ? row.draftProfileId : row.profileId;
  const attrsRaw = draftTaxonomySet ? row.draftAttributesJson : row.attributesJson;
  const attrs =
    attrsRaw && typeof attrsRaw === 'object' && !Array.isArray(attrsRaw)
      ? { ...(attrsRaw as Record<string, unknown>) }
      : {};
  const nameAr =
    typeof row.draftNameAr === 'string' && row.draftNameAr.trim()
      ? row.draftNameAr
      : row.nameAr;
  const descriptionAr =
    row.draftDescriptionAr !== undefined && row.draftDescriptionAr !== null
      ? row.draftDescriptionAr
      : row.descriptionAr;
  const values: Record<string, unknown> = {
    ...attrs,
    nameAr,
    priceHalalas: row.priceHalalas,
  };
  // Preserve intentional empty description (clear) separately from "unset".
  if (descriptionAr !== undefined && descriptionAr !== null) values.descriptionAr = descriptionAr;
  if (category != null) values.category = category;
  if (subcategory !== undefined) values.subcategory = subcategory;
  if (profileId != null) values.profileId = profileId;
  if (row.purchaseMode != null) values.purchaseMode = row.purchaseMode;
  // Contract field is stockQty (null = untracked / unspecified).
  if (Object.prototype.hasOwnProperty.call(row, 'stockQty')) {
    values.stockQty = row.stockQty;
  }
  // Prefer explicit attribute, else derive from Product.inventoryMode + stockQty.
  const attrMode = attrs.inventoryMode;
  if (attrMode === 'untracked' || attrMode === 'product' || attrMode === 'variant') {
    values.inventoryMode = attrMode;
  } else if (row.inventoryMode === 'variant') {
    values.inventoryMode = 'variant';
  } else if (values.stockQty === 0 || (typeof values.stockQty === 'number' && Number.isFinite(values.stockQty))) {
    values.inventoryMode = 'product';
  } else if (values.stockQty == null) {
    values.inventoryMode = 'untracked';
  }
  if (row.deliveryFeeHalalas !== undefined) values.deliveryFeeHalalas = row.deliveryFeeHalalas;
  const optionsJson = row.draftOptionsSet ? row.draftOptionsJson : row.optionsJson;
  const variantsJson = row.draftVariantsSet ? row.draftVariantsJson : row.variantsJson;
  if (optionsJson !== undefined) values.optionsJson = optionsJson;
  if (variantsJson !== undefined) values.variantsJson = variantsJson;
  if (kind === 'service' && row.durationMin != null) values.durationMin = row.durationMin;
  return values;
}

@Injectable()
export class BulkBatchesService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RegistryService) private readonly registry: RegistryService,
    @Inject(EditorDraftsService) private readonly drafts: EditorDraftsService,
  ) {}

  private metaClientId(batchId: string) {
    return `p6:${batchId}:${META_SUFFIX}`;
  }

  private cardClientId(batchId: string, cardId: string) {
    return `p6:${batchId}:${cardId}`;
  }

  private parseBatchIdFromClient(clientDraftId: string): string | null {
    const m = /^p6:([^:]+):/.exec(clientDraftId);
    return m?.[1] ?? null;
  }

  private async partnerType(partnerId: string): Promise<string> {
    const partner = await this.prisma.partner.findUnique({ where: { id: partnerId } });
    if (!partner || partner.status !== 'active') throw new NotFoundException('الشريك غير متاح');
    return partner.type;
  }

  private assertBatchId(raw: string | undefined): string {
    const batchId = (raw && String(raw).trim()) || randomUUID();
    if (batchId.length > 64 || /[^a-zA-Z0-9_-]/.test(batchId)) {
      throw bulkError(HttpStatus.BAD_REQUEST, 'BULK_BATCH_ID_INVALID', 'معرّف الدفعة غير صالح');
    }
    return batchId;
  }

  /** Reject silent floor/truncate — count must be an integer in range. */
  private assertCount(raw: unknown): number {
    if (typeof raw !== 'number' || !Number.isInteger(raw)) {
      throw bulkError(
        HttpStatus.BAD_REQUEST,
        'BULK_COUNT_INVALID',
        'عدد البطاقات يجب أن يكون عددًا صحيحًا دون تقريب',
      );
    }
    if (raw < 1) {
      throw bulkError(HttpStatus.BAD_REQUEST, 'BULK_COUNT_INVALID', 'عدد البطاقات يجب أن يكون ≥ 1');
    }
    if (raw > BULK_BATCH_MAX_CARDS) {
      throw bulkError(
        HttpStatus.BAD_REQUEST,
        'BULK_COUNT_LIMIT',
        `الحد التشغيلي الحالي ${BULK_BATCH_MAX_CARDS} بطاقة لكل دفعة`,
        { max: BULK_BATCH_MAX_CARDS },
      );
    }
    return raw;
  }

  private cardIdsForCount(count: number): string[] {
    const cardIds: string[] = [];
    for (let i = 0; i < count; i += 1) {
      cardIds.push(`c${String(i + 1).padStart(3, '0')}`);
    }
    return cardIds;
  }

  private async readMetaRow(partnerId: string, batchId: string) {
    return this.prisma.partnerEditorDraft.findUnique({
      where: { partnerId_clientDraftId: { partnerId, clientDraftId: this.metaClientId(batchId) } },
    });
  }

  private parseMeta(row: { valuesJson: Prisma.JsonValue; status: string }, batchId: string): MetaPayload {
    if (row.status === 'discarded') throw new NotFoundException('الدفعة غير موجودة');
    const values = (row.valuesJson ?? {}) as Partial<MetaPayload>;
    if (values.v !== 1 || values.batchId !== batchId || !Array.isArray(values.cardIds)) {
      throw bulkError(HttpStatus.CONFLICT, 'BULK_META_CORRUPT', 'بيانات الدفعة تالفة');
    }
    return {
      v: 1,
      batchId: values.batchId,
      kind: values.kind as 'product' | 'service',
      profileId: String(values.profileId),
      cardIds: values.cardIds.map(String),
      count: typeof values.count === 'number' ? values.count : values.cardIds.length,
      limit: typeof values.limit === 'number' ? values.limit : BULK_BATCH_MAX_CARDS,
      createdAt: String(values.createdAt || ''),
      createStatus: values.createStatus === 'ready' ? 'ready' : 'creating',
    };
  }

  private async readMeta(partnerId: string, batchId: string): Promise<MetaPayload> {
    const row = await this.readMetaRow(partnerId, batchId);
    if (!row) throw new NotFoundException('الدفعة غير موجودة');
    return this.parseMeta(row, batchId);
  }

  /**
   * Ensure every declared card draft exists. Safe to call after interrupt.
   * Returns true when batch is ready.
   */
  private async ensureCards(
    partnerId: string,
    meta: MetaPayload,
  ): Promise<{ ready: boolean; missing: string[] }> {
    const missing: string[] = [];
    for (const cardId of meta.cardIds) {
      const clientDraftId = this.cardClientId(meta.batchId, cardId);
      const row = await this.prisma.partnerEditorDraft.findUnique({
        where: { partnerId_clientDraftId: { partnerId, clientDraftId } },
      });
      if (!row || row.status === 'discarded') missing.push(cardId);
    }
    if (!missing.length) {
      if (meta.createStatus !== 'ready') {
        await this.prisma.partnerEditorDraft.update({
          where: { partnerId_clientDraftId: { partnerId, clientDraftId: this.metaClientId(meta.batchId) } },
          data: {
            valuesJson: { ...meta, createStatus: 'ready' } as unknown as Prisma.InputJsonValue,
          },
        });
      }
      return { ready: true, missing: [] };
    }

    // Create missing cards in one transaction (idempotent create skipDuplicates via unique).
    await this.prisma.$transaction(async (tx) => {
      for (const cardId of missing) {
        const clientDraftId = this.cardClientId(meta.batchId, cardId);
        const existing = await tx.partnerEditorDraft.findUnique({
          where: { partnerId_clientDraftId: { partnerId, clientDraftId } },
        });
        if (existing && existing.status !== 'discarded') continue;
        if (existing?.status === 'discarded') {
          await tx.partnerEditorDraft.update({
            where: { id: existing.id },
            data: {
              status: 'open',
              kind: meta.kind,
              profileId: meta.profileId,
              schemaVersion: EDITOR_SCHEMA_VERSION,
              valuesJson: {},
              revision: 1,
              targetOwnerId: null,
              materializedAt: null,
              materializeKey: null,
              materializeFingerprint: null,
              submitReviewStatus: null,
              submitReviewError: null,
            },
          });
          continue;
        }
        await tx.partnerEditorDraft.create({
          data: {
            partnerId,
            clientDraftId,
            kind: meta.kind,
            profileId: meta.profileId,
            schemaVersion: EDITOR_SCHEMA_VERSION,
            valuesJson: {},
            revision: 1,
            status: 'open',
          },
        });
      }
      await tx.partnerEditorDraft.update({
        where: { partnerId_clientDraftId: { partnerId, clientDraftId: this.metaClientId(meta.batchId) } },
        data: {
          valuesJson: { ...meta, createStatus: 'ready' } as unknown as Prisma.InputJsonValue,
        },
      });
    });
    return { ready: true, missing: [] };
  }

  async create(
    partnerId: string,
    body: {
      kind: 'product' | 'service';
      profileId: string;
      count: number;
      batchId?: string;
    },
  ) {
    this.registry.assertEditorV2Enabled();
    const kind = body.kind;
    if (kind !== 'product' && kind !== 'service') {
      throw bulkError(HttpStatus.BAD_REQUEST, 'BULK_KIND_INVALID', 'نوع العنصر غير صالح');
    }
    const count = this.assertCount(body.count);
    const partnerType = await this.partnerType(partnerId);
    if (!partnerCanCreateKind(partnerType, kind)) {
      throw bulkError(HttpStatus.FORBIDDEN, PARTNER_KIND_FORBIDDEN, 'نوع العنصر غير مسموح لهذا الحساب');
    }
    this.registry.assertProfileAllowed(body.profileId, partnerType, kind);
    const batchId = this.assertBatchId(body.batchId);
    const cardIds = this.cardIdsForCount(count);

    const existing = await this.readMetaRow(partnerId, batchId);
    if (existing && existing.status !== 'discarded') {
      const meta = this.parseMeta(existing, batchId);
      const mismatch: string[] = [];
      if (meta.kind !== kind) mismatch.push('kind');
      if (meta.profileId !== body.profileId) mismatch.push('profileId');
      if (meta.count !== count && meta.cardIds.length !== count) mismatch.push('count');
      if (mismatch.length) {
        throw bulkError(
          HttpStatus.CONFLICT,
          'BULK_IDEMPOTENCY_MISMATCH',
          'نفس معرّف الدفعة مستخدم ببيانات مختلفة',
          {
            mismatchFields: mismatch,
            existing: { kind: meta.kind, profileId: meta.profileId, count: meta.count },
            requested: { kind, profileId: body.profileId, count },
          },
        );
      }
      // Resume incomplete create — do not 404; complete missing cards.
      await this.ensureCards(partnerId, meta);
      return this.get(partnerId, batchId);
    }

    const meta: MetaPayload = {
      v: 1,
      batchId,
      kind,
      profileId: body.profileId,
      cardIds,
      count,
      limit: BULK_BATCH_MAX_CARDS,
      createdAt: new Date().toISOString(),
      createStatus: 'creating',
    };

    // Atomic: meta + all cards in one transaction. Concurrent same batchId → unique conflict → resume path.
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.partnerEditorDraft.create({
          data: {
            partnerId,
            clientDraftId: this.metaClientId(batchId),
            kind,
            profileId: body.profileId,
            schemaVersion: EDITOR_SCHEMA_VERSION,
            valuesJson: meta as unknown as Prisma.InputJsonValue,
            revision: 1,
            status: 'open',
          },
        });
        for (const cardId of cardIds) {
          await tx.partnerEditorDraft.create({
            data: {
              partnerId,
              clientDraftId: this.cardClientId(batchId, cardId),
              kind,
              profileId: body.profileId,
              schemaVersion: EDITOR_SCHEMA_VERSION,
              valuesJson: {},
              revision: 1,
              status: 'open',
            },
          });
        }
        await tx.partnerEditorDraft.update({
          where: { partnerId_clientDraftId: { partnerId, clientDraftId: this.metaClientId(batchId) } },
          data: {
            valuesJson: { ...meta, createStatus: 'ready' } as unknown as Prisma.InputJsonValue,
          },
        });
      });
    } catch (e) {
      // Unique race: other request created meta — resume/complete.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const row = await this.readMetaRow(partnerId, batchId);
        if (!row || row.status === 'discarded') {
          throw bulkError(HttpStatus.CONFLICT, 'BULK_CREATE_RACE', 'تعارض إنشاء الدفعة؛ أعيدي المحاولة');
        }
        const metaRace = this.parseMeta(row, batchId);
        if (metaRace.kind !== kind || metaRace.profileId !== body.profileId || metaRace.count !== count) {
          throw bulkError(
            HttpStatus.CONFLICT,
            'BULK_IDEMPOTENCY_MISMATCH',
            'نفس معرّف الدفعة مستخدم ببيانات مختلفة',
            { mismatchFields: ['race'] },
          );
        }
        await this.ensureCards(partnerId, metaRace);
        return this.get(partnerId, batchId);
      }
      throw e;
    }

    return this.get(partnerId, batchId);
  }

  async list(partnerId: string) {
    this.registry.assertEditorV2Enabled();
    const rows = await this.prisma.partnerEditorDraft.findMany({
      where: {
        partnerId,
        status: { not: 'discarded' },
        clientDraftId: { startsWith: 'p6:', endsWith: `:${META_SUFFIX}` },
      },
      orderBy: { updatedAt: 'desc' },
      take: 40,
    });
    const items = [];
    for (const r of rows) {
      const batchId = ((r.valuesJson as MetaPayload)?.batchId) ?? this.parseBatchIdFromClient(r.clientDraftId);
      if (!batchId) continue;
      let meta: MetaPayload;
      try {
        meta = this.parseMeta(r, batchId);
      } catch {
        continue;
      }
      const cardRows = await this.prisma.partnerEditorDraft.findMany({
        where: {
          partnerId,
          clientDraftId: { in: meta.cardIds.map((id) => this.cardClientId(batchId, id)) },
          status: { not: 'discarded' },
        },
        select: { status: true, submitReviewStatus: true },
      });
      const ready = meta.createStatus === 'ready' && cardRows.length === meta.cardIds.length;
      items.push({
        batchId,
        kind: meta.kind,
        profileId: meta.profileId,
        cardCount: meta.cardIds.length,
        createStatus: ready ? 'ready' : 'creating',
        ready,
        materializedCount: cardRows.filter((c) => c.status === 'materialized').length,
        openCount: cardRows.filter((c) => c.status === 'open').length,
        updatedAt: r.updatedAt.toISOString(),
        createdAt: meta.createdAt || r.createdAt.toISOString(),
        openUrl: `/dashboard.html?bulk=${encodeURIComponent(batchId)}`,
      });
    }
    return {
      items,
      maxCards: BULK_BATCH_MAX_CARDS,
      defaultLimit: BULK_BATCH_DEFAULT_LIMIT,
    };
  }

  async get(partnerId: string, batchId: string) {
    this.registry.assertEditorV2Enabled();
    let meta = await this.readMeta(partnerId, batchId);
    if (meta.createStatus !== 'ready') {
      await this.ensureCards(partnerId, meta);
      meta = await this.readMeta(partnerId, batchId);
    }
    const cards = [];
    for (const cardId of meta.cardIds) {
      let draft;
      try {
        draft = await this.drafts.get(partnerId, this.cardClientId(batchId, cardId));
      } catch {
        await this.ensureCards(partnerId, meta);
        draft = await this.drafts.get(partnerId, this.cardClientId(batchId, cardId));
      }
      let contentStatus: string | null = null;
      let reviewStatus: string | null = null;
      let values: Record<string, unknown> = { ...((draft.values as Record<string, unknown>) || {}) };
      let media: {
        videoMediaId: string | null;
        videoReady: boolean;
        previewUrl: string | null;
      } = { videoMediaId: null, videoReady: false, previewUrl: null };
      if (draft.targetOwnerId) {
        if (draft.kind === 'product') {
          const p = await this.prisma.product.findFirst({
            where: { id: draft.targetOwnerId, partnerId },
          });
          contentStatus = p?.contentStatus ?? null;
          reviewStatus = p?.reviewStatus ?? null;
          // After materialize, owner row is the source of truth for reopen (draft PUT is blocked).
          if (draft.status === 'materialized' && p) {
            values = ownerRowToDraftValues('product', p as unknown as Record<string, unknown>);
          }
        } else {
          const s = await this.prisma.service.findFirst({
            where: { id: draft.targetOwnerId, partnerId },
          });
          contentStatus = s?.contentStatus ?? null;
          reviewStatus = s?.reviewStatus ?? null;
          if (draft.status === 'materialized' && s) {
            values = ownerRowToDraftValues('service', s as unknown as Record<string, unknown>);
          }
        }
        // Draft uploads are stored with active=false + publication=draft until publish.
        // Partner reopen must still see them — do not require active:true here.
        const mediaRows = await this.prisma.catalogMedia.findMany({
          where: {
            ownerKind: draft.kind,
            ownerId: draft.targetOwnerId,
            pendingRemoval: false,
          },
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          select: {
            id: true,
            kind: true,
            url: true,
            mimeType: true,
            publication: true,
            active: true,
            isPrimary: true,
            draftIsPrimary: true,
            placement: true,
            createdAt: true,
          },
        });
        const videos = mediaRows.filter(
          (m) =>
            m.kind === 'video' ||
            (typeof m.mimeType === 'string' && m.mimeType.startsWith('video/')),
        );
        // Video "primary" flags are image-cover semantics — for journey video pick the
        // newest main-placement row so a successful replace is what reopen shows.
        videos.sort((a, b) => {
          const aMain = a.placement === 'main' || a.placement == null || a.placement === '' ? 1 : 0;
          const bMain = b.placement === 'main' || b.placement == null || b.placement === '' ? 1 : 0;
          if (bMain !== aMain) return bMain - aMain;
          return (b.createdAt?.getTime?.() || 0) - (a.createdAt?.getTime?.() || 0);
        });
        const video = videos[0];
        if (video) {
          // Partner-auth preview path (not public marketplace). Absolute https urls kept as-is.
          const previewUrl =
            typeof video.url === 'string' && /^https?:\/\//i.test(video.url)
              ? video.url
              : null;
          media = {
            videoMediaId: video.id,
            videoReady: true,
            previewUrl,
            // Client resolves via PartnersApi.base + Bearer → blob (cross-origin safe).
            partnerMediaPath: `/partners-portal/media/${encodeURIComponent(video.id)}`,
          };
        }
      }
      cards.push({
        cardId,
        clientDraftId: draft.clientDraftId,
        revision: draft.revision,
        status: draft.status,
        targetOwnerId: draft.targetOwnerId,
        materializedAt: draft.materializedAt,
        submitReviewStatus: draft.submitReviewStatus,
        submitReviewError: draft.submitReviewError,
        contentStatus,
        reviewStatus,
        values,
        media,
        openUrl: draft.targetOwnerId
          ? `/dashboard.html?edit=${encodeURIComponent(draft.kind)}:${encodeURIComponent(draft.targetOwnerId)}`
          : `/dashboard.html?bulk=${encodeURIComponent(batchId)}&card=${encodeURIComponent(cardId)}`,
      });
    }
    const ready = meta.createStatus === 'ready' && cards.length === meta.cardIds.length;
    return {
      batchId: meta.batchId,
      kind: meta.kind,
      profileId: meta.profileId,
      count: meta.count,
      limit: meta.limit,
      createdAt: meta.createdAt,
      createStatus: ready ? 'ready' : 'creating',
      ready,
      maxCards: BULK_BATCH_MAX_CARDS,
      cards,
    };
  }

  async putCard(
    partnerId: string,
    batchId: string,
    cardId: string,
    body: {
      expectedRevision: number | null;
      /** Partial patch. Omitted keys are unchanged. */
      values?: Record<string, unknown>;
      /** Explicit clear — removes keys even if omitted from values. */
      clearFields?: string[];
      /** When false, refuse to overwrite keys that already have non-empty values. */
      overwriteWritten?: boolean;
    },
  ) {
    this.registry.assertEditorV2Enabled();
    const meta = await this.readMeta(partnerId, batchId);
    if (meta.createStatus !== 'ready') {
      throw bulkError(HttpStatus.CONFLICT, 'BULK_NOT_READY', 'الدفعة لم تكتمل بعد؛ أعيدي إنشاء/استكمال الدفعة');
    }
    if (!meta.cardIds.includes(cardId)) {
      throw bulkError(HttpStatus.NOT_FOUND, 'BULK_CARD_NOT_FOUND', 'البطاقة غير موجودة في الدفعة');
    }
    const clientDraftId = this.cardClientId(batchId, cardId);
    const current = await this.drafts.get(partnerId, clientDraftId);
    if (current.status === 'materialized') {
      throw bulkError(HttpStatus.CONFLICT, 'BULK_CARD_MATERIALIZED', 'لا يمكن تعديل بطاقة بعد التحويل');
    }

    const nextValues = { ...(current.values as Record<string, unknown>) };
    const clearFields = Array.isArray(body.clearFields) ? body.clearFields : [];
    for (const fieldId of clearFields) {
      delete nextValues[fieldId];
    }

    const incoming = body.values ?? {};
    const overwrite = body.overwriteWritten === true;
    const blocked: string[] = [];
    for (const [k, v] of Object.entries(incoming)) {
      if (clearFields.includes(k)) continue;
      // Explicit null in values also means clear.
      if (v === null) {
        if (isWrittenValue(nextValues[k]) && !overwrite) {
          blocked.push(k);
          continue;
        }
        delete nextValues[k];
        continue;
      }
      const prev = nextValues[k];
      if (isWrittenValue(prev) && !overwrite && JSON.stringify(prev) !== JSON.stringify(v)) {
        blocked.push(k);
        continue;
      }
      nextValues[k] = v;
    }
    if (blocked.length && !overwrite) {
      throw bulkError(
        HttpStatus.CONFLICT,
        'BULK_OVERWRITE_REQUIRES_CONFIRM',
        'حقول مكتوبة سابقًا لن تُستبدل دون تأكيد صريح',
        { blockedFields: blocked },
      );
    }

    const saved = await this.drafts.put(partnerId, clientDraftId, {
      expectedRevision: body.expectedRevision,
      kind: meta.kind,
      profileId: meta.profileId,
      schemaVersion: EDITOR_SCHEMA_VERSION,
      values: nextValues,
    });
    return saved;
  }

  async applyShared(
    partnerId: string,
    batchId: string,
    body: {
      cardIds: string[];
      values: Record<string, unknown>;
      clearFields?: string[];
      previewOnly?: boolean;
      overwriteWritten?: boolean;
      /** When set, each card must still be at this revision or the apply fails for that card. */
      expectedRevisions?: Record<string, number>;
    },
  ) {
    this.registry.assertEditorV2Enabled();
    const meta = await this.readMeta(partnerId, batchId);
    const selected = (body.cardIds ?? []).filter((id) => meta.cardIds.includes(id));
    if (!selected.length) {
      throw bulkError(HttpStatus.BAD_REQUEST, 'BULK_CARDS_REQUIRED', 'اختر بطاقة واحدة على الأقل');
    }
    const incoming = body.values ?? {};
    const clearFields = Array.isArray(body.clearFields) ? body.clearFields : [];
    const overwrite = body.overwriteWritten === true;
    const expectedRevisions = body.expectedRevisions || null;

    if (body.previewOnly) {
      const perCard: Array<Record<string, unknown>> = [];
      for (const cardId of selected) {
        const draft = await this.drafts.get(partnerId, this.cardClientId(batchId, cardId));
        const current = draft.values as Record<string, unknown>;
        const willSet: string[] = [];
        const willClear: string[] = [];
        const wouldBlock: string[] = [];
        for (const fieldId of clearFields) {
          if (Object.prototype.hasOwnProperty.call(current, fieldId)) willClear.push(fieldId);
        }
        for (const [k, v] of Object.entries(incoming)) {
          if (clearFields.includes(k) || v === null) {
            if (Object.prototype.hasOwnProperty.call(current, k)) willClear.push(k);
            continue;
          }
          const prev = current[k];
          if (isWrittenValue(prev) && !overwrite && JSON.stringify(prev) !== JSON.stringify(v)) {
            wouldBlock.push(k);
          } else if (JSON.stringify(prev) !== JSON.stringify(v)) {
            willSet.push(k);
          }
        }
        perCard.push({ cardId, revision: draft.revision, willSet, willClear, wouldBlock });
      }
      return {
        preview: true,
        batchId,
        cardIds: selected,
        fieldsThatWillChange: [...new Set([...Object.keys(incoming), ...clearFields])],
        overwriteWritten: overwrite,
        expectedRevisions: Object.fromEntries(perCard.map((p) => [p.cardId as string, p.revision])),
        perCard,
      };
    }

    const results = [];
    let succeeded = 0;
    let failed = 0;
    let skipped = 0;
    for (const cardId of selected) {
      const draft = await this.drafts.get(partnerId, this.cardClientId(batchId, cardId));
      if (expectedRevisions && Object.prototype.hasOwnProperty.call(expectedRevisions, cardId)) {
        const want = expectedRevisions[cardId];
        if (want !== draft.revision) {
          results.push({
            cardId,
            ok: false,
            error: {
              code: 'BULK_PREVIEW_REVISION_DRIFT',
              messageAr: 'تغيرت البطاقة بعد المعاينة؛ أعيدي المعاينة قبل التطبيق',
              expectedRevision: want,
              currentRevision: draft.revision,
            },
          });
          failed += 1;
          continue;
        }
      }
      try {
        const put = await this.putCard(partnerId, batchId, cardId, {
          expectedRevision: draft.revision,
          values: incoming,
          clearFields,
          overwriteWritten: overwrite,
        });
        results.push({ cardId, ok: true, revision: put.revision, values: put.values });
        succeeded += 1;
      } catch (e) {
        const err = e as HttpException;
        const payload = typeof err.getResponse === 'function' ? err.getResponse() : { messageAr: String(e) };
        results.push({ cardId, ok: false, error: payload });
        failed += 1;
      }
    }
    return {
      preview: false,
      batchId,
      succeeded,
      failed,
      skipped,
      results,
      partial: failed > 0 && succeeded > 0,
      allOk: failed === 0,
    };
  }

  async materialize(
    partnerId: string,
    batchId: string,
    body: {
      cardIds?: string[];
      submitReview?: boolean;
      /** Retry only failed/open cards; skip already materialized unless submitReview retry needed. */
      failedOnly?: boolean;
    },
    idempotencyKeyHeader: string | undefined,
  ) {
    this.registry.assertEditorV2Enabled();
    const meta = await this.readMeta(partnerId, batchId);
    if (meta.createStatus !== 'ready') {
      throw bulkError(HttpStatus.CONFLICT, 'BULK_NOT_READY', 'الدفعة غير جاهزة للتحويل');
    }
    let targets = meta.cardIds;
    if (body.cardIds?.length) {
      targets = body.cardIds.filter((id) => meta.cardIds.includes(id));
    }
    const submitReview = body.submitReview === true;
    const results: Array<Record<string, unknown>> = [];
    for (const cardId of targets) {
      const clientDraftId = this.cardClientId(batchId, cardId);
      const draft = await this.drafts.get(partnerId, clientDraftId);
      if (draft.status === 'materialized') {
        // Allow resume of submit-review without creating another item.
        if (submitReview && draft.submitReviewStatus !== 'submitted') {
          try {
            const row = await this.prisma.partnerEditorDraft.findUnique({
              where: { partnerId_clientDraftId: { partnerId, clientDraftId } },
              select: { materializeKey: true },
            });
            const out = await this.drafts.materialize(
              partnerId,
              clientDraftId,
              { expectedRevision: draft.revision, submitReview: true },
              row?.materializeKey || `${idempotencyKeyHeader || `bulk-${batchId}`}:${cardId}`,
            );
            results.push({
              cardId,
              ok: true,
              skipped: false,
              resumedReview: true,
              targetOwnerId: out.targetOwnerId,
              clientDraftId,
              status: out.status,
              submitReviewStatus: out.submitReviewStatus,
            });
          } catch (e) {
            const err = e as HttpException;
            const payload = typeof err.getResponse === 'function' ? err.getResponse() : { messageAr: String(e) };
            results.push({ cardId, ok: false, error: payload, clientDraftId, targetOwnerId: draft.targetOwnerId });
          }
          continue;
        }
        results.push({
          cardId,
          ok: true,
          skipped: true,
          reason: 'already_materialized',
          targetOwnerId: draft.targetOwnerId,
          clientDraftId,
          submitReviewStatus: draft.submitReviewStatus,
        });
        continue;
      }
      if (draft.status !== 'open') {
        results.push({ cardId, ok: false, error: { code: 'BULK_CARD_STATUS', status: draft.status } });
        continue;
      }
      const cardKey = `${idempotencyKeyHeader || `bulk-${batchId}`}:${cardId}`;
      try {
        const out = await this.drafts.materialize(
          partnerId,
          clientDraftId,
          { expectedRevision: draft.revision, submitReview },
          cardKey,
        );
        results.push({
          cardId,
          ok: true,
          skipped: false,
          targetOwnerId: out.targetOwnerId,
          clientDraftId,
          replay: out.replay === true,
          status: out.status,
          submitReviewStatus: out.submitReviewStatus,
          openUrl: `/dashboard.html?edit=${encodeURIComponent(meta.kind)}:${encodeURIComponent(out.targetOwnerId)}`,
        });
      } catch (e) {
        const err = e as HttpException;
        const payload = typeof err.getResponse === 'function' ? err.getResponse() : { messageAr: String(e) };
        results.push({ cardId, ok: false, error: payload, clientDraftId });
      }
    }
    const succeeded = results.filter((r) => r.ok && !r.skipped).length;
    const failed = results.filter((r) => !r.ok).length;
    const skipped = results.filter((r) => r.ok && r.skipped).length;
    const partnerType = await this.partnerType(partnerId);
    const developerAuto =
      submitReview === true && partnerType === 'developer';
    return {
      batchId,
      succeeded,
      failed,
      skipped,
      results,
      developerAutoPublish: developerAuto,
      noteAr: developerAuto
        ? 'حساب المطوّر: التقديم مع التحويل ينشر مباشرة بلا موافقة إدارية (خاصية المطوّر فقط).'
        : 'materialized لا يعني published — النشر يظهر بعد موافقة المحتوى عند اللزوم',
    };
  }

  /** Grow an existing batch by one empty card — sequential «عرض تالٍ» without upfront count. */
  async appendCard(partnerId: string, batchId: string) {
    this.registry.assertEditorV2Enabled();
    const meta = await this.readMeta(partnerId, batchId);
    if (meta.createStatus !== 'ready') {
      throw bulkError(HttpStatus.CONFLICT, 'BULK_NOT_READY', 'الدفعة لم تكتمل بعد');
    }
    if (meta.cardIds.length >= BULK_BATCH_MAX_CARDS) {
      throw bulkError(
        HttpStatus.BAD_REQUEST,
        'BULK_COUNT_LIMIT',
        `الحد التشغيلي الحالي ${BULK_BATCH_MAX_CARDS} بطاقة لكل دفعة`,
        { max: BULK_BATCH_MAX_CARDS },
      );
    }
    let nextIndex = meta.cardIds.length + 1;
    let cardId = `c${String(nextIndex).padStart(3, '0')}`;
    while (meta.cardIds.includes(cardId)) {
      nextIndex += 1;
      cardId = `c${String(nextIndex).padStart(3, '0')}`;
    }
    const nextMeta: MetaPayload = {
      ...meta,
      cardIds: [...meta.cardIds, cardId],
      count: meta.cardIds.length + 1,
    };
    await this.prisma.$transaction(async (tx) => {
      await tx.partnerEditorDraft.create({
        data: {
          partnerId,
          clientDraftId: this.cardClientId(batchId, cardId),
          kind: meta.kind,
          profileId: meta.profileId,
          schemaVersion: EDITOR_SCHEMA_VERSION,
          valuesJson: {},
          revision: 1,
          status: 'open',
        },
      });
      await tx.partnerEditorDraft.update({
        where: { partnerId_clientDraftId: { partnerId, clientDraftId: this.metaClientId(batchId) } },
        data: { valuesJson: nextMeta as unknown as Prisma.InputJsonValue },
      });
    });
    return this.get(partnerId, batchId);
  }

  /** Remove one card from a group before publish — other cards untouched. */
  async discardCard(partnerId: string, batchId: string, cardId: string) {
    this.registry.assertEditorV2Enabled();
    const meta = await this.readMeta(partnerId, batchId);
    if (!meta.cardIds.includes(cardId)) {
      throw bulkError(HttpStatus.NOT_FOUND, 'BULK_CARD_NOT_FOUND', 'البطاقة غير موجودة في الدفعة');
    }
    if (meta.cardIds.length <= 1) {
      throw bulkError(HttpStatus.BAD_REQUEST, 'BULK_CARD_LAST', 'لا يمكن إزالة العرض الوحيد من المجموعة');
    }
    const draft = await this.drafts.get(partnerId, this.cardClientId(batchId, cardId));
    if (draft.submitReviewStatus === 'submitted') {
      throw bulkError(HttpStatus.CONFLICT, 'BULK_CARD_SUBMITTED', 'لا تُزال بطاقة أُرسلت للمراجعة أو نُشرت');
    }
    if (draft.targetOwnerId) {
      if (meta.kind === 'product') {
        const row = await this.prisma.product.findFirst({
          where: { id: draft.targetOwnerId, partnerId },
          select: { contentStatus: true },
        });
        if (row?.contentStatus === 'published') {
          throw bulkError(HttpStatus.CONFLICT, 'BULK_CARD_PUBLISHED', 'لا تُزال بطاقة منشورة');
        }
      } else {
        const row = await this.prisma.service.findFirst({
          where: { id: draft.targetOwnerId, partnerId },
          select: { contentStatus: true },
        });
        if (row?.contentStatus === 'published') {
          throw bulkError(HttpStatus.CONFLICT, 'BULK_CARD_PUBLISHED', 'لا تُزال بطاقة منشورة');
        }
      }
    }
    const nextIds = meta.cardIds.filter((id) => id !== cardId);
    const nextMeta: MetaPayload = { ...meta, cardIds: nextIds, count: nextIds.length };
    await this.prisma.$transaction(async (tx) => {
      await tx.partnerEditorDraft.update({
        where: { partnerId_clientDraftId: { partnerId, clientDraftId: this.cardClientId(batchId, cardId) } },
        data: { status: 'discarded' },
      });
      await tx.partnerEditorDraft.update({
        where: { partnerId_clientDraftId: { partnerId, clientDraftId: this.metaClientId(batchId) } },
        data: { valuesJson: nextMeta as unknown as Prisma.InputJsonValue },
      });
    });
    return this.get(partnerId, batchId);
  }

  /**
   * One-shot group publish: validate ALL cards first; only then submit.
   * Developer (server partner.type) auto-publishes; others queue for admin review.
   * Trusts stored partner identity — never client-sent roles.
   */
  async publishGroup(partnerId: string, batchId: string, idempotencyKeyHeader: string | undefined) {
    this.registry.assertEditorV2Enabled();
    const partner = await this.prisma.partner.findUnique({
      where: { id: partnerId },
      select: { id: true, type: true, status: true },
    });
    if (!partner || partner.status !== 'active') throw new NotFoundException('الشريك غير متاح');
    const meta = await this.readMeta(partnerId, batchId);
    if (meta.createStatus !== 'ready') {
      throw bulkError(HttpStatus.CONFLICT, 'BULK_NOT_READY', 'الدفعة غير جاهزة');
    }
    if (!partnerCanCreateKind(partner.type, meta.kind)) {
      throw bulkError(HttpStatus.FORBIDDEN, PARTNER_KIND_FORBIDDEN, 'نوع العنصر غير مسموح لهذا الحساب');
    }

    const blockers: Array<{ cardId: string; field: string; messageAr: string }> = [];
    const cardSnapshots: Array<{
      cardId: string;
      targetOwnerId: string | null;
      status: string;
      contentStatus: string | null;
      submitReviewStatus: string | null;
      revision: number;
    }> = [];

    for (const cardId of meta.cardIds) {
      const draft = await this.drafts.get(partnerId, this.cardClientId(batchId, cardId));
      const values = (draft.values || {}) as Record<string, unknown>;
      const name = typeof values.nameAr === 'string' ? values.nameAr.trim() : '';
      if (!name) blockers.push({ cardId, field: 'nameAr', messageAr: 'الاسم مطلوب' });
      if (values.priceHalalas == null || values.priceHalalas === '') {
        blockers.push({ cardId, field: 'priceHalalas', messageAr: 'السعر مطلوب' });
      }
      if (meta.kind === 'service' && (values.durationMin == null || values.durationMin === '')) {
        blockers.push({ cardId, field: 'durationMin', messageAr: 'مدة الخدمة مطلوبة' });
      }

      let contentStatus: string | null = null;
      if (draft.targetOwnerId) {
        if (meta.kind === 'product') {
          const row = await this.prisma.product.findFirst({
            where: { id: draft.targetOwnerId, partnerId },
            select: { id: true, contentStatus: true },
          });
          if (!row) {
            blockers.push({ cardId, field: 'ownership', messageAr: 'العنصر لا يخص هذا الحساب' });
          } else {
            contentStatus = row.contentStatus;
          }
        } else {
          const row = await this.prisma.service.findFirst({
            where: { id: draft.targetOwnerId, partnerId },
            select: { id: true, contentStatus: true },
          });
          if (!row) {
            blockers.push({ cardId, field: 'ownership', messageAr: 'العنصر لا يخص هذا الحساب' });
          } else {
            contentStatus = row.contentStatus;
          }
        }

        if (contentStatus !== 'published') {
          const media = await this.prisma.catalogMedia.findMany({
            where: { ownerKind: meta.kind, ownerId: draft.targetOwnerId },
          });
          const hasImage = media.some((m) => m.kind === 'image' && !m.pendingRemoval);
          const hasVideo = media.some((m) => m.kind === 'video' && !m.pendingRemoval);
          if (partner.type === 'developer') {
            if (!hasVideo && !hasImage) {
              blockers.push({
                cardId,
                field: 'media',
                messageAr: 'فيديو صالح واحد يكفي لعرض المطوّر — ارفعي المقطع أولًا',
              });
            }
          } else if (!hasImage) {
            blockers.push({ cardId, field: 'media', messageAr: 'صورة واحدة على الأقل مطلوبة' });
          }
        }
      } else {
        blockers.push({
          cardId,
          field: 'video',
          messageAr: 'احفظي العرض وارفعِ المقطع قبل نشر المجموعة',
        });
      }

      cardSnapshots.push({
        cardId,
        targetOwnerId: draft.targetOwnerId,
        status: draft.status,
        contentStatus,
        submitReviewStatus: draft.submitReviewStatus,
        revision: draft.revision,
      });
    }

    if (blockers.length) {
      throw bulkError(HttpStatus.BAD_REQUEST, 'BULK_GROUP_NOT_READY', 'المجموعة غير جاهزة للنشر', {
        blockers,
        cardCount: meta.cardIds.length,
      });
    }

    // All ready — submit (developer auto-approves inside catalog submit). Idempotent per card.
    const out = await this.materialize(
      partnerId,
      batchId,
      { submitReview: true },
      idempotencyKeyHeader || `publish-group-${batchId}`,
    );

    const published = [];
    const queued = [];
    for (const r of out.results || []) {
      const cardId = String(r.cardId || '');
      const ownerId = (r.targetOwnerId as string) || null;
      if (!ownerId) continue;
      if (meta.kind === 'product') {
        const p = await this.prisma.product.findFirst({
          where: { id: ownerId, partnerId },
          select: { id: true, contentStatus: true, reviewStatus: true, nameAr: true },
        });
        if (p?.contentStatus === 'published') published.push({ cardId, kind: meta.kind, id: p.id, nameAr: p.nameAr });
        else queued.push({ cardId, kind: meta.kind, id: ownerId, reviewStatus: p?.reviewStatus ?? null });
      } else {
        const s = await this.prisma.service.findFirst({
          where: { id: ownerId, partnerId },
          select: { id: true, contentStatus: true, reviewStatus: true, nameAr: true },
        });
        if (s?.contentStatus === 'published') published.push({ cardId, kind: meta.kind, id: s.id, nameAr: s.nameAr });
        else queued.push({ cardId, kind: meta.kind, id: ownerId, reviewStatus: s?.reviewStatus ?? null });
      }
    }

    const developer = partner.type === 'developer';
    return {
      batchId,
      kind: meta.kind,
      developerDirectPublish: developer,
      publishedCount: published.length,
      queuedCount: queued.length,
      published,
      queued,
      materialize: out,
      noteAr: developer
        ? published.length
          ? `تم نشر ${published.length} عروض`
          : 'لم يُنشر شيء — راجعي نتائج التحويل'
        : queued.length
          ? `أُرسلت ${queued.length} عروض للمراجعة`
          : 'لم يُرسل شيء للمراجعة',
    };
  }
}
