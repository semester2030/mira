/**
 * CLI used by REVERIFY.sh — same verifyR2EvidenceDocument as unit tests.
 * Usage: npx tsx verify-r2-evidence.ts <jsonPath> <testedCommit> <runStartedIso> <exitCode> [expectedRunId]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { verifyR2EvidenceDocument } from './r2-acceptance-gate';

const [jsonPath, testedCommit, runStartedIso, exitCodeRaw, expectedRunId] = process.argv.slice(2);
if (!jsonPath || !testedCommit || !runStartedIso || exitCodeRaw == null) {
  console.error('usage: verify-r2-evidence.ts <json> <commit> <startedIso> <exitCode> [runId]');
  process.exit(2);
}

const evidence = JSON.parse(readFileSync(jsonPath, 'utf8'));
const result = verifyR2EvidenceDocument({
  evidence,
  testedCommit,
  runStartedIso,
  exitCode: Number(exitCodeRaw),
  expectedRunId,
});

const outDir = jsonPath.replace(/[/\\][^/\\]+$/, '');
writeFileSync(
  `${outDir}/verdict.txt`,
  `${result.verdict}\n`,
);
writeFileSync(
  `${outDir}/verify-detail.json`,
  JSON.stringify(result, null, 2),
);
console.log(JSON.stringify({ verdict: result.verdict, reason: result.reason }));
if (result.verdict === 'FAIL') process.exit(1);
if (result.verdict === 'BLOCKED') process.exit(0);
process.exit(0);
