import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { RequestUser } from '../common/interfaces/request-user.interface';
import {
  FREE_TIER_LIMITS,
  SUBSCRIPTION_PLANS,
  SubscriptionPlan,
} from './subscription-plans';

export type AnalysisKind = 'skin' | 'outfit';

@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly config: ConfigService,
  ) {}

  async getStatus(authUser: RequestUser) {
    const user = await this.usersService.findOrCreateFromFirebase(authUser);
    const sub = await this.ensureSubscription(user.id);
    const usage = await this.getMonthlyUsage(user.id);

    return {
      plan: sub.plan,
      status: sub.status,
      isPremium: this.isPremiumPlan(sub.plan, sub.status),
      currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
      limits: FREE_TIER_LIMITS,
      usage,
    };
  }

  async assertCanAnalyze(authUser: RequestUser, kind: AnalysisKind): Promise<void> {
    const user = await this.usersService.findOrCreateFromFirebase(authUser);
    const sub = await this.ensureSubscription(user.id);

    if (this.isPremiumPlan(sub.plan, sub.status)) return;

    const usage = await this.getMonthlyUsage(user.id);
    const limit =
      kind === 'skin'
        ? FREE_TIER_LIMITS.skinAnalysisPerMonth
        : FREE_TIER_LIMITS.outfitAnalysisPerMonth;
    const used = kind === 'skin' ? usage.skinThisMonth : usage.outfitThisMonth;

    if (used >= limit) {
      throw new ForbiddenException(
        kind === 'skin'
          ? 'وصلتِ للحد المجاني من تحليلات البشرة هذا الشهر. اشتركي في ميرا بريميوم للتحليل بدون حدود.'
          : 'وصلتِ للحد المجاني من تحليلات الإطلالة هذا الشهر. اشتركي في ميرا بريميوم للتحليل بدون حدود.',
      );
    }
  }

  /** Development only — simulates App Store / RevenueCat activation. */
  async activatePremiumDev(authUser: RequestUser) {
    if (this.config.get<string>('NODE_ENV') === 'production') {
      throw new ForbiddenException('Not available in production');
    }

    const user = await this.usersService.findOrCreateFromFirebase(authUser);
    const periodEnd = new Date();
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    return this.prisma.subscription.update({
      where: { userId: user.id },
      data: {
        plan: SUBSCRIPTION_PLANS.premium,
        status: 'active',
        currentPeriodEnd: periodEnd,
        externalId: 'dev-premium',
      },
    });
  }

  /** Placeholder for RevenueCat / App Store webhook — verify signature in production. */
  async handleStoreWebhook(body: Record<string, unknown>) {
    return { received: true, body };
  }

  private async ensureSubscription(userId: string) {
    const existing = await this.prisma.subscription.findUnique({
      where: { userId },
    });
    if (existing) return existing;

    return this.prisma.subscription.create({
      data: { userId, plan: SUBSCRIPTION_PLANS.free, status: 'active' },
    });
  }

  private isPremiumPlan(plan: string, status: string): boolean {
    return plan === SUBSCRIPTION_PLANS.premium && status === 'active';
  }

  private async getMonthlyUsage(userId: string) {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [skinThisMonth, outfitThisMonth] = await Promise.all([
      this.prisma.skinAnalysis.count({
        where: { userId, createdAt: { gte: startOfMonth } },
      }),
      this.prisma.outfitAnalysis.count({
        where: { userId, createdAt: { gte: startOfMonth } },
      }),
    ]);

    return {
      skinThisMonth,
      outfitThisMonth,
      skinRemaining: Math.max(0, FREE_TIER_LIMITS.skinAnalysisPerMonth - skinThisMonth),
      outfitRemaining: Math.max(
        0,
        FREE_TIER_LIMITS.outfitAnalysisPerMonth - outfitThisMonth,
      ),
    };
  }
}
