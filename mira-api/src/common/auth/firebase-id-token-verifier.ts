import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

export type VerifiedFirebaseIdentity = {
  uid: string;
  email?: string;
  name?: string;
};

/** External Firebase check. Tests replace this provider only; the guard stays the runtime guard. */
export abstract class FirebaseIdTokenVerifier {
  abstract verify(token: string): Promise<VerifiedFirebaseIdentity>;
}

@Injectable()
export class FirebaseAdminIdTokenVerifier extends FirebaseIdTokenVerifier {
  private initialized = false;

  constructor(private readonly config: ConfigService) {
    super();
  }

  private env(key: string): string | undefined {
    return this.config?.get<string>(key) ?? process.env[key];
  }

  private ensureFirebase(): void {
    if (this.initialized || admin.apps.length > 0) {
      this.initialized = true;
      return;
    }
    const projectId = this.env('FIREBASE_PROJECT_ID');
    if (!projectId) {
      throw new UnauthorizedException('Firebase is not configured on the server');
    }
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId,
    });
    this.initialized = true;
  }

  async verify(token: string): Promise<VerifiedFirebaseIdentity> {
    this.ensureFirebase();
    try {
      const decoded = await admin.auth().verifyIdToken(token);
      return { uid: decoded.uid, email: decoded.email, name: decoded.name };
    } catch {
      throw new UnauthorizedException('Invalid or expired Firebase token');
    }
  }
}
