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
  limit: number;
  createdAt: string;
};

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

  private async readMeta(partnerId: string, batchId: string): Promise<MetaPayload> {
    const row = await this.prisma.partnerEditorDraft.findUnique({
      where: { partnerId_clientDraftId: { partnerId, clientDraftId: this.metaClientId(batchId) } },
    });
    if (!row || row.status === 'discarded') throw new NotFoundException('الدفعة غير موجودة');
    const values = (row.valuesJson ?? {}) as MetaPayload;
    if (values.v !== 1 || values.batchId !== batchId) {
      throw bulkError(HttpStatus.CONFLICT, 'BULK_META_CORRUPT', 'بيانات الدفعة تالفة');
    }
    return values;
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
    const count = Math.floor(Number(body.count));
    if (!Number.isFinite(count) || count < 1) {
      throw bulkError(HttpStatus.BAD_REQUEST, 'BULK_COUNT_INVALID', 'عدد البطاقات يجب أن يكون ≥ 1');
    }
    if (count > BULK_BATCH_MAX_CARDS) {
      throw bulkError(
        HttpStatus.BAD_REQUEST,
        'BULK_COUNT_LIMIT',
        `الحد التشغيلي الحالي ${BULK_BATCH_MAX_CARDS} بطاقة لكل دفعة`,
        { max: BULK_BATCH_MAX_CARDS },
      );
    }
    const partnerType = await this.partnerType(partnerId);
    this.registry.assertProfileAllowed(body.profileId, partnerType, kind);

    const batchId = (body.batchId && String(body.batchId).trim()) || randomUUID();
    if (batchId.length > 64 || /[^a-zA-Z0-9_-]/.test(batchId)) {
      throw bulkError(HttpStatus.BAD_REQUEST, 'BULK_BATCH_ID_INVALID', 'معرّف الدفعة غير صالح');
    }

    const existing = await this.prisma.partnerEditorDraft.findUnique({
      where: { partnerId_clientDraftId: { partnerId, clientDraftId: this.metaClientId(batchId) } },
    });
    if (existing && existing.status !== 'discarded') {
      return this.get(partnerId, batchId);
    }

    const cardIds: string[] = [];
    for (let i = 0; i < count; i += 1) {
      cardIds.push(`c${String(i + 1).padStart(3, '0')}`);
    }
    const meta: MetaPayload = {
      v: 1,
      batchId,
      kind,
      profileId: body.profileId,
      cardIds,
      limit: BULK_BATCH_MAX_CARDS,
      createdAt: new Date().toISOString(),
    };

    // Meta is batch index only — written directly (not registry field values).
    await this.prisma.partnerEditorDraft.create({
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
      await this.drafts.put(partnerId, this.cardClientId(batchId, cardId), {
        expectedRevision: null,
        kind,
        profileId: body.profileId,
        schemaVersion: EDITOR_SCHEMA_VERSION,
        values: {},
      });
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
    return {
      items: rows.map((r) => {
        const values = (r.valuesJson ?? {}) as MetaPayload;
        return {
          batchId: values.batchId ?? this.parseBatchIdFromClient(r.clientDraftId),
          kind: values.kind ?? r.kind,
          profileId: values.profileId ?? r.profileId,
          cardCount: Array.isArray(values.cardIds) ? values.cardIds.length : 0,
          updatedAt: r.updatedAt.toISOString(),
        };
      }),
      maxCards: BULK_BATCH_MAX_CARDS,
      defaultLimit: BULK_BATCH_DEFAULT_LIMIT,
    };
  }

  async get(partnerId: string, batchId: string) {
    this.registry.assertEditorV2Enabled();
    const meta = await this.readMeta(partnerId, batchId);
    const cards = [];
    for (const cardId of meta.cardIds) {
      const draft = await this.drafts.get(partnerId, this.cardClientId(batchId, cardId));
      cards.push({
        cardId,
        clientDraftId: draft.clientDraftId,
        revision: draft.revision,
        status: draft.status,
        targetOwnerId: draft.targetOwnerId,
        materializedAt: draft.materializedAt,
        submitReviewStatus: draft.submitReviewStatus,
        submitReviewError: draft.submitReviewError,
        values: draft.values,
        openUrl: draft.targetOwnerId
          ? `/dashboard.html?edit=${encodeURIComponent(draft.kind)}:${encodeURIComponent(draft.targetOwnerId)}`
          : `/dashboard.html?bulk=${encodeURIComponent(batchId)}&card=${encodeURIComponent(cardId)}`,
      });
    }
    return {
      batchId: meta.batchId,
      kind: meta.kind,
      profileId: meta.profileId,
      limit: meta.limit,
      createdAt: meta.createdAt,
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
      values: Record<string, unknown>;
      /** When false, refuse to overwrite keys that already have non-empty values (shared fill safety). */
      overwriteWritten?: boolean;
    },
  ) {
    this.registry.assertEditorV2Enabled();
    const meta = await this.readMeta(partnerId, batchId);
    if (!meta.cardIds.includes(cardId)) {
      throw bulkError(HttpStatus.NOT_FOUND, 'BULK_CARD_NOT_FOUND', 'البطاقة غير موجودة في الدفعة');
    }
    const clientDraftId = this.cardClientId(batchId, cardId);
    const current = await this.drafts.get(partnerId, clientDraftId);
    if (current.status === 'materialized') {
      throw bulkError(HttpStatus.CONFLICT, 'BULK_CARD_MATERIALIZED', 'لا يمكن تعديل بطاقة بعد التحويل');
    }

    const nextValues = { ...(current.values as Record<string, unknown>) };
    const incoming = body.values ?? {};
    const overwrite = body.overwriteWritten === true;
    const blocked: string[] = [];
    for (const [k, v] of Object.entries(incoming)) {
      const prev = nextValues[k];
      const hasWritten =
        prev != null &&
        prev !== '' &&
        !(typeof prev === 'object' && !Array.isArray(prev) && Object.keys(prev as object).length === 0);
      if (hasWritten && !overwrite && JSON.stringify(prev) !== JSON.stringify(v)) {
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

    return this.drafts.put(partnerId, clientDraftId, {
      expectedRevision: body.expectedRevision,
      kind: meta.kind,
      profileId: meta.profileId,
      schemaVersion: EDITOR_SCHEMA_VERSION,
      values: nextValues,
    });
  }

  /**
   * Shared fill preview or apply for selected cards.
   * File count must never auto-set product count — callers pass explicit cardIds.
   */
  async applyShared(
    partnerId: string,
    batchId: string,
    body: {
      cardIds: string[];
      values: Record<string, unknown>;
      previewOnly?: boolean;
      overwriteWritten?: boolean;
    },
  ) {
    this.registry.assertEditorV2Enabled();
    const meta = await this.readMeta(partnerId, batchId);
    const selected = (body.cardIds ?? []).filter((id) => meta.cardIds.includes(id));
    if (!selected.length) {
      throw bulkError(HttpStatus.BAD_REQUEST, 'BULK_CARDS_REQUIRED', 'اختر بطاقة واحدة على الأقل');
    }
    const changing = Object.keys(body.values ?? {});
    if (body.previewOnly) {
      return {
        preview: true,
        batchId,
        cardIds: selected,
        fieldsThatWillChange: changing,
        overwriteWritten: body.overwriteWritten === true,
      };
    }
    const results = [];
    for (const cardId of selected) {
      const draft = await this.drafts.get(partnerId, this.cardClientId(batchId, cardId));
      try {
        const put = await this.putCard(partnerId, batchId, cardId, {
          expectedRevision: draft.revision,
          values: body.values,
          overwriteWritten: body.overwriteWritten,
        });
        results.push({ cardId, ok: true, revision: put.revision });
      } catch (e) {
        const err = e as HttpException;
        const payload = typeof err.getResponse === 'function' ? err.getResponse() : { messageAr: String(e) };
        results.push({ cardId, ok: false, error: payload });
      }
    }
    return { preview: false, batchId, results };
  }

  async materialize(
    partnerId: string,
    batchId: string,
    body: {
      cardIds?: string[];
      submitReview?: boolean;
      /** Retry only failed/open cards; skip already materialized. */
      failedOnly?: boolean;
    },
    idempotencyKeyHeader: string | undefined,
  ) {
    this.registry.assertEditorV2Enabled();
    const meta = await this.readMeta(partnerId, batchId);
    let targets = meta.cardIds;
    if (body.cardIds?.length) {
      targets = body.cardIds.filter((id) => meta.cardIds.includes(id));
    }
    const results: Array<Record<string, unknown>> = [];
    for (const cardId of targets) {
      const clientDraftId = this.cardClientId(batchId, cardId);
      const draft = await this.drafts.get(partnerId, clientDraftId);
      if (draft.status === 'materialized') {
        if (body.failedOnly !== false) {
          results.push({
            cardId,
            ok: true,
            skipped: true,
            reason: 'already_materialized',
            targetOwnerId: draft.targetOwnerId,
            clientDraftId,
          });
          continue;
        }
      }
      if (draft.status !== 'open' && draft.status !== 'materialized') {
        results.push({ cardId, ok: false, error: { code: 'BULK_CARD_STATUS', status: draft.status } });
        continue;
      }
      if (draft.status === 'materialized') {
        results.push({
          cardId,
          ok: true,
          skipped: true,
          reason: 'already_materialized',
          targetOwnerId: draft.targetOwnerId,
          clientDraftId,
        });
        continue;
      }
      const cardKey = `${idempotencyKeyHeader || `bulk-${batchId}`}:${cardId}`;
      try {
        const out = await this.drafts.materialize(
          partnerId,
          clientDraftId,
          { expectedRevision: draft.revision, submitReview: body.submitReview === true },
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
    return {
      batchId,
      succeeded,
      failed,
      skipped,
      results,
    };
  }
}
