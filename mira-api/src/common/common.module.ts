import { Global, Module } from '@nestjs/common';
import { FirebaseAdminIdTokenVerifier, FirebaseIdTokenVerifier } from './auth/firebase-id-token-verifier';
import { RateLimitService } from './services/rate-limit.service';

@Global()
@Module({
  providers: [
    RateLimitService,
    { provide: FirebaseIdTokenVerifier, useClass: FirebaseAdminIdTokenVerifier },
  ],
  exports: [RateLimitService, FirebaseIdTokenVerifier],
})
export class CommonModule {}
