# Phase 3B — Firebase Avatar Contract Verification

## Implemented

- Flutter writes only `avatars/{uid}/avatar`.
- Upload metadata is explicitly JPEG, PNG or WebP based on the selected path.
- Client rejects unsupported formats and objects over 5 MiB.
- Storage rules match the exact canonical object, require authentication,
  require `request.auth.uid == userId`, and enforce the same type/size limits.
- Skin scan storage remains denied.
- No legacy object is deleted and no legacy write permission is added.

## Verification

`flutter test test/firebase_avatar_storage_contract_test.dart`: 4 PASS.

Firebase emulator validation used an isolated `demo-mira` project with Auth and
Storage emulators only:

```text
npx --yes firebase-tools@14 emulators:exec \
  --config firebase.phase3b.json --only auth,storage --project demo-mira \
  "python3 scripts/test_avatar_storage_rules.py"
firebase-avatar-storage-rules: PASS (7 adversarial cases)
```

Verified: owner valid write, authenticated read, unauthenticated read denial,
cross-user write denial, unauthenticated write denial, flat legacy-path denial,
invalid MIME denial and oversize denial. No production Firebase service or user
object was touched.

The installed Firebase CLI 15 requires Java 21 while the workstation has Java
17, so the isolated test intentionally pins CLI major 14. The run also emitted
a non-blocking Node 25 engine warning; emulator tests completed successfully.

## Verdict

`PASS — CLIENT/RULES CONTRACT CONSISTENT`

Deployment of rules and a real authenticated upload are not claimed; verify in
Phase 3C.
