import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private readonly enabled: boolean;

  constructor(private readonly config: ConfigService) {
    this.enabled = Boolean(this.config.get<string>('REDIS_URL')?.trim());
  }

  private getClient(): Redis | null {
    if (!this.enabled) return null;
    if (!this.client) {
      const url = this.config.get<string>('REDIS_URL', 'redis://localhost:6379');
      this.client = new Redis(url, { maxRetriesPerRequest: 1, lazyConnect: true });
      this.client.connect().catch((err) => {
        this.logger.warn(`Redis unavailable: ${err.message}`);
        this.client = null;
      });
    }
    return this.client;
  }

  async incrementRateLimit(key: string, windowSeconds: number): Promise<number> {
    const redis = this.getClient();
    if (!redis) return 0;

    try {
      const count = await redis.incr(key);
      if (count === 1) {
        await redis.expire(key, windowSeconds);
      }
      return count;
    } catch (err) {
      this.logger.warn(`Rate limit skipped: ${(err as Error).message}`);
      return 0;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.client?.quit();
  }
}
