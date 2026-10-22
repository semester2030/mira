import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
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
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private readonly enabled: boolean;
  private readonly url: string;
  private connectAttempt: Promise<Redis | null> | null = null;

  constructor(private readonly config: ConfigService) {
    this.url = this.config.get<string>('REDIS_URL', '')?.trim() ?? '';
    this.enabled = this.url.length > 0;
  }

  async onModuleInit(): Promise<void> {
    if (!this.enabled) return;
    await this.ensureClient();
  }

  protected async ensureClient(): Promise<Redis | null> {
    if (!this.enabled) return null;
    if (this.client?.status === 'ready') return this.client;
    if (this.connectAttempt) return this.connectAttempt;

    this.connectAttempt = (async () => {
      try {
        if (this.client) {
          try {
            this.client.disconnect();
          } catch {
            /* ignore */
          }
          this.client = null;
        }
        const client = new Redis(this.url, {
          maxRetriesPerRequest: 2,
          enableReadyCheck: true,
          lazyConnect: true,
          connectTimeout: 8000,
          retryStrategy: (times) => (times > 4 ? null : Math.min(times * 200, 1000)),
        });
        client.on('error', (err) => {
          this.logger.warn(`Redis error: ${err.message}`);
        });
        await client.connect();
        await client.ping();
        this.client = client;
        this.logger.log('Redis critical controls connected');
        return client;
      } catch (err) {
        this.logger.error(`Redis connect failed: ${(err as Error).message}`);
        this.client = null;
        return null;
      } finally {
        this.connectAttempt = null;
      }
    })();

    return this.connectAttempt;
  }

  /** Sync peek for health — prefer ready client; otherwise report DEGRADED while configured. */
  protected getClient(): Redis | null {
    if (!this.enabled) return null;
    if (this.client?.status === 'ready') return this.client;
    void this.ensureClient();
    return this.client?.status === 'ready' ? this.client : null;
  }

  async incrementRateLimit(key: string, windowSeconds: number): Promise<number> {
    const redis = await this.ensureClient();
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
      this.client = null;
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
    const redis = await this.ensureClient();
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
    const redis = await this.ensureClient();
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
