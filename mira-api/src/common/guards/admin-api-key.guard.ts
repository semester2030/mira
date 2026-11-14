import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { AdminRole, loadAdminStaff, resolveAdminSession } from '../admin-staff';

export type AdminRequest = Request & {
  adminActorId: string;
  adminRole: AdminRole;
  adminCanMutate: boolean;
  adminAuthSource: 'staff-secret' | 'shared-key';
};

@Injectable()
export class AdminApiKeyGuard implements CanActivate {
  constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const master = (this.config?.get<string>('ADMIN_API_KEY') ?? process.env.ADMIN_API_KEY)?.trim();
    if (!master) {
      throw new UnauthorizedException('Admin API key is not configured');
    }
    const request = context.switchToHttp().getRequest<AdminRequest>();
    const key = request.headers['x-admin-key'];
    if (typeof key !== 'string' || !key.trim()) {
      throw new UnauthorizedException('Invalid admin key');
    }
    const actorHeader = request.headers['x-admin-actor'];
    const session = resolveAdminSession({
      key: key.trim(),
      actorHeader: typeof actorHeader === 'string' ? actorHeader : null,
      masterKey: master,
      staff: loadAdminStaff(process.env),
    });
    if (!session) {
      throw new UnauthorizedException('Invalid admin key');
    }
    request.adminActorId = session.actorId;
    request.adminRole = session.role;
    request.adminCanMutate = session.canMutate;
    request.adminAuthSource = session.source;
    return true;
  }
}
