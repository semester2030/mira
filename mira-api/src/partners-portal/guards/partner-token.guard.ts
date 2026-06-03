import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';

export type PartnerRequest = Request & {
  partnerUser: { id: string; partnerId: string; email: string };
};

@Injectable()
export class PartnerTokenGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<PartnerRequest>();
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing partner token');
    }
    const token = header.slice(7).trim();
    const user = await this.prisma.partnerUser.findUnique({
      where: { accessToken: token },
      include: { partner: true },
    });
    if (!user || user.partner.status !== 'active') {
      throw new UnauthorizedException('Invalid or inactive partner token');
    }
    request.partnerUser = {
      id: user.id,
      partnerId: user.partnerId,
      email: user.email,
    };
    return true;
  }
}
