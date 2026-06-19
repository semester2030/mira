import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class AdminApiKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.config.get<string>('ADMIN_API_KEY')?.trim();
    if (!expected) {
      throw new UnauthorizedException('Admin API key is not configured');
    }
    const request = context.switchToHttp().getRequest<Request>();
    const key = request.headers['x-admin-key'];
    if (typeof key !== 'string' || key !== expected) {
      throw new UnauthorizedException('Invalid admin key');
    }
    return true;
  }
}
