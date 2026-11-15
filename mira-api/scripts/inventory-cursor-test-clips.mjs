#!/usr/bin/env node
/**
 * Inventory-only: list Discover catalog items that match Cursor/seed fingerprints.
 * Does NOT delete. Writes evidence JSON for human review before cleanup.
 *
 * Usage:
 *   node mira-api/scripts/inventory-cursor-test-clips.mjs
 *   MIRA_API_BASE=https://mira-api-n4p3.onrender.com/api/v1 node ...
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const API = (process.env.MIRA_API_BASE || 'https://mira-api-n4p3.onrender.com/api/v1').replace(/\/$/, '');
const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '../../docs/phase2_3/evidence/store-readiness-2026-03-15');

const TITLE_RE =
  /إغلاق|all-close|رحلة آيفون|اختبار|preview-|cursor|e2e|jamalak-test|rc3-product|rc4-|ph4-/i;
const EMAIL_HINT_RE = /@all-close\.local|@test\.local|ops-iphone@/i;

async function browseAll() {
  const items = [];
  let cursor = null;
  for (let i = 0; i < 40; i++) {
    const q = new URLSearchParams({ limit: '20', visual: '1' });
    if (cursor) q.set('cursor', cursor);
    const res = await fetch(`${API}/marketplace/catalog?${q}`, { headers: { Accept: 'application/json' } });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`catalog ${res.status}: ${body.slice(0, 200)}`);
    }
    const data = await res.json();
    const page = data.items || data.offers || [];
    items.push(...page);
    cursor = data.nextCursor || null;
    if (!cursor || !page.length) break;
  }
  return items;
}

function classify(item) {
  const name = `${item.nameAr || ''} ${item.nameEn || ''}`;
  const partner = `${item.partnerNameAr || ''}`;
  const reasons = [];
  if (TITLE_RE.test(name)) reasons.push('title_fingerprint');
  if (TITLE_RE.test(partner)) reasons.push('partner_fingerprint');
  if (String(item.id || '').startsWith('preview-')) reasons.push('preview_id');
  if (EMAIL_HINT_RE.test(JSON.stringify(item))) reasons.push('email_hint');
  // Developer MIRA content is NOT auto-classified as test.
  if (item.partnerType === 'developer' && !reasons.length) return null;
  return reasons.length ? reasons : null;
}

const items = await browseAll();
const suspects = [];
const keep = [];
for (const item of items) {
  const reasons = classify(item);
  const row = {
    id: item.id,
    kind: item.kind,
    nameAr: item.nameAr,
    partnerNameAr: item.partnerNameAr,
    partnerType: item.partnerType,
    purchaseMode: item.purchaseMode,
    mediaCount: Array.isArray(item.media) ? item.media.length : 0,
  };
  if (reasons) suspects.push({ ...row, reasons, action: 'review_before_delete' });
  else keep.push(row);
}

mkdirSync(outDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const out = {
  at: new Date().toUtcString?.() || new Date().toISOString(),
  api: API,
  totalFetched: items.length,
  suspectCount: suspects.length,
  keepCount: keep.length,
  noteAr:
    'كشف فقط. مقاطع حساب ميرا المطوّر بدون بصمة اختبار تبقى. لا حذف تلقائي في هذه الجولة.',
  suspects,
};
const path = join(outDir, `CURSOR_TEST_CLIPS_INVENTORY_${stamp}.json`);
writeFileSync(path, JSON.stringify(out, null, 2));
writeFileSync(join(outDir, 'CURSOR_TEST_CLIPS_INVENTORY_LATEST.json'), JSON.stringify(out, null, 2));
console.log(JSON.stringify({ path, totalFetched: items.length, suspectCount: suspects.length, keepCount: keep.length }, null, 2));
