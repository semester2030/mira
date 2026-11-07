import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { PARTNER_KIND_FORBIDDEN, partnerCanCreateKind } from './partner-capabilities';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';
import { normalizeProductCommerce, ProductCommerceData } from '../marketplace/commerce-public';
import {
  AVAILABILITY_TIMEZONE,
  assertAvailabilityConsistent,
  assertResourceCapacitiesConsistent,
  capacityBearingWindowsFromDocument,
  findResourceCapacityConflicts,
  normalizeAvailabilityDocument,
  normalizeResourceId,
  parseAvailability,
  unifyResourceCapacities,
} from '../marketplace/commerce.types';
import { lockPartnerScheduleScope } from '../marketplace/commerce-schedule-locks';
import { PrismaService } from '../prisma/prisma.service';
import { TaxonomyService } from '../marketplace/taxonomy/taxonomy.service';
import { applyTaxonomyPatch } from '../marketplace/taxonomy/taxonomy-write.apply';
import type { AttributeFieldDef } from '../marketplace/taxonomy/product-taxonomy.validate';
import { normalizeOptionalId } from '../marketplace/taxonomy/product-taxonomy.validate';
import { ApplyPartnerDto } from './dto/apply-partner.dto';
import { UpdateProductDto, UpdateServiceDto, UpsertProductDto, UpsertServiceDto } from './dto/catalog.dto';
import { TrackPartnerEventDto } from './dto/track-event.dto';
import { hashPartnerPassword, verifyPartnerPassword } from './partner-password';
import { assertVariantMediaIdsEligible } from './variant-media-ids';
import { RegistryService } from './registry/registry.service';

function newToken(): string {
  return randomBytes(32).toString('hex');
}

function resourceIdsFromAvailability(raw: unknown): string[] {
  if (raw == null) return [];
  const ids = new Set<string>();
  const doc = normalizeAvailabilityDocument(raw);
  for (const entry of doc.windows) {
    if (entry.resourceId) ids.add(entry.resourceId);
  }
  for (const entry of doc.exceptions) {
    if (entry.resourceId) ids.add(entry.resourceId);
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
export class PartnersPortalService implements OnModuleInit {
  private readonly logger = new Logger(PartnersPortalService.name);

  private readonly taxonomy: TaxonomyService;
  private readonly registry: RegistryService | null;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ConfigService) private readonly config: ConfigService,
    @Optional() @Inject(TaxonomyService) taxonomy?: TaxonomyService,
    @Optional() @Inject(RegistryService) registry?: RegistryService,
  ) {
    this.taxonomy = taxonomy ?? new TaxonomyService();
    if (!taxonomy) this.taxonomy.onModuleInit();
    this.registry = registry ?? null;
  }

  private taxonomyWriteContext(profileId?: string | null) {
    const knownProfileIds = this.registry
      ? new Set(this.registry.getRegistry().profiles.map((p) => p.id))
      : undefined;
    let attributeFieldDefs: Map<string, AttributeFieldDef> | undefined;
    if (this.registry && profileId) {
      const profile = this.registry.getProfile(profileId);
      if (profile) {
        attributeFieldDefs = new Map();
        const fields = this.registry.getRegistry().fields;
        for (const fieldId of profile.fields ?? []) {
          const def = fields[fieldId];
          if (!def) continue;
          // Only attribute-stored fields participate in attributes bag validation.
          const storage = (def as { storage?: string }).storage;
          if (typeof storage === 'string' && storage.startsWith('attributes.')) {
            attributeFieldDefs.set(fieldId, {
              id: fieldId,
              type: def.type,
              values: def.values,
              min: def.min ?? null,
              max: def.max ?? null,
            });
          }
        }
      }
    }
    return {
      doc: this.taxonomy.getDoc(),
      knownProfileIds,
      attributeFieldDefs,
      allowUnknownAttributeKeys: true,
    };
  }

  private throwTaxonomyErrors(errors: Array<{ fieldId: string; code: string; messageAr?: string }>) {
    if (!errors.length) return;
    throw new BadRequestException({
      message: errors[0].messageAr || errors[0].code,
      messageAr: errors[0].messageAr || errors[0].code,
      code: errors[0].code,
      fieldErrors: errors,
    });
  }

  /** One-shot: set password for an existing portal user from Render env (no chat dump). */
  async onModuleInit() {
    const email = this.config
      .get<string>('MIRA_PARTNER_PORTAL_BOOTSTRAP_EMAIL')
      ?.trim()
      .toLowerCase();
    const password = this.config.get<string>('MIRA_PARTNER_PORTAL_BOOTSTRAP_PASSWORD');
    if (!email || !password || password.length < 8) return;

    try {
      const user = await this.prisma.partnerUser.findUnique({ where: { email } });
      if (!user) {
        this.logger.warn(`Bootstrap password skipped: no PartnerUser for ${email}`);
        return;
      }
      const passwordHash = await hashPartnerPassword(password);
      await this.prisma.partnerUser.update({
        where: { id: user.id },
        data: { passwordHash, accessToken: newToken() },
      });
      this.logger.log(`Bootstrap password applied for portal user ${email}`);
    } catch (err) {
      this.logger.error(`Bootstrap password failed: ${(err as Error).message}`);
    }
  }

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
    const passwordHash = await hashPartnerPassword(dto.password);
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
        passwordHash,
        statusToken,
      },
    });

    if (this.autoApproveEnabled()) {
      const approved = await this.approveApplication(application.id);
      const session = await this.login(dto.contactEmail, dto.password);
      return {
        applicationId: application.id,
        status: 'approved',
        statusToken,
        autoApproved: true,
        partnerId: approved.partnerId,
        loginEmail: session.email,
        accessToken: session.accessToken,
        message: 'تم التفعيل — ادخل بالبريد وكلمة المرور',
      };
    }

    return {
      applicationId: application.id,
      status: 'pending',
      statusToken,
      statusUrl: `/status.html?token=${statusToken}`,
      message: 'تم استلام طلبك — سنراجعه خلال 1–3 أيام عمل. بعد الاعتماد ادخل بالبريد وكلمة المرور.',
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

  async login(email: string, password: string) {
    const user = await this.prisma.partnerUser.findFirst({
      where: { email: email.toLowerCase().trim() },
      include: { partner: true },
    });
    if (!user || user.partner.status !== 'active') {
      throw new BadRequestException('بيانات الدخول غير صحيحة');
    }
    if (!user.passwordHash) {
      throw new BadRequestException(
        'لم تُعيَّن كلمة مرور لهذا الحساب بعد — تواصل مع الإدارة',
      );
    }
    const ok = await verifyPartnerPassword(password, user.passwordHash);
    if (!ok) {
      throw new BadRequestException('بيانات الدخول غير صحيحة');
    }

    const accessToken = newToken();
    await this.prisma.partnerUser.update({
      where: { id: user.id },
      data: { accessToken },
    });

    return {
      accessToken,
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

  /** Admin: set/reset portal password (developer or partner). Never returns the password. */
  async adminSetPassword(email: string, password: string) {
    if (!password || password.length < 8 || password.length > 128) {
      throw new BadRequestException('كلمة المرور يجب أن تكون بين 8 و 128 حرفاً');
    }
    const user = await this.prisma.partnerUser.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
    if (!user) throw new NotFoundException('المستخدم غير موجود');

    const passwordHash = await hashPartnerPassword(password);
    await this.prisma.partnerUser.update({
      where: { id: user.id },
      data: { passwordHash, accessToken: newToken() },
    });
    return {
      email: user.email,
      message: 'تم تعيين كلمة المرور — ادخل من بوابة الشركاء بالبريد وكلمة المرور',
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
      return {
        partnerId: app.partnerId,
        loginEmail: app.contactEmail.toLowerCase(),
        alreadyApproved: true,
        message: 'معتمد مسبقاً — الدخول بالبريد وكلمة المرور فقط',
      };
    }
    if (app.status !== 'pending') {
      throw new ConflictException(`الطلب في حالة: ${app.status}`);
    }
    if (!app.passwordHash) {
      throw new BadRequestException(
        'الطلب بلا كلمة مرور — اطلب من مقدم الطلب إعادة التسجيل بكلمة مرور',
      );
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
          passwordHash: app.passwordHash!,
        },
      });

      await tx.partnerApplication.update({
        where: { id },
        data: {
          status: 'approved',
          partnerId: partner.id,
          reviewedAt: new Date(),
          passwordHash: null,
        },
      });

      return { partnerId: partner.id };
    });

    return {
      ...result,
      loginEmail: app.contactEmail.toLowerCase(),
      message: 'تم تفعيل الشريك — يدخل بالبريد وكلمة المرور (بدون رمز)',
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
    if (!partner || !partnerCanCreateKind(partner.type, 'product')) {
      throw new ForbiddenException({
        message: 'المنتجات غير مسموحة لهذا الحساب',
        messageAr: 'المنتجات غير مسموحة لهذا الحساب',
        code: PARTNER_KIND_FORBIDDEN,
      });
    }
    const categoryRaw = this.optionalCategory(dto.category, PRODUCT_CATEGORIES);
    const applied = applyTaxonomyPatch(
      this.taxonomyWriteContext(normalizeOptionalId(dto.profileId) ?? null),
      { category: null, subcategory: null, profileId: null, attributesJson: null },
      {
        category: categoryRaw,
        subcategory: dto.subcategory as string | null | undefined,
        profileId: dto.profileId as string | null | undefined,
        attributes: dto.attributes,
      },
      { published: false },
    );
    this.throwTaxonomyErrors(applied.errors);
    let category = applied.next.category;
    if (category) category = this.optionalCategory(category, PRODUCT_CATEGORIES);
    const subcategory = applied.next.subcategory;
    const profileId = applied.next.profileId;
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
        subcategory,
        profileId,
        ...(dto.attributes !== undefined
          ? {
              attributesJson:
                applied.next.attributesJson == null
                  ? Prisma.DbNull
                  : (applied.next.attributesJson as Prisma.InputJsonValue),
            }
          : {}),
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
        subcategory?: string | null;
        profileId?: string | null;
        attributesJson?: Prisma.InputJsonValue | typeof Prisma.DbNull;
        draftCategory?: string | null;
        draftSubcategory?: string | null;
        draftProfileId?: string | null;
        draftAttributesJson?: Prisma.InputJsonValue | typeof Prisma.DbNull;
        draftTaxonomySet?: boolean;
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

      const taxonomyTouched =
        dto.category !== undefined ||
        dto.subcategory !== undefined ||
        dto.profileId !== undefined ||
        dto.attributes !== undefined;
      if (taxonomyTouched) {
        const categoryPatch =
          dto.category !== undefined ? this.optionalCategory(dto.category, PRODUCT_CATEGORIES) : undefined;
        // Effective baseline for published pending edits: prior draft taxonomy if set, else live.
        const baseline = published && current.draftTaxonomySet
          ? {
              category: current.draftCategory ?? current.category,
              subcategory: current.draftSubcategory ?? current.subcategory,
              profileId: current.draftProfileId ?? current.profileId,
              attributesJson: current.draftAttributesJson ?? current.attributesJson,
            }
          : {
              category: current.category,
              subcategory: current.subcategory,
              profileId: current.profileId,
              attributesJson: current.attributesJson,
            };
        const applied = applyTaxonomyPatch(
          this.taxonomyWriteContext(
            (dto.profileId !== undefined ? normalizeOptionalId(dto.profileId) : baseline.profileId) ?? null,
          ),
          baseline,
          {
            category: categoryPatch,
            subcategory: dto.subcategory as string | null | undefined,
            profileId: dto.profileId as string | null | undefined,
            attributes: dto.attributes,
          },
          { published },
        );
        this.throwTaxonomyErrors(applied.errors);
        if (published) {
          Object.assign(data, applied.draftData);
        } else {
          Object.assign(data, applied.liveData);
          if (applied.liveData.category != null) {
            data.category = this.optionalCategory(String(applied.liveData.category), PRODUCT_CATEGORIES);
          }
        }
      }
      const category = published
        ? current.category
        : data.category === undefined
          ? current.category
          : data.category;
      const cosmetic = category === 'face' || category === 'body' || category === 'hair';
      if (!cosmetic) {
        data.skinTypes = [];
        data.stepAr = null;
      } else {
        if (dto.skinTypes !== undefined) data.skinTypes = dto.skinTypes;
        if (dto.stepAr !== undefined) data.stepAr = dto.stepAr === '' ? null : dto.stepAr;
      }
      const commerce = normalizeProductCommerce(dto, current, data.priceHalalas ?? current.priceHalalas);
      if (commerce.variantsJson !== undefined && commerce.variantsJson !== null) {
        await assertVariantMediaIdsEligible(tx, productId, commerce.variantsJson);
      }
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
    if (!partner || !partnerCanCreateKind(partner.type, 'service')) {
      throw new ForbiddenException({
        message: 'الخدمات غير مسموحة لهذا الحساب',
        messageAr: 'الخدمات غير مسموحة لهذا الحساب',
        code: PARTNER_KIND_FORBIDDEN,
      });
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
          priceHalalas: dto.priceHalalas ?? 0,
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

      if (
        dto.expectedRevision != null &&
        Number.isInteger(dto.expectedRevision) &&
        dto.expectedRevision !== locked.reviewRevision
      ) {
        throw new ConflictException({
          statusCode: 409,
          code: 'SERVICE_REVISION_CONFLICT',
          message: 'تعارض مراجعة الخدمة — حدّثي الصفحة أو احتفظي بتعديلاتك المحلية وأعيدي المحاولة بعد الدمج',
          messageAr: 'تعارض مراجعة الخدمة — حدّثي الصفحة أو احتفظي بتعديلاتك المحلية وأعيدي المحاولة بعد الدمج',
          expectedRevision: dto.expectedRevision,
          currentRevision: locked.reviewRevision,
        });
      }

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
    // Strict write: array (legacy) or {windows, closedDates?, exceptions?, timezone?}. Invalid entries are
    // rejected (never silently dropped) and any timezone other than Asia/Riyadh is refused.
    const doc = normalizeAvailabilityDocument(raw, { strict: true });
    const parsed = doc.windows;
    assertAvailabilityConsistent(parsed);
    // Weekly + specials within this payload must agree on resource capacities.
    assertResourceCapacitiesConsistent(capacityBearingWindowsFromDocument(doc));
    // Always persist the v2 document (also for legacy bare-array input).
    const persistDoc = {
      v: 2 as const,
      timezone: AVAILABILITY_TIMEZONE,
      windows: parsed,
      closedDates: doc.closedDates,
      exceptions: doc.exceptions,
    };
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
      let unifiedCount = 0;
      const siblingIds = siblings.map((s) => s.id).sort();
      for (const siblingId of siblingIds) {
        const fresh = await db.service.findFirst({
          where: { id: siblingId, partnerId },
          select: { id: true, availabilityJson: true, nameAr: true },
        });
        if (!fresh) continue;
        const siblingDoc = normalizeAvailabilityDocument(fresh.availabilityJson);
        const siblingWindows = siblingDoc.windows;
        const needs = siblingWindows.some(
          (w) => w.resourceId && capacityByResource.has(w.resourceId) && capacityByResource.get(w.resourceId) !== w.capacity,
        );
        if (!needs) continue;
        const unified = unifyResourceCapacities(siblingWindows, capacityByResource);
        assertAvailabilityConsistent(unified);
        await db.service.update({
          where: { id: fresh.id },
          data: {
            availabilityJson: {
              ...siblingDoc,
              v: 2,
              timezone: AVAILABILITY_TIMEZONE,
              windows: unified,
            } as unknown as Prisma.InputJsonValue,
          },
        });
        unifiedCount += 1;
        if (process.env.MIRA_TEST_UNIFY_FAIL_AFTER === '1' && unifiedCount === 1) {
          throw new BadRequestException('حقن فشل اختبار بعد أول توحيد');
        }
      }
      return persistDoc as unknown as Prisma.InputJsonValue;
    }
    const selfCaps = capacityBearingWindowsFromDocument(persistDoc);
    const otherWindows = siblings.flatMap((s) => capacityBearingWindowsFromDocument(s.availabilityJson));
    const conflicts = findResourceCapacityConflicts([selfCaps, otherWindows]);
    if (conflicts.length > 0) {
      const first = conflicts[0]!;
      const names = siblings
        .filter(
          (s) =>
            findResourceCapacityConflicts([selfCaps, capacityBearingWindowsFromDocument(s.availabilityJson)])
              .length > 0,
        )
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
    return persistDoc as unknown as Prisma.InputJsonValue;
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
