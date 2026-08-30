import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export class RedisCriticalControlUnavailableError extends Error {
  constructor(message = 'Critical Redis control is unavailable') {
    super(message);
    this.name = 'RedisCriticalControlUnavailableError';
  }
}

export type RedisRuntimeState = 'AVAILABLE' | 'DEGRADED' | 'UNAVAILABLE';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private readonly enabled: boolean;

  constructor(private readonly config: ConfigService) {
    this.enabled = Boolean(this.config.get<string>('REDIS_URL')?.trim());
  }

  protected getClient(): Redis | null {
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
    if (!redis) {
      throw new RedisCriticalControlUnavailableError(
        'Critical Redis counter is not configured',
      );
    }

    try {
      const count = await redis.incr(key);
      if (count === 1) {
        await redis.expire(key, windowSeconds);
      }
      return count;
    } catch (err) {
      this.logger.error(
        `Critical Redis counter failed: ${(err as Error).message}`,
      );
      throw new RedisCriticalControlUnavailableError();
    }
  }

  runtimeStatus(): {
    configured: boolean;
    state: RedisRuntimeState;
    criticalControls: 'fail_closed';
    optionalCache: 'fail_open';
  } {
    const state: RedisRuntimeState = !this.enabled
      ? 'UNAVAILABLE'
      : this.client?.status === 'ready'
        ? 'AVAILABLE'
        : 'DEGRADED';
    return {
      configured: this.enabled,
      state,
      criticalControls: 'fail_closed',
      optionalCache: 'fail_open',
    };
  }

  async getJson<T>(key: string): Promise<T | null> {
    const redis = this.getClient();
    if (!redis) return null;
    try {
      const raw = await redis.get(key);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch (err) {
      this.logger.warn(`Redis get skipped: ${(err as Error).message}`);
      return null;
    }
  }

  async setJson(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    const redis = this.getClient();
    if (!redis) return;
    try {
      await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (err) {
      this.logger.warn(`Redis set skipped: ${(err as Error).message}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.client?.quit();
  }
}
