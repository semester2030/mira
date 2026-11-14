import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

export type AdminRequest = Request & {
  adminActorId: string;
};

function sanitizeAdminActorId(raw: unknown): string {
  if (typeof raw !== 'string') return 'admin-key';
  const trimmed = raw.trim();
  // Optional staff id for attribution. Shared key alone stays "admin-key".
  if (!/^[A-Za-z0-9_.:@-]{2,64}$/.test(trimmed)) return 'admin-key';
  return trimmed;
}

@Injectable()
export class AdminApiKeyGuard implements CanActivate {
  constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = (this.config?.get<string>('ADMIN_API_KEY') ?? process.env.ADMIN_API_KEY)?.trim();
    if (!expected) {
      throw new UnauthorizedException('Admin API key is not configured');
    }
    const request = context.switchToHttp().getRequest<AdminRequest>();
    const key = request.headers['x-admin-key'];
    if (typeof key !== 'string' || key !== expected) {
      throw new UnauthorizedException('Invalid admin key');
    }
    request.adminActorId = sanitizeAdminActorId(request.headers['x-admin-actor']);
    return true;
  }
}
