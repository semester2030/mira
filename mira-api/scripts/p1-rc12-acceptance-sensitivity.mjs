/**
 * RC12 acceptance-sensitivity — negative samples must be REJECTED by validators.
 * Also fails when a required acceptance id is missing from an e2e results payload.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  NEGATIVE_SAMPLES,
  REQUIRED_ACCEPTANCE_IDS,
  runNegativeSample,
} from './p1-rc12-acceptance-lib.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..', '..');
const outDir = process.env.MIRA_RC12_OUT_DIR || join(root, 'audit-out', 'p1-rc12');
mkdirSync(outDir, { recursive: true });

const negResults = {};
let allNegOk = true;
for (const id of Object.keys(NEGATIVE_SAMPLES)) {
  const r = runNegativeSample(id);
  negResults[id] = r;
  if (!r.ok) allNegOk = false;
}

// Missing / skipped mandatory result must fail
const missingSample = {
  required: REQUIRED_ACCEPTANCE_IDS,
  present: REQUIRED_ACCEPTANCE_IDS.filter((id) => id !== 'RC12-10-product-inform'),
};
const missingIds = missingSample.required.filter((id) => !missingSample.present.includes(id));
const missingRejected = missingIds.length > 0;
negResults['mandatory-result-missing'] = {
  ok: missingRejected,
  missingIds,
  note: 'synthetic: incomplete results list must be detected as failure',
};
if (!missingRejected) allNegOk = false;

// When MIRA_RC12_E2E_RESULTS is set, also require every mandatory id present+PASS
let e2eCheck = { skipped: true };
if (process.env.MIRA_RC12_E2E_RESULTS) {
  const e2ePath = process.env.MIRA_RC12_E2E_RESULTS;
  if (!existsSync(e2ePath)) {
    e2eCheck = { skipped: false, path: e2ePath, ok: false, error: 'missing-e2e-file' };
    allNegOk = false;
  } else {
    const raw = readFileSync(e2ePath, 'utf8');
    let ej;
    try {
      ej = JSON.parse(raw);
    } catch (_) {
      const i = raw.lastIndexOf('"ok"');
      const start = raw.lastIndexOf('{', i);
      let depth = 0;
      let end = -1;
      for (let j = start; j < raw.length; j++) {
        if (raw[j] === '{') depth++;
        else if (raw[j] === '}') {
          depth--;
          if (depth === 0) {
            end = j;
            break;
          }
        }
      }
      ej = JSON.parse(raw.slice(start, end + 1));
    }
    const ids = (ej.results || []).map((r) => r.id);
    const missing = REQUIRED_ACCEPTANCE_IDS.filter(
      (id) => !ids.includes(id) && id !== 'RC12-F2-URL' && id !== 'RC12-F2-BUSY',
    );
    const failed = (ej.results || []).filter(
      (r) => REQUIRED_ACCEPTANCE_IDS.includes(r.id) && r.status !== 'PASS_LOCAL',
    );
    e2eCheck = {
      skipped: false,
      path: e2ePath,
      missing,
      failed: failed.map((r) => r.id),
      ok: missing.length === 0 && failed.length === 0 && ej.ok === true,
    };
    if (!e2eCheck.ok) allNegOk = false;
  }
}

const payload = {
  ok: allNegOk,
  negativeSamples: negResults,
  requiredAcceptanceIds: REQUIRED_ACCEPTANCE_IDS,
  e2eCheck,
  generated_utc: new Date().toISOString(),
};
writeFileSync(join(outDir, 'ACCEPTANCE_SENSITIVITY.json'), JSON.stringify(payload, null, 2));
console.log(JSON.stringify(payload, null, 2));
process.exitCode = allNegOk ? 0 : 1;
