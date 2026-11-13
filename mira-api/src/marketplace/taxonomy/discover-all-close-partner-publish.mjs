/**
 * Partner-editor publish path for Discover «الكل» closure.
 * Creates brand+salon partners, materializes drafts, uploads real mp4 bytes,
 * submits review, admin-approves. Does NOT write contentStatus/publication via Prisma.
 *
 * Usage (from mira-api):
 *   node --env-file=.env.jamalak-test src/marketplace/taxonomy/discover-all-close-partner-publish.mjs
 */
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

const __dirname = dirname(fileURLToPath(import.meta.url));
const API = (process.env.MIRA_API_BASE || `http://127.0.0.1:${process.env.PORT || 3011}/api/v1`).replace(
  /\/$/,
  '',
);
const ADMIN = process.env.ADMIN_API_KEY || 'jamalak-test-admin';
const runId = `all-close-${Date.now().toString(36)}-${randomUUID().slice(0, 4)}`;
const evidenceDir = join(__dirname, '../../../../docs/jamalak-dual-reg/evidence', runId);
const fixtureMp4 = join(
  __dirname,
  '../../partners-portal/upload-sessions/fixtures/valid-short.mp4',
);
const fixturePng = join(
  __dirname,
  '../../partners-portal/upload-sessions/fixtures/valid.png',
);

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function json(res) {
  const text = await res.text();
  try {
    return { status: res.status, body: JSON.parse(text), text };
  } catch {
    return { status: res.status, body: null, text };
  }
}

async function main() {
  assert(existsSync(fixtureMp4), `missing fixture ${fixtureMp4}`);
  assert(existsSync(fixturePng), `missing fixture ${fixturePng}`);
  const mp4 = readFileSync(fixtureMp4);
  const png = readFileSync(fixturePng);
  const mp4B64 = mp4.toString('base64');
  const pngB64 = png.toString('base64');
  const mp4Sha = createHash('sha256').update(mp4).digest('hex');
  assert(mp4.length > 500, 'fixture too small');

  mkdirSync(evidenceDir, { recursive: true });
  const prisma = new PrismaClient();
  const suffix = runId.slice(-12);

  const brand = await prisma.partner.create({
    data: {
      type: 'brand',
      status: 'active',
      nameAr: `علامة إغلاق الكل ${suffix}`,
      nameEn: `all-close-brand-${suffix}`,
      city: 'جدة',
    },
  });
  const salon = await prisma.partner.create({
    data: {
      type: 'salon',
      status: 'active',
      nameAr: `صالون إغلاق الكل ${suffix}`,
      nameEn: `all-close-salon-${suffix}`,
      city: 'جدة',
    },
  });
  const brandToken = `tok-brand-${suffix}-${randomUUID().slice(0, 8)}`;
  const salonToken = `tok-salon-${suffix}-${randomUUID().slice(0, 8)}`;
  await prisma.partnerUser.create({
    data: {
      partnerId: brand.id,
      email: `brand.${suffix}@all-close.local`,
      accessToken: brandToken,
    },
  });
  await prisma.partnerUser.create({
    data: {
      partnerId: salon.id,
      email: `salon.${suffix}@all-close.local`,
      accessToken: salonToken,
    },
  });

  const brandH = {
    authorization: `Bearer ${brandToken}`,
    'content-type': 'application/json',
  };
  const salonH = {
    authorization: `Bearer ${salonToken}`,
    'content-type': 'application/json',
  };
  const adminH = {
    'x-admin-key': ADMIN,
    'content-type': 'application/json',
  };

  async function publishProduct(opts) {
    const draftId = `draft-p-${opts.key}-${suffix}`;
    const put = await json(
      await fetch(`${API}/partners-portal/editor-drafts/${draftId}`, {
        method: 'PUT',
        headers: brandH,
        body: JSON.stringify({
          expectedRevision: null,
          kind: 'product',
          profileId: opts.profileId,
          schemaVersion: 2,
          values: {
            nameAr: opts.nameAr,
            priceHalalas: opts.priceHalalas,
            category: opts.category,
            subcategory: opts.subcategory,
            externalUrl: '',
          },
        }),
      }),
    );
    assert(put.status === 200, `product draft ${opts.key}: ${put.status} ${put.text?.slice(0, 200)}`);
    const rev = put.body.revision;
    const mat = await json(
      await fetch(`${API}/partners-portal/editor-drafts/${draftId}/materialize`, {
        method: 'POST',
        headers: { ...brandH, 'Idempotency-Key': `mat-${draftId}` },
        body: JSON.stringify({ expectedRevision: rev, submitReview: false }),
      }),
    );
    assert(
      mat.status === 200 || mat.status === 201,
      `product mat ${opts.key}: ${mat.status} ${mat.text?.slice(0, 300)}`,
    );
    const ownerId = mat.body.targetOwnerId;
    assert(ownerId, `no owner for ${opts.key}`);

    const image = await json(
      await fetch(`${API}/partners-portal/products/${ownerId}/media`, {
        method: 'POST',
        headers: brandH,
        body: JSON.stringify({ mimeType: 'image/png', dataBase64: pngB64 }),
      }),
    );
    assert(
      image.status === 200 || image.status === 201,
      `product image ${opts.key}: ${image.status} ${image.text?.slice(0, 300)}`,
    );
    const media = await json(
      await fetch(`${API}/partners-portal/products/${ownerId}/media`, {
        method: 'POST',
        headers: brandH,
        body: JSON.stringify({ mimeType: 'video/mp4', dataBase64: mp4B64 }),
      }),
    );
    assert(
      media.status === 200 || media.status === 201,
      `product media ${opts.key}: ${media.status} ${media.text?.slice(0, 300)}`,
    );
    const mediaId = media.body.id;
    assert(mediaId, `no media id ${opts.key}`);

    const submit = await json(
      await fetch(`${API}/partners-portal/products/${ownerId}/submit-review`, {
        method: 'POST',
        headers: brandH,
      }),
    );
    assert(
      submit.status === 200 || submit.status === 201,
      `product submit ${opts.key}: ${submit.status} ${submit.text?.slice(0, 300)}`,
    );

    const preview = await json(
      await fetch(`${API}/admin/catalog-reviews/product/${ownerId}`, { headers: adminH }),
    );
    const revision = preview.body?.revision ?? submit.body?.revision;
    const decide = await json(
      await fetch(`${API}/admin/catalog-reviews/product/${ownerId}/decision`, {
        method: 'POST',
        headers: adminH,
        body: JSON.stringify({ decision: 'approve', revision }),
      }),
    );
    assert(
      decide.status === 200 || decide.status === 201,
      `product approve ${opts.key}: ${decide.status} ${decide.text?.slice(0, 300)}`,
    );

    const publicMedia = await fetch(`${API}/marketplace/media/${mediaId}`);
    assert(publicMedia.status === 200, `public media ${opts.key} status=${publicMedia.status}`);
    const bytes = Buffer.from(await publicMedia.arrayBuffer());
    assert(bytes.length === mp4.length, `media bytes mismatch ${opts.key}`);

    return { offerId: ownerId, mediaId, mediaUrl: `${API}/marketplace/media/${mediaId}` };
  }

  async function publishService(opts) {
    const draftId = `draft-s-${opts.key}-${suffix}`;
    const put = await json(
      await fetch(`${API}/partners-portal/editor-drafts/${draftId}`, {
        method: 'PUT',
        headers: salonH,
        body: JSON.stringify({
          expectedRevision: null,
          kind: 'service',
          profileId: opts.profileId,
          schemaVersion: 2,
          values: {
            nameAr: opts.nameAr,
            priceHalalas: opts.priceHalalas,
            durationMin: opts.durationMin || 45,
            category: opts.category,
            subcategory: opts.subcategory,
            placeMode: opts.placeMode || 'either',
          },
        }),
      }),
    );
    assert(put.status === 200, `service draft ${opts.key}: ${put.status} ${put.text?.slice(0, 400)}`);
    const rev = put.body.revision;
    const mat = await json(
      await fetch(`${API}/partners-portal/editor-drafts/${draftId}/materialize`, {
        method: 'POST',
        headers: { ...salonH, 'Idempotency-Key': `mat-${draftId}` },
        body: JSON.stringify({ expectedRevision: rev, submitReview: false }),
      }),
    );
    assert(
      mat.status === 200 || mat.status === 201,
      `service mat ${opts.key}: ${mat.status} ${mat.text?.slice(0, 400)}`,
    );
    const ownerId = mat.body.targetOwnerId;
    assert(ownerId, `no service owner ${opts.key}`);

    const image = await json(
      await fetch(`${API}/partners-portal/services/${ownerId}/media`, {
        method: 'POST',
        headers: salonH,
        body: JSON.stringify({ mimeType: 'image/png', dataBase64: pngB64 }),
      }),
    );
    assert(
      image.status === 200 || image.status === 201,
      `service image ${opts.key}: ${image.status} ${image.text?.slice(0, 300)}`,
    );
    const media = await json(
      await fetch(`${API}/partners-portal/services/${ownerId}/media`, {
        method: 'POST',
        headers: salonH,
        body: JSON.stringify({ mimeType: 'video/mp4', dataBase64: mp4B64 }),
      }),
    );
    assert(
      media.status === 200 || media.status === 201,
      `service media ${opts.key}: ${media.status} ${media.text?.slice(0, 300)}`,
    );
    const mediaId = media.body.id;

    const submit = await json(
      await fetch(`${API}/partners-portal/services/${ownerId}/submit-review`, {
        method: 'POST',
        headers: salonH,
      }),
    );
    assert(
      submit.status === 200 || submit.status === 201,
      `service submit ${opts.key}: ${submit.status} ${submit.text?.slice(0, 300)}`,
    );

    const preview = await json(
      await fetch(`${API}/admin/catalog-reviews/service/${ownerId}`, { headers: adminH }),
    );
    const revision = preview.body?.revision ?? submit.body?.revision;
    const decide = await json(
      await fetch(`${API}/admin/catalog-reviews/service/${ownerId}/decision`, {
        method: 'POST',
        headers: adminH,
        body: JSON.stringify({ decision: 'approve', revision }),
      }),
    );
    assert(
      decide.status === 200 || decide.status === 201,
      `service approve ${opts.key}: ${decide.status} ${decide.text?.slice(0, 300)}`,
    );

    const publicMedia = await fetch(`${API}/marketplace/media/${mediaId}`);
    assert(publicMedia.status === 200, `public service media ${opts.key}`);
    return { offerId: ownerId, mediaId, mediaUrl: `${API}/marketplace/media/${mediaId}` };
  }

  const published = {};
  published.kidsClothes = await publishProduct({
    key: 'kids-clothes',
    nameAr: 'ملابس أطفال إغلاق حقيقي',
    priceHalalas: 9000,
    profileId: 'product.kids',
    category: 'children',
    subcategory: 'children.clothes',
  });
  published.kidsShoes = await publishProduct({
    key: 'kids-shoes',
    nameAr: 'أحذية أطفال إغلاق حقيقي',
    priceHalalas: 6000,
    profileId: 'product.kids',
    category: 'children',
    subcategory: 'children.shoes',
  });
  published.makeupKit = await publishProduct({
    key: 'makeup-kit',
    nameAr: 'طقم مكياج منتج خارج الأطفال',
    priceHalalas: 40000,
    profileId: 'product.face',
    category: 'face',
    subcategory: 'face.makeup_face',
  });
  published.jewelry = await publishProduct({
    key: 'jewelry-ring',
    nameAr: 'خاتم مجوهرات إغلاق',
    priceHalalas: 120000,
    profileId: 'product.jewelry',
    category: 'jewelry',
    subcategory: 'jewelry.rings',
  });
  published.gift = await publishProduct({
    key: 'gift-box',
    nameAr: 'هدية إغلاق',
    priceHalalas: 15000,
    profileId: 'product.gifts',
    category: 'gifts',
    subcategory: 'gifts.boxes',
  });
  published.eleganceDress = await publishProduct({
    key: 'elegance-evening',
    nameAr: 'فستان سهرة أناقتك إغلاق',
    priceHalalas: 35000,
    profileId: 'product.clothes',
    category: 'clothes',
    subcategory: 'clothes.evening',
  });

  published.hairColor = await publishService({
    key: 'hair-color',
    nameAr: 'صبغة إغلاق حقيقي',
    priceHalalas: 20000,
    profileId: 'service.salon_hair_color',
    category: 'hair',
    subcategory: 'beauty.hair.color',
    placeMode: 'branch',
  });
  published.hairBlow = await publishService({
    key: 'hair-blow',
    nameAr: 'استشوار إغلاق حقيقي',
    priceHalalas: 15000,
    profileId: 'service.salon_hair_cut',
    category: 'hair',
    subcategory: 'beauty.hair.blowdry',
    placeMode: 'branch',
  });
  published.makeupHome = await publishService({
    key: 'makeup-home',
    nameAr: 'مكياج في موقع العميلة',
    priceHalalas: 28000,
    profileId: 'service.salon_makeup',
    category: 'makeup',
    subcategory: 'beauty.makeup.soft',
    placeMode: 'home',
  });
  published.makeupVenue = await publishService({
    key: 'makeup-venue',
    nameAr: 'مكياج في المقر فقط',
    priceHalalas: 22000,
    profileId: 'service.salon_makeup',
    category: 'makeup',
    subcategory: 'beauty.makeup.evening',
    placeMode: 'branch',
  });

  const manifest = {
    runId,
    startedAt: new Date().toISOString(),
    apiBase: API,
    brandPartnerId: brand.id,
    salonPartnerId: salon.id,
    fixture: { path: fixtureMp4, sha256: mp4Sha, bytes: mp4.length },
    published,
    note: 'Published via partners-portal editor-drafts + media upload + admin approve. No Prisma contentStatus cheat.',
  };
  writeFileSync(join(evidenceDir, 'PUBLISHED_OFFERS.json'), JSON.stringify(manifest, null, 2));
  writeFileSync(join(process.cwd(), '..', 'tmp-all-close-publish.json'), JSON.stringify(manifest, null, 2));
  console.log(JSON.stringify({ ok: true, runId, evidenceDir, offerCount: Object.keys(published).length }, null, 2));
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(JSON.stringify({ ok: false, error: String(err?.stack || err) }));
  process.exitCode = 1;
});
