/**
 * Operational Hardening — machine-readable Engineering Law audit for Face Intel.
 * Run: npm run audit:face-eng-laws
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

export interface EngLawFinding {
  law: 'EL1' | 'EL2' | 'EL3' | 'EL4' | 'EL5';
  severity: 'pass' | 'warn' | 'fail';
  title: string;
  evidence: string;
}

function repoRoot(): string {
  return path.join(process.cwd());
}

function read(rel: string): string {
  return fs.readFileSync(path.join(repoRoot(), rel), 'utf8');
}

function exists(rel: string): boolean {
  return fs.existsSync(path.join(repoRoot(), rel));
}

export function runEngineeringLawAudit(): {
  passed: boolean;
  findings: EngLawFinding[];
} {
  const findings: EngLawFinding[] = [];

  // EL4 / EL1 — production path is API-only; Flutter mirrors gated.
  const intel = read('src/intelligence/intelligence.service.ts');
  const runCount = (intel.match(/runFaceReportPipeline\(/g) ?? []).length;
  findings.push({
    law: 'EL4',
    severity: runCount === 1 ? 'pass' : 'fail',
    title: 'Single Face Report pipeline call in IntelligenceService',
    evidence: `runFaceReportPipeline occurrences in intelligence.service.ts: ${runCount}`,
  });

  const gatePath =
    '../lib/features/face_intelligence/domain/face_client_mirror_gate.dart';
  findings.push({
    law: 'EL4',
    severity: exists(gatePath) ? 'pass' : 'fail',
    title: 'Flutter client mirror gate present',
    evidence: gatePath,
  });

  const foundation = fs.readFileSync(
    path.join(repoRoot(), gatePath.replace('face_client_mirror_gate.dart', 'face_foundation.dart')),
    'utf8',
  );
  findings.push({
    law: 'EL1',
    severity: foundation.includes('FaceClientMirrorGate.assertMirrorAllowed')
      ? 'pass'
      : 'fail',
    title: 'Flutter FaceFoundationPipeline gated against production',
    evidence: 'face_foundation.dart assertMirrorAllowed',
  });

  findings.push({
    law: 'EL3',
    severity: intel.includes('faceIntelligenceRuntime') ? 'pass' : 'fail',
    title: 'Runtime ownership on MiraBeautyReport',
    evidence: 'faceIntelligenceRuntime field wiring',
  });

  findings.push({
    law: 'EL5',
    severity: exists('src/intelligence/face-intelligence/report.pipeline.ts')
      ? 'pass'
      : 'fail',
    title: 'API runFaceReportPipeline is single SoT for production report',
    evidence: 'report.pipeline.ts',
  });

  findings.push({
    law: 'EL2',
    severity:
      exists('../lib/features/face_intelligence/data/face_intel_production_bridge.dart') &&
      exists('src/intelligence/face-intelligence/parse-face-intel-input.ts')
        ? 'pass'
        : 'fail',
    title: 'Reuse production bridge + parse (no parallel report builder)',
    evidence: 'FaceIntelProductionBridge + parseFaceIntelPackage',
  });

  // Soft warn: Flutter engine mirrors still exist (documented testing/offline).
  findings.push({
    law: 'EL1',
    severity: 'warn',
    title: 'Flutter Face engines retained as Testing/Future offline mirrors',
    evidence:
      'Documented in flutter_face_engine_ownership.md; gated by FaceClientMirrorGate',
  });

  const failed = findings.some((f) => f.severity === 'fail');
  return { passed: !failed, findings };
}

function main(): void {
  const result = runEngineeringLawAudit();
  const outDir = path.join(repoRoot(), 'src/intelligence/face-intelligence/operational');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, 'engineering-law-audit.report.json');
  fs.writeFileSync(outFile, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(result, null, 2));
  console.log(`[audit:face-eng-laws] wrote ${outFile}`);
  assert.equal(result.passed, true, 'Engineering Law audit failed');
}

if (process.argv[1]?.includes('engineering-law-audit')) {
  main();
}