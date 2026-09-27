import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { FirebaseIdTokenVerifier } from '../auth/firebase-id-token-verifier';
import { RequestUser } from '../interfaces/request-user.interface';

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  constructor(
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(FirebaseIdTokenVerifier) private readonly verifier: FirebaseIdTokenVerifier,
  ) {}

  private env(key: string): string | undefined {
    return this.config?.get<string>(key) ?? process.env[key];
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.env('AUTH_SKIP') === 'true') {
      const request = context.switchToHttp().getRequest<Request>();
      (request as Request & { user: RequestUser }).user = {
        firebaseUid: 'dev-user',
        email: 'dev@mira.local',
        name: 'Dev User',
      };
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing Authorization Bearer token');
    }
    const token = header.slice(7).trim();
    if (!token) {
      throw new UnauthorizedException('Invalid token');
    }

    const identity = await this.verifier.verify(token);
    (request as Request & { user: RequestUser }).user = {
      firebaseUid: identity.uid,
      email: identity.email,
      name: identity.name,
    };
    return true;
  }
}
