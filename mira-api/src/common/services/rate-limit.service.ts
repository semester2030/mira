import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../redis/redis.service';

@Injectable()
export class RateLimitService {
  constructor(
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {}

  async assertWithinLimit(userId: string, action: string): Promise<void> {
    const limit = this.config.get<number>('RATE_LIMIT_PER_HOUR', 30);
    const key = `rate:${action}:${userId}`;
    const count = await this.redis.incrementRateLimit(key, 3600);

    if (count > limit) {
      throw new HttpException(
        'تم تجاوز حد التحليلات المسموح. حاولي لاحقاً.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }
}
