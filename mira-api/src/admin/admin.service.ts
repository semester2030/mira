import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { resolvePerfectCorpConfig } from '../ai/config/perfect-corp.config';
import { PrismaService } from '../prisma/prisma.service';
import { PartnersPortalService } from '../partners-portal/partners-portal.service';
import { UsersService } from '../users/users.service';
import { subscriptionsEnabled } from '../subscriptions/subscription-plans';

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly usersService: UsersService,
    private readonly partnersPortal: PartnersPortalService,
  ) {}

  async getOverviewStats() {
    const now = new Date();
    const todayStart = startOfDay(now);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      newUsersToday,
      newUsersWeek,
      skinToday,
      outfitToday,
      recommendationsToday,
      auditToday,
      premiumActive,
      freeActive,
      pendingApplications,
      feedbackTotal,
      feedbackUnratedLow,
      totalPartners,
      activePartners,
      suspendedPartners,
      leadsTotal,
      partnerEventsWeek,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { createdAt: { gte: todayStart } } }),
      this.prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
      this.prisma.skinAnalysis.count({ where: { createdAt: { gte: todayStart } } }),
      this.prisma.outfitAnalysis.count({ where: { createdAt: { gte: todayStart } } }),
      this.prisma.recommendation.count({ where: { createdAt: { gte: todayStart } } }),
      this.prisma.auditLog.count({ where: { createdAt: { gte: todayStart } } }),
      this.prisma.subscription.count({
        where: { plan: 'premium', status: 'active' },
      }),
      this.prisma.subscription.count({
        where: { plan: 'free', status: 'active' },
      }),
      this.prisma.partnerApplication.count({ where: { status: 'pending' } }),
      this.prisma.feedback.count(),
      this.prisma.feedback.count({
        where: { OR: [{ rating: { lte: 2 } }, { rating: null }] },
      }),
      this.prisma.partner.count(),
      this.prisma.partner.count({ where: { status: 'active' } }),
      this.prisma.partner.count({ where: { status: 'suspended' } }),
      this.prisma.websiteLead.count(),
      this.prisma.partnerEvent.count({ where: { createdAt: { gte: weekAgo } } }),
    ]);

    return {
      generatedAt: now.toISOString(),
      users: {
        total: totalUsers,
        newToday: newUsersToday,
        newThisWeek: newUsersWeek,
      },
      analyses: {
        skinToday,
        outfitToday,
        recommendationsToday,
        totalToday: skinToday + outfitToday + recommendationsToday,
      },
      subscriptions: {
        enabled: subscriptionsEnabled(),
        premiumActive,
        freeActive,
      },
      partners: {
        total: totalPartners,
        active: activePartners,
        suspended: suspendedPartners,
        pendingApplications,
        eventsThisWeek: partnerEventsWeek,
      },
      feedback: {
        total: feedbackTotal,
        needsAttention: feedbackUnratedLow,
      },
      leads: { total: leadsTotal },
      auditEventsToday: auditToday,
    };
  }

  async getAnalysisTrend(days = 14) {
    const safeDays = Math.min(Math.max(days, 7), 30);
    const now = new Date();
    const start = startOfDay(
      new Date(now.getTime() - (safeDays - 1) * 24 * 60 * 60 * 1000),
    );

    const [skinRows, outfitRows, recommendationRows] = await Promise.all([
      this.prisma.skinAnalysis.findMany({
        where: { createdAt: { gte: start } },
        select: { createdAt: true },
      }),
      this.prisma.outfitAnalysis.findMany({
        where: { createdAt: { gte: start } },
        select: { createdAt: true },
      }),
      this.prisma.recommendation.findMany({
        where: { createdAt: { gte: start } },
        select: { createdAt: true },
      }),
    ]);

    const buckets = new Map<
      string,
      { date: string; skin: number; outfit: number; recommendations: number }
    >();

    for (let i = 0; i < safeDays; i++) {
      const d = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
      const key = dayKey(d);
      buckets.set(key, {
        date: key,
        skin: 0,
        outfit: 0,
        recommendations: 0,
      });
    }

    for (const row of skinRows) {
      const key = dayKey(row.createdAt);
      buckets.get(key)!.skin += 1;
    }
    for (const row of outfitRows) {
      const key = dayKey(row.createdAt);
      buckets.get(key)!.outfit += 1;
    }
    for (const row of recommendationRows) {
      const key = dayKey(row.createdAt);
      buckets.get(key)!.recommendations += 1;
    }

    return {
      days: safeDays,
      series: [...buckets.values()],
    };
  }

  async listUsers(page = 1, limit = 20, search?: string) {
    const skip = (page - 1) * limit;
    const where: Prisma.UserWhereInput = search
      ? {
          OR: [
            { email: { contains: search, mode: 'insensitive' } },
            { displayName: { contains: search, mode: 'insensitive' } },
            { firebaseUid: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {};

    const [total, rows] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          subscription: { select: { plan: true, status: true } },
          _count: {
            select: {
              skinAnalyses: true,
              outfitAnalyses: true,
              recommendations: true,
              feedback: true,
            },
          },
        },
      }),
    ]);

    return {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
      items: rows.map((u) => ({
        id: u.id,
        email: u.email,
        displayName: u.displayName,
        firebaseUid: u.firebaseUid,
        createdAt: u.createdAt,
        plan: u.subscription?.plan ?? 'free',
        subscriptionStatus: u.subscription?.status ?? 'active',
        counts: u._count,
      })),
    };
  }

  async getUserDetail(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        subscription: true,
        preference: true,
        _count: {
          select: {
            skinAnalyses: true,
            outfitAnalyses: true,
            recommendations: true,
            feedback: true,
            auditLogs: true,
          },
        },
      },
    });
    if (!user) throw new NotFoundException('المستخدمة غير موجودة');

    const recentAudit = await this.prisma.auditLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 15,
    });

    const recentSkin = await this.prisma.skinAnalysis.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, createdAt: true },
    });

    const recentOutfit = await this.prisma.outfitAnalysis.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, occasionId: true, createdAt: true },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        firebaseUid: user.firebaseUid,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        subscription: user.subscription,
        preference: user.preference
          ? {
              locale: user.preference.locale,
              birthYear: user.preference.birthYear,
            }
          : null,
        counts: user._count,
      },
      recentAudit,
      recentSkin,
      recentOutfit,
    };
  }

  async listAuditLogs(
    page = 1,
    limit = 30,
    action?: string,
    userId?: string,
  ) {
    const skip = (page - 1) * limit;
    const where: Prisma.AuditLogWhereInput = {
      ...(action ? { action: { contains: action } } : {}),
      ...(userId ? { userId } : {}),
    };

    const [total, rows] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { id: true, email: true, displayName: true },
          },
        },
      }),
    ]);

    return {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
      items: rows,
    };
  }

  async listFeedback(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [total, rows] = await Promise.all([
      this.prisma.feedback.count(),
      this.prisma.feedback.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { id: true, email: true, displayName: true },
          },
        },
      }),
    ]);

    return {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
      items: rows,
    };
  }

  async listPartners(page = 1, limit = 20, status?: string) {
    const skip = (page - 1) * limit;
    const where: Prisma.PartnerWhereInput = status ? { status } : {};

    const [total, rows] = await Promise.all([
      this.prisma.partner.count({ where }),
      this.prisma.partner.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { products: true, services: true, events: true },
          },
        },
      }),
    ]);

    return {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
      items: rows.map((p) => ({
        id: p.id,
        type: p.type,
        status: p.status,
        nameAr: p.nameAr,
        nameEn: p.nameEn,
        city: p.city,
        storeUrl: p.storeUrl,
        rating: p.rating,
        createdAt: p.createdAt,
        counts: p._count,
      })),
    };
  }

  async updatePartnerStatus(partnerId: string, status: 'active' | 'suspended') {
    const partner = await this.prisma.partner.findUnique({
      where: { id: partnerId },
    });
    if (!partner) throw new NotFoundException('الشريك غير موجود');
    if (partner.status === status) {
      throw new BadRequestException('الحالة مطابقة بالفعل');
    }

    const updated = await this.prisma.partner.update({
      where: { id: partnerId },
      data: { status },
    });

    await this.usersService.writeAuditLog({
      action: 'admin.partner.status_updated',
      metadata: {
        partnerId,
        previousStatus: partner.status,
        newStatus: status,
        nameAr: partner.nameAr,
      },
    });

    return updated;
  }

  listApplications(status = 'pending') {
    return this.partnersPortal.listApplications(status);
  }

  async approveApplication(id: string) {
    const result = await this.partnersPortal.approveApplication(id);
    await this.usersService.writeAuditLog({
      action: 'admin.partner.application_approved',
      metadata: { applicationId: id },
    });
    return result;
  }

  async rejectApplication(id: string, reason?: string) {
    const result = await this.partnersPortal.rejectApplication(id, reason);
    await this.usersService.writeAuditLog({
      action: 'admin.partner.application_rejected',
      metadata: { applicationId: id, reason: reason ?? null },
    });
    return result;
  }

  async listWebsiteLeads(page = 1, limit = 20, type?: string) {
    const skip = (page - 1) * limit;
    const where: Prisma.WebsiteLeadWhereInput = type ? { type } : {};

    const [total, rows] = await Promise.all([
      this.prisma.websiteLead.count({ where }),
      this.prisma.websiteLead.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
      items: rows,
    };
  }

  getSystemConfig() {
    const perfect = resolvePerfectCorpConfig(this.config);
    return {
      timestamp: new Date().toISOString(),
      environment: this.config.get<string>('NODE_ENV', 'development'),
      providers: {
        skinProvider: this.config.get<string>('SKIN_PROVIDER', 'mock'),
        outfitProvider: this.config.get<string>('OUTFIT_PROVIDER', 'mock'),
        perfectCorpKeySet: perfect.apiKey.length > 0,
        perfectCorpFallbackMock:
          this.config.get<string>('PERFECT_CORP_FALLBACK_MOCK', 'true') !==
          'false',
        googleVisionKeySet:
          (this.config.get<string>('GOOGLE_VISION_API_KEY') ?? '').length > 0,
      },
      features: {
        subscriptionsEnabled: subscriptionsEnabled(),
        partnerAutoApprove:
          this.config.get<string>('PARTNER_AUTO_APPROVE') === 'true',
        authSkip: this.config.get<string>('AUTH_SKIP') === 'true',
        rateLimitPerHour: Number(
          this.config.get<string>('RATE_LIMIT_PER_HOUR', '30'),
        ),
      },
      security: {
        adminKeyConfigured:
          (this.config.get<string>('ADMIN_API_KEY') ?? '').trim().length > 0,
        firebaseProjectId:
          this.config.get<string>('FIREBASE_PROJECT_ID') ?? null,
      },
    };
  }

  async getAuditActionSummary() {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const rows = await this.prisma.auditLog.groupBy({
      by: ['action'],
      where: { createdAt: { gte: since } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    });

    return rows.map((r) => ({
      action: r.action,
      count: r._count.id,
    }));
  }
}
