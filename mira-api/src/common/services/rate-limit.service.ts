import {
  HttpException,
  HttpStatus,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  RedisCriticalControlUnavailableError,
  RedisService,
} from '../../redis/redis.service';

@Injectable()
export class RateLimitService {
  constructor(
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {}

  async assertWithinLimit(userId: string, action: string): Promise<void> {
    const limit = this.config.get<number>('RATE_LIMIT_PER_HOUR', 30);
    const key = `rate:${action}:${userId}`;
    let count: number;
    try {
      count = await this.redis.incrementRateLimit(key, 3600);
    } catch (error) {
      if (error instanceof RedisCriticalControlUnavailableError) {
        throw new ServiceUnavailableException({
          code: 'RATE_LIMIT_UNAVAILABLE',
          message:
            'تعذر التحقق من حد الاستخدام بأمان. حاولي مرة أخرى لاحقاً.',
          messageEn:
            'Usage protection is temporarily unavailable. Try again later.',
        });
      }
      throw error;
    }

    if (count > limit) {
      throw new HttpException(
        'تم تجاوز حد التحليلات المسموح. حاولي لاحقاً.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }
}
