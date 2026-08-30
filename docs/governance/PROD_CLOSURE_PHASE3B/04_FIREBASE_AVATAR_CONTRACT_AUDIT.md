# Phase 3B — Firebase Avatar Contract Audit

Trace: `EditProfileScreen` → `ProfileBloc` → `ProfileRepositoryImpl` →
`ProfileRemoteDataSourceImpl.uploadAvatar` → Firebase Storage download URL →
Firestore `users/{uid}.avatarUrl` → `NetworkImage`.

Finding confirmed:

- client writes `avatars/{uid}.jpg`;
- rules match `avatars/{userId}/{fileName}`;
- the flat write does not match and is implicitly denied when committed rules
  are deployed.

Current rules enforce authentication and owner write, but do not enforce object
size or content type. Reads are intentionally available to authenticated users.
No backend avatar path exists.

## Canonical contract

- object path: `avatars/{uid}/avatar`;
- write: authenticated owner only;
- read: authenticated users, preserving current read policy;
- maximum size: 5 MiB in client and rules;
- allowed types: JPEG, PNG, WebP;
- client sets explicit Storage content type;
- unsupported extensions fail before upload.

No legacy object is deleted. Existing Firestore download URLs remain valid and
continue to display independently of the new object path. A permissive legacy
write rule is not added because no current code needs SDK writes to the old
flat path.

Firebase emulator/rules-unit infrastructure is absent from the repository.
Phase 3B will add local source-contract tests and will not claim production
rules deployment or a real Firebase upload; those remain Phase 3C.
