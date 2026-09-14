import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { ApplyPartnerDto } from './dto/apply-partner.dto';
import { UpsertProductDto, UpsertServiceDto } from './dto/catalog.dto';
import { TrackPartnerEventDto } from './dto/track-event.dto';

function newToken(): string {
  return randomBytes(32).toString('hex');
}

@Injectable()
export class PartnersPortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private autoApproveEnabled(): boolean {
    return this.config.get<string>('PARTNER_AUTO_APPROVE') === 'true';
  }

  async apply(dto: ApplyPartnerDto) {
    const existing = await this.prisma.partnerApplication.findFirst({
      where: {
        contactEmail: dto.contactEmail.toLowerCase(),
        status: 'pending',
      },
    });
    if (existing) {
      return {
        applicationId: existing.id,
        status: existing.status,
        statusToken: existing.statusToken,
        message: 'لديك طلب قيد المراجعة بالفعل',
      };
    }

    const statusToken = newToken();
    const application = await this.prisma.partnerApplication.create({
      data: {
        type: dto.type,
        nameAr: dto.nameAr,
        nameEn: dto.nameEn,
        contactName: dto.contactName,
        contactEmail: dto.contactEmail.toLowerCase(),
        contactPhone: dto.contactPhone,
        city: dto.city ?? 'الرياض',
        descriptionAr: dto.descriptionAr,
        storeUrl: dto.storeUrl,
        crNumber: dto.crNumber,
        vatNumber: dto.vatNumber,
        message: dto.message,
        statusToken,
      },
    });

    if (this.autoApproveEnabled()) {
      const approved = await this.approveApplication(application.id);
      return {
        applicationId: application.id,
        status: 'approved',
        statusToken,
        autoApproved: true,
        ...approved,
      };
    }

    return {
      applicationId: application.id,
      status: 'pending',
      statusToken,
      statusUrl: `/status.html?token=${statusToken}`,
      message: 'تم استلام طلبك — سنراجعه خلال 1–3 أيام عمل',
    };
  }

  async getApplicationStatus(statusToken: string) {
    const app = await this.prisma.partnerApplication.findUnique({
      where: { statusToken },
    });
    if (!app) throw new NotFoundException('الطلب غير موجود');

    return {
      status: app.status,
      type: app.type,
      nameAr: app.nameAr,
      rejectReason: app.rejectReason,
      reviewedAt: app.reviewedAt,
      partnerId: app.partnerId,
      loginEmail:
        app.status === 'approved' ? app.contactEmail : undefined,
    };
  }

  async login(email: string, accessToken: string) {
    const user = await this.prisma.partnerUser.findFirst({
      where: {
        email: email.toLowerCase(),
        accessToken: accessToken.trim(),
      },
      include: { partner: true },
    });
    if (!user || user.partner.status !== 'active') {
      throw new BadRequestException('بيانات الدخول غير صحيحة');
    }
    return {
      accessToken: user.accessToken,
      email: user.email,
      partner: {
        id: user.partner.id,
        type: user.partner.type,
        nameAr: user.partner.nameAr,
        nameEn: user.partner.nameEn,
        city: user.partner.city,
        storeUrl: user.partner.storeUrl,
      },
    };
  }

  async listApplications(status = 'pending') {
    return this.prisma.partnerApplication.findMany({
      where: { status },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        type: true,
        nameAr: true,
        nameEn: true,
        contactName: true,
        contactEmail: true,
        contactPhone: true,
        city: true,
        message: true,
        createdAt: true,
      },
    });
  }

  async approveApplication(id: string) {
    const app = await this.prisma.partnerApplication.findUnique({
      where: { id },
    });
    if (!app) throw new NotFoundException('الطلب غير موجود');
    if (app.status === 'approved' && app.partnerId) {
      const user = await this.prisma.partnerUser.findUnique({
        where: { partnerId: app.partnerId },
      });
      return {
        partnerId: app.partnerId,
        accessToken: user?.accessToken,
        alreadyApproved: true,
      };
    }
    if (app.status !== 'pending') {
      throw new ConflictException(`الطلب في حالة: ${app.status}`);
    }

    const accessToken = newToken();
    const emoji =
      app.type === 'brand' ? '🛍️' : app.type === 'clinic' ? '🏥' : '💇';

    const result = await this.prisma.$transaction(async (tx) => {
      const partner = await tx.partner.create({
        data: {
          type: app.type,
          status: 'active',
          nameAr: app.nameAr,
          nameEn: app.nameEn,
          descriptionAr: app.descriptionAr,
          city: app.city,
          logoEmoji: emoji,
          storeUrl: app.storeUrl,
        },
      });

      await tx.partnerUser.create({
        data: {
          partnerId: partner.id,
          email: app.contactEmail.toLowerCase(),
          accessToken,
        },
      });

      await tx.partnerApplication.update({
        where: { id },
        data: {
          status: 'approved',
          partnerId: partner.id,
          reviewedAt: new Date(),
        },
      });

      return { partnerId: partner.id, accessToken };
    });

    return {
      ...result,
      loginEmail: app.contactEmail.toLowerCase(),
      message: 'تم تفعيل الشريك — شارك رمز الدخول مع الشريك',
    };
  }

  async rejectApplication(id: string, reason?: string) {
    const app = await this.prisma.partnerApplication.findUnique({
      where: { id },
    });
    if (!app) throw new NotFoundException('الطلب غير موجود');
    if (app.status !== 'pending') {
      throw new ConflictException(`الطلب في حالة: ${app.status}`);
    }

    await this.prisma.partnerApplication.update({
      where: { id },
      data: {
        status: 'rejected',
        rejectReason: reason ?? 'لم يستوفِ متطلبات الشراكة',
        reviewedAt: new Date(),
      },
    });

    return { status: 'rejected' };
  }

  async getDashboard(partnerId: string) {
    const partner = await this.prisma.partner.findUnique({
      where: { id: partnerId },
      include: {
        products: { orderBy: { sortOrder: 'asc' } },
        services: { orderBy: { sortOrder: 'asc' } },
      },
    });
    if (!partner) throw new NotFoundException('الشريك غير موجود');

    const since = new Date();
    since.setDate(since.getDate() - 30);

    const events = await this.prisma.partnerEvent.groupBy({
      by: ['eventType'],
      where: { partnerId, createdAt: { gte: since } },
      _count: { id: true },
    });

    const counts: Record<string, number> = {};
    for (const e of events) {
      counts[e.eventType] = e._count.id;
    }

    return {
      partner: {
        id: partner.id,
        type: partner.type,
        nameAr: partner.nameAr,
        nameEn: partner.nameEn,
        descriptionAr: partner.descriptionAr,
        city: partner.city,
        logoEmoji: partner.logoEmoji,
        storeUrl: partner.storeUrl,
        rating: partner.rating,
      },
      catalog: {
        productCount: partner.products.length,
        serviceCount: partner.services.length,
        products: partner.products,
        services: partner.services,
      },
      analytics30d: {
        impressions: counts.impression ?? 0,
        clicks: counts.click ?? 0,
        bookingRequests: counts.booking_request ?? 0,
      },
    };
  }

  async trackEvent(dto: TrackPartnerEventDto) {
    const partner = await this.prisma.partner.findFirst({
      where: { id: dto.partnerId, status: 'active' },
    });
    if (!partner) throw new NotFoundException('الشريك غير موجود');

    await this.prisma.partnerEvent.create({
      data: {
        partnerId: dto.partnerId,
        eventType: dto.eventType,
        targetId: dto.targetId,
        targetType: dto.targetType,
      },
    });

    return { ok: true };
  }

  async createProduct(partnerId: string, dto: UpsertProductDto) {
    const partner = await this.prisma.partner.findUnique({
      where: { id: partnerId },
    });
    if (!partner || partner.type !== 'brand') {
      throw new BadRequestException('المنتجات متاحة للماركات فقط');
    }

    return this.prisma.product.create({
      data: {
        partnerId,
        nameAr: dto.nameAr,
        nameEn: dto.nameEn,
        descriptionAr: dto.descriptionAr,
        priceHalalas: dto.priceHalalas,
        externalUrl: dto.externalUrl,
        concernTags: dto.concernTags,
        skinTypes: dto.skinTypes ?? [],
        stepAr: dto.stepAr,
        active: dto.active ?? true,
      },
    });
  }

  async updateProduct(partnerId: string, productId: string, dto: UpsertProductDto) {
    await this.assertProductOwner(partnerId, productId);
    return this.prisma.product.update({
      where: { id: productId },
      data: {
        nameAr: dto.nameAr,
        nameEn: dto.nameEn,
        descriptionAr: dto.descriptionAr,
        priceHalalas: dto.priceHalalas,
        externalUrl: dto.externalUrl,
        concernTags: dto.concernTags,
        skinTypes: dto.skinTypes ?? [],
        stepAr: dto.stepAr,
        active: dto.active ?? true,
      },
    });
  }

  async deleteProduct(partnerId: string, productId: string) {
    await this.assertProductOwner(partnerId, productId);
    await this.prisma.product.update({
      where: { id: productId },
      data: { active: false },
    });
    return { ok: true };
  }

  async createService(partnerId: string, dto: UpsertServiceDto) {
    const partner = await this.prisma.partner.findUnique({
      where: { id: partnerId },
    });
    if (!partner || !['clinic', 'salon'].includes(partner.type)) {
      throw new BadRequestException('الخدمات متاحة للعيادات والصالونات فقط');
    }

    return this.prisma.service.create({
      data: {
        partnerId,
        nameAr: dto.nameAr,
        nameEn: dto.nameEn,
        descriptionAr: dto.descriptionAr,
        durationMin: dto.durationMin,
        priceHalalas: dto.priceHalalas,
        concernTags: dto.concernTags,
        bookingEnabled: dto.bookingEnabled ?? false,
        active: dto.active ?? true,
      },
    });
  }

  async updateService(partnerId: string, serviceId: string, dto: UpsertServiceDto) {
    await this.assertServiceOwner(partnerId, serviceId);
    return this.prisma.service.update({
      where: { id: serviceId },
      data: {
        nameAr: dto.nameAr,
        nameEn: dto.nameEn,
        descriptionAr: dto.descriptionAr,
        durationMin: dto.durationMin,
        priceHalalas: dto.priceHalalas,
        concernTags: dto.concernTags,
        bookingEnabled: dto.bookingEnabled ?? false,
        active: dto.active ?? true,
      },
    });
  }

  async deleteService(partnerId: string, serviceId: string) {
    await this.assertServiceOwner(partnerId, serviceId);
    await this.prisma.service.update({
      where: { id: serviceId },
      data: { active: false },
    });
    return { ok: true };
  }

  private async assertProductOwner(partnerId: string, productId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, partnerId },
    });
    if (!product) throw new NotFoundException('المنتج غير موجود');
  }

  private async assertServiceOwner(partnerId: string, serviceId: string) {
    const service = await this.prisma.service.findFirst({
      where: { id: serviceId, partnerId },
    });
    if (!service) throw new NotFoundException('الخدمة غير موجودة');
  }
}
