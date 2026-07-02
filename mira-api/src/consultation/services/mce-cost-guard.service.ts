import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { RedisService } from '../../redis/redis.service';
import { MceAssistantPayloadV1 } from '../contracts/mce-context-snapshot.v1';

const PLAN_DAILY_LIMITS: Record<string, number> = {
  free: 10,
  premium: 100,
};

@Injectable()
export class MceCostGuardService {
  constructor(
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {}

  dailyLimit(planTier: string): number {
    const override = this.config.get<number>('MCE_DAILY_LIMIT');
    if (override && override > 0) return override;
    return PLAN_DAILY_LIMITS[planTier] ?? PLAN_DAILY_LIMITS.free;
  }

  async assertDailyQuota(userId: string, planTier: string): Promise<void> {
    const limit = this.dailyLimit(planTier);
    const day = new Date().toISOString().slice(0, 10);
    const key = `mce:daily:${userId}:${day}`;
    const count = await this.redis.incrementRateLimit(key, 86_400);

    if (count > limit) {
      throw new HttpException(
        {
          code: 'MCE_DAILY_LIMIT',
          message:
            planTier === 'premium'
              ? 'وصلتِ للحد اليومي للاستشارة. حاولي غداً.'
              : 'وصلتِ لحد الاستشارة المجانية اليوم. ترقّي لبريميوم أو حاولي غداً.',
          limit,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  faqCacheKey(message: string, contentHash: string): string {
    const normalized = message.trim().toLowerCase().replace(/\s+/g, ' ');
    const digest = createHash('sha256')
      .update(`${contentHash}:${normalized}`)
      .digest('hex')
      .slice(0, 24);
    return `mce:faq:${digest}`;
  }

  async getFaqCache(key: string): Promise<MceAssistantPayloadV1 | null> {
    if (this.config.get<string>('MCE_FAQ_CACHE', 'true') === 'false') return null;
    return this.redis.getJson<MceAssistantPayloadV1>(key);
  }

  async setFaqCache(key: string, payload: MceAssistantPayloadV1): Promise<void> {
    if (payload.blocked) return;
    const ttl = this.config.get<number>('MCE_FAQ_CACHE_TTL_SEC', 604_800);
    await this.redis.setJson(key, payload, ttl);
  }
}
