/**
 * P5-C06 local facets timing — measurements only (no invented PASS budget).
 * Run from mira-api with local DATABASE_URL / Nest not required: hits running API if BASE_URL set,
 * else spins a minimal note that C07 catalog facets paths were timed via fetch to local Nest when available.
 *
 * Prefer: BASE_URL=http://127.0.0.1:PORT node scripts/p5-c06-facets-timing.mjs
 * Fallback: reuses C07-style catalog query against an already-running server, or records BLOCKED.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '../../audit-out/p0-p7-final/logs/p5-c06-facets');
mkdirSync(outDir, { recursive: true });

const base = process.env.BASE_URL || process.env.MIRA_API_BASE || '';
const partnerId = process.env.C06_PARTNER_ID || '';
const rounds = Number(process.env.C06_ROUNDS || 30);

function pct(sorted, p) {
  if (!sorted.length) return null;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[i];
}

async function timeGet(url) {
  const t0 = performance.now();
  const res = await fetch(url);
  const body = await res.json().catch(() => ({}));
  const ms = performance.now() - t0;
  return { ms, status: res.status, n: (body.items || body.results || []).length, facets: !!body.facets };
}

const started = new Date().toISOString();
const report = {
  id: 'P5_C06_FACETS_TIMING',
  started,
  env: { base: base || null, rounds, partnerId: partnerId || null, note: 'no PASS budget invented' },
  samples: [],
  summary: null,
  verdict: 'NOT_RUN',
};

if (!base || !partnerId) {
  report.verdict = 'BLOCKED';
  report.summary = {
    reason:
      'Requires BASE_URL and C06_PARTNER_ID of a published partner with catalog volume. No synthetic PASS threshold applied.',
  };
  writeFileSync(join(outDir, 'RESULTS.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
  process.exit(0);
}

const urls = [
  `${base}/api/v1/marketplace/catalog?partnerId=${partnerId}&kind=product&facets=1&limit=24`,
  `${base}/api/v1/marketplace/catalog?partnerId=${partnerId}&kind=product&variant.color=black&facets=1&limit=24`,
  `${base}/api/v1/marketplace/catalog?partnerId=${partnerId}&kind=service&facets=1&limit=24`,
];

for (const url of urls) {
  const times = [];
  let last = null;
  for (let i = 0; i < rounds; i++) {
    last = await timeGet(url);
    times.push(last.ms);
  }
  times.sort((a, b) => a - b);
  report.samples.push({
    url: url.replace(partnerId, '<partner>'),
    rounds,
    lastStatus: last && last.status,
    lastN: last && last.n,
    hasFacets: last && last.facets,
    p50: pct(times, 50),
    p95: pct(times, 95),
    p99: pct(times, 99),
    min: times[0],
    max: times[times.length - 1],
  });
}

report.finished = new Date().toISOString();
report.verdict = 'MEASURED';
report.summary = {
  noteAr: 'قياسات فقط — لا معيار PASS مخترع. اربط بميزانية معتمدة إن وُجدت.',
};
writeFileSync(join(outDir, 'RESULTS.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
process.exit(0);
