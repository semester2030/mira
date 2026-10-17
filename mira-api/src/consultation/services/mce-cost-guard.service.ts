import {
  HttpException,
  HttpStatus,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import {
  RedisCriticalControlUnavailableError,
  RedisService,
} from '../../redis/redis.service';
import { MceAssistantPayloadV1 } from '../contracts/mce-context-snapshot.v1';

export const ANSWER_CACHE_KEY_VERSION = 'v2';

export interface AnswerCacheContext {
  userId: string;
  sessionId: string;
  question: string;
  snapshotId: string;
  snapshot: unknown;
  factRegistry: unknown;
  history: Array<{ role: string; content: string }>;
  rollingSummary: string | null;
}

export function buildAnswerCacheKey(ctx: AnswerCacheContext): string | null {
  const question = ctx.question.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!ctx.userId || !ctx.sessionId || !question || !ctx.snapshotId || ctx.snapshot == null || ctx.history == null) {
    return null;
  }
  const material = JSON.stringify({
    v: ANSWER_CACHE_KEY_VERSION,
    userId: ctx.userId,
    sessionId: ctx.sessionId,
    question,
    snapshotId: ctx.snapshotId,
    snapshot: ctx.snapshot,
    facts: ctx.factRegistry ?? [],
    history: ctx.history.map((row) => ({ role: row.role, content: row.content })),
    rollingSummary: ctx.rollingSummary ?? '',
  });
  const digest = createHash('sha256').update(material).digest('hex');
  return `mce:faq:${ANSWER_CACHE_KEY_VERSION}:${digest}`;
}

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
    let count: number;
    try {
      count = await this.redis.incrementRateLimit(key, 86_400);
    } catch (error) {
      if (error instanceof RedisCriticalControlUnavailableError) {
        throw new ServiceUnavailableException({
          code: 'MCE_QUOTA_UNAVAILABLE',
          message:
            'تعذر التحقق من حصة الاستشارة بأمان. حاولي مرة أخرى لاحقاً.',
          messageEn:
            'Consultation quota protection is unavailable. Try again later.',
        });
      }
      throw error;
    }

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

  answerCacheKey(ctx: AnswerCacheContext): string | null {
    return buildAnswerCacheKey(ctx);
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
