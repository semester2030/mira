/**
 * Shared RC12 acceptance journey helpers (media bytes, recovery probe, admin approve).
 */
import { sha256, evaluateRecoveryAcceptance, evaluateLegacyUploadAcceptance, evaluateLegacyRetryAcceptance, evaluatePublicProductExact, evaluatePublicServiceExact } from './p1-rc12-acceptance-lib.mjs';

export { sha256, evaluateRecoveryAcceptance, evaluateLegacyUploadAcceptance, evaluateLegacyRetryAcceptance, evaluatePublicProductExact, evaluatePublicServiceExact };

/** Distinct valid 1×1 PNGs (different RGB) — known, non-converted fixtures. */
export const PNG = {
  red: Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  ),
  green: Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64',
  ),
  blue: Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPj/HwADBwIAMCbHYQAAAABJRU5ErkJggg==',
    'base64',
  ),
  black: Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
    'base64',
  ),
};

export function pngSha(buf) {
  return sha256(buf);
}

/** Read partner media bytes via authorized local preview path; reject empty/JSON. */
export async function readPartnerMediaBytes(page, mediaId) {
  const raw = await page.evaluate(async (id) => {
    const token = localStorage.getItem('mira_partner_token');
    const res = await fetch(PartnersApi.base + '/partners-portal/media/' + id, {
      headers: { Authorization: 'Bearer ' + token },
    });
    const ct = res.headers.get('content-type') || '';
    const ab = await res.arrayBuffer();
    return {
      status: res.status,
      ct,
      len: ab.byteLength,
      bytes: Array.from(new Uint8Array(ab)),
    };
  }, mediaId);
  if (raw.status !== 200) return { ok: false, reason: 'http-' + raw.status, raw };
  if (!raw.len || raw.len < 8) return { ok: false, reason: 'empty-body', raw };
  if (/json/i.test(raw.ct || '')) return { ok: false, reason: 'json-body', raw };
  const head = Buffer.from(raw.bytes.slice(0, 8));
  // PNG magic or JPEG — reject ASCII JSON/HTML
  const asText = Buffer.from(raw.bytes.slice(0, Math.min(40, raw.len))).toString('utf8');
  if (/^\s*\{/.test(asText) || /message/i.test(asText)) return { ok: false, reason: 'looks-like-json', raw };
  const buf = Buffer.from(raw.bytes);
  return { ok: true, sha: sha256(buf), len: buf.length, ct: raw.ct, buf };
}

export async function probeOwnerAcceptance(page, kindPlural, ownerId, expectedSha) {
  const preview = await page.evaluate(async ({ kindPlural, ownerId }) => {
    const p = await PartnersApi.preview(kindPlural, ownerId);
    const media = Array.isArray(p.media) ? p.media : [];
    const dash = await PartnersApi.dashboard();
    const list =
      kindPlural === 'products'
        ? (dash.catalog && dash.catalog.products) || []
        : (dash.catalog && dash.catalog.services) || [];
    const row = list.find((x) => x.id === ownerId) || null;
    const ctx = MiraEditorV2.getEditContext('catalogForm') || {};
    const formText = (document.querySelector('#catalogForm') && document.querySelector('#catalogForm').innerText) || '';
    return {
      media: media.map((m) => ({
        id: m.id,
        ownerId: m.ownerId || m.productId || m.serviceId || null,
        kind: m.kind,
      })),
      row: row
        ? {
            id: row.id,
            nameAr: row.nameAr,
            priceHalalas: row.priceHalalas,
            contentStatus: row.contentStatus,
            optionsJson: row.optionsJson,
            serviceProfileJson: row.serviceProfileJson || row.draftServiceProfileJson,
          }
        : null,
      uiOwnerId: ctx.targetOwnerId || null,
      submitReviewStatus: ctx.submitReviewStatus || null,
      ctxStatus: ctx.status || null,
      formText: formText.slice(0, 400),
      listIds: list.map((x) => x.id),
    };
  }, { kindPlural, ownerId });

  const mediaIds = preview.media.map((m) => m.id).filter(Boolean);
  const wrongOwner = preview.media.some(
    (m) => m.ownerId && m.ownerId !== ownerId,
  );
  let mediaBytesOk = false;
  let mediaSha = null;
  let mediaRead = null;
  if (mediaIds[0]) {
    mediaRead = await readPartnerMediaBytes(page, mediaIds[0]);
    mediaBytesOk =
      mediaRead.ok === true &&
      (!expectedSha || mediaRead.sha === expectedSha);
    mediaSha = mediaRead.sha || null;
  }
  const submitReviewStatus = preview.submitReviewStatus;
  const submitFailed =
    submitReviewStatus === 'failed' ||
    preview.ctxStatus === 'submit_failed' ||
    /submit_failed|تعذر الإرسال للمراجعة/.test(preview.formText || '');
  const reviewSubmitted =
    submitReviewStatus === 'submitted' ||
    preview.ctxStatus === 'submitted' ||
    /أرسل للمراجعة|قيد المراجعة|تم الإرسال/.test(preview.formText || '');

  return {
    preview,
    media: { ids: mediaIds, wrongOwner },
    mediaBytesOk,
    mediaSha,
    mediaRead,
    uiOwnerId: preview.uiOwnerId,
    submitReviewStatus,
    submitFailed,
    reviewSubmitted,
    listContainsOwner: preview.listIds.includes(ownerId),
    row: preview.row,
  };
}

export async function adminApprove(page, apiBase, adminKey, kind, id) {
  const path = kind === 'product' ? 'product' : 'service';
  let decision = null;
  let decBody = null;
  let rev = null;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const preview = await page.request.get(`${apiBase}/admin/catalog-reviews/${path}/${id}`, {
      headers: { 'X-Admin-Key': adminKey },
    });
    if (!preview.ok()) throw new Error(`admin preview ${kind} ${id}: ${preview.status()}`);
    const prevBody = await preview.json();
    rev =
      prevBody.submittedRevision ??
      prevBody.revision ??
      prevBody.reviewRevision ??
      prevBody.currentRevision ??
      1;
    decision = await page.request.post(`${apiBase}/admin/catalog-reviews/${path}/${id}/decision`, {
      headers: { 'X-Admin-Key': adminKey, 'Content-Type': 'application/json' },
      data: { decision: 'approve', revision: rev },
    });
    decBody = await decision.json();
    if (decision.ok()) break;
    // Conflict: draft/revision moved — refresh and retry
    rev = decBody.currentRevision ?? decBody.submittedRevision ?? decBody.revision ?? rev;
    await new Promise((r) => setTimeout(r, 400));
  }
  return { decision, decBody, rev };
}

/** Prefer draft options when set; else published. Preview API does not expose bare optionsJson. */
export function optionsFromPartnerPreview(prev) {
  if (!prev || typeof prev !== 'object') return [];
  if (prev.draftOptionsCleared) return [];
  if (Array.isArray(prev.draftOptionsJson)) return prev.draftOptionsJson;
  if (Array.isArray(prev.publishedOptionsJson)) return prev.publishedOptionsJson;
  if (Array.isArray(prev.optionsJson)) return prev.optionsJson;
  if (Array.isArray(prev.draftOptionsJson)) return prev.draftOptionsJson;
  return [];
}

export function variantsFromPartnerPreview(prev) {
  if (!prev || typeof prev !== 'object') return [];
  if (prev.draftVariantsCleared) return [];
  if (Array.isArray(prev.draftVariantsJson)) return prev.draftVariantsJson;
  if (Array.isArray(prev.publishedVariantsJson)) return prev.publishedVariantsJson;
  if (Array.isArray(prev.variantsJson)) return prev.variantsJson;
  return [];
}

export function pushResult(results, id, ok, detail) {
  results.push({
    id,
    status: ok ? 'PASS_LOCAL' : 'FAIL',
    detail: typeof detail === 'string' ? detail : JSON.stringify(detail),
    utc: new Date().toISOString(),
  });
}
