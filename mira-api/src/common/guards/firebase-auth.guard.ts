import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import * as admin from 'firebase-admin';
import { RequestUser } from '../interfaces/request-user.interface';

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  private initialized = false;

  constructor(private readonly config: ConfigService) {}

  private ensureFirebase(): void {
    if (this.initialized || admin.apps.length > 0) {
      this.initialized = true;
      return;
    }

    const projectId = this.config.get<string>('FIREBASE_PROJECT_ID');
    if (!projectId) {
      throw new UnauthorizedException('Firebase is not configured on the server');
    }

    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId,
    });
    this.initialized = true;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.config.get<string>('AUTH_SKIP') === 'true') {
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

    this.ensureFirebase();

    try {
      const decoded = await admin.auth().verifyIdToken(token);
      (request as Request & { user: RequestUser }).user = {
        firebaseUid: decoded.uid,
        email: decoded.email,
        name: decoded.name,
      };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired Firebase token');
    }
  }
}
