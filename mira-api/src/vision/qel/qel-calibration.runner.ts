/**
 * Phase Q4 — offline calibration runner.
 * Usage: npm run test:qel-calibration
 * Optional: QEL_CALIBRATION_DATASET=/path/to/manifest.json
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { GarmentQelService } from './garment-qel.service';
import { QelCalibrationProfile, QelCalibrationService } from './qel-calibration.service';

type ManifestEntry = {
  id: string;
  humanAccept: boolean;
  originalPath: string;
  editedPath: string;
  visionContext?: Record<string, unknown>;
};

type Manifest = {
  schemaVersion: string;
  entries: ManifestEntry[];
};

class EnvConfig {
  constructor(private readonly env: Record<string, string | undefined>) {}
  get<T = string>(key: string, defaultValue?: T): T {
    const v = this.env[key];
    if (v === undefined || v === '') return defaultValue as T;
    if (typeof defaultValue === 'number') return Number(v) as T;
    if (typeof defaultValue === 'boolean') return (v === 'true') as T;
    return v as T;
  }
}

async function main(): Promise<void> {
  const config = new EnvConfig(process.env as Record<string, string | undefined>);
  const calibration = new QelCalibrationService(config as never);
  const baseline = calibration.getProfile();

  const fixturePath = resolveFixture('qel-calibration-baseline.v1.json');
  const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8')) as {
    schemaVersion: string;
    profile: QelCalibrationProfile;
    samples: unknown[];
  };

  console.log('=== MIRA QEL Calibration (Phase Q4) ===');
  console.log(`Fixture: ${fixture.schemaVersion} · ${fixture.samples.length} placeholder samples`);
  printProfile('active', baseline);
  printProfile('strict', { ...baseline, ...{ id: 'strict', threshold: 0.88 } });

  const datasetPath = process.env.QEL_CALIBRATION_DATASET?.trim();
  if (!datasetPath) {
    console.log('\nNo QEL_CALIBRATION_DATASET — skipping labeled pair evaluation.');
    console.log('Add manifest JSON with entries: id, humanAccept, originalPath, editedPath');
    return;
  }

  if (!fs.existsSync(datasetPath)) {
    console.error(`Dataset manifest not found: ${datasetPath}`);
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(datasetPath, 'utf8')) as Manifest;
  if (!Array.isArray(manifest.entries) || manifest.entries.length === 0) {
    console.error('Manifest has no entries');
    process.exit(1);
  }

  const manifestDir = path.dirname(path.resolve(datasetPath));
  const validation = validateManifestEntries(manifest.entries, manifestDir);
  if (validation.missing.length > 0) {
    console.error('\n❌ Manifest paths are missing or still placeholders:\n');
    for (const m of validation.missing) {
      console.error(`  [${m.id}] ${m.field}: ${m.path}`);
      console.error(`         → resolved: ${m.resolved}`);
    }
    console.error(
      '\nFix: edit your manifest with real image paths (absolute or relative to manifest file).',
    );
    console.error('Smoke test without real outfits:');
    console.error('  npm run test:qel-calibration:smoke\n');
    process.exit(1);
  }

  const qel = new GarmentQelService(
    config as never,
    { segment: async () => ({ segments: [], topology: { pieceCount: 0, layeringDepth: 0 } }) } as never,
    calibration,
  );

  let agree = 0;
  const scores: { human: boolean; score: number; accepted: boolean }[] = [];

  for (const entry of manifest.entries) {
    const originalPath = resolveManifestPath(manifestDir, entry.originalPath);
    const editedPath = resolveManifestPath(manifestDir, entry.editedPath);
    const original = fs.readFileSync(originalPath);
    const edited = fs.readFileSync(editedPath);
    const result = await qel.evaluate({
      original,
      edited,
      visionContext: entry.visionContext as never,
      cropFirst: false,
    });
    const match = result.accepted === entry.humanAccept;
    if (match) agree += 1;
    scores.push({ human: entry.humanAccept, score: result.weightedScore, accepted: result.accepted });
    console.log(
      `${match ? '✓' : '✗'} ${entry.id} score=${result.weightedScore} human=${entry.humanAccept} qel=${result.accepted}`,
    );
  }

  const accuracy = agree / manifest.entries.length;
  console.log(`\nAgreement with human labels: ${(accuracy * 100).toFixed(1)}% (${agree}/${manifest.entries.length})`);
  suggestThreshold(scores);
}

function resolveManifestPath(manifestDir: string, rawPath: string): string {
  let p = rawPath.trim();
  if (p.startsWith('~/')) {
    p = path.join(os.homedir(), p.slice(2));
  }
  if (!path.isAbsolute(p)) {
    p = path.resolve(manifestDir, p);
  }
  return p;
}

const PLACEHOLDER_HINTS = ['/absolute/path/', '/Users/YOU/', 'path/to/'];

function isPlaceholderPath(p: string): boolean {
  const lower = p.toLowerCase();
  return PLACEHOLDER_HINTS.some((h) => lower.includes(h.toLowerCase()));
}

function validateManifestEntries(
  entries: ManifestEntry[],
  manifestDir: string,
): { missing: { id: string; field: string; path: string; resolved: string }[] } {
  const missing: { id: string; field: string; path: string; resolved: string }[] = [];

  for (const entry of entries) {
    for (const field of ['originalPath', 'editedPath'] as const) {
      const raw = entry[field];
      const resolved = resolveManifestPath(manifestDir, raw);
      if (isPlaceholderPath(raw) || !fs.existsSync(resolved)) {
        missing.push({ id: entry.id, field, path: raw, resolved });
      }
    }
  }

  return { missing };
}

function resolveFixture(name: string): string {
  const besideDist = path.join(__dirname, 'fixtures', name);
  if (fs.existsSync(besideDist)) return besideDist;
  return path.join(process.cwd(), 'src', 'vision', 'qel', 'fixtures', name);
}

function printProfile(label: string, profile: QelCalibrationProfile): void {
  const w = profile.weights;
  console.log(
    `\n[${label}] id=${profile.id} threshold=${profile.threshold} minIoU=${profile.minSegmentIoU}`,
  );
  console.log(
    `  weights: identity=${w.identity} edge=${w.edge} material=${w.material} region=${w.region} color=${w.color}`,
  );
}

function suggestThreshold(scores: { human: boolean; score: number }[]): void {
  let bestT = 0.85;
  let bestAcc = 0;
  for (let t = 0.72; t <= 0.95; t += 0.01) {
    let hit = 0;
    for (const s of scores) {
      const pred = s.score >= t;
      if (pred === s.human) hit += 1;
    }
    const acc = hit / scores.length;
    if (acc >= bestAcc) {
      bestAcc = acc;
      bestT = Math.round(t * 100) / 100;
    }
  }
  console.log(`Suggested threshold from manifest: ${bestT} (accuracy ${(bestAcc * 100).toFixed(1)}%)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
