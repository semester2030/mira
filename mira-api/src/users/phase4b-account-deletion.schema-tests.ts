import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { UsersService } from './users.service';

type DeleteOutcome = 'success' | 'not-found' | 'unavailable' | 'throws';

const authUser: RequestUser = {
  firebaseUid: 'technical-current-user',
  email: 'technical@example.invalid',
};

function fixture(options?: {
  userExists?: boolean;
  dbDeleteFails?: boolean;
  firebaseOutcome?: DeleteOutcome;
}) {
  const calls = {
    audit: 0,
    databaseDelete: 0,
    firebaseDelete: 0,
    firebaseUid: '',
  };
  const prisma = {
    user: {
      findUnique: async () =>
        options?.userExists === false
          ? null
          : {
              id: 'db-user-1',
              firebaseUid: authUser.firebaseUid,
              email: authUser.email,
            },
      delete: async () => {
        calls.databaseDelete += 1;
        if (options?.dbDeleteFails) throw new Error('controlled db failure');
      },
    },
    auditLog: {
      create: async () => {
        calls.audit += 1;
      },
    },
  } as unknown as PrismaService;

  class TestUsersService extends UsersService {
    protected override async deleteFirebaseUser(uid: string): Promise<void> {
      calls.firebaseDelete += 1;
      calls.firebaseUid = uid;
      switch (options?.firebaseOutcome ?? 'success') {
        case 'not-found':
          throw { code: 'auth/user-not-found' };
        case 'unavailable':
          throw { code: 'app/invalid-credential', detail: '/private/path' };
        case 'throws':
          throw new Error('credential secret must not escape');
        default:
          return;
      }
    }
  }

  const config = {
    get: <T>(key: string, fallback?: T): T | undefined =>
      (key === 'AUTH_SKIP' ? 'false' : fallback) as T | undefined,
  } as ConfigService;
  return { service: new TestUsersService(prisma, config), calls };
}

async function expectSafe503(promise: Promise<void>): Promise<void> {
  await assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof ServiceUnavailableException);
    assert.equal(error.getStatus(), 503);
    const response = error.getResponse() as Record<string, unknown>;
    assert.equal(response.code, 'ACCOUNT_IDENTITY_DELETE_FAILED');
    const serialized = JSON.stringify(response);
    assert.doesNotMatch(serialized, /private|credential|firebase-sa|technical-current-user/i);
    return true;
  });
}

async function main(): Promise<void> {
  {
    const { service, calls } = fixture();
    await service.deleteAccount(authUser);
    assert.deepEqual(calls, {
      audit: 1,
      databaseDelete: 1,
      firebaseDelete: 1,
      firebaseUid: authUser.firebaseUid,
    });
  }

  {
    const { service, calls } = fixture({
      userExists: false,
      firebaseOutcome: 'not-found',
    });
    await service.deleteAccount(authUser);
    assert.equal(calls.databaseDelete, 0);
    assert.equal(calls.firebaseDelete, 1);
  }

  for (const firebaseOutcome of ['unavailable', 'throws'] as const) {
    const { service, calls } = fixture({
      userExists: false,
      firebaseOutcome,
    });
    await expectSafe503(service.deleteAccount(authUser));
    assert.equal(calls.firebaseDelete, 1);
  }

  {
    const { service, calls } = fixture({ dbDeleteFails: true });
    await assert.rejects(
      service.deleteAccount(authUser),
      /controlled db failure/,
    );
    assert.equal(calls.firebaseDelete, 0);
  }

  const controllerSource = readFileSync(
    join(process.cwd(), 'src/users/users.controller.ts'),
    'utf8',
  );
  assert.match(controllerSource, /@UseGuards\(FirebaseAuthGuard\)/);
  assert.match(controllerSource, /@CurrentUser\(\)\s+authUser/);
  assert.match(controllerSource, /deleteAccount\(authUser\)/);
  const deleteRouteSource = controllerSource.slice(
    controllerSource.indexOf("@Delete('me')"),
  );
  assert.doesNotMatch(deleteRouteSource, /@Body\(|@Param\(/);

  console.log('phase4b-account-deletion: PASS (7 checks, false success = 0)');
}

void main();
