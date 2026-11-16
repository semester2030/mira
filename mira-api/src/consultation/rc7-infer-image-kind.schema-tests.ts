/**
 * RC7 — inferImageKind must not treat product photos as face just because
 * the session has a prior skinAnalysisId. Mirrors orchestrator logic.
 */
import assert from 'node:assert/strict';

type Kind = 'face' | 'outfit' | 'unknown';

function inferImageKind(
  snapshot: { skinAnalysisId?: string | null; outfitAnalysisId?: string | null },
  attachmentCount: number,
  message: string,
): Kind {
  if (attachmentCount <= 0) return 'unknown';
  const n = message
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه');
  if (/تسريح|قصه|قصّه|شعر|هايلايت|صبغه|لون شعر|مين تسوي|صالون/.test(n)) {
    return 'outfit';
  }
  if (
    /منتج|عبوه|عبوة|مرطب|واقي|شامبو|سيروم|كريم|علبه|علبة|براند|ماركه|علامه|نفس هذا|مثل هذا|زي هذا|ابي نفس|ابغى نفس/.test(
      n,
    )
  ) {
    return 'unknown';
  }
  if (/وجهي|بشرتي|هالصوره لوجهي|صورة وجه|صوره وجه|تحليل بشر/.test(n)) {
    return 'face';
  }
  if (snapshot.outfitAnalysisId && /اطلال|لبس|فستان|لون/.test(n)) return 'outfit';
  return 'unknown';
}

{
  const skinBound = { skinAnalysisId: 'skin-1' };
  assert.equal(inferImageKind(skinBound, 1, 'ابي نفس هذا'), 'unknown');
  assert.equal(inferImageKind(skinBound, 1, 'أبي مرطب من هالصورة'), 'unknown');
  assert.equal(inferImageKind(skinBound, 1, 'مين تسوي لي مثلها؟'), 'outfit');
  assert.equal(inferImageKind(skinBound, 1, 'شو رأيكم بوجهي؟'), 'face');
  // Prior RC6 bug: skinAnalysisId alone forced face.
  assert.notEqual(inferImageKind(skinBound, 1, 'ابي نفس هذا'), 'face');
  console.log('pass infer_image_kind_ignores_prior_skin_report');
}

console.log('OK rc7 infer-image-kind schema tests');
