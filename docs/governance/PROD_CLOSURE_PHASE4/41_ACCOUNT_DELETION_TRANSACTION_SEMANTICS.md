# Account Deletion Transaction Semantics

Route: `DELETE /api/v1/users/me`

Flow:

1. `FirebaseAuthGuard` derives the current Firebase UID from the bearer token.
2. `UsersController.deleteMe` passes only that authenticated identity.
3. `UsersService.deleteAccount` looks up the matching PostgreSQL user.
4. If present, it writes the deletion audit and deletes the user row; cascades
   remove related profile/subscription records.
5. It calls Firebase Admin Auth `deleteUser(uid)`.
6. The controller returns 204 only when the service resolves.

Before remediation, step 5 errors were logged and swallowed. PostgreSQL could
be deleted while Firebase Auth remained active, producing false success.

Required invariant:

- Admin unavailable or `deleteUser` failure: sanitized 503, never 204.
- `auth/user-not-found`: identity objective already satisfied; idempotent
  success.
- PostgreSQL cleanup failure: propagates; Firebase deletion is not attempted.
- PostgreSQL already absent: Firebase deletion is still attempted, allowing a
  partial prior attempt to be retried safely.

The endpoint accepts no target UID in body or path, so it cannot delete a
different user.
