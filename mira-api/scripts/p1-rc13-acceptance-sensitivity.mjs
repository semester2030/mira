/**
 * RC13 acceptance-sensitivity — negatives must be REJECTED by the same validators
 * used by browser e2e / field coverage (not a parallel copy).
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  NEGATIVE_SAMPLES,
  REQUIRED_ACCEPTANCE_IDS,
  REQUIRED_FIELD_IDS,
  runNegativeSample,
} from './p1-rc13-acceptance-lib.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..', '..');
const outDir = process.env.MIRA_RC13_OUT_DIR || join(root, 'audit-out', 'p1-rc13');
mkdirSync(outDir, { recursive: true });

const negResults = {};
let allNegOk = true;
for (const id of Object.keys(NEGATIVE_SAMPLES)) {
  const r = runNegativeSample(id);
  negResults[id] = r;
  if (!r.ok) allNegOk = false;
}

const missingSample = {
  required: REQUIRED_ACCEPTANCE_IDS,
  present: REQUIRED_ACCEPTANCE_IDS.filter((id) => id !== 'RC13-10-product-inform'),
};
const missingIds = missingSample.required.filter((id) => !missingSample.present.includes(id));
negResults['mandatory-result-missing'] = {
  ok: missingIds.length > 0,
  missingIds,
  note: 'synthetic: incomplete results list must be detected as failure',
};
if (!negResults['mandatory-result-missing'].ok) allNegOk = false;

const requiredEight = [
  'field-dom-new-server-old',
  'all-required-skipped',
  'unexpected-variant',
  'before-delete-unproven',
  'service-expected-from-actual',
  'service-field-missing-reopen',
  'legacy-retry-two-media',
  'legacy-reopen-ui-missing-api-ok',
];
const eightOk = requiredEight.every((id) => negResults[id] && negResults[id].ok);
if (!eightOk) allNegOk = false;

let e2eCheck = { skipped: true };
if (process.env.MIRA_RC13_E2E_RESULTS) {
  const e2ePath = process.env.MIRA_RC13_E2E_RESULTS;
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
      (id) => !ids.includes(id) && id !== 'RC13-F2-URL' && id !== 'RC13-F2-BUSY',
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

let fieldCheck = { skipped: true };
if (process.env.MIRA_RC13_FIELD_RESULTS) {
  const fp = process.env.MIRA_RC13_FIELD_RESULTS;
  if (!existsSync(fp)) {
    fieldCheck = { skipped: false, ok: false, error: 'missing-field-file' };
    allNegOk = false;
  } else {
    const fj = JSON.parse(readFileSync(fp, 'utf8'));
    const ids = (fj.matrix || []).map((r) => r.testId);
    const missing = REQUIRED_FIELD_IDS.filter((id) => !ids.includes(id));
    const failed = (fj.matrix || []).filter((r) => REQUIRED_FIELD_IDS.includes(r.testId) && r.status !== 'PASS_LOCAL');
    fieldCheck = {
      skipped: false,
      missing,
      failed: failed.map((r) => r.testId),
      ok: fj.ok === true && missing.length === 0 && failed.length === 0,
    };
    if (!fieldCheck.ok) allNegOk = false;
  }
}

const payload = {
  ok: allNegOk && eightOk,
  negativeSamples: negResults,
  requiredEight,
  eightOk,
  requiredAcceptanceIds: REQUIRED_ACCEPTANCE_IDS,
  requiredFieldIds: REQUIRED_FIELD_IDS,
  e2eCheck,
  fieldCheck,
  generated_utc: new Date().toISOString(),
};
writeFileSync(join(outDir, 'ACCEPTANCE_SENSITIVITY.json'), JSON.stringify(payload, null, 2));
console.log(JSON.stringify(payload, null, 2));
process.exitCode = payload.ok ? 0 : 1;
