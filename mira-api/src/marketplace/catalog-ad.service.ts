import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { CatalogAd, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { publishedCatalogMediaWhere } from './catalog-published-media';
import { disabledViewCount, refuseQualifiedView, QualifiedViewRequest } from './catalog-view.policy';

type Kind = 'product' | 'service';
type DecisionName = 'approve' | 'reject' | 'withdraw';

const ELIGIBLE = { active: true, contentStatus: 'published', catalogSource: 'catalog', partner: { status: 'active' } };
const ADMIN_ACTOR = 'admin-api-key';

@Injectable()
export class CatalogAdService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(advertiserPartnerId: string, input: Record<string, unknown>) {
    this.rejectPrice(input);
    const targetKind = this.kind(input.targetKind);
    const targetId = this.requiredText(input.targetId, 'الكيان الأصلي');
    const publisherPartnerId = this.publisherFor(advertiserPartnerId, input.publisherPartnerId);
    const captionAr = this.optionalText(input.captionAr, 'النص');
    await this.requireActivePartner(advertiserPartnerId, 'المعلن غير مؤهل');
    await this.assertTargetLinkable(advertiserPartnerId, targetKind, targetId);
    return this.prisma.catalogAd.create({
      data: {
        targetKind,
        targetId,
        advertiserPartnerId,
        publisherPartnerId,
        captionAr: captionAr ?? null,
        status: 'draft',
      },
    });
  }

  async updateLink(advertiserPartnerId: string, id: string, input: Record<string, unknown>) {
    this.rejectPrice(input);
    return this.prisma.$transaction(async (tx) => {
      const ad = await this.lockOwned(tx, id, advertiserPartnerId);
      if (ad.status !== 'draft' && ad.status !== 'rejected') {
        throw new ConflictException('لا يمكن تعديل الربط بعد إرسال الإعلان');
      }
      const targetKind = input.targetKind === undefined ? ad.targetKind as Kind : this.kind(input.targetKind);
      const targetId = input.targetId === undefined ? ad.targetId : this.requiredText(input.targetId, 'الكيان الأصلي');
      const publisherPartnerId = this.publisherFor(
        advertiserPartnerId,
        input.publisherPartnerId === undefined ? advertiserPartnerId : input.publisherPartnerId,
      );
      await this.assertTargetLinkable(advertiserPartnerId, targetKind, targetId);
      const captionAr = input.captionAr === undefined ? undefined : this.optionalText(input.captionAr, 'النص');
      const changed = await tx.catalogAd.updateMany({
        where: { id, advertiserPartnerId, status: { in: ['draft', 'rejected'] }, reviewRevision: ad.reviewRevision },
        data: {
          targetKind,
          targetId,
          publisherPartnerId,
          ...(captionAr !== undefined ? { captionAr } : {}),
          reviewRevision: { increment: 1 },
        },
      });
      if (changed.count !== 1) throw new ConflictException('لا يمكن تعديل الربط بعد إرسال الإعلان');
      return tx.catalogAd.findUniqueOrThrow({ where: { id } });
    });
  }

  async submit(advertiserPartnerId: string, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const ad = await this.lockOwned(tx, id, advertiserPartnerId);
      if (ad.status === 'in_review' && ad.submittedRevision === ad.reviewRevision) {
        return { ...this.partnerView(ad), alreadyApplied: true };
      }
      if (ad.status !== 'draft' && ad.status !== 'rejected') {
        throw new ConflictException('إعادة التقديم تكون من المسودة أو بعد الرفض فقط');
      }
      const changed = await tx.catalogAd.updateMany({
        where: { id, advertiserPartnerId, status: ad.status, reviewRevision: ad.reviewRevision },
        data: {
          status: 'in_review',
          submittedRevision: ad.reviewRevision,
          submittedAt: new Date(),
          reviewNote: null,
        },
      });
      if (changed.count !== 1) throw new ConflictException('تغيّرت النسخة قبل إرسالها');
      const next = await tx.catalogAd.findUniqueOrThrow({ where: { id } });
      return { ...this.partnerView(next), alreadyApplied: false };
    });
  }

  async withdraw(advertiserPartnerId: string, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const ad = await this.lockOwned(tx, id, advertiserPartnerId);
      if (ad.status === 'withdrawn') return { ...this.partnerView(ad), alreadyApplied: true };
      const changed = await tx.catalogAd.updateMany({
        where: { id, advertiserPartnerId, status: ad.status, reviewRevision: ad.reviewRevision },
        data: { status: 'withdrawn', reviewRevision: { increment: 1 }, submittedRevision: null },
      });
      if (changed.count !== 1) throw new ConflictException('تغيّرت حالة الإعلان');
      const next = await tx.catalogAd.findUniqueOrThrow({ where: { id } });
      return { ...this.partnerView(next), alreadyApplied: false };
    });
  }

  async listForAdvertiser(advertiserPartnerId: string) {
    const rows = await this.prisma.catalogAd.findMany({
      where: { advertiserPartnerId },
      orderBy: { createdAt: 'desc' },
    });
    return { items: await Promise.all(rows.map((row) => this.partnerCard(row))) };
  }

  async previewForAdvertiser(advertiserPartnerId: string, id: string) {
    const ad = await this.owned(advertiserPartnerId, id);
    return this.partnerCard(ad);
  }

  async stats(advertiserPartnerId: string, id: string) {
    await this.owned(advertiserPartnerId, id);
    const linkOpens = await this.prisma.catalogAdAction.count({ where: { adId: id, action: 'link_open' } });
    return { id, linkOpens, views: disabledViewCount() };
  }

  async listReviews() {
    const rows = await this.prisma.catalogAd.findMany({ where: { status: 'in_review' }, orderBy: { submittedAt: 'asc' } });
    return { items: await Promise.all(rows.map((row) => this.adminCard(row))) };
  }

  async adminPreview(id: string) {
    const ad = await this.prisma.catalogAd.findUnique({ where: { id } });
    if (!ad) throw new NotFoundException('الإعلان غير موجود');
    const decisions = await this.prisma.catalogAdDecision.findMany({ where: { adId: id }, orderBy: { createdAt: 'asc' } });
    return {
      ...(await this.adminCard(ad)),
      decisions: decisions.map((row) => ({
        revision: row.revision,
        decision: row.decision,
        actor: row.actor,
        note: row.note,
        createdAt: row.createdAt,
      })),
    };
  }

  async decide(input: Record<string, unknown>) {
    const id = this.requiredText(input.id, 'الإعلان');
    const decision = this.decisionName(input.decision);
    const revision = this.revision(input.revision);
    if ('priceHalalas' in input) throw new BadRequestException('سعر الإعلان لا يُعدَّل من هنا');
    const note = decision === 'reject' ? this.requiredText(input.note, 'سبب الرفض') : this.optionalText(input.note, 'الملاحظة');
    const exists = await this.prisma.catalogAd.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('الإعلان غير موجود');
    return this.prisma.$transaction(async (tx) => {
      const ad = await this.lock(tx, id);
      if (decision === 'approve' && ad.status === 'published' && ad.submittedRevision === revision && ad.reviewRevision === revision) {
        return { id, status: 'published', alreadyApplied: true, revision };
      }
      if (decision === 'reject' && ad.status === 'rejected' && ad.reviewRevision === revision) {
        return { id, status: 'rejected', alreadyApplied: true, revision };
      }
      if (decision === 'withdraw' && ad.status === 'withdrawn') {
        return { id, status: 'withdrawn', alreadyApplied: true, revision: ad.reviewRevision };
      }
      if (ad.status === 'withdrawn') throw new ConflictException('الإعلان المسحوب لا يعود للنشر بقرار اعتماد قديم');
      if (decision === 'withdraw') {
        if (ad.reviewRevision !== revision) throw new ConflictException('النسخة القديمة لا تُعتمد');
        const changed = await tx.catalogAd.updateMany({
          where: { id, status: ad.status, reviewRevision: revision },
          data: { status: 'withdrawn', reviewedBy: ADMIN_ACTOR, reviewRevision: { increment: 1 }, submittedRevision: null },
        });
        if (changed.count !== 1) throw new ConflictException('النسخة القديمة لا تُعتمد');
        await tx.catalogAdDecision.create({ data: { adId: id, revision, decision, actor: ADMIN_ACTOR, note: note ?? null } });
        return { id, status: 'withdrawn', alreadyApplied: false, revision };
      }
      if (ad.status !== 'in_review' || ad.submittedRevision !== revision || ad.reviewRevision !== revision) {
        throw new ConflictException('النسخة القديمة لا تُعتمد');
      }
      if (decision === 'reject') {
        const changed = await tx.catalogAd.updateMany({
          where: { id, status: 'in_review', reviewRevision: revision, submittedRevision: revision },
          data: { status: 'rejected', reviewNote: note, reviewedBy: ADMIN_ACTOR },
        });
        if (changed.count !== 1) throw new ConflictException('النسخة القديمة لا تُعتمد');
        await tx.catalogAdDecision.create({ data: { adId: id, revision, decision, actor: ADMIN_ACTOR, note } });
        return { id, status: 'rejected', alreadyApplied: false, revision };
      }
      if (!(await this.publicPartiesEligible(ad))) throw new ConflictException('الهدف أو أحد الأطراف غير مؤهل للظهور');
      if (process.env.MIRA_AD_FAIL_DECIDE === '1') {
        await tx.catalogAd.updateMany({
          where: { id, status: 'in_review', reviewRevision: revision, submittedRevision: revision },
          data: { status: 'published', reviewedBy: ADMIN_ACTOR },
        });
        throw new Error('فشل داخل معاملة القرار');
      }
      const changed = await tx.catalogAd.updateMany({
        where: { id, status: 'in_review', reviewRevision: revision, submittedRevision: revision },
        data: { status: 'published', reviewedBy: ADMIN_ACTOR, reviewNote: null },
      });
      if (changed.count !== 1) throw new ConflictException('النسخة القديمة لا تُعتمد');
      await tx.catalogAdDecision.create({ data: { adId: id, revision, decision: 'approve', actor: ADMIN_ACTOR, note: note ?? null } });
      return { id, status: 'published', alreadyApplied: false, revision };
    });
  }

  async listPublic() {
    const rows = await this.prisma.catalogAd.findMany({ where: { status: 'published' }, orderBy: { createdAt: 'asc' } });
    const items = [];
    for (const row of rows) {
      if (!(await this.publicPartiesEligible(row))) continue;
      items.push(await this.publicBody(row));
    }
    return { items };
  }

  async publicAd(id: string) {
    const ad = await this.visible(id);
    return this.publicBody(ad);
  }

  private async publicBody(ad: CatalogAd) {
    const target = await this.targetRecord(ad.targetKind as Kind, ad.targetId);
    const [advertiser, publisher, seller] = await Promise.all([
      this.prisma.partner.findUniqueOrThrow({ where: { id: ad.advertiserPartnerId } }),
      this.prisma.partner.findUniqueOrThrow({ where: { id: ad.publisherPartnerId } }),
      this.prisma.partner.findUniqueOrThrow({ where: { id: target.partnerId } }),
    ]);
    const externalUrl = 'externalUrl' in target ? target.externalUrl : null;
    return {
      id: ad.id,
      disclosure: 'إعلان',
      captionAr: ad.captionAr,
      targetKind: ad.targetKind,
      targetId: ad.targetId,
      advertiser: { id: advertiser.id, nameAr: advertiser.nameAr },
      publisher: { id: publisher.id, nameAr: publisher.nameAr },
      seller: { id: seller.id, nameAr: seller.nameAr, type: seller.type, city: seller.city },
      target: {
        kind: ad.targetKind,
        id: target.id,
        nameAr: target.nameAr,
        nameEn: target.nameEn,
        descriptionAr: target.descriptionAr,
        category: target.category,
        concernTags: target.concernTags,
        priceHalalas: target.priceHalalas,
        externalUrl,
        durationMin: 'durationMin' in target ? target.durationMin : undefined,
      },
      media: await this.publishedMedia(ad.targetKind as Kind, target.id),
      actions: {
        openLink: this.validUrl(externalUrl),
        purchaseCompleted: false,
        appointmentRequest: false,
        appointmentOperational: false,
        appointmentConfirmed: false,
      },
      views: disabledViewCount(),
    };
  }

  async linkOpen(id: string, eventId?: string) {
    const key = this.requiredText(eventId, 'معرّف الحدث');
    const ad = await this.visible(id);
    const target = await this.targetRecord(ad.targetKind as Kind, ad.targetId);
    const externalUrl = 'externalUrl' in target ? target.externalUrl : null;
    if (!this.validUrl(externalUrl)) throw new NotFoundException('الإعلان غير متاح');
    try {
      await this.prisma.catalogAdAction.create({ data: { eventId: key, adId: id, action: 'link_open' } });
      return { action: 'link_open', purchaseCompleted: false, alreadyRecorded: false };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const existing = await this.prisma.catalogAdAction.findUnique({ where: { eventId: key } });
        if (existing?.adId === id && existing.action === 'link_open') {
          return { action: 'link_open', purchaseCompleted: false, alreadyRecorded: true };
        }
        throw new ConflictException('معرّف الحدث مستخدم');
      }
      throw error;
    }
  }

  viewCount() {
    return disabledViewCount();
  }

  async recordView(input: QualifiedViewRequest) {
    const refusal = refuseQualifiedView(input);
    if (refusal === 'client-total') throw new BadRequestException('العدد لا يُقبل من العميل');
    if (refusal === 'invalid') throw new BadRequestException('حدث المشاهدة غير مكتمل');
    const kind = this.kind(input.targetKind);
    if (!(await this.targetEligible(kind, input.targetId || ''))) throw new NotFoundException('الهدف غير متاح');
    throw new ServiceUnavailableException('قواعد العد غير معتمدة');
  }

  private partnerView(ad: CatalogAd) {
    return {
      id: ad.id,
      status: ad.status,
      reviewRevision: ad.reviewRevision,
      submittedRevision: ad.submittedRevision,
      reviewNote: ad.reviewNote,
    };
  }

  private async partnerCard(ad: CatalogAd) {
    const live = await this.liveTargetFor(ad.advertiserPartnerId, ad.targetKind as Kind, ad.targetId, false);
    const [advertiser, publisher] = await Promise.all([
      this.prisma.partner.findUnique({ where: { id: ad.advertiserPartnerId } }),
      this.prisma.partner.findUnique({ where: { id: ad.publisherPartnerId } }),
    ]);
    return {
      id: ad.id,
      status: ad.status,
      captionAr: ad.captionAr,
      targetKind: ad.targetKind,
      targetId: ad.targetId,
      reviewRevision: ad.reviewRevision,
      submittedRevision: ad.submittedRevision,
      reviewNote: ad.reviewNote,
      advertiser: advertiser ? { id: advertiser.id, nameAr: advertiser.nameAr } : null,
      publisher: publisher ? { id: publisher.id, nameAr: publisher.nameAr } : null,
      seller: live?.seller ?? null,
      liveTarget: live?.target ?? null,
      views: disabledViewCount(),
    };
  }

  private async adminCard(ad: CatalogAd) {
    const live = await this.liveTargetFor(null, ad.targetKind as Kind, ad.targetId, true);
    const card = await this.partnerCard(ad);
    return { ...card, seller: live?.seller ?? null, liveTarget: live?.target ?? null };
  }

  private async liveTargetFor(actorPartnerId: string | null, kind: Kind, id: string, admin: boolean) {
    const loaded = await this.loadTarget(kind, id);
    if (!loaded) return null;
    const eligible = await this.targetEligible(kind, id);
    const owner = actorPartnerId != null && loaded.partnerId === actorPartnerId;
    if (!admin && !owner && !eligible) return null;
    return loaded.view;
  }

  private async assertTargetLinkable(actorPartnerId: string, kind: Kind, id: string) {
    const loaded = await this.loadTarget(kind, id);
    if (!loaded) throw new NotFoundException('الكيان الأصلي غير موجود');
    const eligible = await this.targetEligible(kind, id);
    if (loaded.partnerId !== actorPartnerId && !eligible) throw new NotFoundException('الكيان الأصلي غير موجود');
  }

  private async loadTarget(kind: Kind, id: string) {
    if (kind === 'product') {
      const row = await this.prisma.product.findUnique({ where: { id }, include: { partner: true } });
      if (!row) return null;
      return {
        partnerId: row.partnerId,
        view: {
          seller: { id: row.partner.id, nameAr: row.partner.nameAr },
          target: { nameAr: row.nameAr, priceHalalas: row.priceHalalas, contentStatus: row.contentStatus, externalUrl: row.externalUrl, bookingEnabled: false },
        },
      };
    }
    const row = await this.prisma.service.findUnique({ where: { id }, include: { partner: true } });
    if (!row) return null;
    return {
      partnerId: row.partnerId,
      view: {
        seller: { id: row.partner.id, nameAr: row.partner.nameAr },
        target: { nameAr: row.nameAr, priceHalalas: row.priceHalalas, contentStatus: row.contentStatus, externalUrl: null, bookingEnabled: row.bookingEnabled },
      },
    };
  }

  private async publishedMedia(kind: Kind, id: string) {
    const rows = await this.prisma.catalogMedia.findMany({
      where: publishedCatalogMediaWhere(kind, id),
      orderBy: { sortOrder: 'asc' },
    });
    return rows.map((row) => ({ id: row.id, kind: row.kind, url: `/api/v1/marketplace/media/${row.id}` }));
  }

  private rejectPrice(input: Record<string, unknown>) {
    if ('priceHalalas' in input) throw new BadRequestException('سعر الإعلان لا يُعدَّل من هنا');
  }

  private publisherFor(advertiserPartnerId: string, value: unknown): string {
    if (value === undefined || value === null || value === '') return advertiserPartnerId;
    if (typeof value !== 'string') throw new BadRequestException('ناشر المحتوى يجب أن يكون نصًا');
    const publisher = value.trim();
    if (!publisher || publisher === advertiserPartnerId) return advertiserPartnerId;
    throw new ForbiddenException('لا يوجد تفويض لإسناد الإعلان إلى ناشر آخر');
  }

  private decisionName(value: unknown): DecisionName {
    if (value === 'approve' || value === 'reject' || value === 'withdraw') return value;
    throw new BadRequestException('القرار غير معروف');
  }

  private revision(value: unknown): number {
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
      throw new BadRequestException('رقم النسخة غير صالح');
    }
    return value;
  }

  private kind(value: unknown): Kind {
    if (value === 'product' || value === 'service') return value;
    throw new BadRequestException('نوع الهدف يجب أن يكون product أو service');
  }

  private requiredText(value: unknown, label: string): string {
    if (typeof value !== 'string' || !value.trim()) throw new BadRequestException(`${label} مطلوب`);
    return value.trim();
  }

  private optionalText(value: unknown, label: string): string | null | undefined {
    if (value === undefined || value === null) return undefined;
    if (typeof value !== 'string') throw new BadRequestException(`${label} يجب أن يكون نصًا`);
    return value.trim() || null;
  }

  private validUrl(value: string | null | undefined): boolean {
    if (!value) return false;
    try {
      const url = new URL(value);
      return (url.protocol === 'https:' || url.protocol === 'http:') && url.hostname.length > 0;
    } catch {
      return false;
    }
  }

  private async requireActivePartner(id: string, message: string) {
    const partner = await this.prisma.partner.findFirst({ where: { id, status: 'active' } });
    if (!partner) throw new ForbiddenException(message);
  }

  private async requireTargetExists(kind: Kind, id: string) {
    const found = kind === 'product'
      ? await this.prisma.product.findUnique({ where: { id } })
      : await this.prisma.service.findUnique({ where: { id } });
    if (!found) throw new NotFoundException('الكيان الأصلي غير موجود');
  }

  private async targetEligible(kind: Kind, id: string): Promise<boolean> {
    if (kind === 'product') return Boolean(await this.prisma.product.findFirst({ where: { id, ...ELIGIBLE } }));
    return Boolean(await this.prisma.service.findFirst({ where: { id, ...ELIGIBLE } }));
  }

  private async publicPartiesEligible(ad: CatalogAd): Promise<boolean> {
    const [advertiser, publisher] = await Promise.all([
      this.prisma.partner.findFirst({ where: { id: ad.advertiserPartnerId, status: 'active' } }),
      this.prisma.partner.findFirst({ where: { id: ad.publisherPartnerId, status: 'active' } }),
    ]);
    if (!advertiser || !publisher) return false;
    return this.targetEligible(ad.targetKind as Kind, ad.targetId);
  }

  private async targetRecord(kind: Kind, id: string) {
    if (kind === 'product') {
      const row = await this.prisma.product.findFirst({ where: { id, ...ELIGIBLE } });
      if (!row) throw new NotFoundException('الإعلان غير متاح');
      return row;
    }
    const row = await this.prisma.service.findFirst({ where: { id, ...ELIGIBLE } });
    if (!row) throw new NotFoundException('الإعلان غير متاح');
    return row;
  }

  private async visible(id: string) {
    const ad = await this.prisma.catalogAd.findUnique({ where: { id } });
    if (!ad || !(await this.publicPartiesEligible(ad)) || ad.status !== 'published') {
      throw new NotFoundException('الإعلان غير متاح');
    }
    return ad;
  }

  private async owned(advertiserPartnerId: string, id: string) {
    const ad = await this.prisma.catalogAd.findUnique({ where: { id } });
    if (!ad || ad.advertiserPartnerId !== advertiserPartnerId) throw new NotFoundException('الإعلان غير موجود');
    return ad;
  }

  private async lock(tx: Prisma.TransactionClient, id: string) {
    await tx.$queryRaw`SELECT id FROM catalog_ads WHERE id = ${id} FOR UPDATE`;
    const ad = await tx.catalogAd.findUnique({ where: { id } });
    if (!ad) throw new NotFoundException('الإعلان غير موجود');
    return ad;
  }

  private async lockOwned(tx: Prisma.TransactionClient, id: string, advertiserPartnerId: string) {
    const ad = await this.lock(tx, id);
    if (ad.advertiserPartnerId !== advertiserPartnerId) throw new NotFoundException('الإعلان غير موجود');
    return ad;
  }
}
