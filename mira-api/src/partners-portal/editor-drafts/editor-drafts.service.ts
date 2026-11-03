import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CatalogContentService } from '../../marketplace/catalog-content.service';
import { normalizeIdempotencyKey, stableFingerprint } from '../../marketplace/commerce.types';
import { RegistryService } from '../registry/registry.service';
import { EDITOR_SCHEMA_VERSION } from '../registry/registry.types';

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
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RegistryService) private readonly registry: RegistryService,
    @Inject(CatalogContentService) private readonly content: CatalogContentService,
  ) {}

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
    const profile = this.registry.assertProfileAllowed(body.profileId, partnerType, body.kind);
    const schemaVersion = body.schemaVersion ?? EDITOR_SCHEMA_VERSION;
    this.registry.validateValues({
      profile,
      values: body.values,
      mode: 'draft',
      schemaVersion,
    });

    if (body.targetOwnerId) {
      await this.assertTargetOwner(partnerId, body.kind, body.targetOwnerId);
    }

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

      if (draft.status === 'materialized') {
        if (draft.materializeKey === idempotencyKey) {
          if (draft.materializeFingerprint && draft.materializeFingerprint !== fingerprint) {
            throw editorError(HttpStatus.CONFLICT, 'IDEMPOTENCY_CONFLICT', 'مفتاح منع التكرار مستخدم لطلب مختلف');
          }
          return {
            replay: true,
            draftId: draft.id,
            revision: draft.revision,
            status: draft.status,
            targetKind: draft.kind,
            targetOwnerId: draft.targetOwnerId!,
            materializedAt: draft.materializedAt!.toISOString(),
            submitReview,
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
      const values = (draft.valuesJson ?? {}) as Record<string, unknown>;
      // Validate provided values; enforce publish-required when creating/updating catalog content.
      this.registry.validateValues({
        profile,
        values,
        mode: 'publish',
        schemaVersion: draft.schemaVersion,
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
        },
      });
      if (marked.count !== 1) {
        throw editorError(HttpStatus.CONFLICT, 'DRAFT_REVISION_CONFLICT', 'تعارض أثناء التحويل');
      }
      const refreshed = await tx.partnerEditorDraft.findUniqueOrThrow({ where: { id: draft.id } });
      return {
        replay: false,
        draftId: refreshed.id,
        revision: refreshed.revision,
        status: refreshed.status,
        targetKind: refreshed.kind,
        targetOwnerId: refreshed.targetOwnerId!,
        materializedAt: refreshed.materializedAt!.toISOString(),
        submitReview,
      };
    });

    if (!outcome.replay && submitReview) {
      // Outside the materialize write; submit uses its own locking. Failures leave draft materialized (recoverable).
      await this.content.submit(partnerId, outcome.targetKind as 'product' | 'service', outcome.targetOwnerId);
    }
    return outcome;
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
          category: typeof values.category === 'string' ? values.category : null,
          active: false,
          contentStatus: 'draft',
          reviewStatus: 'draft',
          profileId: draft.profileId,
          schemaVersion: draft.schemaVersion,
          purchaseMode:
            values.purchaseMode === 'internal_cod' || values.purchaseMode === 'external'
              ? String(values.purchaseMode)
              : 'external',
          stockQty: typeof values.stockQty === 'number' && Number.isInteger(values.stockQty) ? values.stockQty : null,
          deliveryFeeHalalas:
            typeof values.deliveryFeeHalalas === 'number' && Number.isInteger(values.deliveryFeeHalalas)
              ? values.deliveryFeeHalalas
              : null,
          optionsJson:
            values.optionsJson && typeof values.optionsJson === 'object'
              ? (values.optionsJson as Prisma.InputJsonValue)
              : undefined,
          variantsJson:
            values.variantsJson && typeof values.variantsJson === 'object'
              ? (values.variantsJson as Prisma.InputJsonValue)
              : undefined,
        },
      });
      return row.id;
    }
    const durationMin = values.durationMin as number;
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
        category: typeof values.category === 'string' ? values.category : null,
        bookingEnabled: values.bookingEnabled === true,
        payMode: 'pay_at_venue',
        active: false,
        contentStatus: 'draft',
        reviewStatus: 'draft',
        profileId: draft.profileId,
        schemaVersion: draft.schemaVersion,
        serviceProfileJson:
          values.serviceProfile && typeof values.serviceProfile === 'object'
            ? (values.serviceProfile as Prisma.InputJsonValue)
            : undefined,
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
      // Content only — do not overwrite operational price/stock/delivery from stale draft when published.
      if (published) {
        await tx.product.update({
          where: { id: targetOwnerId },
          data: {
            draftNameAr: nameAr,
            draftNameEn: nameEn,
            draftDescriptionAr: descriptionAr ?? '',
            profileId: draft.profileId,
            schemaVersion: draft.schemaVersion,
            reviewRevision: { increment: 1 },
            reviewStatus: current.reviewStatus === 'in_review' ? 'in_review' : 'draft',
            ...(values.optionsJson !== undefined
              ? {
                  draftOptionsSet: true,
                  draftOptionsJson:
                    values.optionsJson == null
                      ? Prisma.DbNull
                      : (values.optionsJson as Prisma.InputJsonValue),
                }
              : {}),
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
        await tx.product.update({
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
            ...(typeof values.externalUrl === 'string' ? { externalUrl: values.externalUrl.trim() } : {}),
            ...(Array.isArray(values.concernTags)
              ? { concernTags: values.concernTags.filter((t): t is string => typeof t === 'string') }
              : {}),
            ...(typeof values.category === 'string' || values.category === null
              ? { category: typeof values.category === 'string' ? values.category : null }
              : {}),
            ...(values.optionsJson !== undefined
              ? {
                  optionsJson:
                    values.optionsJson == null
                      ? Prisma.DbNull
                      : (values.optionsJson as Prisma.InputJsonValue),
                }
              : {}),
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
            : {}),
          ...(profileDoc !== undefined
            ? {
                serviceProfileJson: profileDoc,
                draftServiceProfileJson: Prisma.DbNull,
                draftServiceProfileSet: false,
              }
            : {}),
        },
      });
    }
  }
}
