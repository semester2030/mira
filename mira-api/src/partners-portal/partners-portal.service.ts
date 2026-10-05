import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';
import { normalizeProductCommerce, ProductCommerceData } from '../marketplace/commerce-public';
import {
  assertAvailabilityConsistent,
  assertResourceCapacitiesConsistent,
  findResourceCapacityConflicts,
  normalizeResourceId,
  parseAvailability,
  unifyResourceCapacities,
} from '../marketplace/commerce.types';
import { lockPartnerScheduleScope } from '../marketplace/commerce-schedule-locks';
import { PrismaService } from '../prisma/prisma.service';
import { ApplyPartnerDto } from './dto/apply-partner.dto';
import { UpdateProductDto, UpdateServiceDto, UpsertProductDto, UpsertServiceDto } from './dto/catalog.dto';
import { TrackPartnerEventDto } from './dto/track-event.dto';

function newToken(): string {
  return randomBytes(32).toString('hex');
}

function resourceIdsFromAvailability(raw: unknown): string[] {
  if (raw == null) return [];
  if (!Array.isArray(raw)) return [];
  const ids = new Set<string>();
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const id = normalizeResourceId((entry as Record<string, unknown>).resourceId);
    if (id) ids.add(id);
  }
  return [...ids];
}

/** Maps validated commerce input to Prisma writes (`null` JSON clears the column). */
function commerceWrite(commerce: ProductCommerceData) {
  const { optionsJson, variantsJson, ...rest } = commerce;
  return {
    ...rest,
    ...(optionsJson !== undefined ? { optionsJson: optionsJson === null ? Prisma.DbNull : (optionsJson as Prisma.InputJsonValue) } : {}),
    ...(variantsJson !== undefined ? { variantsJson: variantsJson === null ? Prisma.DbNull : (variantsJson as Prisma.InputJsonValue) } : {}),
  };
}

const PRODUCT_CATEGORIES = new Set(['face', 'body', 'hair', 'clothes', 'accessories']);
const SERVICE_CATEGORIES = new Set(['hair', 'skin', 'makeup', 'nails', 'care']);

@Injectable()
export class PartnersPortalService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ConfigService) private readonly config: ConfigService,
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
        contactPhone: partner.contactPhone,
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
    if (!partner || (partner.type !== 'brand' && partner.type !== 'developer')) {
      throw new BadRequestException('المنتجات متاحة للماركات فقط');
    }
    const category = this.optionalCategory(dto.category, PRODUCT_CATEGORIES);
    const cosmetic = category === 'face' || category === 'body' || category === 'hair';
    const nameAr = dto.nameAr.trim();
    const commerce = normalizeProductCommerce(dto, null, dto.priceHalalas);

    return this.prisma.product.create({
      data: {
        ...commerceWrite(commerce),
        partnerId,
        nameAr,
        nameEn: dto.nameEn?.trim() || nameAr,
        descriptionAr: dto.descriptionAr?.trim() || null,
        priceHalalas: dto.priceHalalas,
        externalUrl: dto.externalUrl?.trim() || '',
        concernTags: dto.concernTags ?? [],
        category,
        skinTypes: cosmetic ? (dto.skinTypes ?? []) : [],
        stepAr: cosmetic ? (dto.stepAr?.trim() || null) : null,
        active: false,
        contentStatus: 'draft',
        reviewStatus: 'draft',
      },
    });
  }

  async updateProduct(partnerId: string, productId: string, dto: UpdateProductDto) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM products WHERE id = ${productId} FOR UPDATE`;
      const current = await tx.product.findFirst({ where: { id: productId, partnerId } });
      if (!current) throw new NotFoundException('المنتج غير موجود');
      const linked = await tx.catalogSourceLink.findFirst({ where: { ownerKind: 'product', ownerId: productId } });
      const published = current.contentStatus === 'published';
      const data: {
        draftNameAr?: string;
        draftNameEn?: string;
        draftDescriptionAr?: string | null;
        nameAr?: string;
        nameEn?: string;
        descriptionAr?: string | null;
        priceHalalas?: number;
        externalUrl?: string;
        concernTags?: string[];
        category?: string | null;
        skinTypes?: string[];
        stepAr?: string | null;
        reviewRevision: { increment: number };
        reviewStatus: string;
        purchaseMode?: string;
        stockQty?: number | null;
        deliveryFeeHalalas?: number | null;
        optionsJson?: Prisma.InputJsonValue | typeof Prisma.DbNull;
        variantsJson?: Prisma.InputJsonValue | typeof Prisma.DbNull;
        draftOptionsJson?: Prisma.InputJsonValue | typeof Prisma.DbNull;
        draftVariantsJson?: Prisma.InputJsonValue | typeof Prisma.DbNull;
        draftOptionsSet?: boolean;
        draftVariantsSet?: boolean;
      } = {
        reviewRevision: { increment: 1 },
        reviewStatus: current.reviewStatus === 'in_review' ? 'in_review' : 'draft',
      };
      if (dto.nameAr !== undefined) {
        if (published) data.draftNameAr = dto.nameAr;
        else data.nameAr = dto.nameAr;
      }
      if (dto.nameEn !== undefined) {
        const nextName = dto.nameEn.trim() || (published ? (data.draftNameAr || current.nameAr) : (data.nameAr || current.nameAr));
        if (published) data.draftNameEn = nextName;
        else data.nameEn = nextName;
      }
      if (dto.descriptionAr !== undefined) {
        const cleared = dto.descriptionAr == null || dto.descriptionAr === '';
        if (published) data.draftDescriptionAr = cleared ? '' : dto.descriptionAr;
        else data.descriptionAr = cleared ? null : dto.descriptionAr;
      }
      data.priceHalalas = linked ? current.priceHalalas : (dto.priceHalalas ?? current.priceHalalas);
      if (dto.externalUrl !== undefined) data.externalUrl = dto.externalUrl.trim();
      if (dto.concernTags !== undefined) data.concernTags = dto.concernTags;
      if (dto.category !== undefined) data.category = this.optionalCategory(dto.category, PRODUCT_CATEGORIES);
      const category = data.category === undefined ? current.category : data.category;
      const cosmetic = category === 'face' || category === 'body' || category === 'hair';
      if (!cosmetic) {
        data.skinTypes = [];
        data.stepAr = null;
      } else {
        if (dto.skinTypes !== undefined) data.skinTypes = dto.skinTypes;
        if (dto.stepAr !== undefined) data.stepAr = dto.stepAr === '' ? null : dto.stepAr;
      }
      const commerce = normalizeProductCommerce(dto, current, data.priceHalalas ?? current.priceHalalas);
      if (published) {
        // Operational fields on the live row. Options/variants go to draft* until admin approve.
        if (commerce.purchaseMode !== undefined) data.purchaseMode = commerce.purchaseMode;
        if (commerce.stockQty !== undefined) data.stockQty = commerce.stockQty;
        if (commerce.deliveryFeeHalalas !== undefined) data.deliveryFeeHalalas = commerce.deliveryFeeHalalas;
        if (commerce.optionsJson !== undefined) {
          data.draftOptionsSet = true;
          data.draftOptionsJson = commerce.optionsJson === null ? Prisma.DbNull : (commerce.optionsJson as Prisma.InputJsonValue);
        }
        if (commerce.variantsJson !== undefined) {
          data.draftVariantsSet = true;
          data.draftVariantsJson = commerce.variantsJson === null ? Prisma.DbNull : (commerce.variantsJson as Prisma.InputJsonValue);
        }
      } else {
        Object.assign(data, commerceWrite(commerce));
        if (commerce.optionsJson !== undefined) {
          data.draftOptionsJson = Prisma.DbNull;
          data.draftOptionsSet = false;
        }
        if (commerce.variantsJson !== undefined) {
          data.draftVariantsJson = Prisma.DbNull;
          data.draftVariantsSet = false;
        }
      }
      return tx.product.update({ where: { id: productId }, data });
    });
  }

  async deleteProduct(partnerId: string, productId: string) {
    await this.assertProductOwner(partnerId, productId);
    await this.prisma.product.update({
      where: { id: productId },
      data: { active: false, contentStatus: 'withdrawn' },
    });
    return { ok: true };
  }

  async createService(partnerId: string, dto: UpsertServiceDto) {
    const partner = await this.prisma.partner.findUnique({
      where: { id: partnerId },
    });
    if (!partner || (!['clinic', 'salon'].includes(partner.type) && partner.type !== 'developer')) {
      throw new BadRequestException('الخدمات متاحة للعيادات والصالونات فقط');
    }
    const nameAr = dto.nameAr.trim();
    // Validate category before any availability side effects.
    const category = this.optionalCategory(dto.category, SERVICE_CATEGORIES);

    return this.prisma.$transaction(async (tx) => {
      const seedResources = resourceIdsFromAvailability(dto.availabilityJson);
      await lockPartnerScheduleScope(tx, {
        partnerId,
        seedServiceIds: [`create:${partnerId}`],
        seedResourceIds: seedResources,
        loadServices: async () => {
          const partnerServices = await tx.service.findMany({
            where: { partnerId, active: true },
            select: { id: true, availabilityJson: true },
          });
          return [
            ...partnerServices.map((s) => ({
              id: s.id,
              resourceIds: parseAvailability(s.availabilityJson).map((w) => w.resourceId).filter(Boolean) as string[],
            })),
            { id: `create:${partnerId}`, resourceIds: seedResources },
          ];
        },
      });

      // Re-read siblings under locks before any unify write.
      const availabilityJson =
        dto.availabilityJson !== undefined
          ? await this.availabilityWrite(partnerId, null, dto.availabilityJson, tx, dto.unifySharedResources === true)
          : undefined;

      return tx.service.create({
        data: {
          partnerId,
          nameAr,
          nameEn: dto.nameEn?.trim() || nameAr,
          descriptionAr: dto.descriptionAr?.trim() || null,
          durationMin: dto.durationMin ?? 0,
          priceHalalas: dto.priceHalalas,
          concernTags: dto.concernTags ?? [],
          category,
          bookingEnabled: dto.bookingEnabled === true,
          payMode: 'pay_at_venue',
          ...(availabilityJson !== undefined ? { availabilityJson } : {}),
          active: false,
          contentStatus: 'draft',
          reviewStatus: 'draft',
        },
      });
    });
  }

  async updateService(partnerId: string, serviceId: string, dto: UpdateServiceDto) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.service.findFirst({ where: { id: serviceId, partnerId } });
      if (!current) throw new NotFoundException('الخدمة غير موجودة');

      const oldResourceIds = resourceIdsFromAvailability(current.availabilityJson);
      const newResourceIds =
        dto.availabilityJson !== undefined
          ? resourceIdsFromAvailability(dto.availabilityJson)
          : oldResourceIds;
      // Partner coordination first, then a single full sorted lock set (no mid-tx extras).
      await lockPartnerScheduleScope(tx, {
        partnerId,
        seedServiceIds: [serviceId],
        seedResourceIds: [...new Set([...oldResourceIds, ...newResourceIds])],
        loadServices: async () => {
          const partnerServices = await tx.service.findMany({
            where: { partnerId, active: true },
            select: { id: true, availabilityJson: true },
          });
          return partnerServices.map((s) => ({
            id: s.id,
            resourceIds: parseAvailability(s.availabilityJson).map((w) => w.resourceId).filter(Boolean) as string[],
          }));
        },
      });

      const locked = await tx.service.findFirst({ where: { id: serviceId, partnerId } });
      if (!locked) throw new NotFoundException('الخدمة غير موجودة');

      const published = locked.contentStatus === 'published';
      const data: {
        draftNameAr?: string;
        draftNameEn?: string;
        draftDescriptionAr?: string | null;
        nameAr?: string;
        nameEn?: string;
        descriptionAr?: string | null;
        durationMin?: number;
        priceHalalas?: number;
        concernTags?: string[];
        category?: string | null;
        bookingEnabled?: boolean;
        payMode?: string;
        availabilityJson?: Prisma.InputJsonValue | typeof Prisma.DbNull;
        reviewRevision: { increment: number };
        reviewStatus: string;
      } = {
        reviewRevision: { increment: 1 },
        reviewStatus: locked.reviewStatus === 'in_review' ? 'in_review' : 'draft',
      };
      if (dto.nameAr !== undefined) {
        if (published) data.draftNameAr = dto.nameAr;
        else data.nameAr = dto.nameAr;
      }
      if (dto.nameEn !== undefined) {
        const nextName = dto.nameEn.trim() || (published ? (data.draftNameAr || locked.nameAr) : (data.nameAr || locked.nameAr));
        if (published) data.draftNameEn = nextName;
        else data.nameEn = nextName;
      }
      if (dto.descriptionAr !== undefined) {
        const cleared = dto.descriptionAr == null || dto.descriptionAr === '';
        if (published) data.draftDescriptionAr = cleared ? '' : dto.descriptionAr;
        else data.descriptionAr = cleared ? null : dto.descriptionAr;
      }
      if (dto.durationMin !== undefined) data.durationMin = dto.durationMin;
      if (dto.priceHalalas !== undefined) data.priceHalalas = dto.priceHalalas;
      if (dto.concernTags !== undefined) data.concernTags = dto.concernTags;
      if (dto.category !== undefined) data.category = this.optionalCategory(dto.category, SERVICE_CATEGORIES);
      if (dto.bookingEnabled !== undefined) data.bookingEnabled = dto.bookingEnabled === true;
      if (dto.payMode !== undefined) data.payMode = dto.payMode === 'pay_at_venue' ? 'pay_at_venue' : locked.payMode;
      if (dto.availabilityJson !== undefined) {
        data.availabilityJson = await this.availabilityWrite(
          partnerId,
          serviceId,
          dto.availabilityJson,
          tx,
          dto.unifySharedResources === true,
        );
      }
      return tx.service.update({ where: { id: serviceId }, data });
    });
  }

  /** Persist availability after rejecting overlaps and partner-wide resource capacity conflicts. */
  private async availabilityWrite(
    partnerId: string,
    serviceId: string | null,
    raw: unknown,
    db: {
      service: PrismaService['service'];
      $executeRaw?: PrismaService['$executeRaw'];
      $queryRaw?: PrismaService['$queryRaw'];
    } = this.prisma,
    unifySharedResources = false,
  ): Promise<Prisma.InputJsonValue | typeof Prisma.DbNull> {
    if (raw == null) return Prisma.DbNull;
    if (!Array.isArray(raw)) throw new BadRequestException('جدول التوفر غير صالح');
    const windows = [];
    for (const entry of raw) {
      if (!entry || typeof entry !== 'object') throw new BadRequestException('فترة توفر غير صالحة');
      const row = entry as Record<string, unknown>;
      const resourceId = normalizeResourceId(row.resourceId);
      const weekday = row.weekday;
      const startMin = row.startMin;
      const endMin = row.endMin;
      const capacity = row.capacity;
      if (
        typeof weekday !== 'number' ||
        typeof startMin !== 'number' ||
        typeof endMin !== 'number' ||
        typeof capacity !== 'number'
      ) {
        throw new BadRequestException('فترة توفر غير صالحة');
      }
      windows.push({ weekday, startMin, endMin, capacity, resourceId });
    }
    const parsed = parseAvailability(windows);
    if (parsed.length !== windows.length) throw new BadRequestException('فترة توفر غير صالحة');
    assertAvailabilityConsistent(parsed);
    assertResourceCapacitiesConsistent(parsed);
    // Always re-read siblings under the caller's transaction/locks — never reuse a pre-lock snapshot.
    const siblings = await db.service.findMany({
      where: { partnerId, active: true, ...(serviceId ? { id: { not: serviceId } } : {}) },
      select: { id: true, availabilityJson: true, nameAr: true },
    });
    if (unifySharedResources) {
      const capacityByResource = new Map<string, number>();
      for (const w of parsed) {
        if (w.resourceId) capacityByResource.set(w.resourceId, w.capacity);
      }
      const affected: string[] = [];
      let unifiedCount = 0;
      const siblingIds = siblings.map((s) => s.id).sort();
      for (const siblingId of siblingIds) {
        // Re-read each sibling immediately before write so a prior unify in this tx is visible
        // and a stale pre-lock copy cannot wipe another resource's capacity.
        const fresh = await db.service.findFirst({
          where: { id: siblingId, partnerId },
          select: { id: true, availabilityJson: true, nameAr: true },
        });
        if (!fresh) continue;
        const siblingWindows = parseAvailability(fresh.availabilityJson);
        const needs = siblingWindows.some(
          (w) => w.resourceId && capacityByResource.has(w.resourceId) && capacityByResource.get(w.resourceId) !== w.capacity,
        );
        if (!needs) continue;
        const unified = unifyResourceCapacities(siblingWindows, capacityByResource);
        assertAvailabilityConsistent(unified);
        await db.service.update({
          where: { id: fresh.id },
          data: { availabilityJson: unified as unknown as Prisma.InputJsonValue },
        });
        affected.push(fresh.nameAr);
        unifiedCount += 1;
        if (process.env.MIRA_TEST_UNIFY_FAIL_AFTER === '1' && unifiedCount === 1) {
          throw new BadRequestException('حقن فشل اختبار بعد أول توحيد');
        }
      }
      return parsed as unknown as Prisma.InputJsonValue;
    }
    const otherWindows = siblings.flatMap((s) => parseAvailability(s.availabilityJson));
    const conflicts = findResourceCapacityConflicts([parsed, otherWindows]);
    if (conflicts.length > 0) {
      const first = conflicts[0]!;
      const names = siblings
        .filter((s) => findResourceCapacityConflicts([parsed, parseAvailability(s.availabilityJson)]).length > 0)
        .map((s) => s.nameAr)
        .slice(0, 5);
      throw new BadRequestException({
        statusCode: 400,
        code: 'RESOURCE_CAPACITY_CONFLICT',
        message: `سعة المورد «${first.resourceId}» غير متسقة (${first.capacities.join(' مقابل ')}). الخدمات المتأثرة: ${names.join('، ') || 'خدمات أخرى'}. فعّلي خيار توحيد سعة المورد في نموذج الخدمة قبل الحفظ إن أردت تطبيق السعة الجديدة على كل خدمات جهتك دفعة واحدة.`,
        messageAr: `سعة المورد «${first.resourceId}» غير متسقة (${first.capacities.join(' مقابل ')}). الخدمات المتأثرة: ${names.join('، ') || 'خدمات أخرى'}. فعّلي خيار توحيد سعة المورد في نموذج الخدمة قبل الحفظ إن أردت تطبيق السعة الجديدة على كل خدمات جهتك دفعة واحدة.`,
        conflicts,
        affectedServices: names,
        unifyHintAr: 'فعّلي خيار «توحيد سعة المورد المشترك» في نموذج الخدمة ثم احفظي مرة أخرى',
      });
    }
    return parsed as unknown as Prisma.InputJsonValue;
  }

  async deleteService(partnerId: string, serviceId: string) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.service.findFirst({ where: { id: serviceId, partnerId } });
      if (!current) throw new NotFoundException('الخدمة غير موجودة');
      const resources = resourceIdsFromAvailability(current.availabilityJson);
      await lockPartnerScheduleScope(tx, {
        partnerId,
        seedServiceIds: [serviceId],
        seedResourceIds: resources,
        loadServices: async () => {
          const partnerServices = await tx.service.findMany({
            where: { partnerId, active: true },
            select: { id: true, availabilityJson: true },
          });
          return partnerServices.map((s) => ({
            id: s.id,
            resourceIds: parseAvailability(s.availabilityJson).map((w) => w.resourceId).filter(Boolean) as string[],
          }));
        },
      });
      const locked = await tx.service.findFirst({ where: { id: serviceId, partnerId } });
      if (!locked) throw new NotFoundException('الخدمة غير موجودة');
      await tx.service.update({
        where: { id: serviceId },
        data: { active: false, contentStatus: 'withdrawn' },
      });
      return { ok: true };
    });
  }

  private optionalCategory(value: string | undefined, allowed: Set<string>): string | null {
    const category = value?.trim() || '';
    if (!category) return null;
    if (!allowed.has(category)) throw new BadRequestException('التصنيف غير معروف');
    return category;
  }

  private async assertProductOwner(partnerId: string, productId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, partnerId },
    });
    if (!product) throw new NotFoundException('المنتج غير موجود');
    return product;
  }

  private async assertServiceOwner(partnerId: string, serviceId: string) {
    const service = await this.prisma.service.findFirst({
      where: { id: serviceId, partnerId },
    });
    if (!service) throw new NotFoundException('الخدمة غير موجودة');
    return service;
  }
}
