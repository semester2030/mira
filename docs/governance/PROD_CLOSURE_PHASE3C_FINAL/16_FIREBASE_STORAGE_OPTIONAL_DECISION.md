# Phase 3C Final — Firebase Storage Optional Decision

Date: 2026-08-31
Source: `4b2c78ac42fef38dc0012a35ba6879ae4d6a4a74`
Mode: architecture truth + owner decision. No Blaze, bucket, or rules deploy.

## Owner architecture decision

Firebase Storage is formally classified:

`FIREBASE_STORAGE_OPTIONAL`

`OPTIONAL_PROFILE_CAPABILITY`

`DEFERRED_PRODUCT_WORK`

`NON_LAUNCH_CRITICAL`

`PHASE 3C BLOCKER = NO`

## Why it exists

The only live runtime caller is Flutter profile avatar:

`EditProfileScreen` → `ProfileBloc` → `ProfileRepositoryImpl.updateAvatar`
→ `ProfileRemoteDataSourceImpl.uploadAvatar`
→ `FirebaseStorage.ref('avatars/{uid}/avatar').putFile`

That is client-direct upload (architecture A). NestJS does not call
`admin.storage()` or any bucket API. Auth uses Firebase Auth only.

## Why it is not launch-critical

Skin, Face and Fashion images go `Flutter → NestJS multipart memory → provider`
then JSON results in PostgreSQL. Perfect uses a temporary YouCam file/S3 upload
owned by the vendor, not Firebase. FASHN, Advisor, Redis and Postgres do not
depend on a Firebase bucket.

Historical investigation (0 Storage releases, 0 buckets, Blaze required to
create a default bucket) remains true and is preserved. It is no longer a
Phase 3C Final PASS gate.

`3CF-06` is retained as historical evidence and reclassified out of the
launch-critical gate.

Future avatar, if productized, should be `Flutter → NestJS → object storage`.
That work is deferred. It is not Production Closure.
