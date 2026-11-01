#!/usr/bin/env node
/**
 * Read-only production catalog media audit.
 * Requires DATABASE_URL and (for object presence) MIRA_MEDIA_S3_* when store=s3.
 * Does not print secrets. Writes JSON to stdout.
 *
 * Usage:
 *   node scripts/audit-catalog-media.cjs > catalog-media-audit.json
 */
'use strict';

const { PrismaClient } = require('@prisma/client');
const {
  S3Client,
  HeadObjectCommand,
  ListObjectsV2Command,
} = require('@aws-sdk/client-s3');

function env(name) {
  return (process.env[name] || '').trim();
}

function redactEndpoint(value) {
  if (!value) return null;
  try {
    const u = new URL(value);
    return `${u.protocol}//${u.host}`;
  } catch {
    return '(invalid-endpoint)';
  }
}

async function listAllKeys(client, bucket) {
  const keys = new Map();
  let token;
  do {
    const out = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        ContinuationToken: token,
        MaxKeys: 1000,
      }),
    );
    for (const obj of out.Contents || []) {
      if (obj.Key) keys.set(obj.Key, { size: obj.Size ?? null, lastModified: obj.LastModified || null });
    }
    token = out.IsTruncated ? out.NextContinuationToken : undefined;
  } while (token);
  return keys;
}

async function main() {
  const store = env('MIRA_MEDIA_STORE').toLowerCase() || '(unset)';
  const bucket = env('MIRA_MEDIA_S3_BUCKET');
  const region = env('MIRA_MEDIA_S3_REGION') || 'auto';
  const endpoint = env('MIRA_MEDIA_S3_ENDPOINT');
  const accessKeyId = env('MIRA_MEDIA_S3_ACCESS_KEY_ID');
  const secretAccessKey = env('MIRA_MEDIA_S3_SECRET_ACCESS_KEY');

  const prisma = new PrismaClient();
  const rows = await prisma.catalogMedia.findMany({
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      ownerKind: true,
      ownerId: true,
      storageKey: true,
      mimeType: true,
      byteSize: true,
      publication: true,
      active: true,
      placement: true,
      kind: true,
      createdAt: true,
    },
  });

  let objectIndex = null;
  let bucketAccess = { ok: false, reason: 'not-attempted' };
  if (store === 's3' && bucket && accessKeyId && secretAccessKey) {
    const client = new S3Client({
      region,
      endpoint: endpoint || undefined,
      forcePathStyle: Boolean(endpoint),
      credentials: { accessKeyId, secretAccessKey },
      maxAttempts: 2,
    });
    try {
      objectIndex = await listAllKeys(client, bucket);
      bucketAccess = { ok: true, objectCount: objectIndex.size };
    } catch (error) {
      const name = error?.name || '';
      const status = error?.$metadata?.httpStatusCode;
      if (status === 403 || name === 'AccessDenied') {
        bucketAccess = { ok: false, reason: 'permission', status };
      } else if (status === 404 || name === 'NoSuchBucket') {
        bucketAccess = { ok: false, reason: 'wrong-bucket', status };
      } else {
        bucketAccess = { ok: false, reason: 'connection', name, status };
      }
    } finally {
      client.destroy();
    }
  } else if (store === 's3') {
    bucketAccess = { ok: false, reason: 'incomplete-credentials' };
  }

  const media = [];
  let present = 0;
  let missing = 0;
  let unknown = 0;
  for (const row of rows) {
    const key = row.storageKey || '';
    let objectPresence = 'unknown';
    let actualSize = null;
    if (objectIndex) {
      if (objectIndex.has(key)) {
        objectPresence = 'present';
        actualSize = objectIndex.get(key).size;
        present += 1;
      } else if (bucketAccess.ok) {
        objectPresence = 'missing';
        missing += 1;
      } else {
        unknown += 1;
      }
    } else {
      unknown += 1;
    }
    const sizeMatch =
      actualSize == null || row.byteSize == null
        ? null
        : Number(actualSize) === Number(row.byteSize);

    media.push({
      mediaId: row.id,
      ownerKind: row.ownerKind,
      ownerId: row.ownerId,
      storageKey: key,
      bucket: bucket || null,
      objectPresence,
      expectedBytes: row.byteSize,
      actualBytes: actualSize,
      sizeMatch,
      mimeType: row.mimeType,
      publication: row.publication,
      active: row.active,
      placement: row.placement,
      kind: row.kind,
      createdAt: row.createdAt,
    });
  }

  const orphanKeys = [];
  if (objectIndex) {
    const used = new Set(rows.map((r) => r.storageKey).filter(Boolean));
    for (const [key, meta] of objectIndex.entries()) {
      if (!used.has(key)) orphanKeys.push({ key, size: meta.size });
    }
  }

  const report = {
    asOf: new Date().toISOString(),
    store,
    bucket: bucket || null,
    endpointHost: redactEndpoint(endpoint),
    region,
    bucketAccess,
    db: {
      mediaTotal: rows.length,
      published: rows.filter((r) => r.publication === 'published').length,
      video: rows.filter((r) => (r.mimeType || '').startsWith('video/')).length,
      image: rows.filter((r) => (r.mimeType || '').startsWith('image/')).length,
      productOwners: new Set(rows.filter((r) => r.ownerKind === 'product').map((r) => r.ownerId)).size,
      serviceOwners: new Set(rows.filter((r) => r.ownerKind === 'service').map((r) => r.ownerId)).size,
    },
    objectJoin: {
      present,
      missing,
      unknown,
      orphanObjectCount: orphanKeys.length,
    },
    media,
    orphanObjects: orphanKeys,
    needsReupload: media.filter((m) => m.objectPresence === 'missing'),
  };

  await prisma.$disconnect();
  process.stdout.write(`${JSON.stringify(report)}\n`);
}

main().catch(async (error) => {
  console.error(JSON.stringify({ error: String(error?.message || error) }));
  process.exit(1);
});
