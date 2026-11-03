import { HttpException, HttpStatus, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RegistryService } from '../registry/registry.service';
import { ServiceProfileDoc } from '../registry/registry.types';

function editorError(status: HttpStatus, code: string, messageAr: string, extra: Record<string, unknown> = {}) {
  return new HttpException({ message: messageAr, messageAr, code, ...extra }, status);
}

@Injectable()
export class ServiceProfileService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RegistryService) private readonly registry: RegistryService,
  ) {}

  private serializeProfile(doc: ServiceProfileDoc | null) {
    if (!doc) return null;
    return {
      templateId: doc.templateId,
      templateVersion: doc.templateVersion,
      priceMode: doc.priceMode,
      answers: doc.answers,
    };
  }

  async getForPartner(partnerId: string, serviceId: string) {
    this.registry.assertEditorV2Enabled();
    const service = await this.prisma.service.findFirst({ where: { id: serviceId, partnerId } });
    if (!service) throw new NotFoundException('الخدمة غير موجودة');
    const published = service.contentStatus === 'published';
    const live = service.serviceProfileJson as ServiceProfileDoc | null;
    const draftPending = published && service.draftServiceProfileSet;
    const draft = draftPending
      ? ((service.draftServiceProfileJson as ServiceProfileDoc | null) ?? null)
      : null;
    return {
      serviceId,
      reviewRevision: service.reviewRevision,
      contentStatus: service.contentStatus,
      serviceProfileJson: this.serializeProfile(live),
      draftServiceProfileJson: this.serializeProfile(draft),
      draftServiceProfileSet: draftPending,
    };
  }

  /**
   * Full replace under expectedRevision (= service.reviewRevision).
   * Published → draft_*; unpublished → live service_profile_json.
   */
  async put(
    partnerId: string,
    serviceId: string,
    body: {
      expectedRevision: number;
      clear?: boolean;
      templateId?: string;
      templateVersion?: number;
      priceMode?: string;
      answers?: Record<string, unknown>;
    },
  ) {
    this.registry.assertEditorV2Enabled();
    if (body.expectedRevision == null || !Number.isInteger(body.expectedRevision)) {
      throw editorError(HttpStatus.BAD_REQUEST, 'EXPECTED_REVISION_REQUIRED', 'expectedRevision مطلوب');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT id FROM services WHERE id = ${serviceId} FOR UPDATE`;
      const service = await tx.service.findFirst({ where: { id: serviceId, partnerId } });
      if (!service) throw new NotFoundException('الخدمة غير موجودة');
      if (service.reviewRevision !== body.expectedRevision) {
        throw editorError(HttpStatus.CONFLICT, 'SERVICE_PROFILE_REVISION_CONFLICT', 'تعارض إصدار قالب الخدمة', {
          currentRevision: service.reviewRevision,
        });
      }

      const published = service.contentStatus === 'published';
      let nextDoc: ServiceProfileDoc | null = null;
      if (body.clear === true) {
        nextDoc = null;
      } else {
        nextDoc = this.registry.normalizeServiceProfile({
          templateId: body.templateId,
          templateVersion: body.templateVersion,
          priceMode: body.priceMode,
          answers: body.answers ?? {},
        });
      }

      const updated = await tx.service.updateMany({
        where: { id: serviceId, partnerId, reviewRevision: body.expectedRevision },
        data: {
          reviewRevision: { increment: 1 },
          reviewStatus: service.reviewStatus === 'in_review' ? 'in_review' : 'draft',
          ...(published
            ? {
                draftServiceProfileSet: true,
                draftServiceProfileJson: nextDoc == null ? Prisma.DbNull : (nextDoc as unknown as Prisma.InputJsonValue),
              }
            : {
                serviceProfileJson: nextDoc == null ? Prisma.DbNull : (nextDoc as unknown as Prisma.InputJsonValue),
                draftServiceProfileJson: Prisma.DbNull,
                draftServiceProfileSet: false,
              }),
        },
      });
      if (updated.count !== 1) {
        throw editorError(HttpStatus.CONFLICT, 'SERVICE_PROFILE_REVISION_CONFLICT', 'تعارض إصدار قالب الخدمة');
      }
      const row = await tx.service.findUniqueOrThrow({ where: { id: serviceId } });
      return {
        serviceId,
        reviewRevision: row.reviewRevision,
        contentStatus: row.contentStatus,
        serviceProfileJson: this.serializeProfile(row.serviceProfileJson as ServiceProfileDoc | null),
        draftServiceProfileSet: row.draftServiceProfileSet,
        draftServiceProfileJson: row.draftServiceProfileSet
          ? this.serializeProfile(row.draftServiceProfileJson as ServiceProfileDoc | null)
          : null,
      };
    });
  }

  /**
   * Import local template state. force=true cannot bypass a changed revision —
   * expectedRevision must still match; otherwise 409 and client must re-confirm.
   */
  async importLocal(
    partnerId: string,
    serviceId: string,
    body: {
      confirm?: boolean;
      expectedRevision: number;
      force?: boolean;
      templateState: unknown;
    },
  ) {
    this.registry.assertEditorV2Enabled();
    if (body.confirm !== true) {
      throw editorError(HttpStatus.BAD_REQUEST, 'IMPORT_CONFIRM_REQUIRED', 'يلزم تأكيد صريح للاستيراد');
    }
    if (body.expectedRevision == null || !Number.isInteger(body.expectedRevision)) {
      throw editorError(HttpStatus.BAD_REQUEST, 'EXPECTED_REVISION_REQUIRED', 'expectedRevision مطلوب');
    }

    const raw = body.templateState;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      throw editorError(HttpStatus.BAD_REQUEST, 'IMPORT_STATE_INVALID', 'حالة القالب المحلي غير صالحة');
    }
    const state = raw as Record<string, unknown>;
    const templateId = typeof state.templateId === 'string' ? state.templateId.trim() : '';
    if (!templateId) {
      throw editorError(HttpStatus.BAD_REQUEST, 'IMPORT_STATE_INVALID', 'معرّف القالب مطلوب');
    }
    const answersIn =
      state.answers && typeof state.answers === 'object' && !Array.isArray(state.answers)
        ? (state.answers as Record<string, unknown>)
        : {};
    const { mapped, unmapped } = this.registry.mapLegacyAnswers(templateId, answersIn);
    // force only means "overwrite existing server profile content when revision still matches".
    void body.force;

    const result = await this.put(partnerId, serviceId, {
      expectedRevision: body.expectedRevision,
      templateId,
      templateVersion: typeof state.templateVersion === 'number' ? state.templateVersion : 1,
      priceMode: typeof state.priceMode === 'string' ? state.priceMode : 'fixed',
      answers: mapped,
    });

    return {
      ...result,
      importReceipt: {
        templateId,
        mappedAnswerKeys: Object.keys(mapped),
        unmappedAnswerKeys: unmapped,
        noteAr:
          unmapped.length > 0
            ? 'بعض الحقول القديمة لم تُحوَّل وظهرت في التقرير دون إسقاط صامت أو اختراع قيم.'
            : 'تم استيراد القالب بنجاح.',
      },
    };
  }
}
